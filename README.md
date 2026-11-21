# DiscLore '97

A fictional 1997 Windows 95 CD-ROM encyclopedia, rebuilt as a static web app. Browse the disc, click around illustrated scenes, and try to survive a trivia dungeon.

## Features

- **Win95-style CD-ROM encyclopedia.** Windows 95 chrome, article browsing, and original disc content.
- **Clickable SVG hotspots.** Each scene is an SVG on a 0..100 coordinate grid. Hotspots are defined in those coordinates, so they scale with the image.
- **Procedural WebAudio.** All sound is generated at runtime, with no audio files. A global **Mute** control silences everything.
- **KeepMaze.** A trivia dungeon. Maze layouts are verified with breadth-first search (BFS) so the exit is always reachable.

## How it was built

The project was built with [Kiro](https://kiro.dev) using Spec-Driven Development. Each step feeds the next:

1. `.kiro/steering`: project-wide guidance and conventions.
2. `requirements.md`: user stories and acceptance criteria.
3. `design.md`: architecture and the correctness properties to test.
4. `tasks.md`: an ordered, dependency-aware implementation plan, executed task by task.

The spec lives in `.kiro/specs/disclore-97-core/`.

### Testing

Correctness properties from the design are tested as property-based tests with [Vitest](https://vitest.dev) and [fast-check](https://fast-check.dev), with one test file per property. Unit and component tests cover specific examples and edge cases. The suite has 24 test files and 111 tests.

For the full development story, see [docs/BUILD-STORY.md](docs/BUILD-STORY.md).

## Pre-Baked Discs

Two original discs ship with the app. Both are typed `DiscManifest` objects in `src/discs/`.

| Disc | Sections | Diagrams / hotspots | Trivia questions | Dungeons |
| --- | --- | --- | --- | --- |
| DiscLore '97: Ancient Castles & Keeps | 5 | 1 diagram, 4 hotspots | 6 | 1 (10 rooms) |
| DiscLore '97: Retro Computing & Dial-Up Era | 7 | 1 diagram, 4 hotspots | 6 | 1 (10 rooms) |

- **Castles:** the dungeon is "The Keep of Many Stairs". The diagram is a castle cross-section.
- **Retro:** the dungeon is "The Cursor Catacombs". The diagram is a dial-up home setup.
## Getting started

Requires Node.js and npm.

```bash
npm install        # install dependencies
npm run dev         # start the Vite dev server
npm test           # run the test suite once
npm run lint       # run ESLint
npm run build      # type-check and build to dist/
```

## Deploying to Cloudflare Pages

The app is a static site. Use these settings:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

## Content note

All disc content is original. It is not taken from any real product.

## License

Released under the [MIT License](LICENSE).
