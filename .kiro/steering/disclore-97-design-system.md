---
inclusion: always
---

# DiscLore '97: Design System & Architecture Steering

DiscLore '97 renders encyclopedia-style "CD-ROM discs" in an authentic 1997 Windows 95 look, with a built-in `KeepMaze` dungeon/trivia game. Apply these rules to all UI, audio, data, and deployment work.

## 1. Visual Aesthetic (Win95 / 1997 CD-ROM)

- **Never** use modern SaaS styling: dark-mode gradients, glassmorphism, drop-shadow blur, rounded pill cards, or large border radii. Use square corners and flat fills.
- Use classic Win95 chrome:
  - Surfaces: `#C0C0C0`
  - Title bars: `#000080` with white text
  - Bevels: crisp 2px outset/inset borders using `#FFFFFF` (highlight), `#808080` (shadow), `#000000` (outer edge)
  - Tooltips and callouts: `#FFFFE1`
- Typography:
  - Encyclopedia articles: `Georgia, "Times New Roman", serif`
  - Menus, buttons, and KeepMaze HUD: `"MS Sans Serif", Tahoma, sans-serif`
- Define colors and fonts once as shared CSS variables or tokens and reuse them. Do not scatter hex literals through components.
- Prefer CSS borders for bevels. Pressed buttons swap outset to inset.
- Do not add third-party UI kits or icon libraries that conflict with this look.

## 2. Procedural WebAudio Feedback

- Synthesize all sound effects with the WebAudio API: disc spin-up, bevel button click, page flip, KeepMaze torch, and door unlock.
- Provide a single global Mute toggle that every sound path respects.
- Use **no** external audio files (`.mp3`, `.wav`, `.ogg`) and no audio CDNs.
- Create the `AudioContext` lazily after a user gesture to satisfy browser autoplay rules.
- Keep sound code in one shared audio module. Components call it and never build their own oscillators.

## 3. Data Invariants: `DiscManifest` & `KeepMaze`

- Every disc, pre-baked or dynamically compiled, MUST conform to one shared, typed `DiscManifest` schema. Do not create per-disc ad hoc shapes.
- Validate dynamically compiled manifests at runtime before rendering.
- Every SVG hotspot coordinate `(x, y)` MUST be within `0..100` (percent) and reference an existing `section_id`.
- Every `KeepMaze` dungeon MUST be solvable by BFS from `entrance` to `throne_room`, with no orphan rooms (every room reachable).
- Every trivia question MUST cite a real section in the same disc.
- When changing the schema or generators, add or update tests that check these invariants for all discs.

## 4. Deployment & Repo Hygiene

- Target **Cloudflare Pages**: a static frontend plus an optional Pages Function. Keep the app deployable as static assets.
- Never hardcode API keys, tokens, or private URLs. Read secrets from environment variables or Cloudflare bindings, and never log them or commit `.env` files.
- Keep an `MIT` `LICENSE` file at the repo root.
- The repo is public. Do not commit credentials, personal data, or copyrighted assets.

## 5. General Working Rules

- Prefer small, typed, dependency-light code. Add a dependency only when it is clearly needed.
- Follow existing file structure and naming once code exists. Do not introduce a new framework or build tool without asking.
- If a request conflicts with these rules, say so and propose a compliant alternative.
