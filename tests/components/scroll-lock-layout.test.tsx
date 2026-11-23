// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import type { StorageLike } from '../../src/library/discLibrary';
import type { DiscManifest } from '../../src/model/manifest';

const css = (file: string) => readFileSync(resolve(__dirname, '../../src/styles', file), 'utf8');
/** The declarations of the first rule whose selector is exactly `sel`, at the start of a line. */
function rule(file: string, sel: string): string {
  const esc = sel.replace(/[.[\]"=>:()]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css(file))?.[1] ?? '';
}

const disc: DiscManifest = {
  disc_id: 'scroll',
  title: 'Scroll Disc',
  tagline: 'Pinned chrome',
  sections: [
    {
      section_id: 'moat',
      title: 'The Moat',
      paragraphs: ['Water circles the keep.', 'Moats could be wet or dry.'],
      facts: ['Moats can be wet or dry.', 'Some moats held fish.'],
      timeline: [{ when: '1100s', event: 'Wide moats appear.' }],
    },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above The Moat.'] },
    ...Array.from({ length: 10 }, (_, i) => ({ section_id: `s${i}`, title: `Extra Section ${i + 1}`, paragraphs: [`Paragraph ${i + 1}.`] })),
  ],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

beforeEach(() => {
  setMuted(true);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  __setContextFactory(null);
});

// ---- Outer chrome and sidebar scroll lock ----------------------------------------------------
describe('DiscBrowser scroll lock (CSS)', () => {
  it('locks the browser, the disc window, its content box, and the workspace', () => {
    const browser = rule('browser.css', '.disc-browser');
    for (const d of ['display: flex', 'flex-direction: column', 'min-height: 0', 'overflow: hidden']) expect(browser).toContain(d);
    const win = rule('workspace.css', '.disc-window');
    for (const d of ['flex: 1 1 auto', 'min-height: 0', 'overflow: hidden']) expect(win).toContain(d);
    const content = rule('workspace.css', '.disc-window .window-content');
    for (const d of ['display: flex', 'flex-direction: column', 'min-height: 0', 'overflow: hidden']) expect(content).toContain(d);
    const workspace = rule('workspace.css', '.disc-workspace');
    for (const d of ['display: flex', 'flex: 1 1 auto', 'min-height: 0', 'overflow: hidden']) expect(workspace).toContain(d);
  });

  it('never lets the chrome shrink, so the title bar, menus, toolbar, breadcrumb, and status bar stay in view', () => {
    const src = css('workspace.css');
    const m = /((?:[.\w -]+,\s*)+[.\w -]+)\s*\{\s*flex: 0 0 auto;\s*\}/.exec(src);
    expect(m).not.toBeNull();
    const selectors = m![1]!.split(',').map((s) => s.trim());
    expect(selectors).toEqual(['.disc-window .window-title-bar', '.disc-window .window-menubar', '.nav-toolbar', '.breadcrumb', '.status-bar']);
  });

  it('scrolls only the sidebar and the main pane, each inside its own box', () => {
    const tree = rule('workspace.css', '.disc-workspace .disc-tree');
    for (const d of ['flex: 0 0 236px', 'min-height: 0', 'overflow-y: auto', 'overflow-x: hidden']) expect(tree).toContain(d);
    const main = rule('workspace.css', '.disc-main');
    for (const d of ['flex: 1 1 auto', 'min-width: 0', 'min-height: 0', 'overflow: auto']) expect(main).toContain(d);
  });

  it('puts the sidebar and main pane inside the locked workspace, between the toolbar and the status bar', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await user.click(screen.getByText('Scroll Disc'));
    const content = document.querySelector('.disc-window .window-content')!;
    const order = Array.from(content.children).map((el) => el.className.split(' ')[0]);
    expect(order[0]).toBe('nav-toolbar');
    expect(order[1]).toBe('breadcrumb');
    expect(order[order.length - 1]).toBe('status-bar');
    expect(order).toContain('disc-workspace');
    const workspace = content.querySelector(':scope > .disc-workspace')!;
    expect(Array.from(workspace.children).map((el) => el.className)).toEqual(['disc-tree', 'disc-main']);
    // A 12-section disc lists every section in the sidebar, which scrolls on its own.
    expect(within(workspace.querySelector('.disc-tree') as HTMLElement).getAllByRole('button', { name: /Extra Section/ })).toHaveLength(10);
    // The title bar and menu bar sit outside the content box, in the locked window.
    const win = document.querySelector('.disc-window')!;
    expect(win.querySelector(':scope > .window-title-bar')).toBeTruthy();
    expect(win.querySelector(':scope > .window-menubar')).toBeTruthy();
  });
});

// ---- Pinned article header, scrolling body ----------------------------------------------------
describe('ArticleViewer pinned header', () => {
  it('lays the article out as a fixed column: a pinned header over a body that alone scrolls', () => {
    const viewer = rule('article.css', '.article-viewer');
    for (const d of ['height: 100%', 'display: flex', 'flex-direction: column', 'overflow: hidden', 'box-sizing: border-box']) expect(viewer).toContain(d);
    expect(viewer).not.toContain('overflow: auto');
    expect(rule('article.css', '.article-header')).toContain('flex: 0 0 auto');
    const body = rule('article.css', '.article-body');
    for (const d of ['flex: 1 1 auto', 'min-height: 0', 'overflow-y: auto']) expect(body).toContain(d);
    expect(rule('article.css', '.article-body::after')).toContain('clear: both');
  });

  it('puts the title, tool row, and Find bar in the header and everything else in the body', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ArticleViewer sections={disc.sections} sectionId="moat" discTitle="Scroll Disc" onSelectSection={() => {}} onAddNote={() => {}} />,
    );
    const article = container.querySelector('article.article-viewer')!;
    expect(Array.from(article.children).map((el) => el.className)).toEqual(['article-header', 'article-body']);
    const header = article.querySelector(':scope > .article-header') as HTMLElement;
    expect(within(header).getByRole('heading', { level: 1, name: 'The Moat' })).toBeTruthy();
    const tools = within(header).getByRole('group', { name: 'Article tools' });
    for (const name of ['Cite / Print Preview', 'Read Aloud', '1x', 'Find in Article', '+ Quote']) {
      expect(within(tools).getByRole('button', { name })).toBeTruthy();
    }
    await user.click(within(tools).getByRole('button', { name: 'Find in Article' }));
    expect(within(header).getByRole('search', { name: 'Find in article' })).toBeTruthy();

    const body = article.querySelector(':scope > .article-body') as HTMLElement;
    expect(body.querySelector('.article-aside')).toBeTruthy();
    expect(body.querySelectorAll('.article-paragraph')).toHaveLength(2);
    expect(within(body).getByRole('region', { name: 'Chronology' })).toBeTruthy();
    expect(within(body).getByRole('navigation', { name: 'See Also' })).toBeTruthy();
    expect(header.querySelector('.article-paragraph, .article-aside, .article-chrono')).toBeNull();
  });

  it('starts the body at the top on a section change', () => {
    const { container, rerender } = render(<ArticleViewer sections={disc.sections} sectionId="moat" />);
    const body = container.querySelector('.article-body') as HTMLElement;
    body.scrollTop = 200;
    rerender(<ArticleViewer sections={disc.sections} sectionId="keep" />);
    expect((container.querySelector('.article-body') as HTMLElement).scrollTop).toBe(0);
  });

  it('lets Chronology and See Also follow the text beside the aside, with no gap from clearing it', () => {
    for (const sel of ['.article-chrono', '.article-seealso']) {
      const r = rule('article.css', sel);
      expect(r).toContain('display: flow-root');
      expect(r).not.toMatch(/clear:/);
    }
    // The aside no longer pads the bottom of a short article.
    expect(rule('article.css', '.article-aside')).toContain('margin: 0 0 0 14px');
    // An empty "Added to Notebook." line takes no room.
    const added = rule('notebook.css', '.article-callout__added');
    expect(added).not.toContain('min-height');
    expect(added).toContain('margin: 0');
  });
});

