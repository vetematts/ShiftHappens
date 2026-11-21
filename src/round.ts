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

/** Colours handed out to roles in order. Caps, name tags and board slots use them. */
export const roleColours = ["#ff7aa8", "#ffa53d", "#3ec7b4", "#7c8cff"];
/** A job on the team, such as barista or dentist. */
export type Role = { id: string; label: string; colour: string };
export const maxRoles = 4;
/** The most people one shift can need, so the board stays readable. */
export const maxPerShift = 4;

/** The 14 shifts of a week: Monday to Sunday first shifts, then Monday to Sunday second shifts. */
export const shifts = [0, 1].flatMap(half => days.map((day, dayIndex) => ({ day, dayIndex, half, label: `${day} ${half ? "PM" : "AM"}` })));

/** Someone on the team. */
export type Person = { name: string; role: string; days: boolean[]; shifts: number };

/** Everything needed to roster a week: the roles, the people and how many of each role every shift needs. */
export type Team = {
  /** Which starting point this came from (cafe, dental, salon or blank). */
  kind: string;
  roles: Role[];
  /** What the two shifts in a day are called, such as AM and PM or 8–12 and 1–5. */
  shiftNames: [string, string];
  /** How many shifts one person can work in a day: 1, or 2 when people work full days. */
  perDay: 1 | 2;
  people: Person[];
  /** For each of the 14 shifts, how many people of each role (by id) it needs. */
  needs: Record<string, number>[];
};

/** One place to fill on the board: a role on a shift. */
export type Slot = { shift: number; role: string };

const workdays = (...list: number[]) => days.map((_, i) => list.includes(i));
const allShifts = (need: (shift: number, day: number, half: number) => Record<string, number>) =>
  shifts.map(({ dayIndex, half }, shift) => need(shift, dayIndex, half));
const role = (id: string, label: string, colour: number): Role => ({ id, label, colour: roleColours[colour] });

/** The café team used for quick play. There's enough slack that random choices still finish the week about 98% of the time. */
export const sampleTeam: Team = {
  kind: "cafe",
  roles: [role("barista", "Barista", 0), role("kitchen", "Kitchen", 1), role("register", "Register", 2)],
  shiftNames: ["AM", "PM"],
  perDay: 1,
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
  needs: [
    "barista", "kitchen", "register", "barista", "kitchen", "register", "barista",
    "kitchen", "register", "barista", "kitchen", "register", "barista", "kitchen",
  ].map(id => ({ [id]: 1 })),
};

const weekdays = workdays(0, 1, 2, 3, 4);

