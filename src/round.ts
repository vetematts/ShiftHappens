export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Colours handed out to roles in order. Caps, name tags and board slots use them. */
export const roleColours = ["#ff7aa8", "#ffa53d", "#3ec7b4", "#7c8cff"];
/** A job on the team, such as barista or dentist. */
export type Role = { id: string; label: string; colour: string };
export const maxRoles = 4;
/** The most people one shift can need, so the board stays readable. */
export const maxPerShift = 4;

/** The 14 shifts of a week: Monday to Sunday first shifts, then Monday to Sunday second shifts. */
export const shifts = [0, 1].flatMap(half => days.map((day, dayIndex) => ({ day, dayIndex, half })));

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

export const settings = {
  duration: 180,
  stampTime: 1.2,
  trayLimit: 4,
  /**
   * The round gets harder in stages. Each starts `from` of the way through the round (rounds run longer for big
   * teams), so in a three-minute round Busy starts at 0:36 and Chaos at 2:00. Staff arrive every `spawnEvery` seconds,
   * someone calls in sick every `sickEvery` seconds, and the bin chicken comes back `snatchEvery` seconds after it
   * leaves. 0 means never; a stage with 0 after one without stops that event for the rest of the round.
   */
  pace: [
    { name: "Calm", from: 0, spawnEvery: 3, sickEvery: 0, snatchEvery: 0 },
    { name: "Busy", from: .2, spawnEvery: 2, sickEvery: 32, snatchEvery: 30 },
    { name: "Chaos", from: .67, spawnEvery: 2, sickEvery: 26, snatchEvery: 18 },
  ],
  /** The Shift Snatcher: a bin chicken that steals a rostered shift and runs for the side door. */
  snatcher: {
    /** When it first shows up, as a share of the round (0:52 in three minutes). */
    firstAt: .29,
    sneakSpeed: 2.3,
    fleeSpeed: 3.4,
    /** How long it pecks at the board before it gets the shift, giving players time to stop it. */
    grabTime: 1.4,
    /** How close a player must get to scare it off or make it drop who it took. */
    bumpReach: 1,
    /** How far out to the side it appears and escapes. */
    door: 10.8,
  },
  /** The clock ticks every second once this many seconds are left. */
  tickFrom: 10,
  speed: 6.4,
  reach: 1.45,
  /** How far from the edge of the inbox or desk a player can still use it. */
  stationReach: 1,
  /** Collision radius of a player, close to the size of the drawn critters. */
  body: .42,
};

/** Which stage of `settings.pace` a round is in. */
export function stageAt(round: { elapsed: number; duration: number }) {
  return Math.max(0, settings.pace.findLastIndex(stage => round.elapsed >= stage.from * round.duration));
}

/** Board columns, one per day, centred on the office. */
export const columnGap = 2.06;
export const columnX = (day: number) => (day - 3) * columnGap;

export type Point = { x: number; z: number };

export const office = {
  bounds: { x: 9.25, z: 5.1 },
  counterRight: 5.1,
  counterDepth: .48,
  tray: { x: -6.4, z: 3.4 },
  desk: { x: -.55, z: 3.4 },
  boardZ: -4.35,
  pass: [-4.7, -2.6, -.5, 1.6].map(x => ({ x, z: 0 })),
};

/** The bin chicken walks along this line in front of the board, clear of the furniture at the sides. */
export const snatchLane = office.boardZ + 1;

/** A solid piece of furniture: centre plus full width (x) and depth (z). */
export type Block = Point & { w: number; d: number };

// The 3D office draws each piece at these positions and sizes.
export const furniture = {
  inbox: { ...office.tray, w: 3.3, d: 1.5 },
  desk: { ...office.desk, w: 3.5, d: 1.2 },
  plants: [{ x: -9.05, z: -4.75, size: 1 }, { x: 9.05, z: -4.75, size: 1.1 }, { x: 9.1, z: 4.75, size: .9 }]
    .map(({ x, z, size }) => ({ x, z, w: .8 * size, d: .8 * size, size })),
  cooler: { x: -9.05, z: 4.7, w: .6, d: .6 },
  cabinet: { x: 9.15, z: -2.4, w: .7, d: .8 },
  coffee: { x: 9.1, z: -.95, w: .7, d: 1.3 },
  printer: { x: -9.1, z: -2.1, w: .75, d: .9 },
  beanbag: { x: 7.6, z: 4.25, w: 1.15, d: 1.05 },
  lamp: { x: 9.05, z: 3.3, w: .5, d: .5 },
};

