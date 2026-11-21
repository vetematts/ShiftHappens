/**
 * Plays rounds with simple bots and prints the results, so the rules can be checked without a browser.
 *
 *   node scripts/simulate.ts            # 200 rounds per player count
 *   node scripts/simulate.ts 1 verbose  # one round, printing the board as it goes
 *   SIM_PACE=0.4 node scripts/simulate.ts  # slower bots, closer to a human team
 *
 * Bots walk straight at targets (going round the east end of the counter when they need to cross),
 * so they are a rough stand-in for a decent human team, not a perfect one.
 */
import {
  beginRound, cardPoint, columnX, dash, days, filledShifts, furniture, heldCard, interact, neededShifts,
  newRound, office, settings, shifts, stepRound, stopStamp, type Point, type Round,
} from "../src/round.ts";

const dt = 1 / 30;
/** Bot walking speed as a fraction of the real speed. SIM_PACE=0.4 is closer to a human team than the default 1. */
const pace = Number(process.env.SIM_PACE ?? 1);

function goalFor(round: Round, i: number): { point: Point; act: "tap" | "hold" | "dash" } | undefined {
  const player = round.players[i];
  const card = heldCard(round, i);
  const chicken = round.npcs.find(npc => npc.kind === "snatcher");
  if (chicken && chicken.kind === "snatcher" && chicken.state !== "dazed") {
    const distance = Math.hypot(chicken.point.x - player.position.x, chicken.point.z - player.position.z);
    if (player.position.z < 0 && distance < 3) return { point: chicken.point, act: distance < 1.6 ? "dash" : "tap" };
  }
  if (!card) {
    // Pull a red card if there is one, otherwise the nearest loose card.
    const red = round.board.findIndex(id => id !== undefined && round.cards[id].kind === "cancelled");
    const claimed = new Set(round.players.map((_, j) => (j === i ? undefined : targets[j])));
    if (red >= 0 && !claimed.has(`red${red}`)) {
      targets[i] = `red${red}`;
      return { point: { x: columnX(red % 7), z: office.boardZ + .6 }, act: "tap" };
    }
    const loose = round.cards
      .filter(c => ["tray", "counter", "floor"].includes(c.at.place) && !claimed.has(`card${c.id}`))
      // Players on the board side only collect from the counter/floor; tray work is for the front side.
      .map(c => ({ c, p: cardPoint(round, c)! }))
      .sort((a, b) => dist(player.position, a.p) - dist(player.position, b.p))[0];
    if (!loose) return undefined;
    targets[i] = `card${loose.c.id}`;
    const p = loose.c.at.place === "tray" ? { x: office.tray.x, z: office.tray.z - 1.3 } : loose.p;
    return { point: p, act: "tap" };
  }
  targets[i] = undefined;
  if (card.kind === "cancelled") return { point: { x: furniture.shredder.x + 1.1, z: furniture.shredder.z }, act: "tap" };
  if (card.kind === "request" && !card.approved) return { point: { x: office.desk.x, z: office.desk.z - 1.2 }, act: "hold" };
  if (card.kind === "open" && !card.approved) {
    const npc = round.npcs.find(n => n.kind === "staff" && n.days.includes(card.day));
    if (npc) return { point: { x: npc.point.x - .9, z: npc.point.z }, act: "tap" };
  }
  return { point: { x: columnX(card.day), z: office.boardZ + .6 }, act: "tap" };
}

const targets: (string | undefined)[] = [];
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Head for the goal, detouring round the east end of the counter if it is on the other side. */
function waypoint(from: Point, to: Point): Point {
  const crossing = Math.sign(from.z) !== Math.sign(to.z) && from.x < office.counterRight + 1;
  return crossing ? { x: office.counterRight + 1.4, z: 0 } : to;
}

