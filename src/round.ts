export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const roles = [
  { id: "barista", label: "Barista", colour: "#ff7aa8" },
  { id: "kitchen", label: "Kitchen", colour: "#ffa53d" },
  { id: "register", label: "Register", colour: "#3ec7b4" },
] as const;
export type Role = typeof roles[number]["id"];
export const roleOf = (role: Role) => roles.find(entry => entry.id === role)!;

/** The 14 slots of a week: Monday to Sunday mornings, then Monday to Sunday evenings. */
export const shifts = (["AM", "PM"] as const).flatMap(half =>
  days.map((day, i) => ({ day, dayIndex: i, half, label: `${day} ${half}` })),
);

/** Someone on the team, as entered in "Run it for real". */
export type Person = { name: string; role: Role; days: boolean[]; shifts: number };
/** A team plus the role each shift needs (null when that shift isn't needed). */
export type Team = { people: Person[]; week: (Role | null)[] };

const workdays = (...list: number[]) => days.map((_, i) => list.includes(i));

/** The café team used for quick play. There's enough slack that random choices still finish the week about 98% of the time. */
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

/** For each needed shift, who on the team could work it. Used to warn about gaps before playing. */
export function checkTeam(team: Team) {
  const gaps = team.week.map((role, slot) => role && !team.people.some(person =>
    person.role === role && person.days[slot % 7] && person.shifts > 0) ? slot : -1).filter(slot => slot >= 0);
  const needed = team.week.filter(Boolean).length;
  const hours = team.people.reduce((sum, person) => sum + Math.max(0, person.shifts), 0);
  return { gaps, needed, hours };
}