const blocks: Block[] = [
  furniture.inbox, furniture.desk, ...furniture.plants, furniture.cooler, furniture.cabinet,
  furniture.coffee, furniture.printer, furniture.beanbag, furniture.lamp,
];

/** Distance from a point to the nearest edge of a block (0 when inside it). */
function edgeDistance(point: Point, block: Block) {
  const dx = Math.max(0, Math.abs(point.x - block.x) - block.w / 2);
  const dz = Math.max(0, Math.abs(point.z - block.z) - block.d / 2);
  return Math.hypot(dx, dz);
}

/** Whether a player at this point can use the inbox or the desk. */
export function nearStation(point: Point, station: Block) {
  return edgeDistance(point, station) <= settings.stationReach;
}

type StaffLocation =
  | { place: "away" }
  | { place: "done" }
  | { place: "tray" }
  | { place: "hand"; player: number }
  | { place: "counter"; pad: number }
  | { place: "floor"; point: Point }
  | { place: "snatched" };

/** A team member during a round. They wait at the table, get rostered, then head home until they are needed again. */
export type Staff = Person & {
  id: number;
  approved: boolean;
  stamp: number;
  worked: number;
  /** Days lost to a sick call this week. */
  off: boolean[];
  at: StaffLocation;
};

/** What each critter did this round, for the awards on the end screen. */
export type PlayerStats = { rostered: number; signed: number; passed: number; shooed: number };

export type Player = {
  position: Point;
  carrying?: Staff;
  stamping: boolean;
  facing: number;
  moving: boolean;
  message: string;
  messageUntil: number;
  /** How many times this player has been refused, such as a shift nobody can take. The office says "nope" when it goes up. */
  refused: number;
  stats: PlayerStats;
};

/** The bin chicken. It sneaks along the board to a filled shift, pecks at it, then runs off with that person. */
export type Snatcher = {
  mode: "away" | "sneaking" | "grabbing" | "fleeing";
  position: Point;
  facing: number;
  /** The shift it is after. */
  slot: number;
  /** Staff id of the person it ran off with. */
  carrying?: number;
  /** When it next appears while away, or when it gets the shift while grabbing. */
  timer: number;
};

/** A round has one critter per player: at least two so the keyboard always works, and up to four with phones. */
export const minPlayers = 2;
export const maxPlayers = 4;

/** Where each critter starts: players 1 and 3 on the inbox side of the counter, players 2 and 4 on the board side. */
const starts = [
  { x: -5.3, z: 2.05, facing: 0 },
  { x: -.5, z: -1.3, facing: Math.PI },
  { x: 2.6, z: 2.05, facing: 0 },
  { x: 3.6, z: -1.3, facing: Math.PI },
];

export type Round = {
  phase: "ready" | "playing" | "won" | "lost";
  elapsed: number;
  /** Round length in seconds: three minutes, longer for big real rosters. */
  duration: number;
  nextSpawn: number;
  nextSick: number;
  roles: Role[];
  shiftNames: [string, string];
  perDay: 1 | 2;
  /** Every place to fill this week. */
  slots: Slot[];
  staff: Staff[];
  /** Who is in each slot, by staff id. */
  board: (number | undefined)[];
  players: Player[];
  snatcher: Snatcher;
  /** Latest office news for the interface, such as a sick call. */
  news: { text: string; until: number };
  custom: boolean;
};

export function newRound(team: Team = sampleTeam, custom = false, playerCount = minPlayers): Round {
  const slots = slotsOf(team);
  const count = Math.max(minPlayers, Math.min(maxPlayers, Math.floor(playerCount) || minPlayers));
  // About eight seconds a place, never under the usual three minutes or over ten
  const duration = Math.min(600, Math.max(settings.duration, Math.ceil(slots.length * .8) * 10));
  return {
    phase: "ready",
    elapsed: 0,
    duration,
    nextSpawn: 0,
    nextSick: (settings.pace.find(stage => stage.sickEvery > 0)?.from ?? Infinity) * duration,
    roles: team.roles.map(entry => ({ ...entry })),
    shiftNames: [...team.shiftNames],
    perDay: team.perDay,
    slots,
    staff: team.people.map((person, id) => ({
      ...person, days: [...person.days], id, approved: false, stamp: 0, worked: 0,
      off: days.map(() => false), at: { place: "away" },
    })),
    board: slots.map(() => undefined),
    news: { text: "", until: 0 },
    custom,
    players: starts.slice(0, count).map((_, i) => makePlayer(i)),
    snatcher: { mode: "away", position: { x: settings.snatcher.door, z: snatchLane }, facing: 0, slot: 0, timer: settings.snatcher.firstAt * duration },
  };
}

