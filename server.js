const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const ROOM_CODE_LENGTH = 5;

/** @type {Map<string, { host: import('ws').WebSocket, guest: import('ws').WebSocket | null }>} */
const rooms = new Map();

function generateRoomId() {
  let id;
  do {
    id = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
    ).join('');
  } while (rooms.has(id));
  return id;
}

function send(ws, data) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function otherSocket(room, ws) {
  return room.host === ws ? room.guest : room.host;
}

function closeRoom(roomId, ws) {
  const room = rooms.get(roomId);
  if (!room) return;
  const other = otherSocket(room, ws);
  send(other, { type: 'opponent-left' });
  rooms.delete(roomId);
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  // noServer + manual routing: a WebSocketServer created with {server, path}
  // grabs the server's 'upgrade' event and destroys any socket whose path
  // doesn't match — including Next's own dev-mode HMR websocket, silently
  // breaking Fast Refresh. Routing by pathname ourselves lets Next's
  // upgrade handler (registered lazily on the first HTTP request) see
  // every upgrade we don't claim.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws) => {
    ws.roomId = null;

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (data.type) {
        case 'create': {
          const roomId = generateRoomId();
          rooms.set(roomId, { host: ws, guest: null });
          ws.roomId = roomId;
          send(ws, { type: 'created', roomId, color: 'hero' });
          break;
        }
        case 'join': {
          const room = rooms.get(data.roomId);
          if (!room) {
            send(ws, { type: 'error', message: 'Sala não encontrada.' });
            return;
          }
          if (room.guest) {
            send(ws, { type: 'error', message: 'Sala cheia.' });
            return;
          }
          room.guest = ws;
          ws.roomId = data.roomId;
          send(ws, { type: 'joined', roomId: data.roomId, color: 'villain' });
          send(room.host, { type: 'opponent-joined' });
          break;
        }
        case 'move': {
          const room = rooms.get(ws.roomId);
          if (!room) return;
          send(otherSocket(room, ws), { type: 'move', move: data.move });
          break;
        }
        case 'leave': {
          if (ws.roomId) closeRoom(ws.roomId, ws);
          ws.roomId = null;
          break;
        }
        default:
          break;
      }
    });

    ws.on('close', () => {
      if (ws.roomId) closeRoom(ws.roomId, ws);
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (WebSocket relay on /ws)`);
  });
});
