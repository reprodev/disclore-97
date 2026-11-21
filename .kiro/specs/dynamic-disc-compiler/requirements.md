# Requirements Document

## Introduction

This is Spec #2 of DiscLore '97 (Spec #1 is `disclore-97-core`). It lets a user paste a GitHub repository URL, a webpage URL, or a topic or Markdown text into a Win95 "Burn New CD-R Disc..." dialog and compile the content into a playable Expansion Pack. The Expansion Pack is a `DiscManifest` that follows `.kiro/steering/disclore-97-design-system.md`.

The feature has four parts:

1. A pure, deterministic Disc_Compiler in `src/model/compiler.ts` that turns normalized Source_Content into a `DiscManifest`.
2. Three input adapters: GitHub REST API (browser, no token), an optional Cloudflare Pages Function at `functions/api/extract.ts` for general webpages, and an instant client-side Markdown/topic fallback.
3. A gate that passes every compiled disc through `validateManifest` via `loadDisc` before mounting.
4. A Win95 Burn_Dialog reachable from the Home screen, the File menu, and the Load Disc dialog.

All fetched third-party text is untrusted data. The App never renders it as HTML, and it is sanitized, truncated, and attributed. The Pages Function is optional, so the App still works as pure static assets. All Spec #1 requirements remain in force: the existing 24 test files and 111 tests, `npm run build`, and `npm run lint` stay green.

## Glossary

- **App**: The DiscLore '97 single-page web application (Vite, TypeScript, React).
- **DiscManifest**: The typed disc structure from `src/model/manifest.ts`, as defined by `disclore-97-core`.
- **Manifest_Validator**: The existing `validateManifest` function in `src/model/validate.ts`.
- **Disc_Loader**: The existing `loadDisc(source, prebaked)` function in `src/discs/loader.ts`.
- **Maze_Solver**: The existing `solveDungeon` BFS function in `src/model/solver.ts`.
- **Design_Tokens**: The single shared set of CSS custom properties in `src/styles/tokens.css`.
- **Source_Content**: The normalized, plain-text input to the Disc_Compiler: a `title`, a list of `headings`, a list of `paragraphs`, and `metadata` (source kind, source URL or label, optional description, optional language list, optional author or owner).
- **Source_Kind**: One of `github`, `webpage`, `markdown`, or `topic`.
- **Disc_Compiler**: The pure module `src/model/compiler.ts` that converts Source_Content into a DiscManifest. It performs no I/O, reads no clock, and uses no randomness.
- **Compile_Result**: The Disc_Compiler output, a DiscManifest produced by a successful compile.
- **Input_Parser**: The pure function that classifies the user's input string as a GitHub repo URL, a webpage URL, Markdown, or a topic, and extracts its parts.
- **GitHub_Adapter**: The client-side adapter that builds Source_Content from the public GitHub REST API (repository info, README, and languages).
- **Extract_Function**: The optional Cloudflare Pages Function at `functions/api/extract.ts` that fetches a webpage server-side and returns extracted title, headings, and paragraphs as JSON.
- **Webpage_Adapter**: The client-side adapter that calls the Extract_Function and builds Source_Content from its response.
- **Fallback_Adapter**: The client-side adapter that builds Source_Content from Markdown or topic text with no network access.
- **HTML_Extractor**: The pure function used by the Extract_Function that strips an HTML string to a title, headings, and paragraphs.
- **SSRF_Guard**: The pure function used by the Extract_Function that decides whether a target URL or resolved address is permitted.
- **Burn_Dialog**: The Win95 modal titled "Burn New CD-R Disc..." in which the user enters a source and starts a burn.
- **Burn**: The end-to-end operation of parsing input, fetching Source_Content, compiling, validating, and mounting a disc.
- **Burn_Progress**: The Burn_Dialog state that shows the text "Burning CD-R at 4x..." and a progress indicator while a Burn is running.
- **Preset**: A built-in sample input (a GitHub repository URL or a topic) that the user can select in the Burn_Dialog.
- **Disc_Library**: The optional `localStorage` store of compiled DiscManifests.
- **Home_Launcher**: The existing DiscLore '97 Home screen (`HomeLauncher`).
- **Load_Disc_Dialog**: The existing Load Disc modal (`LoadDiscDialog`).
- **Menu_Bar**: The existing File/Help menu bar component.
- **Test_Suite**: The Vitest tests, including fast-check property-based tests.

