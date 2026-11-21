# Implementation Plan: DiscLore '97 Core

## Overview

The implementation language is TypeScript (React, Vite, Vitest, fast-check), as set in the design. Work proceeds from the pure logic layer (types, solver, validator, game reducer), through the audio module, to the pre-baked discs, the Win95 components, the viewers, and finally the App wiring. Each step is integrated by the next, and the App shell wires everything together last. Visual rules from `.kiro/steering/disclore-97-design-system.md` apply to all styling: hex values only in `tokens.css`, square corners, flat fills, no blurred shadows or gradients.

Property tests live under `tests/properties/` with one file per property, and each carries the comment `Feature: disclore-97-core, Property N: <text>` and runs at least 100 cases.

## Tasks

- [x] 1. Set up repository hygiene, project scaffolding, and design tokens
  - [x] 1.1 Create repo files and project scaffolding
    - Add `LICENSE` (MIT), `.gitignore` (`node_modules`, `dist`, `.env`, `.env.*`, `.wrangler`), `package.json` with scripts `build` (`tsc --noEmit && vite build`) and `test` (`vitest --run`), `tsconfig.json` with `"strict": true`, `vite.config.ts` (jsdom test environment), `index.html`, and `src/main.tsx` placeholder
    - Runtime dependencies are only `react` and `react-dom`. Dev dependencies are build, type, lint, and test tooling: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `fast-check`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@types/react`, `@types/react-dom`, `eslint`
    - Add an ESLint rule `no-restricted-globals` for `AudioContext`, `webkitAudioContext`, `OscillatorNode` that applies outside `src/audio`
    - Create the empty directory layout from the design (`src/model`, `src/discs`, `src/audio`, `src/components`, `src/styles`, `tests`, `tests/properties`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 13.6_

  - [x] 1.2 Create design tokens and base Win95 styles
    - Write `src/styles/tokens.css` with the color, font, and bevel variables from the design, plus `* { border-radius: 0; }`. This is the only file containing hex literals
    - Write `src/styles/win95.css` with shared outset and inset bevel classes composed from the variables, and import both from `src/main.tsx`
    - Use no blurred `box-shadow`, `backdrop-filter`, or gradients
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.3 Write static repository scan tests
    - Create `tests/static.test.ts` that checks: `LICENSE` has MIT text, `.gitignore` entries, no `.env` or `.mp3`/`.wav`/`.ogg` files, hex literals only in `tokens.css` with token values matching Requirement 3.1, no nonzero border-radius, blurred box-shadow, `backdrop-filter`, or gradients in stylesheets, `AudioContext` and `createOscillator` only under `src/audio`, runtime dependencies equal `react` and `react-dom`, and `tsconfig.json` has `"strict": true`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.3, 2.4, 3.1, 3.4, 3.5, 3.6, 13.2, 13.6_

- [x] 2. Implement the DiscManifest types and the KeepMaze solver
  - [x] 2.1 Define manifest types in `src/model/manifest.ts`
    - Export `DiscManifest`, `Section`, `Shape`, `Hotspot`, `Diagram`, `TriviaQuestion`, `Exit`, `Room`, `Dungeon`, `ValidationError`, `ErrorCode`, and `ValidationResult` exactly as in the design
    - Document the reserved room ids `entrance` and `throne_room`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 2.2 Implement `solveDungeon` in `src/model/solver.ts`
    - BFS from `entrance` over directed exits with a visited set and parent map, returning `{ reachable, path, orphans }`
    - Ignore exits to unknown rooms. Return an empty path when the throne room is unreachable, and treat all rooms as orphans when `entrance` is absent
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_

  - [x] 2.3 Write property test for reachable set and orphan partition
    - Create `tests/properties/p10-partition.test.ts` and an independent iterative DFS reference. Include an `arbDungeon` generator inline or import it once available from `tests/generators.ts`
    - **Property 10: Reachable set and orphans partition the rooms**
    - **Validates: Requirements 7.1, 7.4, 8.6**

  - [x] 2.4 Write property test for shortest path validity and minimality
    - Create `tests/properties/p11-shortest-path.test.ts` with a Bellman-Ford style reference distance
    - **Property 11: Shortest path is valid and minimal**
    - **Validates: Requirements 7.2, 7.3, 7.5, 7.7, 8.5, 8.7**

  - [x] 2.5 Write solver performance and edge-case unit tests
    - Create `tests/solver.test.ts`: a 500-room dungeon solves in under 100 ms, a cycle terminates, a missing entrance gives all rooms as orphans, and directed edges are respected
    - _Requirements: 7.5, 7.6, 7.7_

- [x] 3. Implement the manifest validator
  - [x] 3.1 Create shared fast-check generators in `tests/generators.ts`
    - `arbDungeon` with random directed exits, cycles, self-loops, exits to unknown rooms, and sometimes missing `entrance` or `throne_room`
    - `arbManifest` that builds a valid manifest by construction (references drawn from generated ids, coordinates in range, a solvable dungeon with no orphans, JSON-safe values)
    - Mutation helpers that apply one defect to a valid manifest (delete or retype a field, duplicate an id, set a coordinate, repoint a reference, change `correct_index`, remove a reserved room, cut paths, add orphans)
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [x] 3.2 Implement `validateManifest` in `src/model/validate.ts`
    - Pass 1: shape and type checks that collect `missing-field` and `wrong-type` errors with field paths and stop descending into mistyped nodes. A non-object input returns one error at path `$`
    - Pass 2 on well-typed data: duplicate ids per scope, hotspot coordinates (`Number.isFinite` and `0..100`), hotspot and trivia `section_id` references, `correct_index` range, `entrance` and `throne_room` presence, exit destinations, then `unsolvable-dungeon` and `orphan-room` errors using `solveDungeon` (the orphan error lists every orphan id)
    - Collect all errors, never throw, and return the original manifest on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [x] 3.3 Write property test for validator result shape
    - Create `tests/properties/p01-result-shape.test.ts` using `fc.anything()` and mutated manifests
    - **Property 1: Validator result shape**
    - **Validates: Requirements 5.1**

  - [x] 3.4 Write property test for JSON round trip
    - Create `tests/properties/p02-round-trip.test.ts`
    - **Property 2: Manifest JSON round trip**
    - **Validates: Requirements 5.13, 8.10**

  - [x] 3.5 Write property test for missing or mistyped fields
    - Create `tests/properties/p03-missing-fields.test.ts`
    - **Property 3: Missing or mistyped fields are reported by path**
    - **Validates: Requirements 5.2**

  - [x] 3.6 Write property test for duplicate identifiers
    - Create `tests/properties/p04-duplicate-ids.test.ts`
    - **Property 4: Duplicate identifiers are rejected**
    - **Validates: Requirements 5.3**

  - [x] 3.7 Write property test for hotspot coordinate range
    - Create `tests/properties/p05-coordinates.test.ts`
    - **Property 5: Out-of-range hotspot coordinates are rejected**
    - **Validates: Requirements 5.4, 8.8**

  - [x] 3.8 Write property test for dangling references
    - Create `tests/properties/p06-dangling.test.ts`
    - **Property 6: Dangling references are rejected**
    - **Validates: Requirements 5.5, 5.6, 5.9, 8.9**

  - [x] 3.9 Write property test for answer index range
    - Create `tests/properties/p07-index-range.test.ts`
    - **Property 7: Answer index out of range is rejected**
    - **Validates: Requirements 5.7**

  - [x] 3.10 Write property test for missing entrance or throne room
    - Create `tests/properties/p08-missing-room.test.ts`
    - **Property 8: Missing entrance or throne room is rejected**
    - **Validates: Requirements 5.8**

  - [x] 3.11 Write property test for unsolvable and orphaned dungeons
    - Create `tests/properties/p09-unsolvable-orphans.test.ts`
    - **Property 9: Unsolvable and orphaned dungeons are reported**
    - **Validates: Requirements 5.10, 5.11**

- [x] 4. Implement the procedural audio module
  - [x] 4.1 Implement `src/audio/audio.ts`
    - Export `playSpinUp`, `playClick`, `playPageFlip`, `playTorch`, `playDoorUnlock`, `setMuted`, `isMuted`, `toggleMuted`, `subscribeMuted`, and `__setContextFactory`
    - Create the `AudioContext` lazily on the first play call, resume it when suspended, catch constructor and `resume()` errors, and return silently when the API is unavailable
    - Route all effects through one master `GainNode` and track active oscillators. On mute, return before touching the context for new requests, and for playing effects set master gain to 0 and stop active nodes immediately
    - Synthesize the five effects from oscillators and noise bursts with no audio files and no network requests
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9, 13.10_

  - [x] 4.2 Write property test for muted audio silence
    - Create `tests/properties/p16-muted-silent.test.ts` using a mock `AudioContext` through `__setContextFactory` and random sequences of the five effects
    - **Property 16: Muted audio is silent**
    - **Validates: Requirements 8.11, 13.7**

  - [x] 4.3 Write audio unit tests
    - Create `tests/audio.test.ts`: lazy context creation, resume when suspended, silent no-op when `AudioContext` is missing, master gain 0 and nodes stopped when muting during playback, mute state flip and subscriber notification, and one exported function per effect
    - _Requirements: 13.3, 13.4, 13.5, 13.8, 13.9, 13.10_

- [x] 5. Implement the KeepMaze game logic
  - [x] 5.1 Implement the question queue in `src/model/questionQueue.ts`
    - Shuffled bag with an injected `rng`: draw without replacement and reshuffle only when empty
    - _Requirements: 12.7_

  - [x] 5.2 Implement the game reducer in `src/model/game.ts`
    - Export `GameState`, `GameAction`, `initGame`, and `gameReducer` with `selectExit`, `answer`, and `restart` actions
    - `selectExit` draws a question and sets `pending` (ignoring destinations not in the dungeon). A correct answer moves the player, increments `moves`, and sets `won` at `throne_room`. An incorrect answer increments `incorrect`, keeps the room, and sets `lastWrong` to the cited `section_id`. `restart` returns `initGame`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 5.3 Write property test for question queue
    - Create `tests/properties/p15-no-repeat.test.ts`
    - **Property 15: Questions do not repeat until all are used**
    - **Validates: Requirements 12.7**

  - [x] 5.4 Write property test for correct answers
    - Create `tests/properties/p12-correct-answer.test.ts`
    - **Property 12: Correct answer moves the player**
    - **Validates: Requirements 12.3, 12.5**

  - [x] 5.5 Write property test for incorrect answers
    - Create `tests/properties/p13-incorrect-answer.test.ts`
    - **Property 13: Incorrect answer keeps the player in place**
    - **Validates: Requirements 12.4**

  - [x] 5.6 Write property test for restart
    - Create `tests/properties/p14-restart.test.ts`
    - **Property 14: Restart resets the game**
    - **Validates: Requirements 12.6**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Create the pre-baked discs
  - [ ] 7.1 Write the "Ancient Castles & Keeps" disc in `src/discs/castles.ts`
    - Title "DiscLore '97: Ancient Castles & Keeps" as a typed `DiscManifest`
    - At least 5 original sections, 1 original SVG diagram (shapes using `currentColor`, `none`, or `var(--...)`, never hex literals) with at least 3 in-range hotspots referencing real sections, at least 5 trivia questions citing real sections, and a dungeon of at least 8 rooms with castle-themed descriptions, solvable from `entrance` to `throne_room` with no orphan rooms
    - Use original text and artwork only
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_

  - [ ] 7.2 Write the "Retro Computing & Dial-Up Era" disc in `src/discs/retro.ts`
    - Title "DiscLore '97: Retro Computing & Dial-Up Era" with the same minimums and rules as 7.1, with dungeon descriptions themed on retro computing
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 7.3 Create the disc index and loader
    - `src/discs/index.ts` exports the pre-baked disc list
    - Add `loadDisc(source: unknown, prebaked: boolean)` in `src/discs/loader.ts` that passes non-pre-baked manifests through `validateManifest` and returns either the disc or the error list
    - _Requirements: 5.12, 6.1, 6.2_

  - [ ]* 7.4 Write pre-baked disc invariant tests
    - Create `tests/discs.test.ts`: for each disc, `validateManifest` returns zero errors, every hotspot is in `0..100` and references an existing section, every trivia question cites an existing section, every dungeon has a BFS path from `entrance` to `throne_room` and zero orphans, content minimums hold, and `loadDisc` rejects an invalid non-pre-baked manifest with errors
    - _Requirements: 5.12, 6.3, 6.4, 8.1, 8.2, 8.3_

- [ ] 8. Build the Win95 component set
  - [ ] 8.1 Implement Window, TitleBar, and BevelButton
    - `src/components/Window.tsx` (`role="dialog"`, `aria-labelledby`, optional MenuBar slot, outset bevel content area), `TitleBar.tsx` (navy bar, white title text, close button with `aria-label="Close"` that calls `onClose`), and `BevelButton.tsx` (native `<button>`, outset when resting, inset when pressed, calls `playClick()` then `onClick`, ignores activation and uses the shadow color when disabled)
    - Put component styles in `src/styles/window.css` and `src/styles/button.css`, using only token variables
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.13_

  - [ ] 8.2 Implement MenuBar
    - `src/components/MenuBar.tsx` with `role="menubar"`, `menu`, and `menuitem`, the sans-serif token, arrow-key navigation, Enter and Space activation, item callback then close, and Escape to close. Styles in `src/styles/menubar.css`
    - _Requirements: 9.8, 9.9, 9.10, 9.13_

  - [ ] 8.3 Implement Tooltip
    - `src/components/Tooltip.tsx` showing on `pointerenter` and `focus`, hiding on `pointerleave` and `blur`, with `aria-describedby`, tooltip fill, and a 1px solid outer-edge border. Styles in `src/styles/tooltip.css`
    - _Requirements: 9.11, 9.12, 9.13_

  - [ ]* 8.4 Write Win95 component tests
    - Create `tests/components/win95.test.tsx`: Window close callback, BevelButton pressed and disabled behavior and click sound request (mocked audio module), MenuBar item selection and Escape, Tooltip show and hide on pointer and focus, roles, names, and keyboard operation
    - _Requirements: 9.3, 9.5, 9.6, 9.7, 9.9, 9.10, 9.11, 9.12, 9.13_

- [ ] 9. Build the viewers and game UI
  - [ ] 9.1 Implement DiscBrowser and ArticleViewer
    - `DiscBrowser.tsx` lists discs by title and tagline. Opening a disc calls `playSpinUp()` and shows a `Window` with entries for sections, diagrams, a Trivia group, and dungeons
    - `ArticleViewer.tsx` renders the section title and paragraphs in the serif token, calls `playPageFlip()` on selection, resets `scrollTop` to 0 via a ref when `section_id` changes, and shows a not-found message for unknown ids while the previous navigation state is kept
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 9.2 Implement HotspotViewer
    - `HotspotViewer.tsx` renders shapes in `<svg viewBox="0 0 100 100">` and each hotspot as a focusable `<g role="button" tabindex="0" aria-label={label}>` at `(x, y)` wrapped in Tooltip. Click or Enter calls the navigation callback with the hotspot `section_id` and `playPageFlip()`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 9.3 Implement KeepMazeUI
    - `KeepMazeUI.tsx` using `gameReducer` and the question queue. HUD in the sans-serif token with room name, description, exits, moves, and incorrect count. Show the pending question, call `playTorch()` on room entry and `playDoorUnlock()` on a correct answer. On a wrong answer show the cited section title and a link that opens it in the Article_Viewer. Show the victory message with moves and incorrect count, and a restart control. Disable Start with a message when the disc has no trivia questions
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 9.4 Implement MuteToggle and ErrorList
    - `MuteToggle.tsx`: a BevelButton with `aria-pressed` bound to `subscribeMuted`/`toggleMuted`, showing the current state
    - `ErrorList.tsx`: renders `path: message` for each `ValidationError`
    - _Requirements: 5.12, 13.8_

  - [ ]* 9.5 Write viewer and game UI component tests
    - Create `tests/components/viewers.test.tsx`: DiscBrowser listing and spin-up request, ArticleViewer scroll reset and not-found message, HotspotViewer tooltip and navigation, KeepMazeUI flow (correct answer, wrong answer with section link, victory counts, restart), MuteToggle state display, ErrorList output
    - _Requirements: 5.12, 10.1, 10.2, 10.4, 10.5, 10.6, 11.3, 11.4, 12.1, 12.3, 12.4, 12.5, 12.6, 13.8_

- [ ] 10. Wire the App together
  - [ ] 10.1 Implement `App.tsx` and `main.tsx`
    - `App` holds `{ discId, view }` with views `section`, `diagram`, and `keepmaze`, and a `selectSection` that leaves the state unchanged and reports not-found for unknown ids
    - Render DiscBrowser, the Window with ArticleViewer, HotspotViewer, or KeepMazeUI, and MuteToggle in the shell so it shows on every screen. Pass hotspot and wrong-answer section links to section navigation. Load pre-baked discs through `loadDisc` and show `ErrorList` in place of any disc that fails validation
    - _Requirements: 5.12, 10.2, 10.3, 10.4, 10.6, 11.4, 12.4, 13.8_

  - [ ]* 10.2 Write App integration tests
    - Create `tests/components/app.test.tsx`: open a disc, read a section, follow a hotspot, play a KeepMaze round to victory, toggle mute and confirm no audio nodes on a mock context, and render ErrorList for an invalid injected manifest
    - _Requirements: 5.12, 10.2, 10.4, 11.4, 12.5, 13.7, 13.8_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design, one test file per property
- Unit and component tests validate specific examples and edge cases
- Run `npm run build` once after task 10.1 to confirm `dist` is produced (Requirement 2.1)
- Originality of disc content (Requirements 6.5, 6.6) is checked by review

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "3.1", "4.1", "5.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "3.2", "4.2", "4.3", "5.2", "5.3"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "5.4", "5.5", "5.6"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7.1", "7.2", "8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["7.3", "8.4", "9.2", "9.3", "9.4"] },
    { "id": 8, "tasks": ["7.4", "9.1"] },
    { "id": 9, "tasks": ["9.5", "10.1"] },
    { "id": 10, "tasks": ["10.2"] },
    { "id": 11, "tasks": ["11"] }
  ]
}
```
