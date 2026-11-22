# DiscLore '97

A fictional 1997 Windows 95 CD-ROM encyclopedia, rebuilt as a static web app. Browse the disc, click around illustrated scenes, flip through pictures, have articles read aloud, and try to survive a trivia dungeon. You can also **burn your own disc** from a GitHub repository, a web page, a Wikipedia topic, or Markdown.

## Features

- **Win95-style CD-ROM encyclopedia.** Windows 95 chrome, article browsing, and original disc content on the four built-in discs.
- **Encarta-style Home screen.** A warm parchment masthead with a tracked uppercase eyebrow, a serif DISCLORE beside a large burgundy 97, and a wide-tracked lowercase "encyclopedia" subtitle. Faint **engraved watermarks** sit behind it: a ringed planet, an open encyclopedia, an arch and keep, and orbiting CD rings. They are flat SVG line art in two sepia tokens (`--color-watermark-ink`, `--color-parchment-tint`), with no gradients and no images.
- **Editorial action rail.** Quick Jump Modes (Interactive Diagrams, KeepMaze Quest, Surprise Me!) and Utilities (Burn New CD-R Disc, Mount Disc Image, About / ReadMe, Replay Intro Splash) are rows with a 24px icon, a bold title, and a quiet italic subtitle. A row rests flat on the parchment, raises like a Win95 button on hover or focus, and sinks when pressed.
- **Pinpointer search.** A search bar over every disc, with a sunken results list that shows each article's disc and an origin badge. Its last row is always **Burn CD-R for "<query>" (Wikipedia)...**, a search-anything bridge: when nothing matches, it takes the place of a dead end, and picking it (Enter or click) opens the Burn dialog and starts a topic burn for what you typed. The arrow keys, Enter and Escape work across the local results and that row.
- **Burn New CD-R Disc.** Compile a new disc in the browser from GitHub, a web page, a topic, or Markdown. Burned discs are validated like the built-in ones and saved in `localStorage`.
- **Interactive diagrams.** Each diagram is an SVG on a 0..100 coordinate grid with clickable hotspots. Burned discs get a diagram that matches their source: an architecture blueprint (GitHub), a site map (web page), an outline (Markdown), or a concept chart (topic).
- **1997 Multimedia Experience.**
  - **MediaReel.** A beveled picture frame in the article sidebar with Prev, Next, Enlarge, and a "Frame X / Y" counter. Pictures load without a referrer, show a loading note, and fall back to an SVG plate if they fail.
  - **Pop-Out Picture Viewer.** A Win95 modal window with the full-size picture, the caption, and a thumbnail filmstrip. It is the only place the slideshow plays: Play / Pause advances every 4 seconds, and closing the window pauses it. Space toggles Play, the left and right arrow keys step, and Escape closes it. The footer shows these shortcuts.
  - **Read Aloud.** The browser's Web Speech API narrates the article one paragraph at a time. The paragraph being read is highlighted, and the button shows live progress such as "Stop (2/5)". A **1x / 1.2x** button sets the speed, and changing it mid-narration carries on from the current paragraph. It stops on Mute, on a section change, and when the article closes.
