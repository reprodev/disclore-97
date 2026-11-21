# Requirements Document

## Introduction

DiscLore '97 is a static web application that presents encyclopedia-style "CD-ROM discs" in an authentic 1997 Windows 95 look. Each disc is described by a typed `DiscManifest` containing encyclopedia sections, SVG diagrams with hotspots, section-cited trivia, and KeepMaze dungeons. The application is built with Vite, TypeScript, and React, is deployable as static assets on Cloudflare Pages, and follows the design constraints in `.kiro/steering/disclore-97-design-system.md`.

This spec covers the core: repository hygiene and design tokens, the `DiscManifest` schema with runtime validator and two pre-baked discs, the KeepMaze BFS solver with automated tests, the reusable Win95 component set, and one shared procedural audio module with a global Mute toggle.

## Glossary

- **App**: The DiscLore '97 single-page web application built with Vite, TypeScript, and React.
- **Design_Tokens**: The single shared set of CSS custom properties defining colors, fonts, and bevel dimensions.
- **DiscManifest**: The typed data structure describing one disc: metadata, sections, diagrams, trivia, and dungeons.
- **Manifest_Validator**: The runtime function that checks an unknown value against the DiscManifest schema and returns either a valid DiscManifest or a list of errors.
- **Section**: An encyclopedia article within a DiscManifest, identified by a unique `section_id`.
- **Diagram**: An SVG illustration within a DiscManifest that contains Hotspots.
- **Hotspot**: A clickable point on a Diagram with coordinates `(x, y)` in percent and a `section_id` reference.
- **Trivia_Question**: A multiple-choice question in a DiscManifest that cites one `section_id`.
- **Dungeon**: A KeepMaze graph of Rooms and Exits within a DiscManifest.
- **Room**: A node in a Dungeon, identified by a unique `room_id`.
- **Entrance**: The Room with `room_id` equal to `entrance`.
- **Throne_Room**: The Room with `room_id` equal to `throne_room`.
- **Orphan_Room**: A Room that is not reachable from the Entrance.
- **Maze_Solver**: The breadth-first-search function that computes reachability and the shortest path between Rooms of a Dungeon.
- **Disc_Browser**: The component listing available discs and allowing the user to open one.
- **Article_Viewer**: The component displaying a Section.
- **Hotspot_Viewer**: The component rendering a Diagram and its Hotspots.
- **KeepMaze_UI**: The components presenting a Dungeon and its Trivia_Questions to the player.
- **Win95_Components**: The shared component set: Window, TitleBar, BevelButton, MenuBar, and Tooltip.
- **Audio_Module**: The single shared module that synthesizes all sound effects with the WebAudio API.
- **Mute_Toggle**: The global control that enables or disables all sound output.
- **Sound_Effect**: One of disc spin-up, bevel button click, page flip, KeepMaze torch, or door unlock.
- **Test_Suite**: The Vitest tests, including fast-check property-based tests.

## Requirements

### Requirement 1: Repository Hygiene and Licensing

**User Story:** As a maintainer of a public repository, I want licensing and ignore rules in place, so that the project is legally clear and free of accidental secrets.

#### Acceptance Criteria

1. THE App repository SHALL contain a `LICENSE` file at the repository root with the MIT license text.
2. THE App repository SHALL contain a `.gitignore` file that excludes `node_modules`, `dist`, `.env`, `.env.*`, and `.wrangler`.
3. THE App repository SHALL contain no API keys, tokens, private URLs, or `.env` files in committed source.
4. THE App repository SHALL contain no audio files with extension `.mp3`, `.wav`, or `.ogg`.

### Requirement 2: Project Scaffolding and Static Deployment

**User Story:** As a developer, I want a Vite, TypeScript, and React project that builds to static assets, so that I can deploy it to Cloudflare Pages.

#### Acceptance Criteria

1. THE App SHALL build with the command `npm run build` into a static `dist` directory.
2. THE App SHALL run its tests with the command `npm test` executing Vitest in single-run mode.
3. THE App SHALL compile with TypeScript strict mode enabled.
4. THE App SHALL declare as runtime dependencies only `react` and `react-dom`, and as development dependencies only build, type, lint, and test tooling including `vitest` and `fast-check`.
5. THE App SHALL operate without a server runtime for all features in this spec.

