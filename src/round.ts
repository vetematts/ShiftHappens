/**
 * All the rules of Shift Happens!, with no rendering, sound or networking.
 *
 * The players are helper critters living *inside* a rostering system. Employees send shift requests in;
 * the helpers move those request cards through the system: the Request Tray (inbox), the Manager's Desk
 * (approval stamp), across the counter, onto the Roster Board. Cancellations, open shifts that need cover
 * from the Staff Room, and a card-stealing Shift Snatcher keep un-filling the week.
 *
 * Everything the UI and the 3D office need lives in `Round`. One-off moments (a pin, a "nope", a snatch)
 * are pushed onto `round.fx` so the renderer and sound can react without diffing state.
 */

export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const roles = [
  { id: "barista", label: "Barista", colour: "#ff7aa8" },
  { id: "kitchen", label: "Kitchen", colour: "#ffa53d" },
  { id: "register", label: "Register", colour: "#3ec7b4" },
] as const;
export type Role = typeof roles[number]["id"];
export const roleOf = (role: Role) => roles.find(entry => entry.id === role)!;

/** The 14 slots of a week: Monday to Sunday mornings (0–6), then Monday to Sunday evenings (7–13). */
export const shifts = (["AM", "PM"] as const).flatMap(half =>
  days.map((day, i) => ({ day, dayIndex: i, half, label: `${day} ${half}` })),
);

/** An employee of the business, as entered in "Run it for real". Employees send requests; they are not the players. */
export type Person = { name: string; role: Role; days: boolean[]; shifts: number };
/** A team plus the role each shift needs (null when that shift isn't needed). */
export type Team = { people: Person[]; week: (Role | null)[] };

const workdays = (...list: number[]) => days.map((_, i) => list.includes(i));

/** The café team used for quick play. */
export const sampleTeam: Team = {
  people: [
    { name: "Jo", role: "barista", days: workdays(0, 1, 2, 3, 4), shifts: 3 },
    { name: "Rae", role: "barista", days: workdays(2, 3, 4, 5, 6), shifts: 3 },
    { name: "Dev", role: "barista", days: workdays(0, 1, 5, 6), shifts: 2 },
    { name: "Uma", role: "barista", days: workdays(0, 2, 3, 5, 6), shifts: 2 },
    { name: "Kit", role: "kitchen", days: workdays(0, 1, 2, 3, 5), shifts: 3 },
    { name: "Sam", role: "kitchen", days: workdays(1, 2, 3, 4, 5, 6), shifts: 3 },
    { name: "Fi", role: "kitchen", days: workdays(0, 1, 3, 4, 6), shifts: 3 },
    { name: "Gus", role: "kitchen", days: workdays(0, 2, 4, 6), shifts: 2 },
    { name: "Ali", role: "register", days: workdays(0, 1, 2, 4, 5), shifts: 3 },
    { name: "Bea", role: "register", days: workdays(1, 2, 3, 5, 6), shifts: 3 },
    { name: "Max", role: "register", days: workdays(0, 1, 2, 3, 4, 5, 6), shifts: 2 },
  ],
  week: [
    "barista", "kitchen", "register", "barista", "kitchen", "register", "barista",
    "kitchen", "register", "barista", "kitchen", "register", "barista", "kitchen",
  ],
};

/** Short form of someone's working days, such as "Mon–Fri" or "Mon, Wed–Thu". */
export function dayRange(list: boolean[]) {
  const parts: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (!list[i]) continue;
    let end = i;
    while (end + 1 < 7 && list[end + 1]) end++;
    parts.push(end === i ? days[i] : end === i + 1 ? `${days[i]}, ${days[end]}` : `${days[i]}–${days[end]}`);
    i = end;
  }
  return parts.join(", ") || "No days";
}

/** For each needed shift, who on the team could work it. Used by "Run it for real" to warn about gaps. */
export function checkTeam(team: Team) {
  const gaps = team.week.map((role, slot) => role && !team.people.some(person =>
    person.role === role && person.days[slot % 7] && person.shifts > 0) ? slot : -1).filter(slot => slot >= 0);
  const needed = team.week.filter(Boolean).length;
  const hours = team.people.reduce((sum, person) => sum + Math.max(0, person.shifts), 0);
  return { gaps, needed, hours };
}

// ---------------------------------------------------------------------------------------------------------------
// Tuning: every number lives here so playtesting only touches this block.
// ---------------------------------------------------------------------------------------------------------------

export type Stage = "calm" | "busy" | "chaos";

