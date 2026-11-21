import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { gameReducer, initGame } from '../../src/model/game';
import type { GameState } from '../../src/model/game';
import type { TriviaQuestion } from '../../src/model/manifest';
import { arbDungeon } from '../generators';

const arbQuestion: fc.Arbitrary<TriviaQuestion> = fc
  .record({
    options: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 2, maxLength: 5 }),
    correctPick: fc.nat(),
    sectionId: fc.string({ minLength: 1, maxLength: 8 }),
  })
  .map(({ options, correctPick, sectionId }) => ({
    question_id: 'q',
    prompt: 'prompt',
    options,
    correct_index: correctPick % options.length,
    section_id: sectionId,
  }));

describe('Property 13: Incorrect answer keeps the player in place', () => {
  // Feature: disclore-97-core, Property 13: Incorrect answer keeps the player in place
  // **Validates: Requirements 12.4**
  it('keeps roomId and moves, increments incorrect, records cited section_id', () => {
    fc.assert(
      fc.property(
        arbDungeon,
        arbQuestion,
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: -5, max: 10 }),
        (dungeon, question, roomPick, exitPick, moves, incorrect, rawIndex) => {
          const rng = () => 0.5;
          const base = initGame(dungeon, [question], rng);
          const current = dungeon.rooms[roomPick % dungeon.rooms.length];
          const exitTo = dungeon.rooms[exitPick % dungeon.rooms.length].room_id;
          const state: GameState = {
            ...base,
            roomId: current.room_id,
            moves,
            incorrect,
            pending: { exitTo, question },
          };
          // Any index that is not the correct one (including out of range).
          const wrong = rawIndex === question.correct_index ? rawIndex + 1 : rawIndex;

          const next = gameReducer(state, { type: 'answer', index: wrong }, dungeon, [question], rng);

          expect(next.roomId).toBe(state.roomId);
          expect(next.moves).toBe(state.moves);
          expect(next.incorrect).toBe(state.incorrect + 1);
          expect(next.lastWrong?.section_id).toBe(question.section_id);
        },
      ),
      { numRuns: 100 },
    );
  });
});