- **Authenticity and study tools.** A Chronology strip, Show in Diagram (highlights the matching pin), Cite / Print Preview with Copy Citation, and a Victory Certificate in KeepMaze.
- **Explore History.** A **Timeline** button in the disc toolbar (beside Diagram and KeepMaze, dimmed when no article has dated events) opens a disc-wide chronology. It gathers every timeline event from every article, orders them by the first year in each date (`1100s`, `After 1066`, `280 BC`), and lays them out as a horizontal strip of century columns, with undated events under "Other dates". Each event carries its article as a badge, and clicking it opens that article with normal Back and Forward history. The logic is in `src/model/timeline.ts`.
- **Diagram pin previews.** Hovering or focusing a numbered pin shows a Win95 preview card with the target article's title and its first Quick Fact (or its first sentence), before you click.
- **Inline cross-links.** When a paragraph mentions another article's title from the same disc, the words become a link. It is built in pure React from text pieces (`src/model/crossLinks.ts`), never from HTML. The article itself is never linked, each target is linked at most once per paragraph, longer titles win over shorter overlapping ones, and titles under four characters are skipped.
- **Bookmarks.** A **Bookmark / Bookmarked** toggle in the article tools saves the article in `localStorage` per disc (`disclore97.bookmarks.<disc_id>`, apart from the burned-disc library). A **Bookmarks** list appears in the contents sidebar once there is at least one.
- **Encarta Dictionary.** A **Dictionary** toolbar button, a **View > Dictionary...** item, and a **Dictionary...** card in the Home Utilities open a Win95 dialog. Double-clicking a single word in an article opens it pre-filled with that word. While you type, it lists whole-word matches from every mounted disc: section titles, Quick Facts, and body sentences (`findMentions` in `src/model/discSearch.ts`). Press **Look Up** for a short plain-text definition from `/api/define`, which calls the free Dictionary API. If the word is not found or the network is down, the dialog says so and keeps the disc matches, so it still works offline.
- **Media Gallery.** A **Gallery** toolbar button and **View > Gallery** item open a contact sheet for the open disc. A disc with extracted pictures shows every picture with its caption, and clicking one opens the Picture Viewer at that frame. A built-in or offline disc has no pictures, so each article's SVG plate is shown instead, and clicking a plate opens that article.
- **Study progress.** Each article you open is remembered per disc in `localStorage` as `disclore97.visited.<disc_id>`, apart from bookmarks and the burned-disc library. The contents sidebar puts a check mark on read articles and shows an "X / Y read" note.
- **Find in Article.** A **Find in Article** toggle in the article tools opens a search bar with Previous match, Next match, and an "X of Y" counter. Enter goes to the next match, Shift+Enter to the previous, and Escape closes the bar. Matches are highlighted with `<mark>`. The text is split in pure React (`src/model/findInText.ts`), so cross-links stay buttons and no HTML is built.
- **KeepMaze.** A trivia dungeon with a Quest card, a mini-map with a legend, Peek Hint, and a torchlight pulse on each room. Maze layouts are verified with breadth-first search (BFS), so the exit is always reachable.
- **KeepMaze MindMaze scoring.** The Quest card shows **Score**, **Streak**, and **Torches**. A right answer earns 100 points plus a streak bonus of 10 per answer already in a row (capped at +50), or 50 points with no bonus if Peek Hint was used. A wrong answer resets the streak and dims one of three torches. The score never goes down and torches stop at zero, so a player can never be locked out of finishing the maze. The Victory Certificate is stamped with Score, Best Streak, and a **Scholar Rank** (Royal Archivist, Court Scholar, Keep Explorer, or Torchbearer), set by the share of the best possible score for the moves taken. The rules are pure functions in `src/model/game.ts`.
- **1997 palette.** Royal Sapphire, Warm Ivory, Burgundy, and Antique Gold, on top of the seven required Win95 chrome colors. All colors live in `src/styles/tokens.css`.
- **Procedural WebAudio.** All sound is generated at runtime, with no audio files. Effects are soft triangle and sine chords: clicks, page flips, door unlocks, a slide-projector click in the picture viewer, a CD-R burn completion ding, a KeepMaze victory fanfare, and the boot chime.
- **Ambience.** An optional atmosphere, Off by default, switched by the **Ambience: Off/On** button in the taskbar. It follows the open disc: wind and hearth for castles, a CRT hum for code and web discs, and a quiet study tone for the rest. It is silent while Sound is muted and stops when the taskbar leaves the screen.
- **Micro-animations.** Subtle SVG touches: a blinking CRT cursor, flickering torch windows, and a CD glint. They are plain CSS opacity steps (`blink`, `flicker`, `glint`), and all of them stop under `prefers-reduced-motion: reduce`.
- **Global Mute.** One **Sound** control silences everything: effects, Ambience, and Read Aloud.

## How it was built

