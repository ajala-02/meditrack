import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import useSocket from "../../hooks/useSocket";
import api from "../../api/axios";

const NAV_ITEMS = [
  { key: "checkin", label: "Check-In", icon: "📝", path: "/patient/check-in" },
  { key: "companion", label: "AI Companion", icon: "🤖", path: "/patient/ai-companion" },
  { key: "messages", label: "Messages", icon: "💬", path: "/patient/messages" },
  { key: "timeline", label: "Timeline", icon: "📅", path: null },
];

const QUICK_CHIPS = [
  "Feeling better today",
  "I have a question",
  "Need urgent help",
];

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

const getInitials = (name = "") => {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "CT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRole = (role = "", senderName = "") => {
  if (!role && !senderName) return "Care Team";
  if (role === "doctor") return "Doctor";
  if (role === "nurse") return "Primary Nurse";
  if (role === "admin") return "Hospital Staff";
  return role;
};

const Messages = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [patient, setPatient] = useState(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Fetch initial patient profile & messages
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch patient profile for hospital info & care team
        const { data: patientData } = await api.get("/patients/me");
        if (!active) return;
        const currentPatient = patientData.patient;
        setPatient(currentPatient);

        // Fetch messages
        const patientId = currentPatient?._id || user?.id;
        const { data: messageData } = await api.get(`/messages/${patientId}`);
        if (!active) return;

        const fetched = messageData.messages || [];
        // Sort oldest to newest
        const sorted = [...fetched].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        setMessages(sorted);
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [user]);

  // Scroll to bottom after initial load or messages update
  useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg) => {
      if (!newMsg) return;

      setMessages((prev) => {
        // Check if message already exists by _id or messageId
        const msgId = newMsg._id || newMsg.messageId;
        const exists = prev.some((m) => (m._id || m.messageId) === msgId);
        if (exists) return prev;

        const updated = [...prev, newMsg];
        return updated.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("NEW_MESSAGE", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("NEW_MESSAGE", handleNewMessage);
    };
  }, [socket]);

  // Speech recognition setup
  const toggleSpeechRecognition = () => {
    if (!SpeechRecognition) {
      addToast({
        title: "Voice input unsupported",
        description: "Your browser does not support Web Speech Recognition.",
        variant: "warning",
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((res) => res[0].transcript)
          .join("");
        setInputText((prev) => {
          const prefix = prev ? prev.trim() + " " : "";
          const combined = prefix + transcript;
          return combined.slice(0, 500);
        });
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const patientId = patient?._id || user?.id;
      const { data } = await api.post("/messages", {
        patientId,
        message: text,
        type: "direct",
      });

      setInputText("");

      if (data?.data) {
        const createdMsg = data.data;
        setMessages((prev) => {
          const exists = prev.some(
            (m) => (m._id || m.messageId) === (createdMsg._id || createdMsg.messageId)
          );
          if (exists) return prev;
          return [...prev, createdMsg];
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      addToast({
        title: "Message failed",
        description: "Could not deliver your message. Please try again.",
        variant: "error",
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickChipClick = (chip) => {
    setInputText(chip);
    inputRef.current?.focus();
  };

  const hospitalName =
    patient?.hospitalId?.name || "City Care Hospital";

  return (
    <div
      className="min-h-screen lg:flex"
      style={{
        background: "#F5F0EB",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Desktop Sidebar Nav */}
      <aside
        className="hidden lg:flex flex-col items-center gap-2 w-20 py-8 shrink-0"
        style={{ background: "#18181B" }}
      >
        <div
          onClick={() => navigate("/patient/home")}
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-8 font-extrabold text-sm cursor-pointer"
          style={{ background: "#1f6b62", color: "#FFFFFF" }}
        >
          M
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => item.path && navigate(item.path)}
            disabled={!item.path}
            className={`flex flex-col items-center gap-1 w-16 py-3 rounded-xl text-[10px] font-medium transition ${
              item.key === "messages"
                ? "bg-white/15 text-white"
                : item.path
                ? "cursor-pointer text-zinc-400 hover:bg-white/5 hover:text-white"
                : "cursor-not-allowed opacity-30 text-zinc-600"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 pb-16 lg:pb-0">
        {/* Top Header */}
        <header
          className="shrink-0 px-5 py-4 lg:px-8 border-b flex items-center justify-between"
          style={{ background: "#FFFFFF", borderColor: "#E4E4E7" }}
        >
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate("/patient/home")}
              className="p-2 rounded-xl transition hover:bg-zinc-100 text-zinc-600 text-sm font-bold flex items-center gap-1"
              aria-label="Back to home"
            >
              <span>←</span>
              <span className="hidden sm:inline">Home</span>
            </button>
            <div className="h-6 w-px bg-zinc-200" />
            <div>
              <h1
                className="text-lg sm:text-xl font-extrabold"
                style={{ color: "#111111" }}
              >
                Messages
              </h1>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                Your care team ·{" "}
                <span className="font-semibold" style={{ color: "#1f6b62" }}>
                  {hospitalName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Care team online</span>
            </div>
          </div>
        </header>

        {/* Conversation Thread */}
        <main
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 max-w-4xl w-full mx-auto space-y-4"
          style={{ scrollBehavior: "smooth" }}
        >
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: "#1f6b62" }}
              >
                <span className="animate-spin text-lg">⏳</span>
                <span>Loading conversation…</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 max-w-md mx-auto">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-sm"
                style={{ background: "#E7F0E5", color: "#1f6b62" }}
              >
                💬
              </div>
              <h2
                className="text-lg font-extrabold"
                style={{ color: "#111111" }}
              >
                No messages yet
              </h2>
              <p className="mt-2 text-xs sm:text-sm" style={{ color: "#6B7280" }}>
                Your care team will reach out after reviewing your check-ins.
              </p>
              <button
                type="button"
                onClick={() => {
                  setInputText("Hello care team, ");
                  inputRef.current?.focus();
                }}
                className="mt-6 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 active:scale-95 shadow-sm"
                style={{ background: "#1f6b62" }}
              >
                Send a message to start the conversation
              </button>
            </div>
          ) : (
            /* Messages List */
            messages.map((msg, index) => {
              const isPatient =
                msg.senderRole === "patient" ||
                (msg.senderId?._id && String(msg.senderId._id) === String(user?.id)) ||
                String(msg.senderId) === String(user?.id);

              const senderObj =
                typeof msg.senderId === "object" ? msg.senderId : null;
              const senderName =
                senderObj?.name || msg.senderName || "Care Team Member";
              const senderRole =
                senderObj?.role || msg.senderRole || "Care Team";

              const timeStr = formatMessageTime(msg.createdAt);
              const isRead = Boolean(msg.readAt);

              if (isPatient) {
                // Patient message (Right side)
                return (
                  <div
                    key={msg._id || `msg-${index}`}
                    className="flex flex-col items-end"
                  >
                    <span
                      className="text-[11px] font-semibold mb-1 mr-1"
                      style={{ color: "#6B7280" }}
                    >
                      You
                    </span>
                    <div
                      className="max-w-[85%] sm:max-w-md rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm text-white"
                      style={{
                        background: "#1f6b62",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.message}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 mr-1 text-[10px] text-zinc-500">
                      <span>{timeStr}</span>
                      <span>·</span>
                      <span
                        title={isRead ? "Read by care team" : "Delivered"}
                        className="font-bold"
                        style={{ color: isRead ? "#1f6b62" : "#9CA3AF" }}
                      >
                        {isRead ? "••" : "•"}
                      </span>
                    </div>
                  </div>
                );
              }

              // Care team message (Left side)
              return (
                <div
                  key={msg._id || `msg-${index}`}
                  className="flex items-start gap-2.5 max-w-[88%] sm:max-w-lg"
                >
                  <div
                    className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold shadow-xs"
                    style={{
                      background: "#E7F0E5",
                      color: "#1f6b62",
                      border: "1px solid #D1E5DE",
                    }}
                  >
                    {getInitials(senderName)}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span
                        className="text-xs font-bold truncate"
                        style={{ color: "#111111" }}
                      >
                        {senderName}
                      </span>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "#6B7280" }}
                      >
                        · {formatRole(senderRole, senderName)}
                      </span>
                    </div>
                    <div
                      className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-xs"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E4E4E7",
                        color: "#111111",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 ml-1">
                      {timeStr}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area at Bottom */}
        <footer
          className="shrink-0 p-3 sm:p-5 border-t bg-white shadow-lg"
          style={{ borderColor: "#E4E4E7" }}
        >
          <div className="max-w-4xl mx-auto space-y-2.5">
            {/* Quick Reply Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span
                className="text-[11px] font-bold text-zinc-400 shrink-0 uppercase tracking-wider"
              >
                Quick replies:
              </span>
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickChipClick(chip)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition hover:bg-emerald-50 active:scale-95 cursor-pointer border"
                  style={{
                    background: "#F5F0EB",
                    borderColor: "#E4E4E7",
                    color: "#2F3E46",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-end gap-2 sm:gap-3"
            >
              <div
                className="flex-1 rounded-2xl p-2.5 sm:p-3 border transition flex items-center gap-2 focus-within:ring-2 focus-within:ring-[#1f6b62]/20"
                style={{
                  background: "#F9FAFB",
                  borderColor: "#E4E4E7",
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  maxLength={500}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none resize-none max-h-28"
                  style={{ color: "#111111" }}
                />

                {/* Speech recognition mic button */}
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  title={isRecording ? "Stop recording" : "Voice message (Speech to text)"}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {isRecording ? "🛑" : "🎤"}
                </button>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="h-11 px-4 sm:px-6 rounded-2xl text-xs sm:text-sm font-bold text-white transition hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                style={{ background: "#1f6b62" }}
              >
                {sending ? (
                  <span className="inline-block animate-spin">⏳</span>
                ) : (
                  <>
                    <span>Send</span>
                    <span className="hidden sm:inline">→</span>
                  </>
                )}
              </button>
            </form>

            {/* Helper characters indicator */}
            <div className="flex items-center justify-between text-[11px] px-1 text-zinc-400">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span>{500 - inputText.length} chars left</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Bottom Nav -- Mobile / Tablet only */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around py-3 border-t z-40"
        style={{ background: "#18181B", borderColor: "#27272A" }}
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => item.path && navigate(item.path)}
            disabled={!item.path}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium ${
              item.key === "messages"
                ? "text-emerald-400"
                : item.path
                ? "text-zinc-400 hover:text-white"
                : "text-zinc-600 opacity-40 cursor-not-allowed"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Messages;
