// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { burn, refreshDisc } from '../../src/adapters/burn';
import { topicToSource } from '../../src/adapters/markdown';
import { fetchTopicSource } from '../../src/adapters/topic';
import type { FetchLike } from '../../src/adapters/types';
import { handleTopic, pageUrl } from '../../src/extract/topicHandler';
import { speechTag, toWikiLanguage, WIKI_LANGUAGES } from '../../src/model/languages';
import { OUTLINE_TEXT } from '../../src/model/outlineText';
import { validateManifest } from '../../src/model/validate';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const EXTRACT = [
  "Un phare est une tour destinée à signaler l'entrée d'un port ou un danger aux navigateurs pendant la nuit.",
  '== Histoire ==',
  "Le phare d'Alexandrie, construit vers 280 av. J.-C., reste le plus célèbre des phares de l'Antiquité.",
  '== Voir aussi ==',
  'Liste de phares du monde entier, une simple liste de liens qui ne doit pas devenir un paragraphe.',
].join('\n');

function wiki() {
  const calls: URL[] = [];
  const fn = vi.fn<Fetch>(async (input) => {
    const u = new URL(input);
    calls.push(u);
    if (u.searchParams.get('generator') === 'search') return reply({ query: { pages: [{ title: 'Phare', extract: EXTRACT }] } });
    return reply({ query: { pages: [] } });
  });
  return { fn, calls };
}
const req = (query: string) => new Request(`https://disclore.test/api/topic?${query}`);

describe('/api/topic lang allowlist', () => {
  it('looks a topic up on the matching Wikipedia, and English when lang is absent', async () => {
    const fr = wiki();
    const res = await handleTopic(req('q=phare&lang=fr'), { fetch: fr.fn });
    expect(res.status).toBe(200);
    expect(fr.calls.length).toBeGreaterThan(0);
    for (const u of fr.calls) expect(u.host).toBe('fr.wikipedia.org');
    const body = (await res.json()) as { metadata: { source: string }; headings: string[] };
    expect(body.metadata.source).toBe(pageUrl('Phare', 'fr'));
    expect(body.headings).toEqual(['Histoire']); // "Voir aussi" is a reference section and is dropped
    const en = wiki();
    await handleTopic(req('q=lighthouse'), { fetch: en.fn });
    for (const u of en.calls) expect(u.host).toBe('en.wikipedia.org');
  });

  it.each(WIKI_LANGUAGES.map((l) => [l]))('%s maps to its own fixed wikipedia.org host', async (lang) => {
    const w = wiki();
    await handleTopic(req(`q=x&lang=${lang}`), { fetch: w.fn });
    for (const u of w.calls) {
      expect(u.protocol).toBe('https:');
      expect(u.host).toBe(`${lang}.wikipedia.org`);
      expect(u.pathname).toBe('/w/api.php');
    }
  });

  it.each([
    'evil.example',
    'en.evil.example',
    '127.0.0.1',
    'localhost',
    'en/../',
    'en@evil.example',
    'en:8080',
    'EN',
    'en-US',
    'xx',
    '%2e%2e',
    'en.wikipedia.org',
    'fr\u0000',
    'en#',
    'zh-classical',
  ])('refuses lang=%j with 400 and never calls out', async (bad) => {
    const w = wiki();
    const res = await handleTopic(new Request(`https://disclore.test/api/topic?q=x&lang=${encodeURIComponent(bad)}`), { fetch: w.fn });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported-language' });
    expect(w.fn).not.toHaveBeenCalled();
  });

  it('an empty lang is English, and the search text never reaches the host', async () => {
    const w = wiki();
    await handleTopic(req(`q=${encodeURIComponent('x.evil.example/../')}&lang=`), { fetch: w.fn });
    for (const u of w.calls) expect(u.host).toBe('en.wikipedia.org');
  });
});

describe('the client asks for the chosen language', () => {
  it('adds &lang= only for non-English topics', async () => {
    const seen: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      seen.push(String(input));
      return reply({ error: 'not-found' }, 404);
    };
    await fetchTopicSource('Lighthouse', { fetch: fetchFn });
    await fetchTopicSource('Phare', { fetch: fetchFn, language: 'fr' });
    await fetchTopicSource('Phare', { fetch: fetchFn, language: 'evil' as never });
    expect(seen).toEqual(['/api/topic?q=Lighthouse', '/api/topic?q=Phare&lang=fr', '/api/topic?q=Phare']);
  });

  it('a French burn records the language, and falls back to a French outline offline', async () => {
    const offline: FetchLike = () => Promise.reject(new TypeError('offline'));
    const r = await burn('Phare', { fetch: offline, language: 'fr' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.language).toBe('fr');
    expect(r.manifest.sections[0]!.paragraphs[0]).toContain("Ceci est un plan d'étude hors ligne pour Phare");
    expect(validateManifest(r.manifest).ok).toBe(true);
    const en = await burn('Lighthouse', { fetch: offline });
    expect(en.ok && en.manifest.language).toBeUndefined();
  });

  it('a French outline refreshes from French Wikipedia', async () => {
    const offline: FetchLike = () => Promise.reject(new TypeError('offline'));
    const r = await burn('Phare', { fetch: offline, language: 'fr' });
    if (!r.ok) throw new Error('no outline');
    const seen: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      seen.push(String(input));
      return reply({ title: 'Phare', headings: ['Histoire'], paragraphs: ['Un phare est une tour qui guide les navires la nuit.', 'Il en existe des milliers.'] });
    };
    const full = await refreshDisc(r.manifest, { fetch: fetchFn });
    expect(seen[0]).toBe('/api/topic?q=Phare&lang=fr');
    expect(full.ok && full.manifest.language).toBe('fr');
  });
});

describe('localized offline outlines', () => {
  it('every language has six headings and six paragraphs naming the topic, and English is unchanged', () => {
    for (const lang of WIKI_LANGUAGES) {
      const o = OUTLINE_TEXT[lang]('Phare');
      expect(o.headings).toHaveLength(6);
      expect(o.paragraphs).toHaveLength(6);
      expect(o.headings[0]).toContain('Phare');
      expect(o.label).toContain('Phare');
    }
    const en = topicToSource('Lighthouses');
    expect(en.paragraphs[0]).toBe(
      'This is an offline study outline for Lighthouses, not an encyclopedia article. No article text could be fetched, so use this page to write down what you already know about Lighthouses.',
    );
    expect(en.metadata.source).toBe('Topic: Lighthouses (offline study outline)');
  });
});

describe('language helpers', () => {
  it('maps disc languages to speech tags and reads junk as English', () => {
    expect(speechTag('fr')).toBe('fr-FR');
    expect(speechTag('de')).toBe('de-DE');
    expect(speechTag('ja')).toBe('ja-JP');
    expect(speechTag('ar')).toBe('ar-SA');
    expect(speechTag(undefined)).toBe('en-US');
    expect(speechTag('evil')).toBe('en-US');
    expect(toWikiLanguage('__proto__')).toBe('en');
  });
});
