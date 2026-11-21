# Implementation Plan: Dynamic Disc Compiler

## Overview

The implementation language is TypeScript (React, Vite, Vitest, fast-check), as set in the design. Work proceeds from the pure core to the edges: model types and helpers (seeded PRNG, slug and id, sanitize and truncate), the compiler stages (sections, diagram, trivia, dungeon), `compileDisc`, then the input parser, the Markdown and topic fallback, the GitHub adapter, the HTML extractor, SSRF guard, handler and Pages Function, the webpage adapter, the burn orchestrator with the `loadDisc(manifest, false)` gate, the `localStorage` library, and finally the Burn dialog, its three entry points, App integration, compliance checks, and docs. Each step is used by the next, and App integration wires everything together last.

Visual rules from `.kiro/steering/disclore-97-design-system.md` apply to all new styling: hex values only in `tokens.css`, square corners, flat fills, no blurred shadows, gradients, or `backdrop-filter`. New `src/` code must not contain `#` followed by 3 to 8 hexadecimal characters (including in comments and HTML numeric entities), so the existing hex-literal scan stays green.

Property tests live under `tests/properties/` with one file per property (`dcNN-<name>.test.ts`). Each carries the comments `// Feature: dynamic-disc-compiler, Property N: <title>` and `// **Validates: Requirements ...**`, and runs at least 100 cases (200 for Properties 1 and 2). Tests of `ssrf`, `htmlExtract`, `handler`, `github`, `webpage`, and `burn` start with `// @vitest-environment node`. All tests run without network access.

## Tasks

- [x] 1. Add source types, pure helpers, and fast-check generators
  - [x] 1.1 Create `src/model/source.ts` and the `src/model/compile/` helpers
    - `source.ts`: export `SourceKind`, `SourceMetadata`, and `ExtractedSource`. Omit optional fields instead of setting them to `undefined`
    - `compile/prng.ts`: export `fnv1a32`, `mulberry32`, and `stream(seed, salt)` using integer arithmetic only
    - `compile/ids.ts`: export `slug`, `hash4`, and `discId(kind, identity)` so the id starts with its Source_Kind, matches `^(github|webpage|markdown|topic)(-[a-z0-9]+)+$`, and is at most 48 characters. Add section, diagram, trivia, dungeon, and room id helpers backed by counters
    - `compile/text.ts`: export `sanitizeLine(raw, max)`, `sanitizeParagraph`, `truncate`, and `stripMarkdownInline` following the design steps (Markdown images dropped, links reduced to visible text, repeated tag stripping, removal of every `<` and `>`, control, bidi, zero-width and lone-surrogate removal, whitespace collapse, truncation with a `…` marker that never exceeds `max`). Bound work by cutting input to `max * 8` first and use only linear regexes
    - Import nothing from React, `src/components`, or a browser global
    - _Requirements: 2.7, 2.9, 2.10, 6.5, 6.6, 7.1, 7.2, 7.3, 7.6, 7.8, 15.10_

  - [x] 1.2 Add fast-check source generators to `tests/generators.ts`
    - Append without changing existing exports: `arbText` variants (grapheme, binary Unicode, HTML-like, Markdown-like, whitespace runs, control characters, a 5000-character string), `arbExtractedSource`, `arbThinSource`, `arbHostileSource`, `arbMarkdown`, and `arbTopic`
    - `arbExtractedSource` covers all four kinds, empty strings, empty lists, duplicate headings drawn from a small pool, very long strings, and optional `description`, `languages`, `author`, and `facts`
    - `arbHostileSource` puts `<script>alert(1)</script>`, `javascript:`, `onerror=`, a Markdown image, a Markdown link, and control characters into every string
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 1.3 Add input, SSRF, HTML, and fetch generators in `tests/generators-io.ts`
    - `arbOwnerRepo` and `arbGithubUrl` (names from letters, digits, `-`, `_`, `.`, not only dots, with optional `www.`, `.git`, trailing slash, sub-path, query, fragment, and surrounding whitespace)
    - `arbBlockedIPv4` (pick a blocked range, then an address in it) with renderers for dotted, decimal, hexadecimal, octal, and short forms; `arbBlockedIPv6` (`fc00::/7`, `fe80::/10`, mapped blocked IPv4, `::`, `::1`); `arbPublicHost`
    - `arbHtmlDoc` (title, headings, paragraphs, inline noise tags, entity encoding, and unique marker text inside `script`, `style`, `noscript`, `template`, `svg`, `iframe`, and comments)
    - `arbWebpageJson` (`fc.jsonValue()` mixed with valid-shape objects) and `arbFetchBehavior` (resolve with status and JSON or text, reject with `Error`, or wait until aborted)
    - A helper that builds a base64 README payload wrapped at 60 columns
    - _Requirements: 17.3, 17.10, 17.11, 17.12, 17.13, 17.14, 17.15_

  - [x] 1.4 Write unit tests for the helpers and generators
    - Create `tests/compiler/helpers.test.ts`: `fnv1a32` and `mulberry32` give fixed known outputs and values in `[0, 1)`; `discId` handles empty identities, `C++` versus `C#`, case-insensitive repeats, and the 48-character limit; `sanitizeLine` handles `<scr<script>ipt>`, images, links, bidi characters, lone surrogates, and truncation inside a surrogate pair
    - Assert that `fc.sample(arbExtractedSource, 120)` returns at least 100 sources and that the samples include empty, long, and HTML-like inputs
    - _Requirements: 2.7, 7.1, 7.2, 7.3, 7.8, 17.1, 17.2_

