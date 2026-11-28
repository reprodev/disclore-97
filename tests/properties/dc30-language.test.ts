import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { castlesDisc } from '../../src/discs/castles';
import { loadDisc } from '../../src/discs/loader';
import { WIKI_LANGUAGES } from '../../src/model/languages';
import { validateManifest } from '../../src/model/validate';

// Property: DiscManifest.language is optional, accepts every allowlisted code, survives a JSON
// round trip, and is rejected (at $.language) for any other value.
describe('Property 30: DiscManifest.language', () => {
  it('round-trips every allowlisted language through JSON and loadDisc', () => {
    fc.assert(
      fc.property(fc.constantFrom(...WIKI_LANGUAGES), (language) => {
        const disc = { ...castlesDisc, language };
        const again = JSON.parse(JSON.stringify(disc)) as unknown;
        const r = loadDisc(again, false);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.manifest.language).toBe(language);
      }),
      { numRuns: 50 },
    );
  });

  it('a disc with no language is still valid, and reads as before', () => {
    expect(validateManifest(castlesDisc).ok).toBe(true);
    expect('language' in castlesDisc).toBe(false);
  });

  it('rejects any other value at $.language', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().filter((s) => !(WIKI_LANGUAGES as readonly string[]).includes(s)),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.array(fc.string()),
          fc.object(),
        ),
        (language) => {
          const r = validateManifest({ ...castlesDisc, language });
          expect(r.ok).toBe(false);
          if (!r.ok) expect(r.errors.every((e) => e.path === '$.language')).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });
});