### Requirement 3: Shared Win95 Design Tokens

**User Story:** As a developer, I want colors and fonts defined once, so that every component renders the same Win95 look.

#### Acceptance Criteria

1. THE Design_Tokens SHALL define CSS custom properties for surface `#C0C0C0`, title bar `#000080`, title text `#FFFFFF`, bevel highlight `#FFFFFF`, bevel shadow `#808080`, bevel outer edge `#000000`, and tooltip fill `#FFFFE1`.
2. THE Design_Tokens SHALL define a serif font stack `Georgia, "Times New Roman", serif` for article text and a sans-serif font stack `"MS Sans Serif", Tahoma, sans-serif` for menus, buttons, and the KeepMaze HUD.
3. THE Design_Tokens SHALL define 2px bevel border widths for outset and inset styles.
4. THE App SHALL declare each hex color value in exactly one stylesheet location, the Design_Tokens definition.
5. THE App stylesheets SHALL use a border-radius of 0 for all elements.
6. THE App stylesheets SHALL contain no `box-shadow` with blur radius greater than 0, no `backdrop-filter`, and no gradient fills.

### Requirement 4: DiscManifest Schema

**User Story:** As a content author, I want one typed manifest schema for every disc, so that all discs render through the same code.

#### Acceptance Criteria

1. THE DiscManifest SHALL contain a unique `disc_id`, a `title`, a `tagline`, a non-empty list of Sections, a list of Diagrams, a list of Trivia_Questions, and a list of Dungeons.
2. THE Section SHALL contain a `section_id` unique within the DiscManifest, a `title`, and a non-empty list of paragraph strings.
3. THE Diagram SHALL contain a `diagram_id` unique within the DiscManifest, a `title`, an SVG `viewBox` of `0 0 100 100`, a list of SVG shape descriptors, and a list of Hotspots.
4. THE Hotspot SHALL contain a `label`, a numeric `x`, a numeric `y`, and a `section_id`.
5. THE Trivia_Question SHALL contain a `question_id`, a `prompt`, a list of at least 2 answer options, a zero-based `correct_index`, and a cited `section_id`.
6. THE Dungeon SHALL contain a `dungeon_id`, a `title`, and a list of Rooms where each Room has a `room_id`, a `name`, a `description`, and a list of Exits each naming a destination `room_id`.
7. THE App SHALL expose the DiscManifest types from one TypeScript module used by the pre-baked discs, the Manifest_Validator, the Maze_Solver, and the components.

### Requirement 5: Runtime Manifest Validation

**User Story:** As a user loading a dynamically compiled disc, I want invalid manifests rejected before rendering, so that the App does not crash or show broken content.

#### Acceptance Criteria

1. WHEN a value is passed to the Manifest_Validator, THE Manifest_Validator SHALL return either a valid DiscManifest or a list of errors, each error containing the path of the offending field and a message.
2. IF a required field is missing or has the wrong type, THEN THE Manifest_Validator SHALL return an error naming that field path.
3. IF two Sections, Diagrams, Trivia_Questions, Dungeons, or Rooms within one scope share an identifier, THEN THE Manifest_Validator SHALL return a duplicate-identifier error.
4. IF a Hotspot has an `x` or `y` value less than 0 or greater than 100, or that is not a finite number, THEN THE Manifest_Validator SHALL return a coordinate-range error.
5. IF a Hotspot references a `section_id` that does not exist in the same DiscManifest, THEN THE Manifest_Validator SHALL return a dangling-reference error.
6. IF a Trivia_Question cites a `section_id` that does not exist in the same DiscManifest, THEN THE Manifest_Validator SHALL return a dangling-reference error.
7. IF a Trivia_Question has a `correct_index` outside the range of its answer options, THEN THE Manifest_Validator SHALL return an index-range error.
8. IF a Dungeon has no Entrance or no Throne_Room, THEN THE Manifest_Validator SHALL return a missing-room error.
9. IF an Exit names a `room_id` that does not exist in the same Dungeon, THEN THE Manifest_Validator SHALL return a dangling-reference error.
10. IF the Maze_Solver finds no path from the Entrance to the Throne_Room, THEN THE Manifest_Validator SHALL return an unsolvable-dungeon error.
11. IF the Maze_Solver finds one or more Orphan_Rooms, THEN THE Manifest_Validator SHALL return an orphan-room error listing each Orphan_Room identifier.
12. WHEN the App receives a manifest from any source other than the pre-baked discs, THE App SHALL pass the manifest through the Manifest_Validator before rendering and display the error list in place of the disc when validation fails.
13. FOR ALL valid DiscManifest values, serializing to JSON, parsing, and validating SHALL produce a DiscManifest deep-equal to the original (round-trip property).
14. THE App SHALL accept a manifest from outside the pre-baked discs only through the `loadDisc` function. This spec provides no file-picker, paste, or URL import interface, and the source of such a manifest is limited to code and tests that call `loadDisc`.
15. THE Manifest_Validator SHALL set on each error a `code` field naming the error kind (`missing-field`, `wrong-type`, `duplicate-id`, `coordinate-range`, `dangling-reference`, `index-range`, `missing-room`, `unsolvable-dungeon`, or `orphan-room`), so that callers and tests can identify the error kind without parsing the message.
16. THE Diagram shape descriptors SHALL be one of `rect`, `circle`, `line`, or `polygon`, each with numeric geometry fields and optional `fill` and `stroke` strings, and THE Manifest_Validator SHALL return a `wrong-type` error for any other shape kind.