- [x] 2. Implement the compiler stages
  - [x] 2.1 Implement section planning in `src/model/compile/sections.ts`
    - Plan 5 to 12 section titles from usable headings (case-insensitive dedupe) and the fixed template pool, split paragraphs proportionally with at most 8 per section, and add the attribution paragraph `Source ({kindLabel}): {label}` to section 0
    - Build 1 to 4 facts, a timeline of reading order, a `plate` key from the per-kind list that `Plate.tsx` defines, and the disc title and tagline (1 to 80 and 1 to 140 characters, never empty)
    - Return plain JSON values with no `undefined`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.12, 7.3, 7.7_

  - [x] 2.2 Implement the diagram stage in `src/model/compile/diagram.ts`
    - Build `diagram-1` with `viewBox` `0 0 100 100`, numeric shapes only, fills and strokes from `none`, `currentColor`, or the 12 allowed `var(--color-...)` tokens, at least 3 distinct tokens, and hotspots positioned from the `'diagram'` stream within `[15, 85]` by `[27, 81]`
    - Set hotspot `section_id` with `sections[i % N]` and labels of 1 to 40 characters. Export the `ALLOWED_TOKENS` list
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 7.5_

  - [x] 2.3 Implement the trivia stage in `src/model/compile/trivia.ts`
    - Produce `min(max(N, 5), 10)` questions that cite `sections[q % N]`, with 3 or 4 distinct options per question, statement and title forms, distractors from other sections, and the fixed `GENERIC_DISTRACTORS` fill
    - Place the correct option at `(offset + q) % count` so positions vary deterministically. Enforce prompt (1 to 200) and option (1 to 120) lengths
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 2.4 Implement the dungeon stage in `src/model/compile/dungeon.ts`
    - Build `R = clamp(N + 3, 8, 12)` rooms with exactly one `entrance` and one `throne_room`, a spanning tree rooted at `entrance` (at most 3 tree children per parent), a throne parent at depth 2 or more when possible, bounded extra loops, and dead-end repair so every room except `throne_room` has an exit
    - Name and describe rooms from section titles with the 6 original description templates
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 3. Compose `compileDisc` and prove its guarantees
  - [x] 3.1 Implement `src/model/compiler.ts`
    - Export `compileDisc(source)`, re-export `ExtractedSource`, `SourceKind`, `SourceMetadata`, `sanitizeLine`, `sanitizeParagraph`, and `ALLOWED_TOKENS`
    - Add `normalizeSource(unknown)` that coerces runtime garbage (non-arrays, non-strings, missing metadata), sanitizes, truncates, drops empties, dedupes headings, and builds the canonical seed string. Wire normalize, sections, diagram, trivia, dungeon, and assembly in the design order, with one independent PRNG stream per stage
    - Import only `source.ts`, `manifest.ts`, and `compile/*`. Do not import `validate.ts`, and use no `Math.random`, `Date`, or browser global
    - _Requirements: 2.1, 2.10, 2.11, 6.1, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 15.10_

  - [x] 3.2 Write property test for compiled discs always validating
    - Create `tests/properties/dc01-validity.test.ts` with `numRuns: 200`, using `arbExtractedSource`, `arbThinSource`, and `arbHostileSource` and the existing `validateManifest`
    - **Property 1: Compiled discs always validate**
    - **Validates: Requirements 2.11, 6.1, 17.2**

  - [x] 3.3 Write property test for structural minimums and limits
    - Create `tests/properties/dc02-structure.test.ts` with `numRuns: 200`
    - **Property 2: Structural minimums and limits**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 4.1, 5.1, 7.3, 17.4**

  - [x] 3.4 Write property test for disc id shape
    - Create `tests/properties/dc03-disc-id.test.ts` and compare against the ids of `castles` and `retro-dialup`
    - **Property 3: Disc id shape**
    - **Validates: Requirements 2.7, 15.10**

  - [x] 3.5 Write property test for determinism
    - Create `tests/properties/dc04-determinism.test.ts` comparing two compiles and a compile of a deep copy
    - **Property 4: Determinism**
    - **Validates: Requirements 2.10, 5.8, 17.7**

  - [x] 3.6 Write property test for the JSON round trip
    - Create `tests/properties/dc05-json-roundtrip.test.ts` with a deep scan for `undefined`
    - **Property 5: JSON round trip**
    - **Validates: Requirements 6.4, 17.9**

  - [x] 3.7 Write property test for diagram geometry, references, and colors
    - Create `tests/properties/dc06-diagram.test.ts`, loading defined color names from `src/styles/tokens.css`
    - **Property 6: Diagram geometry, references, and colors**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 7.5, 17.5**

  - [x] 3.8 Write property test for trivia integrity
    - Create `tests/properties/dc07-trivia.test.ts`
    - **Property 7: Trivia integrity**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 17.5**

  - [x] 3.9 Write property test for solvable dungeons with no orphans
    - Create `tests/properties/dc08-dungeon.test.ts` using the existing `solveDungeon`
    - **Property 8: Dungeons are solvable with no orphans**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 17.6**

  - [x] 3.10 Write property test for sanitization of hostile text
    - Create `tests/properties/dc09-sanitize.test.ts` using `arbHostileSource`
    - **Property 9: Sanitization of hostile text**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.6, 7.8, 17.8**

  - [x] 3.11 Write property test for source attribution
    - Create `tests/properties/dc10-attribution.test.ts`
    - **Property 10: Source attribution**
    - **Validates: Requirements 2.12, 7.7**

  - [x] 3.12 Write compiler unit tests
    - Create `tests/compiler/compiler.test.ts`: a fixed small source with key-field snapshot checks, the empty source, a source with more than 12 headings, the hotspot-to-section modulo mapping, and every `ALLOWED_TOKENS` name defined in `tokens.css`
    - _Requirements: 2.1, 2.5, 2.6, 3.6, 3.9, 7.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement URL parsing and classification
  - [ ] 5.1 Implement `parseInput` in `src/model/sourceInput.ts`
    - Export `InputErrorCode`, `ParsedInput`, and `parseInput(raw)` with the design check order: trim, `empty-input`, `input-too-long`, `unsupported-scheme` (scheme followed by `//` or a known scheme name, so `Rust: a language` stays a topic), single-line URL parsing with `new URL` in a `try`, GitHub owner and repo validation (`invalid-github-url`), webpage normalization without fragment, markdown detection, then topic with collapsed whitespace
    - Perform no network access, throw nothing, and import nothing from React or browser globals
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ] 5.2 Write property test for GitHub URL classification
    - Create `tests/properties/dc11-github-url.test.ts` using `arbGithubUrl`
    - **Property 11: GitHub URL classification**
    - **Validates: Requirements 1.1, 1.8**

  - [ ] 5.3 Write property test for classification partition, trim invariance, and purity
    - Create `tests/properties/dc12-classification.test.ts` and stub `globalThis.fetch` to fail the test if called
    - **Property 12: Classification partition, trim invariance, and purity**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.9, 1.10**

  - [ ] 5.4 Write property test for input error codes
    - Create `tests/properties/dc13-input-errors.test.ts`
    - **Property 13: Input error codes**
    - **Validates: Requirements 1.5, 1.6, 1.7**

  - [ ] 5.5 Write parser unit tests
    - Create `tests/compiler/sourceInput.test.ts`: each kind, each error code, `www.`, `.git`, sub-path, `Rust: a language` stays a topic, `javascript:alert(1)` is `unsupported-scheme`, `https://github.com/owner` is `invalid-github-url`, and `http://` falls back to topic
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 17.10_