## Requirements

### Requirement 1: Input Classification and URL Parsing

**User Story:** As a user, I want to paste any URL, Markdown, or topic into one box, so that the App picks the correct way to build my disc.

#### Acceptance Criteria

1. WHEN the user input matches `https://github.com/{owner}/{repo}` with an optional trailing slash, `.git` suffix, `www.` prefix, or sub-path, THE Input_Parser SHALL classify the input as Source_Kind `github` and return the `owner` and `repo` values.
2. WHEN the user input is a single `http` or `https` URL that is not a GitHub repository URL, THE Input_Parser SHALL classify the input as Source_Kind `webpage` and return the normalized URL.
3. WHEN the user input contains a Markdown heading line starting with `#` or spans more than one line, THE Input_Parser SHALL classify the input as Source_Kind `markdown`.
4. WHEN the user input is a single line of plain text that is not a URL, THE Input_Parser SHALL classify the input as Source_Kind `topic`.
5. IF the user input is empty or contains only whitespace, THEN THE Input_Parser SHALL return an `empty-input` error.
6. IF the user input starts with a scheme other than `http` or `https`, THEN THE Input_Parser SHALL return an `unsupported-scheme` error.
7. IF the user input exceeds 20000 characters, THEN THE Input_Parser SHALL return an `input-too-long` error.
8. IF a GitHub `owner` or `repo` segment contains a character outside letters, digits, `-`, `_`, and `.`, THEN THE Input_Parser SHALL return an `invalid-github-url` error.
9. THE Input_Parser SHALL trim leading and trailing whitespace from the user input before classification.
10. THE Input_Parser SHALL be a pure function that performs no network access.

### Requirement 2: Disc Compiler Output Structure

**User Story:** As a user, I want every compiled disc to be a full Expansion Pack, so that it feels like the pre-baked discs.

#### Acceptance Criteria

1. WHEN Source_Content is passed to the Disc_Compiler, THE Disc_Compiler SHALL return a DiscManifest containing a `disc_id`, a `title`, a `tagline`, at least 5 Sections, at least 1 Diagram, at least 5 Trivia_Questions, and at least 1 Dungeon.
2. THE Disc_Compiler SHALL give each Section a `title` and a non-empty list of paragraph strings.
3. THE Disc_Compiler SHALL give each Section a `facts` list with at least 1 entry and a `timeline` list with at least 1 entry.
4. THE Disc_Compiler SHALL give each Section a `plate` key.
5. WHEN Source_Content contains fewer than 5 usable headings or paragraphs, THE Disc_Compiler SHALL create additional Sections from the title, metadata, and a deterministic set of template Sections so the DiscManifest still contains at least 5 Sections.
6. WHEN Source_Content contains more than 12 usable headings, THE Disc_Compiler SHALL create at most 12 Sections.
7. THE Disc_Compiler SHALL derive the `disc_id` from the Source_Kind and a slug of the source identity, using only lowercase letters, digits, and `-`, with a maximum length of 48 characters.
8. THE Disc_Compiler SHALL set the `title` to a string of 1 to 80 characters and the `tagline` to a string of 1 to 140 characters.
9. THE Disc_Compiler SHALL produce Section identifiers, Diagram identifiers, Trivia_Question identifiers, Dungeon identifiers, and Room identifiers that are unique within their scopes.
10. THE Disc_Compiler SHALL be a pure, deterministic function, so that equal Source_Content values produce deep-equal DiscManifests.
11. THE Disc_Compiler SHALL accept any Source_Content value whose fields satisfy the type constraints, including empty lists and empty strings, and return a DiscManifest without throwing.
12. THE Disc_Compiler SHALL attribute the source by including, in at least 1 Section paragraph, the Source_Kind and the source URL or label from the metadata.

### Requirement 3: Compiled Diagram and Hotspots

**User Story:** As a user, I want a colorful diagram with clickable hotspots on my compiled disc, so that I can jump into the articles from an illustration.

#### Acceptance Criteria

