import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseInput } from '../../src/model/sourceInput';
import { markdownToSource, topicToSource } from '../../src/adapters/markdown';
import { compileDisc } from '../../src/model/compiler';
import { validateManifest } from '../../src/model/validate';
import { arbMarkdown, arbTopic } from '../generators';

const FENCE_MARK = 'ZZFENCEMARK';
const HTML_MARK = 'ZZHTMLMARK';
const IMG_MARK = 'ZZIMGMARK';

// Planted first so an unterminated fence in the generated tail cannot affect them.
const PLANTED =
  [
    '# Planted Title',
    ['```', FENCE_MARK, '```'].join('\n'),
    ['<div>', HTML_MARK, '</div>'].join('\n'),
    `![${IMG_MARK}](http://img.example/${IMG_MARK}.png)`,
    '',
  ].join('\n\n');

describe('Property 20: Markdown and topic fallback produces valid discs', () => {
  // Feature: dynamic-disc-compiler, Property 20: Markdown and topic fallback produces valid discs
  // **Validates: Requirements 11.6, 11.7, 17.3**
  it('markdown input compiles to a valid disc and planted markers never reach paragraphs', () => {
    fc.assert(
      fc.property(arbMarkdown, (md) => {
        const parsed = parseInput(PLANTED + md);
        expect(parsed.ok && parsed.kind).toBe('markdown');
        if (!parsed.ok || parsed.kind !== 'markdown') return;

        const source = markdownToSource(parsed.text);
        for (const p of source.paragraphs) {
          expect(p).not.toContain(FENCE_MARK);
          expect(p).not.toContain(HTML_MARK);
          expect(p).not.toContain(IMG_MARK);
        }

        const manifest = compileDisc(source);
        const result = validateManifest(manifest);
        expect(result.ok ? [] : result.errors).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: dynamic-disc-compiler, Property 20: Markdown and topic fallback produces valid discs
  // **Validates: Requirements 11.6, 11.7, 17.3**
  it('topic input compiles to a valid disc', () => {
    fc.assert(
      fc.property(arbTopic, (t) => {
        const parsed = parseInput(t);
        // Topics that classify as a URL or an error are outside the fallback path.
        fc.pre(parsed.ok && (parsed.kind === 'topic' || parsed.kind === 'markdown'));
        if (!parsed.ok || (parsed.kind !== 'topic' && parsed.kind !== 'markdown')) return;

        const source =
          parsed.kind === 'topic' ? topicToSource(parsed.text) : markdownToSource(parsed.text);
        const manifest = compileDisc(source);
        const result = validateManifest(manifest);
        expect(result.ok ? [] : result.errors).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});