- [ ] 6. Implement shared adapter types and the Markdown and topic fallback
  - [ ] 6.1 Create `src/adapters/types.ts`, `errors.ts`, and `http.ts`
    - `types.ts`: `Result<T>`, `BurnErrorCode` (the 12 codes), `BurnError`, `FetchLike`, and `AdapterOptions`
    - `errors.ts`: `ERROR_MESSAGES: Record<BurnErrorCode, string>` in plain English with no angle brackets, and `FALLBACK_CODES` (`network`, `timeout`, `rate-limited`, `repo-not-found`, `unavailable`, `fetch-failed`)
    - `http.ts`: `fetchWithDeadline(fetch, url, init, ms, outer)` that aborts on deadline or outer abort, covers body reading, clears its timer in `finally`, and maps outcomes to `cancelled`, `timeout`, or `network`
    - _Requirements: 8.9, 8.10, 8.11, 11.3, 12.5, 12.7, 14.2, 14.6_

  - [ ] 6.2 Implement the Fallback_Adapter in `src/adapters/markdown.ts`
    - Export `parseMarkdown`, `markdownToSource`, and `topicToSource`. Use a single line pass that skips fenced code, HTML blocks, indented code, tables, and rules, reads `#` to `###` headings (first level-1 heading is the title), joins lines into paragraphs, treats list items as paragraphs, and strips images and links through `stripMarkdownInline`
    - `topicToSource` returns 6 template headings with study-prompt paragraphs that state no facts
    - Perform no network access
    - _Requirements: 11.1, 11.2, 11.5, 11.6, 11.7, 7.8_

  - [ ] 6.3 Write property test for fallback validity
    - Create `tests/properties/dc20-fallback.test.ts` running `parseInput`, the fallback adapter, and `compileDisc` on `arbMarkdown` and `arbTopic`, with planted fenced code, HTML block, and image markers that must not reach the paragraphs
    - **Property 20: Markdown and topic fallback produces valid discs**
    - **Validates: Requirements 11.6, 11.7, 17.3**

  - [ ] 6.4 Write fallback unit tests
    - Create `tests/adapters/markdown.test.ts`: heading levels, lists, tables, fences, images, empty input, and a 20000-character input that finishes under 50 ms (best of three runs)
    - _Requirements: 11.1, 11.2, 11.5, 11.6_

  - [ ] 6.5 Write error message unit tests
    - Create `tests/adapters/errors.test.ts`: for every `BurnErrorCode` the message is non-empty and contains no `<` or `>`, and `FALLBACK_CODES` matches the six codes of Requirement 11.3
    - _Requirements: 11.3, 14.2, 14.6_

