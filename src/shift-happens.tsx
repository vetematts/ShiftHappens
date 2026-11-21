import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createOfficeWorld } from "./office-world";
import {
  beginRound, dayRange, days, dropCarried, ensurePlayers, filledShifts, interact, maxPlayers, minPlayers, neededShifts,
  newRound, nextAction, roleIn, roster, sampleTeam, settings, stageAt, stepRound, stopStamp, templates, walk,
  type PlayerStats, type Round, type Team,
} from "./round";
import { copyTeam, loadTeam, saveTeam, TeamSetup } from "./team-setup";
import PhoneController from "./phone-controller";
import { joinUrl, makeRoomCode, openLink, readJoin, wantsLocalLink, type Link, type Message } from "./phone-link";
import { PlayQr, playUrl, QrCode } from "./play-qr";
import { createSound, type Sound } from "./sound";

const keyboards = [
  { up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD", use: "Space", guide: "WASD", action: "Space" },
  { up: "ArrowUp", left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", use: "Enter", guide: "↑ ← ↓ →", action: "Enter" },
];
const swapKey = "KeyQ";
const gameKeys = [...keyboards.flatMap(({ up, left, down, right, use }) => [up, left, down, right, use]), swapKey];
/** Players 1 to 4. Keyboards drive the duck and the bunny; phones can drive all four. */
const critters = [
  { name: "duck", label: "Duck", emoji: "🐥" },
  { name: "bunny", label: "Bunny", emoji: "🐰" },
  { name: "cat", label: "Cat", emoji: "🐱" },
  { name: "frog", label: "Frog", emoji: "🐸" },
];
const stickReach = 46;
const emptySeats = () => Array.from({ length: maxPlayers }, () => null as string | null);
const stillInputs = () => Array.from({ length: maxPlayers }, () => ({ x: 0, y: 0, act: false }));

/** Fun titles for the results, each going to whoever did the most of one job. Ties share the award. */
const awardList = [
  { stat: "rostered", title: "Roster Royalty", unit: ["shift rostered", "shifts rostered"] },
  { stat: "signed", title: "Stamp Addict", unit: ["sign-on", "sign-ons"] },
  { stat: "passed", title: "Pass Master", unit: ["pass over the counter", "passes over the counter"] },
  { stat: "shooed", title: "Chicken Wrangler", unit: ["bin chicken stopped", "bin chickens stopped"] },
] as const;

function partyAwards(players: { stats: PlayerStats }[]) {
  return awardList.flatMap(award => {
    const best = Math.max(0, ...players.map(player => player.stats[award.stat]));
    if (!best) return [];
    const winners = players.flatMap((player, i) => (player.stats[award.stat] === best ? [i] : []));
    return [{ ...award, best, winners }];
  });
}

const tips = [
  "Staff wear caps in their role colour. Match the cap to the shift on the board.",
  "Name tags show the days someone can work and the shifts they have left.",
  "Sign someone on once at the desk. After that they go straight to the counter.",
  "A sick call empties that person’s whole day. Refill it fast.",
  "Playing alone? Press Q to swap between the duck and the bunny.",
  "Roster my team works for cafés, clinics, salons or anything with shifts.",
  "Up to four can play: select Phones and everyone scans the QR code.",
];

function clock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function snapshot(round: Round) {
  return {
    phase: round.phase,
    time: round.duration - round.elapsed,
    duration: round.duration,
    stage: settings.pace[stageAt(round)].name,
    filled: filledShifts(round),
    needed: neededShifts(round),
    roles: round.roles,
    shiftNames: round.shiftNames,
    slots: round.slots,
    custom: round.custom,
    names: roster(round).map(person => person?.name ?? ""),
    news: round.news.until > round.elapsed ? round.news.text : "",
    players: round.players.map((player, i) => ({
      carrying: player.carrying ? player.carrying.name : "",
      works: player.carrying ? dayRange(player.carrying.days.map((on, day) => on && !player.carrying!.off[day])) : "",
      colour: player.carrying ? roleIn(round.roles, player.carrying.role).colour : "",
      approved: player.carrying?.approved ?? false,
      stamp: player.stamping ? (player.carrying?.stamp ?? 0) / settings.stampTime : 0,
      stamping: player.stamping,
      prompt: player.messageUntil > round.elapsed ? player.message : nextAction(round, i),
      stats: { ...player.stats },
    })),
  };
}
type View = ReturnType<typeof snapshot>;

/** Places on one shift, with who fills them. */
const placesOn = (view: Pick<View, "slots" | "names">, shift: number) =>
  view.slots.map((slot, i) => ({ slot, name: view.names[i] })).filter(({ slot }) => slot.shift === shift);

function rosterText(view: View) {
  const line = (day: number) => [day, day + 7].map(shift => {
    const places = placesOn(view, shift);
    if (!places.length) return "";
    const people = places.map(({ slot, name }) => `${name || "open"} (${roleIn(view.roles, slot.role).label})`).join(", ");
    return `${view.shiftNames[shift < 7 ? 0 : 1]}: ${people}`;
  }).filter(Boolean).join(" · ") || "closed";
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
                const places = placesOn(view, d + half * 7);
                if (!places.length) return <td key={day} data-closed="true" title="Closed">–</td>;
                return (
                  <td key={day}>
                    {places.map(({ slot, name: person }, i) => {
                      const { colour, label } = roleIn(view.roles, slot.role);
                      return (
                        <span key={i} className="roster-chip" data-open={!person} style={{ "--role": colour } as CSSProperties}
                          title={label}>{person || label}</span>
                      );
                    })}
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
  // Player 1's controls (WASD, Space and the touch controls) drive this critter. Swapping lets one person play both.
  const active = useRef(0);
  // Which critter to mark and follow: always on touch screens, and on keyboards once someone swaps.
  const focus = useRef<number | null>(null);
  const holding = useRef(new Map<string, number>());
  const [lead, setLead] = useState(0);
  const [view, setView] = useState(() => snapshot(newRound()));
  const [graphics, setGraphics] = useState<"loading" | "ready" | "failed">("loading");
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [team, setTeam] = useState<Team>(() => copyTeam(sampleTeam));
  const [setup, setSetup] = useState(false);
  const [help, setHelp] = useState(false);
  const [tip, setTip] = useState(0);
  const lastMode = useRef<"quick" | "real">("quick");
  // Phones as controllers: seat 0 is the duck, 1 the bunny, 2 the cat and 3 the frog
  const [phones, setPhones] = useState<Phones | null>(null);
  const phoneLink = useRef<Link | null>(null);
  const seats = useRef(emptySeats());
  const remote = useRef(stillInputs());

  function copyRoster() {
    navigator.clipboard?.writeText(rosterText(view)).then(() => setCopied(true), () => setCopied(false));
  }

  function copyJoinLink(code: string, local: boolean) {
    navigator.clipboard?.writeText(joinUrl(code, local)).then(() => setLinkCopied(true), () => setLinkCopied(false));
  }

  /** One critter per seat up to the last phone that joined, and never fewer than the two keyboard players. */
  function playerCount() {
    return Math.max(minPlayers, seats.current.reduce((last, peer, i) => (peer ? i + 1 : last), 0));
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

  function press(code: string) {
    sound.current?.unlock();
    if (round.current.phase !== "playing" || keys.current.has(code)) return;
    keys.current.add(code);
    if (code === swapKey) {
      swap();
      return;
    }
    if (code.startsWith("Phone")) {
      const critter = Number(code.slice(5));
      if (!round.current.players[critter]) return;
      holding.current.set(code, critter);
      interact(round.current, critter);
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
    const player = critter === undefined ? undefined : round.current.players[critter];
    if (player) stopStamp(player);
  }

  // Keyboard listeners live in an effect, so they reach the latest press and release through effect events.
  const onKeyDown = useEffectEvent((code: string) => press(code));
  const onKeyUp = useEffectEvent((code: string) => release(code));

  function seatPhone(peer: string) {
    let seat = seats.current.indexOf(peer);
    if (seat === -1) {
      seat = seats.current.indexOf(null);
      if (seat !== -1) seats.current[seat] = peer;
      setPhones(current => current && { ...current, seats: [...seats.current] });
    }
    // A third or fourth phone brings its critter into the office straight away, even mid-round
    if (seat !== -1 && seat >= round.current.players.length) {
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
    remote.current[seat] = { x: 0, y: 0, act: false };
    release(`Phone${seat}`);
    // Whoever they were carrying is put down, so nobody the team needs gets stuck in a missing player's arms
    dropCarried(round.current, seat);
    setPhones(current => current && { ...current, seats: [...seats.current] });
  });
  const onPhoneMessage = useEffectEvent((message: Message, peer: string) => {
    if (message.t === "start") {
      if (round.current.phase !== "playing" && !setup) start();
      return;
    }
    if (message.t !== "input") return;
    const seat = seats.current.includes(peer) ? seats.current.indexOf(peer) : seatPhone(peer);
    if (seat < 0) return;
    const input = remote.current[seat];
    const clamp = (value: number) => Math.max(-1, Math.min(1, Number(value) || 0));
    input.x = clamp(message.x);
    input.y = clamp(message.y);
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
      remote.current = stillInputs();
    };
  }, [roomCode, roomLocal]);

  function startPhones() {
    sound.current?.unlock();
    setLinkCopied(false);
    setPhones({ code: makeRoomCode(), local: wantsLocalLink(), seats: emptySeats(), failed: false });
  }

  function swap() {
    if (round.current.phase !== "playing") return;
    const previous = active.current;
    holding.current.forEach((critter, code) => {
      if (critter !== previous || code !== keyboards[0].use) return;
      stopStamp(round.current.players[critter]);
      holding.current.delete(code);
      keys.current.delete(code);
    });
    active.current = 1 - previous;
    focus.current = active.current;
    setLead(active.current);
    sound.current?.play("swap");
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
    let world: ReturnType<typeof createOfficeWorld> | undefined;
    let frame: number;
    let previous = performance.now();
    let lastUi = 0;
    let lastBroadcast = 0;
    let displayedPhase: Round["phase"] | undefined;
    let displayedRound: Round | undefined;

    function loop(now: number) {
      const state = round.current;
      const seconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      if (state.phase === "playing" && world) {
        const moves = state.players.map(() => ({ across: 0, downward: 0 }));
        const pressed = keys.current;
        keyboards.forEach(({ up, left, down, right }, i) => {
          const move = moves[i === 0 ? active.current : 1];
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
      }
      world?.draw(state, focus.current);
      // Tell each phone what its critter is doing, about five times a second
      if (phoneLink.current && now - lastBroadcast >= 200) {
        lastBroadcast = now;
        const latest = snapshot(state);
        seats.current.forEach((peer, i) => {
          const player = latest.players[i];
          if (!peer || !player) return;
          phoneLink.current!.send({
            t: "status", phase: state.phase, prompt: player.prompt, carrying: player.carrying, colour: player.colour,
            approved: player.approved, stamping: player.stamping, time: latest.time, filled: latest.filled,
            needed: latest.needed, news: latest.news,
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
      round.current.players.forEach(stopStamp);
    }

    // Draw the office once the rounded font is in, so its signs and name tags use it (or after a second regardless)
    let cancelled = false;
    const fontReady = Promise.race([document.fonts.load('700 32px "Fredoka Variable"'), new Promise(done => setTimeout(done, 1000))]);
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
      world?.dispose();
    };
  }, []);

  function start(mode: "quick" | "real" = lastMode.current) {
    lastMode.current = mode;
    setSetup(false);
    sound.current?.unlock();
    keys.current.clear();
    holding.current.clear();
    active.current = 0;
    if (focus.current !== null) focus.current = 0;
    setLead(0);
    setCopied(false);
    const state = mode === "real"
      ? newRound({
        ...team,
        roles: team.roles.map((role, i) => ({ ...role, label: role.label.trim() || `Role ${i + 1}` })),
        shiftNames: [team.shiftNames[0].trim() || "AM", team.shiftNames[1].trim() || "PM"],
        people: team.people.filter(person => person.name.trim()).map(person => ({ ...person, name: person.name.trim() })),
      }, true, playerCount())
      : newRound(sampleTeam, false, playerCount());
    beginRound(state);
    round.current = state;
    setView(snapshot(state));
    host.current?.focus({ preventScroll: true });
  }

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

  const urgent = view.time <= 20 && view.phase === "playing";
  const awards = view.phase === "won" || view.phase === "lost" ? partyAwards(view.players) : [];
  const solo = view.players[lead];
  const playing = view.phase === "playing";
  const savedKind = templates.find(template => template.id === team.kind);
  const custom = team.kind !== "cafe" || team.people.length !== sampleTeam.people.length;
  const progress = view.needed ? view.filled / view.needed : 0;
  const dayCounts = days.map((_, d) => {
    const places = [d, d + 7].flatMap(shift => placesOn(view, shift));
    return { need: places.length, have: places.filter(place => place.name).length };
  });

  const phonePanel = phones && (
    <div className="phones">
      <QrCode text={joinUrl(phones.code, phones.local)} label={`QR code to join room ${phones.code} with a phone`} />
      <div>
        <strong>Scan to join with your phone</strong>
        <p>Room <b className="phones-code">{phones.code}</b>{phones.local ? " · same-browser test" : ""} · up to {maxPlayers} players</p>
        <ul>
          {critters.map(({ name, label, emoji }, i) => (
            <li key={name} data-on={Boolean(phones.seats[i])}>
              {emoji} {label}: {phones.seats[i] ? "phone connected" : i < minPlayers ? "keyboard, or waiting for a phone…" : "waiting for a phone…"}
            </li>
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

  return (
    <main className={`sh${urgent ? " sh--urgent" : ""}${playing ? " sh--playing" : ""}`}>
      <section className="stage" aria-label="Office">
        <div className="stage-canvas" ref={host} tabIndex={0} />

        <header className="hud">
          <div className="brand" aria-label="Shift Happens!"><span className="brand-tag">Shift</span><span className="brand-word">Happens!</span></div>
          <div className="hud-stats" aria-label="Round score">
            <div className="stat stat-covered">
              <small>Covered</small>
              <strong>{view.filled}<i>/{view.needed}</i></strong>
              <span className="stat-bar" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></span>
            </div>
            <div className={`stat stat-time${urgent ? " is-urgent" : ""}`} style={{ "--left": view.time / view.duration } as CSSProperties}>
              <span className="stat-ring" aria-hidden="true" />
              <small>{view.phase === "playing" ? view.stage : "Time"}</small>
              <strong>{clock(view.time)}</strong>
            </div>
            {phones && <div className="stat stat-chip" title={`Room ${phones.code}`}><small>Phones</small><strong>📱{phones.seats.filter(Boolean).length}</strong></div>}
            <button type="button" className="icon-btn" onClick={toggleSound}
              aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "🔇" : "🔊"}</button>
          </div>
        </header>

        {playing && (
          <ol className="week-strip" aria-label="Shifts covered each day">
            {days.map((day, d) => {
              const { need, have } = dayCounts[d];
              return (
                <li key={day} data-state={!need ? "closed" : have === need ? "done" : "open"}>
                  <b>{day}</b>
                  <span>{need ? `${have}/${need}` : "–"}</span>
                </li>
              );
            })}
          </ol>
        )}

        {playing && view.news && <p className="toast" role="status" key={view.news}><span aria-hidden="true">📞</span> {view.news}</p>}

        {playing && (
          <div className="pads" data-count={view.players.length} aria-label="Player controls">
            {keyboards.map(({ guide, action }, i) => {
              // Player 1's keys follow whichever critter they have swapped to.
              const critter = i === 0 ? lead : 1;
              const player = view.players[critter];
              return (
                <section className="pad-card" data-critter={critter} key={action} aria-label={`Player ${i + 1}, controlling the ${critters[critter].name}`}>
                  <span className="pad-avatar" aria-hidden="true">{critters[critter].emoji}
                    {player.stamping && <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="1" style={{ strokeDashoffset: 1 - player.stamp }} /></svg>}
                  </span>
                  <div>
                    <div className="pad-keys"><kbd>{guide}</kbd> <kbd>{action}</kbd>{i === 0 && <> <kbd>Q</kbd> swap</>}</div>
                    <p className="pad-prompt">
                      {player.carrying && <span className="person-chip" style={{ "--role": player.colour } as CSSProperties}>{player.carrying}{player.approved ? " ✓" : ""}</span>}
                      <span>{player.stamping ? "Stamping…" : player.prompt}</span>
                    </p>
                  </div>
                </section>
              );
            })}
            {/* The cat and the frog only play from phones */}
            {view.players.slice(keyboards.length).map((player, n) => {
              const critter = n + keyboards.length;
              return (
                <section className="pad-card" data-critter={critter} key={critters[critter].name} aria-label={`Player ${critter + 1}, the ${critters[critter].name} on a phone`}>
                  <span className="pad-avatar" aria-hidden="true">{critters[critter].emoji}
                    {player.stamping && <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="1" style={{ strokeDashoffset: 1 - player.stamp }} /></svg>}
                  </span>
                  <div>
                    <div className="pad-keys">📱 {phones?.seats[critter] ? "On a phone" : "Phone disconnected"}</div>
                    <p className="pad-prompt">
                      {player.carrying && <span className="person-chip" style={{ "--role": player.colour } as CSSProperties}>{player.carrying}{player.approved ? " ✓" : ""}</span>}
                      <span>{player.stamping ? "Stamping…" : player.prompt}</span>
                    </p>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {playing && (
          <div className="touch" aria-label="Player 1 touch controls" onContextMenu={event => event.preventDefault()}>
            <div className="touch-stick" onPointerDown={stickDown} onPointerMove={stickMove}
              onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp}
              role="presentation">
              <span ref={knob} />
            </div>
            <div className="touch-right">
              <button type="button" className="touch-swap" onPointerDown={event => { event.preventDefault(); swap(); }}
                aria-label={`Switch to the ${critters[1 - lead].name}`}>
                <span aria-hidden="true">{critters[1 - lead].emoji}</span>
                <small>Swap</small>
              </button>
              {solo.carrying && (
                <b className="person-chip" style={{ "--role": solo.colour } as CSSProperties}>{solo.carrying}{solo.approved ? " ✓" : ""} · {solo.works}</b>
              )}
              <button type="button" className="touch-action" onPointerDown={actionDown} onLostPointerCapture={() => release("Space")}
                onPointerUp={() => release("Space")}>
                {solo.stamping ? "Stamping…" : solo.prompt}
              </button>
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

        {graphics === "ready" && !playing && (
          <div className={`screen${setup ? " screen--setup" : help ? " screen--help" : view.phase === "ready" ? " screen--menu" : " screen--end"}`}>
            {setup ? (
              <div className="panel panel-wide">
                <TeamSetup team={team} onChange={changeTeam} onPlay={() => start("real")} onBack={() => setSetup(false)} />
              </div>
            ) : help ? (
              <div className="panel panel-help">
                <p className="kicker">How to play</p>
                <h2>Cover every shift before the clock runs out</h2>
                <ol className="how">
                  <li><span aria-hidden="true">🙋</span><b>Grab</b><small>Pick up someone waiting at the table.</small></li>
                  <li><span aria-hidden="true">✍️</span><b>Sign on</b><small>Hold the action key at the desk. Once per person.</small></li>
                  <li><span aria-hidden="true">🤝</span><b>Pass</b><small>Put them on the counter for the other critter.</small></li>
                  <li><span aria-hidden="true">📌</span><b>Roster</b><small>At the board, pin them on a day they work, in a shift for their role.</small></li>
                </ol>
                <div className="how-keys">
                  <span>🐥 <kbd>WASD</kbd> + <kbd>Space</kbd></span>
                  <span>🐰 <kbd>↑ ← ↓ →</kbd> + <kbd>Enter</kbd></span>
                  <span>🐱 🐸 on phones</span>
                  <span>Solo? <kbd>Q</kbd> swaps critters</span>
                </div>
                <p className="how-note">Caps show each person’s role. Name tags show their days and shifts left. Sick calls knock people off the board, so watch the phone.</p>
                <div className="actions">
                  <button type="button" className="btn btn-primary" onClick={() => { setHelp(false); start("quick"); }}>Got it, let’s play</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setHelp(false)}>Back</button>
                </div>
              </div>
            ) : view.phase === "ready" ? (
              <div className="panel panel-menu">
                <div className="logo"><span className="brand-tag">Shift</span><span className="brand-word">Happens!</span></div>
                <p className="tagline">Overcooked, but for rostering. Play the chaos, get a real roster.</p>
                <BigButton tone="primary" icon="▶" title="Quick play" note="Sample café · 3 minutes · 1–4 players" onClick={() => start("quick")} />
                <BigButton tone="roster" icon="📋" title="Roster my team"
                  note={custom && savedKind ? `Continue your ${savedKind.label.toLowerCase()} week · ${team.people.length} people` : "Your staff and shifts in, a real roster out"}
                  onClick={() => setSetup(true)} />
                <div className="tiles">
                  <button type="button" className="tile" data-on={Boolean(phones)} onClick={() => (phones ? setPhones(null) : startPhones())}>
                    <span className="tile-icon tile-icon--phones" aria-hidden="true">📱</span><b>Phones</b><small>{phones ? "Turn off" : "2–4 players"}</small>
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
                <p className="kicker">{view.custom ? "Your week" : "Sample café"}</p>
                <h2 className={view.phase === "won" ? "end-won" : "end-lost"}>{view.phase === "won" ? "Week covered!" : "Understaffed"}</h2>
                <div className="end-stats">
                  <span><b>{view.filled}/{view.needed}</b><small>places filled</small></span>
                  <span><b>{view.phase === "won" ? clock(view.time) : "0:00"}</b><small>time to spare</small></span>
                  <span><b>{Math.round(progress * 100)}%</b><small>covered</small></span>
                </div>
                <RosterTable view={view} />
                {awards.length > 0 && (
                  <ul className="awards" aria-label="Awards">
                    {awards.map(award => (
                      <li key={award.stat}>
                        <span aria-hidden="true">{award.winners.map(i => critters[i].emoji).join("")}</span>
                        <b>{award.title}</b>
                        <small>{award.winners.map(i => critters[i].label).join(" & ")} · {award.best} {award.unit[award.best === 1 ? 0 : 1]}</small>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="actions">
                  <button type="button" className="btn btn-soft" onClick={copyRoster}>{copied ? "Copied ✓" : "Copy roster"}</button>
                  {view.custom && <button type="button" className="btn btn-soft" onClick={() => setSetup(true)}>Edit team</button>}
                  <button type="button" className="btn btn-ghost" onClick={() => { round.current = newRound(sampleTeam, false, playerCount()); setView(snapshot(round.current)); }}>Menu</button>
                  <button type="button" className="btn btn-primary" onClick={() => start()}>Play again</button>
                </div>
                {phonePanel}
              </div>
            )}
          </div>
        )}

        {graphics === "ready" && view.phase === "ready" && !setup && !help && (
          <p className="ticker" key={tip}><b>Tip</b><span>{tips[tip]}</span></p>
        )}
      </section>
    </main>
  );
}