export const settings = {
  duration: 120,
  /** Seconds of holding the action button at the Manager's Desk to approve a request. */
  stampTime: 1.5,
  trayLimit: 4,
  /** Pacing: Calm 0:00–0:40, Busy 0:40–1:20, Chaos 1:20–2:00. */
  busyAt: 40,
  chaosAt: 80,
  /** Seconds between new Shift Requests, for 2 players. More players spawn faster. */
  spawnEvery: { calm: 3.4, busy: 2.8, chaos: 2.2 } as Record<Stage, number>,
  /** Seconds between cancellations (none while calm). */
  cancelEvery: { calm: Infinity, busy: 14, chaos: 9 } as Record<Stage, number>,
  /** Seconds between Shift Snatcher visits (none while calm). */
  snatcherEvery: { calm: Infinity, busy: 16, chaos: 10 } as Record<Stage, number>,
  snatcherSpeed: { calm: 2.4, busy: 2.4, chaos: 3.4 } as Record<Stage, number>,
  /** How long the Snatcher is dazed after a dash knocks it. */
  snatcherDaze: .9,
  /** How close a dashing player must get to knock the Snatcher. */
  knockReach: 1.05,
  speed: 6.4,
  dashSpeed: 16,
  dashTime: .16,
  dashCooldown: 1,
  reach: 1.45,
  /** How far from the edge of a station (tray, desk, shredder) a player can still use it. */
  stationReach: 1,
  /** Collision radius of a player, close to the size of the drawn critters. */
  body: .42,
  /** Staff waiting in the Staff Room to accept open shifts, and how many days each is free. */
  staffInRoom: 3,
  staffFreeDays: 3,
  maxPlayers: 4,
};

/** Board columns, one per day, centred on the office. */
export const columnGap = 2.06;
export const columnX = (day: number) => (day - 3) * columnGap;

export type Point = { x: number; z: number };

/**
 * The office floor runs x −9.25…9.25 (west → east) and z −5.1…5.1 (north/back wall → south/front).
 * The camera looks from the south. A counter splits the room along z = 0 from the west wall to x = 5.1,
 * leaving a walkable gap on the east side.
 *
 *   North half (back):  Roster Board along the back wall · Shredder (west) · Exit door (east wall)
 *   South half (front): Request Tray (west) · Manager's Desk (middle) · Staff Room (south-east corner)
 */
export const office = {
  bounds: { x: 9.25, z: 5.1 },
  counterRight: 5.1,
  counterDepth: .48,
  tray: { x: -6.4, z: 3.4 },
  desk: { x: -.55, z: 3.4 },
  boardZ: -4.35,
  pass: [-4.7, -2.6, -.5, 1.6].map(x => ({ x, z: 0 })),
  /** The door the Shift Snatcher sneaks in from and runs out of, on the east wall. */
  exit: { x: 8.85, z: -3.3 },
  /** The Staff Room zone (centre and size) where staff NPCs wait. */
  staffRoom: { x: 7.7, z: 3.7, w: 3.1, d: 2.8 },
  /** Where each staff NPC stands in the Staff Room. */
  staffSpots: [{ x: 6.7, z: 4.25 }, { x: 8.0, z: 4.35 }, { x: 8.35, z: 2.95 }],
  /** Where players start, by player index. */
  spawns: [{ x: -5.3, z: 2.05 }, { x: -.5, z: -1.3 }, { x: 2.8, z: 2.05 }, { x: -4.0, z: -1.6 }],
};

/** A solid piece of furniture: centre plus full width (x) and depth (z). */
export type Block = Point & { w: number; d: number };

// The 3D office draws each piece at these positions and sizes.
export const furniture = {
  inbox: { ...office.tray, w: 3.3, d: 1.5 },
  desk: { ...office.desk, w: 3.5, d: 1.2 },
  shredder: { x: -8.85, z: -2.1, w: .9, d: 1.0 },
  plants: [{ x: -9.05, z: -4.75, size: 1 }, { x: 9.05, z: -4.75, size: 1.1 }, { x: 9.1, z: 4.75, size: .9 }]
    .map(({ x, z, size }) => ({ x, z, w: .8 * size, d: .8 * size, size })),
  cooler: { x: -9.05, z: 4.7, w: .6, d: .6 },
  coffee: { x: 9.1, z: -.95, w: .7, d: 1.3 },
};

const blocks: Block[] = [
  furniture.inbox, furniture.desk, furniture.shredder, ...furniture.plants, furniture.cooler, furniture.coffee,
];

/** Distance from a point to the nearest edge of a block (0 when inside it). */
function edgeDistance(point: Point, block: Block) {
  const dx = Math.max(0, Math.abs(point.x - block.x) - block.w / 2);
  const dz = Math.max(0, Math.abs(point.z - block.z) - block.d / 2);
  return Math.hypot(dx, dz);
}

/** Whether a player at this point can use a station such as the tray, desk or shredder. */
export function nearStation(point: Point, station: Block) {
  return edgeDistance(point, station) <= settings.stationReach;
}

/** Where a card sits on the Request Tray, by seat (0…trayLimit−1). */
export function traySpot(seat: number): Point {
  return { x: office.tray.x + (seat % 2 - .5) * 1.36, z: office.tray.z + (Math.floor(seat / 2) - .5) * .58 };
}

/** The floor spot in front of a board slot, where the Snatcher stands to steal from it. */
export function slotFloor(slot: number): Point {
  return { x: columnX(slot % 7) + (slot < 7 ? -.45 : .45), z: office.boardZ + .45 };
}

