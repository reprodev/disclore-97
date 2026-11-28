// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import { CiteDialog } from '../../src/components/CiteDialog';
import { castlesDisc } from '../../src/discs/castles';
import type { StorageLike } from '../../src/library/discLibrary';
import { LOCALE_KEY } from '../../src/library/locale';
import { LocaleContext } from '../../src/i18n/LocaleContext';

function memoryStorage(init: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(init));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

afterEach(cleanup);

describe('multi-language shell', () => {
  it('Start > Language... switches the shell at once, saves it, and English stays the default', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { container } = render(<App sources={[castlesDisc]} storage={storage} />);
    const desk = () => container.querySelector('.desktop') as HTMLElement;
    expect(desk().hasAttribute('lang')).toBe(false);
    expect(screen.getByRole('group', { name: 'Home status bar' }).textContent).toContain('CD-ROM: AutoPlay Ready');

    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Language...' }));
    const dialog = screen.getByRole('dialog', { name: 'Language' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(12);
    await user.click(within(dialog).getByRole('radio', { name: /Français/ }));
    expect(storage.map.get(LOCALE_KEY)).toBe('fr');
    expect(desk().getAttribute('lang')).toBe('fr');
    expect(desk().getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('dialog', { name: 'Langue' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Accès rapides')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Home status bar' }).textContent).toContain('CD-ROM : exécution automatique prête');
  });

  it('Arabic sets dir="rtl" on the shell and translates the Start menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'ar' })} />);
    const desk = container.querySelector('.desktop') as HTMLElement;
    expect(desk.getAttribute('lang')).toBe('ar');
    expect(desk.getAttribute('dir')).toBe('rtl');
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    expect(screen.getByRole('menuitem', { name: 'اللغة...' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'نسخ قرص CD-R جديد...' })).toBeTruthy();
  });

  it('leaves <html lang> alone in English, and sets it for other shells', () => {
    document.documentElement.removeAttribute('lang');
    render(<App sources={[castlesDisc]} storage={memoryStorage()} />);
    expect(document.documentElement.hasAttribute('lang')).toBe(false);
    cleanup();
    render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'ko' })} />);
    expect(document.documentElement.getAttribute('lang')).toBe('ko');
    cleanup();
    expect(document.documentElement.hasAttribute('lang')).toBe(false);
  });

  it('localizes the KeepMaze caption and the Personal Best line', () => {
    render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'fr', 'disclore97.best.castles': JSON.stringify({ v: 1, bestScore: 210, bestRank: 'Royal Archivist' }) })} search="?disc=castles&view=keepmaze" />);
    expect(screen.getByRole('region', { name: 'Quête KeepMaze' })).toBeTruthy();
    expect(screen.getByText('Record personnel : 210 pts (Royal Archivist)')).toBeTruthy();
  });

  it('localizes the disc menus and toolbar, and an unknown saved locale falls back to English', async () => {
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'de' })} search="?disc=castles" />);
    expect(screen.getByRole('menuitem', { name: 'Datei' })).toBeTruthy();
    expect(within(screen.getByRole('toolbar', { name: 'Navigation' })).getByRole('button', { name: /Wörterbuch/ })).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'Datei' }));
    expect(screen.getByRole('menuitem', { name: 'Disc schließen' })).toBeTruthy();
    cleanup();
    render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'tlh' })} search="?disc=castles" />);
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeTruthy();
  });

  it('Display Properties has a quick Language selector that switches the shell', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castlesDisc]} storage={storage} />);
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Display Properties...' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'ja');
    expect(storage.map.get(LOCALE_KEY)).toBe('ja');
    expect(screen.getByRole('dialog', { name: '画面のプロパティ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'エディションの既定に戻す' })).toBeTruthy();
  });

  it('the Burn dialog offers every Wikipedia language, starting from the shell language', async () => {
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'es' })} />);
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Grabar nuevo CD-R...' }));
    const select = screen.getByRole('combobox', { name: 'Idioma de Wikipedia' }) as HTMLSelectElement;
    expect(select.value).toBe('es');
    expect([...select.options].map((o) => o.value)).toEqual(['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh', 'ar', 'sv', 'tr']);
  });
});