/** Starting points for "Roster my team". Each is a full week that random choices still finish over 90% of the time, ready to edit. */
export const templates: { id: string; label: string; blurb: string; icon: string; team: Team }[] = [
  { id: "cafe", label: "Café", blurb: "Baristas, kitchen and register, open every day", icon: "☕", team: sampleTeam },
  {
    id: "dental", label: "Dental clinic", blurb: "Dentists, assistants and reception, weekdays", icon: "🦷",
    team: {
      kind: "dental",
      roles: [role("dentist", "Dentist", 3), role("assistant", "Assistant", 2), role("reception", "Reception", 0)],
      shiftNames: ["8–12", "1–5"],
      perDay: 2,
      people: [
        { name: "Dr Lee", role: "dentist", days: workdays(0, 1, 2, 3), shifts: 8 },
        { name: "Dr Patel", role: "dentist", days: workdays(1, 2, 3, 4), shifts: 8 },
        { name: "Dr Wu", role: "dentist", days: workdays(0, 4), shifts: 4 },
        { name: "Mia", role: "assistant", days: weekdays, shifts: 8 },
        { name: "Noah", role: "assistant", days: weekdays, shifts: 8 },
        { name: "Ivy", role: "assistant", days: workdays(0, 2, 4), shifts: 6 },
        { name: "Zoe", role: "reception", days: weekdays, shifts: 8 },
        { name: "Tom", role: "reception", days: weekdays, shifts: 8 },
      ],
      needs: allShifts((_, day): Record<string, number> => (day < 5 ? { dentist: 1, assistant: 1, reception: 1 } : {})),
    },
  },
  {
    id: "salon", label: "Hair salon", blurb: "Stylists and apprentices, busy Saturdays", icon: "💇",
    team: {
      kind: "salon",
      roles: [role("stylist", "Stylist", 0), role("apprentice", "Apprentice", 1)],
      shiftNames: ["9–1", "1–6"],
      perDay: 2,
      people: [
        { name: "Kim", role: "stylist", days: workdays(1, 2, 3, 4, 5), shifts: 8 },
        { name: "Ash", role: "stylist", days: workdays(1, 2, 3, 4, 5), shifts: 6 },
        { name: "Lou", role: "stylist", days: workdays(2, 3, 4, 5), shifts: 6 },
        { name: "Bo", role: "stylist", days: workdays(4, 5), shifts: 4 },
        { name: "Pip", role: "apprentice", days: workdays(1, 2, 3, 4, 5), shifts: 8 },
        { name: "Ren", role: "apprentice", days: workdays(1, 2, 3, 4, 5), shifts: 6 },
      ],
      needs: allShifts((_, day): Record<string, number> =>
        (day === 5 ? { stylist: 2, apprentice: 1 } : day >= 1 && day <= 4 ? { stylist: 1, apprentice: 1 } : {})),
    },
  },
  {
    id: "blank", label: "Start from scratch", blurb: "Name your own roles and shifts", icon: "✏️",
    team: {
      kind: "blank",
      roles: [role("staff", "Staff", 0)],
      shiftNames: ["AM", "PM"],
      perDay: 1,
      people: [],
      needs: shifts.map(() => ({})),
    },
  },
];

/** A role by id, or a grey stand-in if the team no longer has it. */
export function roleIn(roles: Role[], id: string): Role {
  return roles.find(entry => entry.id === id) ?? { id, label: "Unknown", colour: "#9b8b7a" };
}

export const shiftLabel = (shiftNames: [string, string], shift: number) =>
  `${days[shift % 7]} ${shiftNames[shift < 7 ? 0 : 1]}`;

/** Every place to fill this week, in board order: shift by shift, roles in team order. */
export function slotsOf(team: Team): Slot[] {
  return shifts.flatMap((_, shift) => team.roles.flatMap(({ id }) =>
    Array.from({ length: Math.max(0, Math.floor(team.needs[shift]?.[id] ?? 0)) }, () => ({ shift, role: id })),
  ).slice(0, maxPerShift));
}

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

/** Problems to fix before playing: places nobody could fill, and roles without enough shifts between them. */
export function checkTeam(team: Team) {
  const slots = slotsOf(team);
  const gaps = slots.filter(({ shift, role: id }) => !team.people.some(person =>
    person.role === id && person.days[shift % 7] && person.shifts > 0));
  const short = team.roles.map(({ id, label }) => {
    const need = slots.filter(slot => slot.role === id).length;
    const have = team.people.filter(person => person.role === id).reduce((sum, person) => sum + Math.max(0, person.shifts), 0);
    return { id, label, need, have };
  }).filter(({ need, have }) => need > have);
  return { slots, gaps, short, needed: slots.length };
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
  cancelEvery: { calm: Infinity, busy: 22, chaos: 18 } as Record<Stage, number>,
  /** Cancellations per round at most, so the board can still build up. */
  maxCancels: 4,
  /** A freshly pinned card can't be cancelled for this many seconds. */
  cancelGrace: 12,
  /** No cancellations until at least this many shifts are covered. */
  cancelFrom: 4,
  /** A card wobbles on the board for this long before it turns red. */
  cancelWarning: 3,
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
  dashCooldown: .35,
  /** Dash charges per critter. One refills on its own every `dashRegen` seconds; ⚡ pickups refill one at once. */
  dashCharges: 3,
  dashRegen: 9,
  /** ⚡ pickups on the floor: a new one every few seconds (at most `maxBolts` lying around). */
  boltEvery: { min: 5, max: 9 },
  maxBolts: 2,
  boltReach: .8,
  /** Grabbing a ⚡ with full charges gives a speed boost instead. */
  boostTime: 4,
  boostSpeed: 1.35,
  reach: 1.45,
  /** How far from the edge of a station (tray, desk, shredder) a player can still use it. */
  stationReach: 1,
  /** Collision radius of a player, close to the size of the drawn critters. */
  body: .42,
  /** Employees wandering the office. Each yellow open shift is for one of them: chase them down to hand it over. */
  staffCount: 3,
  staffSpeed: 1.3,
  /** Employees are solid: their body radius, and how close you must be to feel crowded (and slowed). */
  staffBody: .38,
  crowdReach: 1.15,
  crowdSpeed: .65,
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
 *   South half (front): Request Tray (west) · Manager's Desk (middle)
 *   Employees wander their own patches on both halves (see `staffZones`).
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
  /** The patch of floor each wandering employee keeps to (centre and size): south-east, board side, south-middle. */
  staffZones: [
    { x: 6.6, z: 3.2, w: 4.2, d: 2.8 },
    { x: -.4, z: -2.0, w: 9, d: 1.4 },
    { x: 2.7, z: 1.9, w: 3.0, d: 2.0 },
  ],
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
  /** round.elapsed when the card was last pinned on the board. */
  pinnedAt?: number;
  /** While set, the pinned card is wobbling and turns red (cancelled) at this round.elapsed. */
  doomedAt?: number;
};

