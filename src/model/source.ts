export type SourceKind = 'github' | 'webpage' | 'markdown' | 'topic';

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
}