1. THE Disc_Compiler SHALL produce at least 1 Diagram with `viewBox` equal to `0 0 100 100` and at least 3 shapes.
2. THE Disc_Compiler SHALL produce each Diagram with at least 3 Hotspots.
3. THE Disc_Compiler SHALL set the `x` and `y` of every Hotspot to a finite number from 0 to 100 inclusive.
4. THE Disc_Compiler SHALL set the `section_id` of every Hotspot to the `section_id` of a Section in the same DiscManifest.
5. THE Disc_Compiler SHALL set every shape `fill` and `stroke` value to `none`, `currentColor`, or a `var(--color-...)` reference to a color defined in Design_Tokens.
6. THE Disc_Compiler SHALL use at least 3 distinct `var(--color-...)` references across the shapes of each Diagram.
7. THE Disc_Compiler SHALL give each Hotspot a `label` of 1 to 40 characters.
8. THE Disc_Compiler SHALL emit no hex color literal in any shape.
9. WHEN a Diagram has more Hotspots than Sections, THE Disc_Compiler SHALL reference Sections in a repeating order so every Hotspot still references an existing Section.

### Requirement 4: Compiled Trivia

**User Story:** As a player, I want trivia questions drawn from my disc's own articles, so that the game teaches the content.

#### Acceptance Criteria

1. THE Disc_Compiler SHALL produce at least 5 Trivia_Questions.
2. THE Disc_Compiler SHALL set the `section_id` of every Trivia_Question to the `section_id` of a Section in the same DiscManifest.
3. THE Disc_Compiler SHALL give each Trivia_Question between 3 and 4 answer options, all distinct after trimming.
4. THE Disc_Compiler SHALL set the `correct_index` of every Trivia_Question to an integer from 0 to the number of options minus 1.
5. THE Disc_Compiler SHALL derive the correct answer of each Trivia_Question from text of the cited Section.
6. THE Disc_Compiler SHALL cite at least 3 distinct Sections across the Trivia_Questions of one DiscManifest.
7. THE Disc_Compiler SHALL vary the position of the correct option across the Trivia_Questions by a deterministic rule derived from the Source_Content, with no use of randomness or the clock.
8. THE Disc_Compiler SHALL give each Trivia_Question a `prompt` of 1 to 200 characters and each option 1 to 120 characters.

### Requirement 5: Compiled KeepMaze Dungeon

**User Story:** As a player, I want every compiled dungeon to be winnable, so that I am never stuck in a broken maze.

#### Acceptance Criteria

1. THE Disc_Compiler SHALL produce at least 1 Dungeon with at least 8 Rooms.
2. THE Disc_Compiler SHALL include in each Dungeon exactly one Room with `room_id` `entrance` and exactly one Room with `room_id` `throne_room`.
3. THE Disc_Compiler SHALL produce each Dungeon such that the Maze_Solver returns a non-empty shortest path from `entrance` to `throne_room`.
4. THE Disc_Compiler SHALL produce each Dungeon such that the Maze_Solver returns zero Orphan_Rooms.
5. THE Disc_Compiler SHALL give every Exit a destination `room_id` that exists in the same Dungeon.
6. THE Disc_Compiler SHALL give every Room a `name` and a `description` that each contain at least 1 character and relate to the disc subject by including a word or phrase from the Source_Content title or from a Section title.
7. THE Disc_Compiler SHALL give every Room other than `throne_room` at least 1 Exit.
8. THE Disc_Compiler SHALL produce the same Dungeon structure for equal Source_Content values.

### Requirement 6: Compiler Output Validity Guarantee

**User Story:** As a maintainer, I want the compiler to always produce a disc that validates, so that no user input can mount a broken disc.

#### Acceptance Criteria

1. FOR ALL Source_Content values, THE Disc_Compiler SHALL return a DiscManifest for which the Manifest_Validator returns `ok: true` and zero errors.
2. WHEN a Burn produces a DiscManifest, THE App SHALL pass the DiscManifest to the Disc_Loader with the `prebaked` argument set to `false` before mounting.
3. IF the Disc_Loader returns `ok: false` for a compiled DiscManifest, THEN THE App SHALL keep the previous disc open, SHALL NOT mount the compiled disc, and SHALL display the list of validation errors in the Burn_Dialog.
4. THE Disc_Compiler SHALL output a DiscManifest that is a JSON-compatible value with no `undefined` property values, so that serializing to JSON, parsing, and validating produces a DiscManifest deep-equal to the original (round-trip property).
5. THE Disc_Compiler SHALL be imported by the App and the Test_Suite from the single module `src/model/compiler.ts`.
6. THE Disc_Compiler SHALL import no module from `src/components`, no React module, and no browser global.

