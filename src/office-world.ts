import * as T from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  canWork, columnX, furniture, nearStation, office, roleOf, roster, sampleTeam, settings, shifts, stageAt,
  type Point, type Role, type Round, type Staff,
} from "./round";

const sampleWeek = sampleTeam.week;
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
];
const boardY = 1.72;
const boardZ = -5.36;
const boardWidth = 15.4;
const boardHeight = 1.95;
const font = (weight: number, size: number) =>
  `${weight} ${size}px ui-rounded, "SF Pro Rounded", Nunito, "Avenir Next", system-ui, sans-serif`;

type Kind = "duck" | "bunny";
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
    eye.position.set(side * .135, .045, .3);
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
  } else {
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
    facing: 0, phase: 0, squash: 0, squashSpeed: 0, blinkAt: 1 + Math.random() * 3, dustAt: 0,
  };
}

// The Shift Snatcher: an Australian white ibis ("bin chicken") with a bald black head and a long curved beak.
function makeSnatcher(parts: Parts) {
  const { ball, capsule } = parts;
  const feathers = 0xf6f3ec;
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  const shadow = new T.Mesh(parts.circle, parts.shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .035;
  shadow.scale.setScalar(.5);
  root.add(shadow);

  ball(body, feathers, 0, .66, 0, .32, .28, .44);
  ball(body, colours.black, 0, .66, -.42, .2, .13, .2);
  const neck = capsule(body, feathers, 0, .98, .26, .075, .2, .075);
  neck.rotation.x = .35;
  const head = new T.Group();
  head.position.set(0, 1.22, .34);
  body.add(head);
  ball(head, colours.black, 0, 0, 0, .13, .13, .15);
  for (const side of [-1, 1]) {
    ball(head, colours.white, side * .08, .03, .08, .035, .035, .02, false, .25);
    ball(head, colours.black, side * .085, .03, .095, .018, .018, .01, false, .2);
  }
  // The long beak curves down from the face
  const beak = new T.Group();
  beak.position.set(0, -.02, .12);
  beak.rotation.x = 1.25;
  head.add(beak);
  capsule(beak, colours.black, 0, .14, 0, .03, .2, .03);
  const tip = capsule(beak, colours.black, 0, .34, -.03, .025, .1, .025);
  tip.rotation.x = -.5;
  const legs = [-1, 1].map(side => {
    const leg = new T.Group();
    leg.position.set(side * .1, .42, 0);
    body.add(leg);
    capsule(leg, colours.black, 0, -.2, 0, .028, .2, .028);
    ball(leg, colours.black, 0, -.4, .06, .06, .02, .1);
    return leg;
  });
  return { root, body, head, legs, facing: 0, step: 0 };
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
  renderer.domElement.setAttribute("aria-label", "3D office with a request inbox, manager’s desk, pass counter and roster board");
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
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 2, far: 40 });
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

  // Floor: a chunky island with soft checker tiles
  rbox(scene, colours.baseShade, 0, -.62, 0, 20.5, .5, 12.2, .22).castShadow = false;
  rbox(scene, colours.base, 0, -.26, 0, 20.3, .46, 12, .2).castShadow = false;
  const tileGeometry = new RoundedBoxGeometry(.96, .12, .96, 2, .045);
  geometries.push(tileGeometry);
  const tileMaterial = new T.MeshStandardMaterial({ roughness: .86 });
  ownMaterials.push(tileMaterial);
  const tiles = new T.InstancedMesh(tileGeometry, tileMaterial, 19 * 11);
  tiles.receiveShadow = true;
  const matrix = new T.Matrix4();
  const tint = new T.Color();
  for (let row = 0, i = 0; row < 11; row++) {
    for (let col = 0; col < 19; col++, i++) {
      const back = row < 5;
      const set = back ? colours.tileBack : colours.tileFront;
      tiles.setMatrixAt(i, matrix.makeTranslation(col - 9, -.02, row - 5));
      tiles.setColorAt(i, tint.setHex(set[(row + col) % 2]));
    }
  }
  scene.add(tiles);
  const rug = rbox(scene, colours.rug, -3.5, .045, 3.35, 9.4, .04, 2.5, .02);
  rug.castShadow = false;
  rbox(scene, 0xffe1e7, -3.5, .07, 3.35, 9, .02, 2.1, .01).castShadow = false;

  // Walls
  rbox(scene, colours.wallLow, 0, .55, -5.74, 20.3, 1.1, .36, .1);
  rbox(scene, colours.wallHigh, 0, 2.05, -5.8, 20.3, 1.95, .26, .1);
  rbox(scene, colours.trim, 0, 3.06, -5.72, 20.5, .16, .46, .06);
  rbox(scene, colours.trim, 0, 1.13, -5.55, 20.3, .08, .1, .03);
  for (const x of [-10.02, 10.02]) {
    rbox(scene, colours.wallLow, x, .48, -.12, .36, .96, 11.6, .12);
    rbox(scene, colours.trim, x, .98, -.12, .5, .1, 11.7, .04);
  }

  // Roster board
  rbox(scene, colours.frame, 0, boardY, boardZ - .04, boardWidth + .36, boardHeight + .36, .16, .1);
  const slotOf = (index: number) => ({
    x: columnX(index % 7),
    y: boardY + (index < 7 ? .22 : -.5),
  });
  // The cork is painted once; the shift outlines are repainted when a round brings a different week
  const cork = document.createElement("canvas");
  cork.width = 2048;
  cork.height = 260;
  {
    const pen = cork.getContext("2d")!;
    pen.fillStyle = colours.cork;
    pen.fillRect(0, 0, 2048, 260);
    for (let i = 0; i < 2600; i++) {
      pen.fillStyle = i % 3 ? "rgba(150,90,40,.16)" : "rgba(255,240,210,.22)";
      pen.fillRect(Math.random() * 2048, Math.random() * 260, 3, 3);
    }
  }
  const boardTexture = paint(2048, 260, () => {});
  const boardCanvas = boardTexture.image as HTMLCanvasElement;
  let paintedWeek = "";

  function paintBoard(week: (Role | null)[]) {
    const key = week.join(",");
    if (key === paintedWeek) return;
    paintedWeek = key;
    const pen = boardCanvas.getContext("2d")!;
    const sx = 2048 / boardWidth;
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
    week.forEach((role, i) => {
      const { x, y } = slotOf(i);
      const colour = role ? roleOf(role).colour : "#9b8b7a";
      pen.fillStyle = role ? `${colour}40` : "rgba(107,63,31,.12)";
      pen.beginPath();
      pen.roundRect(px(x - .47), py(y + .3), .94 * sx, .6 * sy, 12);
      pen.fill();
      if (role) {
        pen.setLineDash([12, 9]);
        pen.lineWidth = 6;
        pen.strokeStyle = colour;
        pen.stroke();
        pen.setLineDash([]);
      }
      pen.fillStyle = colour;
      pen.font = font(900, 24);
      pen.fillText(role ? roleOf(role).label.toUpperCase() : "CLOSED", px(x), py(y));
      (slotGlows[i].material as T.MeshBasicMaterial).color.set(colour);
    });
    pen.font = font(900, 30);
    pen.fillStyle = "#6b3f1f";
    pen.fillText("AM", px(-7.15), py(boardY + .22));
    pen.fillText("PM", px(-7.15), py(boardY - .5));
    boardTexture.needsUpdate = true;
  }
  face(scene, boardTexture, 0, boardY, boardZ + .05, boardWidth, boardHeight);
  const slotGlowGeometry = new RoundedBoxGeometry(1.08, .74, .02, 2, .08);
  geometries.push(slotGlowGeometry);
  // Open shifts glow in their role colour while someone carries a signed-on person who can take them
  const slotGlows = shifts.map((_, index) => {
    const surface = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, toneMapped: false });
    ownMaterials.push(surface);
    const mesh = new T.Mesh(slotGlowGeometry, surface);
    const { x, y } = slotOf(index);
    mesh.position.set(x, y, boardZ + .085);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  paintBoard(sampleWeek);

  // Wall clock that follows the round timer, and a poster
  const clock = new T.Group();
  clock.position.set(8.92, 1.95, boardZ + .02);
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
  poster.position.set(-8.9, 1.95, boardZ + .02);
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
  const lightCurve = new T.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const x = -9.9 + i * 2.475;
    return new T.Vector3(x, 2.92 - (i % 2 ? .28 : 0), -5.6);
  }));
  const wire = new T.TubeGeometry(lightCurve, 120, .015, 5, false);
  geometries.push(wire);
  scene.add(new T.Mesh(wire, parts.material(colours.black)));
  const bulbColours = [0xffd35c, 0xff8fb0, 0x8fe3c1, 0x9ac8ff];
  const bulbGeometry = new T.SphereGeometry(.075, 12, 8);
  geometries.push(bulbGeometry);
  const bulbMaterial = new T.MeshBasicMaterial({ toneMapped: false });
  ownMaterials.push(bulbMaterial);
  const bulbCount = 26;
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
  const passSign = new T.Group();
  passSign.position.set(3.45, 1.0, 0);
  scene.add(passSign);
  cylinder(passSign, colours.black, 0, .22, 0, .03, .44);
  face(passSign, sign("PASS", "#fff27a"), 0, .62, .03, 1.15, .36);
  rbox(passSign, colours.black, 0, .62, 0, 1.2, .4, .04, .04);

  // Request inbox
  const inbox = new T.Group();
  inbox.position.set(office.tray.x, 0, office.tray.z);
  scene.add(inbox);
  for (const x of [-1.45, 1.45]) for (const z of [-.55, .55]) cylinder(inbox, colours.trayLeg, x, .34, z, .08, .68);
  const trayTop = rbox(inbox, colours.tray, 0, .74, 0, furniture.inbox.w, .14, furniture.inbox.d, .07, true);
  for (const [x, z, w, d] of [[0, .7, 3.2, .08], [0, -.7, 3.2, .08], [1.6, 0, .08, 1.4], [-1.6, 0, .08, 1.4]]) {
    rbox(inbox, 0x8db3f5, x, .87, z, w, .16, d, .035);
  }
  cylinder(inbox, colours.black, -1.2, 1.1, -.62, .03, .6);
  rbox(inbox, colours.black, -1.2, 1.55, -.64, 1.2, .4, .04, .04);
  face(inbox, sign("NEW STAFF", "#bfe0ff"), -1.2, 1.55, -.615, 1.15, .36);

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
  rbox(desk, colours.white, -1.0, .97, .4, .74, .16, .05, .03);
  face(desk, sign("MANAGER", "#fffdf8"), -1.0, .97, .43, .7, .2);
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
  const cabinet = new T.Group();
  cabinet.position.set(furniture.cabinet.x, 0, furniture.cabinet.z);
  scene.add(cabinet);
  rbox(cabinet, 0xb6a3e8, 0, .6, 0, .7, 1.2, .8, .08);
  for (const y of [.3, .65, 1.0]) rbox(cabinet, 0xd2c5f5, -.36, y, 0, .04, .26, .6, .02).castShadow = false;

  // A coffee corner, a printer and a beanbag
  const coffee = new T.Group();
  coffee.position.set(furniture.coffee.x, 0, furniture.coffee.z);
  scene.add(coffee);
  rbox(coffee, 0xf6c995, 0, .45, 0, .7, .9, 1.3, .08);
  rbox(coffee, colours.ink, 0, 1.12, -.2, .5, .45, .45, .08);
  rbox(coffee, 0x8fe3c1, -.26, 1.16, -.2, .02, .12, .2, .01).castShadow = false;
  ball(coffee, colours.stampRed, -.27, 1.26, -.05, .03, .03, .02, false);
  for (const [z, colour] of [[.25, colours.white], [.45, 0xff9fb4]] as const) cylinder(coffee, colour, 0, 1.0, z, .08, .16);
  const printer = new T.Group();
  printer.position.set(furniture.printer.x, 0, furniture.printer.z);
  scene.add(printer);
  rbox(printer, 0xe9eef7, 0, .4, 0, .75, .8, .9, .08);
  rbox(printer, 0xd0d8e8, 0, .86, 0, .7, .14, .8, .06);
  rbox(printer, colours.white, .2, .95, 0, .3, .04, .5, .01).castShadow = false;
  ball(printer, 0x5fe39a, -.39, .7, .3, .035, .035, .02, false);
  const { beanbag, lamp: lampSpot } = furniture;
  ball(scene, 0xff9fb4, beanbag.x, .32, beanbag.z, .62, .34, .58);
  ball(scene, 0xffb8c8, beanbag.x, .52, beanbag.z - .2, .4, .2, .3);
  const floorLamp = new T.Group();
  floorLamp.position.set(lampSpot.x, 0, lampSpot.z);
  scene.add(floorLamp);
  cylinder(floorLamp, colours.ink, 0, .04, 0, .25, .08);
  cylinder(floorLamp, colours.ink, 0, .8, 0, .03, 1.5);
  cylinder(floorLamp, 0xfff1b0, 0, 1.62, 0, .3, .32);
  parts.add(floorLamp, new T.Mesh(parts.sphere, bulbGlow), 0, 1.5, 0, .1, .1, .1, false);

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

  // Rostered people show as name badges on the board
  const cardBody = new RoundedBoxGeometry(.95, .62, .05, 2, .035);
  const cardFace = new T.PlaneGeometry(.9, .57);
  geometries.push(cardBody, cardFace);
  const cardPaper = parts.material(colours.white, .8);
  const badgeTextures = new Map<string, T.Texture>();

  function badgeTexture(person: Staff) {
    const key = `${person.name}|${person.role}`;
    const cached = badgeTextures.get(key);
    if (cached) return cached;
    const { colour, label } = roleOf(person.role);
    const texture = paint(256, 162, pen => {
      pen.fillStyle = "#fffdf8";
      pen.beginPath();
      pen.roundRect(0, 0, 256, 162, 18);
      pen.fill();
      pen.fillStyle = colour;
      pen.beginPath();
      pen.roundRect(0, 0, 256, 40, [18, 18, 0, 0]);
      pen.fill();
      pen.fillStyle = "#ffffff";
      pen.font = font(900, 24);
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText(label.toUpperCase(), 128, 21);
      pen.fillStyle = "#24324a";
      pen.font = font(900, 62);
      pen.fillText(person.name, 128, 104, 230);
    });
    badgeTextures.set(key, texture);
    return texture;
  }

  const badges = shifts.map((_, slot) => {
    const group = new T.Group();
    group.visible = false;
    const inner = new T.Group();
    group.add(inner);
    const bodyMesh = new T.Mesh(cardBody, cardPaper);
    bodyMesh.castShadow = true;
    inner.add(bodyMesh);
    const surface = new T.MeshStandardMaterial({ roughness: .75 });
    ownMaterials.push(surface);
    const front = new T.Mesh(cardFace, surface);
    front.position.z = .027;
    inner.add(front);
    ball(inner, colours.stampRed, 0, .25, .06, .055, .055, .055, false, .3);
    scene.add(group);
    const { x, y } = slotOf(slot);
    group.position.set(x, y, boardZ + .16);
    group.rotation.z = ((slot * 37 % 11) / 11 - .5) * .12;
    return { group, inner, surface, person: -1, popped: -10, falling: -10, home: new T.Vector3(x, y, boardZ + .16) };
  });

  // Staff are small critters in a hat of their role colour, with a name tag
  const cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 24);
  geometries.push(cylinderGeometry);
  const skinTones = [0xffc8a8, 0xb8e1ff, 0xd7f5b0, 0xffe39a, 0xf2c4ff, 0xc9f1ec, 0xffd0e0, 0xe8d5ff];
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
    // A cap in the role colour that leaves the face visible from above
    const crown = parts.add(head, new T.Mesh(parts.sphere, hat), 0, .17, -.07, .33, .2, .31);
    const brim = parts.add(head, new T.Mesh(cylinderGeometry, hat), 0, .15, .2, .2, .025, .15);
    crown.castShadow = brim.castShadow = true;
    const feet = [-1, 1].map(side => ball(body, 0x7a6a8c, side * .14, .06, .08, .1, .055, .14));
    const tagSurface = new T.SpriteMaterial({ depthTest: false, depthWrite: false });
    ownMaterials.push(tagSurface);
    const tag = new T.Sprite(tagSurface);
    tag.renderOrder = 5;
    tag.scale.set(1.15, .54, 1);
    tag.position.y = 1.85;
    root.add(tag);
    root.scale.setScalar(.8);
    root.visible = false;
    scene.add(root);
    return { root, body, head, feet, skin, hat, tag, key: "", born: 0, popped: -10, facing: 0 };
  }
  const crew: ReturnType<typeof makeCrew>[] = [];
  const tagTextures = new Map<string, T.Texture>();

  // Name tag: name (with a tick once signed on), the days they can work and the shifts they have left
  function tagTexture(person: Staff) {
    const key = `${person.name}|${person.role}|${person.approved}|${person.days}|${person.off}|${person.worked}/${person.shifts}`;
    const cached = tagTextures.get(key);
    if (cached) return cached;
    const texture = paint(280, 132, pen => {
      pen.fillStyle = roleOf(person.role).colour;
      pen.beginPath();
      pen.roundRect(4, 4, 272, 124, 34);
      pen.fill();
      pen.fillStyle = "#ffffff";
      pen.font = font(900, 44);
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText(person.approved ? `${person.name} ✓` : person.name, 140, 42, 250);
      pen.font = font(900, 24);
      "MTWTFSS".split("").forEach((letter, day) => {
        const x = 26 + day * 26;
        const free = person.days[day] && !person.off[day];
        pen.fillStyle = free ? "#ffffff" : "rgba(255,255,255,.3)";
        pen.fillText(letter, x, 96);
        if (person.off[day]) {
          pen.strokeStyle = "#ffffff";
          pen.lineWidth = 3;
          pen.beginPath();
          pen.moveTo(x - 9, 105);
          pen.lineTo(x + 9, 87);
          pen.stroke();
        }
      });
      for (let i = 0; i < Math.min(5, person.shifts); i++) {
        pen.beginPath();
        pen.arc(206 + i * 15, 96, 6, 0, Math.PI * 2);
        pen.fillStyle = i < person.shifts - person.worked ? "#ffffff" : "rgba(255,255,255,.3)";
        pen.fill();
      }
    });
    tagTextures.set(key, texture);
    return texture;
  }

  function crewFor(person: Staff) {
    while (crew.length <= person.id) crew.push(makeCrew());
    const member = crew[person.id];
    const key = `${person.name}|${person.role}`;
    if (member.key !== key) {
      member.key = key;
      member.skin.color.setHex(skinTones[(person.name.charCodeAt(0) + person.name.length) % skinTones.length]);
      member.hat.color.set(roleOf(person.role).colour);
    }
    const map = tagTexture(person);
    if (member.tag.material.map !== map) {
      member.tag.material.map = map;
      member.tag.material.needsUpdate = true;
    }
    return member;
  }

  // Players
  const critters: Critter[] = [makeCritter("duck", playerColours[0], parts), makeCritter("bunny", playerColours[1], parts)];
  critters.forEach(critter => {
    critter.root.scale.setScalar(1.35);
    scene.add(critter.root);
  });
  const snatcher = makeSnatcher(parts);
  snatcher.root.scale.setScalar(1.3);
  snatcher.root.visible = false;
  scene.add(snatcher.root);
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

  // Stamp progress rings
  const ringSteps = Array.from({ length: 25 }, (_, step) => {
    const geometry = new T.RingGeometry(.2, .3, 40, 1, Math.PI / 2, Math.max(.001, step / 24) * Math.PI * 2);
    geometries.push(geometry);
    return geometry;
  });
  const ringTrackGeometry = new T.RingGeometry(.2, .3, 40);
  geometries.push(ringTrackGeometry);
  const ringTrack = new T.MeshBasicMaterial({ color: 0x2a2433, transparent: true, opacity: .35, depthTest: false, side: T.DoubleSide });
  const ringFill = new T.MeshBasicMaterial({ color: 0x5fe39a, depthTest: false, toneMapped: false, side: T.DoubleSide });
  ownMaterials.push(ringTrack, ringFill);
  const progress = critters.map(() => {
    const group = new T.Group();
    const track = new T.Mesh(ringTrackGeometry, ringTrack);
    const fill = new T.Mesh(ringSteps[0], ringFill);
    track.renderOrder = fill.renderOrder = 6;
    group.add(track, fill);
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
    approve: sign("Signed on!", "#5fe39a"),
    pin: sign("Rostered!", "#ffd35c"),
    sick: sign("Sick call!", "#ff8fb0"),
    busy: sign("Getting busy!", "#ffb35c"),
    chaos: sign("Chaos!", "#ff8fb0"),
    chicken: sign("Bin chicken!", "#fff6e6"),
    snatched: sign("Snatched!", "#ff8fb0"),
    shooed: sign("Shooed!", "#5fe39a"),
    saved: sign("Saved!", "#5fe39a"),
    escaped: sign("Got away!", "#ff8fb0"),
    win: sign("Week covered!", "#ffd35c"),
    lose: sign("Time’s up!", "#ff8fb0"),
  };
  const popups = Array.from({ length: 4 }, () => {
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

  // Camera
  const camera = new T.PerspectiveCamera(30, 1, .5, 140);
  const focus = new T.Vector3(0, .5, .1);
  const corners = [-10.3, 10.3].flatMap(x => [
    new T.Vector3(x, -.5, 6.1), new T.Vector3(x, -.5, -6), new T.Vector3(x, 3.15, -5.9),
  ]);
  const ndc = new T.Vector3();
  const yaw = 0;
  let shake = 0;
  let pan = 0;
  let maxPan = 0;
  const basePosition = new T.Vector3();

  // Landscape screens see the whole office. Tall screens fit its depth and follow player 1 sideways.
  function frame(width: number, height: number) {
    const aspect = width / height;
    const tall = aspect < .95;
    camera.aspect = aspect;
    camera.fov = tall ? 36 : 30;
    camera.updateProjectionMatrix();
    const pitch = tall ? 1.08 : .9;
    const direction = new T.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const bottom = touch && tall ? -.6 : touch ? -.9 : -.95;
    const span = tall ? Math.max(4.2, 10.3 * aspect * .95) : Infinity;
    const fits = (distance: number) => {
      camera.position.copy(focus).addScaledVector(direction, distance);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      return corners.every(point => {
        ndc.set(Math.max(-span, Math.min(span, point.x)), point.y, point.z).project(camera);
        return Math.abs(ndc.x) <= .97 && ndc.y <= .95 && ndc.y >= bottom;
      });
    };
    let near = 8;
    let far = 120;
    for (let i = 0; i < 24; i++) {
      const middle = (near + far) / 2;
      if (fits(middle)) far = middle;
      else near = middle;
    }
    // Centre the room vertically within the allowed band
    fits(far);
    let top = -Infinity;
    let low = Infinity;
    corners.forEach(point => {
      ndc.copy(point).project(camera);
      top = Math.max(top, ndc.y);
      low = Math.min(low, ndc.y);
    });
    const lift = ((top + low) / 2 - (.95 + bottom) / 2) * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * far;
    const cameraUp = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(cameraUp, lift);
    camera.lookAt(focus.clone().addScaledVector(cameraUp, lift));
    basePosition.copy(camera.position);
    const halfView = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * aspect * far;
    maxPan = tall ? Math.max(0, 10.4 - halfView * .92) : 0;
  }

  function size() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    frame(width, height);
    render();
  }

  // Game state tracking for events
  const clockStart = performance.now();
  let lastTime = clockStart;
  let tracked: Round | undefined;
  let seen: { place: string; approved: boolean; holder: number }[] = [];
  let lastPhase: Round["phase"] = "ready";
  // Which stage of settings.pace the round is in, the last second the clock ticked, and refusals seen per player
  let stage = 0;
  let lastTick = 0;
  let seenRefused: number[] = [];
  let seenChicken: { mode: Round["snatcher"]["mode"]; carrying?: number } = { mode: "away" };
  let stampSlam = 0;
  const target = new T.Vector3();

  function near(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.z - b.z) <= settings.reach;
  }

  function squash(index: number, amount: number) {
    if (index >= 0) critters[index].squashSpeed = amount;
  }

  const snapshotOf = (person: Staff) => ({
    place: person.at.place,
    approved: person.approved,
    holder: person.at.place === "hand" ? person.at.player : -1,
  });
  let seenBoard: (number | undefined)[] = [];
  const visibleSpots = ["tray", "hand", "counter", "floor"];

  function track(round: Round, now: number) {
    if (round !== tracked) {
      tracked = round;
      paintBoard(round.week);
      seen = round.staff.map(snapshotOf);
      seenBoard = [...round.board];
      crew.forEach(member => (member.root.visible = false));
      round.staff.forEach((person, i) => {
        const member = crewFor(person);
        member.born = now + i * .09;
        member.root.userData.snap = true;
      });
      badges.forEach(badge => {
        badge.person = -1;
        badge.falling = -10;
      });
      lastPhase = round.phase;
      stage = stageAt(round.elapsed);
      lastTick = 0;
      seenRefused = round.players.map(player => player.refused);
      seenChicken = { mode: round.snatcher.mode, carrying: round.snatcher.carrying };
      return;
    }

    // Shifts filled or emptied since the last frame
    round.board.forEach((id, slot) => {
      const before = seenBoard[slot];
      if (id === before) return;
      const spot = slotOf(slot);
      if (id !== undefined) {
        emit(confetti, { x: spot.x, y: spot.y, z: boardZ + .3 }, 26, { colours: confettiColours, speed: 2.4, up: 3.2, gravity: 7, life: 1.2, size: 1 });
        popup("pin", spot.x, spot.y + .9, boardZ + .5, .9);
        shake = Math.max(shake, .12);
        badges[slot].popped = now;
        sound?.play("pin");
      } else if (before !== undefined && round.staff[before].at.place === "snatched") {
        // The bin chicken pulled them off the board
        emit(puffs, { x: spot.x, y: spot.y, z: boardZ + .3 }, 10, { colours: [0xfff6e6, 0x2a2433], speed: 1.4, up: .8, gravity: 0, life: .7, size: .9 });
        popup("snatched", spot.x, spot.y + .9, boardZ + .5, 1);
        crewFor(round.staff[before]).root.userData.snap = true;
        shake = Math.max(shake, .14);
        sound?.play("squawk");
      } else {
        badges[slot].falling = now;
        emit(puffs, { x: spot.x, y: spot.y, z: boardZ + .3 }, 8, { colours: [0xff8fb0, 0xfff6e6], speed: 1.2, up: .8, gravity: 0, life: .7, size: .9 });
        popup("sick", spot.x, spot.y + .9, boardZ + .5, 1);
        ringUntil = now + 1.6;
        shake = Math.max(shake, .1);
        sound?.play("sick");
      }
    });
    seenBoard = [...round.board];

    round.staff.forEach((person, i) => {
      const before = seen[i];
      const current = snapshotOf(person);
      if (before.place !== current.place) {
        const wasHere = visibleSpots.includes(before.place);
        if (current.place === "tray" && !wasHere) {
          // Arriving from home
          const member = crewFor(person);
          member.born = now;
          member.root.userData.snap = true;
          sound?.play("spawn");
        } else if (current.place === "hand") {
          squash(current.holder, 5);
          sound?.play("pick");
        } else if (before.place === "hand" && !visibleSpots.includes(current.place)) {
          // Rostered and heading home: the board change above already celebrated it
          squash(before.holder, 6);
        } else if (visibleSpots.includes(current.place)) {
          squash(before.holder, 4);
          const at = person.at.place === "counter" ? office.pass[person.at.pad] : person.at.place === "floor" ? person.at.point : office.tray;
          emit(puffs, { x: at.x, y: person.at.place === "counter" ? 1.05 : .1, z: at.z }, 5, { colours: [0xfff6e6], speed: .9, up: .5, gravity: 0, life: .5, size: .9 });
          sound?.play("put");
        } else if (wasHere) {
          // Nothing left for them to do, so they head home
          const member = crewFor(person);
          emit(puffs, member.root.position, 6, { colours: [0xfff6e6], speed: .8, up: .6, gravity: 0, life: .5, size: .8 });
        }
      }
      if (!before.approved && current.approved) {
        squash(current.holder, 7);
        stampSlam = 1;
        const at = { x: office.desk.x + .25, y: 1.1, z: office.desk.z + .1 };
        emit(puffs, at, 10, { colours: [0xf0595f, 0xff8fa0], speed: 1.6, up: 1.2, gravity: 0, life: .6, size: .8 });
        emit(confetti, at, 12, { colours: [0x5fe39a, 0xffffff, 0xffd35c], speed: 1.8, up: 3, gravity: 8, life: .9, size: .8 });
        popup("approve", office.desk.x + .3, 3.0, office.desk.z, .95);
        crewFor(person).popped = now;
        shake = Math.max(shake, .08);
        sound?.play("approve");
      }
      seen[i] = current;
    });
    round.players.forEach((player, i) => {
      if (player.refused === seenRefused[i]) return;
      seenRefused[i] = player.refused;
      squash(i, 3);
      sound?.play("nope");
    });
    // The bin chicken arriving, being scared off, dropping someone or escaping
    const chicken = round.snatcher;
    const where = chicken.position;
    if (seenChicken.mode === "away" && chicken.mode === "sneaking") {
      popup("chicken", Math.max(-7, Math.min(7, where.x)), 2.8, where.z, 1.1);
      sound?.play("squawk");
    } else if (seenChicken.mode !== "away" && seenChicken.mode !== "fleeing" && chicken.mode === "fleeing" && chicken.carrying === undefined) {
      popup("shooed", where.x, 2.6, where.z, 1);
      emit(puffs, { x: where.x, y: .6, z: where.z }, 10, { colours: [0xfff6e6], speed: 1.6, up: 1, gravity: 0, life: .6, size: .9 });
      sound?.play("rescue");
    }
    if (seenChicken.carrying !== undefined && chicken.carrying === undefined) {
      if (chicken.mode === "fleeing") {
        popup("saved", where.x, 2.6, where.z, 1);
        emit(confetti, { x: where.x, y: 1.4, z: where.z }, 14, { colours: confettiColours, speed: 2, up: 3, gravity: 7, life: 1, size: .9 });
        shake = Math.max(shake, .1);
        sound?.play("rescue");
      } else {
        popup("escaped", Math.sign(where.x) * 7, 2.8, where.z, 1.1);
        sound?.play("escape");
      }
    }
    seenChicken = { mode: chicken.mode, carrying: chicken.carrying };

    const reached = stageAt(round.elapsed);
    if (round.phase === "playing" && reached !== stage) {
      stage = reached;
      const last = reached === settings.pace.length - 1;
      popup(last ? "chaos" : "busy", 0, 3.2, 1, 1.4);
      sound?.play(last ? "chaos" : "rush");
    }
    // Tick each second near the end
    const left = Math.ceil(settings.duration - round.elapsed);
    if (round.phase === "playing" && left <= settings.tickFrom && left > 0 && left !== lastTick) {
      lastTick = left;
      sound?.play("tick");
    }
    if (round.phase !== lastPhase) {
      if (round.phase === "won") {
        for (let i = 0; i < 7; i++) {
          emit(confetti, { x: columnX(i), y: boardY + .9, z: boardZ + .4 }, 18, { colours: confettiColours, speed: 2.6, up: 4, gravity: 6, life: 1.8, size: 1.1 });
        }
        popup("win", 0, 3.4, -1, 1.9);
        sound?.play("win");
      }
      if (round.phase === "lost") {
        popup("lose", 0, 3.2, 0, 1.6);
        sound?.play("lose");
      }
      lastPhase = round.phase;
    }
  }

  function placePeople(round: Round, now: number, dt: number) {
    const still = reducedMotion.matches;
    let waiting = 0;
    round.staff.forEach(person => {
      const member = crewFor(person);
      const at = person.at;
      if (at.place === "away" || at.place === "done" || now < member.born) {
        member.root.visible = false;
        return;
      }
      member.root.visible = true;
      let facing = 0;
      let lift = 0;
      if (at.place === "tray") {
        target.set(office.tray.x + (waiting % 2 - .5) * 1.4, .81, office.tray.z + (Math.floor(waiting / 2) % 2 - .5) * .62);
        lift = still ? 0 : Math.max(0, Math.sin(now * 3 + person.id * 1.7)) * .06;
        waiting++;
      } else if (at.place === "hand") {
        const holder = critters[at.player];
        const spot = round.players[at.player].position;
        target.set(spot.x, 1.95 + holder.body.position.y * 1.35, spot.z);
        facing = holder.facing;
      } else if (at.place === "counter") {
        target.set(office.pass[at.pad].x, 1.05, office.pass[at.pad].z);
      } else if (at.place === "floor") {
        target.set(at.point.x, 0, at.point.z);
      } else if (at.place === "snatched") {
        // Dangling from the bin chicken's beak
        const { position: beak, facing: heading } = round.snatcher;
        target.set(beak.x + Math.sin(heading) * .6, 1.5, beak.z + Math.cos(heading) * .6);
        facing = heading;
      }
      if (member.root.userData.snap) {
        member.root.position.copy(target);
        member.root.userData.snap = false;
      } else {
        member.root.position.lerp(target, 1 - Math.exp(-dt * (at.place === "hand" ? 22 : 14)));
      }
      member.root.position.y += lift;
      let turnBy = facing - member.facing;
      turnBy = Math.atan2(Math.sin(turnBy), Math.cos(turnBy));
      member.facing += turnBy * (1 - Math.exp(-dt * 12));
      member.root.rotation.y = member.facing;
      // Carried people kick their feet; everyone else bobs gently
      const kick = (at.place === "hand" || at.place === "snatched") && !still;
      member.feet.forEach((foot, side) => {
        foot.position.y = .06 + (kick ? Math.max(0, Math.sin(now * 16 + side * Math.PI)) * .08 : 0);
      });
      member.body.rotation.z = kick ? Math.sin(now * 9) * .12 : 0;
      member.head.rotation.z = still ? 0 : Math.sin(now * 2 + person.id) * .06;
      // People waiting or being carried look up at the camera so their faces show
      member.head.rotation.x = at.place === "tray" || at.place === "hand" ? -.35 : 0;
      const spawn = Math.min(1, Math.max(0, (now - member.born) / .38));
      const bounce = Math.min(1, (now - member.popped) / .4);
      const pop = (spawn < 1 ? easeBack(spawn) : 1) * (bounce < 1 ? 1 + Math.sin(bounce * Math.PI) * .25 : 1);
      member.root.scale.setScalar(.8 * Math.max(.001, pop));
    });

    // Badges on the board, including ones falling off after a sick call
    const rostered = roster(round);
    badges.forEach((badge, slot) => {
      const person = rostered[slot];
      if (person) {
        if (badge.person !== person.id) {
          badge.person = person.id;
          badge.surface.map = badgeTexture(person);
          badge.surface.needsUpdate = true;
        }
        badge.falling = -10;
        badge.group.visible = true;
        badge.group.position.copy(badge.home);
        badge.group.rotation.x = 0;
        const bounce = Math.min(1, (now - badge.popped) / .4);
        badge.inner.scale.setScalar(bounce < 1 ? easeBack(bounce) : 1);
        return;
      }
      const fall = now - badge.falling;
      if (badge.person >= 0 && fall < 1.1) {
        badge.group.visible = true;
        badge.group.position.set(badge.home.x, badge.home.y - fall * fall * 3.4, badge.home.z + fall * .9);
        badge.group.rotation.x = -fall * 2.2;
        badge.inner.scale.setScalar(Math.max(.001, 1 - Math.max(0, fall - .7) / .4));
        return;
      }
      badge.person = -1;
      badge.group.visible = false;
    });

    // Glow the open shifts that anyone being carried could take, once they are signed on
    const carried = round.players.map(player => player.carrying).filter(person => person?.approved) as Staff[];
    slotGlows.forEach((glow, slot) => {
      glow.visible = round.phase === "playing" && carried.some(person => canWork(round, person, slot));
      if (glow.visible) (glow.material as T.MeshBasicMaterial).opacity = .55 + Math.sin(now * 8) * .25;
    });

    // Ring ring
    const ringing = now < ringUntil && !still;
    handset.position.y = .16 + (ringing ? Math.abs(Math.sin(now * 30)) * .08 : 0);
    phone.rotation.z = ringing ? Math.sin(now * 40) * .08 : 0;
  }

  const highlightColour = new T.Color(0xfff2a0);
  function highlight(round: Round, now: number) {
    const lit = { tray: false, desk: false, pads: [false, false, false, false] };
    if (round.phase === "playing") {
      round.players.forEach(player => {
        const { position, carrying } = player;
        if (!carrying) {
          if (nearStation(position, furniture.inbox) && round.staff.some(person => person.at.place === "tray")) lit.tray = true;
          office.pass.forEach((pad, i) => {
            if (near(position, pad) && round.staff.some(person => person.at.place === "counter" && person.at.pad === i)) lit.pads[i] = true;
          });
          return;
        }
        if (!carrying.approved && nearStation(position, furniture.desk)) lit.desk = true;
        const free = office.pass.map((pad, i) => ({ i, d: Math.hypot(pad.x - position.x, pad.z - position.z) }))
          .filter(({ i, d }) => d <= settings.reach && !round.staff.some(person => person.at.place === "counter" && person.at.pad === i))
          .sort((a, b) => a.d - b.d)[0];
        if (free) lit.pads[free.i] = true;
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
    pads.forEach((pad, i) => glow(pad, lit.pads[i]));
  }

  function animateCritters(round: Round, now: number, dt: number) {
    const still = reducedMotion.matches;
    critters.forEach((critter, i) => {
      const player = round.players[i];
      const { root, body, head, eyes, ears, arms, feet } = critter;
      root.position.set(player.position.x, 0, player.position.z);
      let turnBy = player.facing - critter.facing;
      turnBy = Math.atan2(Math.sin(turnBy), Math.cos(turnBy));
      critter.facing += turnBy * (1 - Math.exp(-dt * 16));
      root.rotation.y = critter.facing;

      const moving = player.moving && round.phase === "playing";
      if (moving) critter.phase += dt * 14;
      const step = critter.phase;
      const bob = moving && !still ? Math.abs(Math.sin(step)) * .12 : 0;
      critter.squashSpeed += (-critter.squash * 160 - critter.squashSpeed * 11) * dt;
      critter.squash += critter.squashSpeed * dt;
      const squashBy = still ? 0 : T.MathUtils.clamp(critter.squash * .09, -.18, .22);
      const breathe = still ? 1 : 1 + Math.sin(now * 2.6 + i * 2) * .018;
      body.position.y = bob;
      body.scale.set(1 + squashBy * .6, breathe * (1 - squashBy), 1 + squashBy * .6);
      body.rotation.z = moving && !still ? Math.sin(step) * .11 : 0;
      body.rotation.x = T.MathUtils.lerp(body.rotation.x, player.stamping ? .22 : moving ? .1 : 0, 1 - Math.exp(-dt * 10));
      head.rotation.x = player.stamping && !still ? Math.sin(now * 18) * .08 : 0;

      feet.forEach((foot, side) => {
        const swing = moving ? Math.sin(step + side * Math.PI) : 0;
        foot.position.z = .1 + swing * .15;
        foot.position.y = .07 + Math.max(0, swing) * .07;
      });
      arms.forEach((arm, side) => {
        const sideSign = side ? 1 : -1;
        let raise = moving ? Math.sin(step + side * Math.PI) * .6 : Math.sin(now * 2 + side) * .06;
        if (player.carrying) raise = -2.75 + Math.sin(now * 3) * .04;
        if (player.stamping) raise = -1.3 + Math.sin(now * 18 + side) * .45;
        arm.rotation.x = T.MathUtils.lerp(arm.rotation.x, raise, 1 - Math.exp(-dt * 18));
        arm.rotation.z = player.carrying ? sideSign * -.25 : sideSign * .1;
      });
      ears.forEach((ear, side) => {
        ear.rotation.x = -bob * 1.4 - squashBy * 1.5;
        ear.rotation.z = (side ? -.16 : .16) + (moving ? Math.sin(step * .5) * .08 : 0);
      });
      if (now > critter.blinkAt + .13) critter.blinkAt = now + 2 + Math.random() * 3;
      const blinking = now >= critter.blinkAt;
      eyes.forEach(eye => eye.scale.y = blinking ? .12 : 1);

      critter.ring.scale.setScalar(1 + (moving ? 0 : Math.sin(now * 3 + i) * .04));
      // While carrying, the person's own name tag sits where the player tag would be
      tags[i].visible = !player.carrying;
      tags[i].position.set(player.position.x, 2.25, player.position.z);

      if (moving && !still && now > critter.dustAt) {
        critter.dustAt = now + .16;
        emit(puffs, { x: player.position.x, y: .08, z: player.position.z }, 1, { colours: [0xfff3e2], speed: .25, up: .25, gravity: 0, life: .45, size: .7 });
      }

      const ring = progress[i];
      const amount = player.stamping && player.carrying ? player.carrying.stamp / settings.stampTime : 0;
      ring.group.visible = amount > 0;
      if (amount > 0) {
        ring.fill.geometry = ringSteps[Math.min(24, Math.round(amount * 24))];
        ring.group.position.set(player.position.x, 3.8, player.position.z);
        ring.group.quaternion.copy(camera.quaternion);
      }
    });
  }

  function animateSnatcher(round: Round, now: number, dt: number) {
    const chicken = round.snatcher;
    const { root, body, head, legs } = snatcher;
    root.visible = round.phase === "playing" && chicken.mode !== "away";
    if (!root.visible) return;
    const still = reducedMotion.matches;
    root.position.set(chicken.position.x, 0, chicken.position.z);
    let turnBy = chicken.facing - snatcher.facing;
    turnBy = Math.atan2(Math.sin(turnBy), Math.cos(turnBy));
    snatcher.facing += turnBy * (1 - Math.exp(-dt * 14));
    root.rotation.y = snatcher.facing;
    const moving = chicken.mode === "sneaking" || chicken.mode === "fleeing";
    if (moving) snatcher.step += dt * (chicken.mode === "fleeing" ? 22 : 13);
    legs.forEach((leg, side) => (leg.rotation.x = moving && !still ? Math.sin(snatcher.step + side * Math.PI) * .6 : 0));
    body.position.y = moving && !still ? Math.abs(Math.sin(snatcher.step)) * .06 : 0;
    // Pecks at the board while grabbing, and bobs its head while sneaking
    head.rotation.x = still ? 0 : chicken.mode === "grabbing" ? .4 + Math.abs(Math.sin(now * 14)) * .5 : Math.sin(snatcher.step * .5) * .15;
    body.rotation.x = chicken.mode === "grabbing" && !still ? .25 : chicken.mode === "fleeing" ? .15 : 0;
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
    animateSnatcher(round, now, dt);
    placePeople(round, now, dt);
    highlight(round, now);

    const anyStamping = round.players.some(player => player.stamping);
    stampSlam = Math.max(0, stampSlam - dt * 4);
    stamp.position.y = 1.25 - (anyStamping && !still ? Math.abs(Math.sin(now * 9)) * .2 : 0) - stampSlam * .27;

    const left = settings.duration - round.elapsed;
    // Music plays during a round, a little faster each stage and faster again in the final seconds
    sound?.setMusic(round.phase !== "playing" ? 0 : left <= settings.tickFrom ? 1.35 : 1 + stage * .08);
    hand.rotation.z = -(round.elapsed / settings.duration) * Math.PI * 2;
    (clockRim.material as T.MeshStandardMaterial).color.setHex(round.phase === "playing" && left <= settings.tickFrom && Math.sin(now * 10) > 0 ? 0xff3355 : 0xff7a8a);

    // The bulbs twinkle faster at each stage
    const twinkle = round.phase === "playing" ? 1.6 + stage * 4 : 1.6;
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
      marker.visible = focus === i && round.phase === "playing";
      if (!marker.visible) return;
      const player = round.players[i];
      const lift = still ? 0 : Math.abs(Math.sin(now * 5)) * .18;
      marker.position.set(player.position.x, (player.carrying ? 4.3 : 2.75) + lift, player.position.z);
    });

    const follow = T.MathUtils.clamp(round.players[focus ?? 0].position.x, -maxPan, maxPan);
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
    /** Turns screen-relative input (right, down) into a world direction for the current camera. */
    toWorld(right: number, down: number): [number, number] {
      const up = -down;
      return [right * Math.cos(yaw) - up * Math.sin(yaw), -right * Math.sin(yaw) - up * Math.cos(yaw)];
    },
    dispose() {
      sound?.setMusic(0);
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
