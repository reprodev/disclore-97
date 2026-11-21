import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from './manifest';
import type { Dungeon, TriviaQuestion } from './manifest';
import { createQueue, drawQuestion } from './questionQueue';
import type { QuestionQueue } from './questionQueue';

export type GameState = {
  roomId: string;
  moves: number;
  incorrect: number;
  pending: { exitTo: string; question: TriviaQuestion } | null;
  lastWrong: { section_id: string } | null;
  won: boolean;
  queue: QuestionQueue;
};

export type GameAction =
  | { type: 'selectExit'; to: string }
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
  };
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
      return { ...s, queue, pending: { exitTo: a.to, question }, lastWrong: null };
    }
    case 'answer': {
      if (s.pending === null) return s;
      const { exitTo, question } = s.pending;
      if (a.index === question.correct_index) {
        return {
          ...s,
          roomId: exitTo,
          moves: s.moves + 1,
          pending: null,
          lastWrong: null,
          won: exitTo === THRONE_ROOM_ID,
        };
      }
      return {
        ...s,
        incorrect: s.incorrect + 1,
        pending: null,
        lastWrong: { section_id: question.section_id },
      };
    }
    case 'restart':
      return initGame(d, qs, rng);
  }
}
