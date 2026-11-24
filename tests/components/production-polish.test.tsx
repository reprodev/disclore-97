// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { BurnDialog } from '../../src/components/BurnDialog';
import type { FetchLike } from '../../src/adapters/types';
import { applyTheme, syncThemeColor, THEME_COLOR_TOKEN } from '../../src/library/theme';
import type { DiscManifest } from '../../src/model/manifest';
import { topicFromUrl } from '../../src/model/topicGuess';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const HEX = new RegExp('#' + '[0-9a-fA-F]{3,8}\\b');

beforeEach(() => {
  setMuted(true);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  __setContextFactory(null);
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  document.documentElement.removeAttribute('style');
  document.documentElement.className = '';
});

// ---- "Try as Wikipedia topic" fallback ---------------------------------------------------------
const PAGE = 'https://www.example.org/history/lighthouses-of-maine.html';

/** A fetch that answers /api/extract with `extract`, and records every request. /api/topic finds nothing. */
function fakeFetch(extract: () => Promise<Response>) {
  const calls: string[] = [];
  const fn: FetchLike = (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('/api/extract')) return extract();
    if (url.startsWith('/api/topic')) return Promise.resolve(new Response('{"error":{"message":"no match"}}', { status: 404 }));
    return Promise.reject(new TypeError('unexpected request'));
  };
  return { fn, calls };
}

const blocked = () => Promise.resolve(new Response(JSON.stringify({ error: { message: 'The site refused the request.' } }), { status: 403 }));
const missingReader = () => Promise.resolve(new Response('not found', { status: 404 }));
const networkDown = () => Promise.reject(new TypeError('offline'));

function setup(fetchFn: FetchLike, online = true) {
  const onBurned = vi.fn<(m: DiscManifest) => void>();
  render(<BurnDialog onBurned={onBurned} onClose={() => {}} fetch={fetchFn} minBurnMs={0} online={() => online} />);
  return { onBurned, input: () => screen.getByRole('textbox') as HTMLTextAreaElement };
}

const wikiButton = () => screen.queryByRole('button', { name: /^Try as Wikipedia topic/ });

describe('BurnDialog "Try as Wikipedia topic" fallback', () => {
  it('offers it beside "Burn offline" when a web page is blocked (fetch-failed)', async () => {
    const user = userEvent.setup();
    const { fn } = fakeFetch(blocked);
    const { input } = setup(fn);
    await user.type(input(), PAGE);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toMatch(/could not be fetched/));
    expect(screen.getByRole('button', { name: 'Burn offline from "www.example.org"' })).toBeTruthy();
    const wiki = wikiButton()!;
    expect(wiki.textContent).toBe('Try as Wikipedia topic: "lighthouses of maine"');
    expect(wiki.getAttribute('title')).toContain('English Wikipedia');
    // Both ways forward sit together, in the alert.
    expect(alert.querySelector('.burn-error__actions')!.children).toHaveLength(2);
  });

  it('offers it when the page reader is unavailable', async () => {
    const user = userEvent.setup();
    const { fn } = fakeFetch(missingReader);
    const { input } = setup(fn);
    await user.type(input(), PAGE);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    await screen.findByText(/page reader is not available/);
    expect(wikiButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Burn offline from/ })).toBeTruthy();
  });

  it('burns the guessed subject through /api/topic, and never dead-ends', async () => {
    const user = userEvent.setup();
    const { fn, calls } = fakeFetch(blocked);
    const { input, onBurned } = setup(fn);
    await user.type(input(), PAGE);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    await user.click(await screen.findByRole('button', { name: /^Try as Wikipedia topic/ }));
    await waitFor(() => expect(onBurned).toHaveBeenCalledTimes(1));
    expect(calls.filter((c) => c.startsWith('/api/topic'))).toEqual([`/api/topic?q=${encodeURIComponent('lighthouses of maine')}`]);
    // No match here, so the offline study outline was burned instead: still a disc.
    expect(onBurned.mock.calls[0]![0].sections.length).toBeGreaterThan(0);
    expect(input().value).toBe('lighthouses of maine');
  });

  it('is not offered when the network is down, offline, or for other kinds of input', async () => {
    const user = userEvent.setup();
    // Network down: a topic lookup would fail too, so only "Burn offline" is offered.
    const { input } = setup(fakeFetch(networkDown).fn);
    await user.type(input(), PAGE);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    await screen.findByRole('button', { name: /^Burn offline from/ });
    expect(wikiButton()).toBeNull();
    cleanup();

    // Browser offline: the offline notice, no Wikipedia button.
    const offline = setup(fakeFetch(blocked).fn, false);
    await user.type(offline.input(), PAGE);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    await screen.findByRole('button', { name: /^Burn offline from/ });
    expect(wikiButton()).toBeNull();
    cleanup();

    // A GitHub address that fails is not a web page.
    const repo = setup(() => Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 })));
    await user.type(repo.input(), 'https://github.com/octocat/no-such-repo');
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    await screen.findByRole('button', { name: /^Burn offline from/ });
    expect(wikiButton()).toBeNull();
  });

  it('goes away as soon as the address is edited', async () => {
    const user = userEvent.setup();
    const { input } = setup(fakeFetch(blocked).fn);
    await user.type(input(), PAGE);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    await screen.findByRole('button', { name: /^Try as Wikipedia topic/ });
    await user.type(input(), 'x');
    expect(wikiButton()).toBeNull();
  });

  it('styles the two buttons as a compact row, with tokens only', () => {
    const css = read('src/styles/burn.css');
    const block = (sel: string) => new RegExp(`${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(block('.burn-error__actions')).toContain('display: flex');
    expect(block('.burn-error__actions .bevel-button')).toContain('font-size: 11px');
    expect(css).not.toMatch(HEX);
  });
});

describe('topicFromUrl', () => {
  it('uses the last meaningful path segment', () => {
    expect(topicFromUrl(PAGE)).toBe('lighthouses of maine');
    expect(topicFromUrl('https://en.example.com/wiki/Bell_Rock_Lighthouse')).toBe('Bell Rock Lighthouse');
    expect(topicFromUrl('https://news.example.com/science/2024/05/17/carved-turnips/')).toBe('carved turnips');
    expect(topicFromUrl('https://example.com/articles/Caf%C3%A9-culture/index.html')).toBe('Café culture');
  });

  it('skips generic words, ids, and dates, then falls back to the site name', () => {
    expect(topicFromUrl('https://www.nasa.gov/')).toBe('nasa');
    expect(topicFromUrl('https://www.nasa.gov/news/article/12345')).toBe('nasa');
    expect(topicFromUrl('https://blog.example.com/p/9f3a2b7c1d')).toBe('example');
    expect(topicFromUrl('https://en.museum.co.uk/')).toBe('museum');
    expect(topicFromUrl('https://example.com/2024/06/index.php')).toBe('example');
  });

  it('caps long slugs and rejects what is not a web address', () => {
    const long = topicFromUrl(`https://example.com/${'word-'.repeat(40)}end`)!;
    expect(long.length).toBeLessThanOrEqual(80);
    expect(topicFromUrl('not a url')).toBeUndefined();
    expect(topicFromUrl('ftp://example.com/lighthouses')).toBeUndefined();
    expect(topicFromUrl('https://123.45.67.89/')).toBeUndefined();
  });
});

