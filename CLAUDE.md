# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shift Happens: a 2–4 player co-op browser game ("Overcooked, but for rostering") built with React 19, Vite and Three.js, and no backend. Helper critters move shift-request cards through an office (tray → desk stamp → counter → board) to fill a 14-shift week in two minutes. A finished round produces a real roster. It deploys as a static site to GitHub Pages.

## Commands

Requires Node.js >= 22.13.

```sh
npm ci
npm run dev        # Vite dev server
npm run build      # static site in dist/
npm run preview    # serve the build
npm run typecheck  # tsc (noEmit, strict); covers src/ only, not scripts/
npm run lint       # eslint . (covers scripts/ too)
node --experimental-strip-types scripts/simulate.ts            # bots play 200 rounds per player count, prints win rates
node --experimental-strip-types scripts/simulate.ts 1 verbose  # one round, printing the board as it goes
node scripts/smoke.mjs   # after npm run build: plays the build in headless Edge or Chrome, screenshots to smoke-out/
```

There is no unit test suite. The simulator is the check for rule changes: it also counts finished rosters that break a rule (wrong role, a day off, two shifts in a day, too many shifts), which should stay at 0. On Node 22.18+ the `--experimental-strip-types` flag can be dropped. CI (`.github/workflows/pages-demo.yml`) runs typecheck and lint on pushes and PRs to `main`, but they don't block the deploy. Every push to `main` publishes to Pages.

URL switches for testing in the browser:
- `?debug` exposes `shiftHappens.round()` in the console (e.g. `shiftHappens.round().elapsed = 75` to skip to Busy).
- `?quality=high` / `?quality=low` fixes the 3D detail level.
- `?link=local` on the host, plus `index.html#join-CODE-local` in other tabs, tests phone controllers without a network.

## Architecture

**Rules vs. rendering split.** `src/round.ts` holds every rule as plain TypeScript with no rendering, sound or networking: cards (`request`, `open`, `cancelled`) and where they are (`CardPlace`), the board, staff, NPCs (employees who wander the office end to end and take breaks, and the Shift Snatcher), slippery `hazards` (the cooler's flood round the Request Tray), ⚡ pickups and dash charges, stats, and the mutating functions `newRound`, `beginRound`, `stepRound`, `walk`, `dash`, `interact`, `stopStamp` and `nextAction`. Every tunable is in `settings`, including pacing (`busyAt`, `chaosAt`, and per-`Stage` spawn, cancel and Snatcher intervals). `src/office-world.ts` (`createOfficeWorld`) is a large Three.js module that only reads the `Round` through `draw(state, focus)`.

**Events.** The rules push one-off moments (`pin`, `nope`, `snatch`, `busy`, `win`, …) onto `round.fx` with an increasing `id`. `office-world.ts` consumes fx newer than the last id it saw and plays the matching `Sound` cue (`Cue = FxKind | "swap" | "tick"`) plus popups and particles. To add a sound or effect for a new rule, add an `FxKind`, push it from `round.ts`, add a cue in `sound.ts`, and handle it in the fx switch in `office-world.ts`. Don't diff state in the renderer.

**Shared geometry.** `round.ts` defines the office layout (`office`, `furniture`, `columnX`, `traySpot`, `slotFloor`). Collision, reach and NPC paths use it, and the 3D world draws furniture from the same numbers. Move furniture in `round.ts` and both follow.

**Game loop.** `src/shift-happens.tsx` owns the `requestAnimationFrame` loop. The `Round` lives in a ref and is mutated in place. Each frame it merges keyboard, touch and phone input per player, converts screen directions to world directions with `world.toWorld`, calls `walk` and `stepRound`, and then `world.draw`. It also plays the last-10-seconds tick and sets the background music tempo (`sound.setMusic`, faster per stage via `musicTempo` and again near the end). React re-renders the HUD only through a throttled `snapshot(state)`. Starting from the menu or join screen first shows the rules screen (`briefing.tsx`, `briefUntil`) until the host presses Let’s go/Enter, every phone sends `ready`, or `briefSeconds` pass; Play again skips it. Then a 3-2-1 countdown runs before `beginRound`.

**Routing.** `ShiftHappens` (default export) checks the URL hash. `#join-CODE[-local]` renders `PhoneController`, and anything else renders the game.

**Phones as controllers.** `src/phone-link.ts` wraps Trystero (Nostr relays for discovery, then WebRTC) behind a `Link` interface, with a same-browser stand-in for `?link=local`. Messages are `PhoneMessage` (phone → host) and `HostMessage` (host → phone). The laptop is authoritative. Phones take seats in join order up to four, and `ensurePlayers` adds critters mid-round, so per-player state must cope with `round.players` growing.

**Teams.** Quick play uses `quickTeam` (the Mon–Fri dental clinic). `sampleTeam` is the café template and the fallback saved team. "Roster my team" (`src/team-setup.tsx`) starts from `templates` and edits a `Team` (roles, `shiftNames`, `perDay`, `needs`) saved to localStorage. The week has 14 shifts: indices 0–6 are Mon–Sun first shift and 7–13 the second, so the day is `shift % 7`. Use `shiftLabel(shiftNames, shift)` for labels.

**Other modules.** `sound.ts` synthesises every sound effect and the background music loop with Web Audio (no audio files). `play-qr.tsx` renders QR codes. `briefing.tsx` is the rules screen before a round.

## Conventions

- `vite.config.ts` sets `base: "./"` so the build works from the Pages subfolder. Keep asset paths relative.
- Dependencies are pinned to exact versions.
- Code comments and UI copy use plain, friendly British/Australian English (e.g. "colour").
