import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

const dark = { background: "#0d1117", card: "#1c2128", border: "#21262d", teal: "#06b6d4", text: "#e6edf3", muted: "#8b949e" };
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const useSpeech = (onResult) => {
  const recognition = useRef(null);
  const [recording, setRecording] = useState(false);
  const [supported] = useState(Boolean(SpeechRecognition));
  const start = () => {
    if (!SpeechRecognition) return;
    const instance = new SpeechRecognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-IN";
    instance.onresult = (event) => onResult(Array.from(event.results).map((result) => result[0].transcript).join(""));
    instance.onend = () => setRecording(false);
    instance.start();
    recognition.current = instance;
    setRecording(true);
  };
  const stop = () => { recognition.current?.stop(); setRecording(false); };
  useEffect(() => () => recognition.current?.stop(), []);
  return { recording, supported, start, stop };
};

const CompanionResponse = ({ text }) => text ? <div className="mt-6 rounded-2xl p-5" style={{ background: dark.card, border: `1px solid ${dark.border}`, color: dark.text, whiteSpace: "pre-wrap" }}>{text}</div> : null;

const AICompanion = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("chat");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [processing, setProcessing] = useState(false);
  const [shared, setShared] = useState(false);
  const [chat, setChat] = useState([
    { role: "user", content: "My right foot is swollen and having pain in my left chest" },
    { role: "assistant", content: "I could not not respond right now. Please contact your care team if you feel unwell." }
  ]);
  const [message, setMessage] = useState("");
  const [patient, setPatient] = useState(null);
  const voice = useSpeech(setTranscript);

  useEffect(() => { api.get("/patients/me").then(({ data }) => setPatient(data.patient)).catch(() => {}); }, []);
  const patientName = patient?.name || user?.name || "Patient";
  const day = patient?.dischargeDate ? Math.max(1, Math.floor((Date.now() - new Date(patient.dischargeDate)) / 86400000)) : 1;
  const total = patient?.monitoringDuration || 30;

  const handleVoiceStop = async () => {
    voice.stop();
    if (!transcript.trim()) return;
    setProcessing(true);
    try {
      const history = [{ role: "user", content: transcript }];
      const [{ data: replyData }, { data: symptomData }] = await Promise.all([
        api.post("/messages/reply", { messages: history, patientName, day, total }),
        api.post("/checkins/analyze-symptom", { text: transcript, language: "auto" }),
      ]);
      setResponse(replyData.reply);
      await api.post("/checkins", { symptoms: [{ ...symptomData.symptom, source: "voiceText" }], note: transcript, language: "auto" });
      setShared(true);
    } catch (error) { setResponse(error.response?.data?.message || "We could not process that just now. Please try again."); }
    finally { setProcessing(false); }
  };

  const sendMessage = async (content = message) => {
    if (!content.trim() || processing) return;
    const next = [...chat, { role: "user", content: content.trim() }];
    setChat(next); setMessage(""); setProcessing(true);
    try {
      const { data } = await api.post("/messages/reply", { messages: next, patientName, day, total });
      const updated = [...next, { role: "assistant", content: data.reply }];
      setChat(updated);
      await api.post("/messages", { type: "ai_companion", messages: updated });
    } catch { setChat([...next, { role: "assistant", content: "I could not respond right now. Please contact your care team if you feel unwell." }]); }
    finally { setProcessing(false); }
  };

  return <main className="min-h-screen px-5 py-6 sm:px-8" style={{ background: dark.background, color: dark.text }}>
    <div className="mx-auto max-w-[760px]">
      <button onClick={() => navigate("/patient/home")} className="mb-7 text-sm font-bold" style={{ color: dark.teal }}>← Back to recovery space</button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold leading-none">AI Health Companion</h1>
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: dark.teal, border: `1px solid ${dark.teal}` }}>Powered by Claude AI</span>
      </div>
      <p className="mt-2 text-sm" style={{ color: dark.muted }}>A calm place to describe how recovery feels today.</p>
      <div className="mt-7 flex rounded-xl p-1 overflow-hidden" style={{ background: dark.card, border: `1px solid ${dark.border}` }}>
        {[
          { key: "voice", label: "Voice" },
          { key: "chat", label: "Chat" }
        ].map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className="flex-1 rounded-lg px-4 py-3 text-sm font-bold transition" style={{ background: tab === item.key ? dark.teal : "transparent", color: tab === item.key ? "#06131a" : dark.muted }}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "voice" ? <section className="mt-8 text-center">
        <button aria-label="Record health note" onClick={voice.recording ? handleVoiceStop : voice.start} className="mx-auto grid h-32 w-32 place-items-center rounded-full text-5xl" style={{ background: voice.recording ? "#dc2626" : dark.teal, color: "#06131a", boxShadow: voice.recording ? "0 0 0 12px rgba(220,38,38,.18)" : `0 0 0 12px rgba(6,182,212,.12)`, animation: voice.recording ? "pulse 1.3s infinite" : "none" }}>{voice.recording ? "■" : "🎙"}</button>
        <p className="mt-5 font-bold">{voice.recording ? "Tap to stop recording" : "Tap and describe how you feel"}</p>
        {!voice.supported && <p className="mt-2 text-sm" style={{ color: "#f59e0b" }}>Voice recording is not supported in this browser. Use Chat instead.</p>}
        {transcript && <p className="mx-auto mt-6 max-w-xl rounded-xl p-4 text-left text-sm" style={{ background: dark.card, color: dark.muted }}>{transcript}</p>}
        {processing && <p className="mt-6 text-sm" style={{ color: dark.teal }}>Your care assistant is listening and preparing a response...</p>}
        <CompanionResponse text={response} />
        {shared && <p className="mt-4 text-sm font-bold" style={{ color: "#4ade80" }}>✓ Shared with Dr. {patient?.enrolledBy?.name || "your care team"}</p>}
      </section> : <section className="mt-6 flex min-h-[480px] flex-col rounded-2xl p-4" style={{ background: dark.card, border: `1px solid ${dark.border}` }}>
        <div className="flex-1 space-y-4 overflow-auto">
          {chat.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6" style={{ background: item.role === "user" ? dark.teal : "#2e3945", color: item.role === "user" ? "#06131a" : dark.text, boxShadow: item.role === "user" ? "0 0 0 1px rgba(6,182,212,0.2)" : "none" }}>{item.content}</div>
            </div>
          ))}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="mt-5 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl border px-3 py-2" style={{ background: dark.background, borderColor: "#1a9bc7" }}>
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write in any language..." className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none" style={{ color: dark.text }} />
            <button type="button" onClick={voice.recording ? voice.stop : voice.start} className="flex h-8 w-8 items-center justify-center rounded-full text-base" style={{ background: dark.teal, color: "#06131a" }}>🎙</button>
          </div>
          <button className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: dark.teal, color: "#06131a" }}>Send</button>
        </form>
      </section>}
    </div>
    <style>{"@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}"}</style>
  </main>;
};

export default AICompanion;
