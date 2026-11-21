/**
 * Smoke test in a real browser: opens the built game in headless Edge/Chrome, starts a quick-play round,
 * walks the duck around, and saves screenshots plus any console errors.
 *
 *   npm run build && node scripts/smoke.mjs [browser.exe] [outDir]
 *
 * Needs Node 22+ (global WebSocket). Screenshots go to `smoke-out/` (git-ignored) by default.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const browser = process.argv[2] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outDir = process.argv[3] ?? "smoke-out";
const pagePort = 5199;
const debugPort = 9333;
mkdirSync(outDir, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const children = [];
function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: "ignore", shell: options.shell ?? false, ...options });
  children.push(child);
  return child;
}
function cleanup() {
  for (const child of children) {
    try {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGKILL");
    } catch { /* already gone */ }
  }
}
process.on("exit", cleanup);

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

run(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(pagePort), "--strictPort"]);
await waitFor(`http://127.0.0.1:${pagePort}/`);

run(browser, [
  "--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "smoke-"))}`,
  `--window-size=${process.env.SMOKE_SIZE ?? "1400,950"}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--no-first-run", "about:blank",
]);
await waitFor(`http://127.0.0.1:${debugPort}/json/version`);
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === "page");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve));

let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(`exception: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
    errors.push(`console.${message.params.type}: ${message.params.args.map(arg => arg.value ?? arg.description).join(" ")}`);
  }
});
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++nextId;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
async function shot(name) {
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(result.data, "base64"));
  console.log(`saved ${name}.png`);
}
const keyInfo = {
  KeyW: ["w", 87], KeyA: ["a", 65], KeyS: ["s", 83], KeyD: ["d", 68], Space: [" ", 32], ShiftLeft: ["Shift", 16],
  ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40], ArrowLeft: ["ArrowLeft", 37], ArrowRight: ["ArrowRight", 39], Enter: ["Enter", 13],
};
const key = (type, code) => send("Input.dispatchKeyEvent", { type, code, key: keyInfo[code][0], windowsVirtualKeyCode: keyInfo[code][1] });
async function hold(code, ms) {
  await key("keyDown", code);
  await sleep(ms);
  await key("keyUp", code);
}
const text = () => evaluate("document.body.innerText.replace(/\\s+/g, ' ').slice(0, 600)");

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: `http://127.0.0.1:${pagePort}/?debug` });
await sleep(3500);
await shot("1-menu");
console.log("menu text:", await text());

const clicked = await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find(b => /quick play/i.test(b.innerText));
  if (!button) return false;
  button.click();
  return true;
})()`);
console.log("clicked quick play:", clicked);
await sleep(1500);
await shot("2-round-start");

// Duck starts at the front-left near the tray: step up/left to the tray, grab, then head right to the desk and hold.
await hold("KeyA", 250);
await hold("KeyW", 150);
await hold("Space", 80);
await sleep(300);
await shot("3-grabbed");
// Put the duck at the desk with an unstamped request (via ?debug) and catch the stamp bar half full.
await evaluate(`(() => {
  const r = shiftHappens.round();
  const p = r.players[0];
  const held = p.holding === undefined ? undefined : r.cards[p.holding];
  if (held) held.at = { place: "gone" };
  const card = r.cards.find(c => c.at.place === "tray" && c.kind === "request");
  p.position = { x: -.55, z: 2.05 };
  card.at = { place: "hand", player: 0 };
  p.holding = card.id;
})()`);
await sleep(300);
await key("keyDown", "Space");
// Hold the stamp at half way long enough to photograph the progress bar.
await evaluate(`window.smokeHold = setInterval(() => { const r = shiftHappens.round(); const p = r.players[0]; if (p.holding !== undefined) { r.cards[p.holding].stamp = .75; p.stamping = true; } }, 5)`);
await sleep(600);
await shot("4-stamping");
await evaluate("clearInterval(window.smokeHold)");
await sleep(1500);
await key("keyUp", "Space");
await hold("ShiftLeft", 60);
await hold("ArrowRight", 400);
await sleep(500);
console.log("hud text:", await text());
await shot("5-later");

// Fast-forward with the ?debug hook: pin some cards, then jump to busy, chaos and the end.
const pin = slots => `(() => {
  const round = shiftHappens.round();
  for (const slot of ${JSON.stringify(slots)}) {
    if (round.board[slot] !== undefined) continue;
    const id = round.cards.length;
    round.cards.push({ id, kind: "request", day: slot % 7, worker: slot % round.staff.length, approved: true, stamp: 0, at: { place: "board", slot }, born: round.elapsed });
    round.board[slot] = id;
  }
})()`;
const jump = (elapsed, extra = "") => evaluate(`(() => { const r = shiftHappens.round(); r.elapsed = ${elapsed}; ${extra} })()`);
await evaluate(pin([0, 1, 2, 3, 7, 8, 9]));
await jump(39.5, "r.nextCancel = 40.5; r.nextSnatch = 41;");
await sleep(2500);
await shot("6-busy-cancel");
await sleep(2500);
await shot("7-snatcher");
console.log("busy text:", await text());
await jump(79.5);
await sleep(1500);
await shot("8-chaos");
await jump(119.6);
await sleep(1500);
await shot("9-lost");
console.log("lost text:", await text());
await evaluate(`[...document.querySelectorAll("button")].find(b => /play again/i.test(b.innerText))?.click()`);
await sleep(1500);
await evaluate(pin([...Array(14).keys()]));
await sleep(1500);
await shot("10-won");
console.log("won text:", await text());

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
socket.close();
cleanup();
process.exit(0);
