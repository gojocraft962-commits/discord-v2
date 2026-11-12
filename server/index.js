import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';

const app = express();
const server = http.createServer(app);
const allowed = (process.env.CLIENT_ORIGIN || '*').split(',').map(x => x.trim());
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Origin não permitido'));
  }
};
const io = new Server(server, { cors: corsOptions, maxHttpBufferSize: 1e6 });
const db = new Database(process.env.DB_FILE || 'apex-hub.sqlite');
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('Defina JWT_SECRET com pelo menos 32 caracteres no ambiente.');
  process.exit(1);
}
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '32kb' }));
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'Apex Hub API' }));

function issueToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, secret, { expiresIn: '7d' });
}
function authenticate(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}
app.post('/auth/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username) || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Use nome de 3–20 caracteres e senha de 8–128 caracteres.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)').run(username, hash);
    const user = { id: Number(result.lastInsertRowid), username };
    res.status(201).json({ token: issueToken(user), user });
  } catch (error) {
    if (String(error.code).includes('CONSTRAINT')) return res.status(409).json({ error: 'Esse nome já está em uso.' });
    res.status(500).json({ error: 'Não foi possível criar a conta.' });
  }
});
app.post('/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const row = db.prepare('SELECT id,username,password_hash FROM users WHERE username=?').get(username);
  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    return res.status(401).json({ error: 'Nome ou senha incorretos.' });
  const user = { id: row.id, username: row.username };
  res.json({ token: issueToken(user), user });
});
app.get('/channels/:channel/messages', authenticate, (req, res) => {
  const channel = String(req.params.channel).slice(0, 64);
  const rows = db.prepare('SELECT id,channel,user_id AS userId,username,body,created_at AS createdAt FROM messages WHERE channel=? ORDER BY id DESC LIMIT 50').all(channel);
  res.json(rows.reverse());
});

const onlineUsers = new Map();

function getChannelPresence(channel) {
  const users = [];
  const seen = new Set();
  for (const u of onlineUsers.values()) {
    if (u.channel === channel && !seen.has(u.userId)) {
      seen.add(u.userId);
      users.push({ userId: u.userId, username: u.username });
    }
  }
  return users;
}

function broadcastPresence(channel) {
  io.to(channel).emit('presence:update', { channel, users: getChannelPresence(channel) });
}

function socketAuth(socket, next) {
  try {
    socket.user = jwt.verify(socket.handshake.auth?.token || '', secret);
    next();
  } catch {
    next(new Error('Não autenticado'));
  }
}
io.use(socketAuth);

io.on('connection', socket => {
  const userId = Number(socket.user.sub);
  const username = socket.user.username;

  onlineUsers.set(socket.id, { userId, username, channel: null });
  socket.emit('connection:ready', { userId, username });

  socket.on('channel:join', channelName => {
    const channel = String(channelName || 'geral').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!channel) return;

    const prev = onlineUsers.get(socket.id);
    const prevChannel = prev?.channel;

    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.join(channel);
    onlineUsers.set(socket.id, { userId, username, channel });

    if (prevChannel && prevChannel !== channel) broadcastPresence(prevChannel);
    broadcastPresence(channel);

    const history = db
      .prepare('SELECT id,channel,user_id AS userId,username,body,created_at AS createdAt FROM messages WHERE channel=? ORDER BY id DESC LIMIT 50')
      .all(channel)
      .reverse();
    socket.emit('channel:history', history);
    socket.emit('presence:update', { channel, users: getChannelPresence(channel) });
  });

  socket.on('message:send', payload => {
    const channel = String(payload?.channel || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const body = String(payload?.body || '').trim();
    if (!channel || !body || body.length > 2000 || !socket.rooms.has(channel)) return;

    const result = db
      .prepare('INSERT INTO messages(channel,user_id,username,body) VALUES(?,?,?,?)')
      .run(channel, userId, username, body);

    const message = {
      id: Number(result.lastInsertRowid),
      channel,
      userId,
      username,
      body,
      createdAt: new Date().toISOString()
    };
    io.to(channel).emit('message:new', message);
    socket.to(channel).emit('typing:stop', { userId, username, channel });
  });

  socket.on('typing:start', payload => {
    const channel = String(payload?.channel || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!channel || !socket.rooms.has(channel)) return;
    socket.to(channel).emit('typing:start', { userId, username, channel });
  });

  socket.on('typing:stop', payload => {
    const channel = String(payload?.channel || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!channel) return;
    socket.to(channel).emit('typing:stop', { userId, username, channel });
  });

  socket.on('call:join', room => {
    const safeRoom = 'call-' + String(room || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    if (safeRoom.length > 5) {
      socket.join(safeRoom);
      socket.to(safeRoom).emit('call:peer', { peerId: socket.id });
    }
  });
  for (const event of ['webrtc:offer', 'webrtc:answer', 'webrtc:ice']) {
    socket.on(event, payload => {
      const target = String(payload?.target || '');
      if (target && target !== socket.id) io.to(target).emit(event, { from: socket.id, data: payload.data });
    });
  }

  socket.on('disconnect', () => {
    const info = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    if (info?.channel) broadcastPresence(info.channel);
    for (const room of socket.rooms) {
      if (room.startsWith('call-')) socket.to(room).emit('call:peer-left', { peerId: socket.id });
    }
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log('Apex Hub API online na porta ' + port));
