// Fallback adapter: Markdown text and bare topics to ExtractedSource. Pure, no I/O.

import { stripMarkdownInline } from '../model/compile/text';
import { DEFAULT_LANGUAGE, toWikiLanguage } from '../model/languages';
import type { WikiLanguage } from '../model/languages';
import { OUTLINE_TEXT } from '../model/outlineText';
import type { ExtractedSource } from '../model/source';

export interface ParsedMarkdown {
  title?: string;
  headings: string[];
  paragraphs: string[];
}

const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_RE = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const HTML_BLOCK_RE = /^ {0,3}<[A-Za-z/!]/;

function isRule(line: string): boolean {
  const t = line.trim();
  if (t.length < 3) return false;
  const c = t[0];
  if (c !== '-' && c !== '*' && c !== '_') return false;
  let count = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === c) count++;
    else if (ch !== ' ' && ch !== '\t') return false;
  }
  return count >= 3;
}

function clean(s: string): string {
  return stripMarkdownInline(s).replace(/\s+/g, ' ').trim();
}

/** Single pass over the lines of `md`. Linear in input size. */
export function parseMarkdown(md: string): ParsedMarkdown {
  const lines = String(md ?? '').split(/\r\n|\r|\n/);
  const headings: string[] = [];
  const paragraphs: string[] = [];
  let title: string | undefined;

  let buf: string[] = [];
  let fence: { ch: string; len: number } | null = null;
  let inHtml = false;
  let prevBlank = true;

  const flush = (): void => {
    if (buf.length > 0) {
      const text = clean(buf.join(' '));
      if (text !== '') paragraphs.push(text);
      buf = [];
    }
  };

  for (const line of lines) {
    const blank = line.trim() === '';

    if (fence) {
      const m = FENCE_RE.exec(line);
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len && line.trim().length === m[1].length) {
        fence = null;
      }
      prevBlank = false;
      continue;
    }
    if (inHtml) {
      if (blank) {
        inHtml = false;
        prevBlank = true;
      }
      continue;
    }
    if (blank) {
      flush();
      prevBlank = true;
      continue;
    }

    const fm = FENCE_RE.exec(line);
    if (fm) {
      flush();
      fence = { ch: fm[1][0], len: fm[1].length };
      prevBlank = false;
      continue;
    }
    if (HTML_BLOCK_RE.test(line)) {
      flush();
      inHtml = true;
      prevBlank = false;
      continue;
    }
    if (prevBlank && buf.length === 0 && /^(?: {4}|\t)/.test(line)) {
      prevBlank = false;
      continue; // indented code
    }
    prevBlank = false;

    if (/^ {0,3}\|/.test(line) || isRule(line)) {
      flush();
      continue;
    }

    const hm = HEADING_RE.exec(line);
    if (hm) {
      flush();
      const level = hm[1].length;
      const text = clean((hm[2] ?? '').replace(/[ \t]+#+[ \t]*$/, ''));
      if (level <= 3) {
        if (text !== '') {
          if (level === 1 && title === undefined) title = text;
          else headings.push(text);
        }
      } else if (text !== '') {
        paragraphs.push(text);
      }
      continue;
    }

    const lm = LIST_RE.exec(line);
    if (lm) {
      flush();
      buf.push(lm[1]);
      continue;
    }

    buf.push(line.replace(/^ {0,3}>[ \t]?/, ''));
  }
  flush();

  return title === undefined ? { headings, paragraphs } : { title, headings, paragraphs };
}

export function markdownToSource(md: string, source: string = 'Markdown text'): ExtractedSource {
  const parsed = parseMarkdown(md);
  let title = parsed.title ?? parsed.headings[0];
  if (title === undefined || title === '') {
    const words = (parsed.paragraphs[0] ?? '').split(/\s+/).filter((w) => w !== '');
    title = words.length > 0 ? words.slice(0, 6).join(' ') : 'Untitled Markdown';
  }
  return {
    title,
    headings: parsed.headings,
    paragraphs: parsed.paragraphs,
    metadata: { kind: 'markdown', source },
  };
}

/**
 * Offline study outline for a topic. Used only when no encyclopedia text could be fetched
 * (offline, no match, or the lookup service is down). It says so plainly, so it does not
 * read as a broken article.
 */
export function topicToSource(topic: string, language: WikiLanguage = DEFAULT_LANGUAGE): ExtractedSource {
  const t = String(topic ?? '').replace(/\s+/g, ' ').trim() || 'this topic';
  // The outline is written in the disc's language, so a French burn falls back to a French outline.
  const text = OUTLINE_TEXT[toWikiLanguage(language)](t);
  return {
    title: t,
    headings: text.headings,
    paragraphs: text.paragraphs,
    metadata: { kind: 'topic', source: text.label },
  };
}
