import type { CSSProperties } from "react";
import { cardColours, critters } from "./phone-link";

/** How long the rules show before the 3-2-1, unless the host or every phone says they're ready sooner. */
export const briefSeconds = 15;

/** A request card like the ones in the office: blue, with the day in big letters. */
function Card({ kind = "request", day = "Mon", stamped = false }: { kind?: keyof typeof cardColours; day?: string; stamped?: boolean }) {
  return (
    <span className="brief-card" style={{ "--card": cardColours[kind] } as CSSProperties} data-stamped={stamped}>
      <small>{kind === "cancelled" ? "Cancelled" : "Request"}</small>
      <b>{day}</b>
      {stamped && <i aria-hidden="true">✓</i>}
    </span>
  );
}

/** The week on the board, filling up one pinned card at a time. */
function Board() {
  return (
    <span className="brief-board" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ "--n": (i * 5) % 14 } as CSSProperties} />)}
    </span>
  );
}

/**
 * The opening frame before a round: the goal in a few big words and pictures, readable from across the room.
 * It shows once everyone has joined and the host starts, then counts down into the 3-2-1.
 */
export function Briefing({ left, seats, ready, onGo }: {
  /** Whole seconds until it moves on by itself. */
  left: number;
  /** Which critters have a phone in them, if phones are on. */
  seats: (string | null)[] | null;
  /** Which phone seats have pressed "I'm ready". */
  ready: boolean[];
  onGo: () => void;
}) {
  const phones = seats?.map((peer, i) => (peer ? i : -1)).filter(i => i >= 0) ?? [];
  return (
    <div className="brief" role="dialog" aria-modal="true" aria-labelledby="brief-title">
      <h1 id="brief-title" className="brief-title">Roster everyone <em>now!!!</em></h1>

      <ol className="brief-steps" aria-label="How a shift gets rostered">
        <li><span className="brief-pic"><Card /></span><b>Grab</b></li>
        <li className="brief-arrow" aria-hidden="true">➜</li>
        <li><span className="brief-pic brief-pic--stamp"><Card stamped /><span className="brief-stamp" aria-hidden="true" /></span><b>Stamp</b></li>
        <li className="brief-arrow" aria-hidden="true">➜</li>
        <li><span className="brief-pic"><Board /></span><b>Pin</b></li>
      </ol>

      <p className="brief-goal"><span aria-hidden="true">⏱️</span> Fill all <b>14</b> shifts in <b>2 minutes!</b></p>

      <ul className="brief-watch" aria-label="Watch out for">
        <li><span aria-hidden="true">🐔</span><b>Dash it!</b></li>
        <li><span aria-hidden="true">💦</span><b>Don’t slip!</b></li>
        <li><span className="brief-mini" aria-hidden="true"><Card kind="cancelled" day="Fri" /></span><b>Shred it!</b></li>
      </ul>

      <div className="brief-go">
        <button type="button" className="btn btn-primary brief-button" onClick={onGo} autoFocus>Let’s go! <kbd>Enter</kbd></button>
        <span className="brief-timer" role="timer" aria-label={`Starting in ${left} seconds`}>
          <span className="brief-bar"><span style={{ animationDuration: `${briefSeconds}s` }} /></span>
          <small>Starting in {left}</small>
        </span>
        {phones.length > 0 && (
          <ul className="brief-ready" aria-label="Phones ready">
            {phones.map(i => <li key={i} data-ready={ready[i]}><span aria-hidden="true">{critters[i].emoji}</span>{ready[i] ? "✓" : "…"}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
