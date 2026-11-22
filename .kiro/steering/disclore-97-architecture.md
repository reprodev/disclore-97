---
inclusion: always
---

# DiscLore '97: Architecture Rules

These rules sit beside `disclore-97-design-system.md`. That file covers the look, the audio, and the manifest invariants. This one covers how the code is layered and where untrusted data is allowed to go. `tests/dynamic-static.test.ts` enforces several of them. If a request conflicts with a rule here, say so and propose a compliant alternative.

## 1. The compiler stays pure

The disc compiler turns an `ExtractedSource` into a `DiscManifest`. The same source must always give the same disc. The compiler files are:

- `src/model/compiler.ts`
- `src/model/sourceInput.ts`
- `src/extract/ssrf.ts`
- everything under `src/model/compile/`

In those files:

- **No network.** No `fetch(`, no XHR, no WebSocket.
- **No DOM or browser state.** No `document.`, `window.`, `localStorage`, or `navigator`.
- **No React.** No imports from `react` or `react-dom`.
- **No upward imports.** Do not import from `src/components/`, `src/adapters/`, or `src/library/`. The model layer never depends on the UI, the adapters, or storage.
- **No nondeterminism.** No `Math.random`, `Date.now`, or `new Date`. Every random-looking choice comes from the seeded PRNG in `compile/prng.ts`, with one independent stream per stage (sections, diagram, trivia, dungeon).
- **Adding media never changes the seed.** A disc with pictures must compile exactly like the same disc without them, apart from the `media` list.

All untrusted text is cleaned inside the compiler with `sanitizeLine` and `sanitizeParagraph`. Adapters may stay simple, but they must not be the only line of defence.

## 2. Layers

- `src/model/`: pure logic (manifest types, validator, BFS solver, KeepMaze reducer, media rules, compiler). No React and no DOM.
- `src/adapters/`: reads a source (GitHub, web page, topic, Markdown) into an `ExtractedSource`. Never throws. Returns a `Result`.
- `src/extract/`: logic shared by the Pages Functions and the dev middleware (SSRF guard, HTML extractor, `/api/extract` and `/api/topic` handlers). It has no environment variables, no keys, and no secrets.
- `src/library/`: `localStorage` persistence and disc image import and export.
- `src/audio/`: the only code that creates an `AudioContext` or oscillators, plus Web Speech narration.
- `src/components/`: Win95 UI. It calls the other layers and holds no game rules.

## 3. Every disc passes the same gate

Any disc that did not ship in the repository (burned, loaded from `localStorage`, or mounted from a `.json` file) must pass `loadDisc(manifest, false)`, which runs `validateManifest`. Never render a disc that has not been through it. Mounting a disc image is `JSON.parse` then `loadDisc`, and a rejection must show an error dialog and mount nothing.

## 4. SSRF and safe media

- **Page fetching.** `/api/extract` may only fetch addresses that pass `checkTarget` in `src/extract/ssrf.ts`: `http` or `https` only, no credentials, ports 80 and 443 only, no localhost or internal names, no private, loopback, link-local, or reserved IP ranges. Every redirect is checked again, with a hop limit.
- **Topic lookup.** `/api/topic` may only call the English Wikipedia API. The host is fixed in code. The caller supplies search text only, and it travels as a query parameter.
- **Pictures.** Every picture address goes through `safeMediaUrl` in `src/model/media.ts`. It allows public `https` addresses only. It rejects `http`, `javascript:`, `data:`, `blob:`, private hosts, credentials, odd ports, whitespace, and `.svg` or `.svgz` files. No more than 8 pictures per disc, and captions must be plain text.
- **Defence in depth.** The extractor, the adapters, the compiler, and `validateManifest` each check media again. Do not remove a check because another layer has one.
- **Rendering.** Pictures load with `referrerPolicy="no-referrer"` and fall back to an SVG plate on error. Never use `dangerouslySetInnerHTML` or `innerHTML`.
- **Absolute URLs in `src/`.** Only GitHub addresses may appear as literals. Build any other address from parts, or keep it in `functions/`.

## 5. The two API routes stay in sync

`/api/extract` and `/api/topic` exist in two places that must behave the same:

| Route | Production | Dev server |
| --- | --- | --- |
| `/api/extract` | `functions/api/extract.ts` | the `disclore-dev-extract-api` plugin in `vite.config.ts` |
| `/api/topic` | `functions/api/topic.ts` | the same plugin |

Both call one handler in `src/extract/` (`handleExtract` or `handleTopic`). So:

- Put logic in the handler, never in the function file or the plugin. They only adapt a request and a response.
- When you add or change a route, change all three places in the same commit: the handler, `functions/api/`, and `vite.config.ts`.
- The plugin must stay dev-only (`apply: 'serve'`), so it is not part of `vite build`.
- Keep the adapters (`src/adapters/webpage.ts`, `topic.ts`) and the burn fallback working when a route is missing. The app must still build and run without the functions.

## 6. Checks before you finish

Run `npm test`, `npm run build`, and `npm run lint`. Two Kiro hooks in `.kiro/hooks/` run the static tests when a file in `src/` is saved, and the property tests when a file in `src/model/` or `src/discs/` is saved.
