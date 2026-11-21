/**
 * Phones as controllers: the laptop running the game "hosts" a room, and phones join it as gamepads.
 *
 * Phones and the laptop talk directly over WebRTC. Trystero only uses public relays to introduce them, so this works
 * from a static site such as GitHub Pages with no game server. Add `?link=local` to the host's address to swap in a
 * stand-in that only connects tabs in the same browser, for testing without a network.
 *
 * Guest and venue Wi-Fi often block direct connections, so by default everyone talks through the team's relay server
 * (server/relay.mjs) instead. `?relay=other-host` picks another relay and `?relay=off` goes back to direct connections;
 * the join link and QR code carry either along.
 */

import type { Stats } from "./round";

/** What a phone sends: where its stick points, whether the action button is held, and requests to start a round. */
export type PhoneMessage =
  | { t: "input"; x: number; y: number; act: boolean; dash: boolean }
  | { t: "start" }
  /** "I'm ready" while the rules are showing before a round. */
  | { t: "ready" };

/** What the laptop sends back: which critter the phone controls, and what that critter is doing. */
export type HostMessage =
  | { t: "seat"; player: number }
  | {
    t: "status";
    phase: "ready" | "playing" | "won" | "lost";
    prompt: string;
    /** The card the critter holds, if any: kind, day (0 = Mon), worker name and whether it is approved. */
    card: { kind: "request" | "open" | "cancelled"; day: number; worker: string; approved: boolean } | null;
    stage: "calm" | "busy" | "chaos";
    stamping: boolean;
    stamp: number;
    /** Dash charges left (0 to 3). */
    charges: number;
    /** Seconds until the next timed charge refill (0 when full). */
    regenIn: number;
    /** Whether the speed boost from a ⚡ is active. */
    boosted: boolean;
    time: number;
    filled: number;
    needed: number;
    news: string;
    /** Seconds left in the 3-2-1 countdown before a round starts, or 0. */
    countdown?: number;
    /** Seconds left on the rules screen before the countdown, or 0 when it isn't showing. */
    briefing?: number;
    /** Whether this phone has said it's ready on the rules screen. */
    ready?: boolean;
    /** This critter's tallies this round, for the results on the phone. */
    stats?: Stats;
    /** Award titles this critter won, once the round has ended. */
    awards?: string[];
    /** Which critters (by seat) have a phone in the room, for the lobby. The lowest one starts the round, like a Jackbox VIP. */
    joined?: boolean[];
  };

/** The helper critters, by seat. */
export const critters = [
  { name: "duck", emoji: "🐥", colour: "#ffd54f" },
  { name: "bunny", emoji: "🐰", colour: "#cdb8ff" },
  { name: "cat", emoji: "🐱", colour: "#ff9fb5" },
  { name: "frog", emoji: "🐸", colour: "#8fe3a0" },
];

const cardKinds = { request: "Request", open: "Open shift", cancelled: "Cancelled" };

/** Chip text for a held card. An unapproved open shift is only "for" someone; approved, they have accepted. */
export function cardText(card: { kind: "request" | "open" | "cancelled"; day: number; worker: string; approved: boolean }, dayNames: readonly string[]) {
  const who = !card.worker ? "" : card.kind === "open" && !card.approved ? ` · for ${card.worker}` : ` · ${card.worker}`;
  return `${cardKinds[card.kind]} · ${dayNames[card.day]}${who}${card.approved ? " ✓" : ""}`;
}

/** Chip colours for card kinds: blue request, yellow open shift, red cancelled. */
export const cardColours = { request: "#4f9dff", open: "#f2b705", cancelled: "#ef5a6f" };

export type Message = PhoneMessage | HostMessage;

export type Link = {
  send: (message: Message, to?: string) => void;
  onMessage: (handler: (message: Message, from: string) => void) => void;
  onJoin: (handler: (peer: string) => void) => void;
  onLeave: (handler: (peer: string) => void) => void;
  close: () => void;
};

const appId = "vetematts.github.io/ShiftHappens";
// Letters and digits that are hard to misread when typed from a screen
const codeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode() {
  return Array.from({ length: 4 }, () => codeLetters[Math.floor(Math.random() * codeLetters.length)]).join("");
}