### Requirement 7: Text Sanitization and Untrusted Content Handling

**User Story:** As a user, I want text from the web to be treated as untrusted, so that a hostile page or repository cannot attack me through my disc.

#### Acceptance Criteria

1. THE Disc_Compiler SHALL strip HTML tags and control characters other than newline and tab from every Source_Content string before placing the string in a DiscManifest.
2. THE Disc_Compiler SHALL collapse runs of whitespace in single-line fields to one space.
3. THE Disc_Compiler SHALL truncate each paragraph to at most 1200 characters, each heading and title to at most 120 characters, and the DiscManifest to at most 12 Sections and 8 paragraphs per Section.
4. THE App SHALL render every compiled DiscManifest string as React text content and SHALL NOT use `dangerouslySetInnerHTML` or `innerHTML` anywhere in the App.
5. THE Disc_Compiler SHALL emit shape geometry as numbers and color values only from the permitted set in Requirement 3, so no text from Source_Content appears in any SVG attribute.
6. WHEN Source_Content text contains the sequences `<script`, `javascript:`, or `onerror=`, THE Disc_Compiler SHALL produce a DiscManifest whose strings contain no HTML tag.
7. THE Disc_Compiler SHALL include the source attribution of Requirement 2, criterion 12 in every compiled DiscManifest.
8. WHEN Source_Content text is a Markdown link or image, THE Disc_Compiler SHALL replace the link with its visible text and drop the image, so no remote image URL is retained in the DiscManifest.

### Requirement 8: GitHub Repository Adapter

**User Story:** As a user, I want to paste a GitHub repository URL and get a disc about that project, so that I can explore a repository as an encyclopedia.

#### Acceptance Criteria

1. WHEN the Input_Parser classifies an input as `github`, THE GitHub_Adapter SHALL request repository info, the README, and the language breakdown from the public GitHub REST API at `https://api.github.com` directly from the browser.
2. THE GitHub_Adapter SHALL send no `Authorization` header and SHALL require no token, API key, or other secret.
3. THE GitHub_Adapter SHALL build Source_Content from the repository name, description, topics, license name, star count, default branch, primary language, language list, and README text, with the README headings and paragraphs as the Source_Content headings and paragraphs.
4. THE GitHub_Adapter SHALL request the README as text and SHALL NOT fetch any image or other asset referenced by the README.
5. THE GitHub_Adapter SHALL set the Source_Content metadata to Source_Kind `github` and the repository URL `https://github.com/{owner}/{repo}`.
6. IF the repository info request returns HTTP 404, THEN THE GitHub_Adapter SHALL return a `repo-not-found` error.
7. IF the GitHub API responds with HTTP 403 or 429 or with an exhausted rate-limit header, THEN THE GitHub_Adapter SHALL return a `rate-limited` error.
8. IF the README request fails or returns HTTP 404 while the repository info request succeeds, THEN THE GitHub_Adapter SHALL build Source_Content from the repository info and language list alone.
9. IF a GitHub API request does not complete within 8000 ms, THEN THE GitHub_Adapter SHALL abort the request and return a `timeout` error.
10. IF a network failure occurs during a GitHub API request, THEN THE GitHub_Adapter SHALL return a `network` error.
11. THE GitHub_Adapter SHALL accept a injectable `fetch` function, so that the Test_Suite can exercise the adapter without network access.
12. THE GitHub_Adapter SHALL truncate the README text to at most 100000 characters before extraction.

### Requirement 9: Webpage Extract Function

**User Story:** As a user, I want to paste an ordinary webpage URL, so that I can turn an article into a disc when the optional server function is deployed.

#### Acceptance Criteria

