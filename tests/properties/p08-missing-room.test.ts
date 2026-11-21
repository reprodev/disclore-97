import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, removeReservedRoom } from '../generators';

describe('Property 8: Missing entrance or throne room is rejected', () => {
  // Feature: disclore-97-core, Property 8: Missing entrance or throne room is rejected
  // **Validates: Requirements 5.8**
  it('removing entrance or throne_room from a dungeon yields a missing-room error', () => {
    fc.assert(
      fc.property(arbManifest, fc.constantFrom('entrance', 'throne_room' as const), fc.nat(), (m, which, pick) => {
        const mut = removeReservedRoom(m, which as 'entrance' | 'throne_room', pick);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(
            result.errors.some(
              (e) =>
                e.code === 'missing-room' &&
                e.path.startsWith(`$.dungeons[${mut.dungeonIndex}]`) &&
                e.message.includes(which),
            ),
          ).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
