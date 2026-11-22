// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fetchDefinition } from '../../src/adapters/define';
import type { FetchLike } from '../../src/adapters/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const GOOD = {
  word: 'moat',
  phonetic: '/moʊt/',
  meanings: [
    { partOfSpeech: 'noun', definitions: ['A ditch <b>around</b> a castle.', 'Any barrier.'] },
    { partOfSpeech: 'verb', definitions: [] },
  ],
};

describe('fetchDefinition', () => {
  it('calls /api/define with the encoded word and returns a sanitized definition', async () => {
    const f = vi.fn<FetchLike>(async () => json(GOOD));
    const r = await fetchDefinition('Moat s', { fetch: f });
    expect(f.mock.calls[0]![0]).toBe('/api/define?word=Moat%20s');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.word).toBe('moat');
    expect(r.value.phonetic).toBe('/moʊt/');
    expect(r.value.meanings).toHaveLength(1);
    expect(r.value.meanings[0]!.definitions).toHaveLength(2);
    expect(r.value.meanings[0]!.definitions[0]).not.toMatch(/[<>]/);
  });

  it('fails with unavailable on 404 and when no meaning survives', async () => {
    const a = await fetchDefinition('zzz', { fetch: async () => json({ error: 'not-found' }, 404) });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error.code).toBe('unavailable');
    const b = await fetchDefinition('zzz', { fetch: async () => json({ word: 'zzz', meanings: [] }) });
    expect(b.ok).toBe(false);
  });

  it('fails with fetch-failed on a server error and on a reply of the wrong shape', async () => {
    const a = await fetchDefinition('moat', { fetch: async () => json({ error: 'upstream-failed' }, 502) });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error.code).toBe('fetch-failed');
    const b = await fetchDefinition('moat', { fetch: async () => json({ nope: true }) });
    expect(b.ok).toBe(false);
  });

  it('never throws when the network fails', async () => {
    const r = await fetchDefinition('moat', {
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    expect(r.ok).toBe(false);
  });
});
