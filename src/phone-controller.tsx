import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { cardColours, cardText, critters, openLink, type HostMessage, type Link } from "./phone-link";
import { days } from "./round";

const stageNames = { calm: "Calm", busy: "Busy!", chaos: "Chaos!" };
const stickReach = 56;

type Status = Extract<HostMessage, { t: "status" }>;

type Moment = { text: string; kind: "good" | "alert" | "win" | "lose"; buzz: number | number[] };

/** Something worth a flash and a buzz on this phone, found by comparing two status updates from the laptop. */
function momentBetween(before: Status | null, after: Status): Moment | null {
  if (!before) return null;
  if (before.phase === "playing" && after.phase === "won") return { text: "Week covered! 🎉", kind: "win", buzz: [60, 40, 60, 40, 140] };
  if (before.phase === "playing" && after.phase === "lost") return { text: "Time’s up!", kind: "lose", buzz: 300 };
  if (after.phase !== "playing") return null;
  if (after.boosted && !before.boosted) return { text: "Boost! ⚡", kind: "good", buzz: [30, 30, 60] };
  if (after.charges > before.charges && before.regenIn > 0.6) return { text: "⚡ +1", kind: "good", buzz: 30 };
  if ((after.stats?.pinned ?? 0) > (before.stats?.pinned ?? 0)) return { text: "Pinned! 📌", kind: "good", buzz: [30, 40, 30] };
  if ((after.stats?.stamped ?? 0) > (before.stats?.stamped ?? 0)) return { text: "Stamped ✓", kind: "good", buzz: 40 };
  if (after.news && after.news !== before.news) {
    if (after.news.includes("cancelled")) return { text: "Cancelled! 📞", kind: "alert", buzz: [120, 60, 120] };
    if (/Snatcher (is loose|grabbed)/.test(after.news)) return { text: "Snatcher! 🐦", kind: "alert", buzz: [120, 60, 120] };
  }
  return null;
}

