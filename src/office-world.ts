import * as T from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  atBoard, atDesk, atShredder, atTray, cardIn, columnAt, columnGap, columnX, days, furniture, hazardRadius, heldCard,
  isDashing, isFallen, office, settings, staffInReach, traySpot, wantedBy,
  type Card, type Fx, type Hazard, type Npc, type Round,
} from "./round";
import type { Sound } from "./sound";

const colours = {
  base: 0xd38f5c, baseShade: 0xb06f42,
  tileBack: [0xc9eedc, 0xbbe5d0], tileFront: [0xfff0d4, 0xffe3bb],
  wallLow: 0x5fb3a6, wallHigh: 0x93d6ca, trim: 0xfff4e2,
  counter: 0x5aa6d0, counterShade: 0x3f86b0, counterTop: 0xfff7ea, pad: 0xffd66b,
  tray: 0xa9c8ff, trayLeg: 0x6b8bd6, desk: 0xe0a46a, deskTop: 0xf6c995, deskShade: 0xc6884f,
  cork: "#e9bb7f", frame: 0xc98a52, pot: 0xff9e7a, leaf: 0x6cc58a, leafLight: 0x8fdaa3,
  rug: 0xffc6d1, ink: 0x3d3a4a, stampRed: 0xf0595f, white: 0xfffdf8, black: 0x2a2433, blush: 0xff9fb4,
};
const playerColours = [
  { body: 0xffd54f, belly: 0xfff1b8, accent: 0xff8f3a, ring: 0xffaa00, tag: "#ffcf5c" },
  { body: 0xcdb8ff, belly: 0xf3ecff, accent: 0xff9cc4, ring: 0x9b6bff, tag: "#c9b1ff" },
  { body: 0xffa36b, belly: 0xffe6d2, accent: 0xff7fa6, ring: 0xff6a2f, tag: "#ffb07f" },
  { body: 0x7fdc7a, belly: 0xe4ffd0, accent: 0xff7a66, ring: 0x2fb04f, tag: "#8ee58a" },
];
const critterKinds = ["duck", "bunny", "cat", "frog"] as const;
const boardY = 1.72;
// Room dimensions all derive from the rules' layout: the walls sit just outside the walkable bounds,
// and the board hangs on the back wall a little behind the line players stand on.
const { x: roomX, z: roomZ } = office.bounds;
const boardZ = office.boardZ - 1.01;
const boardMargin = 1.52;
const boardWidth = 6 * columnGap + 2 * boardMargin;
const boardPixels = Math.round(boardWidth * 133);
const backWallZ = -(roomZ + .64);
const sideWallX = roomX + .77;
const boardHeight = 1.95;
// Fredoka tops out at 700; the page loads it before the office is drawn
const font = (weight: number, size: number) =>
  `${Math.min(700, weight)} ${size}px "Fredoka Variable", ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`;

type Kind = typeof critterKinds[number];
type Critter = ReturnType<typeof makeCritter>;
type Particle = { life: number; max: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; spin: number; gravity: number };

