// Fallback adapter: Markdown text and bare topics to ExtractedSource. Pure, no I/O.

import { stripMarkdownInline } from '../model/compile/text';
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

export function topicToSource(topic: string): ExtractedSource {
  const t = String(topic ?? '').replace(/\s+/g, ' ').trim() || 'this topic';
  return {
    title: t,
    headings: [
      `What is ${t}?`,
      `Key terms in ${t}`,
      `How ${t} is used`,
      `Questions to explore about ${t}`,
      `Where to learn more about ${t}`,
      `Putting ${t} into practice`,
    ],
    paragraphs: [
      `Use this page to write down what you already know about ${t}.`,
      `List the words and names you expect to meet while studying ${t}, then look each one up.`,
      `Think of one place where you have seen ${t} and note what you would like to understand better.`,
      `Write three questions about ${t} that you want answered before you finish studying.`,
      `Pick a library, a teacher, or a trusted website and plan when you will read about ${t}.`,
      `Choose a small exercise that lets you try ${t} yourself, and note what you learn from it.`,
    ],
    metadata: { kind: 'topic', source: `Topic: ${t}` },
  };
}
