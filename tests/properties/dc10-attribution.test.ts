import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc, sanitizeLine } from '../../src/model/compiler';
import type { ExtractedSource, SourceKind } from '../../src/model/compiler';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

const arbSource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

const KIND_LABELS: Record<SourceKind, string> = {
  github: 'GitHub repository',
  webpage: 'Web page',
  markdown: 'Markdown text',
  topic: 'Topic',
};

function expectedParagraph(source: ExtractedSource): string {
  const label = sanitizeLine(source.metadata.source, 300) || 'unknown source';
  return `Source (${KIND_LABELS[source.metadata.kind]}): ${label}`;
}

describe('Property 10: Source attribution', () => {
  // Feature: dynamic-disc-compiler, Property 10: Source attribution
  // **Validates: Requirements 2.12, 7.7**
  it('a section paragraph names the kind label and the sanitized source label', () => {
    fc.assert(
      fc.property(arbSource, (source) => {
        const disc = compileDisc(source);
        const all = disc.sections.flatMap((s) => s.paragraphs);
        expect(all).toContain(expectedParagraph(source));
        expect(disc.sections[0]!.paragraphs).toContain(expectedParagraph(source));
      }),
      { numRuns: 100 },
    );
  });

  it("uses 'unknown source' when the source label is empty", () => {
    fc.assert(
      fc.property(arbSource, (source) => {
        const empty: ExtractedSource = { ...source, metadata: { ...source.metadata, source: '' } };
        const disc = compileDisc(empty);
        const kindLabel = KIND_LABELS[empty.metadata.kind];
        expect(disc.sections.flatMap((s) => s.paragraphs)).toContain(`Source (${kindLabel}): unknown source`);
      }),
      { numRuns: 100 },
    );
  });
});