// ---------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------

/**
 * request:   blue — an employee asked for a shift on `day`. Needs the manager's stamp.
 * open:      yellow — a shift on `day` with nobody on it. A staff NPC in the Staff Room must accept it.
 * cancelled: red — a pinned shift whose worker cancelled. Pull it off the board and shred it.
 */
export type CardKind = "request" | "open" | "cancelled";

export type CardPlace =
  | { place: "tray"; seat: number }
  | { place: "hand"; player: number }
  | { place: "counter"; pad: number }
  | { place: "floor"; point: Point }
  | { place: "board"; slot: number }
  | { place: "snatcher" }
  /** Shredded, or carried out of the exit by the Snatcher. */
  | { place: "gone" };

export type Card = {
  id: number;
  kind: CardKind;
  /** 0 = Mon … 6 = Sun. */
  day: number;
  /** Index into `round.staff` of the employee on the card. Open shifts have none until a staff member accepts. */
  worker?: number;
  /** Stamped at the desk (requests) or accepted in the Staff Room (open shifts). */
  approved: boolean;
  /** Seconds of stamping so far, 0…settings.stampTime. */
  stamp: number;
  at: CardPlace;
  /** round.elapsed when the card appeared, for spawn animations. */
  born: number;
};

/** An employee in the system. `id` is their index in `round.staff`. */
export type Staff = Person & { id: number };

export type Npc =
  /** A staff member waiting in the Staff Room. Their speech bubble shows the days they are free. */
  | { kind: "staff"; id: number; person: number; point: Point; days: number[] }
  /** The bin chicken that steals pinned cards and runs for the exit. */
  | {
    kind: "snatcher";
    id: number;
    point: Point;
    facing: number;
    state: "sneak" | "flee" | "dazed";
    /** Board slot it is heading for while sneaking. */
    target: number;
    /** Card id it is carrying. */
    card?: number;
    /** round.elapsed when a daze wears off. */
    dazedUntil: number;
  };

export type Player = {
  position: Point;
  /** Card id being carried. */
  holding?: number;
  stamping: boolean;
  facing: number;
  moving: boolean;
  message: string;
  messageUntil: number;
  /** round.elapsed until which the player is dashing. */
  dashUntil: number;
  /** round.elapsed from which the player may dash again. */
  dashReady: number;
};

export type Stats = { pinned: number; stamped: number; shredded: number; accepted: number; rescues: number };

export type FxKind =
  | "spawn" | "pick" | "put" | "stamp" | "pin" | "nope" | "cancel" | "shred" | "open" | "accept"
  | "snatch" | "knock" | "rescue" | "escape" | "dash" | "busy" | "chaos" | "win" | "lose";

/** A one-off moment for the renderer and sound. `id` only ever increases within a round. */
export type Fx = { id: number; kind: FxKind; x: number; z: number; player?: number; card?: number };

export type Round = {
  phase: "ready" | "playing" | "won" | "lost";
  elapsed: number;
  stage: Stage;
  nextSpawn: number;
  nextCancel: number;
  nextSnatch: number;
  /** Which of the 14 slots the week needs. */
  needed: boolean[];
  /** The role each slot needs, kept for the end-screen roster colours. Not used by the rules. */
  week: (Role | null)[];
  staff: Staff[];
  /** All cards ever made this round, indexed by id. Finished cards stay with `at.place === "gone"`. */
  cards: Card[];
  /** Card id pinned in each of the 14 slots (may be a red cancelled card). */
  board: (number | undefined)[];
  /** Days of open shifts waiting for a free seat on the tray. */
  openQueue: number[];
  players: Player[];
  npcs: Npc[];
  stats: Stats[];
  fx: Fx[];
  fxSeq: number;
  /** Latest office news for the interface, such as a cancellation. */
  news: { text: string; until: number };
  custom: boolean;
};

// ---------------------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------------------

export const cardIn = (round: Round, slot: number) => {
  const id = round.board[slot];
  return id === undefined ? undefined : round.cards[id];
};

/** The card a player is carrying. */
export const heldCard = (round: Round, player: number) => {
  const id = round.players[player]?.holding;
  return id === undefined ? undefined : round.cards[id];
};

/** A slot is covered when it holds a card that isn't cancelled. */
export const covered = (round: Round, slot: number) => {
  const card = cardIn(round, slot);
  return Boolean(card && card.kind !== "cancelled");
};

export function filledShifts(round: Round) {
  return round.needed.filter((need, slot) => need && covered(round, slot)).length;
}

export function neededShifts(round: Round) {
  return round.needed.filter(Boolean).length;
}

/** Who is rostered on each shift, or undefined while it is open, cancelled or not needed. */
export function roster(round: Round) {
  return round.board.map((_, slot) => {
    const card = cardIn(round, slot);
    return card && card.kind !== "cancelled" && card.worker !== undefined ? round.staff[card.worker] : undefined;
  });
}