function clock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** What a phone shows after scanning the host's QR code: a gamepad for one critter. */
export default function PhoneController({ code, local }: { code: string; local: boolean }) {
  const link = useRef<Link | null>(null);
  const host = useRef<string | null>(null);
  const input = useRef({ x: 0, y: 0, act: false, dash: false, pointer: -1, originX: 0, originY: 0 });
  const knob = useRef<HTMLSpanElement>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "lost">("connecting");
  const [seat, setSeat] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const previous = useRef<Status | null>(null);
  const [flash, setFlash] = useState<(Moment & { id: number }) | null>(null);

  useEffect(() => {
    let closed = false;
    let timer: number | undefined;
    let last = "";
    let lastSent = 0;
    openLink(code, local).then(opened => {
      if (closed) {
        opened.close();
        return;
      }
      link.current = opened;
      opened.onJoin(() => setConnection(current => (current === "lost" ? "connecting" : current)));
      opened.onLeave(peer => {
        if (peer !== host.current) return;
        host.current = null;
        setConnection("lost");
        setSeat(null);
      });
      opened.onMessage((message, from) => {
        if (message.t === "seat") {
          host.current = from;
          setSeat(message.player);
          setConnection("connected");
        } else if (message.t === "status" && from === host.current) {
          const moment = momentBetween(previous.current, message);
          previous.current = message;
          setStatus(message);
          if (moment) {
            setFlash({ ...moment, id: performance.now() });
            if (navigator.vibrate) navigator.vibrate(moment.buzz);
          }
        }
      });
      // Send the stick about 20 times a second when it moves, and a heartbeat otherwise
      timer = window.setInterval(() => {
        if (!host.current) return;
        const { x, y, act, dash } = input.current;
        const now = performance.now();
        const state = `${x.toFixed(2)},${y.toFixed(2)},${act},${dash}`;
        if (state === last && now - lastSent < 300) return;
        last = state;
        lastSent = now;
        opened.send({ t: "input", x, y, act, dash }, host.current);
      }, 50);
    }).catch(() => setConnection("lost"));
    return () => {
      closed = true;
      window.clearInterval(timer);
      link.current?.close();
    };
  }, [code, local]);

  // Each flash fades on its own; this tidies it away afterwards
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function startRound() {
    link.current?.send({ t: "start" }, host.current ?? undefined);
  }

  function sendNow() {
    if (!host.current || !link.current) return;
    const { x, y, act, dash } = input.current;
    link.current.send({ t: "input", x, y, act, dash }, host.current);
  }

  function moveStick(clientX: number, clientY: number) {
    const state = input.current;
    let dx = clientX - state.originX;
    let dy = clientY - state.originY;
    const length = Math.hypot(dx, dy);
    if (length > stickReach) {
      dx = dx / length * stickReach;
      dy = dy / length * stickReach;
    }
    const strength = Math.min(1, length / stickReach);
    state.x = strength > .22 ? dx / stickReach : 0;
    state.y = strength > .22 ? dy / stickReach : 0;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function stickDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    Object.assign(input.current, { pointer: event.pointerId, originX: box.left + box.width / 2, originY: box.top + box.height / 2 });
    moveStick(event.clientX, event.clientY);
  }

  function stickUp() {
    Object.assign(input.current, { x: 0, y: 0, pointer: -1 });
    if (knob.current) knob.current.style.transform = "";
    sendNow();
  }

  function act(held: boolean) {
    input.current.act = held;
    sendNow();
    if (held && navigator.vibrate) navigator.vibrate(15);
  }

  function dashing(held: boolean) {
    input.current.dash = held;
    sendNow();
    if (held && navigator.vibrate) navigator.vibrate(10);
  }

  const critter = seat !== null && seat >= 0 ? critters[seat] : null;
  const playing = status?.phase === "playing";
  const countdown = status?.countdown ?? 0;

  return (
    <main className="gp" onContextMenu={event => event.preventDefault()} style={{ "--gp": critter?.colour ?? "#efe7ff" } as CSSProperties}>
      <header className="gp-head">
        <strong>{critter ? `${critter.emoji} You’re the ${critter.name}` : "Shift Happens!"}</strong>
        <span>Room {code}</span>
      </header>

      {connection !== "connected" || seat === null ? (
        <section className="gp-wait">
          {connection === "lost" ? (
            <><h1>Lost the laptop</h1><p>Check you’re on the same Wi-Fi as the laptop, then reload this page.</p></>
          ) : (
            <><h1>Joining room {code}…</h1><p>Keep the game open on the laptop. This can take a few seconds.</p></>
          )}
        </section>
      ) : seat < 0 ? (
        <section className="gp-wait">
          <h1>All four critters are taken</h1>
          <p>Four phones are already playing. Keep this open and you’ll jump in as soon as one leaves.</p>
        </section>
      ) : countdown > 0 ? (
        <section className="gp-count" aria-live="assertive">
          <span key={countdown}>{countdown}</span>
          <p>Get ready! Watch the big screen.</p>
        </section>
      ) : status && (status.phase === "won" || status.phase === "lost") ? (
        <section className="gp-results" aria-live="polite">
          <h1>{status.phase === "won" ? "Week covered!" : "Understaffed"}</h1>
          <small>{status.filled} / {status.needed} covered</small>
          {status.awards?.length ? status.awards.map(title => (
            <p className="gp-award" key={title}><span aria-hidden="true">🏆</span> You’re the <b>{title}</b></p>
          )) : <p className="gp-award gp-award--none">No award this round. Steal one next time!</p>}
          {status.stats && (
            <dl className="gp-stats">
              <div><dt>Pinned</dt><dd>{status.stats.pinned}</dd></div>
              <div><dt>Stamped</dt><dd>{status.stats.stamped}</dd></div>
              <div><dt>Passed</dt><dd>{status.stats.passed}</dd></div>
              {status.stats.shredded > 0 && <div><dt>Shredded</dt><dd>{status.stats.shredded}</dd></div>}
              {status.stats.rescues > 0 && <div><dt>Rescues</dt><dd>{status.stats.rescues}</dd></div>}
            </dl>
          )}
          <button type="button" className="gp-start" onClick={startRound}>Play again</button>
        </section>
      ) : (
        <>
          <section className="gp-status" aria-live="polite">
            {status?.card && (
              <b className="person-chip" style={{ "--role": cardColours[status.card.kind] } as CSSProperties}>
                {cardText(status.card, days)}
              </b>
            )}
            {status?.boosted && playing && <b className="boost-tag">BOOST</b>}
            <p>{!status ? "Connected" : playing ? (status.stamping ? "Stamping…" : status.prompt) : status.phase === "ready" ? "Ready when you are" : status.phase === "won" ? "Fully rostered!" : "Understaffed"}</p>
            {status && <small>Roster {status.filled}/{status.needed} · {clock(status.time)} left{playing && <> · <span className={`gp-stage gp-stage--${status.stage}`}>{stageNames[status.stage]}</span></>}</small>}
            {status?.stamping && <progress className="gp-progress" value={status.stamp} max={1} aria-label="Approval progress" />}
            {status?.news && playing && <small className="gp-news">📞 {status.news}</small>}
          </section>
          {playing ? (
            <section className="gp-controls">
              <div className="touch-stick gp-stick" onPointerDown={stickDown}
                onPointerMove={event => event.pointerId === input.current.pointer && moveStick(event.clientX, event.clientY)}
                onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp} role="presentation">
                <span ref={knob} />
              </div>
              <div className="gp-buttons">
                <button type="button" className="gp-dash" data-ready={(status?.charges ?? 3) > 0}
                  onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dashing(true); }}
                  onPointerUp={() => dashing(false)} onPointerCancel={() => dashing(false)} onLostPointerCapture={() => dashing(false)}>
                  Dash <span className="gp-pips" aria-label={`${status?.charges ?? 3} dashes left`}>{"⚡".repeat(status?.charges ?? 3)}</span>
                </button>
                <button type="button" className="gp-action"
                  onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); act(true); }}
                  onPointerUp={() => act(false)} onPointerCancel={() => act(false)} onLostPointerCapture={() => act(false)}>
                  {status?.stamping ? "Hold…" : "Action"}
                </button>
              </div>
            </section>
          ) : (
            <section className="gp-wait">
              <button type="button" className="gp-start" onClick={startRound}>
                {status?.phase === "ready" || !status ? "Start round" : "Play again"}
              </button>
              <p>Watch the big screen. Move with the stick. Action grabs, stamps, passes and pins cards. Chase employees to hand over open shifts. Dash bowls over the Shift Snatcher; grab ⚡ to recharge.</p>
            </section>
          )}
        </>
      )}
      {flash && <div className="gp-flash" data-kind={flash.kind} key={flash.id} role="status">{flash.text}</div>}
    </main>
  );
}