/** The team's relay on Render (server/relay.mjs). Used unless the address says otherwise; `?relay=off` connects directly. */
const defaultRelay = "shifthappens-c5ij.onrender.com";
const bareHost = (address: string) => address.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/+$/, "");

/** The address a phone opens to join. A hash survives GitHub Pages and keeps the code out of server logs. */
export function joinUrl(code: string, local: boolean) {
  // Phones use the same relay as the laptop. The default needs nothing in the link, which keeps the QR code simple.
  const relay = new URLSearchParams(location.search).get("relay");
  const query = relay && !local && bareHost(relay) !== bareHost(defaultRelay) ? `?relay=${encodeURIComponent(relay)}` : "";
  return `${phoneOrigin(local)}${location.pathname}${query}#join-${code}${local ? "-local" : ""}`;
}

/**
 * Where phones should load the game from. Usually this page's own address, but a phone can't open "localhost", so
 * while testing with `npm run dev` the link uses this computer's Wi-Fi address instead (phones must be on the same
 * Wi-Fi). Same-browser test links stay on localhost.
 */
function phoneOrigin(local: boolean) {
  // Only the dev server adds this tag (see vite.config.ts); builds never have it
  const lan = document.querySelector<HTMLMetaElement>('meta[name="dev-lan-origin"]')?.content;
  const onThisComputer = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  return lan && onThisComputer && !local ? lan : location.origin;
}

/** Whether phones need to be on this computer's Wi-Fi to join (only when testing with `npm run dev` on localhost). */
export const joinsOverLan = () => phoneOrigin(false) !== location.origin;

/**
 * The relay server to talk through, if any: `?relay=` in the address, else VITE_RELAY_URL from the build, else the
 * team's relay. `?relay=off` turns it off. Accepts a bare host (`my-relay.onrender.com`), https:// or wss://.
 */