export function stageAt(elapsed: number): Stage {
  return elapsed >= settings.chaosAt ? "chaos" : elapsed >= settings.busyAt ? "busy" : "calm";
}

/** The day column in front of a point at the board. */
export function columnAt(point: Point) {
  return Math.max(0, Math.min(6, Math.round(point.x / columnGap + 3)));
}

export function atBoard(point: Point) {
  return point.z <= office.boardZ + settings.reach && Math.abs(point.x) <= 7.8;
}

export const atDesk = (point: Point) => nearStation(point, furniture.desk);
export const atShredder = (point: Point) => nearStation(point, furniture.shredder);
export const atTray = (point: Point) => nearStation(point, furniture.inbox);

/** Where a card is in the world right now (for drawing and distance checks). */
export function cardPoint(round: Round, card: Card): Point | undefined {
  const { at } = card;
  if (at.place === "tray") return traySpot(at.seat);
  if (at.place === "counter") return office.pass[at.pad];
  if (at.place === "floor") return at.point;
  if (at.place === "hand") return round.players[at.player]?.position;
  if (at.place === "board") return slotFloor(at.slot);
  if (at.place === "snatcher") return round.npcs.find(npc => npc.kind === "snatcher")?.point;
  return undefined;
}

const live = (card: Card) => card.at.place !== "gone";
const traySeats = (round: Round) => round.cards.filter(card => card.at.place === "tray")
  .map(card => (card.at as { seat: number }).seat);
const freeSeat = (round: Round) => {
  const taken = traySeats(round);
  for (let seat = 0; seat < settings.trayLimit; seat++) if (!taken.includes(seat)) return seat;
  return undefined;
};

/** Slots on this day the week needs that nobody (not even a cancelled card) is in. */
const emptySlots = (round: Round, day: number) => [day, day + 7].filter(slot => round.needed[slot] && round.board[slot] === undefined);

/**
 * How many more cards this day needs. Every empty slot needs one card; every card already heading for this day
 * (requests and open shifts off the board, cancelled cards that will become open shifts, cards the Snatcher holds,
 * queued open shifts) is already on its way.
 */
function shortfall(round: Round, day: number) {
  const empty = emptySlots(round, day).length;
  const incoming = round.cards.filter(card => live(card) && card.day === day && card.at.place !== "board").length
    + round.openQueue.filter(queued => queued === day).length;
  return empty - incoming;
}

// ---------------------------------------------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------------------------------------------

function makePlayer(index: number): Player {
  return {
    position: { ...office.spawns[index] }, facing: index % 2 ? Math.PI : 0, moving: false, stamping: false,
    message: "", messageUntil: 0, dashUntil: 0, dashReady: 0,
  };
}

const shuffle = <T,>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function freeDays(person: Person) {
  const available = days.map((_, i) => i).filter(i => person.days[i]);
  const pool = available.length >= settings.staffFreeDays ? available : days.map((_, i) => i);
  return shuffle(pool).slice(0, settings.staffFreeDays).sort((a, b) => a - b);
}

