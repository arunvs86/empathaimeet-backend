// // server.js
// // Express + Socket.IO backend, ready for Render

// const express = require('express');
// const http = require('http');
// const cors = require('cors');
// const jwt = require('jsonwebtoken');
// const { v4: uuidv4 } = require('uuid');
// const socketio = require('socket.io');

// // Load environment variables
// const LINK_SECRET = process.env.LINK_SECRET;
// console.log(LINK_SECRET)
// if (!LINK_SECRET) {
//   console.error('Error: LINK_SECRET must be set in environment');
//   process.exit(1);
// }
// const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// const PORT = process.env.PORT || 9000;

// // Express setup
// const app = express();
// app.use(
//   cors({
//     origin: [FRONTEND_URL],
//     credentials: true
//   })
// );
// app.use(express.json());

// // In-memory storage (replace with real DB in production)
// const allKnownOffers = {};  // uuid → { offer, answer, iceCandidates... }

// // HTTP endpoints
// app.post('/api/v1/links', (req, res) => {
//   const { professionalsFullName, proId, clientName, apptDate, uuid } = req.body;
//   const id = uuid || uuidv4();

//   const clientPayload = { uuid: id, professionalsFullName, clientName, apptDate };
//   const proPayload = { uuid: id, professionalsFullName, proId };

//   const clientToken = jwt.sign(clientPayload, LINK_SECRET, { expiresIn: '4h' });
//   const proToken    = jwt.sign(proPayload, LINK_SECRET,    { expiresIn: '4h' });

//   // Build links pointing at your deployed frontend
//   const clientLink = `${FRONTEND_URL}/join-video?token=${encodeURIComponent(clientToken)}`;
//   const proLink    = `${FRONTEND_URL}/join-video-pro?token=${encodeURIComponent(proToken)}`;

//   return res.json({ uuid: id, clientLink, proLink });
// });

// app.post('/validate-link', (req, res) => {
//   const { token } = req.body;
//   if (!token) {
//     return res.status(400).json({ error: 'No token provided' });
//   }
//   try {
//     const decoded = jwt.verify(token, LINK_SECRET);
//     return res.json(decoded);
//   } catch (err) {
//     return res.status(401).json({ error: err.message });
//   }
// });

// // Create HTTP server & attach Socket.IO
// const server = http.createServer(app);
// const io = socketio(server, {
//   cors: {
//     origin: [FRONTEND_URL],
//     methods: ['GET', 'POST'],
//     credentials: true
//   }
// });

// // Real-time signaling
// io.on('connection', socket => {
//   console.log(`${socket.id} connected`);

//   // Authenticate via JWT in handshake
//   const token = socket.handshake.auth.jwt;
//   let payload;
//   try {
//     payload = jwt.verify(token, LINK_SECRET);
//   } catch (err) {
//     console.error('Invalid JWT:', err.message);
//     return socket.disconnect(true);
//   }

//   const { uuid, professionalsFullName, clientName, proId } = payload;
//   socket.join(uuid);

//   if (proId) {
//     console.log(`Pro ${professionalsFullName} joined room ${uuid}`);
//     // Replay buffered offer if exists
//     const record = allKnownOffers[uuid];
//     if (record && record.offer) {
//       console.log(`[SERVER] replaying buffered offer to Pro in room ${uuid}`);
//       socket.emit('newOfferWaiting', { uuid, offer: record.offer });
//     }
//   } else {
//     console.log(`Client ${clientName} joined room ${uuid}`);
//   }

//   socket.on('newOffer', ({ offer }) => {
//     allKnownOffers[uuid] = allKnownOffers[uuid] || {};
//     allKnownOffers[uuid].offer = offer;
//     socket.to(uuid).emit('newOfferWaiting', { uuid, offer });
//   });

//   socket.on('newAnswer', ({ answer }) => {
//     allKnownOffers[uuid] = allKnownOffers[uuid] || {};
//     allKnownOffers[uuid].answer = answer;
//     socket.to(uuid).emit('answerToClient', answer);
//   });

//   socket.on('iceToServer', ({ iceC, who }) => {
//     const rec = allKnownOffers[uuid] = allKnownOffers[uuid] || {};
//     const key = who === 'client' ? 'offererIceCandidates' : 'answerIceCandidates';
//     rec[key] = rec[key] || [];
//     rec[key].push(iceC);
//     socket.to(uuid).emit('iceToClient', { iceC, who });
//   });