### Requirement 6: Pre-Baked Discs

**User Story:** As a user, I want two ready-made discs, so that I can explore the App immediately.

#### Acceptance Criteria

1. THE App SHALL include a pre-baked disc titled "DiscLore '97: Ancient Castles & Keeps".
2. THE App SHALL include a pre-baked disc titled "DiscLore '97: Retro Computing & Dial-Up Era".
3. THE App SHALL provide each pre-baked disc as a DiscManifest that passes the Manifest_Validator with zero errors.
4. THE DiscManifest of each pre-baked disc SHALL contain at least 5 Sections, at least 1 Diagram with at least 3 Hotspots, at least 5 Trivia_Questions, and at least 1 Dungeon with at least 8 Rooms.
5. THE DiscManifest of each pre-baked disc SHALL use original written text and original SVG artwork, with no third-party copyrighted assets.
6. THE Dungeon room descriptions of each pre-baked disc SHALL relate to the disc subject.

### Requirement 7: KeepMaze Solver

**User Story:** As a content author, I want dungeons proven solvable, so that players are never stuck in an unwinnable maze.

#### Acceptance Criteria

1. WHEN a Dungeon is passed to the Maze_Solver, THE Maze_Solver SHALL compute the set of Rooms reachable from the Entrance using breadth-first search.
2. WHEN a path from the Entrance to the Throne_Room exists, THE Maze_Solver SHALL return a shortest path as an ordered list of `room_id` values starting at the Entrance and ending at the Throne_Room.
3. WHEN no path from the Entrance to the Throne_Room exists, THE Maze_Solver SHALL return an empty path.
4. THE Maze_Solver SHALL return the list of Orphan_Rooms as the Rooms not in the reachable set.
5. WHEN a Dungeon contains cycles, THE Maze_Solver SHALL terminate and visit each Room at most once.
6. WHEN a Dungeon contains up to 500 Rooms, THE Maze_Solver SHALL complete within 100 ms.
7. THE Maze_Solver SHALL treat Exits as directed edges.

### Requirement 8: Automated Invariant Tests

**User Story:** As a maintainer, I want tests that enforce data invariants for every disc, so that schema or content changes cannot silently break them.

#### Acceptance Criteria

1. THE Test_Suite SHALL assert, for every pre-baked disc, that every Hotspot `x` and `y` is within 0 to 100 inclusive and references an existing `section_id`.
2. THE Test_Suite SHALL assert, for every pre-baked disc, that every Trivia_Question cites an existing `section_id`.
3. THE Test_Suite SHALL assert, for every Dungeon of every pre-baked disc, that the Maze_Solver finds a path from the Entrance to the Throne_Room and returns zero Orphan_Rooms.
4. THE Test_Suite SHALL include fast-check property tests that run at least 100 generated cases each.
5. THE Test_Suite SHALL include a property test asserting that for any generated Dungeon, the returned shortest path starts at the Entrance, ends at the Throne_Room, and every consecutive pair of Rooms is connected by an Exit.
6. THE Test_Suite SHALL include a property test asserting that for any generated Dungeon, the reachable set and the Orphan_Rooms partition all Rooms with no overlap.
7. THE Test_Suite SHALL include a property test asserting that for any generated Dungeon, no path returned by the Maze_Solver is shorter than any other valid path between the same Rooms.
8. THE Test_Suite SHALL include a property test asserting that the Manifest_Validator rejects any generated manifest containing a Hotspot coordinate outside 0 to 100.
9. THE Test_Suite SHALL include a property test asserting that the Manifest_Validator rejects any generated manifest containing a dangling Hotspot, Trivia_Question, or Exit reference.
10. THE Test_Suite SHALL include the JSON round-trip property from Requirement 5, criterion 13.
11. THE Test_Suite SHALL include a test asserting that the Audio_Module produces no sound while the Mute_Toggle is enabled.

