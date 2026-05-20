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
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: false,
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  },
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
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId })
      .populate("hostId", "name email");
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

// ── AI SUMMARY ────────────────────────────────────────────────────────────────
app.post("/ai/summary", async function(req, res) {
  try {
    const { transcript, meetingTitle, duration } = req.body;

    if (!transcript || transcript.length === 0) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    // Format transcript for Claude
    const formattedChat = transcript.map(function(m) {
      return "[" + (m.time || "") + "] " + m.sender + ": " + m.message;
    }).join("\n");

    const prompt =
      "You are an expert meeting analyst. Analyze this meeting chat transcript and provide a structured summary.\n\n" +
      "Meeting: " + meetingTitle + "\n" +
      "Duration: " + duration + "\n\n" +
      "Chat Transcript:\n" + formattedChat + "\n\n" +
      "Respond ONLY with a valid JSON object in exactly this format with no extra text:\n" +
      "{\n" +
      "  \"overview\": \"2-3 sentence summary of what the meeting was about\",\n" +
      "  \"keyPoints\": [\"point 1\", \"point 2\", \"point 3\"],\n" +
      "  \"decisions\": [\"decision 1\", \"decision 2\"],\n" +
      "  \"actionItems\": [\"action item 1\", \"action item 2\"],\n" +
      "  \"sentiment\": \"Productive / Collaborative / Informational / Mixed\"\n" +
      "}";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
      process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const aiData = await response.json();
    console.log("Gemini response:", JSON.stringify(aiData).slice(0, 500));

    if (!aiData.candidates || !aiData.candidates[0]) {
      return res.status(500).json({ error: "Gemini API error: " + JSON.stringify(aiData) });
    }

    const text    = aiData.candidates[0].content.parts[0].text;
    const cleaned = text.replace(/```json|```/g, "").trim();

    let summary;
    try {
      summary = JSON.parse(cleaned);
    } catch (parseErr) {
      // If JSON parse fails, create a basic summary from the text
      summary = {
        overview:    text.slice(0, 300),
        keyPoints:   ["See full response above"],
        decisions:   [],
        actionItems: [],
        sentiment:   "Informational",
      };
    }
    res.json({ summary: summary });

  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ error: "Failed to generate summary: " + err.message });
  }
});


// ── TRANSLATION ───────────────────────────────────────────────────────────────
app.post("/translate", async function(req, res) {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: "text and targetLang required" });
    }

    console.log("Translating:", text, "to", targetLang);

    // Primary: MyMemory API - most reliable free option
    const myMemoryUrl = "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) + "&langpair=en|" + targetLang +
      "&de=videomeet@gmail.com";

    const response = await fetch(myMemoryUrl);
    const data     = await response.json();

    console.log("MyMemory status:", data.responseStatus);
    console.log("MyMemory result:", data.responseData && data.responseData.translationText);

    if (
      data.responseStatus === 200 &&
      data.responseData &&
      data.responseData.translationText &&
      data.responseData.translationText.toLowerCase().trim() !== text.toLowerCase().trim()
    ) {
      return res.json({ translated: data.responseData.translationText });
    }

    // Secondary: try MyMemory with different format
    const myMemoryUrl2 = "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) + "&langpair=en-US|" + targetLang;

    const response2 = await fetch(myMemoryUrl2);
    const data2     = await response2.json();

    if (
      data2.responseStatus === 200 &&
      data2.responseData &&
      data2.responseData.translationText &&
      data2.responseData.translationText.toLowerCase().trim() !== text.toLowerCase().trim()
    ) {
      return res.json({ translated: data2.responseData.translationText });
    }

    // If both fail return error so client knows
    return res.status(500).json({ error: "Translation failed for language: " + targetLang });

  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── SOCKET (chat) ─────────────────────────────────────────────────────────────
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