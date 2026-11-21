import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { gameReducer, initGame } from '../../src/model/game';
import type { GameAction } from '../../src/model/game';
import { ENTRANCE_ROOM_ID } from '../../src/model/manifest';
import type { TriviaQuestion } from '../../src/model/manifest';
import { arbDungeon } from '../generators';

const arbQuestions: fc.Arbitrary<TriviaQuestion[]> = fc
  .array(fc.record({ n: fc.integer({ min: 2, max: 4 }), c: fc.nat() }), { minLength: 1, maxLength: 6 })
  .map((specs) =>
    specs.map(({ n, c }, i) => ({
      question_id: `q${i}`,
      prompt: `Question ${i}`,
      options: Array.from({ length: n }, (_, k) => `opt${k}`),
      correct_index: c % n,
      section_id: `section_${i}`,
    })),
  );

// Raw action picks: resolved against the dungeon's rooms and the pending question.
const arbPick = fc.oneof(
  fc.record({ kind: fc.constant('exit' as const), pick: fc.nat() }),
  fc.record({ kind: fc.constant('answer' as const), pick: fc.nat() }),
);

describe('Property 14', () => {
  // Feature: disclore-97-core, Property 14: Restart resets the game
  // **Validates: Requirements 12.6**
  it('restart yields entrance, 0 moves, 0 incorrect, no pending question', () => {
    fc.assert(
      fc.property(
        arbDungeon,
        arbQuestions,
        fc.array(arbPick, { maxLength: 40 }),
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        (dungeon, qs, picks, seed) => {
          let state = seed;
          const rng = () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 2 ** 32;
          };
          let g = initGame(dungeon, qs, rng);
          for (const p of picks) {
            let action: GameAction;
            if (p.kind === 'exit') {
              action = { type: 'selectExit', to: dungeon.rooms[p.pick % dungeon.rooms.length].room_id };
            } else {
              const n = g.pending ? g.pending.question.options.length : 2;
              // Mix correct and incorrect answers.
              action = { type: 'answer', index: p.pick % (n + 1) };
            }
            g = gameReducer(g, action, dungeon, qs, rng);
          }
          const r = gameReducer(g, { type: 'restart' }, dungeon, qs, rng);
          expect(r.roomId).toBe(ENTRANCE_ROOM_ID);
          expect(r.moves).toBe(0);
          expect(r.incorrect).toBe(0);
          expect(r.pending).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