- [ ] 7. Implement the GitHub adapter
  - [ ] 7.1 Implement `src/adapters/github.ts`
    - Export `fetchGithubSource(owner, repo, opts)` and `decodeReadme(content)`. Request the repository first with only the `Accept: application/vnd.github+json` header, then languages and README in parallel as best effort. Send no `Authorization` header
    - Map 404 to `repo-not-found`, 403 or 429 to `rate-limited`, deadline (8000 ms) to `timeout`, throws to `network`, and outer abort to `cancelled`. Build `ExtractedSource` with kind `github`, URL `https://github.com/{owner}/{repo}`, facts (stars, license, default branch, topics), and languages
    - `decodeReadme` decodes base64 to bytes and UTF-8 text, limited to 100000 characters. Take README headings and paragraphs through `parseMarkdown`. Fetch no URL found in the README
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12_

  - [ ] 7.2 Write property test for README decoding
    - Create `tests/properties/dc21-readme-decode.test.ts` with `// @vitest-environment node`
    - **Property 21: README decoding round trip and limit**
    - **Validates: Requirements 8.3, 8.12**

  - [ ] 7.3 Write GitHub adapter unit tests
    - Create `tests/adapters/github.test.ts` with an injected `fetch`: success with all three responses, README missing, non-base64 README encoding, `repo-not-found`, `rate-limited` for 403 and 429, timeout with fake timers, network failure, cancel, every recorded URL starts with `https://api.github.com/`, and no `Authorization` header
    - _Requirements: 8.1, 8.2, 8.4, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 17.14_