/** An employee in the system. `id` is their index in `round.staff`. */
export type Staff = Person & { id: number };

export type Npc =
  /**
   * An employee wandering their patch of the office (`office.staffZones[zone]`). They are solid and slow players
   * who brush past. A yellow open shift names one of them (`card.worker`); their bubble flashes while it's carried.
   */
  | {
    kind: "staff";
    id: number;
    /** Index into `round.staff`. */
    person: number;
    zone: number;
    point: Point;
    facing: number;
    /** Where they are strolling to, and when they set off again after arriving. */
    goal: Point;
    waitUntil: number;
    moving: boolean;
  }
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
  /** round.elapsed from which the player may dash again (a short cooldown between charges). */
  dashReady: number;
  /** Dash charges left (0…settings.dashCharges). */
  charges: number;
  /** round.elapsed when the next charge refills on its own (Infinity when full). */
  nextCharge: number;
  /** round.elapsed until which a ⚡ speed boost lasts. */
  boostUntil: number;
};

/** A ⚡ lying on the floor. Walk over it to pick it up. */
export type Bolt = { id: number; point: Point; born: number };

/** What each critter did this round, for the awards on the end screen and the phones. */
export type Stats = { pinned: number; stamped: number; passed: number; shredded: number; accepted: number; rescues: number };
const noStats = (): Stats => ({ pinned: 0, stamped: 0, passed: 0, shredded: 0, accepted: 0, rescues: 0 });

export type FxKind =
  | "spawn" | "pick" | "put" | "stamp" | "pin" | "nope" | "cancel" | "shred" | "open" | "accept"
  | "snatch" | "knock" | "rescue" | "escape" | "dash" | "busy" | "chaos" | "win" | "lose"
  | "warn" | "bolt" | "charge" | "boost";

/** A one-off moment for the renderer and sound. `id` only ever increases within a round. */
export type Fx = { id: number; kind: FxKind; x: number; z: number; player?: number; card?: number };