export const settings = {
  duration: 180,
  stampTime: 1.2,
  trayLimit: 4,
  /**
   * The round gets harder in stages. Each starts `from` seconds in. Staff arrive every `spawnEvery` seconds, someone
   * calls in sick every `sickEvery` seconds, and the bin chicken comes back `snatchEvery` seconds after it leaves.
   * 0 means never; a stage with 0 after one without stops that event for the rest of the round.
   */
  pace: [
    { name: "Calm", from: 0, spawnEvery: 3, sickEvery: 0, snatchEvery: 0 },
    { name: "Busy", from: 35, spawnEvery: 2, sickEvery: 32, snatchEvery: 30 },
    { name: "Chaos", from: 120, spawnEvery: 2, sickEvery: 26, snatchEvery: 18 },
  ],
  /** The Shift Snatcher: a bin chicken that steals a rostered shift and runs for the side door. */
  snatcher: {
    /** When it first shows up, in seconds. */
    firstAt: 52,
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

/** Which stage of `settings.pace` a round is in after this many seconds. */
export function stageAt(elapsed: number) {
  return Math.max(0, settings.pace.findLastIndex(stage => elapsed >= stage.from));
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
  /** Totals for the end screen. */
  stats: { signed: number; rostered: number; shooed: number };
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

export type Round = {
  phase: "ready" | "playing" | "won" | "lost";
  elapsed: number;
  nextSpawn: number;
  nextSick: number;
  week: (Role | null)[];
  staff: Staff[];
  /** Who is rostered on each of the 14 shifts, by staff id. */
  board: (number | undefined)[];
  players: Player[];
  snatcher: Snatcher;
  /** Latest office news for the interface, such as a sick call. */
  news: { text: string; until: number };
  custom: boolean;
};

export function newRound(team: Team = sampleTeam, custom = false): Round {
  return {
    phase: "ready",
    elapsed: 0,
    nextSpawn: 0,
    nextSick: settings.pace.find(stage => stage.sickEvery > 0)?.from ?? Infinity,
    week: [...team.week],
    staff: team.people.map((person, id) => ({
      ...person, days: [...person.days], id, approved: false, stamp: 0, worked: 0,
      off: days.map(() => false), at: { place: "away" },
    })),
    board: shifts.map(() => undefined),
    news: { text: "", until: 0 },
    custom,
    players: [{ x: -5.3, z: 2.05, facing: 0 }, { x: -.5, z: -1.3, facing: Math.PI }].map(({ x, z, facing }) => ({
      position: { x, z }, facing, moving: false, stamping: false, message: "", messageUntil: 0, refused: 0,
      stats: { signed: 0, rostered: 0, shooed: 0 },
    })),
    snatcher: { mode: "away", position: { x: settings.snatcher.door, z: snatchLane }, facing: 0, slot: 0, timer: settings.snatcher.firstAt },
  };
}

/** Who is rostered on each shift, or undefined while it is open or not needed. */
export function roster(round: Round) {
  return round.board.map(id => (id === undefined ? undefined : round.staff[id]));
}

export function filledShifts(round: Round) {
  return round.board.filter(id => id !== undefined).length;
}

export function neededShifts(round: Round) {
  return round.week.filter(Boolean).length;
}

/** Whether this person can take this shift right now. */
export function canWork(round: Round, person: Staff, slot: number) {
  const day = slot % 7;
  return round.week[slot] === person.role
    && round.board[slot] === undefined
    && person.days[day] && !person.off[day]
    && person.worked < person.shifts
    && round.board[day] !== person.id && round.board[day + 7] !== person.id;
}

const useful = (round: Round, person: Staff) => shifts.some((_, slot) => canWork(round, person, slot));

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
    const open = round.week.findIndex((role, slot) => role && round.board[slot] === undefined);
    if (!busy && open >= 0 && round.news.until <= round.elapsed) {
      round.news = { text: `Nobody left who can work ${shifts[open].label}.`, until: round.elapsed + 4 };
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
  person.off[slot % 7] = true;
  person.worked = Math.max(0, person.worked - 1);
  if (person.at.place === "done") person.at = { place: "away" };
  round.news = { text: `${person.name} called in sick. ${shifts[slot].label} is open again.`, until: round.elapsed + 4 };
}

export function stepRound(round: Round, seconds: number) {
  if (round.phase !== "playing") return;
  round.elapsed = Math.min(settings.duration, round.elapsed + seconds);
  if (round.elapsed >= settings.duration) {
    round.phase = "lost";
    return;
  }
  const stage = settings.pace[stageAt(round.elapsed)];
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
  const stage = settings.pace[stageAt(round.elapsed)];

  if (chicken.mode === "away") {
    if (round.elapsed < chicken.timer) return;
    // Wait until there's enough on the board to make stealing worth it
    if (filledSlots(round).length < 2) {
      chicken.timer = round.elapsed + 4;
      return;
    }
    aimSnatcher(round);
    // Come in from the side nearest the shift it wants
    const side = columnX(chicken.slot % 7) < 0 ? -1 : 1;
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
    const dx = columnX(chicken.slot % 7) - chicken.position.x;
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
    round.news = { text: `The bin chicken grabbed ${person.name} off ${shifts[chicken.slot].label}! Catch it!`, until: round.elapsed + 4 };
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
    round.news = { text: `The bin chicken got away with ${person.name}. ${shifts[chicken.slot].label} is open again.`, until: round.elapsed + 4 };
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

/** The open shift in this column that this person can take, if there is one. */
function slotFor(round: Round, point: Point, person: Staff) {
  const day = columnAt(point);
  return [day, day + 7].find(slot => canWork(round, person, slot));
}

// Explains why the person can't go on this day.
function boardHint(round: Round, point: Point, person: Staff) {
  const day = columnAt(point);
  const open = [day, day + 7].filter(slot => round.week[slot] && round.board[slot] === undefined);
  if (!open.length) return `${days[day]} is covered`;
  if (!person.days[day]) return `${person.name} doesn’t work ${days[day]}`;
  if (person.off[day]) return `${person.name} is off sick ${days[day]}`;
  if (round.board[day] === person.id || round.board[day + 7] === person.id) return `${person.name} already works ${days[day]}`;
  return `${days[day]} needs ${open.map(slot => roleOf(round.week[slot]!).label.toLowerCase()).join(" and ")}`;
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
    return slot === undefined ? boardHint(round, position, carrying) : `Roster ${carrying.name} on ${shifts[slot].label}`;
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
  stopStamp(player);
  player.carrying = undefined;
}