- [ ] 8. Implement HTML extraction, the SSRF guard, the handler, and the Pages Function
  - [ ] 8.1 Implement the SSRF_Guard in `src/extract/ssrf.ts`
    - Export `checkTarget(url)` returning `{ ok: true }` or `{ ok: false, reason }` (`SsrfVerdict`, `SsrfReason`). Parse with the WHATWG `URL` class and check scheme, credentials, port (80, 443, or absent), blocked host names and suffixes, IPv4 ranges (including the normalized decimal, octal, hexadecimal, and short forms), and IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped addresses
    - Perform no network access and import nothing outside `src/extract`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.11, 10.12_

  - [ ] 8.2 Write property test for blocked IPv4 in every notation
    - Create `tests/properties/dc14-ssrf-ipv4.test.ts`
    - **Property 14: SSRF guard blocks private IPv4 in every notation**
    - **Validates: Requirements 10.3, 10.5, 17.13**

  - [ ] 8.3 Write property test for private and mapped IPv6
    - Create `tests/properties/dc15-ssrf-ipv6.test.ts`
    - **Property 15: SSRF guard blocks private and mapped IPv6**
    - **Validates: Requirements 10.4**

  - [ ] 8.4 Write property test for scheme, credentials, and ports
    - Create `tests/properties/dc16-ssrf-scheme-port.test.ts`
    - **Property 16: SSRF guard rejects bad scheme, credentials, and ports**
    - **Validates: Requirements 10.1, 10.6, 10.7**

  - [ ] 8.5 Write property test for permitted public hostnames
    - Create `tests/properties/dc17-ssrf-public.test.ts`
    - **Property 17: SSRF guard permits public hostnames**
    - **Validates: Requirements 10.12**

  - [ ] 8.6 Write SSRF guard unit tests
    - Create `tests/extract/ssrf.test.ts`: `localhost`, `LOCALHOST.`, `a.localhost`, `printer.local`, `db.internal`, one-label names, each private IPv4 range at both ends, `255.255.255.255`, `::1`, `::`, `fd00::1`, `fe80::1`, `::ffff:127.0.0.1`, `::ffff:7f00:1`, `2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1`, credentials, ports 22 and 8080, `ftp:`, `file:`, `nip.io` names, and `https://example.com`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.12, 17.12_

  - [ ] 8.7 Implement the HTML_Extractor in `src/extract/htmlExtract.ts`
    - Export `extractHtml(html)` returning `{ title, headings, paragraphs }`. Use a linear scanner with no DOM dependency: read `<title>`, `h1` to `h3`, and `p` text, decode named, decimal, and hexadecimal entities (write the numeric entity pattern as `#x` and `#[0-9]` forms so the hex scan stays green), discard `script`, `style`, `noscript`, `template`, `svg`, `iframe`, and comments, collapse whitespace, and limit output to 12 headings, 40 paragraphs, and 1200 characters per string
    - Return empty lists for input with no extractable content and never throw
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [ ] 8.8 Write property test for HTML extraction round trip
    - Create `tests/properties/dc18-html-roundtrip.test.ts` using `arbHtmlDoc`
    - **Property 18: HTML extraction round trip**
    - **Validates: Requirements 9.2**

  - [ ] 8.9 Write property test for discards, limits, and totality
    - Create `tests/properties/dc19-html-discard.test.ts` using marker text and arbitrary strings
    - **Property 19: HTML extraction discards, limits, and totality**
    - **Validates: Requirements 9.3, 9.4, 9.5**

  - [ ] 8.10 Write HTML extractor unit tests
    - Create `tests/extract/htmlExtract.test.ts`: title, `h1` to `h3`, paragraphs, named, decimal, hex, invalid, and double-encoded entities, discarded elements, comments, unterminated tags, `>` inside attribute values, limits of 12 and 40, and no content
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 17.11_

  - [ ] 8.11 Implement `handleExtract` in `src/extract/handler.ts`
    - Export `handleExtract(request, deps)` with an injectable upstream `fetch`. Answer non-`GET` with 405, a missing `url` with 400, a rejected target with 403 (reason named, no upstream content echoed, upstream `fetch` never called), and follow at most 3 redirects manually with each `Location` re-checked by `checkTarget` (403 for a rejected hop, 502 `too-many-redirects` beyond the limit)
    - Limit the upstream request to 8000 ms (504) and the body to 1 MiB (502 `too-large`), accept only `text/html` or `application/xhtml+xml` (415), map upstream failure to 502, and return JSON `{ title, headings, paragraphs, url }` with 200
    - Send a descriptive `User-Agent`, forward no cookies or credentials, and read configuration only from the supplied environment bindings. Include no key, token, or private URL
    - _Requirements: 9.1, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 10.8, 10.9, 10.10_

  - [ ] 8.12 Add `functions/api/extract.ts` and the `tsconfig.json` include
    - Export `onRequest` that adapts the Pages `Request` and `env` to `handleExtract` and contains no other logic
    - Add `"functions"` to the `include` array of `tsconfig.json` so `npm run build` type-checks it, and confirm the app builds with `functions/` absent from the deployment
    - _Requirements: 9.1, 9.10, 9.11, 9.13_

  - [ ] 8.13 Write handler unit tests
    - Create `tests/extract/handler.test.ts` with an injected upstream `fetch`: 400, 403 for the initial URL and after a redirect, 405 for `POST`, `PUT`, `DELETE`, and `HEAD`, 200, 415, 502, 504, a 3-redirect chain succeeding and a 4-redirect chain failing, a body over 1 MiB, the mock `fetch` never called for a rejected URL, and upstream headers with a `User-Agent` and no `Cookie`
    - _Requirements: 9.1, 9.6, 9.7, 9.8, 9.9, 9.10, 9.12, 10.8, 10.9, 10.10, 17.15_