function makePlayer(index: number): Player {
  const { x, z, facing } = starts[index];
  return {
    position: { x, z }, facing, moving: false, stamping: false, message: "", messageUntil: 0, refused: 0,
    stats: { rostered: 0, signed: 0, passed: 0, shooed: 0 },
  };
}

/** Adds critters until the round has `count` players (up to four), so a phone can drop in at any time. */
export function ensurePlayers(round: Round, count: number) {
  while (round.players.length < Math.min(count, maxPlayers)) round.players.push(makePlayer(round.players.length));
}

/** Puts down whoever this critter is carrying, where it stands. Used when a phone player leaves mid-round. */
export function dropCarried(round: Round, index: number) {
  const player = round.players[index];
  if (!player?.carrying) return;
  stopStamp(player);
  player.carrying.at = { place: "floor", point: { ...player.position } };
  player.carrying = undefined;
}

/** Who is in each slot, or undefined while it is open. */
export function roster(round: Round) {
  return round.board.map(id => (id === undefined ? undefined : round.staff[id]));
}

export function filledShifts(round: Round) {
  return round.board.filter(id => id !== undefined).length;
}

export function neededShifts(round: Round) {
  return round.slots.length;
}

/** The slots this person already fills on a day. */
const workingOn = (round: Round, person: Staff, day: number) =>
  round.slots.filter((slot, i) => round.board[i] === person.id && slot.shift % 7 === day);

/** Whether this person can take this slot right now. */
export function canWork(round: Round, person: Staff, slot: number) {
  const { shift, role: id } = round.slots[slot];
  const day = shift % 7;
  const today = workingOn(round, person, day);
  return id === person.role
    && round.board[slot] === undefined
    && person.days[day] && !person.off[day]
    && person.worked < person.shifts
    && today.length < round.perDay
    && !today.some(other => other.shift === shift);
}

const useful = (round: Round, person: Staff) => round.slots.some((_, slot) => canWork(round, person, slot));

// Bring in someone who still has hours and can cover an open shift.
function arrive(round: Round) {
  // Anyone waiting around who can no longer help heads home, freeing their seat or counter spot
  round.staff.forEach(person => {
    if (["tray", "counter", "floor"].includes(person.at.place) && !useful(round, person)) {
      person.at = { place: person.worked >= person.shifts ? "done" : "away" };
    }
  });
  if (round.staff.filter(person => person.at.place === "tray").length >= settings.trayLimit) return;
  const ready = round.staff.filter(person => person.at.place === "away" && useful(round, person));
  if (!ready.length) {
    const busy = round.staff.some(person => ["tray", "hand", "counter", "floor"].includes(person.at.place) && useful(round, person));
    const open = round.slots.find((_, slot) => round.board[slot] === undefined);
    if (!busy && open && round.news.until <= round.elapsed) {
      const { label } = roleIn(round.roles, open.role);
      round.news = { text: `Nobody left who can work ${shiftLabel(round.shiftNames, open.shift)} (${label.toLowerCase()}).`, until: round.elapsed + 4 };
    }
    return;
  }
  ready[Math.floor(Math.random() * ready.length)].at = { place: "tray" };
}

export function beginRound(round: Round) {
  if (round.phase !== "ready") return;
  round.phase = "playing";
  for (let i = 0; i < settings.trayLimit; i++) arrive(round);
  round.nextSpawn = settings.pace[0].spawnEvery;
}

function atBoard(point: Point) {
  return point.z <= office.boardZ + settings.reach && Math.abs(point.x) <= 7.8;
}

function atDesk(point: Point) {
  return nearStation(point, furniture.desk);
}

