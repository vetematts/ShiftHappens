# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shift Happens: a two-player co-op browser game ("Overcooked, but for rostering") built with React 19, Vite and Three.js, and no backend. A finished round produces a real weekly roster. It deploys as a static site to GitHub Pages.

## Commands

Requires Node.js >= 22.13.

```sh
npm ci
npm run dev        # Vite dev server
npm run build      # static site in dist/
npm run preview    # serve the build
npm run typecheck  # tsc (noEmit, strict)
npm run lint       # eslint .
```

There is no unit test suite. `npm run simulate` (`scripts/simulate.ts`) has two bots play rounds against `round.ts` in Node and reports the win rate. Use it after changing rules or `settings`; `-- 1 show` traces a single round. From PowerShell, call `node --experimental-strip-types scripts/simulate.ts <rounds> --pause=<s>` directly, because PowerShell drops the `--` npm needs. `tsc` doesn't cover `scripts/` (only `src/`); lint does. CI (`.github/workflows/pages-demo.yml`) runs them on pushes and PRs to `main`, but they don't block the deploy. Every push to `main` publishes to Pages.

Useful URL switches when testing in the browser:
- `?quality=high` / `?quality=low` fixes the 3D detail level (otherwise it drops automatically on slow devices).
- `?link=local` on the host, plus `index.html#join-CODE-local` in other tabs of the same browser, tests phone controllers without a network.

## Architecture

**Rules vs. rendering split.** `src/round.ts` holds every game rule as plain, render-free TypeScript: the team/week data model, the `Round` state object, and the mutating functions `newRound`, `beginRound`, `stepRound`, `walk`, `interact`, `nextAction` and `canWork`. Timings and tunables live in `settings`. `src/office-world.ts` (`createOfficeWorld`) is a large Three.js module that only *reads* the `Round` each frame through `draw(state, focus)`. Gameplay changes should go in `round.ts` without touching the graphics.

**Shared geometry.** `round.ts` also defines the office layout (`office`, `furniture`, `columnX`). Collision and station reach use these, and the 3D world draws furniture at the same positions and sizes. Moving or resizing furniture means changing `round.ts`, and both collision and visuals follow.

**Game loop.** `src/shift-happens.tsx` owns the `requestAnimationFrame` loop. The `Round` lives in a ref (not React state) and is mutated in place. Each frame the loop:
1. Merges keyboard, on-screen stick and remote phone input per player.
2. Converts screen-relative input to world directions with `world.toWorld` (camera-relative).
3. Calls `walk` and `stepRound`, then `world.draw`.

React only re-renders the HUD through a throttled `snapshot(state)` (about every 80 ms, or on phase change). Action-button presses call `interact` directly from input handlers. Holding the button at the desk stamps (signs on) a staff member, and `stopStamp` cancels it.

**Routing.** `ShiftHappens` (default export) checks the URL hash. `#join-CODE[-local]` renders `PhoneController` (the phone gamepad). Anything else renders the game.

**Phones as controllers.** `src/phone-link.ts` wraps Trystero (Nostr relays for discovery, then direct WebRTC) behind a small `Link` interface, with a same-browser stand-in for `?link=local`. Messages are typed as `PhoneMessage` (phone → host: `input`, `start`) and `HostMessage` (host → phone: `seat`, `status`). The laptop is authoritative and runs the whole game. Phones send input about 20 times a second, and the host broadcasts each seated phone's status every 200 ms. The first two phones take seats 0 (duck) and 1 (bunny). Extra phones wait for a free seat. Relays are contacted only after the user opts into phone mode.

**Teams.** "Quick play" uses `sampleTeam` in `round.ts`. "Run it for real" (`src/team-setup.tsx`) edits a `Team` saved to localStorage, and `checkTeam` warns about shifts that nobody can cover. The week has 14 slots: indices 0–6 are Mon–Sun AM and 7–13 are Mon–Sun PM, so the day of a slot is `slot % 7`.

**Events and sound.** `round.ts` never plays sounds. `office-world.ts` `track()` compares the round with the previous frame (board slots, staff locations, `player.refused`, `round.snatcher` mode, stage from `stageAt`) and fires popups and `Sound` cues. It also drives the music tempo with `sound.setMusic()`. To add a sound for a new rule, expose the change as state in `Round` and detect it in `track()`.

**Pacing and the Shift Snatcher.** `settings.pace` lists the Calm, Busy and Chaos stages and sets the spawn, sick-call and bin-chicken intervals for each. The bin chicken (`round.snatcher`, `stepSnatcher`) moves only along `snatchLane` in front of the board. Staff it grabs have `at.place === "snatched"`.

**Other modules.** `sound.ts` synthesises sound effects and the music loop with Web Audio (no audio files). `play-qr.tsx` renders QR codes with `qrcode-generator`.

## Conventions

- `vite.config.ts` sets `base: "./"` so the build works from the Pages subfolder. Keep asset paths relative.
- Dependencies are pinned to exact versions.
- Code comments and UI copy use plain, friendly British/Australian English (e.g. "colour").
