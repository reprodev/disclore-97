import type { Section, TriviaQuestion } from '../manifest';
import { createIdAllocator, type IdAllocator } from './ids';
import { truncate } from './text';

const PROMPT_MAX = 200;
const OPTION_MAX = 120;
const SNIPPET_MAX = 100;
const MIN_SENTENCE = 20;

/** Fixed pool of original false statements used to fill out an option list. */
export const GENERIC_DISTRACTORS: readonly string[] = [
  'It is a recipe for baking bread.',
  'It lists the rules of a chess opening.',
  'It describes how to knit a woolen scarf.',
  'It is a timetable for a night train.',
  'It explains how to repot a cactus.',
  'It is a forecast for tomorrow\u2019s weather.',
  'It gives directions to a lighthouse on the coast.',
  'It is a shopping list for a picnic.',
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sectionSentences(section: Section): string[] {
  return section.paragraphs.flatMap(sentences);
}

function pickCorrectSentence(section: Section): string {
  const first = section.paragraphs.slice(0, 3).flatMap(sentences);
  let best = '';
  for (const s of first) {
    if (s.length >= MIN_SENTENCE && s.length > best.length) best = s;
  }
  if (!best) best = section.paragraphs[0] ?? section.title;
  const out = truncate(best.trim(), OPTION_MAX);
  return out || truncate(section.title, OPTION_MAX) || 'Untitled';
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds `min(max(N, 5), 10)` questions. Question `q` cites `sections[q % N]`.
 * Every question has `count = 3 + seed % 2` distinct options, and the correct
 * option sits at `(offset + q) % count`.
 */
export function buildTrivia(
  sections: readonly Section[],
  seed: number,
  rand: () => number,
  ids: IdAllocator = createIdAllocator(),
): TriviaQuestion[] {
  const n = sections.length;
  if (n === 0) return [];
  const s32 = seed >>> 0;
  const total = Math.min(Math.max(n, 5), 10);
  const count = 3 + (s32 % 2);
  const offset = (s32 >>> 3) % count;
  const questions: TriviaQuestion[] = [];

  for (let q = 0; q < total; q++) {
    const cited = sections[q % n];
    const statementForm = q % 2 === 0;
    let prompt: string;
    let correct: string;
    let candidates: string[];
    const banned = new Set<string>();

    if (statementForm) {
      prompt = `Which statement appears in the article "${truncate(cited.title, 80)}"?`;
      correct = pickCorrectSentence(cited);
      for (const s of sectionSentences(cited)) {
        banned.add(norm(s));
        banned.add(norm(truncate(s, OPTION_MAX)));
      }
      candidates = [];
      for (let i = 0; i < n; i++) {
        if (i === q % n) continue;
        for (const s of sectionSentences(sections[i])) candidates.push(truncate(s, OPTION_MAX));
      }
    } else {
      const first = cited.paragraphs[0] ?? cited.title;
      const snippet = truncate(first.trim(), SNIPPET_MAX) || truncate(cited.title, SNIPPET_MAX);
      prompt = `Which article contains this passage: "${snippet}"?`;
      correct = truncate(cited.title, OPTION_MAX) || 'Untitled';
      candidates = [];
      for (let i = 0; i < n; i++) {
        if (i === q % n) continue;
        candidates.push(truncate(sections[i].title, OPTION_MAX));
      }
    }
    prompt = truncate(prompt, PROMPT_MAX);

    const chosen = new Set<string>([norm(correct)]);
    const distractors: string[] = [];
    const want = count - 1;
    const tryAdd = (text: string, checkBanned: boolean): void => {
      if (distractors.length >= want) return;
      const t = text.trim();
      const key = norm(t);
      if (!t || chosen.has(key) || (checkBanned && banned.has(key))) return;
      chosen.add(key);
      distractors.push(t);
    };

    for (const c of shuffle(candidates, rand)) tryAdd(c, true);
    if (distractors.length < want) {
      const start = Math.floor(rand() * GENERIC_DISTRACTORS.length);
      for (let k = 0; k < GENERIC_DISTRACTORS.length; k++) {
        tryAdd(GENERIC_DISTRACTORS[(start + k) % GENERIC_DISTRACTORS.length], false);
      }
    }

    const options = shuffle(distractors, rand);
    const correctIndex = (offset + q) % count;
    options.splice(correctIndex, 0, correct);

    questions.push({
      question_id: ids.trivia(),
      prompt,
      options,
      correct_index: correctIndex,
      section_id: cited.section_id,
    });
  }
  return questions;
}