function refuse(round: Round, player: Player, message: string) {
  player.message = message;
  player.messageUntil = round.elapsed + 2.2;
  player.refused++;
}

export function stopStamp(player: Player) {
  player.stamping = false;
  if (player.carrying && !player.carrying.approved) player.carrying.stamp = 0;
}

// Someone already on the board calls in sick: their shift opens again and they can't work that day.
function sickCall(round: Round) {
  const filled = round.board.map((id, slot) => (id === undefined ? -1 : slot)).filter(slot => slot >= 0);
  if (filled.length < 3) return;
  const slot = filled[Math.floor(Math.random() * filled.length)];
  const person = round.staff[round.board[slot]!];
  round.board[slot] = undefined;
  const day = round.slots[slot].shift % 7;
  // A sick day empties every shift they had that day
  round.board.forEach((id, other) => {
    if (id !== person.id || round.slots[other].shift % 7 !== day) return;
    round.board[other] = undefined;
    person.worked = Math.max(0, person.worked - 1);
  });
  person.off[day] = true;
  if (person.at.place === "done") person.at = { place: "away" };
  round.news = { text: `${person.name} called in sick. ${days[day]} needs cover again.`, until: round.elapsed + 4 };
}

export function stepRound(round: Round, seconds: number) {
  if (round.phase !== "playing") return;
  round.elapsed = Math.min(round.duration, round.elapsed + seconds);
  if (round.elapsed >= round.duration) {
    round.phase = "lost";
    return;
  }
  const stage = settings.pace[stageAt(round)];
  if (round.elapsed >= round.nextSpawn) {
    arrive(round);
    round.nextSpawn = round.elapsed + stage.spawnEvery;
  }
  if (round.elapsed >= round.nextSick) {
    sickCall(round);
    round.nextSick = stage.sickEvery > 0 ? round.elapsed + stage.sickEvery : Infinity;
  }
  for (const player of round.players) {
    const person = player.carrying;
    if (!player.stamping || !person) continue;
    if (!atDesk(player.position)) {
      stopStamp(player);
      continue;
    }
    person.stamp = Math.min(settings.stampTime, person.stamp + seconds);
    if (person.stamp >= settings.stampTime) {
      person.approved = true;
      player.stamping = false;
      player.stats.signed++;
    }
  }
  stepSnatcher(round, seconds);
}

const filledSlots = (round: Round) => round.board.map((id, slot) => (id === undefined ? -1 : slot)).filter(slot => slot >= 0);

// Picks a filled shift for the chicken to go after, or sends it off if there's nothing worth taking.
function aimSnatcher(round: Round) {
  const chicken = round.snatcher;
  const filled = filledSlots(round);
  if (!filled.length) {
    chicken.mode = "fleeing";
    return;
  }
  chicken.slot = filled[Math.floor(Math.random() * filled.length)];
  chicken.mode = "sneaking";
}