function makeCritter(kind: Kind, look: typeof playerColours[number], parts: Parts) {
  const { ball, capsule, add } = parts;
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);

  const shadow = new T.Mesh(parts.circle, parts.shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .035;
  shadow.scale.setScalar(.62);
  root.add(shadow);
  const ring = new T.Mesh(parts.ring, new T.MeshBasicMaterial({ color: look.ring, transparent: true, opacity: .85 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .045;
  root.add(ring);

  ball(body, look.body, 0, .5, 0, .43, .45, .39);
  ball(body, look.belly, 0, .45, .17, .31, .31, .24);
  const head = new T.Group();
  head.position.set(0, .98, .02);
  body.add(head);
  ball(head, look.body, 0, 0, 0, .39, .36, .36);

  const eyes: T.Object3D[] = [];
  for (const side of [-1, 1]) {
    const eye = new T.Group();
    if (kind === "frog") eye.position.set(side * .17, .3, .2);
    else eye.position.set(side * .135, .045, .3);
    head.add(eye);
    ball(eye, colours.white, 0, 0, 0, .085, .095, .06, false, .25);
    ball(eye, colours.black, side * -.004, -.006, .045, .058, .066, .03, false, .2);
    add(eye, new T.Mesh(parts.sphere, parts.glint), -side * .018, .028, .074, .018);
    eyes.push(eye);
    ball(head, colours.blush, side * .245, -.075, .25, .07, .042, .03, false);
  }

  const ears: T.Object3D[] = [];
  if (kind === "duck") {
    ball(head, look.accent, 0, -.05, .35, .14, .055, .12);
    ball(head, look.accent, 0, -.1, .33, .11, .04, .09);
    ball(head, look.body, .02, .37, 0, .07, .09, .07);
    ball(head, look.body, -.06, .35, -.04, .05, .07, .05);
    // a small office tie
    const tie = parts.rbox(body, 0xe8603c, 0, .66, .37, .1, .1, .05, .03);
    tie.rotation.z = Math.PI / 4;
    parts.rbox(body, 0xe8603c, 0, .52, .38, .09, .2, .04, .03);
  } else if (kind === "bunny") {
    ball(head, colours.blush, 0, -.02, .345, .045, .032, .03);
    for (const side of [-1, 1]) {
      const ear = new T.Group();
      ear.position.set(side * .15, .3, -.04);
      ear.rotation.z = -side * .16;
      head.add(ear);
      capsule(ear, look.body, 0, .2, 0, .1, .2, .075);
      capsule(ear, look.accent, 0, .2, .045, .055, .15, .03);
      ears.push(ear);
    }
    // ID badge on a lanyard
    parts.rbox(body, colours.white, 0, .55, .38, .19, .23, .03, .03);
    parts.rbox(body, look.ring, 0, .6, .395, .13, .05, .01, .01);
  } else if (kind === "cat") {
    ball(head, colours.blush, 0, -.03, .345, .04, .03, .03);
    for (const side of [-1, 1]) {
      const ear = new T.Group();
      ear.position.set(side * .22, .3, -.02);
      ear.rotation.z = -side * .3;
      head.add(ear);
      parts.rbox(ear, look.body, 0, .04, 0, .2, .2, .1, .04).rotation.z = Math.PI / 4;
      parts.rbox(ear, look.accent, 0, .03, .04, .1, .1, .05, .02).rotation.z = Math.PI / 4;
      for (const dy of [-.045, .02]) {
        parts.rbox(head, 0x4a4558, side * .36, -.06 + dy, .26, .24, .012, .012, .005).rotation.z = -side * dy * 3;
      }
    }
    // curly tail and a bell collar
    const tail = capsule(body, look.body, .3, .42, -.36, .07, .2, .07);
    tail.rotation.z = -.7;
    parts.rbox(body, look.accent, 0, .72, .22, .5, .07, .2, .03);
    ball(body, 0xffd54f, 0, .66, .38, .06);
  } else {
    // frog: big eyes on top, wide smile, spots
    for (const side of [-1, 1]) {
      ball(head, look.body, side * .17, .26, .14, .13, .12, .12);
      ball(body, look.accent, side * .22, .62, .3, .05, .05, .03, false);
    }
    ball(head, 0x2f6b3a, 0, -.08, .33, .17, .022, .04, false);
    ball(body, look.accent, 0, .3, .4, .04, .04, .03, false);
    parts.rbox(body, 0xfff3b0, 0, .52, .39, .26, .06, .03, .02);
  }

  const arms = [-1, 1].map(side => {
    const pivot = new T.Group();
    pivot.position.set(side * .38, .7, .02);
    body.add(pivot);
    capsule(pivot, look.body, side * .05, -.14, 0, .085, .13, .085);
    return pivot;
  });
  const feet = [-1, 1].map(side => ball(body, look.accent, side * .17, .07, .1, .13, .07, .18));

  return {
    root, body, head, eyes, ears, arms, feet, ring, kind,
    facing: 0, phase: 0, squash: 0, squashSpeed: 0, blinkAt: 1 + Math.random() * 3, dustAt: 0, boostAt: 0,
  };
}

type Parts = ReturnType<typeof makeParts>;

function makeParts() {
  const materials = new Map<string, T.MeshStandardMaterial>();
  const sphere = new T.SphereGeometry(1, 20, 14);
  const capsuleGeometry = new T.CapsuleGeometry(1, 1, 6, 14);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 28);
  const circle = new T.CircleGeometry(1, 32);
  const ring = new T.TorusGeometry(.56, .045, 8, 48);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const pen = shadowCanvas.getContext("2d")!;
  const fade = pen.createRadialGradient(32, 32, 2, 32, 32, 32);
  fade.addColorStop(0, "rgba(60,30,60,.55)");
  fade.addColorStop(1, "rgba(60,30,60,0)");
  pen.fillStyle = fade;
  pen.fillRect(0, 0, 64, 64);
  const shadowMaterial = new T.MeshBasicMaterial({ map: new T.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false });
  const glint = new T.MeshBasicMaterial({ color: 0xffffff });

  function material(colour: number, roughness = .72) {
    const key = `${colour}:${roughness}`;
    let entry = materials.get(key);
    if (!entry) {
      entry = new T.MeshStandardMaterial({ color: colour, roughness });
      materials.set(key, entry);
    }
    return entry;
  }

  function add(parent: T.Object3D, mesh: T.Mesh, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, cast = true) {
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  return {
    sphere, circle, ring, shadowMaterial, glint, material, add,
    ball(parent: T.Object3D, colour: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, cast = true, roughness = .62) {
      return add(parent, new T.Mesh(sphere, material(colour, roughness)), x, y, z, sx, sy, sz, cast);
    },
    capsule(parent: T.Object3D, colour: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
      return add(parent, new T.Mesh(capsuleGeometry, material(colour, .62)), x, y, z, sx, sy, sz);
    },
    cylinder(parent: T.Object3D, colour: number, x: number, y: number, z: number, radius: number, height: number, own = false) {
      const surface = own ? material(colour).clone() : material(colour);
      return add(parent, new T.Mesh(cylinder, surface), x, y, z, radius, height, radius);
    },
    rbox(parent: T.Object3D, colour: number, x: number, y: number, z: number, w: number, h: number, d: number, radius = .08, own = false) {
      const r = Math.max(.005, Math.min(radius, w / 2 - .002, h / 2 - .002, d / 2 - .002));
      const surface = own ? material(colour).clone() : material(colour);
      return add(parent, new T.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), surface), x, y, z, 1);
    },
    dispose() {
      materials.forEach(entry => entry.dispose());
      [sphere, capsuleGeometry, cylinder, circle, ring].forEach(entry => entry.dispose());
      shadowMaterial.map?.dispose();
      shadowMaterial.dispose();
      glint.dispose();
    },
  };
}

export function createOfficeWorld(host: HTMLDivElement, sound?: Sound) {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // ?quality=high or ?quality=low fixes the detail level; otherwise it drops automatically on slow devices.
  const requested = new URLSearchParams(window.location.search).get("quality");
  let quality: "high" | "low" = requested === "low" ? "low" : "high";
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.6 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = touch ? T.PCFShadowMap : T.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label", "3D office with a request tray, manager’s desk, pass counter, shredder and roster board");
  renderer.domElement.setAttribute("role", "img");
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = .38;

  const hemisphere = new T.HemisphereLight(0xfff3df, 0xb39fdc, 1.15);
  scene.add(hemisphere);
  const sun = new T.DirectionalLight(0xfff0d6, 2.8);
  sun.position.set(-6, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(touch ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -(roomX + 3.75), right: roomX + 3.75, top: roomZ + 4.9, bottom: -(roomZ + 4.9), near: 2, far: 40 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .035;
  scene.add(sun, sun.target);

  function lowerQuality() {
    quality = "low";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    scene.environment = null;
    hemisphere.intensity = 1.6;
    size();
  }
  const frameTimes: number[] = [];

  const parts = makeParts();
  const { rbox, ball, cylinder } = parts;
  const textures: T.Texture[] = [];
  const geometries: T.BufferGeometry[] = [];
  const ownMaterials: T.Material[] = [];

  function paint(width: number, height: number, draw: (pen: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d")!);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
    return texture;
  }

  function face(parent: T.Object3D, texture: T.Texture, x: number, y: number, z: number, w: number, h: number, glow = false) {
    const geometry = new T.PlaneGeometry(w, h);
    const surface = glow
      ? new T.MeshBasicMaterial({ map: texture, toneMapped: false })
      : new T.MeshStandardMaterial({ map: texture, roughness: .8 });
    geometries.push(geometry);
    ownMaterials.push(surface);
    const mesh = new T.Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function sign(text: string, background: string, ink = "#2a2433") {
    return paint(512, 160, pen => {
      pen.fillStyle = background;
      pen.beginPath();
      pen.roundRect(6, 6, 500, 148, 44);
      pen.fill();
      pen.lineWidth = 10;
      pen.strokeStyle = "rgba(42,36,51,.18)";
      pen.stroke();
      pen.fillStyle = ink;
      pen.font = font(900, 84);
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText(text, 256, 86, 460);
    });
  }

  // Station names: bold billboards that always face the camera, sized to their text so long names stay big
  function stationSign(text: string, background: string, x: number, y: number, z: number, height = .5) {
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = font(900, 96);
    const width = Math.ceil(measure.measureText(text).width) + 110;
    const texture = paint(width, 150, pen => {
      pen.fillStyle = "#2a2433";
      pen.beginPath();
      pen.roundRect(0, 0, width, 150, 46);
      pen.fill();
      pen.fillStyle = background;
      pen.beginPath();
      pen.roundRect(10, 10, width - 20, 130, 38);
      pen.fill();
      pen.fillStyle = "#2a2433";
      pen.font = font(900, 96);
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText(text, width / 2, 80);
    });
    const surface = new T.SpriteMaterial({ map: texture, depthWrite: false, toneMapped: false });
    ownMaterials.push(surface);
    const sprite = new T.Sprite(surface);
    sprite.position.set(x, y, z);
    sprite.scale.set(height * width / 150, height, 1);
    sprite.renderOrder = 3;
    scene.add(sprite);
    return sprite;
  }

  // Floor: a chunky island with soft checker tiles
  rbox(scene, colours.baseShade, 0, -.62, 0, 2 * roomX + 2, .5, 2 * roomZ + 2, .22).castShadow = false;
  rbox(scene, colours.base, 0, -.26, 0, 2 * roomX + 1.8, .46, 2 * roomZ + 1.8, .2).castShadow = false;
  const tileGeometry = new RoundedBoxGeometry(.96, .12, .96, 2, .045);
  geometries.push(tileGeometry);
  const tileMaterial = new T.MeshStandardMaterial({ roughness: .86 });
  ownMaterials.push(tileMaterial);
  // Odd counts keep a row of tiles centred on z = 0, where the back/front colours split
  const tileCols = 2 * Math.floor(roomX) + 1;
  const tileRows = 2 * Math.floor(roomZ) + 1;
  const tileMid = (tileRows - 1) / 2;
  const tiles = new T.InstancedMesh(tileGeometry, tileMaterial, tileCols * tileRows);
  tiles.receiveShadow = true;
  const matrix = new T.Matrix4();
  const tint = new T.Color();
  for (let row = 0, i = 0; row < tileRows; row++) {
    for (let col = 0; col < tileCols; col++, i++) {
      const back = row < tileMid;
      const set = back ? colours.tileBack : colours.tileFront;
      tiles.setMatrixAt(i, matrix.makeTranslation(col - (tileCols - 1) / 2, -.02, row - tileMid));
      tiles.setColorAt(i, tint.setHex(set[(row + col) % 2]));
    }
  }
  scene.add(tiles);
  const rugLeft = office.tray.x - furniture.inbox.w / 2 - .35;
  const rugRight = office.desk.x + furniture.desk.w / 2 + .35;
  const rugX = (rugLeft + rugRight) / 2;
  const rugWidth = rugRight - rugLeft;
  const rugZ = (office.tray.z + office.desk.z) / 2 - .05;
  const rug = rbox(scene, colours.rug, rugX, .045, rugZ, rugWidth, .04, 2.5, .02);
  rug.castShadow = false;
  rbox(scene, 0xffe1e7, rugX, .07, rugZ, rugWidth - .4, .02, 2.1, .01).castShadow = false;

  // Walls
  const wallLength = 2 * roomX + 1.8;
  rbox(scene, colours.wallLow, 0, .55, backWallZ, wallLength, 1.1, .36, .1);
  rbox(scene, colours.wallHigh, 0, 2.05, backWallZ - .06, wallLength, 1.95, .26, .1);
  rbox(scene, colours.trim, 0, 3.06, backWallZ + .02, wallLength + .2, .16, .46, .06);
  rbox(scene, colours.trim, 0, 1.13, backWallZ + .19, wallLength, .08, .1, .03);
  for (const x of [-sideWallX, sideWallX]) {
    rbox(scene, colours.wallLow, x, .48, -.12, .36, .96, 2 * roomZ + 1.4, .12);
    rbox(scene, colours.trim, x, .98, -.12, .5, .1, 2 * roomZ + 1.5, .04);
  }

  // Roster board
  rbox(scene, colours.frame, 0, boardY, boardZ - .04, boardWidth + .36, boardHeight + .36, .16, .1);
  const slotOf = (index: number) => ({
    x: columnX(index % 7),
    y: boardY + (index < 7 ? .22 : -.5),
  });
  // The cork is painted once; the shift outlines are repainted when a round brings a different week
  const cork = document.createElement("canvas");
  cork.width = boardPixels;
  cork.height = 260;
  {
    const pen = cork.getContext("2d")!;
    pen.fillStyle = colours.cork;
    pen.fillRect(0, 0, boardPixels, 260);
    for (let i = 0; i < boardPixels * 1.3; i++) {
      pen.fillStyle = i % 3 ? "rgba(150,90,40,.16)" : "rgba(255,240,210,.22)";
      pen.fillRect(Math.random() * boardPixels, Math.random() * 260, 3, 3);
    }
  }
  const boardTexture = paint(boardPixels, 260, () => {});
  const boardCanvas = boardTexture.image as HTMLCanvasElement;
  let paintedWeek = "";

  // Slots the week doesn't need are greyed out as CLOSED; needed ones are an empty outline until a card is pinned
  function paintBoard(needed: boolean[]) {
    const key = needed.join(",");
    if (key === paintedWeek) return;
    paintedWeek = key;
    const pen = boardCanvas.getContext("2d")!;
    const sx = boardPixels / boardWidth;
    const sy = 260 / boardHeight;
    const px = (x: number) => (x + boardWidth / 2) * sx;
    const py = (y: number) => (boardHeight / 2 - (y - boardY)) * sy;
    pen.drawImage(cork, 0, 0);
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].forEach((day, i) => {
      const x = px(columnX(i));
      pen.fillStyle = "rgba(255,250,240,.85)";
      pen.beginPath();
      pen.roundRect(x - 64, py(boardY + .76) - 17, 128, 34, 17);
      pen.fill();
      pen.fillStyle = "#6b3f1f";
      pen.font = font(900, 26);
      pen.fillText(day, x, py(boardY + .76) + 1);
    });
    needed.forEach((need, i) => {
      const { x, y } = slotOf(i);
      pen.fillStyle = need ? "rgba(255,250,240,.38)" : "rgba(90,80,75,.3)";
      pen.beginPath();
      pen.roundRect(px(x - .47), py(y + .3), .94 * sx, .6 * sy, 12);
      pen.fill();
      if (need) {
        pen.setLineDash([12, 9]);
        pen.lineWidth = 6;
        pen.strokeStyle = "#a0643a";
        pen.stroke();
        pen.setLineDash([]);
      } else {
        pen.fillStyle = "rgba(60,50,50,.5)";
        pen.font = font(900, 22);
        pen.fillText("CLOSED", px(x), py(y));
      }
    });
    pen.font = font(900, 30);
    pen.fillStyle = "#6b3f1f";
    pen.fillText("AM", px(columnX(0) - .97), py(boardY + .22));
    pen.fillText("PM", px(columnX(0) - .97), py(boardY - .5));
    boardTexture.needsUpdate = true;
  }
  face(scene, boardTexture, 0, boardY, boardZ + .05, boardWidth, boardHeight);
  const slotGlowGeometry = new RoundedBoxGeometry(1.08, .74, .02, 2, .08);
  geometries.push(slotGlowGeometry);
  // Empty slots glow gold while someone carries an approved card for that day (red while a cancelled card can be pulled)
  const slotGlows = Array.from({ length: 14 }, (_, index) => {
    const surface = new T.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: .8, toneMapped: false });
    ownMaterials.push(surface);
    const mesh = new T.Mesh(slotGlowGeometry, surface);
    const { x, y } = slotOf(index);
    mesh.position.set(x, y, boardZ + .085);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  paintBoard(Array.from({ length: 14 }, () => true));

  // Wall clock that follows the round timer, and a poster
  const clock = new T.Group();
  clock.position.set((boardWidth / 2 + roomX) / 2 + .1, 1.95, boardZ + .02);
  scene.add(clock);
  cylinder(clock, 0xff7a8a, 0, 0, 0, .62, .16, true).rotation.x = Math.PI / 2;
  const clockFace = face(clock, paint(256, 256, pen => {
    pen.fillStyle = "#fffdf6";
    pen.beginPath();
    pen.arc(128, 128, 126, 0, Math.PI * 2);
    pen.fill();
    pen.fillStyle = "#2a2433";
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      pen.beginPath();
      pen.arc(128 + Math.sin(angle) * 98, 128 - Math.cos(angle) * 98, i % 3 ? 5 : 10, 0, Math.PI * 2);
      pen.fill();
    }
  }), 0, 0, .09, 1.06, 1.06);
  (clockFace.material as T.MeshStandardMaterial).transparent = true;
  const hand = new T.Group();
  hand.position.z = .11;
  clock.add(hand);
  rbox(hand, colours.stampRed, 0, .2, 0, .07, .42, .03, .03, true).castShadow = false;
  ball(clock, colours.black, 0, 0, .12, .05, .05, .03, false);
  const clockRim = clock.children[0] as T.Mesh;

  const poster = new T.Group();
  poster.position.set(-((boardWidth / 2 + roomX) / 2 + .1), 1.95, boardZ + .02);
  poster.rotation.z = .05;
  scene.add(poster);
  rbox(poster, colours.white, 0, 0, 0, 1.25, 1.55, .04, .03);
  face(poster, paint(256, 320, pen => {
    pen.fillStyle = "#ffe7a3";
    pen.fillRect(0, 0, 256, 320);
    pen.fillStyle = "#ff6f8e";
    pen.beginPath();
    pen.moveTo(128, 205);
    pen.bezierCurveTo(30, 140, 60, 50, 128, 105);
    pen.bezierCurveTo(196, 50, 226, 140, 128, 205);
    pen.fill();
    pen.fillStyle = "#2a2433";
    pen.font = font(900, 44);
    pen.textAlign = "center";
    pen.fillText("TEAM", 128, 255);
    pen.fillText("WORK", 128, 298);
  }), 0, 0, .025, 1.13, 1.43);

  // String lights along the top of the wall
  const lightPoints = 2 * Math.round(roomX / 2.3) + 1;
  const lightCurve = new T.CatmullRomCurve3(Array.from({ length: lightPoints }, (_, i) => {
    const x = -(roomX + .65) + i * 2 * (roomX + .65) / (lightPoints - 1);
    return new T.Vector3(x, 2.92 - (i % 2 ? .28 : 0), -(roomZ + .5));
  }));
  const wire = new T.TubeGeometry(lightCurve, 120, .015, 5, false);
  geometries.push(wire);
  scene.add(new T.Mesh(wire, parts.material(colours.black)));
  const bulbColours = [0xffd35c, 0xff8fb0, 0x8fe3c1, 0x9ac8ff];
  const bulbGeometry = new T.SphereGeometry(.075, 12, 8);
  geometries.push(bulbGeometry);
  const bulbMaterial = new T.MeshBasicMaterial({ toneMapped: false });
  ownMaterials.push(bulbMaterial);
  const bulbCount = Math.round(1.3 * (roomX + .65) * 2);
  const bulbs = new T.InstancedMesh(bulbGeometry, bulbMaterial, bulbCount);
  for (let i = 0; i < bulbCount; i++) {
    const point = lightCurve.getPointAt((i + .5) / bulbCount);
    bulbs.setMatrixAt(i, matrix.makeTranslation(point.x, point.y - .08, point.z + .05));
    bulbs.setColorAt(i, tint.setHex(bulbColours[i % bulbColours.length]));
  }
  scene.add(bulbs);

  // Pass counter
  const counterLeft = -office.bounds.x - .7;
  const counterWidth = office.counterRight - counterLeft;
  const counterCentre = (office.counterRight + counterLeft) / 2;
  rbox(scene, colours.counter, counterCentre, .44, 0, counterWidth, .88, .86, .14);
  rbox(scene, colours.counterShade, counterCentre, .1, 0, counterWidth - .08, .2, .9, .08);
  rbox(scene, colours.counterTop, counterCentre, .93, 0, counterWidth + .12, .15, 1.02, .07);
  for (let x = counterLeft + 1.1; x < office.counterRight - .5; x += 1.45) {
    rbox(scene, 0x7bbde0, x, .5, .44, .9, .5, .02, .02).castShadow = false;
    rbox(scene, 0x7bbde0, x, .5, -.44, .9, .5, .02, .02).castShadow = false;
  }
  const pads = office.pass.map(point => rbox(scene, colours.pad, point.x, 1.02, point.z, 1.32, .055, .78, .025, true));
  stationSign("PASS", "#fff27a", office.counterRight - 1.65, 1.75, 0, .46);

  // Request inbox
  const inbox = new T.Group();
  inbox.position.set(office.tray.x, 0, office.tray.z);
  scene.add(inbox);
  for (const x of [-1.45, 1.45]) for (const z of [-.55, .55]) cylinder(inbox, colours.trayLeg, x, .34, z, .08, .68);
  const trayTop = rbox(inbox, colours.tray, 0, .74, 0, furniture.inbox.w, .14, furniture.inbox.d, .07, true);
  for (const [x, z, w, d] of [[0, .7, 3.2, .08], [0, -.7, 3.2, .08], [1.6, 0, .08, 1.4], [-1.6, 0, .08, 1.4]]) {
    rbox(inbox, 0x8db3f5, x, .87, z, w, .16, d, .035);
  }
  stationSign("REQUEST TRAY", "#bfe0ff", office.tray.x, .55, office.tray.z + 1.05, .52);

  // Manager's desk with a big rubber stamp
  const desk = new T.Group();
  desk.position.set(office.desk.x, 0, office.desk.z);
  scene.add(desk);
  const deskTop = rbox(desk, colours.deskTop, 0, .84, 0, furniture.desk.w, .14, furniture.desk.d, .06, true);
  for (const x of [-1.25, 1.25]) {
    rbox(desk, colours.desk, x, .39, 0, .82, .78, 1.06, .08);
    for (const y of [.58, .26]) {
      rbox(desk, 0xf3bd84, x, y, .54, .66, .24, .04, .04).castShadow = false;
      ball(desk, colours.white, x, y, .57, .05, .05, .03, false);
    }
  }
  rbox(desk, colours.deskShade, 0, .5, -.42, 1.8, .6, .08, .04);
  stationSign("MANAGER’S DESK", "#ffe6a8", office.desk.x, .55, office.desk.z + .95, .52);
  // monitor
  const monitor = new T.Group();
  monitor.position.set(-1.15, .91, -.2);
  monitor.rotation.y = .35;
  desk.add(monitor);
  rbox(monitor, colours.ink, 0, .04, 0, .4, .06, .3, .03);
  rbox(monitor, colours.ink, 0, .22, 0, .08, .34, .06, .03);
  rbox(monitor, colours.ink, 0, .5, 0, 1.0, .64, .08, .05);
  face(monitor, paint(256, 160, pen => {
    pen.fillStyle = "#a8e6ff";
    pen.fillRect(0, 0, 256, 160);
    pen.fillStyle = "#ffffff";
    for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
      pen.fillRect(18 + i * 32, 46 + j * 48, 26, 38);
    }
    pen.fillStyle = "#5aa6d0";
    pen.fillRect(18, 14, 220, 20);
  }), 0, .5, .045, .9, .54, true);
  // lamp
  const lamp = new T.Group();
  lamp.position.set(1.35, .91, -.22);
  desk.add(lamp);
  cylinder(lamp, 0x8fe3c1, 0, .03, 0, .2, .06);
  cylinder(lamp, colours.black, 0, .3, 0, .025, .55);
  const shade = cylinder(lamp, 0x8fe3c1, .12, .58, .1, .2, .22);
  shade.rotation.x = .5;
  const bulbGlow = new T.MeshBasicMaterial({ color: 0xfff1b0, toneMapped: false });
  ownMaterials.push(bulbGlow);
  parts.add(lamp, new T.Mesh(parts.sphere, bulbGlow), .12, .48, .16, .08, .08, .08, false);
  // mug
  cylinder(desk, colours.white, .95, 1.03, .2, .11, .22);
  // ink pad and stamp
  rbox(desk, colours.ink, .25, .935, .1, .66, .06, .44, .025);
  rbox(desk, colours.stampRed, .25, .97, .1, .56, .02, .34, .01).castShadow = false;
  const stamp = new T.Group();
  stamp.position.set(.25, 1.25, .1);
  desk.add(stamp);
  rbox(stamp, colours.ink, 0, 0, 0, .46, .14, .34, .04);
  cylinder(stamp, 0x7b5236, 0, .2, 0, .06, .3);
  ball(stamp, colours.stampRed, 0, .4, 0, .15, .13, .15);

  // Decorations
  for (const { x, z, size } of furniture.plants) {
    const plant = new T.Group();
    plant.position.set(x, 0, z);
    plant.scale.setScalar(size);
    scene.add(plant);
    cylinder(plant, colours.pot, 0, .28, 0, .34, .56);
    cylinder(plant, 0xff8a63, 0, .58, 0, .38, .1);
    ball(plant, colours.leaf, 0, .95, 0, .42, .38, .42);
    ball(plant, colours.leafLight, .2, 1.2, .1, .28);
    ball(plant, colours.leaf, -.18, 1.25, -.08, .26);
  }
  const cooler = new T.Group();
  cooler.position.set(furniture.cooler.x, 0, furniture.cooler.z);
  scene.add(cooler);
  rbox(cooler, 0xe9eef7, 0, .45, 0, .6, .9, .6, .1);
  const water = new T.MeshStandardMaterial({ color: 0x8fd6ff, roughness: .1, transparent: true, opacity: .75 });
  ownMaterials.push(water);
  parts.add(cooler, new T.Mesh(new T.CylinderGeometry(.24, .26, .6, 20), water), 0, 1.22, 0, 1, 1, 1);
  rbox(cooler, 0x5aa6d0, -.12, .7, .31, .08, .1, .06, .03);
  rbox(cooler, colours.stampRed, .12, .7, .31, .08, .1, .06, .03);

  // A coffee corner, a printer and a beanbag
  const coffee = new T.Group();
  coffee.position.set(furniture.coffee.x, 0, furniture.coffee.z);
  scene.add(coffee);
  rbox(coffee, 0xf6c995, 0, .45, 0, .7, .9, 1.3, .08);
  rbox(coffee, colours.ink, 0, 1.12, -.2, .5, .45, .45, .08);
  rbox(coffee, 0x8fe3c1, -.26, 1.16, -.2, .02, .12, .2, .01).castShadow = false;
  ball(coffee, colours.stampRed, -.27, 1.26, -.05, .03, .03, .02, false);
  for (const [z, colour] of [[.25, colours.white], [.45, 0xff9fb4]] as const) cylinder(coffee, colour, 0, 1.0, z, .08, .16);
  // Shredder: a box with a slot on top, a bin at the front and paper strips peeking out
  const shredderGroup = new T.Group();
  shredderGroup.position.set(furniture.shredder.x, 0, furniture.shredder.z);
  scene.add(shredderGroup);
  const shredderBody = rbox(shredderGroup, 0xc9d3e6, 0, .55, 0, furniture.shredder.w, 1.1, furniture.shredder.d, .1, true);
  rbox(shredderGroup, 0xe9eef7, 0, 1.13, 0, furniture.shredder.w + .06, .12, furniture.shredder.d + .06, .06);
  rbox(shredderGroup, colours.ink, 0, 1.2, .08, .7, .04, .12, .02).castShadow = false;
  rbox(shredderGroup, 0x8a97b3, 0, .28, .51, .78, .5, .04, .03);
  for (let i = 0; i < 5; i++) {
    const strip = rbox(shredderGroup, colours.white, -.28 + i * .14, .56, .54, .05, .2 + (i % 2) * .08, .015, .005);
    strip.rotation.z = (i - 2) * .08;
    strip.castShadow = false;
  }
  stationSign("SHREDDER", "#fff27a", furniture.shredder.x + .35, .5, furniture.shredder.z + .9, .46);
  ball(shredderGroup, colours.stampRed, .33, 1.05, .52, .03, .03, .02, false);
  let shredShake = -10;

  // Exit door on the east wall: the Shift Snatcher sneaks in and runs out through here
  const door = new T.Group();
  door.position.set(roomX + .58, 0, office.exit.z);
  scene.add(door);
  rbox(door, 0x3b3350, .05, 1.0, 0, .1, 2.0, 1.2, .02).castShadow = false;
  for (const z of [-.68, .68]) rbox(door, colours.trim, 0, 1.05, z, .22, 2.2, .16, .05);
  rbox(door, colours.trim, 0, 2.2, 0, .22, .16, 1.52, .05);
  const leaf = new T.Group();
  leaf.position.set(-.02, 0, .58);
  door.add(leaf);
  rbox(leaf, 0xff9e7a, 0, .98, -.57, .08, 1.95, 1.12, .04);
  ball(leaf, 0xffd54f, 0, 1.0, -1.0, .05, .05, .05, false);
  stationSign("EXIT", "#5fe39a", office.exit.x - .1, 2.85, office.exit.z, .5);
  rbox(scene, 0x5fe39a, office.exit.x - .35, .05, office.exit.z, 1.1, .03, 1.5, .01).castShadow = false;
  let doorOpen = .15;
  let doorKick = -10;

  // A phone on the desk that rings when someone calls in sick
  const phone = new T.Group();
  phone.position.set(-1.45, .91, .25);
  desk.add(phone);
  rbox(phone, 0xff7a8a, 0, .06, 0, .42, .12, .3, .05);
  const handset = new T.Group();
  handset.position.y = .16;
  phone.add(handset);
  rbox(handset, 0xff5c74, 0, 0, 0, .5, .08, .12, .04);
  ball(handset, 0xff5c74, -.22, .02, 0, .07, .06, .08);
  ball(handset, 0xff5c74, .22, .02, 0, .07, .06, .08);
  let ringUntil = 0;

  // Cards: one pooled mesh per card id, textured by what the card shows
  const cardBody = new RoundedBoxGeometry(.95, .62, .05, 2, .035);
  const cardFace = new T.PlaneGeometry(.9, .57);
  geometries.push(cardBody, cardFace);
  const cardPaper = parts.material(colours.white, .8);
  const cardTextures = new Map<string, T.Texture>();
  // The whole card is coloured by kind, with a darker header band: blue request, yellow open shift, red cancelled.
  const cardLooks = {
    request: { body: "#7cc2ff", header: "#2f86e6", headerInk: "#ffffff", ink: "#0f2742", soft: "#1d4f86" },
    open: { body: "#ffd96b", header: "#f0ac1c", headerInk: "#4a3200", ink: "#3d2a00", soft: "#7a5a00" },
    cancelled: { body: "#ff9a9a", header: "#e0414b", headerInk: "#ffffff", ink: "#4a0f14", soft: "#9b1c26" },
  } as const;
  const headerText = { request: "REQUEST", open: "OPEN SHIFT", cancelled: "CANCELLED" } as const;
  const avatarTones = ["#ff9fb4", "#ffe08a", "#a8e08a", "#ffb070", "#c9a8ff", "#7fe0d0", "#fff3d6"];

  function cardTexture(card: Card, name: string) {
    const key = `${card.kind}|${card.day}|${name}|${card.approved}`;
    const cached = cardTextures.get(key);
    if (cached) return cached;
    const look = cardLooks[card.kind];
    const texture = paint(256, 168, pen => {
      pen.fillStyle = look.body;
      pen.beginPath();
      pen.roundRect(0, 0, 256, 168, 20);
      pen.fill();
      pen.fillStyle = look.header;
      pen.beginPath();
      pen.roundRect(0, 0, 256, 46, [20, 20, 0, 0]);
      pen.fill();
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillStyle = look.headerInk;
      pen.font = font(900, 32);
      pen.fillText(headerText[card.kind], 128, 25, 236);
      pen.fillStyle = look.ink;
      pen.font = font(900, 100);
      pen.fillText(days[card.day], card.kind === "cancelled" ? 104 : 128, 92, 200);
      if (card.kind === "cancelled") {
        pen.strokeStyle = "#c0222e";
        pen.lineWidth = 14;
        pen.lineCap = "round";
        pen.beginPath();
        pen.moveTo(196, 70);
        pen.lineTo(240, 114);
        pen.moveTo(240, 70);
        pen.lineTo(196, 114);
        pen.stroke();
      }
      if (name) {
        const tone = avatarTones[(name.charCodeAt(0) + name.length) % avatarTones.length];
        pen.fillStyle = tone;
        pen.beginPath();
        pen.arc(32, 141, 24, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = "#2a2433";
        pen.font = font(900, 30);
        pen.fillText(name.charAt(0).toUpperCase(), 32, 142);
        pen.textAlign = "left";
        pen.fillStyle = look.ink;
        pen.font = font(900, 46);
        pen.fillText(card.kind === "open" && !card.approved ? `for ${name}` : name, 64, 143, card.approved ? 124 : 180);
      } else {
        pen.fillStyle = look.soft;
        pen.font = font(900, 34);
        pen.fillText(card.kind === "cancelled" ? "cancelled!" : "needs cover", 128, 142, 236);
      }
      if (card.approved) {
        pen.fillStyle = "#ffffff";
        pen.beginPath();
        pen.arc(224, 138, 28, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = "#2fbf6a";
        pen.beginPath();
        pen.arc(224, 138, 24, 0, Math.PI * 2);
        pen.fill();
        pen.strokeStyle = "#ffffff";
        pen.lineWidth = 8;
        pen.lineCap = "round";
        pen.lineJoin = "round";
        pen.beginPath();
        pen.moveTo(212, 139);
        pen.lineTo(221, 148);
        pen.lineTo(238, 128);
        pen.stroke();
      }
    });
    cardTextures.set(key, texture);
    return texture;
  }

  const cardObjects: {
    group: T.Group; inner: T.Group; surface: T.MeshStandardMaterial; pin: T.Mesh;
    sig: string; popped: number; shake: number; shown: boolean;
  }[] = [];
  function cardObject(id: number) {
    while (cardObjects.length <= id) {
      const group = new T.Group();
      group.visible = false;
      const inner = new T.Group();
      group.add(inner);
      const bodyMesh = new T.Mesh(cardBody, cardPaper);
      bodyMesh.castShadow = true;
      inner.add(bodyMesh);
      const surface = new T.MeshStandardMaterial({ roughness: .75, emissive: 0x000000 });
      ownMaterials.push(surface);
      const front = new T.Mesh(cardFace, surface);
      front.position.z = .027;
      inner.add(front);
      const pin = ball(inner, colours.stampRed, 0, .25, .06, .055, .055, .055, false, .3);
      scene.add(group);
      cardObjects.push({ group, inner, surface, pin, sig: "", popped: -10, shake: -10, shown: false });
    }
    return cardObjects[id];
  }

  // Employees: small critters wandering the office, with a name bubble that flashes when someone carries their open shift
  const cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 24);
  geometries.push(cylinderGeometry);
  const skinTones = [0xffc8a8, 0xb8e1ff, 0xd7f5b0, 0xffe39a, 0xf2c4ff, 0xc9f1ec, 0xffd0e0, 0xe8d5ff];
  const hatTones = [0xff7aa8, 0xffa53d, 0x3ec7b4, 0x7a9cff, 0xb48cff];
  // A soft vertical beam of light that marks the employee a carried open shift is waiting for
  const beamGeometry = new T.CylinderGeometry(.7, .7, 2.8, 24, 1, true);
  geometries.push(beamGeometry);
  const beamTexture = paint(4, 64, pen => {
    const fade = pen.createLinearGradient(0, 0, 0, 64);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(1, "rgba(255,255,255,1)");
    pen.fillStyle = fade;
    pen.fillRect(0, 0, 4, 64);
  });
  function makeCrew() {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const shadow = new T.Mesh(parts.circle, parts.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .03;
    shadow.scale.setScalar(.5);
    root.add(shadow);
    const skin = new T.MeshStandardMaterial({ roughness: .62 });
    const hat = new T.MeshStandardMaterial({ roughness: .55 });
    ownMaterials.push(skin, hat);
    parts.add(body, new T.Mesh(parts.sphere, skin), 0, .42, 0, .36, .38, .33);
    const head = new T.Group();
    head.position.set(0, .86, .02);
    body.add(head);
    parts.add(head, new T.Mesh(parts.sphere, skin), 0, 0, 0, .34, .31, .31);
    for (const side of [-1, 1]) {
      ball(head, colours.white, side * .12, .03, .26, .075, .085, .05, false, .25);
      ball(head, colours.black, side * .12, .02, .3, .05, .058, .03, false, .2);
      ball(head, colours.blush, side * .21, -.07, .22, .06, .036, .025, false);
    }
    const crown = parts.add(head, new T.Mesh(parts.sphere, hat), 0, .17, -.07, .33, .2, .31);
    const brim = parts.add(head, new T.Mesh(cylinderGeometry, hat), 0, .15, .2, .2, .025, .15);
    crown.castShadow = brim.castShadow = true;
    const feet = [-1, 1].map(side => ball(body, 0x7a6a8c, side * .14, .06, .08, .1, .055, .14));
    // What they hold on a break: a cup of water, or a banana
    const cup = new T.Group();
    cup.position.set(.24, .58, .28);
    body.add(cup);
    cylinder(cup, colours.white, 0, 0, 0, .08, .18);
    cylinder(cup, 0x8fd6ff, 0, .085, 0, .066, .014);
    cup.visible = false;
    const banana = new T.Group();
    banana.position.set(.26, .62, .26);
    banana.rotation.z = .55;
    body.add(banana);
    parts.capsule(banana, 0xffd84d, 0, 0, 0, .065, .13, .065);
    ball(banana, 0x6b4a2b, 0, .21, 0, .026, .032, .026);
    banana.visible = false;
    const tagSurface = new T.SpriteMaterial({ depthTest: false, depthWrite: false });
    ownMaterials.push(tagSurface);
    const tag = new T.Sprite(tagSurface);
    tag.renderOrder = 5;
    tag.scale.set(1.7, .75, 1);
    tag.position.y = 2.15;
    root.add(tag);
    const ring = new T.Mesh(parts.ring, new T.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: .9, toneMapped: false }));
    ownMaterials.push(ring.material as T.Material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .09;
    ring.scale.setScalar(.8);
    ring.visible = false;
    root.add(ring);
    const beam = new T.Mesh(beamGeometry, new T.MeshBasicMaterial({
      map: beamTexture, color: 0xffe066, transparent: true, opacity: .5, depthWrite: false, side: T.DoubleSide, toneMapped: false,
    }));
    ownMaterials.push(beam.material as T.Material);
    beam.position.y = 1.4;
    beam.visible = false;
    root.add(beam);
    root.visible = false;
    scene.add(root);
    return { root, body, head, tag, ring, beam, feet, cup, banana, skin, hat, key: "", bubble: "", born: -10, popped: -10, facing: 0, phase: 0 };
  }
  const crew = new Map<number, ReturnType<typeof makeCrew>>();
  const bubbleTextures = new Map<string, T.Texture>();

  function bubbleTexture(name: string, wanted: boolean) {
    const key = `${name}|${wanted}`;
    const cached = bubbleTextures.get(key);
    if (cached) return cached;
    const texture = paint(340, 150, pen => {
      pen.fillStyle = wanted ? "#ffe45c" : "#fffdf8";
      pen.strokeStyle = wanted ? "#e07b00" : "#8a7ab8";
      pen.lineWidth = wanted ? 9 : 6;
      pen.beginPath();
      pen.roundRect(5, 5, 330, 114, 34);
      pen.fill();
      pen.stroke();
      pen.beginPath();
      pen.moveTo(150, 116);
      pen.lineTo(170, 146);
      pen.lineTo(190, 116);
      pen.fill();
      pen.fillStyle = "#2a2433";
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.font = font(900, 54);
      if (wanted) {
        pen.fillText(`❗ ${name}`, 170, 64, 300);
      } else {
        pen.fillText(name, 170, 64, 300);
      }
    });
    bubbleTextures.set(key, texture);
    return texture;
  }

  function crewFor(round: Round, npc: Extract<Npc, { kind: "staff" }>, wanted: boolean) {
    let member = crew.get(npc.id);
    if (!member) {
      member = makeCrew();
      member.born = -10;
      crew.set(npc.id, member);
    }
    const person = round.staff[npc.person];
    const name = person?.name ?? "Staff";
    if (member.key !== name) {
      member.key = name;
      const hash = name.charCodeAt(0) + name.length;
      member.skin.color.setHex(skinTones[hash % skinTones.length]);
      member.hat.color.setHex(hatTones[hash % hatTones.length]);
    }
    const bubble = `${name}|${wanted}`;
    if (member.bubble !== bubble) {
      member.bubble = bubble;
      member.tag.material.map = bubbleTexture(name, wanted);
      member.tag.material.needsUpdate = true;
    }
    return member;
  }

  // The Shift Snatcher: an Australian white ibis (bin chicken) built from boxes and blobs
  const black = colours.black;
  function makeSnatcher() {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const shadow = new T.Mesh(parts.circle, parts.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .035;
    shadow.scale.setScalar(.75);
    root.add(shadow);
    ball(body, 0xfffdf8, 0, .95, 0, .4, .36, .56);
    ball(body, 0x3a3544, 0, .88, -.55, .15, .09, .22);
    for (const side of [-1, 1]) {
      const wing = ball(body, 0xf1ede4, side * .36, .98, -.04, .1, .26, .42);
      wing.rotation.z = side * .15;
    }
    const neck = new T.Group();
    neck.position.set(0, 1.05, .4);
    neck.rotation.x = .5;
    body.add(neck);
    parts.capsule(neck, black, 0, .26, 0, .085, .26, .085);
    const head = new T.Group();
    head.position.set(0, 1.55, .65);
    body.add(head);
    ball(head, black, 0, 0, 0, .15, .15, .16);
    for (const side of [-1, 1]) {
      ball(head, colours.white, side * .09, .03, .08, .045, .05, .035, false, .25);
      ball(head, 0xff9f3a, side * .09, .03, .11, .02, .025, .015, false, .25);
    }
    // long down-curved beak in three segments
    const beak1 = new T.Group();
    beak1.position.set(0, -.02, .12);
    head.add(beak1);
    rbox(beak1, black, 0, 0, .14, .075, .075, .3, .03);
    const beak2 = new T.Group();
    beak2.position.set(0, 0, .29);
    beak2.rotation.x = .38;
    beak1.add(beak2);
    rbox(beak2, black, 0, 0, .11, .06, .06, .24, .025);
    const beak3 = new T.Group();
    beak3.position.set(0, 0, .22);
    beak3.rotation.x = .55;
    beak2.add(beak3);
    rbox(beak3, black, 0, 0, .08, .045, .045, .18, .02);
    const anchor = new T.Object3D();
    anchor.position.set(0, -.01, .16);
    beak3.add(anchor);
    const legs = [-1, 1].map(side => {
      const pivot = new T.Group();
      pivot.position.set(side * .14, .62, 0);
      body.add(pivot);
      cylinder(pivot, black, 0, -.3, 0, .028, .62);
      rbox(pivot, black, 0, -.6, .08, .12, .04, .24, .02);
      return pivot;
    });
    const stars = new T.Group();
    stars.position.y = 2.35;
    stars.visible = false;
    root.add(stars);
    const starMaterial = new T.MeshBasicMaterial({ color: 0xffe066, toneMapped: false });
    ownMaterials.push(starMaterial);
    for (let i = 0; i < 3; i++) {
      const star = new T.Mesh(parts.sphere, starMaterial);
      star.scale.setScalar(.09);
      star.position.set(Math.cos(i * 2.094) * .45, 0, Math.sin(i * 2.094) * .45);
      stars.add(star);
    }
    root.scale.setScalar(1.15);
    root.visible = false;
    scene.add(root);
    return {
      root, body, head, legs, stars, anchor, present: false, since: -10, gone: -10, phase: 0, facing: 0,
      last: { x: office.exit.x, z: office.exit.z },
    };
  }
  const bird = makeSnatcher();

  // Players
  const critters: Critter[] = critterKinds.map((kind, i) => makeCritter(kind, playerColours[i], parts));
  // Stars that circle a critter's head after it slips
  const dizzyMaterial = new T.MeshBasicMaterial({ color: 0xffe066, toneMapped: false });
  ownMaterials.push(dizzyMaterial);
  const dizzy = critters.map(() => {
    const group = new T.Group();
    for (let i = 0; i < 3; i++) {
      const star = new T.Mesh(parts.sphere, dizzyMaterial);
      star.scale.setScalar(.1);
      star.position.set(Math.cos(i * 2.094) * .5, 0, Math.sin(i * 2.094) * .5);
      group.add(star);
    }
    group.visible = false;
    scene.add(group);
    return group;
  });
  critters.forEach(critter => {
    critter.root.scale.setScalar(1.35);
    scene.add(critter.root);
  });
  const tags = playerColours.map((look, i) => {
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: paint(128, 80, pen => {
        pen.fillStyle = look.tag;
        pen.beginPath();
        pen.roundRect(4, 4, 120, 60, 24);
        pen.fill();
        pen.beginPath();
        pen.moveTo(52, 62);
        pen.lineTo(64, 78);
        pen.lineTo(76, 62);
        pen.fill();
        pen.fillStyle = "#2a2433";
        pen.font = font(900, 40);
        pen.textAlign = "center";
        pen.textBaseline = "middle";
        pen.fillText(`P${i + 1}`, 64, 36);
      }),
      depthTest: false,
      depthWrite: false,
    }));
    ownMaterials.push(sprite.material);
    sprite.scale.set(.62, .39, 1);
    sprite.renderOrder = 5;
    scene.add(sprite);
    return sprite;
  });

  // A bouncing arrow over the critter one person is controlling
  const markerGeometry = new T.ConeGeometry(.2, .36, 20);
  geometries.push(markerGeometry);
  const markers = playerColours.map(look => {
    const surface = new T.MeshBasicMaterial({ color: look.ring, toneMapped: false, depthTest: false });
    ownMaterials.push(surface);
    const mesh = new T.Mesh(markerGeometry, surface);
    mesh.rotation.x = Math.PI;
    mesh.renderOrder = 6;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  // Stamp progress: a horizontal bar over the critter's head, with a thin white outline so it reads on any floor
  const barWidth = 1.5;
  const barHeight = .26;
  const barOutline = .05;
  const barPlane = new T.PlaneGeometry(1, 1);
  geometries.push(barPlane);
  const barEdge = new T.MeshBasicMaterial({ color: 0xffffff, depthTest: false, toneMapped: false });
  const barTrack = new T.MeshBasicMaterial({ color: 0x2a2433, depthTest: false, toneMapped: false });
  const barFill = new T.MeshBasicMaterial({ color: 0x4fdc8a, depthTest: false, toneMapped: false });
  ownMaterials.push(barEdge, barTrack, barFill);
  const progress = critters.map(() => {
    const group = new T.Group();
    const edge = new T.Mesh(barPlane, barEdge);
    edge.scale.set(barWidth + barOutline * 2, barHeight + barOutline * 2, 1);
    const track = new T.Mesh(barPlane, barTrack);
    track.scale.set(barWidth, barHeight, 1);
    const fill = new T.Mesh(barPlane, barFill);
    edge.renderOrder = 6;
    track.renderOrder = 7;
    fill.renderOrder = 8;
    group.add(edge, track, fill);
    group.visible = false;
    scene.add(group);
    return { group, fill };
  });

  // Particles: confetti and soft puffs
  const confettiGeometry = new T.BoxGeometry(.12, .02, .08);
  const puffGeometry = new T.IcosahedronGeometry(.12, 1);
  geometries.push(confettiGeometry, puffGeometry);
  function pool(geometry: T.BufferGeometry, count: number, standard: boolean) {
    const surface = standard ? new T.MeshStandardMaterial({ roughness: .9 }) : new T.MeshBasicMaterial({ toneMapped: false });
    ownMaterials.push(surface);
    const mesh = new T.InstancedMesh(geometry, surface, count);
    mesh.frustumCulled = false;
    const items: Particle[] = Array.from({ length: count }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, spin: 0, gravity: 0 }));
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrix.makeScale(0, 0, 0));
      mesh.setColorAt(i, tint.setHex(0xffffff));
    }
    scene.add(mesh);
    return { mesh, items, next: 0 };
  }
  const confetti = pool(confettiGeometry, 160, false);
  const puffs = pool(puffGeometry, 80, true);
  const confettiColours = [0xff6f8e, 0xffd35c, 0x5fe39a, 0x6eb7ff, 0xb48cff, 0xff9e5c];

  function emit(target: typeof confetti, at: T.Vector3Like, count: number, options: { colours: number[]; speed: number; up: number; gravity: number; life: number; size: number }) {
    for (let n = 0; n < count; n++) {
      const index = target.next;
      target.next = (target.next + 1) % target.items.length;
      const angle = Math.random() * Math.PI * 2;
      const speed = options.speed * (.4 + Math.random() * .6);
      Object.assign(target.items[index], {
        life: options.life * (.7 + Math.random() * .5), max: options.life,
        x: at.x, y: at.y, z: at.z,
        vx: Math.cos(angle) * speed, vy: options.up * (.6 + Math.random() * .7), vz: Math.sin(angle) * speed,
        size: options.size * (.7 + Math.random() * .6), spin: Math.random() * 10, gravity: options.gravity,
      });
      target.mesh.setColorAt(index, tint.setHex(options.colours[n % options.colours.length]));
    }
    if (target.mesh.instanceColor) target.mesh.instanceColor.needsUpdate = true;
  }

  const spin = new T.Euler();
  const turn = new T.Quaternion();
  const place = new T.Vector3();
  const grow = new T.Vector3();
  function updatePool(target: typeof confetti, dt: number, puff: boolean) {
    target.items.forEach((item, i) => {
      if (item.life <= 0) {
        target.mesh.setMatrixAt(i, matrix.makeScale(0, 0, 0));
        return;
      }
      item.life -= dt;
      item.vy -= item.gravity * dt;
      const drag = puff ? .9 : .985;
      item.vx *= drag ** (dt * 60);
      item.vz *= drag ** (dt * 60);
      item.x += item.vx * dt;
      item.y = Math.max(.06, item.y + item.vy * dt);
      item.z += item.vz * dt;
      item.spin += dt * 9;
      const age = 1 - Math.max(0, item.life) / item.max;
      const scale = puff ? item.size * (.6 + age * .9) * (1 - age ** 3) : item.size * Math.min(1, item.life * 3);
      spin.set(item.spin, item.spin * .7, item.spin * .3);
      matrix.compose(place.set(item.x, item.y, item.z), turn.setFromEuler(spin), grow.setScalar(Math.max(0, scale)));
      target.mesh.setMatrixAt(i, matrix);
    });
    target.mesh.instanceMatrix.needsUpdate = true;
  }

  // Floating words
  const words = {
    leak: sign("Leak!", "#8fd6ff"),
    peel: sign("Banana!", "#ffe066"),
    slip: sign("Whoops!", "#ffb3c2"),
    stamp: sign("Stamped!", "#5fe39a"),
    pin: sign("Rostered!", "#ffd35c"),
    nope: sign("Nope!", "#ff8fb0"),
    cancel: sign("Cancelled!", "#ff7a7a"),
    shred: sign("Shredded!", "#d5deee"),
    accept: sign("Accepted!", "#8fe3c1"),
    snatch: sign("Snatched!", "#ff8fb0"),
    saved: sign("Saved!", "#9ac8ff"),
    busy: sign("Busy!", "#ffd35c"),
    chaos: sign("Chaos!", "#ff7a7a"),
    warn: sign("Uh oh…", "#ffd35c"),
    charge: sign("+⚡", "#fff27a"),
    boost: sign("Boost!", "#ffb347"),
    win: sign("Week covered!", "#ffd35c"),
    lose: sign("Time’s up!", "#ff8fb0"),
  };
  const popups = Array.from({ length: 8 }, () => {
    const material = new T.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true });
    ownMaterials.push(material);
    const sprite = new T.Sprite(material);
    sprite.renderOrder = 7;
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, age: 0, size: 1, x: 0, y: 0, z: 0 };
  });
  let nextPopup = 0;
  function popup(word: keyof typeof words, x: number, y: number, z: number, size = 1) {
    const item = popups[nextPopup];
    nextPopup = (nextPopup + 1) % popups.length;
    item.sprite.material.map = words[word];
    item.sprite.material.needsUpdate = true;
    Object.assign(item, { age: 0, size, x, y, z });
    item.sprite.visible = true;
  }

  // Lightning pickups: a flat yellow bolt with a solid dark outline that always faces the camera, and a faint shadow
  const boltPoints = [[.1, .62], [-.26, -.04], [-.04, -.04], [-.14, -.62], [.28, .08], [.06, .08], [.26, .62]];
  const boltTexture = paint(160, 200, pen => {
    pen.beginPath();
    boltPoints.forEach(([bx, by], n) => {
      const x = 80 + bx * 220;
      const y = 100 - by * 145;
      if (n === 0) pen.moveTo(x, y);
      else pen.lineTo(x, y);
    });
    pen.closePath();
    pen.lineJoin = "round";
    pen.lineWidth = 16;
    pen.strokeStyle = "#1b1240";
    pen.stroke();
    pen.fillStyle = "#ffd92e";
    pen.fill();
  });
  const boltMaterial = new T.SpriteMaterial({ map: boltTexture, toneMapped: false });
  ownMaterials.push(boltMaterial);
  const bolts = Array.from({ length: 6 }, () => {
    const group = new T.Group();
    const sprite = new T.Sprite(boltMaterial);
    sprite.scale.set(.96, 1.2, 1);
    sprite.renderOrder = 4;
    group.add(sprite);
    const shadow = new T.Mesh(parts.circle, parts.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .04;
    shadow.scale.set(.45, .3, 1);
    group.add(shadow);
    group.visible = false;
    scene.add(group);
    return { group, sprite, id: -1, seen: false };
  });

  function placeBolts(round: Round, now: number) {
    const still = reducedMotion.matches;
    bolts.forEach(entry => (entry.seen = false));
    for (let n = 0; n < round.bolts.length; n++) {
      const bolt = round.bolts[n];
      let entry = bolts.find(item => item.id === bolt.id);
      if (!entry) {
        entry = bolts.find(item => item.id === -1);
        if (!entry) continue;
        entry.id = bolt.id;
      }
      entry.seen = true;
      const age = Math.min(1, Math.max(0, (round.elapsed - bolt.born) / .4));
      const pop = Math.max(.001, easeBack(age));
      entry.group.visible = true;
      entry.group.position.set(bolt.point.x, 0, bolt.point.z);
      entry.group.scale.setScalar(pop);
      entry.sprite.position.y = .95 + (still ? 0 : Math.sin(now * 3 + bolt.id) * .08);
    }
    bolts.forEach(entry => {
      if (entry.seen) return;
      entry.id = -1;
      entry.group.visible = false;
    });
  }

  // Camera
  const camera = new T.PerspectiveCamera(30, 1, .5, 140);
  const focus = new T.Vector3(0, .5, .1);
  const cornerX = roomX + 1.05;
  const corners = [-cornerX, cornerX].flatMap(x => [
    // Front bottom edge of the island base, back floor corner, and the top of the back wall
    new T.Vector3(x, -.9, roomZ + 1.05), new T.Vector3(x, -.5, -(roomZ + .9)), new T.Vector3(x, 3.15, -(roomZ + .8)),
  ]);
  const ndc = new T.Vector3();
  const yaw = 0;
  let shake = 0;
  let pan = 0;
  let maxPan = 0;
  const basePosition = new T.Vector3();
  // Screen space (in CSS pixels) the page's HUD covers at the top and bottom; the room is framed between them.
  let insetTop = 0;
  let insetBottom = 0;

  // Landscape screens see the whole office. Tall screens fit its depth and follow player 1 sideways.
  function frame(width: number, height: number) {
    const aspect = width / height;
    const tall = aspect < .95;
    camera.aspect = aspect;
    camera.fov = tall ? 36 : 30;
    camera.updateProjectionMatrix();
    const direction = new T.Vector3();
    const top = Math.min(.95, 1 - 2 * insetTop / height);
    const bottom = Math.max(touch && tall ? -.6 : touch ? -.9 : -.95, -1 + 2 * insetBottom / height);
    const span = tall ? Math.max(4.2, cornerX * aspect * .95) : Infinity;
    // The room fits when it is narrow enough and its height on screen fits the band; centring comes after.
    const fits = (distance: number) => {
      camera.position.copy(focus).addScaledVector(direction, distance);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      let high = -Infinity;
      let low = Infinity;
      let wide = 0;
      corners.forEach(point => {
        ndc.set(Math.max(-span, Math.min(span, point.x)), point.y, point.z).project(camera);
        high = Math.max(high, ndc.y);
        low = Math.min(low, ndc.y);
        wide = Math.max(wide, Math.abs(ndc.x));
      });
      return wide <= .97 && high - low <= top - bottom;
    };
    // Closest camera distance at which the room fits, for a given tilt
    const closest = (pitch: number) => {
      direction.set(0, Math.sin(pitch), Math.cos(pitch));
      let near = 8;
      let far = 120;
      for (let i = 0; i < 24; i++) {
        const middle = (near + far) / 2;
        if (fits(middle)) far = middle;
        else near = middle;
      }
      return far;
    };
    // Landscape screens use the usual three-quarter view. When the room runs out of width before height
    // (squarer windows), tilt a little more top-down so the spare height makes the room bigger instead of empty.
    let pitch = tall ? 1.08 : .9;
    let far = closest(pitch);
    if (!tall) {
      for (const steeper of [.95, 1.0, 1.05, 1.1]) {
        const distance = closest(steeper);
        if (distance < far * .985) {
          pitch = steeper;
          far = distance;
        }
      }
      far = closest(pitch);
    }
    // Centre the room vertically within the allowed band. Perspective makes one step inexact, so refine a few times.
    fits(far);
    const cameraUp = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const aim = focus.clone();
    for (let step = 0; step < 4; step++) {
      let high = -Infinity;
      let low = Infinity;
      corners.forEach(point => {
        ndc.set(Math.max(-span, Math.min(span, point.x)), point.y, point.z).project(camera);
        high = Math.max(high, ndc.y);
        low = Math.min(low, ndc.y);
      });
      const lift = ((high + low) / 2 - (top + bottom) / 2) * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * far;
      camera.position.addScaledVector(cameraUp, lift);
      aim.addScaledVector(cameraUp, lift);
      camera.lookAt(aim);
      camera.updateMatrixWorld();
    }
    basePosition.copy(camera.position);
    const halfView = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * aspect * far;
    maxPan = tall ? Math.max(0, cornerX + .1 - halfView * .92) : 0;
  }

  function size() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    frame(width, height);
    render();
  }

  // Game state tracking: the rules push one-off moments onto round.fx and we consume the new ones
  const clockStart = performance.now();
  let lastTime = clockStart;
  let tracked: Round | undefined;
  let lastFx = 0;
  let stampSlam = 0;

  function squash(index: number | undefined, amount: number) {
    if (index !== undefined && critters[index]) critters[index].squashSpeed = amount;
  }

  const paperColours = [0xffffff, 0xe8eef8, 0xfff3d6];
  const starColours = [0xffe066, 0xfff6b0, 0xffffff];
  const boltColours = [0xffe066, 0xfff27a, 0xffffff, 0xffb347];
  const trailAt = { x: 0, y: 0, z: 0 };

  function slotAt(round: Round, event: Fx) {
    const card = event.card === undefined ? undefined : round.cards[event.card];
    if (card?.at.place === "board") return card.at.slot;
    return undefined;
  }

  function handle(round: Round, event: Fx, now: number) {
    sound?.play(event.kind);
    const { x, z } = event;
    const mine = event.card === undefined ? undefined : cardObject(event.card);
    switch (event.kind) {
      case "spawn":
      case "open":
        if (mine) mine.popped = now;
        emit(puffs, { x, y: .9, z }, 6, { colours: [0xfff6e6, event.kind === "open" ? 0xffe066 : 0xbfe0ff], speed: 1, up: .8, gravity: 0, life: .5, size: .8 });
        break;
      case "pick":
        squash(event.player, 5);
        if (mine) mine.popped = now - .15;
        break;
      case "put":
        squash(event.player, 4);
        emit(puffs, { x, y: .2, z }, 5, { colours: [0xfff6e6], speed: .9, up: .5, gravity: 0, life: .5, size: .9 });
        break;
      case "stamp": {
        squash(event.player, 7);
        stampSlam = 1;
        const at = { x: office.desk.x + .25, y: 1.1, z: office.desk.z + .1 };
        emit(puffs, at, 10, { colours: [0xf0595f, 0xff8fa0], speed: 1.6, up: 1.2, gravity: 0, life: .6, size: .8 });
        emit(confetti, at, 12, { colours: [0x5fe39a, 0xffffff, 0xffd35c], speed: 1.8, up: 3, gravity: 8, life: .9, size: .8 });
        popup("stamp", office.desk.x + .3, 3.0, office.desk.z, .95);
        if (mine) mine.popped = now;
        shake = Math.max(shake, .08);
        break;
      }
      case "pin": {
        squash(event.player, 6);
        const slot = slotAt(round, event);
        const spot = slot === undefined ? { x, y: boardY } : slotOf(slot);
        emit(confetti, { x: spot.x, y: spot.y, z: boardZ + .3 }, 26, { colours: confettiColours, speed: 2.4, up: 3.2, gravity: 7, life: 1.2, size: 1 });
        popup("pin", spot.x, 1.0, office.boardZ + .9, .9);
        if (mine) mine.popped = now;
        shake = Math.max(shake, .12);
        break;
      }
      case "nope":
        if (mine) mine.shake = now;
        squash(event.player, -3);
        popup("nope", x, 2.2, z, .7);
        break;
      case "cancel": {
        const slot = slotAt(round, event);
        const spot = slot === undefined ? { x, y: boardY } : slotOf(slot);
        emit(puffs, { x: spot.x, y: spot.y, z: boardZ + .3 }, 10, { colours: [0xff6b6b, 0xfff6e6], speed: 1.3, up: .8, gravity: 0, life: .7, size: .9 });
        popup("cancel", spot.x, 1.0, office.boardZ + .9, 1);
        ringUntil = now + 1.6;
        shake = Math.max(shake, .1);
        break;
      }
      case "shred":
        squash(event.player, 5);
        shredShake = now;
        emit(confetti, { x: furniture.shredder.x, y: 1.25, z: furniture.shredder.z }, 18, { colours: paperColours, speed: .5, up: 1.2, gravity: 7, life: .9, size: .8 });
        emit(puffs, { x: furniture.shredder.x, y: 1.0, z: furniture.shredder.z + .3 }, 4, { colours: [0xe8eef8], speed: .7, up: .5, gravity: 0, life: .5, size: .7 });
        popup("shred", furniture.shredder.x + .4, 2.3, furniture.shredder.z + .3, .75);
        break;
      case "accept": {
        squash(event.player, 6);
        let bestDistance = Infinity;
        for (const npc of round.npcs) {
          const member = npc.kind === "staff" ? crew.get(npc.id) : undefined;
          const distance = Math.hypot(npc.point.x - x, npc.point.z - z);
          if (member && distance < bestDistance) {
            member.popped = now;
            bestDistance = distance;
          }
        }
        emit(confetti, { x, y: 1.3, z }, 14, { colours: [0xff6f8e, 0xff9fb4, 0xffd35c, 0xffffff], speed: 1.6, up: 3, gravity: 6, life: 1.1, size: .9 });
        popup("accept", x, 2.9, z, .85);
        if (mine) mine.popped = now;
        break;
      }
      case "snatch":
        shake = Math.max(shake, .26);
        popup("snatch", x, 1.0, Math.max(z, office.boardZ + .9), 1.15);
        emit(puffs, { x, y: 1, z }, 8, { colours: [0xfffdf8, 0xff8fb0], speed: 1.4, up: .8, gravity: 0, life: .6, size: .9 });
        break;
      case "knock":
        shake = Math.max(shake, .2);
        squash(event.player, 6);
        emit(confetti, { x, y: 1.6, z }, 12, { colours: starColours, speed: 1.9, up: 3.2, gravity: 6, life: 1, size: .9 });
        break;
      case "rescue":
        popup("saved", x, 2.9, z, 1.1);
        emit(confetti, { x, y: 1.4, z }, 14, { colours: confettiColours, speed: 2, up: 3.2, gravity: 6, life: 1.1, size: 1 });
        if (mine) mine.popped = now;
        break;
      case "escape":
        doorKick = now;
        emit(puffs, { x, y: .6, z }, 10, { colours: [0xfffdf8, 0xd9ccff], speed: 1.5, up: .7, gravity: 0, life: .7, size: 1 });
        break;
      case "dash":
        emit(puffs, { x, y: .15, z }, 3, { colours: [0xfff3e2], speed: .5, up: .3, gravity: 0, life: .4, size: .9 });
        break;
      case "warn": {
        const slot = slotAt(round, event);
        const spot = slot === undefined ? { x, y: boardY } : slotOf(slot);
        popup("warn", spot.x, 1.0, office.boardZ + .9, .8);
        emit(puffs, { x: spot.x, y: spot.y, z: boardZ + .3 }, 4, { colours: [0xffd35c, 0xfff6e6], speed: .8, up: .6, gravity: 0, life: .5, size: .7 });
        break;
      }
      case "bolt":
        emit(confetti, { x, y: .8, z }, 8, { colours: boltColours, speed: 1.2, up: 2.4, gravity: 5, life: .7, size: .8 });
        break;
      case "charge":
        squash(event.player, 5);
        emit(confetti, { x, y: .9, z }, 22, { colours: boltColours, speed: 2.4, up: 3.4, gravity: 6, life: .9, size: .9 });
        emit(puffs, { x, y: .8, z }, 5, { colours: [0xfff27a, 0xffffff], speed: 1, up: .8, gravity: 0, life: .5, size: .8 });
        popup("charge", x, 2.9, z, .7);
        break;
      case "boost":
        squash(event.player, 6);
        emit(confetti, { x, y: .9, z }, 30, { colours: boltColours, speed: 3, up: 3.6, gravity: 6, life: 1, size: 1 });
        emit(puffs, { x, y: .8, z }, 7, { colours: [0xffb347, 0xfff27a], speed: 1.3, up: .8, gravity: 0, life: .55, size: .9 });
        popup("boost", x, 2.9, z, .85);
        break;
      case "leak":
        popup("leak", furniture.cooler.x + .7, 2.5, furniture.cooler.z, .9);
        emit(puffs, { x: furniture.cooler.x + .3, y: .5, z: furniture.cooler.z - .2 }, 10, { colours: [0x8fd6ff, 0xffffff], speed: 1.2, up: .6, gravity: 0, life: .7, size: .9 });
        shake = Math.max(shake, .06);
        break;
      case "peel":
        popup("peel", x, 2.1, z, .75);
        emit(puffs, { x, y: .3, z }, 6, { colours: [0xffe066, 0xfff6e6], speed: .8, up: .5, gravity: 0, life: .5, size: .8 });
        break;
      case "slip":
        shake = Math.max(shake, .16);
        squash(event.player, -6);
        popup("slip", x, 2.6, z, .9);
        emit(confetti, { x, y: 1.3, z }, 10, { colours: starColours, speed: 1.6, up: 2.6, gravity: 6, life: .9, size: .8 });
        emit(puffs, { x, y: .1, z }, 8, { colours: [0x8fd6ff, 0xffffff], speed: 1.4, up: .5, gravity: 0, life: .5, size: .9 });
        break;
      case "busy":
        break;
      case "chaos":
        shake = Math.max(shake, .15);
        break;
      case "win":
        for (let i = 0; i < 7; i++) {
          emit(confetti, { x: columnX(i), y: boardY + .9, z: boardZ + .4 }, 18, { colours: confettiColours, speed: 2.6, up: 4, gravity: 6, life: 1.8, size: 1.1 });
        }
        popup("win", 0, 3.4, -1, 1.9);
        break;
      case "lose":
        popup("lose", 0, 3.2, 0, 1.6);
        break;
    }
  }

  function track(round: Round, now: number) {
    if (round !== tracked) {
      tracked = round;
      lastFx = 0;
      paintBoard(round.needed);
      cardObjects.forEach(entry => {
        entry.shown = false;
        entry.group.visible = false;
      });
      crew.forEach(member => {
        member.born = -10;
      });
      ringUntil = 0;
      bolts.forEach(entry => {
        entry.id = -1;
        entry.group.visible = false;
      });
    }
    for (const event of round.fx) {
      if (event.id <= lastFx) continue;
      lastFx = event.id;
      handle(round, event, now);
    }
  }

  const target = new T.Vector3();
  const beakAt = new T.Vector3();
  const litCards = new Set<number>();
  const slotLit: number[] = Array.from({ length: 14 }, () => 0);
  const litPads = [false, false, false, false];
  const litStaff = new Set<number>();
  const wantedStaff = new Set<number>();
  const lit = { tray: false, desk: false, shredder: false };

  function placeCards(round: Round, now: number, dt: number) {
    const still = reducedMotion.matches;
    for (let id = 0; id < round.cards.length; id++) {
      const card = round.cards[id];
      const entry = cardObject(id);
      const at = card.at;
      if (at.place === "gone") {
        entry.group.visible = false;
        entry.shown = false;
        continue;
      }
      let tilt = 1;
      let scale = .75;
      let follow = 0;
      let yaw = 0;
      let roll = 0;
      let point: { x: number; z: number } | undefined;
      let y = 0;
      if (at.place === "tray") {
        point = traySpot(at.seat);
        y = .97;
        yaw = ((id * 7) % 5 - 2) * .04;
      } else if (at.place === "counter") {
        point = office.pass[at.pad];
        y = 1.16;
      } else if (at.place === "floor") {
        point = at.point;
        y = .1;
        tilt = 1.3;
        yaw = (id % 7 - 3) * .25;
      } else if (at.place === "hand") {
        const holder = critters[at.player];
        point = round.players[at.player]?.position;
        y = 3.0 + (holder ? holder.body.position.y * 1.35 : 0);
        tilt = .25;
        scale = 1;
        follow = 22;
        roll = still ? 0 : Math.sin(now * 3 + id) * .05;
      } else if (at.place === "snatcher") {
        bird.anchor.getWorldPosition(beakAt);
        point = beakAt;
        y = beakAt.y - .12;
        tilt = .5;
        scale = .55;
        follow = 30;
      } else {
        const spot = slotOf(at.slot);
        point = { x: spot.x, z: boardZ + .16 };
        y = spot.y;
        tilt = 0;
        scale = 1;
        roll = ((at.slot * 37 % 11) / 11 - .5) * .12;
      }
      if (!point) {
        entry.group.visible = false;
        continue;
      }
      target.set(point.x, y, point.z);
      if (!entry.shown) {
        entry.shown = true;
        entry.popped = Math.max(entry.popped, now - .05);
        entry.group.position.copy(target);
      } else if (follow) {
        entry.group.position.lerp(target, 1 - Math.exp(-dt * follow));
      } else {
        entry.group.position.copy(target);
      }
      entry.group.visible = true;

      const sig = `${card.kind}|${card.day}|${card.worker ?? -1}|${card.approved}`;
      if (sig !== entry.sig) {
        entry.sig = sig;
        entry.surface.map = cardTexture(card, card.worker === undefined ? "" : round.staff[card.worker]?.name ?? "");
        entry.surface.needsUpdate = true;
      }
      const shaking = now - entry.shake;
      const wobble = shaking < .45 && !still ? Math.sin(shaking * 55) * .22 * (1 - shaking / .45) : 0;
      const hop = shaking < .45 && !still ? Math.sin(shaking / .45 * Math.PI) * .25 : 0;
      entry.group.position.y += hop;
      // A doomed card on the board shakes harder and faster as its cancellation nears
      let doom = 0;
      if (card.doomedAt !== undefined && at.place === "board") {
        doom = T.MathUtils.clamp(1 - (card.doomedAt - round.elapsed) / settings.cancelWarning, 0, 1);
        if (!still) {
          const rate = 18 + doom * 30;
          roll += Math.sin(now * rate + id) * (.04 + doom * .2);
          entry.group.position.x += Math.sin(now * rate * 1.3) * (.01 + doom * .035);
          entry.group.position.y += Math.abs(Math.sin(now * rate * .7)) * doom * .03;
        }
      }
      entry.group.rotation.set(-tilt, yaw, roll + wobble);
      const bounce = Math.min(1, (now - entry.popped) / .35);
      const pop = bounce < 1 ? easeBack(bounce) : 1;
      const cancelled = card.kind === "cancelled";
      const pulse = cancelled ? .5 + Math.sin(now * 7) * .5 : 0;
      entry.inner.scale.setScalar(Math.max(.001, scale * pop * (cancelled && at.place === "board" && !still ? 1 + pulse * .06 : 1)));
      entry.pin.visible = at.place === "board";
      if (cancelled) {
        entry.surface.emissive.setHex(0xff2a3a);
        entry.surface.emissiveIntensity = .1 + pulse * .45;
      } else if (doom > 0) {
        entry.surface.emissive.setHex(0xff2a3a);
        entry.surface.emissiveIntensity = still ? doom * .3 : doom * (.1 + (.5 + Math.sin(now * (6 + doom * 22)) * .5) * .45);
      } else if (litCards.has(id)) {
        entry.surface.emissive.copy(highlightColour);
        entry.surface.emissiveIntensity = .3 + Math.sin(now * 7) * .12;
      } else {
        entry.surface.emissiveIntensity = 0;
      }
    }
  }

  function placeStaff(round: Round, now: number, dt: number) {
    const still = reducedMotion.matches;
    crew.forEach(member => (member.root.visible = false));
    round.npcs.forEach(npc => {
      if (npc.kind !== "staff") return;
      const wanted = wantedStaff.has(npc.id);
      const member = crewFor(round, npc, wanted);
      if (member.born < 0) member.born = now;
      member.root.visible = true;
      member.root.position.set(npc.point.x, .07, npc.point.z);
      let turnBy = npc.facing - member.facing;
      turnBy = Math.atan2(Math.sin(turnBy), Math.cos(turnBy));
      member.facing += turnBy * (1 - Math.exp(-dt * 8));
      member.root.rotation.y = member.facing;
      const walking = npc.moving && round.phase === "playing";
      if (walking) member.phase += dt * 9;
      const step = member.phase;
      member.body.position.y = still ? 0 : walking ? Math.abs(Math.sin(step)) * .09 : Math.max(0, Math.sin(now * 2.4 + npc.id * 2)) * .05;
      member.body.rotation.z = walking && !still ? Math.sin(step) * .12 : 0;
      member.head.rotation.z = still ? 0 : Math.sin(now * 2 + npc.id) * .06;
      const errand = npc.errand;
      const busy = errand?.stage === "busy" && round.phase === "playing";
      member.head.rotation.x = busy && !still ? (errand.kind === "water" ? -.35 + Math.sin(now * 3) * .05 : Math.sin(now * 12) * .12) : 0;
      member.cup.visible = errand?.kind === "water" && errand.stage === "busy";
      member.banana.visible = errand?.kind === "banana";
      if (member.banana.visible) {
        const left = Math.max(.25, (errand!.until - round.elapsed) / settings.snackTime);
        member.banana.scale.set(1, left, 1);
      }
      member.feet.forEach((foot, side) => {
        const swing = walking ? Math.sin(step + side * Math.PI) : 0;
        foot.position.z = .08 + swing * .12;
        foot.position.y = .06 + Math.max(0, swing) * .06;
      });
      const spawn = Math.min(1, Math.max(0, (now - member.born) / .4));
      const bounce = Math.min(1, (now - member.popped) / .4);
      const pop = (spawn < 1 ? easeBack(spawn) : 1) * (bounce < 1 ? 1 + Math.sin(bounce * Math.PI) * .25 : 1);
      member.root.scale.setScalar(.95 * Math.max(.001, pop));
      const glowing = litStaff.has(npc.id);
      const beat = still ? 0 : Math.sin(now * 9);
      member.ring.visible = glowing || wanted;
      if (wanted) {
        member.ring.scale.setScalar(1.25 + beat * .12);
        (member.ring.material as T.MeshBasicMaterial).color.setHex(beat > 0 ? 0xffe066 : 0xff9a3c);
      } else if (glowing) {
        member.ring.scale.setScalar(.8 + Math.sin(now * 7) * .05);
        (member.ring.material as T.MeshBasicMaterial).color.setHex(0xffe066);
      }
      member.beam.visible = wanted;
      if (wanted) {
        const surface = member.beam.material as T.MeshBasicMaterial;
        surface.opacity = .4 + (beat * .5 + .5) * .3;
        member.beam.rotation.y = now * 2;
      }
      // The bubble pulses in size while someone is looking for them
      const bubbleScale = wanted && !still ? 1.15 + beat * .12 : 1;
      member.tag.scale.set(1.7 * bubbleScale, .75 * bubbleScale, 1);
      member.tag.position.y = wanted ? 2.2 + (still ? 0 : Math.abs(Math.sin(now * 6)) * .12) : 2.15;
      member.tag.material.color.setHex(wanted && beat < 0 ? 0xfff0b0 : 0xffffff);
    });
  }

  function placeSnatcher(round: Round, now: number, dt: number) {
    const still = reducedMotion.matches;
    const chicken = round.npcs.find((npc): npc is Extract<Npc, { kind: "snatcher" }> => npc.kind === "snatcher");
    if (chicken && !bird.present) {
      bird.present = true;
      bird.since = now;
      bird.last = { ...chicken.point };
      bird.facing = chicken.facing;
      emit(puffs, { x: office.exit.x - .3, y: .8, z: office.exit.z }, 10, { colours: [0xfffdf8, 0xd9ccff], speed: 1.4, up: .8, gravity: 0, life: .7, size: 1 });
    } else if (!chicken && bird.present) {
      bird.present = false;
      bird.gone = now;
      emit(puffs, { x: bird.last.x, y: .8, z: bird.last.z }, 8, { colours: [0xfffdf8], speed: 1.2, up: .7, gravity: 0, life: .6, size: 1 });
    }
    let scale = 0;
    if (chicken) {
      bird.last = { ...chicken.point };
      scale = easeBack(Math.min(1, (now - bird.since) / .4));
    } else {
      scale = Math.max(0, 1 - (now - bird.gone) / .35);
    }
    bird.root.visible = scale > .01;
    if (!bird.root.visible) return;
    bird.root.position.set(bird.last.x, 0, bird.last.z);
    bird.root.scale.setScalar(1.15 * Math.max(.001, scale));
    if (chicken) {
      let turnBy = chicken.facing - bird.facing;
      turnBy = Math.atan2(Math.sin(turnBy), Math.cos(turnBy));
      bird.facing += turnBy * (1 - Math.exp(-dt * 12));
    }
    bird.root.rotation.y = bird.facing;
    const dazed = chicken?.state === "dazed";
    const moving = Boolean(chicken) && !dazed && round.phase === "playing";
    if (moving) bird.phase += dt * (chicken?.state === "flee" ? 15 : 11);
    const step = bird.phase;
    bird.body.position.y = moving && !still ? Math.abs(Math.sin(step)) * .08 : 0;
    bird.body.rotation.z = dazed && !still ? Math.sin(now * 14) * .25 : moving && !still ? Math.sin(step) * .14 : 0;
    bird.body.rotation.x = chicken?.state === "flee" ? .12 : 0;
    bird.legs.forEach((leg, side) => {
      leg.rotation.x = moving ? Math.sin(step + side * Math.PI) * .6 : 0;
    });
    bird.head.rotation.x = moving && !still ? Math.sin(step * 2) * .08 : 0;
    bird.stars.visible = dazed;
    if (dazed) bird.stars.rotation.y = now * 8;
    bird.root.updateMatrixWorld(true);
  }

  const highlightColour = new T.Color(0xfff2a0);
  function highlight(round: Round, now: number) {
    litCards.clear();
    litStaff.clear();
    wantedStaff.clear();
    slotLit.fill(0);
    litPads.fill(false);
    lit.tray = lit.desk = lit.shredder = false;
    if (round.phase === "playing") {
      round.players.forEach((player, index) => {
        const { position } = player;
        const card = heldCard(round, index);
        if (!card) {
          if (atTray(position) && round.cards.some(entry => entry.at.place === "tray")) lit.tray = true;
          round.cards.forEach(entry => {
            const at = entry.at;
            if (at.place === "counter" && Math.hypot(office.pass[at.pad].x - position.x, office.pass[at.pad].z - position.z) <= settings.reach) {
              litPads[at.pad] = true;
              litCards.add(entry.id);
            } else if (at.place === "floor" && Math.hypot(at.point.x - position.x, at.point.z - position.z) <= settings.reach) {
              litCards.add(entry.id);
            }
          });
          if (atBoard(position)) {
            const day = columnAt(position);
            [day, day + 7].forEach(slot => {
              if (cardIn(round, slot)?.kind === "cancelled") slotLit[slot] = 2;
            });
          }
          return;
        }
        const wanted = wantedBy(round, card);
        if (wanted) wantedStaff.add(wanted.id);
        if (card.kind === "request" && !card.approved && atDesk(position)) lit.desk = true;
        if (atShredder(position)) lit.shredder = true;
        if (card.kind === "open" && !card.approved) {
          const npc = staffInReach(round, position);
          if (npc) litStaff.add(npc.id);
        }
        if (card.approved && card.kind !== "cancelled") {
          [card.day, card.day + 7].forEach(slot => {
            if (round.needed[slot] && round.board[slot] === undefined && slotLit[slot] === 0) slotLit[slot] = 1;
          });
        }
        const free = office.pass.map((pad, i) => ({ i, d: Math.hypot(pad.x - position.x, pad.z - position.z) }))
          .filter(({ i, d }) => d <= settings.reach && !round.cards.some(entry => entry.at.place === "counter" && entry.at.pad === i))
          .sort((a, b) => a.d - b.d)[0];
        if (free) litPads[free.i] = true;
      });
    }
    const pulse = .28 + Math.sin(now * 7) * .12;
    const glow = (mesh: T.Mesh, on: boolean) => {
      const surface = mesh.material as T.MeshStandardMaterial;
      surface.emissive.copy(highlightColour);
      surface.emissiveIntensity = on ? pulse : 0;
    };
    glow(trayTop, lit.tray);
    glow(deskTop, lit.desk);
    glow(shredderBody, lit.shredder);
    pads.forEach((pad, i) => glow(pad, litPads[i]));
    slotGlows.forEach((mesh, slot) => {
      mesh.visible = slotLit[slot] !== 0;
      if (!mesh.visible) return;
      const surface = mesh.material as T.MeshBasicMaterial;
      surface.color.setHex(slotLit[slot] === 2 ? 0xff6b6b : 0xffd35c);
      surface.opacity = .55 + Math.sin(now * 8) * .25;
    });
  }

  // Puddles and banana peels on the floor (the floor tiles' tops are at y .04, the rug's at .08)
  const puddleSurface = new T.MeshStandardMaterial({ color: 0x5cb8ff, roughness: .05, metalness: .05, transparent: true, opacity: .82, depthWrite: false });
  const puddleRim = new T.MeshBasicMaterial({ color: 0x3a8fe0, transparent: true, opacity: .55, depthWrite: false, toneMapped: false });
  const puddleShine = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6, depthWrite: false, toneMapped: false });
  ownMaterials.push(puddleSurface, puddleRim, puddleShine);
  function flatDisc(parent: T.Object3D, surface: T.Material, x: number, z: number, size: number, y = .1) {
    const disc = new T.Mesh(parts.circle, surface);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, y, z);
    disc.scale.setScalar(size);
    disc.renderOrder = 1;
    parent.add(disc);
    return disc;
  }
  function makePuddle() {
    const group = new T.Group();
    // A blobby shape from overlapping discs, with a darker rim and a couple of glints
    const shape = [[0, 0, .95], [.5, .28, .6], [-.52, .26, .55], [.22, -.5, .52], [-.36, -.42, .48]] as const;
    shape.forEach(([x, z, size]) => flatDisc(group, puddleRim, x, z, size + .07, .095));
    const lobes = shape.map(([x, z, size]) => flatDisc(group, puddleSurface, x, z, size));
    flatDisc(group, puddleShine, -.22, -.18, .14, .105);
    flatDisc(group, puddleShine, .32, .12, .08, .105);
    scene.add(group);
    return { group, lobes };
  }
  function makePeel() {
    const group = new T.Group();
    for (let i = 0; i < 3; i++) {
      const flap = new T.Group();
      flap.rotation.y = i * 2.1 + .3;
      group.add(flap);
      const piece = parts.capsule(flap, 0xffd84d, 0, .05, .2, .075, .12, .035);
      piece.rotation.x = Math.PI / 2;
      ball(flap, 0x8a6a2b, 0, .06, .36, .03, .025, .03);
    }
    ball(group, 0xffe58a, 0, .1, 0, .13, .08, .13);
    ball(group, 0x6b4a2b, 0, .17, 0, .03, .045, .03);
    scene.add(group);
    return group;
  }
  // A trickle of water from the cooler to its puddle
  const trickle = new T.Group();
  scene.add(trickle);
  flatDisc(trickle, puddleSurface, 0, 0, 1, .098);
  trickle.visible = false;
  type HazardObject = { group: T.Group; lobes: T.Mesh[]; born: number };
  const hazardObjects = new Map<number, HazardObject>();
  let dripAt = 0;

  function placeHazards(round: Round, now: number) {
    const still = reducedMotion.matches;
    const present = new Set<number>();
    let puddle: Hazard | undefined;
    for (const hazard of round.hazards) {
      present.add(hazard.id);
      let entry = hazardObjects.get(hazard.id);
      if (!entry) {
        entry = hazard.kind === "puddle" ? { ...makePuddle(), born: now } : { group: makePeel(), lobes: [], born: now };
        hazardObjects.set(hazard.id, entry);
      }
      entry.group.position.set(hazard.point.x, 0, hazard.point.z);
      if (hazard.kind === "puddle") {
        puddle = hazard;
        // Grow and shrink across the floor only, so it never sinks into the tiles
        const radius = Math.max(.001, hazardRadius(round, hazard));
        entry.group.scale.set(radius, 1, radius);
        entry.lobes.forEach((lobe, i) => lobe.scale.setScalar((i ? .55 : .95) * (still ? 1 : 1 + Math.sin(now * 2.2 + i * 1.7) * .03)));
      } else {
        const pop = Math.min(1, (now - entry.born) / .35);
        entry.group.scale.setScalar(1.6 * Math.max(.001, easeBack(pop)));
      }
    }
    for (const [id, entry] of hazardObjects) {
      if (present.has(id)) continue;
      scene.remove(entry.group);
      hazardObjects.delete(id);
    }
    // The trickle runs from the cooler to the puddle while it's there; the cooler drips and wobbles while it spreads
    trickle.visible = Boolean(puddle);
    let leaking = false;
    if (puddle) {
      const from = { x: furniture.cooler.x + .2, z: furniture.cooler.z - .25 };
      const dx = puddle.point.x - from.x;
      const dz = puddle.point.z - from.z;
      const length = Math.hypot(dx, dz);
      const width = Math.max(.001, hazardRadius(round, puddle) / settings.puddleRadius) * .22;
      trickle.position.set((from.x + puddle.point.x) / 2, 0, (from.z + puddle.point.z) / 2);
      trickle.rotation.y = Math.atan2(dx, dz);
      trickle.scale.set(width, 1, length / 2);
      leaking = round.elapsed - puddle.born < settings.puddleGrow + 3;
      if (leaking && !still && now > dripAt) {
        dripAt = now + .12;
        emit(puffs, { x: furniture.cooler.x + .3, y: .35, z: furniture.cooler.z - .15 }, 1, { colours: [0x8fd6ff, 0xbfe8ff], speed: .3, up: .1, gravity: 0, life: .5, size: .6 });
      }
    }
    cooler.rotation.z = leaking && !still ? Math.sin(now * 28) * .02 : 0;
  }

  function placeWorld(round: Round, now: number, dt: number) {
    placeHazards(round, now);
    const still = reducedMotion.matches;
    highlight(round, now);
    placeSnatcher(round, now, dt);
    placeStaff(round, now, dt);
    placeBolts(round, now);
    placeCards(round, now, dt);

    // Ring ring
    const ringing = now < ringUntil && !still;
    handset.position.y = .16 + (ringing ? Math.abs(Math.sin(now * 30)) * .08 : 0);
    phone.rotation.z = ringing ? Math.sin(now * 40) * .08 : 0;

    // Shredder judder and the exit door swinging open for the Snatcher
    const shredding = now - shredShake;
    shredderGroup.position.x = furniture.shredder.x + (shredding < .4 && !still ? Math.sin(shredding * 60) * .025 : 0);
    const wantOpen = bird.present || now - doorKick < .7 ? 1.25 : .15;
    doorOpen += (wantOpen - doorOpen) * (1 - Math.exp(-dt * 8));
    leaf.rotation.y = doorOpen;
  }

  function animateCritters(round: Round, now: number, dt: number) {
    const still = reducedMotion.matches;
    critters.forEach((critter, i) => {
      const player = round.players[i];
      critter.root.visible = Boolean(player);
      tags[i].visible = Boolean(player);
      if (!player) {
        progress[i].group.visible = false;
        return;
      }
      const holding = heldCard(round, i);
      const { root, body, head, eyes, ears, arms, feet } = critter;
      root.position.set(player.position.x, 0, player.position.z);
      let turnBy = player.facing - critter.facing;
      turnBy = Math.atan2(Math.sin(turnBy), Math.cos(turnBy));
      critter.facing += turnBy * (1 - Math.exp(-dt * 16));
      root.rotation.y = critter.facing;

      const moving = player.moving && round.phase === "playing";
      const fallen = isFallen(round, i);
      if (moving) critter.phase += dt * 14;
      const step = critter.phase;
      const bob = fallen ? .16 : moving && !still ? Math.abs(Math.sin(step)) * .12 : 0;
      critter.squashSpeed += (-critter.squash * 160 - critter.squashSpeed * 11) * dt;
      critter.squash += critter.squashSpeed * dt;
      const squashBy = still ? 0 : T.MathUtils.clamp(critter.squash * .09, -.18, .22);
      const breathe = still ? 1 : 1 + Math.sin(now * 2.6 + i * 2) * .018;
      body.position.y = bob;
      body.scale.set(1 + squashBy * .6, breathe * (1 - squashBy), 1 + squashBy * .6);
      body.rotation.z = moving && !still ? Math.sin(step) * .11 : 0;
      body.rotation.x = T.MathUtils.lerp(body.rotation.x, fallen ? -1.35 : player.stamping ? .22 : moving ? .1 : 0, 1 - Math.exp(-dt * (fallen ? 16 : 10)));
      const stars = dizzy[i];
      stars.visible = fallen;
      if (fallen) {
        stars.position.set(player.position.x, 1.45, player.position.z);
        stars.rotation.y = now * 7;
      }
      head.rotation.x = player.stamping && !still ? Math.sin(now * 18) * .08 : 0;

      feet.forEach((foot, side) => {
        const swing = fallen && !still ? Math.sin(now * 20 + side * Math.PI) : moving ? Math.sin(step + side * Math.PI) : 0;
        foot.position.z = .1 + swing * .15;
        foot.position.y = .07 + Math.max(0, swing) * .07;
      });
      arms.forEach((arm, side) => {
        const sideSign = side ? 1 : -1;
        let raise = moving ? Math.sin(step + side * Math.PI) * .6 : Math.sin(now * 2 + side) * .06;
        if (holding) raise = -2.75 + Math.sin(now * 3) * .04;
        if (player.stamping) raise = -1.3 + Math.sin(now * 18 + side) * .45;
        if (fallen) raise = -2.4 + (still ? 0 : Math.sin(now * 16 + side * 2) * .5);
        arm.rotation.x = T.MathUtils.lerp(arm.rotation.x, raise, 1 - Math.exp(-dt * 18));
        arm.rotation.z = holding ? sideSign * -.25 : sideSign * .1;
      });
      ears.forEach((ear, side) => {
        ear.rotation.x = -bob * 1.4 - squashBy * 1.5;
        ear.rotation.z = (side ? -.16 : .16) + (moving ? Math.sin(step * .5) * .08 : 0);
      });
      if (now > critter.blinkAt + .13) critter.blinkAt = now + 2 + Math.random() * 3;
      const blinking = now >= critter.blinkAt;
      eyes.forEach(eye => eye.scale.y = blinking ? .12 : 1);

      critter.ring.scale.setScalar(1 + (moving ? 0 : Math.sin(now * 3 + i) * .04));
      tags[i].position.set(player.position.x, 2.25, player.position.z);

      if (isDashing(round, i) && !still) {
        emit(puffs, { x: player.position.x, y: .25, z: player.position.z }, 2, { colours: [0xffffff, 0xfff3e2], speed: .35, up: .2, gravity: 0, life: .35, size: 1.1 });
      }
      if (round.elapsed < player.boostUntil && !still && now > critter.boostAt && round.phase === "playing") {
        critter.boostAt = now + (moving ? .04 : .12);
        const back = critter.facing + Math.PI;
        trailAt.x = player.position.x + Math.sin(back) * .35 + (Math.random() - .5) * .3;
        trailAt.y = .25 + Math.random() * .7;
        trailAt.z = player.position.z + Math.cos(back) * .35 + (Math.random() - .5) * .3;
        emit(puffs, trailAt, 1, { colours: boltColours, speed: moving ? .2 : .5, up: .3, gravity: 0, life: .4, size: .75 });
      }
      if (moving && !still && now > critter.dustAt) {
        critter.dustAt = now + .16;
        emit(puffs, { x: player.position.x, y: .08, z: player.position.z }, 1, { colours: [0xfff3e2], speed: .25, up: .25, gravity: 0, life: .45, size: .7 });
      }

      const bar = progress[i];
      const amount = player.stamping && holding ? Math.min(1, holding.stamp / settings.stampTime) : 0;
      bar.group.visible = amount > 0;
      if (amount > 0) {
        // The fill grows from the left edge of the track
        bar.fill.scale.set(Math.max(.001, barWidth * amount), barHeight, 1);
        bar.fill.position.x = -barWidth / 2 + barWidth * amount / 2;
        bar.group.position.set(player.position.x, 3.7, player.position.z);
        bar.group.quaternion.copy(camera.quaternion);
      }
    });
  }

  function render() {
    renderer.render(scene, camera);
  }

  function draw(round: Round, focus: number | null = null) {
    const time = performance.now();
    const now = (time - clockStart) / 1000;
    const elapsed = Math.max(0, (time - lastTime) / 1000);
    const dt = Math.min(.05, elapsed);
    lastTime = time;
    if (quality === "high" && requested !== "high" && now > 1.5 && !document.hidden) {
      frameTimes.push(elapsed);
      const sampled = frameTimes.reduce((sum, value) => sum + value, 0);
      if (frameTimes.length >= 60 || (frameTimes.length >= 6 && sampled > 1.5)) {
        const sorted = [...frameTimes].sort((a, b) => a - b);
        if (sorted[Math.floor(sorted.length / 2)] > 1 / 40) lowerQuality();
        frameTimes.length = 0;
      }
    }
    const still = reducedMotion.matches;
    track(round, now);
    animateCritters(round, now, dt);
    placeWorld(round, now, dt);

    const anyStamping = round.players.some(player => player.stamping);
    stampSlam = Math.max(0, stampSlam - dt * 4);
    stamp.position.y = 1.25 - (anyStamping && !still ? Math.abs(Math.sin(now * 9)) * .2 : 0) - stampSlam * .27;

    const left = settings.duration - round.elapsed;
    hand.rotation.z = -(round.elapsed / settings.duration) * Math.PI * 2;
    (clockRim.material as T.MeshStandardMaterial).color.setHex(round.phase === "playing" && left <= 10 && Math.sin(now * 10) > 0 ? 0xff3355 : 0xff7a8a);

    const twinkle = round.stage !== "calm" && round.phase === "playing" ? 6 : 1.6;
    for (let i = 0; i < bulbCount; i++) {
      const level = .75 + Math.sin(now * twinkle + i * 1.7) * .25;
      tint.setHex(bulbColours[i % bulbColours.length]).multiplyScalar(level);
      bulbs.setColorAt(i, tint);
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;

    popups.forEach(item => {
      if (!item.sprite.visible) return;
      item.age += dt;
      const t = item.age / 1.3;
      if (t >= 1) {
        item.sprite.visible = false;
        return;
      }
      const grow = easeBack(Math.min(1, t * 4));
      item.sprite.position.set(item.x, item.y + t * .7, item.z);
      item.sprite.scale.set(2.3 * item.size * grow, .72 * item.size * grow, 1);
      item.sprite.material.opacity = t > .75 ? 1 - (t - .75) / .25 : 1;
    });
    updatePool(confetti, dt, false);
    updatePool(puffs, dt, true);

    markers.forEach((marker, i) => {
      marker.visible = focus === i && round.phase === "playing" && Boolean(round.players[i]);
      if (!marker.visible) return;
      const player = round.players[i];
      const lift = still ? 0 : Math.abs(Math.sin(now * 5)) * .18;
      marker.position.set(player.position.x, (heldCard(round, i) ? 4.6 : 2.9) + lift, player.position.z);
    });

    const follow = T.MathUtils.clamp((round.players[focus ?? 0] ?? round.players[0]).position.x, -maxPan, maxPan);
    pan += (follow - pan) * (1 - Math.exp(-dt * 4));
    camera.position.copy(basePosition);
    camera.position.x += pan;
    if (shake > 0 && !still) {
      camera.position.x += (Math.random() - .5) * shake;
      camera.position.y += (Math.random() - .5) * shake;
    }
    shake = Math.max(0, shake - dt * .9);
    render();
  }

  const observer = new ResizeObserver(size);
  observer.observe(host);
  if (quality === "low") lowerQuality();
  else size();

  return {
    draw,
    /** Keep the room clear of page overlays: pixels covered at the top and bottom of the canvas. */
    setInsets(top: number, bottom: number) {
      if (Math.abs(top - insetTop) < 1 && Math.abs(bottom - insetBottom) < 1) return;
      insetTop = Math.max(0, top);
      insetBottom = Math.max(0, bottom);
      size();
    },
    /** Turns screen-relative input (right, down) into a world direction for the current camera. */
    toWorld(right: number, down: number): [number, number] {
      const up = -down;
      return [right * Math.cos(yaw) - up * Math.sin(yaw), -right * Math.sin(yaw) - up * Math.cos(yaw)];
    },
    dispose() {
      observer.disconnect();
      const usedGeometries = new Set<T.BufferGeometry>(geometries);
      const usedMaterials = new Set<T.Material>(ownMaterials);
      scene.traverse(object => {
        const mesh = object as T.Mesh;
        if (!mesh.geometry) return;
        usedGeometries.add(mesh.geometry);
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(entry => usedMaterials.add(entry));
      });
      usedGeometries.forEach(entry => entry.dispose());
      usedMaterials.forEach(entry => entry.dispose());
      textures.forEach(entry => entry.dispose());
      parts.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function easeBack(t: number) {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