- [ ] 9. Implement the webpage adapter client
  - [ ] 9.1 Implement `src/adapters/webpage.ts`
    - Export `fetchWebpageSource(url, opts)` requesting `/api/extract?url={encodeURIComponent(url)}` with an injectable `fetch` and a 12000 ms deadline
    - Map HTTP 404 or a non-JSON body (including an SPA `index.html` with status 200) to `unavailable`, an error status with a JSON error body to `fetch-failed` carrying the sanitized message, a wrong shape to `fetch-failed`, deadline to `timeout`, and outer abort to `cancelled`. Validate string `title` and string-list `headings` and `paragraphs`, keep at most 12 headings and 40 paragraphs, and build `ExtractedSource` with kind `webpage` and the final `url`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 9.2 Write property test for webpage response shape validation
    - Create `tests/properties/dc22-webpage-shape.test.ts` using `arbWebpageJson`
    - **Property 22: Webpage response shape validation**
    - **Validates: Requirements 12.3, 12.6**

  - [ ] 9.3 Write webpage adapter unit tests
    - Create `tests/adapters/webpage.test.ts`: request URL and encoding, success, 404, SPA `index.html` with status 200, error JSON, wrong shape, and timeout with fake timers
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 17.14_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement burn orchestration with the loadDisc gate
  - [ ] 11.1 Implement `src/adapters/burn.ts`
    - Export `burn(input, { signal, fetch, onStage })` and `burnFallback(fallbackTopic, opts)`. Run `parseInput`, pick the adapter by kind (`markdown` and `topic` skip `fetching`), run `compileDisc`, then call `loadDisc(manifest, false)` from `src/discs/loader.ts` and mount only on `ok: true`
    - On `ok: false` return `{ code: 'validation-failed', validation: errors }`. Wrap the whole body in `try`: adapter exceptions become `fetch-failed` and compiler exceptions become `validation-failed`. Return `cancelled` when `signal.aborted` after any `await`. Attach `fallbackTopic` (repo name or page host) to errors in `FALLBACK_CODES`. All messages come from `ERROR_MESSAGES` and contain no angle brackets
    - _Requirements: 6.2, 6.3, 11.3, 11.4, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ] 11.2 Write property test for burn never throwing and never yielding an invalid disc
    - Create `tests/properties/dc23-burn-total.test.ts` with `// @vitest-environment node`, arbitrary input strings, and `arbFetchBehavior`
    - **Property 23: Burn never throws and never yields an invalid disc**
    - **Validates: Requirements 6.3, 14.5**

  - [ ] 11.3 Write burn orchestrator unit tests
    - Create `tests/adapters/burn.test.ts`: `loadDisc` is called with `prebaked` equal to `false` (spy), a manifest that fails validation yields `validation-failed` with the error list and mounts nothing, an adapter that throws yields `fetch-failed`, cancel yields `cancelled`, each fallback code carries `fallbackTopic`, `burnFallback` produces a valid disc, and `markdown` and `topic` inputs make no `fetch` call
    - _Requirements: 6.2, 6.3, 11.3, 11.4, 14.3, 14.4, 14.5_