// ---- index.html metadata and the favicon -------------------------------------------------------
describe('index.html metadata', () => {
  const html = read('index.html');
  const meta = (attr: string, name: string) => new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]+)"`).exec(html)?.[1];

  it('links the local SVG favicon', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(existsSync(resolve(root, 'public/favicon.svg'))).toBe(true);
  });

  it('has a description and Open Graph title and description', () => {
    expect(meta('name', 'description')).toMatch(/1997 Windows 95 CD-ROM encyclopedia/);
    expect(meta('property', 'og:title')).toMatch(/^DiscLore '97/);
    expect(meta('property', 'og:description')).toMatch(/Wikipedia topic/);
    for (const v of [meta('name', 'description'), meta('property', 'og:description')]) expect(v!.length).toBeLessThanOrEqual(300);
  });

  it('holds no colour literal and no external resource', () => {
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i);
    // theme-color comes from the --color-night token at run time instead of a literal here.
    expect(html).not.toContain('theme-color');
  });

  it('draws the favicon as a crisp 16 x 16 pixel CD-ROM with no hex and no external reference', () => {
    const svg = read('public/favicon.svg');
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toMatch(HEX);
    expect(svg.match(/https?:\/\/[^"]+/g)).toEqual(['http://www.w3.org/2000/svg']);
    expect(svg).not.toMatch(/<(?:image|script|use|style)\b|href=/);
    const fills = new Set([...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]));
    expect(fills).toEqual(new Set(['black', 'white', 'silver', 'gray', 'lightskyblue']));
    expect(svg.match(/<rect /g)!.length).toBeGreaterThan(40);
  });
});

