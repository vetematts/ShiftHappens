import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { openLink, type HostMessage, type Link } from "./phone-link";

const critters = [
  { name: "duck", emoji: "🐥", colour: "#ffd54f" },
  { name: "bunny", emoji: "🐰", colour: "#cdb8ff" },
  { name: "cat", emoji: "🐱", colour: "#9fd0ff" },
  { name: "frog", emoji: "🐸", colour: "#9be58a" },
];
const stickReach = 56;

type Status = Extract<HostMessage, { t: "status" }>;

function clock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** What a phone shows after scanning the host's QR code: a gamepad for one critter. */
export default function PhoneController({ code, local }: { code: string; local: boolean }) {
  const link = useRef<Link | null>(null);
  const host = useRef<string | null>(null);
  const input = useRef({ x: 0, y: 0, act: false, pointer: -1, originX: 0, originY: 0 });
  const knob = useRef<HTMLSpanElement>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "lost">("connecting");
  const [seat, setSeat] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

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
          setStatus(message);
        }
      });
      // Send the stick about 20 times a second when it moves, and a heartbeat otherwise
      timer = window.setInterval(() => {
        if (!host.current) return;
        const { x, y, act } = input.current;
        const now = performance.now();
        const state = `${x.toFixed(2)},${y.toFixed(2)},${act}`;
        if (state === last && now - lastSent < 300) return;
        last = state;
        lastSent = now;
        opened.send({ t: "input", x, y, act }, host.current);
      }, 50);
    }).catch(() => setConnection("lost"));
    return () => {
      closed = true;
      window.clearInterval(timer);
      link.current?.close();
    };
  }, [code, local]);

  function sendNow() {
    if (!host.current || !link.current) return;
    const { x, y, act } = input.current;
    link.current.send({ t: "input", x, y, act }, host.current);
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

  const critter = seat !== null && seat >= 0 ? critters[seat] : null;
  const playing = status?.phase === "playing";

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
      ) : (
        <>
          <section className="gp-status" aria-live="polite">
            {status?.carrying && (
              <b className="person-chip" style={{ "--role": status.colour } as CSSProperties}>
                {status.carrying}{status.approved ? " ✓" : ""}
              </b>
            )}
            <p>{!status ? "Connected" : playing ? (status.stamping ? "Stamping…" : status.prompt) : status.phase === "ready" ? "Ready when you are" : status.phase === "won" ? "Week covered!" : "Understaffed"}</p>
            {status && <small>{status.filled} / {status.needed} covered · {clock(status.time)} left</small>}
            {status?.news && playing && <small className="gp-news">📞 {status.news}</small>}
          </section>
          {playing ? (
            <section className="gp-controls">
              <div className="touch-stick gp-stick" onPointerDown={stickDown}
                onPointerMove={event => event.pointerId === input.current.pointer && moveStick(event.clientX, event.clientY)}
                onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp} role="presentation">
                <span ref={knob} />
              </div>
              <button type="button" className="gp-action"
                onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); act(true); }}
                onPointerUp={() => act(false)} onPointerCancel={() => act(false)} onLostPointerCapture={() => act(false)}>
                {status?.stamping ? "Hold…" : "Action"}
              </button>
            </section>
          ) : (
            <section className="gp-wait">
              <button type="button" className="gp-start" onClick={() => link.current?.send({ t: "start" }, host.current ?? undefined)}>
                {status?.phase === "ready" || !status ? "Start round" : "Play again"}
              </button>
              <p>Watch the big screen. Move with the stick, use the action button to grab, sign on, pass and roster.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
