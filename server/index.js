require("dotenv").config();
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");
const mongoose   = require("mongoose");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { AccessToken } = require("livekit-server-sdk");

const User    = require("./models/User");
const Meeting = require("./models/Meeting");

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST"], credentials: false }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: false },
  transports: ["websocket", "polling"],
});

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(function() { console.log("✅ MongoDB connected"); })
  .catch(function(err) { console.log("❌ MongoDB error:", err.message); });

// ── JWT middleware ─────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post("/auth/signup", async function(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields required" });
    const existing = await User.findOne({ email: email });
    if (existing) return res.status(400).json({ error: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name: name, email: email, password: hashed });
    const token  = jwt.sign({ id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token: token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/login", async function(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "All fields required" });
    const user = await User.findOne({ email: email });
    if (!user) return res.status(400).json({ error: "Invalid email or password" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid email or password" });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token: token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/auth/me", authMiddleware, async function(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ user: user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── MEETINGS ──────────────────────────────────────────────────────────────────
app.post("/meetings/create", authMiddleware, async function(req, res) {
  try {
    const meetingId = uuidv4().slice(0, 8);
    const meeting   = await Meeting.create({
      meetingId: meetingId,
      title:     req.body.title || "My Meeting",
      hostId:    req.user.id,
    });
    res.json({ meeting: meeting });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meetings/:meetingId", async function(req, res) {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId }).populate("hostId", "name email");
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json({ meeting: meeting });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meetings", authMiddleware, async function(req, res) {
  try {
    const meetings = await Meeting.find({ hostId: req.user.id }).sort({ createdAt: -1 }).limit(10);
    res.json({ meetings: meetings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LIVEKIT TOKEN ─────────────────────────────────────────────────────────────
app.get("/token", async function(req, res) {
  const { room, identity } = req.query;
  if (!room || !identity) return res.status(400).json({ error: "room and identity required" });
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: identity, ttl: "1h" });
  at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  res.json({ token: token });
});

// ── TRANSLATION (using Gemini AI) ─────────────────────────────────────────────
app.post("/translate", async function(req, res) {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) return res.status(400).json({ error: "text and targetLang required" });
    if (targetLang === "en") return res.json({ translated: text });

    const langNames = {
      hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam",
      kn: "Kannada", fr: "French", de: "German", es: "Spanish",
      zh: "Chinese", ja: "Japanese", ar: "Arabic",
    };

    const langName = langNames[targetLang] || targetLang;
    const prompt   = "Translate this English text to " + langName + ". Return ONLY the translated text, nothing else, no explanation:\n\n" + text;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      process.env.GEMINI_API_KEY,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    console.log("Translation response:", JSON.stringify(data).slice(0, 300));

    if (!data.candidates || !data.candidates[0]) {
      return res.status(500).json({ error: "Translation API error" });
    }

    const translated = data.candidates[0].content.parts[0].text.trim();
    res.json({ translated: translated });

  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── AI SUMMARY ────────────────────────────────────────────────────────────────
app.post("/ai/summary", async function(req, res) {
  try {
    const { transcript, meetingTitle, duration } = req.body;
    if (!transcript || transcript.length === 0) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    const formattedChat = transcript.map(function(m) {
      return "[" + (m.time || "") + "] " + m.sender + ": " + m.message;
    }).join("\n");

    const prompt =
      "You are an expert meeting analyst. Analyze this meeting chat transcript and provide a structured summary.\n\n" +
      "Meeting: " + meetingTitle + "\n" +
      "Duration: " + duration + "\n\n" +
      "Chat Transcript:\n" + formattedChat + "\n\n" +
      "Respond ONLY with a valid JSON object in exactly this format, no extra text:\n" +
      "{\n" +
      "  \"overview\": \"2-3 sentence summary\",\n" +
      "  \"keyPoints\": [\"point 1\", \"point 2\", \"point 3\"],\n" +
      "  \"decisions\": [\"decision 1\"],\n" +
      "  \"actionItems\": [\"action 1\"],\n" +
      "  \"sentiment\": \"Productive\"\n" +
      "}";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      process.env.GEMINI_API_KEY,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const aiData = await response.json();
    console.log("Gemini summary response:", JSON.stringify(aiData).slice(0, 500));

    if (!aiData.candidates || !aiData.candidates[0]) {
      return res.status(500).json({ error: "Gemini API error: " + JSON.stringify(aiData) });
    }

    const text    = aiData.candidates[0].content.parts[0].text;
    const cleaned = text.replace(/```json|```/g, "").trim();

    let summary;
    try {
      summary = JSON.parse(cleaned);
    } catch (parseErr) {
      summary = {
        overview:    "Meeting completed successfully.",
        keyPoints:   ["Chat was active during the meeting"],
        decisions:   [],
        actionItems: [],
        sentiment:   "Productive",
      };
    }

    res.json({ summary: summary });

  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ error: "Failed to generate summary: " + err.message });
  }
});

// ── SOCKET ────────────────────────────────────────────────────────────────────
io.on("connection", function(socket) {
  console.log("Socket connected:", socket.id);

  socket.on("join-chat", function(data) {
    socket.join(data.roomId);
    socket.roomId = data.roomId;
    socket.name   = data.name;
  });

  socket.on("chat-message", function(data) {
    io.in(data.roomId).emit("chat-message", {
      sender:  data.sender,
      message: data.message,
      time:    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  socket.on("disconnect", function() {
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, function() {
  console.log("Server running on port " + PORT);
});