function stepSnatcher(round: Round, seconds: number) {
  const chicken = round.snatcher;
  const { sneakSpeed, fleeSpeed, grabTime, bumpReach, door } = settings.snatcher;
  const stage = settings.pace[stageAt(round)];

  if (chicken.mode === "away") {
    if (round.elapsed < chicken.timer) return;
    // Wait until there's enough on the board to make stealing worth it
    if (filledSlots(round).length < 2) {
      chicken.timer = round.elapsed + 4;
      return;
    }
    aimSnatcher(round);
    // Come in from the side nearest the shift it wants
    const side = columnX(round.slots[chicken.slot].shift % 7) < 0 ? -1 : 1;
    chicken.position = { x: side * door, z: snatchLane };
    round.news = { text: "A bin chicken is after a shift! Run into it to scare it off.", until: round.elapsed + 4 };
    return;
  }

  // Running into the chicken scares it off, and makes it drop anyone it grabbed
  const bumper = round.players.findIndex(player =>
    Math.hypot(player.position.x - chicken.position.x, player.position.z - chicken.position.z) <= bumpReach);
  if (bumper >= 0 && (chicken.mode !== "fleeing" || chicken.carrying !== undefined)) {
    const player = round.players[bumper];
    player.stats.shooed++;
    if (chicken.carrying !== undefined) {
      const person = round.staff[chicken.carrying];
      const edge = office.bounds.x - .7;
      person.at = { place: "floor", point: { x: Math.max(-edge, Math.min(edge, chicken.position.x)), z: chicken.position.z } };
      chicken.carrying = undefined;
      round.news = { text: `${person.name} is safe! Roster them again.`, until: round.elapsed + 3 };
    }
    chicken.mode = "fleeing";
  }

  if (chicken.mode === "sneaking" || chicken.mode === "grabbing") {
    // The shift it wanted has gone, such as after a sick call
    if (round.board[chicken.slot] === undefined) aimSnatcher(round);
  }

  if (chicken.mode === "sneaking") {
    const dx = columnX(round.slots[chicken.slot].shift % 7) - chicken.position.x;
    const stepBy = sneakSpeed * seconds;
    chicken.facing = Math.sign(dx) * Math.PI / 2;
    if (Math.abs(dx) <= stepBy) {
      chicken.position.x += dx;
      chicken.mode = "grabbing";
      chicken.timer = round.elapsed + grabTime;
      chicken.facing = Math.PI;
    } else {
      chicken.position.x += Math.sign(dx) * stepBy;
    }
    return;
  }

  if (chicken.mode === "grabbing") {
    if (round.elapsed < chicken.timer) return;
    const id = round.board[chicken.slot]!;
    const person = round.staff[id];
    round.board[chicken.slot] = undefined;
    person.worked = Math.max(0, person.worked - 1);
    person.at = { place: "snatched" };
    chicken.carrying = id;
    chicken.mode = "fleeing";
    round.news = { text: `The bin chicken grabbed ${person.name} off ${shiftLabel(round.shiftNames, round.slots[chicken.slot].shift)}! Catch it!`, until: round.elapsed + 4 };
    return;
  }

  // Fleeing out the nearest side
  const side = chicken.position.x < 0 ? -1 : 1;
  chicken.facing = side * Math.PI / 2;
  chicken.position.x += side * fleeSpeed * seconds;
  if (Math.abs(chicken.position.x) < door) return;
  if (chicken.carrying !== undefined) {
    const person = round.staff[chicken.carrying];
    person.at = { place: "away" };
    chicken.carrying = undefined;
    round.news = { text: `The bin chicken got away with ${person.name}. ${shiftLabel(round.shiftNames, round.slots[chicken.slot].shift)} is open again.`, until: round.elapsed + 4 };
  }
  chicken.mode = "away";
  chicken.timer = stage.snatchEvery > 0 ? round.elapsed + stage.snatchEvery : Infinity;
}

function walkable(point: Point) {
  const { body } = settings;
  return Math.abs(point.x) <= office.bounds.x
    && Math.abs(point.z) <= office.bounds.z
    && (point.x > office.counterRight + body || Math.abs(point.z) > office.counterDepth + body)
    && blocks.every(block => edgeDistance(point, block) >= body);
}

export function walk(round: Round, index: number, dx: number, dz: number, seconds: number) {
  const player = round.players[index];
  const length = Math.hypot(dx, dz);
  player.moving = false;
  if (!length || round.phase !== "playing") return;
  const { position } = player;
  const speed = settings.speed * seconds / length;
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
  if (player.stamping && !atDesk(position)) stopStamp(player);
}

function staffInReach(round: Round, point: Point) {
  return round.staff.map(person => {
    // The waiting table is in reach anywhere along its edge; people elsewhere are measured from where they stand.
    if (person.at.place === "tray") return { person, distance: edgeDistance(point, furniture.inbox), reach: settings.stationReach };
    let target: Point | undefined;
    if (person.at.place === "counter") target = office.pass[person.at.pad];
    if (person.at.place === "floor") target = person.at.point;
    return { person, distance: target && Math.hypot(point.x - target.x, point.z - target.z), reach: settings.reach };
  }).filter(entry => entry.distance !== undefined && entry.distance <= entry.reach)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0]?.person;
}

function passInReach(round: Round, point: Point, emptyOnly: boolean) {
  return office.pass.map((pad, index) => ({ index, distance: Math.hypot(pad.x - point.x, pad.z - point.z) }))
    .filter(({ index, distance }) => distance <= settings.reach && (!emptyOnly || !round.staff.some(
      person => person.at.place === "counter" && person.at.pad === index,
    )))
    .sort((a, b) => a.distance - b.distance)[0]?.index;
}

