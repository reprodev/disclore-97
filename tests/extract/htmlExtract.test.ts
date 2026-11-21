// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractHtml } from '../../src/extract/htmlExtract';

// Numeric entities are built by concatenation to keep the hash sign out of literals.
const H = String.fromCharCode(35);
const ent = (body: string): string => '&' + H + body + ';';

describe('extractHtml', () => {
  it('extracts the title and ignores later titles', () => {
    const r = extractHtml('<html><head><title> My  Page </title></head><title>Other</title></html>');
    expect(r.title).toBe('My Page');
  });

  it('extracts h1 to h3 as headings and ignores h4', () => {
    const r = extractHtml('<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4>');
    expect(r.headings).toEqual(['One', 'Two', 'Three']);
  });

  it('extracts paragraphs and collapses whitespace', () => {
    const r = extractHtml('<p>Hello\n   <b>bold</b> world</p><p>Second</p>');
    expect(r.paragraphs).toEqual(['Hello bold world', 'Second']);
  });

  it('decodes named entities', () => {
    const r = extractHtml('<p>Tom &amp; Jerry &lt;3 &copy; &mdash; &nope;</p>');
    expect(r.paragraphs).toEqual(['Tom & Jerry <3 \u00a9 \u2014 &nope;']);
  });

  it('decodes decimal and hex entities', () => {
    const r = extractHtml('<p>' + ent('65') + ent('x42') + ent('X43') + '</p>');
    expect(r.paragraphs).toEqual(['ABC']);
  });

  it('replaces invalid numeric entities with U+FFFD', () => {
    const r = extractHtml('<p>' + ent('0') + ent('xD800') + ent('x110000') + '</p>');
    expect(r.paragraphs).toEqual(['\ufffd\ufffd\ufffd']);
  });

  it('decodes only once for double-encoded entities', () => {
    const r = extractHtml('<p>&amp;lt; &amp;' + H + '65;</p>');
    expect(r.paragraphs).toEqual(['&lt; &' + H + '65;']);
  });

  it('discards script, style, noscript, template, svg, and iframe content', () => {
    const r = extractHtml(
      '<p>a</p><script>var x = "<p>no</p>";</script><style>p{}</style>' +
        '<noscript><p>ns</p></noscript><template><p>t</p></template>' +
        '<svg><p>s</p></svg><iframe><p>i</p></iframe><p>b</p>',
    );
    expect(r.paragraphs).toEqual(['a', 'b']);
  });

  it('skips comments and doctype', () => {
    const r = extractHtml('<!DOCTYPE html><p>a<!-- <p>hidden</p> -->b</p>');
    expect(r.paragraphs).toEqual(['ab']);
  });

  it('keeps earlier content when a tag is unterminated', () => {
    const r = extractHtml('<h1>Head</h1><p>Body</p><p class="x');
    expect(r.headings).toEqual(['Head']);
    expect(r.paragraphs).toEqual(['Body']);
  });

  it('keeps earlier content when a comment is unterminated', () => {
    const r = extractHtml('<p>Body</p><!-- never closed <p>x</p>');
    expect(r.paragraphs).toEqual(['Body']);
  });

  it('handles > inside attribute values', () => {
    const r = extractHtml('<p title="a > b" data-x=\'c>d\'>Text</p>');
    expect(r.paragraphs).toEqual(['Text']);
  });

  it('limits headings to 12 and paragraphs to 40', () => {
    const hs = Array.from({ length: 20 }, (_, i) => `<h2>H${i}</h2>`).join('');
    const ps = Array.from({ length: 60 }, (_, i) => `<p>P${i}</p>`).join('');
    const r = extractHtml(hs + ps);
    expect(r.headings).toHaveLength(12);
    expect(r.headings[0]).toBe('H0');
    expect(r.paragraphs).toHaveLength(40);
    expect(r.paragraphs[39]).toBe('P39');
  });

  it('returns empty results when there is no content', () => {
    expect(extractHtml('')).toEqual({ title: '', headings: [], paragraphs: [] });
    expect(extractHtml('<div></div><p>  </p>')).toEqual({ title: '', headings: [], paragraphs: [] });
  });
});
