require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const socketio = require('socket.io');
const path     = require('path');

const PORT         = process.env.PORT || 9000;
const LINK_SECRET  = process.env.LINK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!LINK_SECRET)  { console.error('LINK_SECRET is missing'); process.exit(1); }

const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.send('ok'));

// app.post('/api/v1/links', (req, res) => {
//   const { professionalsFullName, proId, clientName, apptDate, uuid } = req.body || {};
//   if (!professionalsFullName || !clientName) {
//     return res.status(400).json({ error: 'professionalsFullName and clientName are required' });
//   }
//   const id = uuid || uuidv4();

//   const clientPayload = { uuid: id, professionalsFullName, clientName, apptDate };
//   const proPayload    = { uuid: id, professionalsFullName, proId: proId || 'pro' };

//   const clientToken = jwt.sign(clientPayload, LINK_SECRET, { expiresIn: '4h' });
//   const proToken    = jwt.sign(proPayload, LINK_SECRET,    { expiresIn: '4h' });

//   res.json({
//     uuid: id,
//     clientLink: `${FRONTEND_URL}/#/join-video?token=${encodeURIComponent(clientToken)}`,
//     proLink:    `${FRONTEND_URL}/#/join-video-pro?token=${encodeURIComponent(proToken)}`
//   });
// });

app.post('/api/v1/links', (req, res) => {
  const { professionalsFullName, proId, clientName, apptDate, uuid } = req.body || {};
  if (!professionalsFullName || !clientName || !apptDate) {
    return res.status(400).json({ error: 'professionalsFullName, clientName, and apptDate are required' });
  }

  const id = uuid || uuidv4();

  // Compute expiry: 2 hours after appointment time
  const appointmentTime = new Date(apptDate).getTime();
  const expiryTime = appointmentTime + 2 * 60 * 60 * 1000; // +2 hours in ms
  const secondsUntilExpiry = Math.max(60, Math.floor((expiryTime - Date.now()) / 1000)); // at least 60s

  const clientPayload = { uuid: id, professionalsFullName, clientName, apptDate };
  const proPayload    = { uuid: id, professionalsFullName, proId: proId || 'pro' };

  // Set dynamic expiry in seconds
  const clientToken = jwt.sign(clientPayload, LINK_SECRET, { expiresIn: secondsUntilExpiry });
  const proToken    = jwt.sign(proPayload, LINK_SECRET, { expiresIn: secondsUntilExpiry });

  res.json({
    uuid: id,
    expiresIn: secondsUntilExpiry,
    clientLink: `${FRONTEND_URL}/#/join-video?token=${encodeURIComponent(clientToken)}`,
    proLink:    `${FRONTEND_URL}/#/join-video-pro?token=${encodeURIComponent(proToken)}`
  });
});


app.post('/validate-link', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, LINK_SECRET);
    res.json(decoded);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
// const server = http.createServer(app);
// const io = socketio(server, {
//   cors: { origin: FRONTEND_URL, methods: ['GET','POST'], credentials: true }
// });

// // per-room state: { offer, answer, offererIceCandidates, answerIceCandidates, clientReady, proReady }
// const roomState = Object.create(null);

// function roomOf(uuid) {
//   roomState[uuid] = roomState[uuid] || {
//     offer: null,
//     answer: null,
//     offererIceCandidates: [],
//     answerIceCandidates: [],
//     clientReady: false,
//     proReady: false,
//   };
//   return roomState[uuid];
// }

// function cleanupIfEmpty(uuid) {
//   const room = io.sockets.adapter.rooms.get(uuid);
//   if (!room || room.size === 0) {
//     delete roomState[uuid];
//     console.log(`🧹 cleaned state for room ${uuid}`);
//   }
// }

// io.on('connection', (socket) => {
//   const token = socket.handshake.auth && socket.handshake.auth.jwt;
//   let payload;
//   try { payload = jwt.verify(token, LINK_SECRET); }
//   catch (e) { console.error('Invalid JWT:', e.message); return socket.disconnect(true); }

//   const { uuid, proId, professionalsFullName, clientName } = payload;
//   const role = proId ? 'pro' : 'client';
//   const room = roomOf(uuid);

//   socket.join(uuid);
//   const size = io.sockets.adapter.rooms.get(uuid)?.size || 0;
//   console.log(`${socket.id} connected → ${role} joined ${uuid} (size ${size})`);

//   // announce join to the other side
//   socket.to(uuid).emit(role === 'pro' ? 'proJoined' : 'clientJoined');

//   // send current readiness of the other side to this newcomer
//   if (role === 'pro' && room.clientReady) socket.emit('clientReady');
//   if (role === 'client' && room.proReady)  socket.emit('proReady');

//   // handshake: I'm ready AFTER getUserMedia is done
//   socket.on('iAmReady', () => {
//     if (role === 'pro') {
//       room.proReady = true;
//       console.log(`[${uuid}] proReady`);
//       socket.to(uuid).emit('proReady');
//     } else {
//       room.clientReady = true;
//       console.log(`[${uuid}] clientReady`);
//       socket.to(uuid).emit('clientReady');
//     }
//   });

//   // signaling (no replay on join!)
//   socket.on('newOffer', ({ offer }) => {
//     console.log(`[${uuid}] newOffer from ${role}`);
//     // wipe old state to avoid stale SDP
//     room.offer = offer;
//     room.answer = null;
//     room.offererIceCandidates = [];
//     room.answerIceCandidates  = [];
//     socket.to(uuid).emit('newOfferWaiting', { uuid, offer });
//   });