### Requirement 9: Win95 Window Chrome Components

**User Story:** As a user, I want familiar Win95 windows and controls, so that the App feels like a 1997 desktop program.

#### Acceptance Criteria

1. THE Window component SHALL render a TitleBar, an optional MenuBar, and a content area with an outset bevel using the Design_Tokens.
2. THE TitleBar component SHALL render the window title in white text on the title bar color and a close button.
3. WHEN the user activates the close button of a Window, THE Window component SHALL invoke its `onClose` callback.
4. THE BevelButton component SHALL render an outset bevel in its resting state.
5. WHILE a BevelButton is pressed, THE BevelButton component SHALL render an inset bevel.
6. WHEN the user activates a BevelButton, THE BevelButton component SHALL invoke its `onClick` callback and request the button click Sound_Effect from the Audio_Module.
7. WHILE a BevelButton is disabled, THE BevelButton component SHALL ignore activation and render its label in the shadow color.
8. THE MenuBar component SHALL render a list of top-level menus using the sans-serif font token, each opening a list of items.
9. WHEN the user activates a MenuBar item, THE MenuBar component SHALL invoke that item's callback and close the open menu.
10. WHEN the user presses the Escape key while a menu is open, THE MenuBar component SHALL close the menu.
11. WHEN the pointer rests on or keyboard focus enters a target element with tooltip text, THE Tooltip component SHALL display the text on the tooltip fill color with a 1px solid outer-edge border.
12. WHEN the pointer leaves or focus leaves the target element, THE Tooltip component SHALL hide the text.
13. THE Win95_Components SHALL be operable by keyboard and expose accessible roles and names for buttons, menus, and windows.
14. WHILE a menu is open, THE MenuBar component SHALL move focus between items with the Up and Down arrow keys and between top-level menus with the Left and Right arrow keys.
15. WHEN a Win95_Components control has keyboard focus, THE Win95_Components SHALL display a visible focus indicator built from Design_Tokens.
16. WHEN the pointer enters or focus enters a Tooltip target, THE Tooltip component SHALL display the text without a delay.

### Requirement 10: Disc Browser and Article Viewer

**User Story:** As a user, I want to pick a disc and read its articles, so that I can explore the encyclopedia content.

#### Acceptance Criteria

1. THE Disc_Browser SHALL list every available disc by title and tagline.
2. WHEN the user opens a disc in the Disc_Browser, THE App SHALL display the disc in a Window and request the disc spin-up Sound_Effect.
3. THE Disc_Browser SHALL list the Sections, Diagrams, Trivia_Questions group, and Dungeons of the open disc as navigable entries.
4. WHEN the user selects a Section, THE Article_Viewer SHALL display the Section title and paragraphs using the serif font token and request the page flip Sound_Effect.
5. WHEN the user selects a different Section, THE Article_Viewer SHALL replace the displayed Section and reset its scroll position to the top.
6. IF the selected `section_id` does not exist in the open disc, THEN THE Article_Viewer SHALL display a not-found message and keep the previous navigation state.

### Requirement 11: SVG Hotspot Viewer

**User Story:** As a user, I want to click parts of a diagram to learn about them, so that illustrations connect to the articles.

#### Acceptance Criteria

1. THE Hotspot_Viewer SHALL render the Diagram shapes in an SVG element with viewBox `0 0 100 100`.
2. THE Hotspot_Viewer SHALL render each Hotspot at its `(x, y)` percent coordinates as a focusable, labeled control.
3. WHEN the pointer rests on or keyboard focus enters a Hotspot, THE Hotspot_Viewer SHALL display the Hotspot label in a Tooltip.
4. WHEN the user activates a Hotspot, THE Hotspot_Viewer SHALL navigate to the Section referenced by the Hotspot `section_id` in the Article_Viewer and request the page flip Sound_Effect.

