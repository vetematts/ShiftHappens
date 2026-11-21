# Shift Happens!

Overcooked, but for rostering. A duck and a bunny race around a cosy office signing staff on, passing them over the counter and pinning them onto the weekly roster before the clock runs out. Every staff member has a role, days they can work and a number of shifts, so a finished round is a real roster you can copy and use.

**[Play it now](https://vetematts.github.io/ShiftHappens/)** on a laptop or a phone.

Made for the Tanda Hackathon 2026 by [Matt](https://github.com/vetematts), [Edward Li](https://github.com/eli0118999), [Flynn Martschinke](https://github.com/flynnmartschinke) and [Harsha](https://github.com/hvarma029).

## How to play

1. Staff wait at the table, each wearing a cap in their role colour: barista (pink), kitchen (orange) or register (teal). Their name tag shows the days they can work and the shifts they have left.
2. Grab someone and hold the action button at the manager's desk to sign them on.
3. Pass them over the counter to your teammate.
4. Stand at a day on the board and roster them onto an open shift that matches their role, on a day they can work. Nobody works two shifts in one day.
5. After a shift they head home and come back while they have hours left. Sick calls knock people off the board, so refill those shifts too.
6. Watch out for the bin chicken. It sneaks along the board, pecks a rostered person off their shift and runs for the side door. Run into it to scare it off, or to make it drop who it took so you can roster them again.

The round gets harder in three stages: **Calm** (no sick calls), **Busy** from 0:35 (sick calls and the bin chicken) and **Chaos** from 2:00 (both come more often). The music speeds up with each stage and again in the last 10 seconds.

Cover every shift before 3:00 runs out to win. The end screen shows the finished roster with a **Copy roster** button.

| | Move | Action |
| --- | --- | --- |
| Duck (Player 1) | WASD | Space |
| Bunny (Player 2) | Arrow keys | Enter |
| Phone browser | Thumb stick | Action button |

Playing alone? Press **Q**, or the swap button on a phone, to switch between the duck and the bunny.

**Quick play** uses a sample café team. **Run it for real** lets you enter your own staff (name, role, days and shifts) and the shifts your week needs. It warns about any shift nobody can work and saves the team on that device.

## Phones as controllers (Jackbox-style)

Like a Jackbox party game, the laptop or projector shows the game and phones become the gamepads. Nobody installs anything.

1. Open the game on the laptop and select **Or use phones as controllers** on the start screen.
2. A QR code and a four-letter room code appear. Scan the QR code with a phone camera.
3. The first phone becomes the duck and the second becomes the bunny. The start screen ticks off each one as it connects.
4. Select **Start round** on a phone, or start from the laptop. Each phone shows a thumb stick, an action button, what its critter is holding and what the action button will do next.

Extra phones wait and take over a critter as soon as a phone leaves. The keyboard keeps working, so one phone and one keyboard player can play together.

**How it works.** There is no game server. The QR code opens the same GitHub Pages site with the room in the address (`#join-ABCD`). The laptop and phones find each other through public Nostr relays using [Trystero](https://github.com/dmotz/trystero), then talk directly over WebRTC. The laptop runs the whole game. Phones send their stick and button about 20 times a second, and the laptop sends each phone its critter's status 5 times a second. The game contacts the relays only after someone selects the phones button.

**Before a demo.** Test on the real Wi-Fi with real phones. Some venue and mobile networks block direct connections. If a phone stays on *Joining room…*, put the phones on the same Wi-Fi as the laptop or fall back to the keyboard.

**Testing without phones.** Add `?link=local` to the laptop's address and select the phones button. Then open `index.html#join-CODE-local` in other tabs of the same browser, with the room code in place of `CODE`. The tabs talk through the browser instead of the network.

## Run it yourself

Use Node.js 22.13 or newer.

```sh
npm ci
npm run dev        # local server that reloads as you edit
npm run build      # static site in dist/
npm run preview    # serve the build locally
npm run typecheck
npm run lint
npm run simulate   # bots play 100 rounds without a browser and report the win rate
```

`npm run simulate -- 1 show` plays one round and prints its events and final board. Add `--pause=1` (default 2.5) to change how long the bots hesitate after each action. Use it to check that changes to `settings` in `src/round.ts` still leave a winnable game. In PowerShell, run `node --experimental-strip-types scripts/simulate.ts 200 --pause=1` directly, because PowerShell drops the `--` that passes options through npm.

The office lowers its detail automatically on slower devices. Add `?quality=high` or `?quality=low` to the address to fix the detail level.

## How it's built

React and Vite for the page, Three.js for the 3D office, and no backend. The rules are plain TypeScript with no rendering, and the 3D world only reads the game state each frame, so gameplay can change without touching the graphics.

| File | What it does |
| --- | --- |
| `src/round.ts` | All the rules: the team, the week, signing on, rostering, sick calls, the bin chicken, collisions, and the timings in `settings` |
| `src/office-world.ts` | The Three.js office, critters, staff, board and effects |
| `src/shift-happens.tsx` | The game screen: input, score, start and end screens, and the phone lobby |
| `src/team-setup.tsx` | The **Run it for real** form, saved in the browser |
| `src/phone-link.ts` | Room codes, join links and the peer-to-peer link for phones |
| `src/phone-controller.tsx` | The gamepad a phone shows after scanning the QR code |
| `src/play-qr.tsx` | QR codes |
| `src/sound.ts` | Sound effects and the music loop, synthesised in the browser |
| `scripts/simulate.ts` | Bots that play rounds in Node to test and tune the rules |

## Publishing

GitHub Pages publishes the game after every push to `main`. The same workflow checks types and lint on pushes and pull requests, without holding back the live game. It needs **GitHub Actions** selected once under **Settings → Pages → Source**. To republish without a new commit, open **Actions**, select **Publish Shift Happens** and run it from `main`.
