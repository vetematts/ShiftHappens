/**
 * Plays rounds of Shift Happens with two simple bots and no browser, to check the rules and tune `settings`.
 *
 *   npm run simulate                     100 rounds of quick play, with a summary
 *   npm run simulate -- 500              more rounds
 *   npm run simulate -- 1 show           one round, printing events and the final board
 *   npm run simulate -- 200 --pause=1    bots that hesitate 1 second after each action (default 2.5)
 *
 * The duck (player 0) grabs staff, signs them on and passes them over the counter. The bunny (player 1) collects
 * them, rosters them and chases the bin chicken. The bots walk perfect lines and never misread a name tag, so the
 * pause after each action stands in for how long people take to look, decide and fumble.
 */
import {
  beginRound, canWork, columnX, filledShifts, furniture, interact, neededShifts, newRound, office, roleIn, settings, shiftLabel,
  stepRound, walk, type Point, type Round,
} from "../src/round.ts";

const rounds = Math.max(1, Number(process.argv[2]) || 100);
const show = process.argv.includes("show");
const pause = Number(process.argv.find(arg => arg.startsWith("--pause="))?.slice(8) ?? 2.5);
const dt = 1 / 60;
// When each bot may act again
const readyAt = [0, 0];

// Uses the action button, then hesitates before the next action
function act(round: Round, index: number) {
  if (round.elapsed < readyAt[index]) return;
  interact(round, index);
  readyAt[index] = round.elapsed + pause;
}

const trayStand = { x: furniture.inbox.x, z: furniture.inbox.z - furniture.inbox.d / 2 - .6 };
const deskStand = { x: furniture.desk.x, z: furniture.desk.z - furniture.desk.d / 2 - .6 };
const frontOfPad = (pad: number) => ({ x: office.pass[pad].x, z: .95 });
const behindPad = (pad: number) => ({ x: office.pass[pad].x, z: -.95 });
const boardStand = (day: number) => ({ x: columnX(day), z: office.boardZ + 1.2 });

// Walks a player towards a point. Returns true once there.
function goTo(round: Round, index: number, target: Point) {
  const { position } = round.players[index];
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < .08) return true;
  walk(round, index, dx, dz, Math.min(dt, distance / settings.speed));
  return false;
}

const padTaken = (round: Round, pad: number) => round.staff.some(person => person.at.place === "counter" && person.at.pad === pad);

function duck(round: Round) {
  const me = round.players[0];
  const person = me.carrying;
  if (!person) {
    if (!round.staff.some(staff => staff.at.place === "tray")) return goTo(round, 0, trayStand);
    if (goTo(round, 0, trayStand)) act(round, 0);
    return;
  }
  if (!person.approved) {
    if (goTo(round, 0, deskStand) && !me.stamping) act(round, 0);
    return;
  }
  const pad = office.pass.findIndex((_, i) => !padTaken(round, i));
  if (pad >= 0 && goTo(round, 0, frontOfPad(pad))) act(round, 0);
}

function bunny(round: Round) {
  const me = round.players[1];
  const chicken = round.snatcher;
  // Chase the chicken when it is after or holding a shift
  if (chicken.mode !== "away" && (chicken.mode !== "fleeing" || chicken.carrying !== undefined) && Math.abs(chicken.position.x) < office.bounds.x) {
    goTo(round, 1, chicken.position);
    return;
  }
  const person = me.carrying;
  if (!person) {
    const dropped = round.staff.find(staff => staff.at.place === "floor" && staff.at.point.z < 0);
    if (dropped && dropped.at.place === "floor") {
      if (goTo(round, 1, dropped.at.point)) act(round, 1);
      return;
    }
    const pad = office.pass.findIndex((_, i) => padTaken(round, i));
    if (pad >= 0 && goTo(round, 1, behindPad(pad))) act(round, 1);
    return;
  }
  const slot = round.slots.findIndex((_, i) => canWork(round, person, i));
  if (slot < 0) {
    // Nowhere they can go any more: put them down and they head home
    act(round, 1);
    return;
  }
  if (goTo(round, 1, boardStand(round.slots[slot].shift % 7))) act(round, 1);
}

function play() {
  const round = newRound();
  beginRound(round);
  readyAt.fill(0);
  let lastNews = "";
  while (round.phase === "playing") {
    duck(round);
    bunny(round);
    stepRound(round, dt);
    if (show && round.news.text !== lastNews) {
      lastNews = round.news.text;
      console.log(`${round.elapsed.toFixed(1).padStart(6)}s  ${lastNews}`);
    }
  }
  return round;
}

let wins = 0;
let spare = 0;
let snatched = 0;
let shooed = 0;
const covered: number[] = [];
for (let i = 0; i < rounds; i++) {
  const round = play();
  if (round.phase === "won") {
    wins++;
    spare += round.duration - round.elapsed;
  }
  covered.push(filledShifts(round) / neededShifts(round));
  shooed += round.players.reduce((sum, player) => sum + player.stats.shooed, 0);
  if (show) {
    console.log(`\n${round.phase === "won" ? "Won" : "Lost"} with ${filledShifts(round)}/${neededShifts(round)} covered`);
    for (const [i, slot] of round.slots.entries()) {
      const id = round.board[i];
      console.log(`  ${shiftLabel(round.shiftNames, slot.shift).padEnd(7)} ${roleIn(round.roles, slot.role).label}: ${id === undefined ? "open" : round.staff[id].name}`);
    }
    console.log("  Stats:", round.players.map((player, n) => `${n ? "bunny" : "duck"} ${JSON.stringify(player.stats)}`).join(", "));
  }
  snatched += round.snatcher.carrying !== undefined ? 1 : 0;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
console.log(`\n${rounds} rounds: won ${percent(wins / rounds)}`
  + (wins ? `, ${(spare / wins).toFixed(1)}s to spare on average` : "")
  + `, ${percent(covered.reduce((a, b) => a + b, 0) / rounds)} of shifts covered on average`
  + `, bin chicken stopped ${(shooed / rounds).toFixed(1)} times a round`
  + (snatched ? `, ${snatched} rounds ended with it still holding someone` : ""));