// ---- + Note micro-buttons --------------------------------------------------------------------
describe('+ Note micro-buttons', () => {
  it('are compact 10px inline micro-buttons that never split a fact', () => {
    const r = rule('article.css', '.bevel-button.article-callout__add');
    for (const d of ['display: inline-block', 'padding: 1px 5px', 'font-size: 10px', 'white-space: nowrap', 'min-width: 0']) expect(r).toContain(d);
    // One definition only: the old rule in notebook.css is gone.
    expect(css('notebook.css')).not.toMatch(/\.article-callout__add\s*\{/);
  });

  it('ride at the end of each Quick Fact, named for the fact they add', () => {
    const { container } = render(<ArticleViewer sections={disc.sections} sectionId="moat" onAddNote={() => {}} />);
    const items = Array.from(container.querySelectorAll('.article-callout__list li'));
    expect(items).toHaveLength(2);
    for (const [i, li] of items.entries()) {
      const fact = disc.sections[0]!.facts![i]!;
      expect(li.firstChild!.textContent).toBe(fact);
      const button = li.lastElementChild as HTMLButtonElement;
      expect(button.className).toContain('article-callout__add');
      expect(button.textContent).toBe('+ Note');
      expect(button.getAttribute('aria-label')).toBe(`Add to Notebook: ${fact}`);
    }
  });
});