// Someone can be put back at the waiting table if there's a free seat.
function canSeat(round: Round, point: Point) {
  return nearStation(point, furniture.inbox) && round.staff.filter(person => person.at.place === "tray").length < settings.trayLimit;
}

/** The day column in front of a player at the board. */
export function columnAt(point: Point) {
  return Math.max(0, Math.min(6, Math.round(point.x / columnGap + 3)));
}

/** The first open slot in this column that this person can take, if there is one. */
function slotFor(round: Round, point: Point, person: Staff) {
  const day = columnAt(point);
  const index = round.slots.findIndex((slot, i) => slot.shift % 7 === day && canWork(round, person, i));
  return index === -1 ? undefined : index;
}

// Explains why the person can't go on this day.
function boardHint(round: Round, point: Point, person: Staff) {
  const day = columnAt(point);
  const open = round.slots.filter((slot, i) => slot.shift % 7 === day && round.board[i] === undefined);
  if (!open.length) return `${days[day]} is covered`;
  if (!person.days[day]) return `${person.name} doesn’t work ${days[day]}`;
  if (person.off[day]) return `${person.name} is off sick ${days[day]}`;
  const today = workingOn(round, person, day);
  if (today.length >= round.perDay) return round.perDay === 1 ? `${person.name} already works ${days[day]}` : `${person.name} already works all ${days[day]}`;
  const roles = [...new Set(open.map(slot => roleIn(round.roles, slot.role).label.toLowerCase()))];
  if (open.some(slot => slot.role === person.role)) {
    return person.worked >= person.shifts ? `${person.name} has no shifts left` : `${person.name} is already on that shift`;
  }
  return `${days[day]} needs ${roles.length > 1 ? `${roles.slice(0, -1).join(", ")} and ${roles.at(-1)}` : roles[0]}`;
}

export function nextAction(round: Round, index: number) {
  const { carrying, position } = round.players[index];
  if (!carrying) {
    const person = staffInReach(round, position);
    if (person) return `Grab ${person.name}`;
    return position.z < 0 ? "Collect from the counter" : "Grab someone waiting";
  }
  if (atBoard(position)) {
    if (!carrying.approved) return "Sign them on first";
    const slot = slotFor(round, position, carrying);
    return slot === undefined ? boardHint(round, position, carrying) : `Roster ${carrying.name} on ${shiftLabel(round.shiftNames, round.slots[slot].shift)}`;
  }
  if (!carrying.approved && atDesk(position)) return "Hold to sign on";
  if (canSeat(round, position)) return "Put back";
  if (passInReach(round, position, true) !== undefined) return "Pass over";
  if (passInReach(round, position, false) !== undefined) return "Counter full";
  return "Put down";
}

export function interact(round: Round, index: number) {
  if (round.phase !== "playing") return;
  const player = round.players[index];
  const { carrying, position } = player;
  if (!carrying) {
    const person = staffInReach(round, position);
    if (person) {
      player.carrying = person;
      person.at = { place: "hand", player: index };
    }
    return;
  }
  if (atBoard(position)) {
    if (!carrying.approved) {
      refuse(round, player, "Sign them on at the desk first.");
      return;
    }
    const slot = slotFor(round, position, carrying);
    if (slot === undefined) {
      refuse(round, player, `${boardHint(round, position, carrying)}.`);
      return;
    }
    round.board[slot] = carrying.id;
    carrying.worked++;
    player.stats.rostered++;
    // They head home and come back later if they still have hours and there's work they can do.
    carrying.at = { place: carrying.worked >= carrying.shifts ? "done" : "away" };
    player.carrying = undefined;
    if (filledShifts(round) >= neededShifts(round)) round.phase = "won";
    return;
  }
  if (!carrying.approved && atDesk(position)) {
    player.stamping = true;
    return;
  }
  if (canSeat(round, position)) {
    carrying.at = { place: "tray" };
    stopStamp(player);
    player.carrying = undefined;
    return;
  }
  const pad = passInReach(round, position, true);
  if (pad === undefined && passInReach(round, position, false) !== undefined) {
    refuse(round, player, "This part of the counter is full.");
    return;
  }
  carrying.at = pad === undefined
    ? { place: "floor", point: { ...position } }
    : { place: "counter", pad };
  if (pad !== undefined) player.stats.passed++;
  stopStamp(player);
  player.carrying = undefined;
}