function move(round: Round, i: number, to: Point) {
  const p = round.players[i].position;
  const w = waypoint(p, to);
  const dx = w.x - p.x;
  const dz = w.z - p.z;
  const length = Math.hypot(dx, dz);
  if (length < .15) return true;
  // Bots ignore furniture: they slide straight, but at the real speed.
  const step = Math.min(length, settings.speed * pace * dt);
  p.x += dx / length * step;
  p.z += dz / length * step;
  round.players[i].moving = true;
  round.players[i].facing = Math.atan2(dx, dz);
  return w === to && length - step < .15;
}

function play(players: number, verbose: boolean) {
  const round = newRound(undefined, false, players);
  beginRound(round);
  targets.length = 0;
  let cancelCount = 0;
  let escapeCount = 0;
  let lastPrint = 0;
  while (round.phase === "playing") {
    round.players.forEach((player, i) => {
      const goal = goalFor(round, i);
      if (!goal) return;
      const there = move(round, i, goal.point);
      if (goal.act === "dash") return dash(round, i);
      if (!there) return;
      if (goal.act === "hold") {
        if (!player.stamping) interact(round, i);
      } else {
        stopStamp(round, i);
        interact(round, i);
      }
    });
    const before = round.fxSeq;
    stepRound(round, dt);
    cancelCount += round.fx.filter(f => f.id > before && f.kind === "cancel").length;
    escapeCount += round.fx.filter(f => f.id > before && f.kind === "escape").length;
    if (verbose) {
      // Print each new "nope" reason once, when it first appears.
      round.players.forEach((p, i) => {
        if (p.messageUntil - round.elapsed > 2.2 - dt) console.log(`  ${round.elapsed.toFixed(1)}s P${i + 1}: ${p.message}`);
      });
    }
    if (verbose && round.elapsed - lastPrint >= 10) {
      lastPrint = round.elapsed;
      console.log(`${round.elapsed.toFixed(0).padStart(3)}s ${round.stage.padEnd(5)} ${filledShifts(round)}/${neededShifts(round)} `
        + round.board.map(id => (id === undefined ? "." : round.cards[id].kind === "cancelled" ? "X" : "#")).join("")
        + `  tray=${round.cards.filter(c => c.at.place === "tray").length} npcs=${round.npcs.map(n => n.kind[1]).join("")}`);
    }
  }
  if (verbose) {
    console.log(round.phase, `${filledShifts(round)}/${neededShifts(round)}`, `${(settings.duration - round.elapsed).toFixed(1)}s left`);
    console.log(round.fx.map(f => f.kind).join(" "));
    console.log(days.map((day, d) => `${day}: ${[d, d + 7].map(s => round.board[s] === undefined ? "-" : shifts[s].half).join(" ")}`).join("  "));
    console.log("stats", JSON.stringify(round.stats));
  }
  const kinds = round.fx.map(f => f.kind);
  return {
    won: round.phase === "won",
    left: settings.duration - round.elapsed,
    filled: filledShifts(round),
    snatches: round.cards.filter(c => c.at.place === "gone").length,
    sawCancel: kinds.includes("cancel") || round.stats.some(s => s.shredded > 0),
    cancels: cancelCount,
    escapes: escapeCount,
  };
}

const [countArg, verboseArg] = process.argv.slice(2);
const count = Number(countArg) || 200;
const verbose = verboseArg === "verbose";
for (const players of [2, 3, 4]) {
  const results = Array.from({ length: count }, () => play(players, verbose));
  const wins = results.filter(r => r.won);
  const avgLeft = wins.reduce((sum, r) => sum + r.left, 0) / Math.max(1, wins.length);
  const avgFilled = results.reduce((sum, r) => sum + r.filled, 0) / results.length;
  console.log(`${players}p: won ${wins.length}/${count} · avg time left on win ${avgLeft.toFixed(1)}s · avg filled ${avgFilled.toFixed(1)} · cancels seen in ${results.filter(r => r.sawCancel).length} · avg cancels ${(results.reduce((sum, r) => sum + r.cancels, 0) / results.length).toFixed(1)} · avg escapes ${(results.reduce((sum, r) => sum + r.escapes, 0) / results.length).toFixed(1)}`);
  if (verbose) break;
}