/** A fresh round. `players` is how many helper critters are in the office (2–4). */
export function newRound(team: Team = sampleTeam, custom = false, players = 2): Round {
  const people = team.people.length ? team.people : sampleTeam.people;
  const staff = people.map((person, id) => ({ ...person, days: [...person.days], id }));
  const roomStaff = shuffle(staff.map(person => person.id)).slice(0, settings.staffInRoom);
  const count = Math.max(1, Math.min(settings.maxPlayers, players));
  return {
    phase: "ready",
    elapsed: 0,
    stage: "calm",
    nextSpawn: 0,
    nextCancel: settings.busyAt + 4,
    nextSnatch: settings.busyAt + 8,
    needed: team.week.map(role => role !== null),
    week: [...team.week],
    staff,
    cards: [],
    board: shifts.map(() => undefined),
    openQueue: [],
    players: Array.from({ length: count }, (_, i) => makePlayer(i)),
    npcs: roomStaff.map((person, i) => ({
      kind: "staff" as const, id: i, person, point: { ...office.staffSpots[i % office.staffSpots.length] },
      days: freeDays(staff[person]),
    })),
    stats: Array.from({ length: count }, () => ({ pinned: 0, stamped: 0, shredded: 0, accepted: 0, rescues: 0 })),
    fx: [],
    fxSeq: 0,
    news: { text: "", until: 0 },
    custom,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------------

function fx(round: Round, kind: FxKind, at: Point, extra: { player?: number; card?: number } = {}) {
  round.fx.push({ id: ++round.fxSeq, kind, x: at.x, z: at.z, ...extra });
  if (round.fx.length > 48) round.fx.splice(0, round.fx.length - 48);
}

function notify(round: Round, player: Player, message: string) {
  player.message = message;
  player.messageUntil = round.elapsed + 2.2;
}

function announce(round: Round, text: string) {
  round.news = { text, until: round.elapsed + 4 };
}

function makeCard(round: Round, kind: CardKind, day: number, at: CardPlace, worker?: number): Card {
  const card: Card = { id: round.cards.length, kind, day, worker, approved: false, stamp: 0, at, born: round.elapsed };
  round.cards.push(card);
  return card;
}

/** Pick an employee to send a request for this day: someone who works that day and isn't already on it. */
function requester(round: Round, day: number) {
  const busy = new Set(round.cards.filter(card => live(card) && card.day === day && card.worker !== undefined)
    .map(card => card.worker));
  const keen = round.staff.filter(person => person.days[day] && !busy.has(person.id));
  const pool = keen.length ? keen : round.staff;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** A new Shift Request lands on the tray, for a day that still needs cover. */
function spawnRequest(round: Round) {
  const seat = freeSeat(round);
  if (seat === undefined) return;
  const wanting = days.map((_, day) => day).filter(day => shortfall(round, day) > 0);
  if (!wanting.length) return;
  const day = wanting[Math.floor(Math.random() * wanting.length)];
  const card = makeCard(round, "request", day, { place: "tray", seat }, requester(round, day));
  fx(round, "spawn", traySpot(seat), { card: card.id });
}

/** Open shifts wait in a queue until there's a seat on the tray. */
function placeOpenShifts(round: Round) {
  while (round.openQueue.length) {
    const seat = freeSeat(round);
    if (seat === undefined) return;
    const day = round.openQueue.shift()!;
    const card = makeCard(round, "open", day, { place: "tray", seat });
    fx(round, "open", traySpot(seat), { card: card.id });
  }
}

/** Make sure some staff member in the Staff Room is free on every day that has an open shift. */
function keepStaffRoomUseful(round: Round) {
  const staff = round.npcs.filter((npc): npc is Extract<Npc, { kind: "staff" }> => npc.kind === "staff");
  if (!staff.length) return;
  const openDays = new Set(round.cards.filter(card => live(card) && card.kind === "open" && !card.approved).map(card => card.day));
  round.openQueue.forEach(day => openDays.add(day));
  openDays.forEach(day => {
    if (staff.some(npc => npc.days.includes(day))) return;
    const npc = staff[Math.floor(Math.random() * staff.length)];
    npc.days[Math.floor(Math.random() * npc.days.length)] = day;
    npc.days = [...new Set(npc.days)].sort((a, b) => a - b);
  });
}

function cancelShift(round: Round) {
  const snatcher = round.npcs.find(npc => npc.kind === "snatcher");
  const filled = round.board.map((_, slot) => slot).filter(slot => covered(round, slot)
    && !(snatcher?.kind === "snatcher" && snatcher.target === slot));
  if (filled.length < 2) return;
  const slot = filled[Math.floor(Math.random() * filled.length)];
  const card = cardIn(round, slot)!;
  card.kind = "cancelled";
  card.approved = false;
  const who = card.worker === undefined ? "Someone" : round.staff[card.worker].name;
  announce(round, `${who} cancelled ${shifts[slot].label}! Pull the red card and shred it.`);
  fx(round, "cancel", slotFloor(slot), { card: card.id });
}

function spawnSnatcher(round: Round) {
  if (round.npcs.some(npc => npc.kind === "snatcher")) return;
  const filled = round.board.map((_, slot) => slot).filter(slot => covered(round, slot));
  if (filled.length < 2) return;
  const target = filled[Math.floor(Math.random() * filled.length)];
  round.npcs.push({
    kind: "snatcher", id: 100 + round.fxSeq, point: { ...office.exit }, facing: -Math.PI / 2,
    state: "sneak", target, dazedUntil: 0,
  });
  announce(round, "The Shift Snatcher is loose! Dash into it (Shift) to save the shift.");
}

function stepToward(point: Point, goal: Point, distance: number) {
  const dx = goal.x - point.x;
  const dz = goal.z - point.z;
  const length = Math.hypot(dx, dz);
  if (length <= distance) {
    point.x = goal.x;
    point.z = goal.z;
    return true;
  }
  point.x += dx / length * distance;
  point.z += dz / length * distance;
  return false;
}

function stepSnatcher(round: Round, seconds: number) {
  const index = round.npcs.findIndex(npc => npc.kind === "snatcher");
  if (index === -1) return;
  const chicken = round.npcs[index] as Extract<Npc, { kind: "snatcher" }>;
  const speed = settings.snatcherSpeed[round.stage] * seconds;

  // A dashing player who reaches it knocks it over: it drops whatever it holds and gives up.
  if (chicken.state !== "dazed") {
    const knocker = round.players.findIndex(player => round.elapsed < player.dashUntil
      && Math.hypot(player.position.x - chicken.point.x, player.position.z - chicken.point.z) <= settings.knockReach);
    if (knocker !== -1) {
      chicken.state = "dazed";
      chicken.dazedUntil = round.elapsed + settings.snatcherDaze;
      fx(round, "knock", chicken.point, { player: knocker });
      if (chicken.card !== undefined) {
        const card = round.cards[chicken.card];
        card.at = { place: "floor", point: { x: chicken.point.x, z: Math.max(chicken.point.z, office.boardZ + .9) } };
        chicken.card = undefined;
        round.stats[knocker].rescues++;
        fx(round, "rescue", chicken.point, { player: knocker, card: card.id });
      }
      return;
    }
  }

  if (chicken.state === "dazed") {
    if (round.elapsed >= chicken.dazedUntil) chicken.state = "flee";
    return;
  }

  if (chicken.state === "sneak") {
    if (!covered(round, chicken.target)) {
      // Someone else emptied that slot; pick another or give up.
      const filled = round.board.map((_, slot) => slot).filter(slot => covered(round, slot));
      if (!filled.length) chicken.state = "flee";
      else chicken.target = filled[Math.floor(Math.random() * filled.length)];
      return;
    }
    const goal = slotFloor(chicken.target);
    chicken.facing = Math.atan2(goal.x - chicken.point.x, goal.z - chicken.point.z);
    if (stepToward(chicken.point, goal, speed)) {
      const card = cardIn(round, chicken.target)!;
      round.board[chicken.target] = undefined;
      card.at = { place: "snatcher" };
      chicken.card = card.id;
      chicken.state = "flee";
      announce(round, `The Snatcher grabbed ${shifts[chicken.target].label}! Dash into it!`);
      fx(round, "snatch", goal, { card: card.id });
    }
    return;
  }

  // Fleeing: a little faster with a card in its beak.
  chicken.facing = Math.atan2(office.exit.x - chicken.point.x, office.exit.z - chicken.point.z);
  if (stepToward(chicken.point, office.exit, speed * (chicken.card === undefined ? 1.3 : 1.1))) {
    if (chicken.card !== undefined) {
      const card = round.cards[chicken.card];
      card.at = { place: "gone" };
      round.openQueue.push(card.day);
      announce(round, `The Snatcher escaped with a ${days[card.day]} shift. It's an open shift now.`);
      fx(round, "escape", office.exit, { card: card.id });
    }
    round.npcs.splice(index, 1);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Round flow
// ---------------------------------------------------------------------------------------------------------------

export function beginRound(round: Round) {
  if (round.phase !== "ready") return;
  round.phase = "playing";
  for (let i = 0; i < 3; i++) spawnRequest(round);
  round.nextSpawn = spawnInterval(round);
}

function spawnInterval(round: Round) {
  // More helpers means more requests: 2 players is the baseline.
  return settings.spawnEvery[round.stage] * Math.sqrt(2 / Math.max(1, round.players.length));
}

function checkWin(round: Round) {
  if (round.phase === "playing" && filledShifts(round) >= neededShifts(round)) {
    round.phase = "won";
    fx(round, "win", { x: 0, z: office.boardZ });
  }
}

export function stepRound(round: Round, seconds: number) {
  if (round.phase !== "playing") return;
  round.elapsed = Math.min(settings.duration, round.elapsed + seconds);
  if (round.elapsed >= settings.duration) {
    round.phase = "lost";
    round.players.forEach((_, i) => stopStamp(round, i));
    fx(round, "lose", { x: 0, z: 0 });
    return;
  }
  const stage = stageAt(round.elapsed);
  if (stage !== round.stage) {
    round.stage = stage;
    fx(round, stage === "chaos" ? "chaos" : "busy", { x: 0, z: 0 });
    announce(round, stage === "busy" ? "Busy! Cancellations and the Snatcher are coming." : "Chaos! Everything speeds up.");
  }

  if (round.elapsed >= round.nextSpawn) {
    spawnRequest(round);
    round.nextSpawn = round.elapsed + spawnInterval(round);
  }
  if (round.elapsed >= round.nextCancel) {
    cancelShift(round);
    round.nextCancel = round.elapsed + settings.cancelEvery[round.stage];
  }
  if (round.elapsed >= round.nextSnatch) {
    spawnSnatcher(round);
    round.nextSnatch = round.elapsed + settings.snatcherEvery[round.stage];
  }
  placeOpenShifts(round);
  keepStaffRoomUseful(round);
  stepSnatcher(round, seconds);

  round.players.forEach((player, i) => {
    const card = heldCard(round, i);
    if (!player.stamping || !card) return;
    if (!atDesk(player.position) || card.kind !== "request") {
      stopStamp(round, i);
      return;
    }
    card.stamp = Math.min(settings.stampTime, card.stamp + seconds);
    if (card.stamp >= settings.stampTime) {
      card.approved = true;
      player.stamping = false;
      round.stats[i].stamped++;
      fx(round, "stamp", office.desk, { player: i, card: card.id });
    }
  });
  checkWin(round);
}

// ---------------------------------------------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------------------------------------------

function walkable(point: Point) {
  const { body } = settings;
  return Math.abs(point.x) <= office.bounds.x
    && Math.abs(point.z) <= office.bounds.z
    && (point.x > office.counterRight + body || Math.abs(point.z) > office.counterDepth + body)
    && blocks.every(block => edgeDistance(point, block) >= body);
}

export const isDashing = (round: Round, index: number) => round.elapsed < (round.players[index]?.dashUntil ?? 0);

/** Move a player by an input direction (any length) for `seconds`. While dashing they shoot along their facing. */
export function walk(round: Round, index: number, dx: number, dz: number, seconds: number) {
  const player = round.players[index];
  if (!player) return;
  player.moving = false;
  if (round.phase !== "playing") return;
  let length = Math.hypot(dx, dz);
  const dashing = isDashing(round, index);
  if (!length && dashing) {
    dx = Math.sin(player.facing);
    dz = Math.cos(player.facing);
    length = 1;
  }
  if (!length) return;
  const { position } = player;
  const speed = (dashing ? settings.dashSpeed : settings.speed) * seconds / length;
  const x = position.x + dx * speed;
  const z = position.z + dz * speed;
  if (walkable({ x, z: position.z })) {
    player.moving = player.moving || x !== position.x;
    position.x = x;
  }
  if (walkable({ x: position.x, z })) {
    player.moving = player.moving || z !== position.z;
    position.z = z;
  }
  player.facing = Math.atan2(dx, dz);
  if (player.stamping && !atDesk(position)) stopStamp(round, index);
}

/** Shift: a short burst of speed. Dashing into the Snatcher knocks it over. */
export function dash(round: Round, index: number) {
  const player = round.players[index];
  if (!player || round.phase !== "playing" || round.elapsed < player.dashReady) return;
  player.dashUntil = round.elapsed + settings.dashTime;
  player.dashReady = round.elapsed + settings.dashCooldown;
  stopStamp(round, index);
  fx(round, "dash", player.position, { player: index });
}

export function stopStamp(round: Round, index: number) {
  const player = round.players[index];
  if (!player) return;
  player.stamping = false;
  const card = heldCard(round, index);
  if (card && !card.approved) card.stamp = 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Interaction (Space / Enter / phone action button)
// ---------------------------------------------------------------------------------------------------------------

/** A loose card in reach: on the tray, a counter pad or the floor. */
function cardInReach(round: Round, point: Point) {
  return round.cards.map(card => {
    if (card.at.place === "tray") {
      if (!atTray(point)) return undefined;
      const spot = traySpot(card.at.seat);
      return { card, distance: Math.hypot(point.x - spot.x, point.z - spot.z) - 10 };
    }
    let target: Point | undefined;
    if (card.at.place === "counter") target = office.pass[card.at.pad];
    if (card.at.place === "floor") target = card.at.point;
    if (!target) return undefined;
    const distance = Math.hypot(point.x - target.x, point.z - target.z);
    return distance <= settings.reach ? { card, distance } : undefined;
  }).filter(entry => entry !== undefined)
    .sort((a, b) => a.distance - b.distance)[0]?.card;
}

function passInReach(round: Round, point: Point, emptyOnly: boolean) {
  return office.pass.map((pad, index) => ({ index, distance: Math.hypot(pad.x - point.x, pad.z - point.z) }))
    .filter(({ index, distance }) => distance <= settings.reach && (!emptyOnly || !round.cards.some(
      card => card.at.place === "counter" && card.at.pad === index,
    )))
    .sort((a, b) => a.distance - b.distance)[0]?.index;
}

/** A cancelled card in the board column in front of this point. */
function cancelledAt(round: Round, point: Point) {
  if (!atBoard(point)) return undefined;
  const day = columnAt(point);
  return [day, day + 7].find(slot => cardIn(round, slot)?.kind === "cancelled");
}

/** The staff NPC in reach of this point. */
export function staffInReach(round: Round, point: Point) {
  return round.npcs.map(npc => (npc.kind === "staff" ? { npc, distance: Math.hypot(npc.point.x - point.x, npc.point.z - point.z) } : undefined))
    .filter(entry => entry !== undefined && entry.distance <= settings.reach)
    .sort((a, b) => a!.distance - b!.distance)[0]?.npc as Extract<Npc, { kind: "staff" }> | undefined;
}

/** Where on the board this card can go from this point, or why not. */
function pinTarget(round: Round, point: Point, card: Card): { slot: number } | { why: string } {
  const day = columnAt(point);
  if (card.kind === "cancelled") return { why: "Cancelled cards go in the shredder" };
  if (!card.approved) return { why: card.kind === "open" ? "Get a staff member to accept it first" : "Stamp it at the desk first" };
  if (card.day !== day) return { why: `That's a ${days[card.day]} shift, not ${days[day]}` };
  const slot = [day, day + 7].find(slot => round.needed[slot] && round.board[slot] === undefined);
  if (slot === undefined) {
    const blocked = [day, day + 7].some(slot => cardIn(round, slot)?.kind === "cancelled");
    return { why: blocked ? `Pull the red card off ${days[day]} first` : `${days[day]} is full` };
  }
  return { slot };
}

/** A short hint for what the action button will do right now. */
export function nextAction(round: Round, index: number) {
  const player = round.players[index];
  if (!player) return "";
  const { position } = player;
  const card = heldCard(round, index);
  if (!card) {
    const red = cancelledAt(round, position);
    if (red !== undefined) return `Pull cancelled ${shifts[red].label}`;
    const loose = cardInReach(round, position);
    if (loose) return `Grab ${days[loose.day]} ${loose.kind === "request" ? "request" : loose.kind === "open" ? "open shift" : "cancelled card"}`;
    return position.z < 0 ? "Collect from the counter" : "Grab a request from the tray";
  }
  if (atBoard(position)) {
    const target = pinTarget(round, position, card);
    return "slot" in target ? `Pin to ${shifts[target.slot].label}` : target.why;
  }
  if (atShredder(position)) return card.kind === "cancelled" ? "Shred it" : "Shred (bin this card)";
  if (card.kind === "request" && !card.approved && atDesk(position)) return "Hold to stamp";
  if (card.kind === "open" && !card.approved) {
    const npc = staffInReach(round, position);
    if (npc) {
      const name = round.staff[npc.person].name;
      return npc.days.includes(card.day) ? `Offer to ${name}` : `${name} isn't free ${days[card.day]}`;
    }
  }
  if (card.kind !== "cancelled" && atTray(position) && freeSeat(round) !== undefined) return "Put back";
  if (passInReach(round, position, true) !== undefined) return "Pass over";
  if (passInReach(round, position, false) !== undefined) return "Counter full";
  if (card.kind === "cancelled") return "Take it to the shredder";
  if (card.kind === "open" && !card.approved) return "Take it to the staff room";
  if (!card.approved) return "Take it to the desk";
  return `Pin it on ${days[card.day]}`;
}

function release(round: Round, index: number, at: CardPlace) {
  const player = round.players[index];
  const card = heldCard(round, index)!;
  stopStamp(round, index);
  card.at = at;
  player.holding = undefined;
  const point = cardPoint(round, card) ?? player.position;
  fx(round, "put", point, { player: index, card: card.id });
}

/** Tap the action button. Holding it at the desk stamps; letting go calls `stopStamp`. */
export function interact(round: Round, index: number) {
  if (round.phase !== "playing") return;
  const player = round.players[index];
  if (!player) return;
  const { position } = player;
  const card = heldCard(round, index);

  if (!card) {
    const red = cancelledAt(round, position);
    const loose = red === undefined ? cardInReach(round, position) : cardIn(round, red);
    if (!loose) return;
    if (red !== undefined) round.board[red] = undefined;
    loose.at = { place: "hand", player: index };
    player.holding = loose.id;
    fx(round, "pick", position, { player: index, card: loose.id });
    return;
  }

  if (atBoard(position)) {
    const target = pinTarget(round, position, card);
    if (!("slot" in target)) {
      notify(round, player, `${target.why}.`);
      fx(round, "nope", position, { player: index, card: card.id });
      return;
    }
    round.board[target.slot] = card.id;
    card.at = { place: "board", slot: target.slot };
    player.holding = undefined;
    round.stats[index].pinned++;
    fx(round, "pin", slotFloor(target.slot), { player: index, card: card.id });
    checkWin(round);
    return;
  }

  if (atShredder(position)) {
    stopStamp(round, index);
    card.at = { place: "gone" };
    player.holding = undefined;
    round.stats[index].shredded++;
    if (card.kind === "cancelled") round.openQueue.push(card.day);
    fx(round, "shred", furniture.shredder, { player: index, card: card.id });
    return;
  }

  if (card.kind === "request" && !card.approved && atDesk(position)) {
    player.stamping = true;
    return;
  }

  if (card.kind === "open" && !card.approved) {
    const npc = staffInReach(round, position);
    if (npc) {
      const name = round.staff[npc.person].name;
      if (!npc.days.includes(card.day)) {
        notify(round, player, `${name} isn't free ${days[card.day]}.`);
        fx(round, "nope", npc.point, { player: index, card: card.id });
        return;
      }
      card.approved = true;
      card.worker = npc.person;
      npc.days = npc.days.filter(day => day !== card.day);
      if (!npc.days.length) npc.days = freeDays(round.staff[npc.person]);
      round.stats[index].accepted++;
      fx(round, "accept", npc.point, { player: index, card: card.id });
      return;
    }
  }

  const seat = card.kind !== "cancelled" && atTray(position) ? freeSeat(round) : undefined;
  if (seat !== undefined) {
    release(round, index, { place: "tray", seat });
    return;
  }

  const pad = passInReach(round, position, true);
  if (pad === undefined && passInReach(round, position, false) !== undefined) {
    fx(round, "nope", position, { player: index, card: card.id });
    return;
  }
  release(round, index, pad === undefined ? { place: "floor", point: { ...position } } : { place: "counter", pad });
}
