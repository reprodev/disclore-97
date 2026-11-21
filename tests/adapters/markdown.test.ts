// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { markdownToSource, parseMarkdown } from '../../src/adapters/markdown';

describe('parseMarkdown', () => {
  it('maps heading levels: first h1 is title, h2/h3 are headings, h4+ become paragraphs', () => {
    const p = parseMarkdown('# Title\n\n## Two\n\n### Three\n\n#### Four\n\n# Second h1');
    expect(p.title).toBe('Title');
    expect(p.headings).toEqual(['Two', 'Three', 'Second h1']);
    expect(p.paragraphs).toEqual(['Four']);
  });

  it('strips list markers and keeps item text', () => {
    const p = parseMarkdown('- apple\n* banana\n1. cherry\n2) date');
    expect(p.paragraphs.join(' ')).toContain('apple');
    expect(p.paragraphs.join(' ')).toContain('date');
    expect(p.paragraphs.join(' ')).not.toMatch(/^[-*]|\b1\./);
  });

  it('skips table rows', () => {
    const p = parseMarkdown('Intro text\n\n| a | b |\n|---|---|\n| SECRETCELL | d |\n\nAfter');
    expect(p.paragraphs).toEqual(['Intro text', 'After']);
  });

  it('skips fenced code (backtick and tilde) and HTML blocks', () => {
    const md = 'Before\n\n```js\nFENCED code\n```\n\n~~~\nTILDE code\n~~~\n\n<div>HTMLBLOCK</div>\n\nAfter';
    const p = parseMarkdown(md);
    expect(p.paragraphs).toEqual(['Before', 'After']);
  });

  it('drops image markup', () => {
    const p = parseMarkdown('See ![ALTTEXT](http://x.test/a.png) here');
    const text = p.paragraphs.join(' ');
    expect(text).not.toContain('![');
    expect(text).not.toContain('http://x.test');
    expect(text).toContain('See');
    expect(text).toContain('here');
  });

  it('returns empty results for empty input', () => {
    expect(parseMarkdown('')).toEqual({ headings: [], paragraphs: [] });
  });
});

describe('markdownToSource', () => {
  it('uses a default title for empty input', () => {
    const s = markdownToSource('');
    expect(s.title).toBe('Untitled Markdown');
    expect(s.metadata.kind).toBe('markdown');
  });

  it('parses 20000 characters in under 50 ms (best of three)', () => {
    const para = 'Some **bold** text with a [link](http://a.test) and `code`. ';
    let md = '';
    let i = 0;
    while (md.length < 20000) {
      md += `## Heading ${i}\n\n- item ${i}\n\n${para}\n\n| a | b |\n\n`;
      i++;
    }
    md = md.slice(0, 20000);
    let best = Infinity;
    for (let r = 0; r < 3; r++) {
      const t = performance.now();
      markdownToSource(md);
      best = Math.min(best, performance.now() - t);
    }
    expect(best).toBeLessThan(50);
  });
});
