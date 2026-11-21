import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createOfficeWorld } from "./office-world";
import {
  beginRound, cardIn, dash, days, dropCarried, ensurePlayers, filledShifts, heldCard, interact, neededShifts, newRound, nextAction, roleIn, roster,
  quickTeam, sampleTeam, settings, shifts, stageAt, stepRound, stopStamp, templates, walk,
  type Round, type Stage, type Team,
} from "./round";
import { copyTeam, loadTeam, saveTeam, TeamSetup } from "./team-setup";
import PhoneController from "./phone-controller";
import { cardColours, cardText, critters, joinsOverLan, joinUrl, makeRoomCode, openLink, readJoin, relayUrl, wakeRelay, wantsLocalLink, type Link, type Message } from "./phone-link";
import { PlayQr, playUrl, QrCode } from "./play-qr";
import { Briefing, briefSeconds } from "./briefing";
import { createSound, type Sound } from "./sound";

const keyboards = [
  { up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD", use: "Space", dash: ["ShiftLeft"], guide: "WASD", action: "Space", dashGuide: "L-Shift" },
  { up: "ArrowUp", left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", use: "Enter", dash: ["ShiftRight", "Slash"], guide: "↑ ← ↓ →", action: "Enter", dashGuide: "R-Shift" },
];
const swapKey = "KeyQ";
const gameKeys = [...keyboards.flatMap(({ up, left, down, right, use, dash }) => [up, left, down, right, use, ...dash]), swapKey];
const player2Keys = [keyboards[1].up, keyboards[1].left, keyboards[1].down, keyboards[1].right, keyboards[1].use, ...keyboards[1].dash];
const stageNames: Record<Stage, string> = { calm: "Calm", busy: "Busy!", chaos: "Chaos!" };
const stageStart: Record<Stage, number> = { calm: 0, busy: settings.busyAt, chaos: settings.chaosAt };
/** How fast the background music plays in each stage (1 is normal). */
const musicTempo: Record<Stage, number> = { calm: 1, busy: 1.08, chaos: 1.16 };
const newInput = () => ({ x: 0, y: 0, act: false, dash: false });
const emptySeats = (): (string | null)[] => critters.map(() => null);
/** Seconds of 3-2-1 before a round, so everyone on keyboards and phones starts together. */
const countdownSeconds = 3;
/** Fun titles for the results, each going to whoever did the most of one job. Ties share the award. */
const awards = [
  { stat: "pinned", title: "Pin Master", unit: ["card pinned", "cards pinned"] },
  { stat: "stamped", title: "Stamp Addict", unit: ["card stamped", "cards stamped"] },
  { stat: "passed", title: "Pass Master", unit: ["pass over the counter", "passes over the counter"] },
  { stat: "shredded", title: "Shredder Supreme", unit: ["card shredded", "cards shredded"] },
  { stat: "rescues", title: "Chicken Wrangler", unit: ["rescue", "rescues"] },
  { stat: "accepted", title: "Staff Whisperer", unit: ["shift accepted", "shifts accepted"] },
  { stat: "slips", title: "Puddle Jumper", unit: ["slip", "slips"] },
] as const;
const stickReach = 46;

const tips = [
  "Hold the action key at the Manager’s Desk to stamp a request, then pass it over the counter.",
  "Pin a stamped request on the Roster Board under the day it asks for.",
  "A red cancelled card goes in the Shredder. That opens a yellow shift.",
  "A yellow open shift is for one employee. Their bubble flashes: chase them down and hand it over.",
  "A wobbling card is about to be cancelled.",
  "Grab ⚡ to recharge your dash, or for a speed boost when you’re full.",
  "Dash into the Shift Snatcher to make it drop the cards it stole.",
  "When the water cooler leaks, the tray is flooded for a few seconds. Wait it out, or risk a slip.",
  "Playing alone? Press Q to swap between the critters.",
  "Need a breather? Press Esc to pause.",
  "Roster my team works for cafés, clinics, salons or anything with shifts.",
  "Scan the QR code and your phones become the controllers. Up to four can play.",
];

/** The critter Q moves player 1 to: the next one that isn't driven by player 2's keys or a phone. */
function swapTarget(from: number, total: number, player2: boolean, seats: (string | null)[]) {
  for (let step = 1; step < total; step++) {
    const next = (from + step) % total;
    if (seats[next] || (next === 1 && player2)) continue;
    return next;
  }
  return from;
}

/** Critters needed so every connected phone has a seat. */
const seatsNeeded = (seats: (string | null)[]) => seats.reduce((most, peer, i) => (peer ? i + 1 : most), 0);

function clock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

type SlotView = { state: "closed" | "empty" | "filled" | "cancelled"; name: string; colour: string; label: string };

function snapshot(round: Round) {
  const names = roster(round).map(person => person?.name ?? "");
  return {
    phase: round.phase,
    time: settings.duration - round.elapsed,
    elapsed: round.elapsed,
    stage: round.stage,
    filled: filledShifts(round),
    needed: neededShifts(round),
    custom: round.custom,
    shiftNames: round.shiftNames,
    strip: shifts.map((_, slot): SlotView => {
      const role = round.slotRoles[slot];
      const { colour, label } = role ? roleIn(round.roles, role) : { colour: "#bdb4d1", label: "" };
      if (!round.needed[slot]) return { state: "closed", name: "", colour, label };
      if (cardIn(round, slot)?.kind === "cancelled") return { state: "cancelled", name: "", colour, label };
      return { state: names[slot] ? "filled" : "empty", name: names[slot], colour, label };
    }),
    news: round.news.until > round.elapsed ? round.news.text : "",
    stats: round.stats.map(stat => ({ ...stat })),
    players: round.players.map((player, i) => {
      const card = heldCard(round, i);
      return {
        card: card ? {
          kind: card.kind, day: card.day, approved: card.approved,
          worker: card.worker === undefined ? "" : round.staff[card.worker]?.name ?? "",
        } : null,
        stamp: player.stamping ? (card?.stamp ?? 0) / settings.stampTime : 0,
        stamping: player.stamping,
        charges: player.charges,
        regenIn: player.charges < settings.dashCharges ? Math.max(0, player.nextCharge - round.elapsed) : 0,
        boosted: round.elapsed < player.boostUntil,
        prompt: player.messageUntil > round.elapsed ? player.message : nextAction(round, i),
      };
    }),
  };
}
type View = ReturnType<typeof snapshot>;

/** Who won each award. The end screen and every phone's results both use this. */
function awardWinners(stats: View["stats"]) {
  return awards.flatMap(award => {
    const best = Math.max(0, ...stats.map(entry => entry[award.stat]));
    if (!best) return [];
    const winners = stats.flatMap((entry, i) => (entry[award.stat] === best ? [i] : []));
    return [{ ...award, best, winners }];
  });
}
type HeldCard = View["players"][number]["card"];

function Pips({ charges }: { charges: number }) {
  return (
    <span className="pips" role="img" aria-label={`${charges} of ${settings.dashCharges} dashes`}>
      {Array.from({ length: settings.dashCharges }, (_, i) => <i key={i} data-on={i < charges}>⚡</i>)}
    </span>
  );
}

function CardChip({ card }: { card: NonNullable<HeldCard> }) {
  return (
    <span className="person-chip" data-kind={card.kind} data-approved={card.approved && card.kind !== "cancelled"}
      style={{ "--role": cardColours[card.kind] } as CSSProperties}>
      {cardText(card, days)}
    </span>
  );
}

const slotText = (slot: SlotView) =>
  slot.state === "filled" ? slot.name : slot.state === "cancelled" ? "Cancelled" : slot.state === "empty" ? slot.label || "Open" : "–";

function Stats({ stats }: { stats: View["stats"] }) {
  const winners = awardWinners(stats);
  return (
    <div className="roster-scroll">
      <table className="stats-table">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Critter</span></th>
            <th scope="col">Pinned</th><th scope="col">Stamped</th><th scope="col">Shredded</th><th scope="col">Accepted</th><th scope="col">Rescues</th><th scope="col">Slips</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((entry, i) => (
            <tr key={critters[i].name} style={{ "--critter": critters[i].colour } as CSSProperties}>
              <th scope="row">
                <span className="stats-avatar" aria-hidden="true">{critters[i].emoji}</span>
                <small>{winners.filter(win => win.winners.includes(i)).map(win => win.title).join(" · ") || "Team player"}</small>
              </th>
              <td>{entry.pinned}</td><td>{entry.stamped}</td><td>{entry.shredded}</td><td>{entry.accepted}</td><td>{entry.rescues}</td><td>{entry.slips}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rosterText(view: View) {
  const line = (day: number) => [day, day + 7].filter(slot => view.strip[slot].state !== "closed")
    .map(slot => `${view.shiftNames[slot < 7 ? 0 : 1]}${view.strip[slot].label ? ` ${view.strip[slot].label}` : ""}: ${view.strip[slot].name || "open"}`)
    .join(" · ") || "closed";
  return ["Shift Happens! roster", ...days.map((day, i) => `${day}  ${line(i)}`)].join("\n");
}

function RosterTable({ view }: { view: View }) {
  return (
    <div className="roster-scroll">
      <table className="roster">
        <thead><tr><th scope="col"><span className="sr-only">Shift</span></th>{days.map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
        <tbody>
          {view.shiftNames.map((name, half) => (
            <tr key={half}>
              <th scope="row">{name}</th>
              {days.map((day, d) => {
                const slot = view.strip[d + half * 7];
                if (slot.state === "closed") return <td key={day} data-closed="true" title="Not needed">–</td>;
                return (
                  <td key={day}>
                    <span className="roster-chip" data-open={slot.state !== "filled"} data-state={slot.state}
                      style={{ "--role": slot.colour } as CSSProperties} title={slot.label}>{slotText(slot)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One glossy menu button with an icon, a title and a line underneath. */
function BigButton({ icon, title, note, tone, onClick, disabled }: {
  icon: string; title: string; note: string; tone: "primary" | "roster"; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" className={`big big-${tone}`} onClick={onClick} disabled={disabled}>
      <span className="big-icon" aria-hidden="true">{icon}</span>
      <span className="big-text"><b>{title}</b><small>{note}</small></span>
      <span className="big-go" aria-hidden="true">›</span>
    </button>
  );
}

/** Shows the game, or a phone controller when the page was opened from a join link. */
export default function ShiftHappens() {
  // The address is only known in the browser, so the server renders nothing and the browser decides.
  const join = useSyncExternalStore(watchAddress, joinKey, () => null);
  if (join === null) return null;
  if (!join) return <Game />;
  const [code, local] = join.split("|");
  return <PhoneController code={code} local={local === "local"} />;
}

function watchAddress(changed: () => void) {
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
}

function joinKey() {
  const join = readJoin();
  return join ? `${join.code}|${join.local ? "local" : "net"}` : "";
}

type Phones = { code: string; local: boolean; seats: (string | null)[]; failed: boolean };

function Game() {
  const host = useRef<HTMLDivElement>(null);
  const round = useRef(newRound());
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0, pointer: -1, originX: 0, originY: 0 });
  const knob = useRef<HTMLSpanElement>(null);
  const sound = useRef<Sound | null>(null);
  // Player 1's controls (WASD, Space and the touch controls) drive this critter. Swapping lets one person play several.
  const active = useRef(0);
  // Set once someone uses player 2's keys this round. From then on the bunny is theirs and Q skips it.
  const player2 = useRef(false);
  // Which critter to mark and follow: always on touch screens, and on keyboards once someone swaps.
  const focus = useRef<number | null>(null);
  const holding = useRef(new Map<string, number>());
  // While paused the round stands still: no walking, no clock, no spawns. The ref is read by the loop, the state shows the menu.
  const paused = useRef(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [lead, setLead] = useState(0);
  const [keyedP2, setKeyedP2] = useState(false);
  const [count, setCount] = useState(2);
  const [view, setView] = useState(() => snapshot(newRound()));
  const [graphics, setGraphics] = useState<"loading" | "ready" | "failed">("loading");
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // The rules screen before a round: when it moves on by itself (0 when not showing), seconds left, and which phones are ready
  const briefUntil = useRef(0);
  const [briefLeft, setBriefLeft] = useState(0);
  const readySeats = useRef(critters.map(() => false));
  const [ready, setReady] = useState(() => critters.map(() => false));
  // The 3-2-1-Go before a round: when it ends (0 when not counting), and what the big screen shows
  const countdownUntil = useRef(0);
  const [countIn, setCountIn] = useState("");
  const [team, setTeam] = useState<Team>(() => copyTeam(sampleTeam));
  const [setup, setSetup] = useState(false);
  const [help, setHelp] = useState(false);
  const [tip, setTip] = useState(0);
  const lastMode = useRef<"quick" | "real">("quick");
  // Phones as controllers: seats 0–3 are the duck, bunny, cat and frog
  const [phones, setPhones] = useState<Phones | null>(null);
  const phoneLink = useRef<Link | null>(null);
  const seats = useRef<(string | null)[]>(emptySeats());
  const remote = useRef(critters.map(newInput));

  function copyRoster() {
    navigator.clipboard?.writeText(rosterText(view)).then(() => setCopied(true), () => setCopied(false));
  }

  function copyJoinLink(code: string, local: boolean) {
    navigator.clipboard?.writeText(joinUrl(code, local)).then(() => setLinkCopied(true), () => setLinkCopied(false));
  }

  // A new tip along the bottom every few seconds while the menu is up
  const menuUp = view.phase === "ready" && !setup;
  useEffect(() => {
    if (!menuUp) return;
    const timer = window.setInterval(() => setTip(current => (current + 1) % tips.length), 6000);
    return () => window.clearInterval(timer);
  }, [menuUp]);

  function changeTeam(next: Team) {
    setTeam(next);
    saveTeam(next);
  }

  /** Moves player 1's keys and touch controls to another critter. */
  function switchTo(next: number) {
    const previous = active.current;
    if (next === previous) return;
    holding.current.forEach((critter, code) => {
      if (critter !== previous || code !== keyboards[0].use) return;
      stopStamp(round.current, critter);
      holding.current.delete(code);
      keys.current.delete(code);
    });
    active.current = next;
    focus.current = next;
    setLead(next);
    sound.current?.play("swap");
  }

  function swap() {
    if (round.current.phase !== "playing" || paused.current) return;
    switchTo(swapTarget(active.current, round.current.players.length, player2.current, seats.current));
  }

  function press(code: string) {
    sound.current?.unlock();
    if (round.current.phase !== "playing" || paused.current || keys.current.has(code)) return;
    keys.current.add(code);
    if (code === swapKey) {
      swap();
      return;
    }
    if (code.startsWith("Phone")) {
      const critter = Number(code.slice(5));
      holding.current.set(code, critter);
      interact(round.current, critter);
      return;
    }
    if (player2Keys.includes(code) && !player2.current) {
      // Someone is using player 2's keys, so the bunny is theirs. Player 1 steps off it if they were driving it.
      player2.current = true;
      setKeyedP2(true);
      if (active.current === 1) switchTo(swapTarget(1, round.current.players.length, true, seats.current));
    }
    const pad = keyboards.findIndex(entry => entry.dash.includes(code));
    if (pad !== -1) {
      dash(round.current, pad === 0 ? active.current : 1);
      return;
    }
    const control = keyboards.findIndex(entry => entry.use === code);
    if (control === -1) return;
    const critter = control === 0 ? active.current : 1;
    holding.current.set(code, critter);
    interact(round.current, critter);
  }

  function release(code: string) {
    if (!keys.current.delete(code)) return;
    const critter = holding.current.get(code);
    holding.current.delete(code);
    if (critter !== undefined) stopStamp(round.current, critter);
  }

  /** Freezes the round and opens the pause menu. Held keys and stamps are let go so nothing carries on in the background. */
  function pause() {
    if (round.current.phase !== "playing" || paused.current) return;
    paused.current = true;
    keys.current.clear();
    holding.current.clear();
    stickUp();
    round.current.players.forEach((_, i) => stopStamp(round.current, i));
    setPauseOpen(true);
  }

  function resume() {
    paused.current = false;
    setPauseOpen(false);
    host.current?.focus({ preventScroll: true });
  }

  function backToMenu() {
    paused.current = false;
    setPauseOpen(false);
    round.current = newRound();
    setView(snapshot(round.current));
  }

  // Keyboard listeners live in an effect, so they reach the latest press and release through effect events.
  const onKeyDown = useEffectEvent((code: string) => press(code));
  const onKeyUp = useEffectEvent((code: string) => release(code));
  const onPauseKey = useEffectEvent(() => (paused.current ? resume() : pause()));

  function seatPhone(peer: string) {
    let seat = seats.current.indexOf(peer);
    if (seat === -1) {
      seat = seats.current.findIndex(taken => !taken);
      if (seat !== -1) seats.current[seat] = peer;
      setPhones(current => current && { ...current, seats: [...seats.current] });
    }
    // A phone joining mid-round (or during the countdown) brings its critter into the office straight away
    if (seat !== -1 && seat >= round.current.players.length && (round.current.phase === "playing" || countdownUntil.current || briefUntil.current)) {
      ensurePlayers(round.current, seat + 1);
      setView(snapshot(round.current));
    }
    phoneLink.current?.send({ t: "seat", player: seat }, peer);
    return seat;
  }

  // Phone events arrive from the link, which is opened in an effect below.
  const onPhoneJoin = useEffectEvent((peer: string) => seatPhone(peer));
  const onPhoneLeave = useEffectEvent((peer: string) => {
    const seat = seats.current.indexOf(peer);
    if (seat === -1) return;
    seats.current[seat] = null;
    remote.current[seat] = newInput();
    release(`Phone${seat}`);
    // Whatever card they were carrying is put down, so it doesn't vanish with a missing player
    if (round.current.phase === "playing") dropCarried(round.current, seat);
    setPhones(current => current && { ...current, seats: [...seats.current] });
  });
  const onPhoneMessage = useEffectEvent((message: Message, peer: string) => {
    // While the rules are up, a phone's big button means "I'm ready"
    if ((message.t === "ready" || message.t === "start") && briefUntil.current) {
      const seat = seats.current.indexOf(peer);
      if (seat !== -1) phoneReady(seat);
      return;
    }
    if (message.t === "ready") return;
    if (message.t === "start") {
      if (round.current.phase !== "playing" && !setup && !countdownUntil.current) start();
      return;
    }
    if (message.t !== "input") return;
    const seat = seats.current.includes(peer) ? seats.current.indexOf(peer) : seatPhone(peer);
    if (seat < 0) return;
    const input = remote.current[seat];
    const clamp = (value: number) => Math.max(-1, Math.min(1, Number(value) || 0));
    input.x = clamp(message.x);
    input.y = clamp(message.y);
    if (message.dash && !input.dash && round.current.phase === "playing" && !paused.current) dash(round.current, seat);
    input.dash = Boolean(message.dash);
    if (message.act && !input.act) press(`Phone${seat}`);
    if (!message.act && input.act) release(`Phone${seat}`);
    input.act = Boolean(message.act);
  });

  const roomCode = phones?.code;
  const roomLocal = phones?.local ?? false;
  useEffect(() => {
    if (!roomCode) return;
    let closed = false;
    openLink(roomCode, roomLocal).then(link => {
      if (closed) {
        link.close();
        return;
      }
      phoneLink.current = link;
      link.onJoin(peer => onPhoneJoin(peer));
      link.onLeave(peer => onPhoneLeave(peer));
      link.onMessage((message, peer) => onPhoneMessage(message, peer));
    }).catch(() => setPhones(current => current && { ...current, failed: true }));
    return () => {
      closed = true;
      phoneLink.current?.close();
      phoneLink.current = null;
      seats.current = emptySeats();
      remote.current = critters.map(newInput);
    };
  }, [roomCode, roomLocal]);

  // Wake the relay as the page opens, so it's ready by the time anyone scans the QR code
  useEffect(() => {
    if (!wantsLocalLink()) wakeRelay();
  }, []);

  /** Esc, the × button or a click on the office around a panel goes back: out of setup, how to play or the phone lobby. */
  function closeOverlay() {
    // Not while the rules or the 3-2-1 are up: the round is about to start, and the phones must stay connected
    if (round.current.phase === "playing" || briefUntil.current || countdownUntil.current) return;
    if (setup) setSetup(false);
    else if (help) setHelp(false);
    else if (phones && round.current.phase === "ready") setPhones(null);
  }
  const onEscape = useEffectEvent(closeOverlay);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onEscape();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  function startPhones() {
    sound.current?.unlock();
    setLinkCopied(false);
    setPhones({ code: makeRoomCode(), local: wantsLocalLink(), seats: emptySeats(), failed: false });
  }

  useEffect(() => {
    const viewport = host.current;
    if (!viewport) return;
    const effects = createSound();
    sound.current = effects;
    if (window.matchMedia("(pointer: coarse)").matches) focus.current = 0;
    // Sync saved settings after mount, so server and client render the same markup first.
    setMuted(effects.muted);
    setTeam(loadTeam());
    // `?debug` exposes the live round for testing from the console, e.g. `shiftHappens.round().elapsed = 75`.
    if (new URLSearchParams(location.search).has("debug")) {
      (window as unknown as { shiftHappens: object }).shiftHappens = { round: () => round.current };
    }
    let world: ReturnType<typeof createOfficeWorld> | undefined;
    let frame: number;
    let previous = performance.now();
    let lastUi = 0;
    let lastFit = 0;

    // Keep the office clear of the HUD: the camera frames the room between the top bar and the player panels,
    // so alerts and stats never sit on top of the Roster Board. On landscape screens the back wall may rise into
    // the empty middle of the top bar, between the logo and the stats.
    function fitAroundHud() {
      if (!world || !viewport) return;
      const page = viewport.closest("main");
      if (!page || round.current.phase !== "playing") {
        world.setInsets(0, 0);
        return;
      }
      const stage = viewport.getBoundingClientRect();
      const shown = (selector: string) => [...page.querySelectorAll<HTMLElement>(selector)]
        .map(element => element.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
      const hudBottom = Math.max(0, ...shown(".hud").map(box => box.bottom - stage.top));
      const lowest = shown(".touch").map(box => stage.bottom - box.top);
      const [stack] = shown(".pads");
      const gap = 10;
      const boxes = shown(".brand, .hud-stats").map(box => ({
        left: box.left - stage.left - gap, right: box.right - stage.left + gap, bottom: box.bottom - stage.top + gap,
      }));
      world.setInsets(hudBottom + gap, Math.max(0, ...lowest) + gap, boxes, stack ? stack.right - stage.left + gap : 0);
      // News toasts float just above the player panels, over the front edge of the office, so they never hide the
      // Roster Board at the back (which can now reach up into the top bar).
      page.style.setProperty("--news-bottom", `${Math.round(Math.max(0, ...lowest) + gap)}px`);
    }
    let lastBroadcast = 0;
    let displayedPhase: Round["phase"] | undefined;
    let displayedRound: Round | undefined;
    let lastTick = Infinity;
    let shownCount = 0;
    let shownBrief = 0;

    function loop(now: number) {
      const state = round.current;
      const seconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      // The rules screen moves on to the countdown by itself when its time is up
      if (briefUntil.current) {
        const left = Math.min(briefSeconds, Math.ceil((briefUntil.current - now) / 1000));
        if (left <= 0) {
          shownBrief = 0;
          onBriefDone();
        } else if (left !== shownBrief) {
          shownBrief = left;
          setBriefLeft(left);
        }
      }
      // Count 3-2-1 down before a round, then let everyone go at once. Nobody can act and the clock stays still until then.
      if (countdownUntil.current) {
        const left = Math.ceil((countdownUntil.current - now) / 1000);
        if (left <= 0) {
          countdownUntil.current = 0;
          shownCount = 0;
          beginRound(state);
          setCountIn("Go!");
          effects.play("accept");
        } else if (left !== shownCount) {
          shownCount = left;
          setCountIn(String(left));
          effects.play("pick");
        }
      }
      if (state.phase === "playing" && world && !paused.current) {
        const moves = state.players.map(() => ({ across: 0, downward: 0 }));
        const pressed = keys.current;
        keyboards.forEach(({ up, left, down, right }, i) => {
          const move = moves[i === 0 ? active.current : 1];
          if (!move) return;
          move.across += Number(pressed.has(right)) - Number(pressed.has(left));
          move.downward += Number(pressed.has(down)) - Number(pressed.has(up));
        });
        moves[active.current].across += stick.current.x;
        moves[active.current].downward += stick.current.y;
        remote.current.forEach((input, i) => {
          if (!moves[i]) return;
          moves[i].across += input.x;
          moves[i].downward += input.y;
        });
        moves.forEach(({ across, downward }, i) => {
          const [dx, dz] = world!.toWorld(across, downward);
          walk(state, i, Math.abs(dx) < 1e-6 ? 0 : dx, Math.abs(dz) < 1e-6 ? 0 : dz, Math.min(.05, seconds));
        });
        stepRound(state, seconds);
        const left = Math.ceil(settings.duration - state.elapsed);
        if (left <= 10 && left < lastTick && left > 0) effects.play("tick");
        lastTick = left;
        // Music speeds up each stage, and again for the last ten seconds
        effects.setMusic(left <= 10 ? 1.35 : musicTempo[stageAt(state.elapsed)]);
      } else {
        // Keep the last tick through a pause, so the same second doesn't tick twice on resuming
        if (state.phase !== "playing") lastTick = Infinity;
        effects.setMusic(0);
      }
      if (now - lastFit >= 250) {
        lastFit = now;
        fitAroundHud();
      }
      world?.draw(state, focus.current);
      // Tell each phone what its critter is doing, about five times a second
      if (phoneLink.current && now - lastBroadcast >= 200) {
        lastBroadcast = now;
        const latest = snapshot(state);
        const countdown = countdownUntil.current ? Math.max(1, Math.ceil((countdownUntil.current - now) / 1000)) : 0;
        const briefing = briefUntil.current ? Math.min(briefSeconds, Math.max(1, Math.ceil((briefUntil.current - now) / 1000))) : 0;
        const awarded = state.phase === "won" || state.phase === "lost" ? awardWinners(latest.stats) : [];
        seats.current.forEach((peer, i) => {
          if (!peer) return;
          const player = latest.players[i];
          phoneLink.current!.send({
            t: "status", phase: state.phase, prompt: paused.current ? "Paused" : player?.prompt ?? "", card: player?.card ?? null, stage: latest.stage,
            stamping: player?.stamping ?? false, stamp: player?.stamp ?? 0,
            charges: player?.charges ?? settings.dashCharges, regenIn: player?.regenIn ?? 0, boosted: player?.boosted ?? false,
            time: latest.time, filled: latest.filled, needed: latest.needed, news: latest.news,
            countdown, briefing, ready: readySeats.current[i], stats: latest.stats[i],
            awards: awarded.filter(award => award.winners.includes(i)).map(award => award.title),
            joined: seats.current.map(Boolean),
          }, peer);
        });
      }
      const changed = displayedRound !== state || displayedPhase !== state.phase;
      if (changed || (state.phase === "playing" && now - lastUi >= 80)) {
        setView(snapshot(state));
        lastUi = now;
        displayedRound = state;
        displayedPhase = state.phase;
      }
      frame = requestAnimationFrame(loop);
    }

    function keydown(event: KeyboardEvent) {
      // Esc pauses a round in progress, and resumes it from the pause menu
      if (event.code === "Escape" && round.current.phase === "playing") {
        event.preventDefault();
        if (!event.repeat) onPauseKey();
        return;
      }
      if (briefUntil.current && (event.code === "Enter" || event.code === "Space") && !event.repeat) {
        event.preventDefault();
        onBriefDone();
        return;
      }
      if (!gameKeys.includes(event.code) || round.current.phase !== "playing" || event.metaKey || event.altKey || event.ctrlKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("a, button, input")) return;
      event.preventDefault();
      if (!event.repeat) onKeyDown(event.code);
    }
    function keyup(event: KeyboardEvent) {
      onKeyUp(event.code);
    }
    function clearKeys() {
      keys.current.clear();
      holding.current.clear();
      stick.current = { ...stick.current, x: 0, y: 0, pointer: -1 };
      round.current.players.forEach((_, i) => stopStamp(round.current, i));
    }

    // Draw the office once the font is in, so its signs and name tags use it (or after a second regardless)
    let cancelled = false;
    const fontReady = Promise.race([document.fonts.load('700 32px "Bricolage Grotesque Variable"'), new Promise(done => setTimeout(done, 1000))]);
    fontReady.catch(() => {}).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(now => {
        try {
          world = createOfficeWorld(viewport, effects);
        } catch {
          setGraphics("failed");
          return;
        }
        setGraphics("ready");
        loop(now);
      });
    });
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
      effects.setMusic(0);
      world?.dispose();
    };
  }, []);

  /**
   * Sets up a round and starts it. Starting from the menu or the join screen shows the rules first (`brief`);
   * Play again, or straight after reading How to play, goes straight to the 3-2-1.
   */
  function start(mode: "quick" | "real" = lastMode.current, brief = round.current.phase === "ready") {
    if (countdownUntil.current || briefUntil.current) return;
    lastMode.current = mode;
    paused.current = false;
    setPauseOpen(false);
    setSetup(false);
    sound.current?.unlock();
    keys.current.clear();
    holding.current.clear();
    active.current = 0;
    player2.current = false;
    setKeyedP2(false);
    if (focus.current !== null) focus.current = 0;
    setLead(0);
    setCopied(false);
    const total = Math.max(count, seatsNeeded(seats.current));
    const state = mode === "real"
      ? newRound({
        ...team,
        roles: team.roles.map((role, i) => ({ ...role, label: role.label.trim() || `Role ${i + 1}` })),
        shiftNames: [team.shiftNames[0].trim() || "AM", team.shiftNames[1].trim() || "PM"],
        people: team.people.filter(person => person.name.trim()).map(person => ({ ...person, name: person.name.trim() })),
      }, true, total)
      : newRound(quickTeam, false, total);
    round.current = state;
    setView(snapshot(state));
    host.current?.focus({ preventScroll: true });
    if (brief) {
      // The rules show first; the countdown starts when they're done (see the loop and briefDone)
      readySeats.current = critters.map(() => false);
      setReady(readySeats.current);
      briefUntil.current = performance.now() + briefSeconds * 1000;
      setBriefLeft(briefSeconds);
      return;
    }
    beginCountdown();
  }

  /** The 3-2-1 before a round. The round begins when it runs out (see the loop). */
  function beginCountdown() {
    countdownUntil.current = performance.now() + countdownSeconds * 1000;
    setCountIn(String(countdownSeconds));
  }

  /** Off the rules screen and into the countdown: when the host says go, every phone is ready, or time's up. */
  function briefDone() {
    if (!briefUntil.current) return;
    briefUntil.current = 0;
    setBriefLeft(0);
    beginCountdown();
  }
  const onBriefDone = useEffectEvent(() => briefDone());

  /** A phone pressed "I'm ready". Once every phone in the room has, the round starts. */
  function phoneReady(seat: number) {
    readySeats.current = readySeats.current.map((on, i) => on || i === seat);
    setReady(readySeats.current);
    const phonesIn = seats.current.map((peer, i) => (peer ? i : -1)).filter(i => i >= 0);
    if (phonesIn.length && phonesIn.every(i => readySeats.current[i])) briefDone();
  }

  // "Go!" shows for a moment after the round starts, then clears
  useEffect(() => {
    if (countIn !== "Go!") return;
    const timer = window.setTimeout(() => setCountIn(""), 900);
    return () => window.clearTimeout(timer);
  }, [countIn]);

  function toggleSound() {
    sound.current?.unlock();
    const next = !muted;
    sound.current?.setMuted(next);
    setMuted(next);
  }

  function moveStick(x: number, y: number) {
    const { originX, originY } = stick.current;
    let dx = x - originX;
    let dy = y - originY;
    const length = Math.hypot(dx, dy);
    if (length > stickReach) {
      dx = dx / length * stickReach;
      dy = dy / length * stickReach;
    }
    const strength = Math.min(1, length / stickReach);
    stick.current.x = strength > .22 ? dx / stickReach : 0;
    stick.current.y = strength > .22 ? dy / stickReach : 0;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function stickDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    sound.current?.unlock();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    stick.current = { x: 0, y: 0, pointer: event.pointerId, originX: box.left + box.width / 2, originY: box.top + box.height / 2 };
    moveStick(event.clientX, event.clientY);
  }

  function stickMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === stick.current.pointer) moveStick(event.clientX, event.clientY);
  }

  function stickUp() {
    stick.current = { ...stick.current, x: 0, y: 0, pointer: -1 };
    if (knob.current) knob.current.style.transform = "";
  }

  function actionDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    press("Space");
  }

  function dashDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    sound.current?.unlock();
    if (!paused.current) dash(round.current, active.current);
  }

  const phoneSeats = phones?.seats ?? [];
  const playing = view.phase === "playing";
  const urgent = view.time <= 10 && playing;
  const solo = view.players[lead] ?? view.players[0];
  const players = Math.max(count, seatsNeeded(phoneSeats));
  const panelCount = playing ? view.players.length : players;
  const swapTo = swapTarget(lead, panelCount, keyedP2, phoneSeats);
  const banner = playing && view.stage !== "calm" && view.elapsed - stageStart[view.stage] < 2.6 ? view.stage : null;
  const savedKind = templates.find(template => template.id === team.kind);
  const custom = team.kind !== "cafe" || team.people.length !== sampleTeam.people.length;
  const endAwards = view.phase === "won" || view.phase === "lost" ? awardWinners(view.stats) : [];
  const progress = view.needed ? view.filled / view.needed : 0;

  const phonePanel = phones && (
    <div className="phones">
      <QrCode text={joinUrl(phones.code, phones.local)} label={`QR code to join room ${phones.code} with a phone`} />
      <div>
        <strong>Scan to use your phone as a controller</strong>
        <p>Room <b className="phones-code">{phones.code}</b>{phones.local ? " · same-browser test" : relayUrl() ? " · via relay server" : ""}</p>
        <ul>
          {critters.map(({ name, emoji }, i) => (
            <li key={name} data-on={Boolean(phones.seats[i])}>{emoji} {name[0].toUpperCase() + name.slice(1)}: {phones.seats[i] ? "phone connected" : "waiting…"}</li>
          ))}
        </ul>
        {phones.failed && <p className="phones-error">Couldn’t open the room. Check the internet connection.</p>}
        <div className="phones-actions">
          <button type="button" className="link" onClick={() => copyJoinLink(phones.code, phones.local)}>{linkCopied ? "Link copied ✓" : "Copy join link"}</button>
          <button type="button" className="link" onClick={() => setPhones(null)}>Stop using phones</button>
        </div>
      </div>
    </div>
  );

  const joined = phones ? phones.seats.filter(Boolean).length : 0;
  const closeButton = (label: string) => (
    <button type="button" className="panel-close" onClick={closeOverlay} aria-label={`${label} (Esc)`} title={`${label} (Esc)`}>×</button>
  );
  const joinPanel = phones && (
    <div className="panel panel-join">
      {closeButton("Back to menu")}
      <div className="join-qr">
        <QrCode text={joinUrl(phones.code, phones.local)} label={`QR code to join room ${phones.code} with a phone`} level="L" margin={3} />
      </div>
      <div className="join-side">
        <p className="kicker">Scan to play</p>
        <h2>Point your phone camera at the code</h2>
        <p className="join-code">Room <b>{phones.code}</b>{phones.local ? " · same-browser test" : relayUrl() ? " · via relay server" : ""}</p>
        <ul className="join-seats" aria-label="Players">
          {critters.map(({ name, emoji }, i) => (
            <li key={name} data-on={Boolean(phones.seats[i])}><span aria-hidden="true">{emoji}</span>{phones.seats[i] ? "Joined" : "Open"}</li>
          ))}
        </ul>
        {phones.failed && <p className="phones-error">Couldn’t open the room. Check the internet connection.</p>}
        {joinsOverLan() && <p className="join-hint">Testing locally: phones must be on the same Wi-Fi as this computer.</p>}
        {joined > 0 && (
          <p className="join-hint">When everyone’s in, the {critters[phones.seats.findIndex(Boolean)].emoji} phone taps <b>Start</b>, or start here.</p>
        )}
        <BigButton tone="primary" icon="▶" title="Start round"
          note={joined ? `${joined} phone${joined === 1 ? "" : "s"} in · keyboard players welcome too` : "Waiting for phones · keyboards work too"}
          onClick={() => start("quick")} />
        <div className="join-actions">
          <button type="button" className="btn btn-ghost" onClick={() => copyJoinLink(phones.code, phones.local)}>{linkCopied ? "Link copied ✓" : "Copy join link"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setPhones(null)}>Back to menu</button>
        </div>
      </div>
    </div>
  );

  return (
    <main className={`sh${urgent ? " sh--urgent" : ""}${playing ? " sh--playing" : ""}`} data-stage={playing ? view.stage : undefined}>
      <section className="stage" aria-label="Office">
        <div className="stage-canvas" ref={host} tabIndex={0} />

        <header className="hud">
          <div className="brand" aria-label="Shift Happens!"><span className="brand-tag">Shift</span><span className="brand-word">Happens!</span></div>
          <div className="hud-stats" aria-label="Round clock">
            <div className={`stat stat-time${urgent ? " is-urgent" : ""}`} style={{ "--left": Math.max(0, view.time) / settings.duration } as CSSProperties}>
              <span className="stat-ring" aria-hidden="true" />
              <small>Time</small>
              <strong>{clock(view.time)}</strong>
            </div>
            <div className="stat stat-stage" data-stage={view.stage}><small>Stage</small><strong>{stageNames[view.stage]}</strong></div>
            {phones && <div className="stat stat-chip" title={`Room ${phones.code}`}><small>Phones</small><strong>📱{phones.seats.filter(Boolean).length}</strong></div>}
            {playing && (
              // Touch screens only: keyboards pause with Esc, so the button stays out of the way on desktops
              <button type="button" className="icon-btn hud-pause" onClick={() => (pauseOpen ? resume() : pause())}
                aria-pressed={pauseOpen} aria-label={pauseOpen ? "Resume" : "Pause (Esc)"} title="Pause (Esc)">⏸</button>
            )}
          </div>
        </header>

        {playing && view.news && <p className="toast" role="status" key={view.news}><span aria-hidden="true">📞</span> {view.news}</p>}
        {banner && <p className="banner" data-stage={banner} role="status" key={banner}>{stageNames[banner]}</p>}

        {playing && (
          <div className="pads" aria-label="Players">
            {Array.from({ length: panelCount }, (_, critter) => {
              const player = view.players[critter];
              if (!player) return null;
              const { emoji, name, colour } = critters[critter];
              const card = player.card;
              return (
                <section className="pad-card" key={name} style={{ "--critter": colour } as CSSProperties}
                  data-lead={critter === lead} aria-label={`Player ${critter + 1}, the ${name}`}>
                  <span className="pad-avatar" aria-hidden="true">{emoji}
                    {player.stamping && <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="1" style={{ strokeDashoffset: 1 - player.stamp }} /></svg>}
                  </span>
                  <b className="pad-name">P{critter + 1}</b>
                  <Pips charges={player.charges} />
                  {player.boosted && <b className="boost-tag">BOOST</b>}
                  {card && (
                    <span className="pad-card-chip person-chip" data-kind={card.kind} data-approved={card.approved && card.kind !== "cancelled"}
                      style={{ "--role": cardColours[card.kind] } as CSSProperties} title={cardText(card, days)}>
                      {days[card.day]}{card.approved && card.kind !== "cancelled" ? " ✓" : ""}
                    </span>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {playing && solo && (
          <div className="touch" aria-label="Player 1 touch controls" onContextMenu={event => event.preventDefault()}>
            <div className="touch-stick" onPointerDown={stickDown} onPointerMove={stickMove}
              onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp}
              role="presentation">
              <span ref={knob} />
            </div>
            <div className="touch-right">
              <button type="button" className="touch-swap" onPointerDown={event => { event.preventDefault(); swap(); }}
                aria-label={`Switch to the ${critters[swapTo].name}`}>
                <span aria-hidden="true">{critters[swapTo].emoji}</span>
                <small>Swap</small>
              </button>
              {solo.card && <CardChip card={solo.card} />}
              <div className="touch-buttons">
                <button type="button" className="touch-dash" data-ready={solo.charges > 0} onPointerDown={dashDown}>Dash <Pips charges={solo.charges} /></button>
                <button type="button" className="touch-action" onPointerDown={actionDown} onLostPointerCapture={() => release("Space")}
                  onPointerUp={() => release("Space")}>
                  {solo.stamping ? "Stamping…" : solo.prompt}
                </button>
              </div>
            </div>
          </div>
        )}

        {graphics !== "ready" && (
          <div className="splash" data-state={graphics}>
            <div className="splash-logo"><span className="brand-tag">Shift</span><span className="brand-word">Happens!</span></div>
            {graphics === "failed" ? (
              <p>The office couldn’t load. Open this game in a browser with WebGL 2 turned on.</p>
            ) : (
              <><p>Overcooked, but for rostering</p><span className="splash-bar" aria-label="Loading"><span /></span></>
            )}
          </div>
        )}

        {briefLeft > 0 && (
          <Briefing open={view.strip.map(slot => slot.state !== "closed")} left={briefLeft} seats={phones ? phones.seats : null} ready={ready} onGo={briefDone} />
        )}

        {countIn && (
          <div className={`countdown${countIn === "Go!" ? " countdown--go" : ""}`} role="status" aria-live="assertive">
            <span key={countIn}>{countIn}</span>
            {countIn !== "Go!" && <small>Get ready!</small>}
          </div>
        )}

        {playing && pauseOpen && (
          <div className="screen screen--pause">
            <div className="panel panel-pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
              <p className="kicker">Paused</p>
              <h2 id="pause-title">Tea break</h2>
              <div className="end-stats">
                <span><b>{view.filled}/{view.needed}</b><small>shifts rostered</small></span>
                <span><b>{clock(view.time)}</b><small>time left</small></span>
              </div>
              <div className="pause-actions">
                <button type="button" className="btn btn-primary" onClick={resume} autoFocus>Resume</button>
                <button type="button" className="btn btn-soft" onClick={() => start()}>Restart round</button>
                <button type="button" className="btn btn-ghost" onClick={toggleSound}>Sound: {muted ? "off" : "on"}</button>
                <button type="button" className="btn btn-ghost" onClick={backToMenu}>Back to menu</button>
              </div>
              <p className="how-note">Press <kbd>Esc</kbd> to carry on.</p>
            </div>
          </div>
        )}

        {graphics === "ready" && !playing && !countIn && !briefLeft && (
          <div className={`screen${setup ? " screen--setup" : help ? " screen--help" : view.phase === "ready" ? (phones ? " screen--join" : " screen--menu") : " screen--end"}`}
            onClick={event => event.target === event.currentTarget && closeOverlay()}>
            {setup ? (
              <div className="panel panel-wide">
                {closeButton("Back to menu")}
                <TeamSetup team={team} onChange={changeTeam} onPlay={() => start("real")} onBack={() => setSetup(false)} />
              </div>
            ) : help ? (
              <div className="panel panel-help">
                {closeButton("Close how to play")}
                <p className="kicker">How to play</p>
                <h2>Move every request through the system and pin the week</h2>
                <ol className="how">
                  <li><span aria-hidden="true">📨</span><b>Request</b><small>Grab it from the tray, hold the action key at the Manager’s Desk to stamp it, pass it over the counter, then pin it on its day.</small></li>
                  <li><span aria-hidden="true">🗑️</span><b>Cancelled</b><small>Pull the red card off the board and feed it to the Shredder. A yellow open shift appears.</small></li>
                  <li><span aria-hidden="true">🟡</span><b>Open shift</b><small>It’s for one employee: their bubble flashes. Chase them down, hand it over, then pin it.</small></li>
                  <li><span aria-hidden="true">🐔</span><b>Shift Snatcher</b><small>The bin chicken nicks pinned cards. Dash into it to make it drop them.</small></li>
                  <li><span aria-hidden="true">💦</span><b>Slippery office</b><small>The leaking water cooler floods round the tray. Walk through it and you slip and drop your card. Stand still or wait for it to dry.</small></li>
                  <li><span aria-hidden="true">⚡</span><b>Dash charges</b><small>Grab ⚡ to recharge your dash, or for a speed boost when you’re full. A wobbling card is about to be cancelled.</small></li>
                </ol>
                <table className="how-table">
                  <thead><tr><th scope="col">Player</th><th scope="col">Move</th><th scope="col">Action</th><th scope="col">Dash</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">P1 🐥</th><td><kbd>WASD</kbd></td><td><kbd>Space</kbd></td><td><kbd>L-Shift</kbd></td></tr>
                    <tr><th scope="row">P2 🐰</th><td><kbd>↑ ← ↓ →</kbd></td><td><kbd>Enter</kbd></td><td><kbd>R-Shift</kbd> or <kbd>/</kbd></td></tr>
                    <tr><th scope="row">P3 🐱 P4 🐸</th><td colSpan={3}>Phones: scan the QR code under Phones</td></tr>
                  </tbody>
                </table>
                <p className="how-note">Playing alone? Press <kbd>Q</kbd> to cycle through the critters. Press <kbd>Esc</kbd> to pause.</p>
                <div className="actions">
                  <button type="button" className="btn btn-primary" onClick={() => { setHelp(false); start("quick", false); }}>Got it, let’s play</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setHelp(false)}>Back</button>
                </div>
              </div>
            ) : view.phase === "ready" && joinPanel ? (
              joinPanel
            ) : view.phase === "ready" ? (
              <div className="panel panel-menu">
                <div className="logo"><span className="brand-tag">Shift</span><span className="brand-word">Happens!</span></div>
                <p className="tagline">You’re the rostering crew at Tanda HQ. Stamp, pass and pin shifts to finish a customer’s week before time runs out.</p>
                <div className="count" role="group" aria-labelledby="count-label">
                  <p id="count-label" className="count-label">How many players?</p>
                  <div className="count-options">
                    {[2, 3, 4].map(n => (
                      <button type="button" key={n} aria-pressed={players === n} disabled={n < seatsNeeded(phoneSeats)}
                        onClick={() => setCount(n)}>
                        <span className="count-critters" aria-hidden="true">{critters.slice(0, n).map(critter => critter.emoji).join("")}</span>
                        <b>{n} players</b>
                      </button>
                    ))}
                  </div>
                  <p className="count-hint">
                    <span className="count-keys">
                      {players === 2
                        ? "The duck and bunny share one keyboard. Want 3 or 4? Pick it here, then add phones."
                        : `The duck and bunny share the keyboard. The ${players === 3 ? "cat joins" : "cat and frog join"} with ${players === 3 ? "a phone" : "phones"}: tap Phones below.`}
                    </span>
                    <span className="count-touch">Everyone else joins on their own phone: tap Phones below and they scan the code.</span>
                  </p>
                </div>
                <BigButton tone="primary" icon="▶" title="Quick play" note={`Dental clinic roster · 2 minutes · ${players} players`} onClick={() => start("quick")} />
                <BigButton tone="roster" icon="📋" title="Roster my team"
                  note={custom && savedKind ? `Continue your ${savedKind.label.toLowerCase()} week · ${team.people.length} people` : "Your staff and shifts in, a real roster out"}
                  onClick={() => setSetup(true)} />
                <div className="tiles">
                  <button type="button" className="tile" data-on={Boolean(phones)} onClick={() => (phones ? setPhones(null) : startPhones())}>
                    <span className="tile-icon tile-icon--phones" aria-hidden="true">📱</span><b>Phones</b><small>{phones ? "Turn off" : "as controllers"}</small>
                  </button>
                  <button type="button" className="tile" onClick={() => setHelp(true)}>
                    <span className="tile-icon tile-icon--help" aria-hidden="true">💡</span><b>How to play</b><small>30-second guide</small>
                  </button>
                  <button type="button" className="tile" onClick={toggleSound}>
                    <span className="tile-icon tile-icon--sound" aria-hidden="true">{muted ? "🔇" : "🔊"}</span><b>Sound</b><small>{muted ? "Off" : "On"}</small>
                  </button>
                </div>
                {phonePanel ?? (
                  <div className="share">
                    <PlayQr />
                    <p><b>Play on your phone</b>Scan to open {playUrl.replace("https://", "")}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="panel panel-end">
                <p className="kicker">{view.custom ? "Your week" : "Dental clinic roster"}</p>
                <h2 className={view.phase === "won" ? "end-won" : "end-lost"}>
                  {view.phase === "won" ? `Fully rostered with ${clock(view.time)} to spare!` : `Understaffed: ${view.filled}/${view.needed}`}
                </h2>
                <div className="end-stats">
                  <span><b>{view.filled}/{view.needed}</b><small>shifts rostered</small></span>
                  <span><b>{view.phase === "won" ? clock(view.time) : "0:00"}</b><small>time to spare</small></span>
                  <span><b>{Math.round(progress * 100)}%</b><small>covered</small></span>
                </div>
                <Stats stats={view.stats} />
                {endAwards.length > 0 && (
                  <ul className="awards" aria-label="Awards">
                    {endAwards.map(award => (
                      <li key={award.stat}>
                        <span aria-hidden="true">{award.winners.map(i => critters[i].emoji).join("")}</span>
                        <b>{award.title}</b>
                        <small>{award.winners.map(i => critters[i].name[0].toUpperCase() + critters[i].name.slice(1)).join(" & ")} · {award.best} {award.unit[award.best === 1 ? 0 : 1]}</small>
                      </li>
                    ))}
                  </ul>
                )}
                <RosterTable view={view} />
                <div className="actions">
                  <button type="button" className="btn btn-soft" onClick={copyRoster}>{copied ? "Copied ✓" : "Copy roster"}</button>
                  {view.custom && <button type="button" className="btn btn-soft" onClick={() => setSetup(true)}>Edit team</button>}
                  <button type="button" className="btn btn-ghost" onClick={backToMenu}>Menu</button>
                  <button type="button" className="btn btn-primary" onClick={() => start()}>Play again</button>
                </div>
                {phonePanel}
              </div>
            )}
          </div>
        )}

        {graphics === "ready" && view.phase === "ready" && !setup && !help && !countIn && !briefLeft && !phones && (
          <p className="ticker" key={tip}><b>Tip</b><span>{tips[tip]}</span></p>
        )}
      </section>
    </main>
  );
}
