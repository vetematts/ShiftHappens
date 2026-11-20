import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createOfficeWorld } from "./office-world";
import {
  beginRound, cardIn, dash, days, filledShifts, heldCard, interact, neededShifts, newRound, nextAction, roleOf, roster,
  sampleTeam, settings, shifts, stepRound, stopStamp, walk,
  type CardKind, type Role, type Round, type Stage, type Team,
} from "./round";
import { copyTeam, loadTeam, saveTeam, TeamSetup } from "./team-setup";
import PhoneController from "./phone-controller";
import { cardColours, critters, joinUrl, makeRoomCode, openLink, readJoin, wantsLocalLink, type Link, type Message } from "./phone-link";
import { PlayQr, playUrl, QrCode } from "./play-qr";
import { createSound, type Sound } from "./sound";

const keyboards = [
  { up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD", use: "Space", dash: ["ShiftLeft"], guide: "WASD", action: "Space", dashGuide: "L-Shift" },
  { up: "ArrowUp", left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", use: "Enter", dash: ["ShiftRight", "Slash"], guide: "↑ ← ↓ →", action: "Enter", dashGuide: "R-Shift" },
];
const swapKey = "KeyQ";
const gameKeys = [...keyboards.flatMap(({ up, left, down, right, use, dash }) => [up, left, down, right, use, ...dash]), swapKey];
const kindNames: Record<CardKind, string> = { request: "Request", open: "Open shift", cancelled: "Cancelled" };
const stageNames: Record<Stage, string> = { calm: "Calm", busy: "Busy!", chaos: "Chaos!" };
const stageStart: Record<Stage, number> = { calm: 0, busy: settings.busyAt, chaos: settings.chaosAt };
const newInput = () => ({ x: 0, y: 0, act: false, dash: false });
const emptySeats = (): (string | null)[] => critters.map(() => null);
const awards = [
  { stat: "stamped", title: "Stamp Addict" },
  { stat: "shredded", title: "Shredder Supreme" },
  { stat: "rescues", title: "Chicken Wrangler" },
  { stat: "pinned", title: "Pin Master" },
  { stat: "accepted", title: "Staff Whisperer" },
] as const;
const stickReach = 46;

function clock(seconds: number) {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

type SlotView = { state: "closed" | "empty" | "filled" | "cancelled"; name: string };

function snapshot(round: Round) {
  const names = roster(round).map(person => person?.name ?? "");
  return {
    phase: round.phase,
    time: settings.duration - round.elapsed,
    elapsed: round.elapsed,
    stage: round.stage,
    filled: filledShifts(round),
    needed: neededShifts(round),
    week: round.week,
    custom: round.custom,
    slots: names,
    strip: shifts.map((_, slot): SlotView => {
      if (!round.needed[slot]) return { state: "closed", name: "" };
      if (cardIn(round, slot)?.kind === "cancelled") return { state: "cancelled", name: "" };
      return names[slot] ? { state: "filled", name: names[slot] } : { state: "empty", name: "" };
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
        dashReady: round.elapsed >= player.dashReady,
        prompt: player.messageUntil > round.elapsed ? player.message : nextAction(round, i),
      };
    }),
  };
}

type View = ReturnType<typeof snapshot>;
type HeldCard = View["players"][number]["card"];

function CardChip({ card }: { card: NonNullable<HeldCard> }) {
  return (
    <span className="shifts-person" data-kind={card.kind} style={{ "--role": cardColours[card.kind] } as CSSProperties}>
      {kindNames[card.kind]} · {days[card.day]}{card.worker ? ` · ${card.worker}` : ""}{card.approved ? " ✓" : ""}
    </span>
  );
}

function Stats({ stats }: { stats: View["stats"] }) {
  const winners = awards.map(({ stat, title }) => {
    const best = Math.max(...stats.map(entry => entry[stat]));
    return { title, player: best > 0 ? stats.findIndex(entry => entry[stat] === best) : -1 };
  });
  return (
    <table className="shifts-stats">
      <thead>
        <tr><th scope="col"><span className="sr-only">Critter</span></th>
          <th scope="col">Pinned</th><th scope="col">Stamped</th><th scope="col">Shredded</th><th scope="col">Accepted</th><th scope="col">Rescues</th></tr>
      </thead>
      <tbody>
        {stats.map((entry, i) => (
          <tr key={critters[i].name}>
            <th scope="row"><span style={{ background: critters[i].colour }}>{critters[i].emoji}</span>
              <small>{winners.filter(win => win.player === i).map(win => win.title).join(" · ") || "Team player"}</small></th>
            <td>{entry.pinned}</td><td>{entry.stamped}</td><td>{entry.shredded}</td><td>{entry.accepted}</td><td>{entry.rescues}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function rosterText(slots: string[], week: (Role | null)[]) {
  const line = (day: number) => [day, day + days.length].filter(slot => week[slot])
    .map(slot => `${shifts[slot].half} ${roleOf(week[slot]!).label}: ${slots[slot] || "open"}`).join(" · ") || "closed";
  return ["Shift Happens! roster", ...days.map((day, i) => `${day}  ${line(i)}`)].join("\n");
}

function RosterTable({ slots, week }: { slots: string[]; week: (Role | null)[] }) {
  return (
    <table className="shifts-roster">
      <thead><tr><th scope="col"><span className="sr-only">Shift</span></th>{days.map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>
        {(["AM", "PM"] as const).map((half, row) => (
          <tr key={half}>
            <th scope="row">{half}</th>
            {days.map((day, i) => {
              const slot = i + row * days.length;
              const role = week[slot];
              if (!role) return <td key={day} data-closed="true" title="Not needed">–</td>;
              const { colour, label } = roleOf(role);
              return (
                <td key={day} data-open={!slots[slot]} style={{ "--role": colour } as CSSProperties} title={label}>
                  {slots[slot] || "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
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

/** Critters needed so every connected phone has a seat. */
const seatsNeeded = (seats: (string | null)[]) => seats.reduce((most, peer, i) => (peer ? i + 1 : most), 0);

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
  const [count, setCount] = useState(2);
  const [view, setView] = useState(() => snapshot(newRound()));
  const [graphics, setGraphics] = useState<"loading" | "ready" | "failed">("loading");
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [team, setTeam] = useState<Team>(() => copyTeam(sampleTeam));
  const [setup, setSetup] = useState(false);
  const lastMode = useRef<"quick" | "real">("quick");
  // Phones as controllers: seats 0–3 are the duck, bunny, cat and frog, in join order
  const [phones, setPhones] = useState<Phones | null>(null);
  const phoneLink = useRef<Link | null>(null);
  const seats = useRef<(string | null)[]>(emptySeats());
  const remote = useRef(critters.map(newInput));

  function copyRoster(slots: string[], week: (Role | null)[]) {
    navigator.clipboard?.writeText(rosterText(slots, week)).then(() => setCopied(true), () => setCopied(false));
  }

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
      holding.current.set(code, critter);
      interact(round.current, critter);
      return;
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
    if (message.dash && !input.dash && round.current.phase === "playing") dash(round.current, seat);
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

  function usePhones() {
    sound.current?.unlock();
    setPhones({ code: makeRoomCode(), local: wantsLocalLink(), seats: emptySeats(), failed: false });
  }

  function swap() {
    if (round.current.phase !== "playing") return;
    const previous = active.current;
    holding.current.forEach((critter, code) => {
      if (critter !== previous || code !== keyboards[0].use) return;
      stopStamp(round.current, critter);
      holding.current.delete(code);
      keys.current.delete(code);
    });
    active.current = (previous + 1) % round.current.players.length;
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
    let lastTick = Infinity;

    function loop(now: number) {
      const state = round.current;
      const seconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      if (state.phase === "playing" && world) {
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
      } else {
        lastTick = Infinity;
      }
      world?.draw(state, focus.current);
      // Tell each phone what its critter is doing, about five times a second
      if (phoneLink.current && now - lastBroadcast >= 200) {
        lastBroadcast = now;
        const latest = snapshot(state);
        seats.current.forEach((peer, i) => {
          if (!peer) return;
          const player = latest.players[i];
          phoneLink.current!.send({
            t: "status", phase: state.phase, prompt: player?.prompt ?? "", card: player?.card ?? null, stage: latest.stage,
            stamping: player?.stamping ?? false, stamp: player?.stamp ?? 0, dashReady: player?.dashReady ?? true,
            time: latest.time, filled: latest.filled, needed: latest.needed, news: latest.news,
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
      round.current.players.forEach((_, i) => stopStamp(round.current, i));
    }

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
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);
    return () => {
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
    const total = Math.max(count, seatsNeeded(seats.current));
    const state = mode === "real"
      ? newRound({ ...team, people: team.people.filter(person => person.name.trim()).map(person => ({ ...person, name: person.name.trim() })) }, true, total)
      : newRound(sampleTeam, false, total);
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

  function dashDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    sound.current?.unlock();
    dash(round.current, active.current);
  }

  const urgent = view.time <= 10 && view.phase === "playing";
  const solo = view.players[lead] ?? view.players[0];
  const players = Math.max(count, seatsNeeded(phones?.seats ?? []));
  const banner = view.phase === "playing" && view.stage !== "calm" && view.elapsed - stageStart[view.stage] < 2.6 ? view.stage : null;

  return (
    <main className="shifts">
      <header className="shifts-head">
        <h1>Shift Happens<span>!</span></h1>
        <div className="shifts-score" aria-label="Round score">
          <span className={urgent ? "shifts-urgent" : undefined}>
            <small>Time left</small><strong>{clock(view.time)}</strong>
          </span>
          <span><small>Roster</small><strong>{view.filled}<i> / {view.needed}</i></strong></span>
          {view.phase === "playing" && <span className="shifts-stage" data-stage={view.stage}><small>Stage</small><strong>{stageNames[view.stage]}</strong></span>}
          {phones && <span className="shifts-phone-chip" title={`Room ${phones.code}`}><small>Phones</small><strong>📱 {phones.seats.filter(Boolean).length}</strong></span>}
          <button type="button" className="shifts-sound" onClick={toggleSound}
            aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "🔇" : "🔊"}</button>
        </div>
      </header>

      <section className="shifts-board" aria-label="Weekly roster">
        {days.map((day, i) => (
          <div className="shifts-day" key={day}>
            <b>{day}</b>
            {([i, i + days.length]).map(index => {
              const slot = view.strip[index];
              const role = view.week[index];
              const { colour, label } = role ? roleOf(role) : { colour: "#bdb4d1", label: "" };
              const text = slot.state === "filled" ? slot.name : slot.state === "cancelled" ? "Cancelled" : slot.state === "empty" ? label || "Open" : "–";
              return (
                <span key={index} data-state={slot.state} style={{ "--role": colour } as CSSProperties}
                  aria-label={`${shifts[index].label}: ${slot.state === "filled" ? slot.name : slot.state === "closed" ? "not needed" : slot.state}`}>
                  <span>{shifts[index].half}</span><em>{text}</em>
                </span>
              );
            })}
          </div>
        ))}
      </section>

      <section className={urgent ? "shifts-game shifts-game--urgent" : "shifts-game"} aria-label="Office">
        <div className="shifts-floor" ref={host} tabIndex={0} />
        {view.phase === "playing" && view.news && <p className="shifts-news" role="status">📞 {view.news}</p>}
        {banner && <p className="shifts-banner" data-stage={banner} role="status" key={banner}>{stageNames[banner]}</p>}
        {view.phase === "playing" && (
          <div className="shifts-touch" aria-label="Player 1 touch controls">
            <div className="shifts-stick" onPointerDown={stickDown} onPointerMove={stickMove}
              onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp}
              role="presentation">
              <span ref={knob} />
            </div>
            <div className="shifts-action">
              <button type="button" className="shifts-swap" onPointerDown={event => { event.preventDefault(); swap(); }}
                aria-label={`Switch to the ${critters[(lead + 1) % view.players.length].name}`}>
                <span aria-hidden="true">{critters[(lead + 1) % view.players.length].emoji}</span>
                <small>Swap</small>
              </button>
              {solo.card && <CardChip card={solo.card} />}
              <button type="button" className="shifts-dash" data-ready={solo.dashReady} onPointerDown={dashDown}>Dash</button>
              <button type="button" onPointerDown={actionDown} onLostPointerCapture={() => release("Space")}
                onPointerUp={() => release("Space")}>
                {solo.stamping ? "Stamping…" : solo.prompt}
              </button>
            </div>
          </div>
        )}
        {(view.phase !== "playing" || graphics === "failed") && (
          <div className={setup ? "shifts-overlay shifts-overlay--setup" : "shifts-overlay"}>
            <div>
              {graphics === "failed" ? (
                <><h2>Office couldn’t load</h2><p>Open this game in a browser with WebGL 2 enabled.</p></>
              ) : setup ? (
                <TeamSetup team={team} onChange={changeTeam} onPlay={() => start("real")} onBack={() => setSetup(false)} />
              ) : view.phase === "ready" ? (
                <>
                  <h2>Shift Happens!</h2>
                  <p>You’re helper critters inside the rostering system. Employees keep sending in shift requests, and it’s your job to move every card through the system and pin the whole week on the Roster Board before the clock runs out.</p>
                  <div className="shifts-how">
                    <h3>How to play</h3>
                    <ol>
                      <li><b className="shifts-dot" data-kind="request" /> <strong>Request:</strong> grab it from the tray, hold the action key at the Manager’s Desk to stamp it, pass it over the counter, then pin it on its day.</li>
                      <li><b className="shifts-dot" data-kind="cancelled" /> <strong>Cancelled:</strong> pull the red card off the board and feed it to the Shredder. A yellow Open Shift appears.</li>
                      <li><b className="shifts-dot" data-kind="open" /> <strong>Open Shift:</strong> take it to the Staff Room, give it to someone free that day, then pin it.</li>
                      <li>🐔 <strong>Shift Snatcher</strong> (the bin chicken) nicks pinned cards. Dash into it to make it drop the card.</li>
                    </ol>
                    <table className="shifts-keytable">
                      <thead><tr><th scope="col">Player</th><th scope="col">Move</th><th scope="col">Action</th><th scope="col">Dash</th></tr></thead>
                      <tbody>
                        <tr><th scope="row">P1 🐥</th><td>WASD</td><td><kbd>Space</kbd></td><td><kbd>L-Shift</kbd></td></tr>
                        <tr><th scope="row">P2 🐰</th><td>Arrows</td><td><kbd>Enter</kbd></td><td><kbd>R-Shift</kbd> or <kbd>/</kbd></td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="shifts-tip">Playing alone? Press <kbd>Q</kbd> to cycle through the critters.</p>
                  <div className="shifts-count" role="group" aria-label="Number of players">
                    <span>Players</span>
                    {[2, 3, 4].map(n => (
                      <button type="button" key={n} aria-pressed={players === n} disabled={n < seatsNeeded(phones?.seats ?? [])}
                        onClick={() => setCount(n)}>{n}</button>
                    ))}
                  </div>
                  <div className="shifts-end-actions">
                    <button disabled={graphics !== "ready"} onClick={() => start("quick")}>Quick play</button>
                    <button type="button" className="shifts-copy" disabled={graphics !== "ready"} onClick={() => setSetup(true)}>Run it for real</button>
                  </div>
                  {phones ? (
                    <div className="shifts-qr shifts-phones">
                      <QrCode text={joinUrl(phones.code, phones.local)} label={`QR code to join room ${phones.code} with a phone`} />
                      <div>
                        <strong>Scan to use your phone as a controller</strong>
                        <p>Room <b>{phones.code}</b>{phones.local ? " · same-browser test" : ""}</p>
                        <ul>
                          {critters.map(({ emoji, name }, i) => (
                            <li key={name} data-on={Boolean(phones.seats[i])}>{emoji} {name}: {phones.seats[i] ? "phone connected" : "waiting…"}</li>
                          ))}
                        </ul>
                        {phones.failed && <p className="shifts-phone-error">Couldn’t open the room. Check the internet connection.</p>}
                        <button type="button" className="shifts-link" onClick={() => setPhones(null)}>Stop using phones</button>
                      </div>
                    </div>
                  ) : (
                    <div className="shifts-qr">
                      <PlayQr />
                      <div>
                        <p><strong>Play on your phone</strong>Scan to open {playUrl.replace("https://", "")}</p>
                        <button type="button" className="shifts-link" onClick={usePhones}>Or use phones as controllers</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2>{view.phase === "won" ? `Fully rostered with ${clock(view.time)} to spare!` : `Understaffed: ${view.filled}/${view.needed}`}</h2>
                  <Stats stats={view.stats} />
                  <RosterTable slots={view.slots} week={view.week} />
                  <div className="shifts-end-actions">
                    <button type="button" className="shifts-copy" onClick={() => copyRoster(view.slots, view.week)}>{copied ? "Copied" : "Copy roster"}</button>
                    {view.custom && <button type="button" className="shifts-copy" onClick={() => setSetup(true)}>Edit team</button>}
                    <button onClick={() => start()}>Play again</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="shifts-controls" data-count={players} aria-label="Player panels">
        {Array.from({ length: players }, (_, critter) => {
          const player = view.players[critter];
          const { emoji, name, colour } = critters[critter];
          const keyed = critter === 1 ? 1 : critter === lead ? 0 : -1;
          const phone = phones?.seats[critter];
          const playing = view.phase === "playing" && player;
          return (
            <section className="shifts-player" key={name} style={{ "--critter": colour } as CSSProperties}
              data-lead={critter === lead} aria-label={`Player ${critter + 1}, the ${name}`}>
              <strong className="shifts-player-tag" title={name}>{emoji}</strong>
              <div>
                <div className="shifts-keys">
                  <b>P{critter + 1} {name}</b>{" "}
                  {phone ? "📱 phone" : keyed >= 0 ? <><kbd>{keyboards[keyed].guide}</kbd> <kbd>{keyboards[keyed].action}</kbd> <kbd>{keyboards[keyed].dashGuide}</kbd>{keyed === 0 && <> <kbd>Q</kbd> swap</>}</> : <>not on keyboard</>}
                </div>
                {playing && (
                  <div className="shifts-prompt">
                    {player.card && <CardChip card={player.card} />}
                    <span>{player.stamping ? "Stamping…" : player.prompt}</span>
                    <i className="shifts-dashdot" data-ready={player.dashReady} title={player.dashReady ? "Dash ready" : "Dash recharging"}>⚡</i>
                  </div>
                )}
              </div>
              {player?.stamping && <progress aria-label={`The ${name}’s approval progress`} value={player.stamp} max={1} />}
            </section>
          );
        })}
      </div>
    </main>
  );
}