- [ ] 12. Implement the localStorage disc library
  - [ ] 12.1 Implement `src/library/discLibrary.ts`
    - Export `createDiscLibrary(storage)` and `getBrowserStorage()` (returns `undefined` when `localStorage` is unavailable or throws). Store one key per disc, `disclore97.disc.<disc_id>`, as a versioned envelope with a sequence number
    - `save` replaces a same-id disc, keeps at most 10 discs by evicting the oldest, and on a quota error evicts the oldest and retries once. `load` runs every stored manifest through `loadDisc(m, false)`, skips and removes values that are not valid JSON, not a version 1 envelope, or invalid. `remove(disc_id)` deletes one disc. Every call is wrapped so a throwing `Storage` never escapes. Store only manifests
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [ ] 12.2 Write property test for library round trip, capacity, and replacement
    - Create `tests/properties/dc24-library-roundtrip.test.ts` with an in-memory `Storage` fake and compiled manifests
    - **Property 24: Library round trip, capacity, and replacement**
    - **Validates: Requirements 15.2, 15.8, 15.9**

  - [ ] 12.3 Write property test for corrupt entries
    - Create `tests/properties/dc25-library-corrupt.test.ts`
    - **Property 25: Library skips and removes corrupt entries**
    - **Validates: Requirements 15.4**

  - [ ] 12.4 Write library unit tests
    - Create `tests/library/discLibrary.test.ts`: key prefix and envelope shape, a `Storage` fake that throws on every method, a fake that throws a quota error only on `setItem`, remove, and no tokens or credentials in stored values
    - _Requirements: 15.1, 15.2, 15.4, 15.5, 15.6, 15.7, 17.17_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Build the Burn dialog UI
  - [ ] 14.1 Create `src/styles/burn.css` and `src/components/useModalDialog.ts`
    - `burn.css`: use only existing tokens and `var(--font-ui)`, no hex value, no `border-radius`, gradient, `backdrop-filter`, blurred `box-shadow`, or `url(`. Style `.window.burn-dialog` (`width: min(600px, 100%)`), the textarea with an inset bevel border, flat progress blocks built from CSS borders and token colors, and the error region
    - `useModalDialog`: Escape triggers cancel, Tab and Shift+Tab stay inside the dialog, and focus returns to the previously focused element on close
    - _Requirements: 13.12, 13.13, 13.16, 16.1, 16.2, 16.3, 16.4, 16.6_

  - [ ] 14.2 Create presets, `PresetList.tsx`, and `BurnProgress.tsx`
    - Add a presets module with at least 2 GitHub repository URL presets and at least 2 topic presets, all original text, each parsing to its declared kind
    - `PresetList`: an accessible list that places the preset text in the input on selection and can be disabled
    - `BurnProgress`: shows `Burning CD-R at 4x...` with a `progressbar` role made from flat blocks, announced through a live region
    - _Requirements: 13.5, 13.6, 13.9, 13.14, 16.4, 16.8_

  - [ ] 14.3 Implement `src/components/BurnDialog.tsx`
    - Build a modal `Window` titled `Burn New CD-R Disc...` with a labeled multi-line input, `PresetList`, `Burn` and `Cancel` `BevelButton`s, `BurnProgress`, and a `role="alert"` error region. Disable `Burn` for empty or whitespace input
    - On Burn enter the progress state, disable the input, presets, and `Burn`, keep `Cancel` enabled, call `burn` with an `AbortController`, and apply a `minBurnMs` floor (default 800) to successes only. Cancel and Escape abort pending requests and close without mounting. On success call `onBurned(manifest)`
    - Map each error code through `ERROR_MESSAGES`, list `path: message` for `validation-failed`, show the offline burn control when `fallbackTopic` is present, show `URL sources need a connection.` and route `markdown` and `topic` inputs through the fallback while the browser reports offline, keep the input text on failure, and clear the error when the user edits the input
    - Accept optional `fetch` and `minBurnMs` props, pass `fetch` to `burn`, and never call the global `fetch` directly, so tests make no network request
    - Request button clicks through the Audio_Module only, render all text as React text, and use no `dangerouslySetInnerHTML` or `innerHTML`
    - _Requirements: 6.3, 7.4, 11.3, 11.4, 13.1, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 13.16, 14.1, 14.2, 14.3, 14.4, 14.6, 14.7, 16.3, 16.9_

  - [ ] 14.4 Write Burn dialog component tests
    - Create `tests/components/burn.test.tsx` (jsdom) with `minBurnMs={0}` and a stub `fetch`: Preset selection, `Burn` disabled for empty and whitespace input, the `Burning CD-R at 4x...` text with a `progressbar` and disabled input, Presets, and `Burn`, a successful topic burn, an error display with the offline control, `validation-failed` error lines, Cancel during a pending `fetch` aborts the signal and mounts nothing, Escape cancels, Tab stays inside, focus returns to the opener, roles and names, typing clears the error, and the offline message
    - Also assert: the presets list has at least 2 GitHub and at least 2 topic presets and each parses to its declared kind with `parseInput`, and with the mute toggle on, burning and clicking buttons creates no audio nodes (mock context counters, as in `app.test.tsx`)
    - _Requirements: 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.12, 13.13, 13.14, 13.16, 14.1, 14.3, 14.4, 14.7, 16.9, 17.16_

- [ ] 15. Add the three entry points and integrate with App
  - [ ] 15.1 Add the Home card, Load Disc button, and Remove control
    - `HomeLauncher.tsx`: add a `Burn New CD-R Disc...` card that calls `onBurnNew`
    - `LoadDiscDialog.tsx`: add a `Burn New Disc...` button that closes the dialog and calls `onBurnNew`, and a `Remove` control for burned discs that calls `onRemoveDisc(disc_id)`
    - `ExpansionPackList.tsx`: add an optional `renderExtra` slot used for the Remove control. Existing props and behavior stay unchanged
    - _Requirements: 13.3, 13.4, 15.6_

  - [ ] 15.2 Add the File menu item and wire `DiscBrowser`
    - Add a `Burn New Disc...` item to the File menu items in `DiscBrowser.tsx` (`MenuBar.tsx` takes menu data and needs no change), and pass `onBurnNew` and `onRemoveDisc` down to `HomeLauncher` and `LoadDiscDialog`. The File menu item is available inside an open disc
    - _Requirements: 13.2, 13.3, 13.4, 15.6_

  - [ ] 15.3 Integrate burned discs, the library, and the dialog in `App.tsx`
    - Keep `sources` as the base list and append burned discs, dropping a burned disc whose id equals a base id. Accept optional `fetch` and `storage` props on `App` (passed to `BurnDialog` and `createDiscLibrary`) so tests can inject fakes. Create the library from `storage` when given, otherwise from `getBrowserStorage()` only when the `sources` prop is omitted, so existing App tests never touch `localStorage`
    - Own the Burn dialog state, render it as the last child of `.desktop__work`, and on `onBurned(manifest)` add the disc, call `library.save`, open the disc, request the spin-up sound through the Audio_Module, and close the dialog. Show `The disc is open, but it could not be saved to this browser.` when saving fails while the disc still mounts
    - At start load stored discs through `loadDisc(m, false)` and list those that pass in the Load Disc dialog. `Remove` deletes the stored disc. Import `compileDisc` only from `src/model/compiler`, and keep the previous disc open on any failed burn
    - _Requirements: 6.2, 6.3, 6.5, 13.2, 13.3, 13.4, 13.11, 14.5, 15.1, 15.3, 15.4, 15.5, 15.6, 15.9, 15.10_

  - [ ] 15.4 Write entry point component tests
    - Create `tests/components/burn-entry.test.tsx`: the Home card, the File menu item inside an open disc, and the Load Disc dialog button each open the Burn dialog, and the Load Disc button closes the Load Disc dialog first
    - _Requirements: 13.2, 13.3, 13.4, 17.16_

  - [ ] 15.5 Write App integration tests for mounting and the library
    - Create `tests/components/burn-app.test.tsx`: a successful burn mounts the disc and requests the spin-up sound, a failed burn keeps the previous disc, discs are restored at start from a fake `Storage`, `Remove` deletes a stored disc, a throwing `Storage` shows the not-saved notice while the disc still mounts, and existing `sources` prop tests never read `localStorage`
    - _Requirements: 6.3, 13.11, 15.3, 15.5, 15.6, 17.16, 17.17_

