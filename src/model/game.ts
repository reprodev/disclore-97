import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from './manifest';
import type { Dungeon, TriviaQuestion } from './manifest';
import { createQueue, drawQuestion } from './questionQueue';
import type { QuestionQueue } from './questionQueue';

/** Torches a new game starts with. A wrong answer dims one, but never below zero. */
export const STARTING_TORCHES = 3;
/** Points for a correct answer, before any streak bonus. */
export const POINTS_CORRECT = 100;
/** Points for a correct answer after Peek Hint was used. There is no streak bonus then. */
export const POINTS_HINTED = 50;
/** Extra points per correct answer already in a row, up to STREAK_BONUS_CAP answers. */
export const STREAK_BONUS_STEP = 10;
export const STREAK_BONUS_CAP = 5;

export type GameState = {
  roomId: string;
  moves: number;
  incorrect: number;
  pending: { exitTo: string; question: TriviaQuestion; hinted?: boolean } | null;
  lastWrong: { section_id: string } | null;
  won: boolean;
  queue: QuestionQueue;
  /** Knowledge Score. Only ever goes up. */
  score: number;
  /** Correct answers in a row. A wrong answer resets it. */
  streak: number;
  bestStreak: number;
  /** Lit torches left. Purely a display of mistakes: it never blocks a move. */
  torches: number;
};

export type GameAction =
  | { type: 'selectExit'; to: string }
  | { type: 'peek' }
  | { type: 'answer'; index: number }
  | { type: 'restart' };

export function initGame(_d: Dungeon, qs: TriviaQuestion[], rng: () => number): GameState {
  return {
    roomId: ENTRANCE_ROOM_ID,
    moves: 0,
    incorrect: 0,
    pending: null,
    lastWrong: null,
    won: false,
    queue: createQueue(qs.length, rng),
    score: 0,
    streak: 0,
    bestStreak: 0,
    torches: STARTING_TORCHES,
  };
}

/** Points a correct answer earns, given the streak before it and whether the hint was used. */
export function pointsFor(streakBefore: number, hinted: boolean): number {
  return hinted ? POINTS_HINTED : POINTS_CORRECT + STREAK_BONUS_STEP * Math.min(streakBefore, STREAK_BONUS_CAP);
}

/** The best score possible after `moves` moves: every answer right, no hints. */
export function maxScore(moves: number): number {
  let total = 0;
  for (let i = 0; i < moves; i++) total += pointsFor(i, false);
  return total;
}

/** Scholar Rank: how much of the best possible score was earned. */
export function scholarRank(score: number, moves: number): string {
  const best = maxScore(moves);
  const ratio = best > 0 ? score / best : 0;
  if (ratio >= 0.95) return 'Royal Archivist';
  if (ratio >= 0.75) return 'Court Scholar';
  if (ratio >= 0.5) return 'Keep Explorer';
  return 'Torchbearer';
}

export function gameReducer(
  s: GameState,
  a: GameAction,
  d: Dungeon,
  qs: TriviaQuestion[],
  rng: () => number,
): GameState {
  switch (a.type) {
    case 'selectExit': {
      if (s.won || s.pending !== null || qs.length === 0) return s;
      if (!d.rooms.some((r) => r.room_id === a.to)) return s;
      const { index, queue } = drawQuestion(s.queue, qs.length, rng);
      const question = qs[index];
      if (!question) return s;
      return { ...s, queue, pending: { exitTo: a.to, question, hinted: false }, lastWrong: null };
    }
    case 'peek': {
      if (s.pending === null || s.pending.hinted === true) return s;
      return { ...s, pending: { ...s.pending, hinted: true } };
    }
    case 'answer': {
      if (s.pending === null) return s;
      const { exitTo, question } = s.pending;
      const hinted = s.pending.hinted === true;
      if (a.index === question.correct_index) {
        const streak = s.streak + 1;
        return {
          ...s,
          roomId: exitTo,
          moves: s.moves + 1,
          pending: null,
          lastWrong: null,
          won: exitTo === THRONE_ROOM_ID,
          score: s.score + pointsFor(s.streak, hinted),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
        };
      }
      return {
        ...s,
        incorrect: s.incorrect + 1,
        pending: null,
        lastWrong: { section_id: question.section_id },
        streak: 0,
        torches: Math.max(0, s.torches - 1),
      };
    }
    case 'restart':
      return initGame(d, qs, rng);
  }
}