export type Round = {
  phase: "ready" | "playing" | "won" | "lost";
  elapsed: number;
  stage: Stage;
  nextSpawn: number;
  nextCancel: number;
  /** Cancellations so far this round. */
  cancels: number;
  nextSnatch: number;
  /** Which of the 14 slots the week needs. */
  needed: boolean[];
  /** The team's roles and shift names, for colours and labels. The card rules don't check roles. */
  roles: Role[];
  shiftNames: [string, string];
  /** The first role each of the 14 slots needs (for colour), or null when the slot isn't needed. */
  slotRoles: (string | null)[];
  staff: Staff[];
  /** All cards ever made this round, indexed by id. Finished cards stay with `at.place === "gone"`. */
  cards: Card[];
  /** Card id pinned in each of the 14 slots (may be a red cancelled card). */
  board: (number | undefined)[];
  /** Days of open shifts waiting for a free seat on the tray. */
  openQueue: number[];
  players: Player[];
  npcs: Npc[];
  bolts: Bolt[];
  nextBolt: number;
  boltSeq: number;
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

/** A round has one critter per player: at least two so the keyboard always works, and up to four with phones. */
export const minPlayers = 2;
export const maxPlayers = 4;

function makePlayer(index: number): Player {
  return {
    position: { ...office.spawns[index] }, facing: index % 2 ? Math.PI : 0, moving: false, stamping: false,
    message: "", messageUntil: 0, dashUntil: 0, dashReady: 0,
    charges: settings.dashCharges, nextCharge: Infinity, boostUntil: 0,
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

/** A random walkable spot inside a zone, for an employee to stroll to. */
function spotIn(zone: number): Point {
  const { x, z, w, d } = office.staffZones[zone % office.staffZones.length];
  for (let tries = 0; tries < 30; tries++) {
    const point = { x: x + (Math.random() - .5) * w, z: z + (Math.random() - .5) * d };
    if (walkable(point, settings.staffBody)) return point;
  }
  return { x, z };
}

/** A fresh round. `players` is how many helper critters are in the office (2–4). */
export function newRound(team: Team = sampleTeam, custom = false, players = 2): Round {
  const people = team.people.length ? team.people : sampleTeam.people;
  const staff = people.map((person, id) => ({ ...person, days: [...person.days], id }));
  const wanderers = shuffle(staff.map(person => person.id)).slice(0, settings.staffCount);
  const count = Math.max(minPlayers, Math.min(maxPlayers, Math.floor(players) || minPlayers));
  // One card per shift: a shift is needed when the team needs anyone on it.
  const places = slotsOf(team);
  const slotRoles = shifts.map((_, shift) => places.find(place => place.shift === shift)?.role ?? null);
  return {
    phase: "ready",
    elapsed: 0,
    stage: "calm",
    nextSpawn: 0,
    nextCancel: settings.busyAt + 4,
    cancels: 0,
    nextSnatch: settings.busyAt + 8,
    needed: slotRoles.map(role => role !== null),
    roles: team.roles.map(entry => ({ ...entry })),
    shiftNames: [...team.shiftNames],
    slotRoles,
    staff,
    cards: [],
    board: shifts.map(() => undefined),
    openQueue: [],
    players: Array.from({ length: count }, (_, i) => makePlayer(i)),
    npcs: wanderers.map((person, i) => {
      const point = spotIn(i);
      return { kind: "staff" as const, id: i, person, zone: i, point, facing: 0, goal: { ...point }, waitUntil: Math.random() * 2, moving: false };
    }),
    bolts: [],
    nextBolt: 4,
    boltSeq: 0,
    stats: Array.from({ length: count }, noStats),
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
    const card = makeCard(round, "open", day, { place: "tray", seat }, coverFor(round));
    fx(round, "open", traySpot(seat), { card: card.id });
  }
}

type Wanderer = Extract<Npc, { kind: "staff" }>;
const wanderers = (round: Round) => round.npcs.filter((npc): npc is Wanderer => npc.kind === "staff");
const nameOf = (round: Round, person: number | undefined) =>
  (person === undefined ? undefined : round.staff[person]?.name) ?? "them";

/** Which wandering employee a new open shift is for: preferably someone no other open shift is waiting on. */
function coverFor(round: Round) {
  const people = wanderers(round).map(npc => npc.person);
  if (!people.length) return undefined;
  const waiting = new Set(round.cards.filter(card => live(card) && card.kind === "open" && !card.approved).map(card => card.worker));
  const free = people.filter(person => !waiting.has(person));
  const pool = free.length ? free : people;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Employees stroll around their patch, pausing now and then, and wait rather than walk into a player. */
function stepStaff(round: Round, seconds: number) {
  const people = wanderers(round);
  people.forEach(npc => {
    npc.moving = false;
    if (round.elapsed < npc.waitUntil) return;
    const dx = npc.goal.x - npc.point.x;
    const dz = npc.goal.z - npc.point.z;
    const length = Math.hypot(dx, dz);
    if (length < .05) {
      npc.goal = spotIn(npc.zone);
      npc.waitUntil = round.elapsed + .6 + Math.random() * 1.8;
      return;
    }
    const step = Math.min(length, settings.staffSpeed * seconds);
    const next = { x: npc.point.x + dx / length * step, z: npc.point.z + dz / length * step };
    const blocked = !walkable(next, settings.staffBody)
      || round.players.some(player => Math.hypot(player.position.x - next.x, player.position.z - next.z) < settings.body + settings.staffBody + .05)
      || people.some(other => other !== npc && Math.hypot(other.point.x - next.x, other.point.z - next.z) < settings.staffBody * 2);
    npc.facing = Math.atan2(dx, dz);
    if (blocked) {
      // Wait a moment, then try somewhere else
      npc.goal = spotIn(npc.zone);
      npc.waitUntil = round.elapsed + .4;
      return;
    }
    npc.point = next;
    npc.moving = true;
  });
}

/** ⚡ pickups appear on open floor every few seconds; walking over one refills a dash charge or gives a boost. */
function stepBolts(round: Round) {
  if (round.elapsed >= round.nextBolt) {
    const { min, max } = settings.boltEvery;
    round.nextBolt = round.elapsed + min + Math.random() * (max - min);
    if (round.bolts.length < settings.maxBolts) {
      for (let tries = 0; tries < 40; tries++) {
        const point = { x: (Math.random() * 2 - 1) * 8.4, z: (Math.random() * 2 - 1) * 4.4 };
        const clear = walkable(point, .6)
          && point.z > office.boardZ + 1.6
          && [furniture.inbox, furniture.desk, furniture.shredder].every(block => edgeDistance(point, block) > 1.3)
          && round.players.every(player => Math.hypot(player.position.x - point.x, player.position.z - point.z) > 2)
          && round.bolts.every(bolt => Math.hypot(bolt.point.x - point.x, bolt.point.z - point.z) > 3);
        if (!clear) continue;
        round.bolts.push({ id: ++round.boltSeq, point, born: round.elapsed });
        fx(round, "bolt", point);
        break;
      }
    }
  }
  round.players.forEach((player, i) => {
    // Charges refill slowly on their own
    if (player.charges < settings.dashCharges && round.elapsed >= player.nextCharge) {
      player.charges++;
      player.nextCharge = player.charges < settings.dashCharges ? round.elapsed + settings.dashRegen : Infinity;
    }
    const index = round.bolts.findIndex(bolt =>
      Math.hypot(bolt.point.x - player.position.x, bolt.point.z - player.position.z) <= settings.boltReach);
    if (index === -1) return;
    const [bolt] = round.bolts.splice(index, 1);
    if (player.charges < settings.dashCharges) {
      player.charges++;
      if (player.charges >= settings.dashCharges) player.nextCharge = Infinity;
      fx(round, "charge", bolt.point, { player: i });
    } else {
      player.boostUntil = round.elapsed + settings.boostTime;
      fx(round, "boost", bolt.point, { player: i });
    }
  });
}

/** Cancels one pinned shift. Returns false when now isn't a fair time, so the caller can try again soon. */
function cancelShift(round: Round) {
  if (round.cancels >= settings.maxCancels) return true;
  // One red card at a time, and only once the board has some shifts on it
  if (round.board.some(id => id !== undefined && (round.cards[id].kind === "cancelled" || round.cards[id].doomedAt !== undefined))) return false;
  const snatcher = round.npcs.find(npc => npc.kind === "snatcher");
  const covers = round.board.filter((_, slot) => covered(round, slot)).length;
  if (covers < settings.cancelFrom) return false;
  const filled = round.board.map((_, slot) => slot).filter(slot => covered(round, slot)
    && !(snatcher?.kind === "snatcher" && snatcher.target === slot)
    && round.elapsed - (cardIn(round, slot)!.pinnedAt ?? -Infinity) >= settings.cancelGrace);
  if (!filled.length) return false;
  const slot = filled[Math.floor(Math.random() * filled.length)];
  const card = cardIn(round, slot)!;
  // Telegraph it: the card wobbles for a few seconds, then turns red
  card.doomedAt = round.elapsed + settings.cancelWarning;
  fx(round, "warn", slotFloor(slot), { card: card.id });
  round.cancels++;
  return true;
}

/** Wobbling cards whose time is up turn red. */
function stepDoomed(round: Round) {
  round.board.forEach((id, slot) => {
    const card = id === undefined ? undefined : round.cards[id];
    if (!card || card.doomedAt === undefined || round.elapsed < card.doomedAt) return;
    card.doomedAt = undefined;
    card.kind = "cancelled";
    card.approved = false;
    const who = card.worker === undefined ? "Someone" : round.staff[card.worker].name;
    announce(round, `${who} cancelled ${shifts[slot].label}! Pull the red card and shred it.`);
    fx(round, "cancel", slotFloor(slot), { card: card.id });
  });
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
      card.doomedAt = undefined;
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

  // Queued open shifts take free tray seats before new requests do.
  placeOpenShifts(round);
  if (round.elapsed >= round.nextSpawn) {
    spawnRequest(round);
    round.nextSpawn = round.elapsed + spawnInterval(round);
  }
  if (round.elapsed >= round.nextCancel) {
    // If it isn't a fair moment to cancel, look again in a couple of seconds rather than skipping a whole interval
    round.nextCancel = round.elapsed + (cancelShift(round) ? settings.cancelEvery[round.stage] : 2);
  }
  if (round.elapsed >= round.nextSnatch) {
    spawnSnatcher(round);
    round.nextSnatch = round.elapsed + settings.snatcherEvery[round.stage];
  }
  stepDoomed(round);
  stepStaff(round, seconds);
  stepBolts(round);
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

function walkable(point: Point, body = settings.body) {
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
  const people = wanderers(round);
  const crowded = people.some(npc => Math.hypot(npc.point.x - position.x, npc.point.z - position.z) < settings.crowdReach);
  const pace = dashing ? settings.dashSpeed
    : settings.speed * (round.elapsed < player.boostUntil ? settings.boostSpeed : 1) * (crowded ? settings.crowdSpeed : 1);
  const speed = pace * seconds / length;
  const x = position.x + dx * speed;
  const z = position.z + dz * speed;
  // Employees are solid: a step may not bring you closer to someone you're already touching
  const touching = settings.body + settings.staffBody;
  const clear = (point: Point) => people.every(npc => {
    const after = Math.hypot(npc.point.x - point.x, npc.point.z - point.z);
    return after >= touching || after >= Math.hypot(npc.point.x - position.x, npc.point.z - position.z);
  });
  if (walkable({ x, z: position.z }) && clear({ x, z: position.z })) {
    player.moving = player.moving || x !== position.x;
    position.x = x;
  }
  if (walkable({ x: position.x, z }) && clear({ x: position.x, z })) {
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
  if (player.charges <= 0) {
    notify(round, player, "Out of dash! Grab a ⚡ or wait for it to recharge.");
    return;
  }
  player.charges--;
  if (player.nextCharge === Infinity) player.nextCharge = round.elapsed + settings.dashRegen;
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

/** The employee in reach of this point. With a `person`, that employee wins over anyone nearer. */
export function staffInReach(round: Round, point: Point, person?: number) {
  const score = (npc: Wanderer, distance: number) => distance + (person !== undefined && npc.person !== person ? 100 : 0);
  return wanderers(round).map(npc => ({ npc, distance: Math.hypot(npc.point.x - point.x, npc.point.z - point.z) }))
    .filter(entry => entry.distance <= settings.reach)
    .sort((a, b) => score(a.npc, a.distance) - score(b.npc, b.distance))[0]?.npc;
}

/** The wandering employee a yellow open shift is waiting for, if any. Their bubble flashes while it's carried. */
export function wantedBy(round: Round, card: Card | undefined) {
  if (!card || card.kind !== "open" || card.approved || card.worker === undefined) return undefined;
  return wanderers(round).find(npc => npc.person === card.worker);
}

/** Where on the board this card can go from this point, or why not. */
function pinTarget(round: Round, point: Point, card: Card): { slot: number } | { why: string } {
  const day = columnAt(point);
  if (card.kind === "cancelled") return { why: "Cancelled cards go in the shredder" };
  if (!card.approved) return { why: card.kind === "open" ? `Find ${nameOf(round, card.worker)} first` : "Stamp it at the desk first" };
  if (card.day !== day) return { why: `That's a ${days[card.day]} shift, not ${days[day]}` };
  const slot = [day, day + 7].find(slot => round.needed[slot] && round.board[slot] === undefined);
  if (slot === undefined) {
    const blocked = [day, day + 7].some(slot => cardIn(round, slot)?.kind === "cancelled");
    return { why: blocked ? `Pull the red card off ${days[day]} first` : `${days[day]} is full` };
  }
  return { slot };
}

/** Why the desk won't stamp this card, and where it goes instead. */
function deskHint(card: Card) {
  if (card.kind === "cancelled") return "No stamp for cancelled cards: shred it";
  if (card.approved) return `Already approved: pin it on ${days[card.day]}`;
  return "Open shifts skip the stamp: find the flashing employee";
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
  if (atDesk(position)) return card.kind === "request" && !card.approved ? "Hold to stamp" : deskHint(card);
  if (card.kind === "open" && !card.approved) {
    const npc = staffInReach(round, position, card.worker);
    if (npc) {
      const name = nameOf(round, npc.person);
      return npc.person === card.worker ? `Give it to ${name}` : `Not ${name}: find ${nameOf(round, card.worker)}`;
    }
  }
  if (card.kind !== "cancelled" && atTray(position) && freeSeat(round) !== undefined) return "Put back";
  if (passInReach(round, position, true) !== undefined) return "Pass over";
  if (passInReach(round, position, false) !== undefined) return "Counter full";
  if (card.kind === "cancelled") return "Take it to the shredder";
  if (card.kind === "open" && !card.approved) return `Chase down ${nameOf(round, card.worker)}`;
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
    card.pinnedAt = round.elapsed;
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

  if (atDesk(position)) {
    if (card.kind === "request" && !card.approved) {
      player.stamping = true;
      return;
    }
    // Never drop a card at the desk by accident: say where it goes instead
    notify(round, player, `${deskHint(card)}.`);
    fx(round, "nope", position, { player: index, card: card.id });
    return;
  }

  if (card.kind === "open" && !card.approved) {
    const npc = staffInReach(round, position, card.worker);
    if (npc) {
      if (npc.person !== card.worker) {
        notify(round, player, `That's ${nameOf(round, npc.person)}. This one's for ${nameOf(round, card.worker)}.`);
        fx(round, "nope", npc.point, { player: index, card: card.id });
        return;
      }
      card.approved = true;
      // They stop for a moment to take it
      npc.waitUntil = round.elapsed + .8;
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
  if (pad !== undefined) round.stats[index].passed++;
  release(round, index, pad === undefined ? { place: "floor", point: { ...position } } : { place: "counter", pad });
}

/** Adds critters until the round has `count` players (up to four), so a phone can drop in at any time. */
export function ensurePlayers(round: Round, count: number) {
  while (round.players.length < Math.min(count, maxPlayers)) {
    round.players.push(makePlayer(round.players.length));
    round.stats.push(noStats());
  }
}

/** Puts down whatever card this critter is carrying, where it stands. Used when a phone player leaves mid-round. */
export function dropCarried(round: Round, index: number) {
  const player = round.players[index];
  if (!player || player.holding === undefined) return;
  release(round, index, { place: "floor", point: { ...player.position } });
}