export function relayUrl() {
  const asked = new URLSearchParams(location.search).get("relay");
  if (asked?.trim().toLowerCase() === "off") return "";
  const given = (asked || import.meta.env.VITE_RELAY_URL || defaultRelay).trim();
  if (!given) return "";
  if (/^wss?:\/\//.test(given)) return given;
  if (/^https?:\/\//.test(given)) return given.replace(/^http/, "ws");
  return `wss://${given}`;
}

/** Reads a join link from the current address: `#join-ABCD` (or `?join=ABCD`). */
export function readJoin(): { code: string; local: boolean } | null {
  const hash = location.hash.match(/^#join-([A-Z0-9]{4})(-local)?$/i);
  if (hash) return { code: hash[1].toUpperCase(), local: Boolean(hash[2]) };
  const query = new URLSearchParams(location.search).get("join");
  if (query && /^[A-Z0-9]{4}$/i.test(query)) return { code: query.toUpperCase(), local: false };
  return null;
}

/** Whether the host should use the same-browser stand-in instead of the network. */
export const wantsLocalLink = () => new URLSearchParams(location.search).get("link") === "local";

/** Nudges a sleeping relay awake (a free Render service takes about a minute), so it's ready when phones join. */
export function wakeRelay() {
  const relay = relayUrl();
  if (relay) void fetch(relay.replace(/^ws/, "http"), { mode: "no-cors", cache: "no-store" }).catch(() => {});
}

export async function openLink(code: string, local: boolean): Promise<Link> {
  if (local) return openLocalLink(code);
  const relay = relayUrl();
  return relay ? openRelayLink(code, relay) : openNetworkLink(code);
}

async function openNetworkLink(code: string): Promise<Link> {
  // Loaded only when someone uses phones, so the game itself never contacts the relays
  const { joinRoom } = await import("trystero");
  const room = joinRoom({ appId, identity: "none" }, `room-${code}`);
  const channel = room.makeAction<Message>("msg");
  return {
    send: (message, to) => void channel.send(message, { target: to ?? null }).catch(() => {}),
    onMessage: handler => void channel.onMessage((data, context) => handler(data, context.peerId)),
    onJoin: handler => void room.onPeerJoin(context => handler(context.peerId)),
    onLeave: handler => void room.onPeerLeave(context => handler(context.peerId)),
    close: () => void room.leave(),
  };
}

type RelayMessage =
  | { type: "peers"; ids: string[] }
  | { type: "join" | "leave"; id: string }
  | { type: "msg"; from: string; data: Message };

// Talks through the relay server over one WebSocket, reconnecting on its own if the connection drops. The server holds
// this peer's place for a few seconds, so a quick reconnect keeps a phone in its seat.
function openRelayLink(code: string, url: string): Link {
  const self = Math.random().toString(36).slice(2, 12);
  const peers = new Set<string>();
  const handlers = { message: [] as ((m: Message, from: string) => void)[], join: [] as ((p: string) => void)[], leave: [] as ((p: string) => void)[] };
  let socket: WebSocket | undefined;
  let closed = false;
  let wait = 400;
  const meet = (peer: string) => {
    if (peers.has(peer)) return;
    peers.add(peer);
    handlers.join.forEach(handler => handler(peer));
  };
  const write = (frame: object) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
  };

  function connect() {
    if (closed) return;
    const current = new WebSocket(url);
    socket = current;
    current.onopen = () => {
      wait = 400;
      current.send(JSON.stringify({ type: "hello", room: code, id: self }));
    };
    current.onmessage = event => {
      let message: RelayMessage;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === "peers") message.ids.forEach(meet);
      else if (message.type === "join") meet(message.id);
      else if (message.type === "leave") {
        if (peers.delete(message.id)) handlers.leave.forEach(handler => handler(message.id));
      } else if (message.type === "msg") {
        meet(message.from);
        handlers.message.forEach(handler => handler(message.data, message.from));
      }
    };
    current.onclose = () => {
      if (closed || socket !== current) return;
      // Try again soon, backing off while the server wakes up or the network recovers
      setTimeout(connect, wait);
      wait = Math.min(wait * 2, 4000);
    };
  }

  const goodbye = () => write({ type: "bye" });
  window.addEventListener("pagehide", goodbye);
  // Connect once listeners have had a chance to attach
  setTimeout(connect, 0);
  return {
    send: (message, to) => write({ type: "send", to, data: message }),
    onMessage: handler => void handlers.message.push(handler),
    onJoin: handler => void handlers.join.push(handler),
    onLeave: handler => void handlers.leave.push(handler),
    close: () => {
      closed = true;
      goodbye();
      window.removeEventListener("pagehide", goodbye);
      socket?.close();
    },
  };
}

type Envelope = { from: string; to?: string; kind: "hello" | "hi" | "bye" | "msg"; data?: Message };

// Same-browser stand-in with the same shape as the network link, built on BroadcastChannel
function openLocalLink(code: string): Link {
  const self = Math.random().toString(36).slice(2, 10);
  const channel = new BroadcastChannel(`shift-happens-${code}`);
  const peers = new Set<string>();
  const handlers = { message: [] as ((m: Message, from: string) => void)[], join: [] as ((p: string) => void)[], leave: [] as ((p: string) => void)[] };
  const post = (envelope: Omit<Envelope, "from">) => channel.postMessage({ ...envelope, from: self });
  const meet = (peer: string) => {
    if (peers.has(peer)) return;
    peers.add(peer);
    handlers.join.forEach(handler => handler(peer));
  };
  channel.onmessage = ({ data }: MessageEvent<Envelope>) => {
    if (data.from === self || (data.to && data.to !== self)) return;
    if (data.kind === "hello") {
      meet(data.from);
      post({ kind: "hi", to: data.from });
    } else if (data.kind === "hi") {
      meet(data.from);
    } else if (data.kind === "bye") {
      if (peers.delete(data.from)) handlers.leave.forEach(handler => handler(data.from));
    } else if (data.data) {
      meet(data.from);
      handlers.message.forEach(handler => handler(data.data!, data.from));
    }
  };
  const goodbye = () => post({ kind: "bye" });
  window.addEventListener("pagehide", goodbye);
  // Say hello once listeners have had a chance to attach
  setTimeout(() => post({ kind: "hello" }), 50);
  return {
    send: (message, to) => post({ kind: "msg", to, data: message }),
    onMessage: handler => void handlers.message.push(handler),
    onJoin: handler => void handlers.join.push(handler),
    onLeave: handler => void handlers.leave.push(handler),
    close: () => {
      goodbye();
      window.removeEventListener("pagehide", goodbye);
      channel.close();
    },
  };
}