### Requirement 12: KeepMaze Dungeon and Trivia Gameplay

**User Story:** As a player, I want to explore a dungeon and answer trivia to unlock doors, so that learning the disc content is a game.

#### Acceptance Criteria

1. WHEN the user starts a Dungeon, THE KeepMaze_UI SHALL place the player in the Entrance and display the Room name, description, and available Exits in a HUD using the sans-serif font token.
2. WHEN the player selects an Exit, THE KeepMaze_UI SHALL present a Trivia_Question from the disc that the player must answer to unlock that Exit, and request the KeepMaze torch Sound_Effect on room entry.
3. WHEN the player selects the correct answer, THE KeepMaze_UI SHALL request the door unlock Sound_Effect and move the player to the destination Room.
4. IF the player selects an incorrect answer, THEN THE KeepMaze_UI SHALL keep the player in the current Room, display the title of the cited Section, and offer a link that opens that Section in the Article_Viewer.
5. WHEN the player enters the Throne_Room, THE KeepMaze_UI SHALL display a victory message with the number of moves taken and the number of incorrect answers.
6. WHEN the player activates the restart control, THE KeepMaze_UI SHALL return the player to the Entrance and reset the move and incorrect-answer counts to 0.
7. THE KeepMaze_UI SHALL present Trivia_Questions in an order that avoids repeating a question until all questions of the disc have been presented.
8. WHEN the player selects an Exit, THE KeepMaze_UI SHALL draw exactly one Trivia_Question for that selection, and the Exit SHALL remain locked until that question is answered correctly.
9. WHEN the player selects an incorrect answer, THE KeepMaze_UI SHALL close the question without counting a move, and selecting the same Exit again SHALL draw the next question in the order defined by criterion 7.
10. THE KeepMaze_UI SHALL count a move only when the player passes through an Exit after a correct answer.
11. WHEN all Trivia_Questions of the disc have been presented, THE KeepMaze_UI SHALL start a new cycle through them, so a disc with fewer questions than Exits remains playable.
12. IF the disc has no Trivia_Questions, THEN THE KeepMaze_UI SHALL disable the start control and display a message that the dungeon needs trivia questions.

### Requirement 13: Procedural Audio Module

**User Story:** As a user, I want period-appropriate sound feedback without audio files, so that the App feels authentic and loads quickly.

#### Acceptance Criteria

1. THE Audio_Module SHALL synthesize the disc spin-up, bevel button click, page flip, KeepMaze torch, and door unlock Sound_Effects using the WebAudio API.
2. THE Audio_Module SHALL load no external audio files and make no network requests for audio.
3. THE Audio_Module SHALL create the AudioContext only upon the first request to play a Sound_Effect that follows a user gesture.
4. IF the AudioContext is in the suspended state when a Sound_Effect is requested after a user gesture, THEN THE Audio_Module SHALL resume the AudioContext before playing the Sound_Effect.
5. IF the WebAudio API is unavailable in the browser, THEN THE Audio_Module SHALL ignore Sound_Effect requests without raising an error.
6. THE Audio_Module SHALL be the only module in the App that constructs an AudioContext or oscillator nodes.
7. WHILE the Mute_Toggle is enabled, THE Audio_Module SHALL produce no sound for any Sound_Effect request.
8. WHEN the user activates the Mute_Toggle, THE Audio_Module SHALL switch between muted and unmuted states and the App SHALL display the current state in a control reachable from every screen.
9. WHEN the Mute_Toggle is enabled during playback of a Sound_Effect, THE Audio_Module SHALL silence that Sound_Effect within 50 ms.
10. THE Audio_Module SHALL expose a function for each Sound_Effect so that components call the Audio_Module and construct no audio nodes themselves.
11. THE Audio_Module SHALL start each App session unmuted, and THE App SHALL NOT persist the mute state across page reloads.
12. WHEN the Mute_Toggle is enabled during playback, THE Audio_Module SHALL set master gain to 0 and stop all active nodes synchronously, which satisfies the 50 ms limit of criterion 9 and can be verified without timing measurement.