//   socket.on('toggleVideo', ({ off }) => {
//     console.log(`[SERVER] toggleVideo in room ${uuid}: off=${off}`);
//     socket.to(uuid).emit('toggleVideo', { off });
//   });

//   socket.on('disconnect', () => {
//     console.log(`${socket.id} disconnected from room ${uuid}`);
//   });
// });

// // Start listening
// server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));


// server.js

const express  = require('express');
const cors     = require('cors');
const http     = require('http');            // <-- use HTTP, not HTTPS
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const socketio = require('socket.io');
const path     = require('path');

// ─── Config from ENV ───────────────────────────────────────────────────────────
const PORT         = process.env.PORT || 9000;
const LINK_SECRET  = process.env.LINK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;  // e.g. https://your-frontend.onrender.com

if (!LINK_SECRET)  { console.error('⚠️ LINK_SECRET is missing'); process.exit(1); }
if (!FRONTEND_URL){ console.error('⚠️ FRONTEND_URL is missing'); process.exit(1); }

// ─── Express App Setup ────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory state (swap out for a DB in prod)
const allKnownOffers = {};

// ─── REST Endpoints ───────────────────────────────────────────────────────────
// Create meeting links
app.post('/api/v1/links', (req, res) => {
  const { professionalsFullName, proId, clientName, apptDate, uuid } = req.body;
  const id = uuid || uuidv4();
  const clientPayload = { uuid: id, professionalsFullName, clientName, apptDate };
  const proPayload    = { uuid: id, professionalsFullName, proId };

  const clientToken = jwt.sign(clientPayload, LINK_SECRET, { expiresIn: '4h' });
  const proToken    = jwt.sign(proPayload, LINK_SECRET,    { expiresIn: '4h' });

  return res.json({
    uuid:       id,
    clientLink: `${FRONTEND_URL}/join-video?token=${encodeURIComponent(clientToken)}`,
    proLink:    `${FRONTEND_URL}/join-video-pro?token=${encodeURIComponent(proToken)}`,
  });
});

// Validate a token
app.post('/validate-link', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, LINK_SECRET);
    return res.json(decoded);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
});

// ─── HTTP & Socket.IO Setup ───────────────────────────────────────────────────
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin:      FRONTEND_URL,
    methods:     ['GET','POST'],
    credentials: true,
  }
});

io.on('connection', socket => {
  console.log(`🔗 ${socket.id} connected`);

  // 1) Verify JWT
  const token = socket.handshake.auth.jwt;
  let payload;
  try {
    payload = jwt.verify(token, LINK_SECRET);
  } catch (err) {
    console.error('❌ Invalid JWT:', err.message);
    return socket.disconnect(true);
  }
  const { uuid, professionalsFullName, clientName, proId } = payload;

  // 2) Join room
  socket.join(uuid);
  if (proId) {
    console.log(`👩‍⚕️ Pro ${professionalsFullName} joined ${uuid}`);
    // replay buffered offer if it exists
    const record = allKnownOffers[uuid];
    if (record && record.offer) {
      console.log(`🔄 Replaying offer to Pro in ${uuid}`);
      socket.emit('newOfferWaiting', { uuid, offer: record.offer });
    }
  } else {
    console.log(`👤 Client ${clientName} joined ${uuid}`);
  }

  // 3) Signaling
  socket.on('newOffer', ({ offer }) => {
    allKnownOffers[uuid] = allKnownOffers[uuid] || {};
    allKnownOffers[uuid].offer = offer;
    socket.to(uuid).emit('newOfferWaiting', { uuid, offer });
  });

  socket.on('newAnswer', ({ answer }) => {
    allKnownOffers[uuid] = allKnownOffers[uuid] || {};
    allKnownOffers[uuid].answer = answer;
    socket.to(uuid).emit('answerToClient', answer);
  });

  socket.on('iceToServer', ({ iceC, who }) => {
    const rec = allKnownOffers[uuid] = allKnownOffers[uuid] || {};
    const key = who === 'client'
      ? 'offererIceCandidates'
      : 'answerIceCandidates';
    rec[key] = rec[key] || [];
    rec[key].push(iceC);
    socket.to(uuid).emit('iceToClient', { iceC, who });
  });

  socket.on('toggleVideo', ({ off }) => {
    console.log(`[SERVER] toggleVideo ${uuid} off=${off}`);
    socket.to(uuid).emit('toggleVideo', { off });
  });

  socket.on('disconnect', () => {
    console.log(`❌ ${socket.id} disconnected from ${uuid}`);
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 Video-conf service listening on port ${PORT}`);
});