- [ ] 16. Add compliance checks and documentation
  - [ ] 16.1 Write static compliance tests in `tests/dynamic-static.test.ts`
    - Assert: `src/styles/burn.css` exists, uses `var(--font-ui)`, and has no `url(`, hex literal, non-zero radius, gradient, `backdrop-filter`, or blurred `box-shadow`
    - Assert: compiler files (`src/model/compiler.ts`, `src/model/compile/*`, `src/model/sourceInput.ts`, `src/extract/ssrf.ts`) import nothing from `react`, `src/components`, `src/adapters`, or `src/library` and contain none of `Math.random`, `Date.now`, `new Date`, `document.`, `window.`, `localStorage`, and `fetch(` (scan with comments stripped, so prose such as "HTML document" does not fail)
    - Assert: no `dangerouslySetInnerHTML` or `innerHTML` under `src/`, no `Authorization` in `src/adapters/*`, the only absolute `http` URLs in `src/` are `https://api.github.com` and `https://github.com/`, `functions/` and `src/extract/` contain no `process.env`, `API_KEY`, `Authorization`, or `secret` (scan with comments stripped; do not scan for the bare word `token`, which a scanner may use as an identifier), no `.env` file is committed, every `ALLOWED_TOKENS` name is defined in `tokens.css`, `tsconfig.json` `include` contains `functions`, and runtime dependencies stay exactly `react` and `react-dom`
    - Assert that the `LICENSE` file is still MIT and that no external image, audio, font, or script resource is referenced
    - _Requirements: 6.5, 6.6, 7.4, 8.2, 9.11, 9.13, 16.1, 16.2, 16.4, 16.5, 16.6, 16.7, 16.8, 16.10, 17.20_

  - [ ] 16.2 Update `README.md` and `docs/BUILD-STORY.md`
    - README: describe the Burn New CD-R Disc flow, the four source kinds, the optional `functions/api/extract.ts` (local run with `npx wrangler pages dev dist`, and that the app works without it), the SSRF guard and its DNS-rebinding limit, the GitHub 60 requests per hour limit, and the `localStorage` disc library
    - BUILD-STORY: add a short note on how Spec #2 was built
    - Include no secret, token, or private URL
    - _Requirements: 9.13, 16.7, 16.8_

- [ ] 17. Final checkpoint - Verify all commands pass
  - Run `npm test`, `npm run build`, and `npm run lint`. All three must pass, with the 24 existing test files and 111 existing tests still passing alongside the new tests. Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 9.13, 17.18, 17.19_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 25 correctness properties of the design; unit tests validate examples and edge cases
- `compileDisc` is imported from `src/model/compiler.ts` by the App and the tests only
- No task adds a runtime dependency, and no test makes a real network request

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["1.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["5.1", "6.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.2", "6.5"] },
    { "id": 7, "tasks": ["6.3", "6.4", "7.1", "8.1", "8.7"] },
    { "id": 8, "tasks": ["7.2", "7.3", "8.2", "8.3", "8.4", "8.5", "8.6", "8.8", "8.9", "8.10", "8.11"] },
    { "id": 9, "tasks": ["8.12", "8.13", "9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3"] },
    { "id": 11, "tasks": ["10"] },
    { "id": 12, "tasks": ["11.1", "12.1"] },
    { "id": 13, "tasks": ["11.2", "11.3", "12.2", "12.3", "12.4"] },
    { "id": 14, "tasks": ["13"] },
    { "id": 15, "tasks": ["14.1", "14.2"] },
    { "id": 16, "tasks": ["14.3", "15.1"] },
    { "id": 17, "tasks": ["14.4", "15.2"] },
    { "id": 18, "tasks": ["15.3"] },
    { "id": 19, "tasks": ["15.4", "15.5", "16.1", "16.2"] },
    { "id": 20, "tasks": ["17"] }
  ]
}
```