//   socket.on('newAnswer', ({ answer }) => {
//     console.log(`[${uuid}] newAnswer from ${role}`);
//     room.answer = answer;
//     socket.to(uuid).emit('answerToClient', answer);
//   });

//   socket.on('iceToServer', ({ iceC, who }) => {
//     // const key = who === 'client' ? 'offererIceCandidates' : 'answerIceCandidates';
//     const key = (who === 'client') ? 'offererIceCandidates'
//          : (who === 'pro' || who === 'professional') ? 'answerIceCandidates'
//          : 'answerIceCandidates';
//     room[key].push(iceC);
//     socket.to(uuid).emit('iceToClient', { iceC, who });
//   });

//   // UI signals (no renegotiation)
//   socket.on('toggleAudio', ({ muted }) => {
//     console.log(`[${uuid}] toggleAudio muted=${muted}`);
//     socket.to(uuid).emit('toggleAudio', { muted });
//   });
//   socket.on('toggleVideo', ({ off }) => {
//     console.log(`[${uuid}] toggleVideo off=${off}`);
//     socket.to(uuid).emit('toggleVideo', { off });
//   });

//   socket.on('disconnect', () => {
//     console.log(`${socket.id} disconnected from ${uuid}`);
//     setTimeout(() => cleanupIfEmpty(uuid), 10000);
//   });
// });

// server.listen(PORT, () => {
//   console.log(`Video-conf service listening on port ${PORT}`);
// });

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET','POST'], credentials: true }
});

// per-room state: { offer, answer, offererIceCandidates, answerIceCandidates, clientReady, proReady, clientJoined, proJoined }
const roomState = Object.create(null);

function roomOf(uuid) {
  roomState[uuid] = roomState[uuid] || {
    offer: null,
    answer: null,
    offererIceCandidates: [],
    answerIceCandidates: [],
    clientReady: false,
    proReady: false,
    clientJoined: false,
    proJoined: false,
  };
  return roomState[uuid];
}

function cleanupIfEmpty(uuid) {
  const room = io.sockets.adapter.rooms.get(uuid);
  if (!room || room.size === 0) {
    delete roomState[uuid];
    console.log(`🧹 cleaned state for room ${uuid}`);
  }
}

io.on('connection', (socket) => {
  const token = socket.handshake.auth && socket.handshake.auth.jwt;
  let payload;
  try { payload = jwt.verify(token, LINK_SECRET); }
  catch (e) { console.error('Invalid JWT:', e.message); return socket.disconnect(true); }

  const { uuid, proId } = payload;
  const role = proId ? 'pro' : 'client';
  const room = roomOf(uuid);

  socket.join(uuid);
  const size = io.sockets.adapter.rooms.get(uuid)?.size || 0;
  console.log(`${socket.id} connected → ${role} joined ${uuid} (size ${size})`);

  // Mark joined flags
  if (role === 'pro') room.proJoined = true;
  else room.clientJoined = true;

  // Announce join to the other side
  socket.to(uuid).emit(role === 'pro' ? 'proJoined' : 'clientJoined');

  // Tell the newcomer the other side's current status (joined + ready)
  if (role === 'pro') {
    if (room.clientJoined) socket.emit('clientJoined');
    if (room.clientReady)  socket.emit('clientReady');
  } else {
    if (room.proJoined) socket.emit('proJoined');
    if (room.proReady)  socket.emit('proReady');
  }

  // handshake: I'm ready AFTER getUserMedia is done
  socket.on('iAmReady', () => {
    if (role === 'pro') {
      room.proReady = true;
      console.log(`[${uuid}] proReady`);
      socket.to(uuid).emit('proReady');
    } else {
      room.clientReady = true;
      console.log(`[${uuid}] clientReady`);
      socket.to(uuid).emit('clientReady');
    }
  });

  // signaling (no replay on join!)
  socket.on('newOffer', ({ offer }) => {
    console.log(`[${uuid}] newOffer from ${role}`);
    // wipe old state to avoid stale SDP
    room.offer = offer;
    room.answer = null;
    room.offererIceCandidates = [];
    room.answerIceCandidates  = [];
    socket.to(uuid).emit('newOfferWaiting', { uuid, offer });
  });

  socket.on('newAnswer', ({ answer }) => {
    console.log(`[${uuid}] newAnswer from ${role}`);
    room.answer = answer;
    socket.to(uuid).emit('answerToClient', answer);
  });

  socket.on('iceToServer', ({ iceC, who }) => {
    // normalize labels just in case
    const side = (who === 'client') ? 'offererIceCandidates' : 'answerIceCandidates';
    room[side].push(iceC);
    socket.to(uuid).emit('iceToClient', { iceC, who });
  });

  // UI signals (no renegotiation)
  socket.on('toggleAudio', ({ muted }) => {
    console.log(`[${uuid}] toggleAudio muted=${muted}`);
    socket.to(uuid).emit('toggleAudio', { muted });
  });
  socket.on('toggleVideo', ({ off }) => {
    console.log(`[${uuid}] toggleVideo off=${off}`);
    socket.to(uuid).emit('toggleVideo', { off });
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected from ${uuid}`);
    setTimeout(() => cleanupIfEmpty(uuid), 10000);
  });
});

server.listen(PORT, () => {
  console.log(`Video-conf service listening on port ${PORT}`);
});