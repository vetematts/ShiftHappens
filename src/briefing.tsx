import { critters } from "./phone-link";
import { settings } from "./round";

/** How long the rules show before the 3-2-1, unless the host or every phone says they're ready sooner. */
export const briefSeconds = 15;

function RequestCard({ approved = false }: { approved?: boolean }) {
  return <span className="brief-card" data-approved={approved}>Mon AM{approved && <span>✓</span>}</span>;
}

/**
 * The opening frame before a round: the goal in a few big words and pictures, readable from across the room.
 * It shows once everyone has joined and the host starts, then counts down into the 3-2-1.
 */
export function Briefing({ open, left, seats, ready, onGo }: {
  /** Which of the week's 14 slots this round needs filled (the rest are closed). */
  open: boolean[];
  /** Whole seconds until it moves on by itself. */
  left: number;
  /** Which critters have a phone in them, if phones are on. */
  seats: (string | null)[] | null;
  /** Which phone seats have pressed "I'm ready". */
  ready: boolean[];
  onGo: () => void;
}) {
  const phones = seats?.map((peer, i) => (peer ? i : -1)).filter(i => i >= 0) ?? [];
  const shiftsToFill = open.filter(Boolean).length;
  return (
    <div className="brief" role="dialog" aria-modal="true" aria-labelledby="brief-title">
      <div className="brief-sheet">
        <header className="brief-header">
          <h1 id="brief-title">Cover the week</h1>
          <p>Fill <b>{shiftsToFill} shifts</b> in <b>{settings.duration / 60} minutes</b></p>
        </header>

        <ol className="brief-steps" aria-label="How a shift gets rostered">
          <li>
            <span className="brief-illustration" aria-hidden="true"><RequestCard /></span>
            <b>Pick up</b><small>Take a request from the tray</small>
          </li>
          <li>
            <span className="brief-illustration" aria-hidden="true"><RequestCard approved /></span>
            <b>Stamp</b><small>Hold action at the manager’s desk</small>
          </li>
          <li className="brief-handoff">
            <span className="brief-illustration" aria-hidden="true">
              <span className="brief-duck">{critters[0].emoji}</span>
              <span className="brief-counter"><RequestCard approved /> →</span>
              <span className="brief-bunny">{critters[1].emoji}</span>
            </span>
            <b>Pass</b><small>Leave it on the counter for a teammate on the other side</small>
          </li>
          <li>
            <span className="brief-illustration" aria-hidden="true">
              <span className="brief-board">
                {open.map((needed, i) => <span key={i} data-closed={!needed} />)}
              </span>
            </span>
            <b>Pin</b><small>Match the shift on the roster board</small>
          </li>
        </ol>

        <div className="brief-go">
          <button type="button" className="btn btn-primary brief-button" onClick={onGo} autoFocus>Let’s go <kbd>Enter</kbd></button>
          <span className="brief-timer" role="timer" aria-label={`Starting in ${left} seconds`}>
            Starts in {left}s
          </span>
          {phones.length > 0 && (
            <ul className="brief-ready" aria-label="Phones ready">
              {phones.map(i => <li key={i} data-ready={ready[i]}><span aria-hidden="true">{critters[i].emoji}</span>{ready[i] ? "✓" : "…"}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
