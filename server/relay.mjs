/**
 * Shift Happens relay: passes messages between the laptop running the game and the phones in its room.
 *
 * Some networks (guest and venue Wi-Fi) stop phones and the laptop connecting to each other directly. Everyone can
 * still reach this server, so the game sends its messages through it instead. It keeps no game state: it only knows
 * which peers are in which room, and forwards each message to one peer or to everyone else in the room.
 *
 * Protocol, JSON text frames:
 *   client → server  { type: "hello", room, id }   join a room as this peer (sent again after a reconnect)
 *                    { type: "send", to?, data }    a message for one peer, or everyone else when `to` is missing
 *                    { type: "bye" }                leaving on purpose
 *   server → client  { type: "peers", ids }         who is already in the room
 *                    { type: "join", id }           { type: "leave", id }
 *                    { type: "msg", from, data }
 *
 * A peer whose connection drops has a few seconds to reconnect with the same id before the room hears it left, so a
 * blip (or a host closing idle connections) doesn't cost a phone its seat.
 */
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const port = Number(process.env.PORT) || 8787;
const graceMs = 6000;
const maxPerRoom = 12;
/** Rooms by code, each a map of peer id to its socket and, while it is reconnecting, the timer that will remove it. */
const rooms = new Map();

const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end(`Shift Happens relay is awake. Rooms open: ${rooms.size}\n`);
});
const sockets = new WebSocketServer({ server, maxPayload: 64 * 1024 });

function send(socket, message) {
  if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function everyoneBut(room, id) {
  return [...room.entries()].filter(([peer]) => peer !== id);
}

sockets.on("connection", socket => {
  let code = "";
  let id = "";
  socket.alive = true;
  socket.on("pong", () => { socket.alive = true; });

  function leave(now) {
    const room = rooms.get(code);
    const entry = room?.get(id);
    // Nothing to do if they already left, or a newer connection has taken over this id
    if (!entry || entry.socket !== socket) return;
    const gone = () => {
      room.delete(id);
      for (const [, peer] of room) send(peer.socket, { type: "leave", id });
      if (!room.size) rooms.delete(code);
    };
    clearTimeout(entry.timer);
    if (now) gone();
    else entry.timer = setTimeout(gone, graceMs);
  }

  socket.on("message", raw => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (message?.type === "hello" && !id) {
      const room = String(message.room ?? "").toUpperCase();
      const peer = String(message.id ?? "");
      if (!/^[A-Z0-9]{4,12}$/.test(room) || !/^[a-z0-9]{4,32}$/i.test(peer)) {
        socket.close(1008, "bad hello");
        return;
      }
      code = room;
      id = peer;
      let members = rooms.get(code);
      if (!members) rooms.set(code, members = new Map());
      const existing = members.get(id);
      if (existing) {
        // Back within the grace period: swap in the new connection quietly
        clearTimeout(existing.timer);
        existing.timer = undefined;
        if (existing.socket !== socket) existing.socket.terminate();
        existing.socket = socket;
      } else {
        if (members.size >= maxPerRoom) {
          socket.close(1008, "room full");
          return;
        }
        members.set(id, { socket, timer: undefined });
        for (const [, other] of everyoneBut(members, id)) send(other.socket, { type: "join", id });
      }
      send(socket, { type: "peers", ids: everyoneBut(members, id).map(([other]) => other) });
      return;
    }
    const members = rooms.get(code);
    if (!id || !members) return;
    if (message?.type === "send") {
      const out = { type: "msg", from: id, data: message.data };
      if (message.to) send(members.get(String(message.to))?.socket, out);
      else for (const [, other] of everyoneBut(members, id)) send(other.socket, out);
    } else if (message?.type === "bye") {
      leave(true);
    }
  });

  socket.on("close", () => leave(false));
});

// Ping every connection so idle ones stay open through proxies, and drop any that stopped answering
setInterval(() => {
  for (const socket of sockets.clients) {
    if (!socket.alive) {
      socket.terminate();
      continue;
    }
    socket.alive = false;
    socket.ping();
  }
}, 20000).unref();

server.listen(port, () => console.log(`Shift Happens relay listening on port ${port}`));