1. WHEN the Extract_Function receives a `GET` request with a `url` query parameter that the SSRF_Guard permits, THE Extract_Function SHALL fetch the page server-side and respond with JSON containing `title`, `headings`, `paragraphs`, and the final `url`.
2. THE HTML_Extractor SHALL return the contents of the `<title>` element, the text of `h1` to `h3` elements, and the text of `p` elements, with all tags and entities decoded to plain text.
3. THE HTML_Extractor SHALL discard the contents of `script`, `style`, `noscript`, `template`, `svg`, `iframe`, and HTML comment nodes.
4. THE HTML_Extractor SHALL limit its output to at most 12 headings and 40 paragraphs, with each string at most 1200 characters.
5. THE HTML_Extractor SHALL return empty lists, and no error, for HTML that contains no title, headings, or paragraphs.
6. THE Extract_Function SHALL limit the fetched response body to 1 MiB and the upstream request to 8000 ms.
7. THE Extract_Function SHALL accept only upstream responses with a `text/html` or `application/xhtml+xml` content type.
8. IF the Extract_Function receives a request without a `url` parameter, THEN THE Extract_Function SHALL respond with HTTP 400 and a JSON error body.
9. IF the upstream request fails, times out, exceeds the size limit, or returns an unsupported content type, THEN THE Extract_Function SHALL respond with HTTP 502, 504, or 415 respectively and a JSON error body.
10. THE Extract_Function SHALL respond to non-`GET` requests with HTTP 405.
11. THE Extract_Function SHALL contain no API key, token, or private URL, and SHALL read any configuration only from Cloudflare environment bindings.
12. THE Extract_Function SHALL send a descriptive `User-Agent` header and SHALL forward no cookies or credentials from the incoming request.
13. THE Extract_Function SHALL be an optional part of the deployment, and THE App SHALL build with `npm run build` and run all non-webpage features without the Extract_Function being present.

### Requirement 10: SSRF Protection

**User Story:** As an operator of the Pages Function, I want requests to internal addresses blocked, so that the function cannot be used to probe private networks.

#### Acceptance Criteria

1. IF the target URL scheme is not `http` or `https`, THEN THE SSRF_Guard SHALL reject the URL.
2. IF the target URL host is `localhost`, ends in `.localhost`, `.local`, or `.internal`, or has no dot and is not an IP literal, THEN THE SSRF_Guard SHALL reject the URL.
3. IF the target URL host is an IPv4 literal in `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, or `224.0.0.0/4`, or equals `255.255.255.255`, THEN THE SSRF_Guard SHALL reject the URL.
4. IF the target URL host is an IPv6 literal that is the unspecified address `::`, the loopback address `::1`, in `fc00::/7`, in `fe80::/10`, or an IPv4-mapped address whose embedded IPv4 address is rejected by criterion 3, THEN THE SSRF_Guard SHALL reject the URL.
5. IF the target URL host is written as a decimal, octal, hexadecimal, or shortened IPv4 form that resolves to an address rejected by criterion 3, THEN THE SSRF_Guard SHALL reject the URL.
6. IF the target URL contains a username or password component, THEN THE SSRF_Guard SHALL reject the URL.
7. IF the target URL port is present and is not 80 or 443, THEN THE SSRF_Guard SHALL reject the URL.
8. WHEN the upstream response is an HTTP redirect, THE Extract_Function SHALL pass the `Location` target through the SSRF_Guard before following it, and SHALL follow at most 3 redirects.
9. IF a redirect target is rejected by the SSRF_Guard, THEN THE Extract_Function SHALL stop and respond with HTTP 403 and a JSON error body.
10. IF the SSRF_Guard rejects the initial target URL, THEN THE Extract_Function SHALL respond with HTTP 403 and a JSON error body that names the rejection reason without echoing any response content from the target.
11. THE SSRF_Guard SHALL be a pure function that performs no network access, so the Test_Suite can test it directly.
12. THE SSRF_Guard SHALL permit a public hostname with a scheme of `http` or `https` and a port of 80 or 443.

### Requirement 11: Markdown and Topic Fallback Adapter

**User Story:** As a user, I want a disc even when I am offline or a fetch fails, so that burning a disc never depends on the network.

#### Acceptance Criteria

1. WHEN the Input_Parser classifies an input as `markdown`, THE Fallback_Adapter SHALL build Source_Content by reading headings from `#` to `###` lines and paragraphs from blank-line-separated text blocks, with no network access.
2. WHEN the Input_Parser classifies an input as `topic`, THE Fallback_Adapter SHALL build Source_Content from the topic text as the title and a deterministic set of template headings and paragraphs about the topic, with no network access.
3. WHEN a GitHub_Adapter or Webpage_Adapter request fails with a `network`, `timeout`, `rate-limited`, `repo-not-found`, `unavailable`, or `fetch-failed` error, THE Burn_Dialog SHALL offer a control to burn a disc from the Fallback_Adapter using the repository name or page hostname as the topic.
4. WHILE the browser reports that it is offline, THE Burn_Dialog SHALL burn `markdown` and `topic` inputs through the Fallback_Adapter and SHALL show a message that URL sources need a connection.
5. THE Fallback_Adapter SHALL complete within 50 ms for an input of 20000 characters.
6. THE Fallback_Adapter SHALL ignore fenced code blocks, HTML blocks, and Markdown images when it reads paragraphs.
7. FOR ALL Markdown inputs, THE Fallback_Adapter followed by the Disc_Compiler SHALL produce a DiscManifest that passes the Manifest_Validator with zero errors.

