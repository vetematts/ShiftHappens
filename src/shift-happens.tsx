import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createOfficeWorld } from "./office-world";
import {
  beginRound, dayRange, days, filledShifts, interact, neededShifts, newRound, nextAction, roleOf, roster, sampleTeam,
  settings, shifts, stageAt, stepRound, stopStamp, walk,
  type Role, type Round, type Team,
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
const critterNames = ["duck", "bunny"];
const stickReach = 46;

function clock(seconds: number) {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function snapshot(round: Round) {
  return {
    phase: round.phase,
    time: settings.duration - round.elapsed,
    stage: settings.pace[stageAt(round.elapsed)].name,
    filled: filledShifts(round),
    needed: neededShifts(round),
    week: round.week,
    custom: round.custom,
    slots: roster(round).map(person => person?.name ?? ""),
    news: round.news.until > round.elapsed ? round.news.text : "",
    players: round.players.map((player, i) => ({
      carrying: player.carrying ? player.carrying.name : "",
      works: player.carrying ? dayRange(player.carrying.days.map((on, day) => on && !player.carrying!.off[day])) : "",
      colour: player.carrying ? roleOf(player.carrying.role).colour : "",
      approved: player.carrying?.approved ?? false,
      stamp: player.stamping ? (player.carrying?.stamp ?? 0) / settings.stampTime : 0,
      stamping: player.stamping,
      prompt: player.messageUntil > round.elapsed ? player.message : nextAction(round, i),
      stats: { ...player.stats },
    })),
  };
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
  const [team, setTeam] = useState<Team>(() => copyTeam(sampleTeam));
  const [setup, setSetup] = useState(false);
  const lastMode = useRef<"quick" | "real">("quick");
  // Phones as controllers: seat 0 is the duck, seat 1 the bunny
  const [phones, setPhones] = useState<Phones | null>(null);
  const phoneLink = useRef<Link | null>(null);
  const seats = useRef<(string | null)[]>([null, null]);
  const remote = useRef([{ x: 0, y: 0, act: false }, { x: 0, y: 0, act: false }]);

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
    if (critter !== undefined) stopStamp(round.current.players[critter]);
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
    remote.current[seat] = { x: 0, y: 0, act: false };
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
      seats.current = [null, null];
      remote.current = [{ x: 0, y: 0, act: false }, { x: 0, y: 0, act: false }];
    };
  }, [roomCode, roomLocal]);

  function usePhones() {
    sound.current?.unlock();
    setPhones({ code: makeRoomCode(), local: wantsLocalLink(), seats: [null, null], failed: false });
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
          if (!peer) return;
          const player = latest.players[i];
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
    const state = mode === "real"
      ? newRound({ ...team, people: team.people.filter(person => person.name.trim()).map(person => ({ ...person, name: person.name.trim() })) }, true)
      : newRound();
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
  const solo = view.players[lead];

  return (
    <main className="shifts">
      <header className="shifts-head">
        <h1>Shift Happens<span>!</span></h1>
        <div className="shifts-score" aria-label="Round score">
          <span><small>Covered</small><strong>{view.filled}<i> / {view.needed}</i></strong></span>
          <span className={urgent ? "shifts-urgent" : undefined}>
            <small>Time left{view.phase === "playing" && ` · ${view.stage}`}</small><strong>{clock(view.time)}</strong>
          </span>
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
              const role = view.week[index];
              if (!role) return <span key={index} data-closed="true" aria-label={`${shifts[index].label}: closed`}><span>{shifts[index].half}</span><em>–</em></span>;
              const { colour, label } = roleOf(role);
              const name = view.slots[index];
              return (
                <span key={index} data-filled={Boolean(name)} style={{ "--role": colour } as CSSProperties}
                  aria-label={`${shifts[index].label}, ${label}: ${name || "open"}`}>
                  <span>{shifts[index].half}</span><em>{name || label}</em>
                </span>
              );
            })}
          </div>
        ))}
      </section>

      <section className={urgent ? "shifts-game shifts-game--urgent" : "shifts-game"} aria-label="Office">
        <div className="shifts-floor" ref={host} tabIndex={0} />
        {view.phase === "playing" && view.news && <p className="shifts-news" role="status">📞 {view.news}</p>}
        {view.phase === "playing" && (
          <div className="shifts-touch" aria-label="Player 1 touch controls">
            <div className="shifts-stick" onPointerDown={stickDown} onPointerMove={stickMove}
              onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp}
              role="presentation">
              <span ref={knob} />
            </div>
            <div className="shifts-action">
              <button type="button" className="shifts-swap" onPointerDown={event => { event.preventDefault(); swap(); }}
                aria-label={`Switch to the ${critterNames[1 - lead]}`}>
                <span aria-hidden="true">{lead === 0 ? "🐰" : "🐥"}</span>
                <small>Swap</small>
              </button>
              {solo.carrying && (
                <b className="shifts-person" style={{ "--role": solo.colour } as CSSProperties}>{solo.carrying}{solo.approved ? " ✓" : ""} · {solo.works}</b>
              )}
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
                  <h2>Cover the week</h2>
                  <p>Staff are waiting. Sign them on at the manager’s desk, pass them over the counter and roster each one onto a shift that matches their role, on a day they can work. Watch out for sick calls.</p>
                  <p className="shifts-tip">Playing alone? Swap between the duck and the bunny with <kbd>Q</kbd> or the swap button.</p>
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
                          {["🐥 Duck", "🐰 Bunny"].map((name, i) => (
                            <li key={name} data-on={Boolean(phones.seats[i])}>{name}: {phones.seats[i] ? "phone connected" : "waiting…"}</li>
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
                  <h2>{view.phase === "won" ? "Week covered!" : "Understaffed"}</h2>
                  <p>{view.phase === "won" ? `Rostered with ${clock(view.time)} to spare.` : `${view.filled} of ${view.needed} shifts covered.`}</p>
                  <RosterTable slots={view.slots} week={view.week} />
                  <ul className="shifts-stats" aria-label="How each critter did">
                    {view.players.map(({ stats }, i) => (
                      <li key={critterNames[i]}>
                        <b>{i === 0 ? "🐥 Duck" : "🐰 Bunny"}</b> signed on {stats.signed} · rostered {stats.rostered}
                        {stats.shooed > 0 && <> · stopped the bin chicken {stats.shooed === 1 ? "once" : `${stats.shooed} times`}</>}
                      </li>
                    ))}
                  </ul>
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

      <div className="shifts-controls" aria-label="Player controls">
        {keyboards.map(({ guide, action }, i) => {
          // Player 1's keys follow whichever critter they have swapped to.
          const critter = i === 0 ? lead : 1;
          const player = view.players[critter];
          return (
            <section className="shifts-player" key={action} aria-label={`Player ${i + 1}, controlling the ${critterNames[critter]}`}>
              <strong className="shifts-player-tag" data-critter={critter}>P{critter + 1}</strong>
              <div>
                <div className="shifts-keys">
                  <kbd>{guide}</kbd> <kbd>{action}</kbd>
                  {i === 0 && <> · <kbd>Q</kbd> swap</>}
                </div>
                {view.phase === "playing" && (
                  <div className="shifts-prompt">
                    {player.carrying && <span className="shifts-person" style={{ "--role": player.colour } as CSSProperties}>{player.carrying}{player.approved ? " ✓" : ""} · {player.works}</span>}
                    <span>{player.stamping ? "Stamping…" : player.prompt}</span>
                  </div>
                )}
              </div>
              {player.stamping && <progress aria-label={`The ${critterNames[critter]}’s approval progress`} value={player.stamp} max={1} />}
            </section>
          );
        })}
      </div>
    </main>
  );
}