describe('disc text keeps its own language inside a translated shell', () => {
  it('an English disc in an Arabic shell reads left to right, in the article, tour, flashcards, and KeepMaze', () => {
    const storage = () => memoryStorage({ [LOCALE_KEY]: 'ar' });
    const views: [string, string][] = [
      ['?disc=castles&section=' + castlesDisc.sections[0]!.section_id, 'article.article-viewer'],
      ['?disc=castles&view=tour', 'section.tour'],
      ['?disc=castles&view=flashcards', 'section.flashcards'],
    ];
    for (const [search, selector] of views) {
      const { container } = render(<App sources={[castlesDisc]} storage={storage()} search={search} />);
      expect(container.querySelector('.desktop')!.getAttribute('dir')).toBe('rtl');
      const el = container.querySelector(selector)!;
      expect(el.getAttribute('lang'), selector).toBe('en');
      expect(el.getAttribute('dir'), selector).toBe('ltr');
      cleanup();
    }
  });

  it('the Cite print preview and the booklet keep an English disc left to right in an Arabic shell', async () => {
    const user = userEvent.setup();
    render(
      <LocaleContext.Provider value="ar">
        <CiteDialog section={castlesDisc.sections[0]!} discTitle={castlesDisc.title} booklet={{ disc: castlesDisc, edition: 'classic' }} onClose={() => {}} />
      </LocaleContext.Provider>,
    );
    const page = document.querySelector('.cite-dialog__page')!;
    expect(page.getAttribute('lang')).toBe('en');
    expect(page.getAttribute('dir')).toBe('ltr');
    expect(document.getElementById('cite-text')!.getAttribute('dir')).toBe('ltr');
    await user.click(screen.getAllByRole('tab')[1]!);
    for (const sel of ['.booklet__title', '.booklet__tracks', '.booklet__spine']) {
      expect(document.querySelector(sel)!.getAttribute('dir'), sel).toBe('ltr');
    }
    cleanup();
    // An Arabic disc in an English shell reads right to left in the preview.
    render(<CiteDialog section={castlesDisc.sections[0]!} discTitle={castlesDisc.title} language="ar" onClose={() => {}} />);
    expect(document.querySelector('.cite-dialog__page')!.getAttribute('dir')).toBe('rtl');
  });

  it('discTextAttrs adds nothing when the shell and disc are both English', async () => {
    const { discTextAttrs } = await import('../../src/model/languages');
    expect(discTextAttrs(undefined, 'en')).toEqual({});
    expect(discTextAttrs('en', 'en')).toEqual({});
    expect(discTextAttrs(undefined, 'ar')).toEqual({ lang: 'en', dir: 'ltr' });
    expect(discTextAttrs('ar', 'en')).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(discTextAttrs('ja', 'fr')).toEqual({ lang: 'ja', dir: 'ltr' });
    expect(discTextAttrs('evil', 'en')).toEqual({});
  });

  it('in an RTL shell the Start menu opens a submenu with ArrowLeft and closes it with ArrowRight', async () => {
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage({ [LOCALE_KEY]: 'ar' })} />);
    const desk = document.querySelector('.desktop') as HTMLElement;
    desk.style.direction = 'rtl'; // jsdom has no UA stylesheet for [dir]
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    const owner = screen.getByRole('menuitem', { name: /الأقراص المحمّلة/ });
    owner.focus();
    await user.keyboard('{ArrowRight}');
    expect(owner.getAttribute('aria-expanded')).toBe('false');
    await user.keyboard('{ArrowLeft}');
    expect(owner.getAttribute('aria-expanded')).toBe('true');
    await new Promise((r) => setTimeout(r, 0));
    await user.keyboard('{ArrowRight}');
    expect(owner.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('article language', () => {
  it('an Arabic disc reads right to left, and an English one gets no lang or dir', () => {
    const { container, rerender } = render(<ArticleViewer sections={castlesDisc.sections} sectionId={castlesDisc.sections[0]!.section_id} language="ar" />);
    const article = () => container.querySelector('article.article-viewer')!;
    expect(article().getAttribute('lang')).toBe('ar');
    expect(article().getAttribute('dir')).toBe('rtl');
    rerender(<ArticleViewer sections={castlesDisc.sections} sectionId={castlesDisc.sections[0]!.section_id} />);
    expect(article().hasAttribute('lang')).toBe(false);
    expect(article().hasAttribute('dir')).toBe(false);
  });
});

describe('Jewel-Case Booklet', () => {
  const section = castlesDisc.sections[0]!;
  const booklet = {
    disc: { ...castlesDisc, language: 'fr' },
    edition: 'haunted' as const,
    best: { bestScore: 210, bestRank: 'Royal Archivist' },
    daily: { day: '2026-11-23', result: { score: 300, timeMs: 95_000 } },
  };

  it('is a second tab in Cite / Print Preview with a front cover and a back tracklist', async () => {
    const user = userEvent.setup();
    render(<CiteDialog section={section} discTitle={castlesDisc.title} booklet={booklet} onClose={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Citation', 'Jewel-Case Booklet']);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tabpanel', { name: 'Jewel-Case Booklet' })).toBeNull();
    await user.click(tabs[1]!);
    expect(document.body.classList.contains('booklet-printing')).toBe(true);
    expect(document.body.classList.contains('cite-printing')).toBe(true);

    // Inside the dialog the booklet is the tab panel named by its tab.
    const book = screen.getByRole('tabpanel', { name: 'Jewel-Case Booklet' });
    const front = within(book).getByRole('region', { name: 'Front cover' });
    expect(front.querySelector('.booklet__emblem svg.boot-hero__art')!.getAttribute('data-edition')).toBe('haunted');
    expect(within(front).getByRole('heading', { level: 2 }).textContent).toBe('Ancient Castles & Keeps');
    expect(front.textContent).toContain('Haunted Edition');
    expect(front.textContent).toContain('FR \u2022 Français');

    const back = within(book).getByRole('region', { name: 'Back tray' });
    const tracks = within(back).getAllByRole('listitem').filter((li) => li.classList.contains('booklet__track'));
    expect(tracks.map((t) => t.textContent)).toEqual(castlesDisc.sections.map((s, i) => `${String(i + 1).padStart(2, '0')}${s.title}`));
    expect(back.textContent).toContain('Quick Facts');
    expect(back.textContent).toContain('Personal Best: 210 pts (Royal Archivist)');
    expect(back.textContent).toContain('Daily Challenge 2026-11-23: 300 pts in 1:35');

    await user.click(tabs[0]!);
    expect(document.body.classList.contains('booklet-printing')).toBe(false);
  });

  it('says plainly when there are no records yet, and a plain Cite dialog has no tabs', async () => {
    const user = userEvent.setup();
    render(<CiteDialog section={section} discTitle={castlesDisc.title} booklet={{ disc: castlesDisc, edition: 'classic' }} onClose={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Jewel-Case Booklet' }));
    const back = screen.getByRole('region', { name: 'Back tray' });
    expect(back.textContent).toContain('Personal Best: none yet');
    expect(back.textContent).toContain('Daily Challenge: not played today');
    expect(screen.getByRole('region', { name: 'Front cover' }).textContent).toContain('EN \u2022 English');
    cleanup();
    render(<CiteDialog section={section} discTitle={castlesDisc.title} onClose={() => {}} />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('tabs follow the ARIA pattern: roving tabindex, arrow keys, Home and End, and linked panels', async () => {
    const user = userEvent.setup();
    render(<CiteDialog section={section} discTitle={castlesDisc.title} booklet={booklet} onClose={() => {}} />);
    const [cite, book] = screen.getAllByRole('tab');
    expect(cite!.tabIndex).toBe(0);
    expect(book!.tabIndex).toBe(-1);
    const citePanel = document.getElementById(cite!.getAttribute('aria-controls')!)!;
    expect(citePanel.getAttribute('role')).toBe('tabpanel');
    expect(citePanel.getAttribute('aria-labelledby')).toBe(cite!.id);
    cite!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(book);
    expect(book!.getAttribute('aria-selected')).toBe('true');
    expect(book!.tabIndex).toBe(0);
    const bookPanel = document.getElementById(book!.getAttribute('aria-controls')!)!;
    expect(bookPanel.getAttribute('role')).toBe('tabpanel');
    expect(bookPanel.classList.contains('booklet')).toBe(true);
    // Both panels are always in the page, so every aria-controls names a real element.
    expect(document.getElementById(cite!.getAttribute('aria-controls')!)).toBeTruthy();
    // The citation box hides with its panel, so it leaves the Tab order.
    expect((document.getElementById('cite-text') as HTMLTextAreaElement).hidden).toBe(true);
    expect(citePanel.hidden).toBe(true);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(cite);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(book);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(cite);
  });

  it('marks the disc text with the disc language, and translates its own labels', async () => {
    const user = userEvent.setup();
    render(<CiteDialog section={section} discTitle={castlesDisc.title} booklet={{ ...booklet, disc: { ...castlesDisc, language: 'ar' } }} onClose={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Jewel-Case Booklet' }));
    const title = document.querySelector('.booklet__title')!;
    expect(title.getAttribute('lang')).toBe('ar');
    expect(title.getAttribute('dir')).toBe('rtl');
    expect(document.querySelector('.booklet__tracks')!.getAttribute('dir')).toBe('rtl');
  });

  it('the citation box hides for real in CSS, and RTL-sensitive chrome uses logical properties', () => {
    const css = (f: string) => readFileSync(resolve(__dirname, '../../src/styles', f), 'utf8');
    expect(css('article.css')).toMatch(/\.cite-dialog__text\[hidden\]\s*\{\s*display: none;/);
    expect(css('menubar.css')).toMatch(/\.menubar__menu\s*\{[^}]*inset-inline-start: 0;/);
    expect(css('taskbar.css')).toMatch(/\.startmenu\s*\{[^}]*inset-inline-start: 2px;/);
    expect(css('taskbar.css')).toMatch(/\[dir='rtl'\] \.startmenu__arrow\s*\{\s*transform: scaleX\(-1\);/);
    expect(css('eastereggs.css')).toMatch(/\.keepmaze__whisper\s*\{[^}]*inset-inline-end: 6px;/);
    expect(css('shortcuts.css')).toMatch(/\.desktop-menu__item\s*\{[^}]*text-align: start;/);
  });

  it('prints at jewel-case size, in tokens, with square corners and no shadows or gradients', () => {
    const print = readFileSync(resolve(__dirname, '../../src/styles/print.css'), 'utf8');
    const block = print.slice(print.indexOf('Printing the Jewel-Case Booklet'));
    expect(block).toMatch(/@media print/);
    expect(block).toMatch(/body\.booklet-printing \.cite-dialog__page,\s*body\.booklet-printing \.cite-dialog__tabs\s*\{\s*display: none;/);
    expect(block).toMatch(/\.booklet__front\s*\{[^}]*width: 120mm;[^}]*height: 120mm;/);
    expect(block).toMatch(/\.booklet__back\s*\{[^}]*width: 150mm;[^}]*height: 118mm;/);
    const screenCss = readFileSync(resolve(__dirname, '../../src/styles/article.css'), 'utf8');
    for (const css of [block, screenCss]) {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css).not.toMatch(/gradient\(/);
      expect(css).not.toMatch(/border-radius:\s*[1-9]/);
    }
    expect(screenCss).toMatch(/\.booklet__front,\s*\.booklet__back\s*\{[^}]*border-radius: 0;/);
  });
});

describe('Kiro hooks and agents', () => {
  const json = (f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../.kiro/hooks', f), 'utf8')) as {
    hooks: { trigger: string; matcher: string; action: { type: string; command: string } }[];
  };

  it('the i18n parity hook runs the i18n tests when a file under src/i18n is saved', () => {
    const h = json('i18n-parity-on-locale-save.json').hooks[0]!;
    expect(h.trigger).toBe('PostFileSave');
    expect(h.action).toMatchObject({ type: 'command', command: 'npx vitest --run tests/i18n/' });
    const re = new RegExp(h.matcher);
    expect(re.test('src/i18n/locales/fr.ts')).toBe(true);
    expect(re.test('src\\i18n\\index.ts')).toBe(true);
    expect(re.test('src/components/i18nish.tsx')).toBe(false);
  });

  it('the build hook runs the production build when vite.config.ts or wrangler.toml is saved', () => {
    const h = json('build-check-on-config-save.json').hooks[0]!;
    expect(h.trigger).toBe('PostFileSave');
    expect(h.action).toMatchObject({ type: 'command', command: 'npm run build' });
    const re = new RegExp(h.matcher);
    expect(re.test('vite.config.ts')).toBe(true);
    expect(re.test('wrangler.toml')).toBe(true);
    expect(re.test('src/App.tsx')).toBe(false);
  });

  it.each(['a11y-and-viewport-auditor.md', 'security-ssrf-reviewer.md'])('%s is read-only: read and shell tools, every write denied', (f) => {
    const text = readFileSync(resolve(__dirname, '../../.kiro/agents', f), 'utf8');
    const front = text.slice(4, text.indexOf('\n---', 4));
    expect(front).toContain(`name: ${f.replace(/\.md$/, '')}`);
    expect(front).toContain('tools: ["read", "shell"]');
    expect(front).toMatch(/capability: fs_write\n\s+match: \["\*\*"\]\n\s+effect: deny/);
    expect(front).toMatch(/"npm run build\*"[^\]]*\]\n\s+effect: deny/);
  });
});