### Requirement 12: Webpage Adapter Client

**User Story:** As a user, I want the App to use the Extract_Function when it exists and explain clearly when it does not, so that static-only deployments still behave sensibly.

#### Acceptance Criteria

1. WHEN the Input_Parser classifies an input as `webpage`, THE Webpage_Adapter SHALL request `/api/extract?url={encoded URL}` from the same origin as the App.
2. WHEN the Extract_Function responds with HTTP 200 and valid JSON, THE Webpage_Adapter SHALL build Source_Content with Source_Kind `webpage` and the final `url` as the source.
3. IF the request to `/api/extract` returns HTTP 404 or a response that is not JSON, THEN THE Webpage_Adapter SHALL return an `unavailable` error.
4. IF the Extract_Function responds with an error status and JSON error body, THEN THE Webpage_Adapter SHALL return a `fetch-failed` error carrying the error message from the body.
5. IF the request does not complete within 12000 ms, THEN THE Webpage_Adapter SHALL abort the request and return a `timeout` error.
6. THE Webpage_Adapter SHALL validate that the response JSON has string `title`, string-list `headings`, and string-list `paragraphs` fields before building Source_Content, and SHALL return a `fetch-failed` error for any other shape.
7. THE Webpage_Adapter SHALL accept an injectable `fetch` function, so that the Test_Suite can exercise the adapter without network access.

### Requirement 13: Burn Dialog Interface

**User Story:** As a user, I want a Win95 "Burn New CD-R Disc..." dialog, so that burning a disc feels like a 1997 desktop task.

#### Acceptance Criteria

1. THE Burn_Dialog SHALL be a modal Window titled "Burn New CD-R Disc..." built from the Win95_Components of Spec #1, with a multi-line text input labeled for URL, topic, or Markdown, a Preset list, a "Burn" BevelButton, and a "Cancel" BevelButton.
2. WHEN the user activates the "Burn New Disc..." item in the File menu of the Menu_Bar, THE App SHALL open the Burn_Dialog.
3. WHEN the user activates the burn control on the Home_Launcher, THE App SHALL open the Burn_Dialog.
4. WHEN the user activates a "Burn New Disc..." button in the Load_Disc_Dialog, THE App SHALL close the Load_Disc_Dialog and open the Burn_Dialog.
5. THE Burn_Dialog SHALL list at least 2 Presets that are GitHub repository URLs and at least 2 Presets that are topics.
6. WHEN the user selects a Preset, THE Burn_Dialog SHALL place the Preset text in the input.
7. WHILE the input is empty or whitespace, THE Burn_Dialog SHALL disable the "Burn" button.
8. WHEN the user activates the "Burn" button, THE Burn_Dialog SHALL enter the Burn_Progress state and start a Burn.
9. WHILE a Burn is running, THE Burn_Dialog SHALL display the text "Burning CD-R at 4x..." and a progress indicator, and SHALL disable the input, the Presets, and the "Burn" button.
10. WHILE a Burn is running, THE Burn_Dialog SHALL keep the "Cancel" button enabled, and WHEN the user activates it, THE Burn_Dialog SHALL abort the pending requests and close without mounting a disc.
11. WHEN a Burn succeeds, THE App SHALL close the Burn_Dialog, mount the compiled disc in the open disc window, and request the disc spin-up Sound_Effect from the Audio_Module.
12. WHEN the user presses the Escape key in the Burn_Dialog, THE Burn_Dialog SHALL behave as if the user activated "Cancel".
13. WHILE the Burn_Dialog is open, THE Burn_Dialog SHALL keep Tab focus inside the dialog and SHALL return focus to the previously focused element on close.
14. THE Burn_Dialog SHALL expose accessible roles and names for its input, buttons, Preset list, progress indicator, and error region, and SHALL announce the progress and error states in a live region.
15. WHEN the user activates a Burn_Dialog BevelButton, THE Burn_Dialog SHALL request the button click Sound_Effect through the Audio_Module and SHALL construct no audio nodes itself.
16. THE Burn_Dialog SHALL be operable by keyboard alone.

