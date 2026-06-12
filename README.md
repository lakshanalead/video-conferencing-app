cat > /home/claude/README_accurate.md << 'ENDOFFILE'
# 📹 VideoMeet — AI-Powered Video Conferencing App

> A production-grade, full-stack real-time video conferencing application built with WebRTC, LiveKit SFU, Socket.IO, MongoDB, and Google Gemini AI.

![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-orange)
![LiveKit](https://img.shields.io/badge/LiveKit-SFU-purple)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-darkgreen)
![Gemini AI](https://img.shields.io/badge/Gemini_1.5_Flash-AI-red)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black)

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| **Frontend** | https://video-conferencing-app-qyjg.vercel.app |
| **Backend API** | https://videomeet-server-tu0p.onrender.com |
| **GitHub** | https://github.com/lakshanalead/video-conferencing-app |

---

## ✨ Features

### Phase 1 — Core Features
- 🔐 **User Authentication** — Email signup/login with bcrypt password hashing and JWT session management (7-day tokens)
- 🎬 **Meeting Creation** — Unique 8-character UUID meeting ID generated and stored in MongoDB
- 🔗 **Join via Link** — Anyone can join using a meeting ID — no login required to join
- 📹 **Real-Time Video & Audio** — WebRTC media streaming via LiveKit SFU (scales to 100+ users)
- 🎤 **Mute / Unmute** — Toggle microphone during meeting
- 📷 **Camera On/Off** — Toggle camera during meeting
- 🖥️ **Screen Sharing** — Share entire screen or specific browser tab
- 💬 **Real-Time Chat** — Socket.IO messaging with sender name and timestamps
- 👥 **Participant Controls** — Host can mute all, remove users, view participant list

### Bonus Features
- 🤖 **AI Meeting Summary** — Gemini 1.5 Flash analyzes chat transcript and generates overview, key points, decisions, and action items
- 🌍 **Multi-Language Translation** — Gemini AI translates chat messages to 11 languages in real time
- 📱 **PWA Support** — Installable as a mobile app on Android and iOS

---

## 🏗️ Architecture

```
User Browser (React PWA)
        ↓
  Vercel (Frontend - React)
        ↓
  Render (Backend - Node.js + Express)
        ↓
  ├── MongoDB Atlas       → Users & Meetings storage
  ├── LiveKit Cloud       → Video/Audio SFU routing
  ├── Socket.IO           → Real-time chat & signaling
  └── Google Gemini AI    → Meeting summary & translation
```

### P2P vs SFU — Why LiveKit was chosen

| | P2P (Peer-to-Peer) | SFU (LiveKit) |
|---|---|---|
| Max users | 2–4 | 100+ |
| Media routing | Direct browser-to-browser | Through central server |
| Bandwidth per user | High — connects to everyone | Low — one connection |
| Used by | Basic demos | Zoom, Google Meet, Teams |

---

## 🛠️ Tech Stack

### Frontend (`client/`)
| Technology | Version | Purpose |
|---|---|---|
| React.js | 18 | UI framework |
| @livekit/components-react | Latest | Video grid, controls, participant tiles |
| livekit-client | Latest | WebRTC media handling |
| socket.io-client | Latest | Real-time chat connection |

### Backend (`server/`)
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Socket.IO | Real-time chat broadcasting |
| Mongoose + MongoDB | Database ORM |
| bcryptjs | Password hashing (salt rounds: 10) |
| jsonwebtoken | JWT auth (7-day expiry) |
| uuid | 8-character meeting ID generation |
| livekit-server-sdk | LiveKit access token generation |

### AI & Cloud Services
| Service | Purpose |
|---|---|
| Google Gemini 1.5 Flash | Meeting summary + chat translation |
| MongoDB Atlas | Cloud database |
| LiveKit Cloud | SFU media server |
| Vercel | Frontend hosting |
| Render | Backend hosting |

---

## 📁 Project Structure

```
video-conferencing-app/
├── client/                        # React frontend
│   ├── public/
│   │   ├── manifest.json          # PWA configuration
│   │   ├── index.html
│   │   ├── logo192.png
│   │   └── logo512.png
│   └── src/
│       ├── App.js                 # Main app — Auth, Dashboard, Meeting, AI Summary
│       └── index.js               # React entry point
│
└── server/                        # Node.js backend
    ├── models/
    │   ├── User.js                # User schema (name, email, password, createdAt)
    │   └── Meeting.js             # Meeting schema (meetingId, title, hostId, isActive)
    ├── index.js                   # Express server — all routes + Socket.IO
    ├── .env                       # Environment variables (not in git)
    └── package.json
```

---

## ⚙️ Environment Variables

Create `server/.env`:

```env
MONGO_URI          = mongodb+srv://<user>:<password>@cluster.mongodb.net/videomeet
JWT_SECRET         = your_jwt_secret_key
LIVEKIT_API_KEY    = your_livekit_api_key
LIVEKIT_API_SECRET = your_livekit_api_secret
GEMINI_API_KEY     = your_gemini_api_key
PORT               = 5000
CLIENT_URL         = https://your-vercel-url.vercel.app
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | ❌ | Register — name, email, password |
| POST | `/auth/login` | ❌ | Login — returns JWT token |
| GET | `/auth/me` | ✅ JWT | Get current logged-in user |

### Meetings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/meetings/create` | ✅ JWT | Create meeting — returns unique meetingId |
| GET | `/meetings/:meetingId` | ❌ | Get meeting details by ID |
| GET | `/meetings` | ✅ JWT | Get last 10 meetings by host |

### Media & AI
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/token` | ❌ | Get LiveKit room access token |
| POST | `/translate` | ❌ | Translate text using Gemini AI |
| POST | `/ai/summary` | ✅ JWT | Generate meeting summary from transcript |

### Socket.IO Events
| Event | Direction | Description |
|---|---|---|
| `join-chat` | Client → Server | Join a meeting chat room |
| `chat-message` | Client → Server | Send a message |
| `chat-message` | Server → Client | Receive a message (broadcast) |

---

## 🌍 Supported Translation Languages

| Code | Language |
|---|---|
| `hi` | Hindi |
| `ta` | Tamil |
| `te` | Telugu |
| `ml` | Malayalam |
| `kn` | Kannada |
| `fr` | French |
| `de` | German |
| `es` | Spanish |
| `zh` | Chinese |
| `ja` | Japanese |
| `ar` | Arabic |

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- LiveKit Cloud account
- Google Gemini API key (free at aistudio.google.com)

### Step 1 — Clone
```bash
git clone https://github.com/lakshanalead/video-conferencing-app.git
cd video-conferencing-app
```

### Step 2 — Server setup
```bash
cd server
npm install
# Create .env file with variables listed above
```

### Step 3 — Download LiveKit server binary
```bash
# Download livekit-server.exe from:
# https://github.com/livekit/livekit/releases/latest
# Place inside server/ folder
.\livekit-server.exe --dev
```

### Step 4 — Run server
```bash
node index.js
# Output: Server running on port 5000
```

### Step 5 — Client setup
```bash
cd ../client
npm install
```

Update `client/src/App.js` lines 13–14 for local development:
```js
const API         = "http://localhost:5000";
const LIVEKIT_URL = "ws://localhost:7880";
```

### Step 6 — Run client
```bash
npm start
# Opens http://localhost:3000
```

---

## 📱 PWA — Install as Mobile App

### Android (Chrome)
1. Open `https://video-conferencing-app-qyjg.vercel.app` in Chrome
2. Tap ⋮ (3 dots) → **Add to Home Screen**
3. Tap **Add** — app icon appears on home screen

### iPhone (Safari)
1. Open the URL in Safari
2. Tap Share button → **Add to Home Screen**
3. Tap **Add**

---

## 📋 Internship Submission Checklist

### Phase 1 — Core (All Complete ✅)
- ✅ User Authentication — Email + bcrypt + JWT
- ✅ Session Management — JWT 7-day tokens
- ✅ Unique Meeting ID — UUID generation
- ✅ Join via Link — No login required to join
- ✅ Real-Time Video & Audio — WebRTC + LiveKit SFU
- ✅ Mute / Unmute
- ✅ Camera On/Off
- ✅ Screen Sharing — getDisplayMedia() + replaceTrack()
- ✅ Real-Time Chat — Socket.IO with timestamps
- ✅ Host Controls — Mute all, remove user
- ✅ Participant List Panel
- ✅ MongoDB Database — Users and Meetings
- ✅ Deployed and Live

### Bonus (Beyond Requirements ✅)
- ✅ SFU Architecture — LiveKit (100+ users)
- ✅ AI Meeting Summary — Gemini 1.5 Flash
- ✅ Multi-Language Translation — 11 languages
- ✅ PWA Mobile App Support

### Phase 2 — Planned
- ⏳ Meeting Recording
- ⏳ Live Captions
- ⏳ Raise Hand / Reactions
- ⏳ Breakout Rooms
- ⏳ Background Blur

---

## 🚦 Deployment Info

| Layer | Platform | Trigger |
|---|---|---|
| Frontend | Vercel | Auto on GitHub push |
| Backend | Render | Auto on GitHub push |
| Database | MongoDB Atlas | Always running |
| Media Server | LiveKit Cloud | Always running |

---

## 👩‍💻 Developer

**Lakshana**
Internship Project — SOFZENIX IT SOLUTIONS LLP
May 2026

---

> *"Started with P2P WebRTC, upgraded to SFU architecture, added AI — built end to end from scratch."*
ENDOFFILE
echo "README done: $(wc -l < /home/claude/README_accurate.md) lines"
