import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { gameReducer, initGame } from '../../src/model/game';
import type { GameState } from '../../src/model/game';
import { THRONE_ROOM_ID } from '../../src/model/manifest';
import type { TriviaQuestion } from '../../src/model/manifest';
import { arbDungeon } from '../generators';

const arbQuestion: fc.Arbitrary<TriviaQuestion> = fc
  .record({
    options: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 2, maxLength: 5 }),
    pick: fc.nat(),
    section_id: fc.string({ minLength: 1, maxLength: 8 }),
  })
  .map(({ options, pick, section_id }) => ({
    question_id: 'q',
    prompt: 'p',
    options,
    correct_index: pick % options.length,
    section_id,
  }));

describe('Property 12', () => {
  // Feature: disclore-97-core, Property 12: Correct answer moves the player
  // **Validates: Requirements 12.3, 12.5**
  it('a correct answer moves the player to the exit destination', () => {
    fc.assert(
      fc.property(
        arbDungeon,
        arbQuestion,
        fc.nat(),
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (d, question, destPick, moves, incorrect) => {
          const rng = () => 0.5;
          // Pending exit destination: any room in the dungeon (including throne_room when present).
          const exitTo = d.rooms[destPick % d.rooms.length].room_id;
          const base = initGame(d, [question], rng);
          const state: GameState = {
            ...base,
            moves,
            incorrect,
            pending: { exitTo, question },
          };

          const next = gameReducer(state, { type: 'answer', index: question.correct_index }, d, [question], rng);

          expect(next.roomId).toBe(exitTo);
          expect(next.moves).toBe(moves + 1);
          expect(next.incorrect).toBe(incorrect);
          expect(next.pending).toBeNull();
          expect(next.won).toBe(exitTo === THRONE_ROOM_ID);
        },
      ),
      { numRuns: 200 },
    );
  });
});