### Requirement 14: Error Handling and Messages

**User Story:** As a user, I want clear errors, so that I know what went wrong and what to do next.

#### Acceptance Criteria

1. IF a Burn fails with any error, THEN THE Burn_Dialog SHALL leave the Burn_Progress state, keep the input text, keep the previous disc open, and display the error message in an error region.
2. THE Burn_Dialog SHALL display a message in plain English for each error code `empty-input`, `unsupported-scheme`, `input-too-long`, `invalid-github-url`, `repo-not-found`, `rate-limited`, `timeout`, `network`, `unavailable`, `fetch-failed`, `validation-failed`, and `cancelled`.
3. WHEN a Burn fails with an error that has a Fallback_Adapter option, THE Burn_Dialog SHALL display the offline burn control described in Requirement 11, criterion 3.
4. IF the Burn fails with `validation-failed`, THEN THE Burn_Dialog SHALL display each validation error path and message.
5. IF an unexpected exception occurs in any adapter or in the Disc_Compiler during a Burn, THEN THE App SHALL catch the exception, display a `validation-failed` or `fetch-failed` message in the Burn_Dialog, and SHALL NOT crash or unmount the open disc.
6. THE Burn_Dialog SHALL NOT display raw response bodies, stack traces, or HTML from a third-party source.
7. WHEN the user edits the input after an error, THE Burn_Dialog SHALL clear the error region.

### Requirement 15: Optional Disc Library Persistence

**User Story:** As a user, I want to keep the discs I burned, so that I can reload them after refreshing the page.

#### Acceptance Criteria

1. WHERE `localStorage` is available, WHEN a Burn succeeds, THE Disc_Library SHALL store the compiled DiscManifest as JSON under a key prefixed `disclore97.disc.`.
2. WHERE `localStorage` is available, THE Disc_Library SHALL keep at most 10 stored discs and SHALL remove the oldest stored disc when an 11th is stored.
3. WHERE `localStorage` is available, WHEN the App starts, THE App SHALL pass every stored DiscManifest through the Disc_Loader with `prebaked` set to `false` and SHALL list the discs that pass in the Load_Disc_Dialog.
4. IF a stored value is not valid JSON or fails the Manifest_Validator, THEN THE Disc_Library SHALL skip that value, SHALL remove it from storage, and SHALL NOT show it in the Load_Disc_Dialog.
5. IF `localStorage` is unavailable or throws, including on quota exceeded, THEN THE App SHALL continue to mount the compiled disc for the session and SHALL display a message that the disc was not saved.
6. WHERE `localStorage` is available, THE Load_Disc_Dialog SHALL provide a control to remove a stored disc, and WHEN the user activates the control, THE Disc_Library SHALL delete that disc from storage.
7. THE Disc_Library SHALL store only compiled DiscManifests and SHALL store no user credentials or tokens.
8. FOR ALL stored DiscManifests, writing to and reading from the Disc_Library SHALL produce a DiscManifest deep-equal to the original (round-trip property).
9. IF a compiled disc has the same `disc_id` as a stored disc, THEN THE Disc_Library SHALL replace the stored disc.
10. IF a compiled `disc_id` equals the `disc_id` of a pre-baked disc, THEN THE Disc_Compiler SHALL NOT produce that `disc_id`, because the Disc_Compiler prefixes every `disc_id` with its Source_Kind.

### Requirement 16: Steering and Design System Compliance

**User Story:** As a maintainer, I want the new feature to obey the steering rules, so that it fits the Win95 look and the repository stays clean.

#### Acceptance Criteria

1. THE Burn_Dialog stylesheet SHALL declare no hex color literal, and SHALL take every color and font from the Design_Tokens.
2. THE Burn_Dialog stylesheet SHALL use a border-radius of 0, no gradient fill, no `backdrop-filter`, and no `box-shadow` with a blur radius greater than 0.
3. THE Burn_Dialog SHALL use the serif font token for compiled disc text and the sans-serif font token for dialog controls and Burn_Progress text.
4. WHERE the Burn_Progress indicator is drawn, THE Burn_Dialog SHALL draw it as flat blocks with CSS borders and token colors, and SHALL use no image files.
5. THE App SHALL declare as runtime dependencies only `react` and `react-dom`, and THE feature SHALL add no runtime dependency.
6. THE feature SHALL load no external image, audio, font, or script resource.
7. THE feature SHALL commit no API key, token, secret, `.env` file, or private URL.
8. THE feature SHALL contain no copyrighted assets, and every Preset and template text SHALL be original text.
9. WHEN the Burn_Dialog requests a sound, THE Burn_Dialog SHALL use the Audio_Module, and WHILE the Mute_Toggle is enabled, THE Burn_Dialog SHALL produce no sound.
10. THE App SHALL keep the `LICENSE` file as MIT at the repository root.