The project was built with [Kiro](https://kiro.dev) using Spec-Driven Development. Each step feeds the next:

1. `.kiro/steering`: project-wide guidance and conventions.
2. `requirements.md`: user stories and acceptance criteria.
3. `design.md`: architecture and the correctness properties to test.
4. `tasks.md`: an ordered, dependency-aware implementation plan, executed task by task.

The specs live in `.kiro/specs/`: `disclore-97-core` (the app and the built-in discs) and `dynamic-disc-compiler` (Burn New CD-R Disc). The later multimedia, palette, and Wikipedia work was done as follow-up changes. See [docs/BUILD-STORY.md](docs/BUILD-STORY.md) for the whole story.

### Testing

Correctness properties from the design are tested as property-based tests with [Vitest](https://vitest.dev) and [fast-check](https://fast-check.dev). Unit and component tests cover specific examples and edge cases. Two static tests, `tests/static.test.ts` and `tests/dynamic-static.test.ts`, scan the repository for rule violations: hex colors outside `tokens.css`, nonzero `border-radius`, gradients, blurred shadows, `AudioContext` outside `src/audio/`, absolute URLs other than the GitHub ones in `src/`, and more.

Run `npm test` for the current file and test counts. They change as the project grows, so they are not copied here.

## Architecture

```text
src/
  model/       Pure logic: manifest types, validator, BFS solver, KeepMaze reducer,
               media rules, and the seeded disc compiler (model/compile/).
  adapters/    Source readers for Burn New CD-R Disc: github, webpage, topic, markdown, burn.
  extract/     Server-side logic shared by the Pages Functions: SSRF guard, HTML extractor,
               /api/extract, /api/topic and /api/define handlers.
  library/     localStorage persistence for burned discs, and disc image (.json) save and mount.
  audio/       The only code that touches AudioContext (effects and ambience), plus Web Speech narration.
  components/  Win95 components: windows, viewers, MediaReel, Picture Viewer, KeepMaze UI.
  discs/       The four built-in discs and the loader.
  styles/      CSS, with all colors defined once in tokens.css.
functions/api/ Cloudflare Pages Functions: extract.ts, topic.ts and define.ts.
```

The model layer has no React and no DOM. The compiler is pure and seeded, so the same source always gives the same disc, apart from pictures, which never change the seed.

## Pre-Baked Discs

Four original discs ship with the app, so a first visit fills a 2 by 2 grid on the Home shelf. Each is a typed `DiscManifest` object in `src/discs/`, works offline, and passes the same validator and BFS solver as a burned disc.

| Disc | Sections | Diagrams / hotspots | Trivia questions | Dungeons |
| --- | --- | --- | --- | --- |
| DiscLore '97: Ancient Castles & Keeps | 5 | 1 diagram, 4 hotspots | 6 | 1 (10 rooms) |
| DiscLore '97: Retro Computing & Dial-Up Era | 7 | 1 diagram, 4 hotspots | 6 | 1 (10 rooms) |
| DiscLore '97: Folklore, Samhain & Halloween | 5 | 1 diagram, 5 hotspots | 8 | 1 (10 rooms) |
| DiscLore '97: Lost Formats & Digital Resurrection | 5 | 1 diagram, 5 hotspots | 8 | 1 (10 rooms) |

- **Castles:** the dungeon is "The Keep of Many Stairs". The diagram is a castle cross-section.
- **Retro:** the dungeon is "The Cursor Catacombs". The diagram is a dial-up home setup.
- **Halloween:** the dungeon is "The Hollow Halls of Hallowtide". The diagram is a haunted hill with a flickering bonfire, castle windows, and a glinting moon. Sections cover Samhain, jack-o'-lanterns, gargoyles and Gothic fiction, Victorian ghost stories, and modern Halloween.
- **Resurrection:** the dungeon is "The Archive of Lost Formats". The diagram is an archive workbench with a blinking CRT cursor and a glinting CD-ROM. Sections cover the CD-ROM, HyperCard, floppy disks, CRT screens, and software preservation.

## Burn New CD-R Disc

Choose **Burn New CD-R Disc**, pick a source, and press Burn. The app fetches or reads the source, compiles it into a `DiscManifest`, runs the same validator and BFS solver as the built-in discs, and opens the result.

Four source kinds are supported:

| Source | How it is read |
| --- | --- |
| **github** | A public repository, read through the GitHub REST API: description, facts, languages, README text, the owner's avatar, and README images. |
| **webpage** | A public web page, fetched through `/api/extract`. The text and safe `og:image`, `twitter:image`, and `<img>` pictures are extracted. |
| **topic** | A free-text topic, looked up on English Wikipedia through `/api/topic`. The article text, section headings, and pictures become a disc. |
| **markdown** | Markdown text you paste in. |

**Sample burns.** While the library has no burned discs, the empty **Burned CD-Rs** tab on the Home shelf offers three quick-start buttons: **Burn Sample: Halloween**, **Burn Sample: Gothic fiction**, and **Burn Sample: CD-ROM**. Each opens the Burn dialog and starts a Wikipedia topic burn for that topic (or the offline outline, if the lookup fails).

### Save and mount disc images

Any disc can be exported and shared as a plain `.json` file.

- **File > Save Disc Image (.json)** (when a disc is open) downloads the disc's manifest as `<disc_id>.json`.
- **File > Mount Disc Image (.json)...**, or the **Mount Disc Image** card under Utilities on the Home window, opens a file picker. The file goes through `JSON.parse` and then `loadDisc(parsed, false)`, the same validator and BFS solver every burned disc passes, including the safe-media rules. A file that is not JSON, not a disc, too large (over 5 MB), reuses a built-in disc's ID, or fails validation is rejected with a Win95 message box that lists the first problems, and nothing is mounted. A valid disc opens and is added to the `localStorage` library.

Because a disc image is just the manifest, it works offline and can be edited by hand. The validator is the only gatekeeper, so treat images from other people like any other downloaded file.

**Topic fallback.** If the lookup fails (offline, no matching article, a disambiguation page, or no `/api/topic` function), the burn still succeeds. It builds an **offline study outline** that says plainly that it is an outline and not an encyclopedia article.

**Pictures.** A disc can carry up to 8 pictures. Only public `https` image addresses are kept. The compiler and the validator reject `http`, `javascript:`, `data:`, localhost and private addresses, credentials, odd ports, and SVG files.

### The server functions

Three optional Cloudflare Pages Functions do the work the browser cannot. The app builds and runs without them. Only the `webpage` and `topic` sources need the first two, and the topic source falls back to the outline. The Dictionary needs `/api/define` only for its online definition and falls back to matches from the mounted discs.

| Route | File | Shared logic | What it does |
| --- | --- | --- | --- |
| `/api/extract?url=...` | `functions/api/extract.ts` | `src/extract/handler.ts` | Fetches a public web page and returns its title, headings, paragraphs, and pictures. |
| `/api/topic?q=...` | `functions/api/topic.ts` | `src/extract/topicHandler.ts` | Searches English Wikipedia and returns the best article's text and pictures. |
| `/api/define?word=...` | `functions/api/define.ts` | `src/extract/defineHandler.ts` | Looks one English word up in the free Dictionary API and returns up to three short meanings. The word must be a single run of letters, and the host is fixed in code. |

`/api/extract` has an SSRF guard. It rejects non-HTTP(S) URLs and private, loopback, and link-local addresses, and it re-checks every redirect. The guard cannot fully prevent DNS rebinding, because the hostname is resolved again when the request is made. Treat it as defense in depth, not a complete barrier. `/api/topic` only ever calls the English Wikipedia API, and the search text is passed as data.

### Limits

- **GitHub rate limit.** Requests are unauthenticated, so GitHub allows 60 requests per hour per IP address. When the limit is reached, the burn fails with an error and you can retry later.
- **Disc library.** Burned discs are stored in `localStorage` in your browser, up to 10 discs. They never leave your device.

## Getting started

Requires Node.js and npm.

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server
npm test           # run the test suite once
npm run lint       # run ESLint
npm run build      # type-check and build to dist/
```

`npm run dev` also serves `/api/extract` and `/api/topic`, through a small Vite middleware plugin in `vite.config.ts`. It calls the same handlers as the Pages Functions. It applies only to the dev server (`apply: 'serve'`), so it is not part of `npm run build` or the deployed site. Burning web pages and topics works in dev with no extra setup.

To try the real Pages Functions locally:

```bash
npm run build
npx wrangler pages dev dist
```

## Deploying to Cloudflare Pages

The app is a static site plus optional Pages Functions. Use these settings:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

Cloudflare Pages picks up `functions/api/extract.ts`, `functions/api/topic.ts` and `functions/api/define.ts` automatically. No API keys or environment variables are needed.

## Attribution and Content Licensing

- **Built-in discs.** The text, SVG artwork, and sound are original to this project and are released with it under the MIT License. Sound is generated at runtime.
- **Wikipedia topics.** Topic article text comes from English Wikipedia and is available under the [Creative Commons Attribution-ShareAlike 4.0 license (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). The first section of each burned topic disc ends with a Source line that names the Wikipedia page it came from. If you redistribute a burned disc, you must keep that attribution and share it under the same license.
- **Wikimedia Commons media.** Topic pictures come from Wikimedia Commons and keep their own licenses. These differ from file to file, and some require attribution or share-alike terms. The app shows each picture's file name as its caption but does not display per-file license details. Check the Commons file page before you reuse an image.
- **Web page and GitHub sources.** Text and pictures from pages and repositories belong to their authors and are used under whatever terms they publish. A burned disc names its source in the first section. These discs are built on your device and stay in your browser, and the project does not redistribute them.
- **Trademarks.** Wikipedia and Wikimedia Commons are projects of the [Wikimedia Foundation](https://wikimediafoundation.org/). DiscLore '97 is not affiliated with or endorsed by the Wikimedia Foundation, GitHub, or any other source. The names of the real CD-ROM products that inspired this project are used only as inspiration.

## License

The code is released under the [MIT License](LICENSE). Content that you burn from other sources keeps the license of that source, as described above.