describe('theme-color from the --color-night token', () => {
  const metaContent = () => document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;

  it('creates the meta tag from the token, and follows the edition', () => {
    const el = document.documentElement;
    el.style.setProperty(THEME_COLOR_TOKEN, 'navy');
    applyTheme(el, 'classic');
    expect(metaContent()).toBe('navy');
    el.style.setProperty(THEME_COLOR_TOKEN, 'midnightblue');
    applyTheme(el, 'haunted');
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(metaContent()).toBe('midnightblue');
  });

  it('leaves the page alone when the token is not defined, and never throws', () => {
    syncThemeColor(document.documentElement);
    expect(metaContent()).toBeUndefined();
    const detached = document.implementation.createHTMLDocument('x').documentElement;
    expect(() => syncThemeColor(detached)).not.toThrow();
  });

  it('reads the token that tokens.css defines for every edition', () => {
    const tokens = read('src/styles/tokens.css');
    expect(tokens.match(/--color-night:\s*#/g)!.length).toBe(3);
  });
});

// ---- Narrow-screen rules ---------------------------------------------------------------------------
/** The body of the first `@media (max-width: 767px)` block in a stylesheet, found by brace matching. */
function mobileBlock(file: string, query = '@media (max-width: 767px)'): string {
  const css = read(file);
  const at = css.indexOf(query);
  expect(at, `${file} has ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
  }
  return '';
}
const ruleIn = (block: string, sel: string) =>
  new RegExp(`${sel.replace(/[.[\]"=>:()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(block)?.[1] ?? '';

describe('narrow screens (under 768px)', () => {
  it('moves the desktop icons from the 104px column into a top strip', () => {
    expect(read('src/styles/desktop.css')).toMatch(/\.desktop__work\s*\{[^}]*padding: 8px 8px 6px 104px/);
    const m = mobileBlock('src/styles/desktop.css');
    expect(ruleIn(m, '.desktop__work')).toContain('padding: 4px');
    const icons = ruleIn(m, '.desktop__work .desktop-icons');
    for (const d of ['position: static', 'flex-direction: row', 'width: auto', 'overflow-x: auto']) expect(icons).toContain(d);
    expect(ruleIn(m, '.desktop__work .desktop-icon')).toContain('width: 64px');
  });

  it('stacks the Home columns and the disc shelf, and lets the Home window scroll as one page', () => {
    const m = mobileBlock('src/styles/home.css');
    expect(m).toMatch(/\.home__grid,\s*\.pack-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
    expect(ruleIn(m, '.home-window > .window-content')).toContain('overflow-y: auto');
    expect(ruleIn(m, '.home-window :is(.home)')).toContain('flex: 0 0 auto');
    expect(ruleIn(m, '.home :is(.home__grid)')).toContain('grid-template-rows: auto');
    expect(ruleIn(m, '.home :is(.home-group--packs, .home__side)')).toContain('overflow: visible');
    const shelf = ruleIn(m, '.home :is(.pack-shelf)');
    expect(shelf).toContain('flex: 0 0 auto');
    expect(shelf).toContain('max-height: 60vh');
    // Wide screens keep the locked Home window.
    expect(read('src/styles/home.css')).toMatch(/\n\.home-window \.window-content\s*\{[^}]*overflow: hidden/);
  });

  it('puts the contents sidebar above the main pane, each still scrolling on its own', () => {
    const m = mobileBlock('src/styles/workspace.css');
    expect(ruleIn(m, '.disc-workspace')).toContain('flex-direction: column');
    const tree = ruleIn(m, '.disc-workspace .disc-tree');
    expect(tree).toContain('flex: 0 1 auto');
    expect(tree).toContain('max-height: 32vh');
    expect(ruleIn(m, '.disc-main')).toContain('overscroll-behavior: contain');
  });

  it('stacks the KeepMaze console and lets it scroll, while the wide zero-scroll stage is unchanged', () => {
    const css = read('src/styles/keepmaze.css');
    expect(css).toMatch(/\n\.keepmaze__stage\s*\{[^}]*height: clamp\(130px, 24vh, 175px\)/);
    expect(css).toMatch(/\n\.keepmaze__console\s*\{[^}]*grid-template-columns: minmax\(260px, 2fr\) minmax\(0, 3fr\)/);
    const m = mobileBlock('src/styles/keepmaze.css');
    expect(ruleIn(m, '.keepmaze__console')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(ruleIn(m, '.keepmaze__hud-cluster')).toContain('flex-wrap: wrap');
    // The pane that holds KeepMaze is the scroller on small screens.
    expect(read('src/styles/workspace.css')).toMatch(/\n\.disc-main\s*\{[^}]*overflow: auto/);
  });

  it('keeps the taskbar to one row with Start and Sound always available', () => {
    const m = mobileBlock('src/styles/taskbar.css');
    expect(m).toMatch(/\.taskbar__clock,\s*\.taskbar__drive\s*\{\s*display: none;/);
    expect(ruleIn(m, '.taskbar__tab')).toContain('min-width: 0');
    expect(ruleIn(m, '.taskbar__start')).toContain('flex: 0 0 auto');
    expect(ruleIn(m, '.taskbar__tray')).toContain('flex: 0 0 auto');
    expect(m).not.toMatch(/\.taskbar__start[^{]*\{[^}]*display: none/);
    expect(m).not.toMatch(/\.mute-toggle[^{]*\{[^}]*display: none/);
    const tiny = mobileBlock('src/styles/taskbar.css', '@media (max-width: 420px)');
    expect(ruleIn(tiny, '.ambience-toggle')).toContain('display: none');
  });
});
