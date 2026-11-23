import type { MediaItem } from './manifest';

/** Where a disc's content came from. stitched is a disc combined from 2 to 4 other sources (see stitch.ts). */
export type SourceKind = 'github' | 'webpage' | 'markdown' | 'topic' | 'stitched';

export interface SourceMetadata {
  kind: SourceKind;
  /** Source URL or a short label, for example "https://github.com/o/r" or "Topic: Lighthouses". */
  source: string;
  description?: string;
  languages?: string[];
  author?: string;
  /** Pre-formatted plain-text facts, for example "Stars: 1200". Used for Quick Facts. */
  facts?: string[];
}

export interface ExtractedSource {
  title: string;
  headings: string[];
  paragraphs: string[];
  metadata: SourceMetadata;
  /** Optional candidate pictures. The compiler keeps only safe ones, at most 8. */
  media?: MediaItem[];
}