### Requirement 17: Automated Tests

**User Story:** As a maintainer, I want tests that prove the compiler cannot emit an invalid disc, so that changes cannot silently break the guarantee.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a fast-check generator for Source_Content values in `tests/generators.ts` that covers empty lists, empty strings, very long strings, Unicode text, HTML-like text, Markdown-like text, and duplicate headings.
2. THE Test_Suite SHALL include a fast-check property test that runs at least 100 generated Source_Content cases and asserts that the Disc_Compiler output passes the Manifest_Validator with zero errors.
3. THE Test_Suite SHALL include a fast-check property test that runs at least 100 generated topic strings through the Input_Parser, the Fallback_Adapter, and the Disc_Compiler and asserts a valid DiscManifest.
4. THE Test_Suite SHALL include a property test asserting that every compiled DiscManifest has at least 5 Sections, at least 1 Diagram with at least 3 Hotspots, at least 5 Trivia_Questions, and at least 1 Dungeon with at least 8 Rooms.
5. THE Test_Suite SHALL include a property test asserting that every compiled Hotspot coordinate is within 0 to 100 and references an existing `section_id`, and that every compiled Trivia_Question cites an existing `section_id`.
6. THE Test_Suite SHALL include a property test asserting that for every compiled Dungeon the Maze_Solver finds a path from `entrance` to `throne_room` and returns zero Orphan_Rooms.
7. THE Test_Suite SHALL include a property test asserting that equal Source_Content values produce deep-equal DiscManifests (determinism).
8. THE Test_Suite SHALL include a property test asserting that no string in a compiled DiscManifest contains an HTML tag for generated inputs that contain HTML-like text.
9. THE Test_Suite SHALL include the JSON round-trip property of Requirement 6, criterion 4.
10. THE Test_Suite SHALL include unit tests for the Input_Parser covering each Source_Kind and each error code of Requirement 1.
11. THE Test_Suite SHALL include unit tests for the HTML_Extractor covering title, headings, paragraphs, entity decoding, discarded elements, limits, and HTML with no extractable content.
12. THE Test_Suite SHALL include unit tests for the SSRF_Guard covering `localhost`, each private IPv4 range, IPv6 loopback and unique-local addresses, IPv4-mapped IPv6 addresses, decimal, octal, and hexadecimal IPv4 forms, URL credentials, disallowed ports, disallowed schemes, and a permitted public hostname.
13. THE Test_Suite SHALL include a property test asserting that the SSRF_Guard rejects every generated IPv4 address within a blocked range.
14. THE Test_Suite SHALL include unit tests for the GitHub_Adapter and the Webpage_Adapter using an injected `fetch` that cover success, `repo-not-found`, `rate-limited`, `timeout`, `network`, and `unavailable` outcomes.
15. THE Test_Suite SHALL include unit tests for the Extract_Function handler covering the 400, 403, 405, and 200 responses with an injected upstream `fetch`.
16. THE Test_Suite SHALL include component tests for the Burn_Dialog covering the three entry points, Preset selection, the disabled "Burn" button on empty input, the "Burning CD-R at 4x..." state, a successful mount, an error display, and Cancel during a Burn.
17. THE Test_Suite SHALL include property or unit tests for the Disc_Library covering the round trip, the 10-disc limit, skipping corrupt entries, and a throwing `localStorage`.
18. THE Test_Suite SHALL run with no network access and SHALL make no real network request.
19. WHEN `npm test`, `npm run build`, and `npm run lint` run after this feature is added, THE App SHALL pass all three with the existing 24 test files and 111 tests still passing.
20. THE Test_Suite SHALL assert that the stylesheets added by this feature contain no hex color literal, no non-zero border-radius, no gradient, no `backdrop-filter`, and no blurred `box-shadow`.
