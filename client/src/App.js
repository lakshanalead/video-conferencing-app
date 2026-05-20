import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  ParticipantTile,
  GridLayout,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

const API         = "https://videomeet-server-tu0p.onrender.com";
const LIVEKIT_URL = "wss://videomeet-2qywaag2.livekit.cloud";

function getToken() { return localStorage.getItem("vm_token"); }
function getUser()  { const u = localStorage.getItem("vm_user"); return u ? JSON.parse(u) : null; }
function saveSession(t, u) { localStorage.setItem("vm_token", t); localStorage.setItem("vm_user", JSON.stringify(u)); }
function clearSession() { localStorage.removeItem("vm_token"); localStorage.removeItem("vm_user"); }

// ── VideoGrid ─────────────────────────────────────────────────────────────────
function VideoGrid() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  return (
    <GridLayout tracks={tracks} style={{ height: "calc(100vh - 120px)" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

// ── AISummary ─────────────────────────────────────────────────────────────────
function AISummary({ transcript, meetingTitle, duration, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(function() { generateSummary(); }, [transcript, meetingTitle, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateSummary() {
    setLoading(true);
    try {
      const res  = await fetch(API + "/ai/summary", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
        body:    JSON.stringify({ transcript, meetingTitle, duration }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setSummary(data.summary);
      setLoading(false);
    } catch (err) {
      setError("Could not generate summary.");
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!summary) return;
    const text = "Meeting: " + meetingTitle + "\n\nOverview:\n" + summary.overview +
      "\n\nKey Points:\n" + summary.keyPoints.map(function(p) { return "• " + p; }).join("\n") +
      "\n\nDecisions:\n" + summary.decisions.map(function(d) { return "• " + d; }).join("\n") +
      "\n\nAction Items:\n" + summary.actionItems.map(function(a) { return "• " + a; }).join("\n");
    navigator.clipboard.writeText(text);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060608", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "680px", background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: "24px", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ background: "linear-gradient(135deg, #1a1040 0%, #0a1628 100%)", padding: "40px", textAlign: "center", borderBottom: "1px solid #1e1e24" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "12px" }}>🤖</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#fff", marginBottom: "6px", letterSpacing: "-0.5px" }}>AI Meeting Summary</div>
          <div style={{ color: "#6366f1", fontSize: "0.9rem", fontWeight: "500" }}>{meetingTitle} &nbsp;·&nbsp; {duration}</div>
        </div>

        {loading && (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>⏳</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>Analyzing your meeting...</div>
            <div style={{ color: "#555", fontSize: "0.88rem" }}>Claude AI is generating insights</div>
          </div>
        )}

        {error && (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ color: "#f87171", marginBottom: "16px", fontSize: "0.95rem" }}>❌ {error}</div>
            <button onClick={generateSummary} style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: "600" }}>Retry</button>
          </div>
        )}

        {summary && !loading && (
          <div style={{ padding: "32px" }}>
            {[
              { label: "📋 Overview", content: <div style={{ color: "#c4c4d4", fontSize: "0.92rem", lineHeight: "1.8" }}>{summary.overview}</div> },
              { label: "💡 Key Points", content: summary.keyPoints.map(function(p, i) { return <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", color: "#c4c4d4", fontSize: "0.88rem" }}><span style={{ color: "#6366f1", fontWeight: "700" }}>▸</span><span>{p}</span></div>; }) },
              { label: "✅ Decisions", content: summary.decisions.length > 0 ? summary.decisions.map(function(d, i) { return <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", color: "#c4c4d4", fontSize: "0.88rem" }}><span style={{ color: "#22c55e", fontWeight: "700" }}>▸</span><span>{d}</span></div>; }) : <div style={{ color: "#444", fontSize: "0.85rem", fontStyle: "italic" }}>No decisions recorded</div> },
              { label: "🎯 Action Items", content: summary.actionItems.length > 0 ? summary.actionItems.map(function(a, i) { return <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", color: "#c4c4d4", fontSize: "0.88rem" }}><span style={{ color: "#f59e0b", fontWeight: "700" }}>▸</span><span>{a}</span></div>; }) : <div style={{ color: "#444", fontSize: "0.85rem", fontStyle: "italic" }}>No action items</div> },
            ].map(function(section, i) {
              return (
                <div key={i} style={{ marginBottom: "28px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>{section.label}</div>
                  {section.content}
                </div>
              );
            })}

            {summary.sentiment && (
              <div style={{ background: "#1a1a22", border: "1px solid #252530", borderRadius: "12px", padding: "14px 18px", marginBottom: "28px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#888", fontSize: "0.85rem" }}>Meeting Tone:</span>
                <span style={{ color: "#86efac", fontWeight: "700", fontSize: "0.9rem" }}>{summary.sentiment}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={copyToClipboard} style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "1px solid #252530", background: "#1a1a22", color: "#c4c4d4", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>📋 Copy Summary</button>
              <button onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem" }}>Back to Dashboard</button>
            </div>
          </div>
        )}

        {transcript.length === 0 && !loading && !error && (
          <div style={{ padding: "60px", textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>💬</div>
            <div style={{ marginBottom: "6px", color: "#c4c4d4" }}>No chat messages recorded</div>
            <div style={{ fontSize: "0.85rem", marginBottom: "24px" }}>Use chat during meetings for AI summaries</div>
            <button onClick={onClose} style={{ padding: "12px 28px", borderRadius: "12px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: "700" }}>Back to Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MeetingRoom ───────────────────────────────────────────────────────────────
function MeetingRoom({ meetingId, meetingTitle, name, onLeave }) {
  const [token, setToken]           = useState(null);
  const [error, setError]           = useState("");
  const [chatOpen, setChatOpen]     = useState(false);
  const [messages, setMessages]     = useState([]);
  const [msgInput, setMsgInput]     = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [duration, setDuration]     = useState("0 min");
  const [targetLang, setTargetLang] = useState("en");
  const [translating, setTranslating] = useState(false);
  const [unread, setUnread]         = useState(0);

  const startTime  = useRef(Date.now());
  const chatBottom = useRef(null);
  const socketRef  = useRef(null);

  const LANGUAGES = [
    { code: "en", name: "🌐 No Translation" },
    { code: "hi", name: "🇮🇳 Hindi" },
    { code: "ta", name: "🇮🇳 Tamil" },
    { code: "te", name: "🇮🇳 Telugu" },
    { code: "ml", name: "🇮🇳 Malayalam" },
    { code: "kn", name: "🇮🇳 Kannada" },
    { code: "fr", name: "🇫🇷 French" },
    { code: "de", name: "🇩🇪 German" },
    { code: "es", name: "🇪🇸 Spanish" },
    { code: "zh", name: "🇨🇳 Chinese" },
    { code: "ja", name: "🇯🇵 Japanese" },
    { code: "ar", name: "🇸🇦 Arabic" },
  ];

  useEffect(function() {
    fetchToken();
    connectSocket();
    return function() {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(function() {
    if (chatBottom.current) chatBottom.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(function() {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  async function fetchToken() {
    try {
      const res  = await fetch(API + "/token?room=" + encodeURIComponent(meetingId) + "&identity=" + encodeURIComponent(name));
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setToken(data.token);
    } catch (err) { setError("Could not connect to meeting"); }
  }

  function connectSocket() {
    const sock = io(API, { transports: ["websocket", "polling"], withCredentials: false });
    socketRef.current = sock;
    sock.on("connect", function() { sock.emit("join-chat", { roomId: meetingId, name: name }); });
    sock.on("connect_error", function(err) { console.error("Socket error:", err.message); });
    sock.on("chat-message", function(msg) {
      setMessages(function(prev) { return [...prev, msg]; });
      setChatOpen(function(open) {
        if (!open) setUnread(function(u) { return u + 1; });
        return open;
      });
    });
  }

  async function translateMessage(text) {
    if (targetLang === "en") return text;
    setTranslating(true);
    try {
      const res  = await fetch(API + "/translate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: text, targetLang: targetLang }),
      });
      const data = await res.json();
      setTranslating(false);
      return data.translated || text;
    } catch (err) { setTranslating(false); return text; }
  }

  function sendMessage() {
    if (!msgInput.trim() || !socketRef.current) return;
    const original = msgInput.trim();
    setMsgInput("");
    translateMessage(original).then(function(translated) {
      var finalMessage = original;
      if (targetLang !== "en" && translated !== original && !translated.includes("unavailable")) {
        finalMessage = original + "\n🌐 " + translated;
      }
      socketRef.current.emit("chat-message", {
        roomId:  meetingId,
        message: finalMessage,
        sender:  name,
      });
    });
  }

  function handleLeave() {
    const mins = Math.round((Date.now() - startTime.current) / 60000);
    setDuration(mins < 1 ? "< 1 min" : mins + " min");
    if (messages.length > 0) { setShowSummary(true); } else { onLeave(); }
  }

  if (showSummary) {
    return <AISummary transcript={messages} meetingTitle={meetingTitle || meetingId} duration={duration} onClose={onLeave} />;
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#060608", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: "20px", padding: "40px", textAlign: "center", maxWidth: "380px" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>❌</div>
          <div style={{ color: "#f87171", marginBottom: "20px" }}>{error}</div>
          <button onClick={onLeave} style={{ padding: "12px 28px", borderRadius: "10px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: "700" }}>Back</button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", background: "#060608", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ color: "#6366f1", fontSize: "1rem", fontWeight: "600" }}>⏳ Connecting to meeting...</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#060608", display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ height: "56px", background: "#0a0a0e", borderBottom: "1px solid #1e1e24", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.3rem" }}>📹</span>
          <div>
            <div style={{ color: "#fff", fontWeight: "700", fontSize: "0.95rem", lineHeight: 1 }}>{meetingTitle || "Meeting"}</div>
            <div style={{ color: "#555", fontSize: "0.72rem", marginTop: "2px" }}>ID: {meetingId}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={function() { setChatOpen(function(v) { return !v; }); }}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: chatOpen ? "#6366f1" : "#1e1e24", color: "#fff", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", position: "relative" }}
          >
            💬 Chat
            {unread > 0 && (
              <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ef4444", borderRadius: "50%", width: "16px", height: "16px", fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800" }}>
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={handleLeave}
            style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: "0.85rem", fontWeight: "700" }}
          >
            🚪 Leave
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <style>{`
            .lk-control-bar {
              background: #1a1a2e !important;
              border-top: 1px solid #2a2a4a !important;
              padding: 12px 20px !important;
            }
            .lk-button {
              background: #2a2a4a !important;
              color: #ffffff !important;
              border: 1px solid #3a3a5a !important;
              border-radius: 10px !important;
              font-weight: 700 !important;
              min-width: 80px !important;
              padding: 10px 16px !important;
            }
            .lk-button:hover {
              background: #6366f1 !important;
              border-color: #6366f1 !important;
            }
            .lk-button[aria-pressed="true"],
            .lk-button[data-lk-active="true"] {
              background: #dc2626 !important;
              border-color: #dc2626 !important;
            }
            .lk-button svg {
              color: #ffffff !important;
              fill: #ffffff !important;
            }
            .lk-button span {
              color: #ffffff !important;
              font-size: 0.78rem !important;
            }
            .lk-participant-name {
              color: #ffffff !important;
              background: rgba(0,0,0,0.7) !important;
              padding: 3px 8px !important;
              border-radius: 6px !important;
            }
          `}</style>
          <LiveKitRoom
            token={token}
            serverUrl={LIVEKIT_URL}
            connect={true}
            video={true}
            audio={true}
            onDisconnected={handleLeave}
            style={{ height: "100%", flex: 1 }}
          >
            <VideoGrid />
            <RoomAudioRenderer />
            <ControlBar />
          </LiveKitRoom>
        </div>

        {chatOpen && (
          <div style={{ width: "320px", flexShrink: 0, background: "#0a0a0e", borderLeft: "1px solid #1e1e24", display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #1e1e24", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#fff", fontWeight: "700", fontSize: "0.95rem" }}>💬 Meeting Chat</span>
              <button onClick={function() { setChatOpen(false); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "#444", fontSize: "0.85rem", marginTop: "40px" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>💬</div>
                  No messages yet
                </div>
              )}
              {messages.map(function(m, i) {
                const mine = m.sender === name;
                return (
                  <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    {!mine && <div style={{ fontSize: "0.7rem", color: "#6366f1", marginBottom: "3px", fontWeight: "600" }}>{m.sender}</div>}
                    <div style={{ background: mine ? "#6366f1" : "#1a1a22", borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", border: mine ? "none" : "1px solid #252530" }}>
                      <div style={{ fontSize: "0.87rem", color: "#fff", wordBreak: "break-word", lineHeight: "1.5" }}>{m.message}</div>
                      <div style={{ fontSize: "0.65rem", color: mine ? "rgba(255,255,255,0.5)" : "#555", marginTop: "4px", textAlign: "right" }}>{m.time}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottom} />
            </div>

            <div style={{ padding: "10px 14px 6px", borderTop: "1px solid #1e1e24" }}>
              <select
                value={targetLang}
                onChange={function(e) { setTargetLang(e.target.value); }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #252530", background: "#1a1a22", color: "#c4c4d4", fontSize: "0.78rem", outline: "none", cursor: "pointer" }}
              >
                {LANGUAGES.map(function(l) { return <option key={l.code} value={l.code}>{l.name}</option>; })}
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px", padding:"10px 14px 14px" }}>
              <input
                style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #252530", background: "#1a1a22", color: "#fff", fontSize: "0.87rem", outline: "none" }}
                placeholder={translating ? "Translating..." : "Type a message..."}
                value={msgInput}
                onChange={function(e) { setMsgInput(e.target.value); }}
                onKeyDown={function(e) { if (e.key === "Enter") sendMessage(); }}
              />
              <button
                onClick={sendMessage}
                style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "0.87rem" }}
              >
                {translating ? "..." : "↑"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AuthScreen ────────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState("login");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) { setError("All fields required"); return; }
    if (mode === "signup" && !name.trim()) { setError("Enter your name"); return; }
    setError("");
    setLoading(true);
    try {
      const body = mode === "signup" ? { name, email, password } : { email, password };
      const res  = await fetch(API + "/auth/" + mode, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      saveSession(data.token, data.user);
      onAuth(data.user);
    } catch (err) { setError("Server error. Please try again."); setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060608", display: "flex", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ marginBottom: "48px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📹</div>
          <div style={{ fontSize: "2.8rem", fontWeight: "800", color: "#fff", letterSpacing: "-1px", marginBottom: "8px" }}>VideoMeet</div>
          <div style={{ color: "#555", fontSize: "1rem" }}>Professional Video Conferencing + AI</div>
        </div>

        <div style={{ width: "100%", maxWidth: "420px", background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: "24px", padding: "36px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", marginBottom: "28px", background: "#1a1a22", borderRadius: "12px", padding: "4px" }}>
            {["login", "signup"].map(function(m) {
              return (
                <button
                  key={m}
                  onClick={function() { setMode(m); setError(""); }}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: "10px", background: mode === m ? "#6366f1" : "transparent", color: mode === m ? "#fff" : "#666", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem", transition: "all 0.2s" }}
                >
                  {m === "login" ? "Login" : "Sign Up"}
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "10px", padding: "10px 14px", color: "#f87171", fontSize: "0.85rem", marginBottom: "16px" }}>
              ⚠️ {error}
            </div>
          )}

          {mode === "signup" && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#888", fontSize: "0.78rem", fontWeight: "600", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
              <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #1e1e24", background: "#1a1a22", color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
                placeholder="Your full name" value={name} onChange={function(e) { setName(e.target.value); }} />
            </div>
          )}

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", color: "#888", fontSize: "0.78rem", fontWeight: "600", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Address</label>
            <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #1e1e24", background: "#1a1a22", color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
              placeholder="you@email.com" value={email} type="email" onChange={function(e) { setEmail(e.target.value); }} />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", color: "#888", fontSize: "0.78rem", fontWeight: "600", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
            <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #1e1e24", background: "#1a1a22", color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
              placeholder="••••••••" value={password} type="password" onChange={function(e) { setPass(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") handleSubmit(); }} />
          </div>

          <button
            onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: loading ? "#3d3d8f" : "#6366f1", color: "#fff", fontSize: "1rem", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Login to VideoMeet" : "Create Account"}
          </button>
        </div>

        <div style={{ marginTop: "32px", display: "flex", gap: "24px" }}>
          {["🔒 Secure", "⚡ Fast", "🤖 AI Powered", "🌍 Multi-language"].map(function(f) {
            return <div key={f} style={{ color: "#444", fontSize: "0.8rem", fontWeight: "600" }}>{f}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ user, onJoinMeeting, onLogout }) {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle]       = useState("");
  const [joinId, setJoinId]     = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied]     = useState(null);

  useEffect(function() { loadMeetings(); }, []);

  async function loadMeetings() {
    try {
      const res  = await fetch(API + "/meetings", { headers: { Authorization: "Bearer " + getToken() } });
      const data = await res.json();
      if (data.meetings) setMeetings(data.meetings);
    } catch (err) { console.error(err); }
  }

  async function createMeeting() {
    if (!title.trim()) { setError("Enter a meeting title"); return; }
    setError(""); setCreating(true);
    try {
      const res  = await fetch(API + "/meetings/create", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ title }) });
      const data = await res.json();
      if (data.error) { setError(data.error); setCreating(false); return; }
      setTitle(""); setCreating(false);
      loadMeetings();
      onJoinMeeting({ meetingId: data.meeting.meetingId, meetingTitle: title, name: user.name });
    } catch (err) { setError("Could not create meeting"); setCreating(false); }
  }

  async function joinByLink() {
    if (!joinId.trim()) { setError("Enter a meeting ID"); return; }
    setError(""); setLoading(true);
    const id = joinId.trim().split("/").pop();
    try {
      const res  = await fetch(API + "/meetings/" + id);
      const data = await res.json();
      if (data.error) { setError("Meeting not found"); setLoading(false); return; }
      setLoading(false);
      onJoinMeeting({ meetingId: id, meetingTitle: data.meeting.title, name: user.name });
    } catch (err) { setError("Meeting not found"); setLoading(false); }
  }

  function copyLink(meetingId) {
    const url = window.location.origin + "/meet/" + meetingId;
    navigator.clipboard.writeText(url);
    setCopied(meetingId);
    setTimeout(function() { setCopied(null); }, 2000);
  }

  const initials = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div style={{ minHeight: "100vh", background: "#060608", fontFamily: "'Segoe UI', sans-serif", color: "#f0f0f0" }}>
      <div style={{ background: "#0a0a0e", borderBottom: "1px solid #1e1e24", padding: "0 32px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", height: "64px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.5rem" }}>📹</span>
            <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>VideoMeet</span>
            <span style={{ background: "#1a2e1a", border: "1px solid #22c55e", borderRadius: "20px", padding: "2px 10px", fontSize: "0.72rem", color: "#86efac", fontWeight: "700" }}>✨ AI + Translation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.9rem", color: "#fff" }}>{initials}</div>
            <span style={{ color: "#888", fontSize: "0.9rem" }}>{user.name}</span>
            <button onClick={function() { clearSession(); onLogout(); }} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #1e1e24", background: "none", color: "#888", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600" }}>Logout</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#fff", marginBottom: "6px", letterSpacing: "-0.5px" }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]} 👋
          </div>
          <div style={{ color: "#555", fontSize: "0.95rem" }}>Start a new meeting or join an existing one</div>
        </div>

        {error && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "12px", padding: "12px 18px", color: "#f87171", fontSize: "0.88rem", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
          <div style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: "20px", padding: "28px" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🎬</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>New Meeting</div>
            <div style={{ color: "#555", fontSize: "0.85rem", marginBottom: "20px" }}>Start an instant meeting with AI summary</div>
            <input
              style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #1e1e24", background: "#1a1a22", color: "#fff", fontSize: "0.9rem", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}
              placeholder="Meeting title (e.g. Team Standup)"
              value={title} onChange={function(e) { setTitle(e.target.value); }}
            />
            <button
              onClick={createMeeting} disabled={creating}
              style={{ width: "100%", padding: "13px", borderRadius: "11px", border: "none", background: creating ? "#3d3d8f" : "#6366f1", color: "#fff", fontWeight: "700", cursor: creating ? "not-allowed" : "pointer", fontSize: "0.95rem" }}
            >
              {creating ? "Creating..." : "🚀 Start Meeting"}
            </button>
          </div>

          <div style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: "20px", padding: "28px" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔗</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>Join Meeting</div>
            <div style={{ color: "#555", fontSize: "0.85rem", marginBottom: "20px" }}>Enter a meeting ID or paste a link</div>
            <input
              style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #1e1e24", background: "#1a1a22", color: "#fff", fontSize: "0.9rem", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}
              placeholder="Meeting ID or full link"
              value={joinId} onChange={function(e) { setJoinId(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") joinByLink(); }}
            />
            <button
              onClick={joinByLink} disabled={loading}
              style={{ width: "100%", padding: "13px", borderRadius: "11px", border: "none", background: loading ? "#065f46" : "#059669", color: "#fff", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontSize: "0.95rem" }}
            >
              {loading ? "Checking..." : "Join Meeting"}
            </button>
          </div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #1a1040, #0a1628)", border: "1px solid #252540", borderRadius: "20px", padding: "24px 28px", marginBottom: "32px", display: "flex", gap: "20px", alignItems: "center" }}>
          <div style={{ fontSize: "2.5rem", flexShrink: 0 }}>🤖</div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "1rem", color: "#818cf8", marginBottom: "4px" }}>AI Meeting Summary + Multi-language Chat</div>
            <div style={{ color: "#555", fontSize: "0.85rem", lineHeight: "1.6" }}>After every meeting, Claude AI analyzes your chat and generates key points, decisions and action items. Chat messages can be auto-translated to 12+ languages in real time.</div>
          </div>
        </div>

        {meetings.length > 0 && (
          <div style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: "20px", padding: "28px" }}>
            <div style={{ fontSize: "1rem", fontWeight: "700", color: "#fff", marginBottom: "20px" }}>📋 Recent Meetings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {meetings.map(function(m) {
                return (
                  <div key={m._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#1a1a22", border: "1px solid #1e1e24", borderRadius: "12px" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.92rem", color: "#fff" }}>{m.title}</div>
                      <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "2px" }}>ID: {m.meetingId}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={function() { copyLink(m.meetingId); }}
                        style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: copied === m.meetingId ? "#059669" : "#252530", color: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: "600" }}
                      >
                        {copied === m.meetingId ? "✅ Copied!" : "📋 Copy Link"}
                      </button>
                      <button
                        onClick={function() { onJoinMeeting({ meetingId: m.meetingId, meetingTitle: m.title, name: user.name }); }}
                        style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: "700" }}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(getUser);
  const [session, setSession] = useState(null);

  if (session) {
    return (
      <MeetingRoom
        meetingId={session.meetingId}
        meetingTitle={session.meetingTitle}
        name={session.name}
        onLeave={function() { setSession(null); }}
      />
    );
  }

  if (user) {
    return (
      <Dashboard
        user={user}
        onJoinMeeting={setSession}
        onLogout={function() { setUser(null); }}
      />
    );
  }

  return <AuthScreen onAuth={setUser} />;
}