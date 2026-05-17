import { useState, useEffect, useRef } from "react";
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

// ── helpers ───────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("vm_token"); }
function getUser()  {
  const u = localStorage.getItem("vm_user");
  return u ? JSON.parse(u) : null;
}
function saveSession(token, user) {
  localStorage.setItem("vm_token", token);
  localStorage.setItem("vm_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("vm_token");
  localStorage.removeItem("vm_user");
}

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

// ── AISummary Screen ──────────────────────────────────────────────────────────
function AISummary({ transcript, meetingTitle, duration, onClose }) {
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(function() {
    generateSummary();
  }, [transcript, meetingTitle, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await fetch(API + "/ai/summary", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  "Bearer " + getToken(),
        },
        body: JSON.stringify({
          transcript:   transcript,
          meetingTitle: meetingTitle,
          duration:     duration,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setSummary(data.summary);
      setLoading(false);
    } catch (err) {
      setError("Could not generate summary. Is the server running?");
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!summary) return;
    const text =
      "Meeting Summary: " + meetingTitle + "\n\n" +
      "Overview:\n" + summary.overview + "\n\n" +
      "Key Points:\n" + summary.keyPoints.map(function(p) { return "• " + p; }).join("\n") + "\n\n" +
      "Decisions:\n" + summary.decisions.map(function(d) { return "• " + d; }).join("\n") + "\n\n" +
      "Action Items:\n" + summary.actionItems.map(function(a) { return "• " + a; }).join("\n");
    navigator.clipboard.writeText(text);
  }

  return (
    <div style={s.page}>
      <div style={s.summaryWrap}>
        <div style={s.summaryHeader}>
          <div style={s.summaryIcon}>🤖</div>
          <div style={s.summaryTitle}>AI Meeting Summary</div>
          <div style={s.summaryMeta}>
            {meetingTitle} &nbsp;·&nbsp; {duration}
          </div>
        </div>

        {loading && (
          <div style={s.loadingBox}>
            <div style={s.spinner}>⏳</div>
            <div style={s.loadingText}>Claude AI is analyzing your meeting...</div>
            <div style={s.loadingSubText}>This takes a few seconds</div>
          </div>
        )}

        {error && (
          <div style={s.errorBox}>
            <div style={{ marginBottom: "8px" }}>❌ {error}</div>
            <button style={s.retryBtn} onClick={generateSummary}>Retry</button>
          </div>
        )}

        {summary && !loading && (
          <div style={s.summaryBody}>
            <div style={s.summarySection}>
              <div style={s.sectionLabel}>📋 Overview</div>
              <div style={s.sectionText}>{summary.overview}</div>
            </div>

            <div style={s.summarySection}>
              <div style={s.sectionLabel}>💡 Key Points</div>
              {summary.keyPoints.map(function(point, i) {
                return (
                  <div key={i} style={s.listItem}>
                    <span style={s.bullet}>▸</span>
                    <span>{point}</span>
                  </div>
                );
              })}
            </div>

            <div style={s.summarySection}>
              <div style={s.sectionLabel}>✅ Decisions Made</div>
              {summary.decisions.length > 0
                ? summary.decisions.map(function(d, i) {
                    return (
                      <div key={i} style={s.listItem}>
                        <span style={s.bullet}>▸</span>
                        <span>{d}</span>
                      </div>
                    );
                  })
                : <div style={s.emptyNote}>No specific decisions recorded</div>
              }
            </div>

            <div style={s.summarySection}>
              <div style={s.sectionLabel}>🎯 Action Items</div>
              {summary.actionItems.length > 0
                ? summary.actionItems.map(function(a, i) {
                    return (
                      <div key={i} style={s.listItem}>
                        <span style={Object.assign({}, s.bullet, { color: "#f59e0b" })}>▸</span>
                        <span>{a}</span>
                      </div>
                    );
                  })
                : <div style={s.emptyNote}>No action items identified</div>
              }
            </div>

            {summary.sentiment && (
              <div style={s.sentimentBox}>
                <span style={s.sentimentLabel}>Meeting Tone: </span>
                <span style={s.sentimentValue}>{summary.sentiment}</span>
              </div>
            )}

            <div style={s.summaryActions}>
              <button style={s.copyBtn} onClick={copyToClipboard}>
                📋 Copy Summary
              </button>
              <button style={s.closeBtn} onClick={onClose}>
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {transcript.length === 0 && !loading && !error && (
          <div style={s.noTranscript}>
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>💬</div>
            <div>No chat messages were recorded in this meeting.</div>
            <div style={{ color: "#555", fontSize: "0.85rem", marginTop: "6px" }}>
              AI summary works best when participants use the chat.
            </div>
            <button style={Object.assign({}, s.closeBtn, { marginTop: "20px" })} onClick={onClose}>
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meeting Room ──────────────────────────────────────────────────────────────
function MeetingRoom({ meetingId, meetingTitle, name, onLeave }) {
  const [token, setToken]         = useState(null);
  const [error, setError]         = useState("");
  const [chatOpen, setChatOpen]   = useState(false);
  const [messages, setMessages]   = useState([]);
  const [msgInput, setMsgInput]   = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [duration, setDuration]   = useState("0 min");

  const startTime  = useRef(Date.now());
  const chatBottom = useRef(null);
  const socketRef  = useRef(null);

  useEffect(function() {
    fetchToken();
    connectSocket();
    return function() {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(function() {
    if (chatBottom.current) {
      chatBottom.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function fetchToken() {
    try {
      const res = await fetch(
        API + "/token?room=" + encodeURIComponent(meetingId) +
        "&identity=" + encodeURIComponent(name)
      );
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setToken(data.token);
    } catch (err) {
      setError("Could not get room token");
    }
  }

  function connectSocket() {
    // Dynamic import to avoid issues
    import("socket.io-client").then(function(module) {
      const io   = module.io;
      const sock = io(API);
      socketRef.current = sock;

      sock.on("connect", function() {
        sock.emit("join-chat", { roomId: meetingId, name: name });
      });

      sock.on("chat-message", function(msg) {
        setMessages(function(prev) { return [...prev, msg]; });
      });
    });
  }

  function sendMessage() {
    if (!msgInput.trim() || !socketRef.current) return;
    socketRef.current.emit("chat-message", {
      roomId:  meetingId,
      message: msgInput.trim(),
      sender:  name,
    });
    setMsgInput("");
  }

  function handleLeave() {
    const mins = Math.round((Date.now() - startTime.current) / 60000);
    setDuration(mins < 1 ? "< 1 min" : mins + " min");
    if (messages.length > 0) {
      setShowSummary(true);
    } else {
      onLeave();
    }
  }

  if (showSummary) {
    return (
      <AISummary
        transcript={messages}
        meetingTitle={meetingTitle || meetingId}
        duration={duration}
        onClose={onLeave}
      />
    );
  }

  if (error) {
    return (
      <div style={Object.assign({}, s.page, { justifyContent: "center" })}>
        <div style={s.card}>
          <div style={{ textAlign: "center", marginBottom: "12px", fontSize: "2rem" }}>❌</div>
          <div style={{ textAlign: "center", marginBottom: "16px" }}>{error}</div>
          <button style={s.btn} onClick={onLeave}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={Object.assign({}, s.page, { justifyContent: "center" })}>
        <div style={{ color: "#888" }}>Connecting to meeting...</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#0a0a0c", display: "flex", flexDirection: "column" }}>
      <div style={s.roomBar}>
        <span style={{ fontSize: "0.85rem", color: "#aaa" }}>
          📹 <strong style={{ color: "#fff" }}>{meetingTitle || meetingId}</strong>
          &nbsp;·&nbsp;ID: {meetingId}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={Object.assign({}, s.chatToggleBtn, chatOpen ? { background: "#5046e5" } : {})}
            onClick={function() { setChatOpen(function(v) { return !v; }); }}
          >
            💬 Chat {messages.length > 0 && "(" + messages.length + ")"}
          </button>
          <button style={s.leaveBtn} onClick={handleLeave}>
            🚪 Leave + Summary
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1 }}>
          <LiveKitRoom
            token={token}
            serverUrl={LIVEKIT_URL}
            connect={true}
            video={true}
            audio={true}
            onDisconnected={handleLeave}
            style={{ height: "100%" }}
          >
            <VideoGrid />
            <RoomAudioRenderer />
            <ControlBar />
          </LiveKitRoom>
        </div>

        {chatOpen && (
          <div style={s.chatPanel}>
            <div style={s.chatHead}>
              <span>💬 Meeting Chat</span>
              <span style={{ fontSize: "0.75rem", color: "#555" }}>Saved for AI summary</span>
            </div>
            <div style={s.chatMsgs}>
              {messages.length === 0 && (
                <div style={{ color: "#444", fontSize: "0.83rem", textAlign: "center", marginTop: "20px" }}>
                  No messages yet
                </div>
              )}
              {messages.map(function(m, i) {
                const mine = m.sender === name;
                return (
                  <div key={i} style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    background: mine ? "#5046e5" : "#1e1e23",
                    borderRadius: mine ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: "7px 11px", maxWidth: "88%",
                  }}>
                    {!mine && (
                      <div style={{ fontSize: "0.68rem", color: "#888", marginBottom: "2px" }}>
                        {m.sender}
                      </div>
                    )}
                    <div style={{ fontSize: "0.85rem", wordBreak: "break-word", color: "#fff" }}>
                      {m.message}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "#aaa", marginTop: "3px", textAlign: "right" }}>
                      {m.time}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottom} />
            </div>
            <div style={s.chatInputRow}>
              <input
                style={s.chatField}
                placeholder="Type a message..."
                value={msgInput}
                onChange={function(e) { setMsgInput(e.target.value); }}
                onKeyDown={function(e) { if (e.key === "Enter") sendMessage(); }}
              />
              <button style={s.sendBtn} onClick={sendMessage}>Send</button>
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
      const body = mode === "signup"
        ? { name, email, password }
        : { email, password };
      const res  = await fetch(API + "/auth/" + mode, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      saveSession(data.token, data.user);
      onAuth(data.user);
    } catch (err) {
      setError("Server error. Is the server running?");
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.logo}>📹</div>
      <div style={s.title}>VideoMeet</div>
      <div style={s.badge}>Professional Video Conferencing + AI</div>
      <div style={s.card}>
        <div style={s.tabRow}>
          <button
            style={Object.assign({}, s.tab, mode === "login" ? s.tabActive : {})}
            onClick={function() { setMode("login"); setError(""); }}
          >Login</button>
          <button
            style={Object.assign({}, s.tab, mode === "signup" ? s.tabActive : {})}
            onClick={function() { setMode("signup"); setError(""); }}
          >Sign Up</button>
        </div>
        {error && <div style={s.error}>{error}</div>}
        {mode === "signup" && (
          <input style={s.input} placeholder="Full name" value={name}
            onChange={function(e) { setName(e.target.value); }} />
        )}
        <input style={s.input} placeholder="Email address" value={email} type="email"
          onChange={function(e) { setEmail(e.target.value); }} />
        <input style={s.input} placeholder="Password" value={password} type="password"
          onChange={function(e) { setPass(e.target.value); }}
          onKeyDown={function(e) { if (e.key === "Enter") handleSubmit(); }} />
        <button
          style={Object.assign({}, s.btn, loading ? { opacity: 0.6 } : {})}
          onClick={handleSubmit} disabled={loading}
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
        </button>
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

  useEffect(function() { loadMeetings(); }, []);

  async function loadMeetings() {
    try {
      const res  = await fetch(API + "/meetings", {
        headers: { Authorization: "Bearer " + getToken() },
      });
      const data = await res.json();
      if (data.meetings) setMeetings(data.meetings);
    } catch (err) { console.error(err); }
  }

  async function createMeeting() {
    if (!title.trim()) { setError("Enter a meeting title"); return; }
    setError("");
    setCreating(true);
    try {
      const res  = await fetch(API + "/meetings/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
        body:    JSON.stringify({ title: title }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setCreating(false); return; }
      setTitle("");
      setCreating(false);
      loadMeetings();
      onJoinMeeting({ meetingId: data.meeting.meetingId, meetingTitle: title, name: user.name });
    } catch (err) { setError("Could not create meeting"); setCreating(false); }
  }

  async function joinByLink() {
    if (!joinId.trim()) { setError("Enter a meeting ID"); return; }
    setError("");
    setLoading(true);
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
    navigator.clipboard.writeText("http://localhost:3000/meet/" + meetingId);
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topLeft}>
          <span style={s.topLogo}>📹</span>
          <span style={s.topTitle}>VideoMeet</span>
          <span style={s.aiBadge}>✨ AI Powered</span>
        </div>
        <div style={s.topRight}>
          <span style={s.topName}>👋 {user.name}</span>
          <button style={s.logoutBtn} onClick={function() { clearSession(); onLogout(); }}>
            Logout
          </button>
        </div>
      </div>

      <div style={s.dashBody}>
        <div style={s.dashGrid}>
          <div style={s.dashCard}>
            <div style={s.dashCardTitle}>🎬 New Meeting</div>
            <div style={s.dashCardSub}>Start an instant meeting with AI summary</div>
            {error && <div style={s.error}>{error}</div>}
            <input style={s.input} placeholder="Meeting title (e.g. Team Standup)"
              value={title} onChange={function(e) { setTitle(e.target.value); }} />
            <button
              style={Object.assign({}, s.btn, creating ? { opacity: 0.6 } : {})}
              onClick={createMeeting} disabled={creating}
            >
              {creating ? "Creating..." : "🚀 Start Meeting"}
            </button>
          </div>

          <div style={s.dashCard}>
            <div style={s.dashCardTitle}>🔗 Join Meeting</div>
            <div style={s.dashCardSub}>Enter a meeting ID or paste a link</div>
            <input style={s.input} placeholder="Meeting ID or link" value={joinId}
              onChange={function(e) { setJoinId(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") joinByLink(); }} />
            <button
              style={Object.assign({}, s.btn, { background: "#059669" }, loading ? { opacity: 0.6 } : {})}
              onClick={joinByLink} disabled={loading}
            >
              {loading ? "Checking..." : "Join Meeting"}
            </button>
          </div>
        </div>

        <div style={s.aiInfoBox}>
          <div style={s.aiInfoIcon}>🤖</div>
          <div>
            <div style={s.aiInfoTitle}>AI Meeting Summary</div>
            <div style={s.aiInfoText}>
              After every meeting, Claude AI automatically analyzes your chat and generates
              a summary with key points, decisions made, and action items.
            </div>
          </div>
        </div>

        {meetings.length > 0 && (
          <div style={s.recentBox}>
            <div style={s.recentTitle}>📋 Recent Meetings</div>
            <div style={s.meetingList}>
              {meetings.map(function(m) {
                return (
                  <div key={m._id} style={s.meetingItem}>
                    <div>
                      <div style={s.meetingName}>{m.title}</div>
                      <div style={s.meetingId}>ID: {m.meetingId}</div>
                    </div>
                    <div style={s.meetingActions}>
                      <button style={s.smallBtn}
                        onClick={function() { copyLink(m.meetingId); }}>
                        📋 Copy Link
                      </button>
                      <button style={Object.assign({}, s.smallBtn, { background: "#5046e5" })}
                        onClick={function() {
                          onJoinMeeting({ meetingId: m.meetingId, meetingTitle: m.title, name: user.name });
                        }}>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh", background: "#0a0a0c",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "24px 16px", fontFamily: "'Segoe UI', sans-serif", color: "#f0f0f0",
  },
  logo:  { fontSize: "3rem", marginBottom: "8px" },
  title: { fontSize: "2.2rem", fontWeight: "700", color: "#fff", marginBottom: "6px" },
  badge: {
    background: "#1a1a2e", border: "1px solid #5046e5", borderRadius: "20px",
    padding: "4px 14px", fontSize: "0.8rem", color: "#818cf8", marginBottom: "32px",
  },
  card: {
    background: "#16161a", border: "1px solid #252529",
    borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "400px",
  },
  tabRow: { display: "flex", marginBottom: "20px", borderRadius: "9px", overflow: "hidden", border: "1px solid #252529" },
  tab: {
    flex: 1, padding: "10px", border: "none", background: "#0a0a0c",
    color: "#888", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem",
  },
  tabActive: { background: "#5046e5", color: "#fff" },
  input: {
    width: "100%", padding: "11px 14px", borderRadius: "9px",
    border: "1px solid #2e2e33", background: "#0a0a0c", color: "#fff",
    fontSize: "0.95rem", marginBottom: "12px", outline: "none",
    boxSizing: "border-box", display: "block",
  },
  btn: {
    width: "100%", padding: "12px", borderRadius: "9px", border: "none",
    background: "#5046e5", color: "#fff", fontSize: "1rem",
    fontWeight: "600", cursor: "pointer", marginTop: "4px",
  },
  error: { color: "#f87171", marginBottom: "12px", fontSize: "0.85rem" },
  topBar: {
    width: "100%", maxWidth: "1100px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 0", marginBottom: "28px",
  },
  topLeft:  { display: "flex", alignItems: "center", gap: "10px" },
  topLogo:  { fontSize: "1.6rem" },
  topTitle: { fontSize: "1.3rem", fontWeight: "700", color: "#fff" },
  aiBadge:  {
    background: "#1a2e1a", border: "1px solid #22c55e", borderRadius: "20px",
    padding: "2px 10px", fontSize: "0.75rem", color: "#86efac",
  },
  topRight: { display: "flex", alignItems: "center", gap: "14px" },
  topName:  { color: "#aaa", fontSize: "0.9rem" },
  logoutBtn: {
    padding: "7px 16px", borderRadius: "8px", border: "1px solid #333",
    background: "none", color: "#888", cursor: "pointer", fontSize: "0.85rem",
  },
  dashBody: { width: "100%", maxWidth: "1100px" },
  dashGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" },
  dashCard: { background: "#16161a", border: "1px solid #252529", borderRadius: "16px", padding: "28px" },
  dashCardTitle: { fontSize: "1.1rem", fontWeight: "700", marginBottom: "4px", color: "#fff" },
  dashCardSub:   { color: "#555", fontSize: "0.85rem", marginBottom: "20px" },
  aiInfoBox: {
    display: "flex", gap: "16px", alignItems: "flex-start",
    background: "#0f1f0f", border: "1px solid #166534",
    borderRadius: "12px", padding: "18px 20px", marginBottom: "20px",
  },
  aiInfoIcon:  { fontSize: "2rem", flexShrink: 0 },
  aiInfoTitle: { fontWeight: "700", fontSize: "0.95rem", marginBottom: "4px", color: "#86efac" },
  aiInfoText:  { color: "#555", fontSize: "0.83rem", lineHeight: "1.6" },
  recentBox: { background: "#16161a", border: "1px solid #252529", borderRadius: "16px", padding: "24px" },
  recentTitle: { fontSize: "1rem", fontWeight: "700", marginBottom: "16px", color: "#fff" },
  meetingList: { display: "flex", flexDirection: "column", gap: "10px" },
  meetingItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px", background: "#1e1e23", borderRadius: "10px",
  },
  meetingName:    { fontWeight: "600", fontSize: "0.9rem", color: "#fff" },
  meetingId:      { fontSize: "0.75rem", color: "#555", marginTop: "2px" },
  meetingActions: { display: "flex", gap: "8px" },
  smallBtn: {
    padding: "6px 12px", borderRadius: "7px", border: "none",
    background: "#27272a", color: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: "600",
  },
  roomBar: {
    height: "48px", background: "#111", borderBottom: "1px solid #1e1e23",
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px",
    flexShrink: 0,
  },
  chatToggleBtn: {
    padding: "6px 14px", borderRadius: "7px", border: "none",
    background: "#27272a", color: "#fff", cursor: "pointer", fontSize: "0.82rem", fontWeight: "600",
  },
  leaveBtn: {
    padding: "6px 16px", borderRadius: "7px", border: "none",
    background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: "0.82rem", fontWeight: "600",
  },
  chatPanel: {
    width: "280px", flexShrink: 0, background: "#16161a",
    borderLeft: "1px solid #252529", display: "flex", flexDirection: "column",
  },
  chatHead: {
    padding: "12px 14px", borderBottom: "1px solid #252529",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontWeight: "600", fontSize: "0.85rem",
  },
  chatMsgs: {
    flex: 1, overflowY: "auto", padding: "10px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  chatInputRow: { display: "flex", gap: "7px", padding: "10px", borderTop: "1px solid #252529" },
  chatField: {
    flex: 1, padding: "7px 11px", borderRadius: "8px",
    border: "1px solid #2e2e33", background: "#0a0a0c",
    color: "#fff", fontSize: "0.83rem", outline: "none",
  },
  sendBtn: {
    padding: "7px 13px", borderRadius: "8px", border: "none",
    background: "#5046e5", color: "#fff", cursor: "pointer", fontWeight: "600", fontSize: "0.83rem",
  },
  summaryWrap: {
    width: "100%", maxWidth: "720px",
    background: "#16161a", border: "1px solid #252529",
    borderRadius: "20px", overflow: "hidden",
  },
  summaryHeader: {
    background: "linear-gradient(135deg, #1a1a3e, #0f1f0f)",
    padding: "32px", textAlign: "center",
    borderBottom: "1px solid #252529",
  },
  summaryIcon:  { fontSize: "3rem", marginBottom: "10px" },
  summaryTitle: { fontSize: "1.5rem", fontWeight: "700", color: "#fff", marginBottom: "6px" },
  summaryMeta:  { color: "#666", fontSize: "0.85rem" },
  loadingBox: { padding: "48px", textAlign: "center" },
  spinner:      { fontSize: "2.5rem", marginBottom: "16px", animation: "spin 1s linear infinite" },
  loadingText:  { fontSize: "1rem", fontWeight: "600", marginBottom: "6px", color: "#fff" },
  loadingSubText: { color: "#555", fontSize: "0.85rem" },
  errorBox: { padding: "32px", textAlign: "center", color: "#f87171" },
  retryBtn: {
    padding: "8px 20px", borderRadius: "8px", border: "none",
    background: "#5046e5", color: "#fff", cursor: "pointer", fontWeight: "600",
  },
  summaryBody:    { padding: "28px" },
  summarySection: { marginBottom: "24px" },
  sectionLabel: {
    fontSize: "0.8rem", fontWeight: "700", color: "#5046e5",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px",
  },
  sectionText: { color: "#ccc", fontSize: "0.9rem", lineHeight: "1.7" },
  listItem: { display: "flex", gap: "8px", marginBottom: "7px", fontSize: "0.88rem", color: "#ccc" },
  bullet:   { color: "#5046e5", flexShrink: 0, marginTop: "1px" },
  emptyNote: { color: "#444", fontSize: "0.85rem", fontStyle: "italic" },
  sentimentBox: {
    background: "#1e1e23", borderRadius: "10px", padding: "12px 16px",
    marginBottom: "24px", fontSize: "0.88rem",
  },
  sentimentLabel: { color: "#666" },
  sentimentValue: { color: "#86efac", fontWeight: "600" },
  summaryActions: { display: "flex", gap: "12px" },
  copyBtn: {
    flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid #2e2e33",
    background: "none", color: "#aaa", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem",
  },
  closeBtn: {
    flex: 1, padding: "11px", borderRadius: "9px", border: "none",
    background: "#5046e5", color: "#fff", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem",
  },
  noTranscript: { padding: "48px", textAlign: "center", color: "#aaa" },
};