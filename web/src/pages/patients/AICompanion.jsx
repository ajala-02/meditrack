import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

const theme = { background: "#F5F0EB", green: "#1f6b62", greenSoft: "#E7F0E5", border: "#E4E4E7", text: "#111111", muted: "#6B7280", panelText: "#2F3E46" };
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

const formatAIResponse = (text = "") => {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let bullets = [];
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(<ul key={`bullets-${blocks.length}`} className="mb-5 list-disc space-y-1 pl-5 text-[13px] leading-[1.8]" style={{ color: "#374151" }}>{bullets.map((bullet, index) => <li key={index}>{formatInlineText(bullet)}</li>)}</ul>);
      bullets = [];
    }
  };
  lines.forEach((line, index) => {
    const trimmed = line.trim().replace(/^[^A-Za-z]+(?=[A-Za-z])/, "");
    if (!trimmed) {
      flushBullets();
      blocks.push(<div key={`space-${index}`} className="h-4" />);
    } else if (/^[A-Z][A-Z\s&]+$/.test(trimmed)) {
      flushBullets();
      blocks.push(<h3 key={`heading-${index}`} className="mb-2 border-l-[3px] py-1 pl-2 text-[13px] font-semibold uppercase" style={{ borderColor: "#06b6d4", color: "#1e293b" }}>{trimmed}</h3>);
    } else if (trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2));
    } else {
      flushBullets();
      blocks.push(<p key={`paragraph-${index}`} className="mb-3 text-sm leading-6" style={{ color: "#374151" }}>{formatInlineText(trimmed)}</p>);
    }
  });
  flushBullets();
  return blocks;
};

const formatInlineText = (text) => text.split(/(<strong>[\s\S]*?<\/strong>)/g).map((part, index) => {
  if (part.startsWith("<strong>") && part.endsWith("</strong>")) return <strong key={index} style={{ color: "#06b6d4", fontWeight: 600 }}>{part.slice(8, -9)}</strong>;
  return <span key={index}>{part}</span>;
});

const ReportOffer = ({ onGenerate, onDismiss, generating }) => <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "#D9E4DE", background: "#F8FBF9" }}>
  <p className="text-sm font-semibold" style={{ color: theme.panelText }}>Would you like a personalized recovery report for this conversation?</p>
  {!generating ? <div className="mt-3 flex flex-wrap gap-2"><button onClick={onGenerate} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: theme.green, color: "#FFFFFF" }}>Yes, generate report</button><button onClick={onDismiss} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: theme.border, color: theme.panelText }}>No thanks</button></div> : <p className="mt-3 text-xs font-semibold" style={{ color: theme.green }}>Generating your report...</p>}
</div>;

const CareTeamNotice = () => <div className="mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)", color: "#16a34a" }}><span aria-hidden="true">✓</span>This conversation has been shared with your care team.</div>;

const CompanionResponse = ({ text, onGenerateReport, reportGenerating, onDismissReportOffer }) => text ? <>
  <div className="mt-6 rounded-2xl border bg-white p-4 text-left" style={{ borderColor: theme.border }}>{formatAIResponse(text)}</div>
  <CareTeamNotice />
  <ReportOffer onGenerate={onGenerateReport} onDismiss={onDismissReportOffer} generating={reportGenerating} />
</> : null;

const REPORT_PROMPT = (patientName, condition, day, total, conversation) => `Generate a formal personalized recovery report as a structured document for:
Patient: ${patientName}, Condition: ${condition || "recovery"}, Day ${day} of recovery.

Based on this conversation:
${conversation}

Format the report exactly like this:

MEDITRACK RECOVERY REPORT
Patient: ${patientName}
Condition: ${condition || "recovery"}
Date: ${new Date().toLocaleDateString()}
Recovery Day: ${day} of ${total}

REPORTED SYMPTOMS
[list symptoms mentioned]

CLINICAL ASSESSMENT
[AI assessment of severity]

HOME MANAGEMENT PLAN

Medicines:
[list with timing]

Recommended Activities:
[what to do]

Restricted Activities:
[what to avoid]

Diet & Hydration:
[relevant advice]

HOME REMEDIES
[safe home remedies mentioned]

WARNING SIGNS
[when to seek help]

CARE TEAM NOTIFICATION
This report has been automatically shared with your assigned care team.

DISCLAIMER
This report is AI-generated to assist your recovery. It does not replace medical advice from your doctor.

Generated by MediTrack AI
Powered by Groq AI`;

const ReportModal = ({ text, onClose }) => text ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Recovery report">
  <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b p-4" style={{ borderColor: theme.border }}><h2 className="text-lg font-bold" style={{ color: theme.text }}>Recovery report</h2><div className="flex gap-2"><button onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: theme.border, color: theme.panelText }}>Print / download PDF</button><button onClick={onClose} aria-label="Close recovery report" className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: theme.green, color: "#FFFFFF" }}>Close</button></div></div>
    <div className="overflow-y-auto p-5">{formatAIResponse(text)}</div>
  </div>
</div> : null;

const AICompanion = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("chat");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [processing, setProcessing] = useState(false);
  const [shared, setShared] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [report, setReport] = useState("");
  const [reportOfferDismissed, setReportOfferDismissed] = useState(false);
  const [chat, setChat] = useState([
    { role: "assistant", content: "Tell me how you are feeling today. I will organize your update into causes, home care, movement guidance, warning signs, and a detailed recovery report." }
  ]);
  const [message, setMessage] = useState("");
  const [patient, setPatient] = useState(null);
  const voice = useSpeech(setTranscript);

  useEffect(() => { api.get("/patients/me").then(({ data }) => setPatient(data.patient)).catch(() => {}); }, []);
  const patientName = patient?.name || user?.name || "Patient";
  const day = patient?.dischargeDate ? Math.max(1, Math.floor((Date.now() - new Date(patient.dischargeDate)) / 86400000)) : 1;
  const total = patient?.monitoringDuration || 30;

  const generateReport = async (conversation = chat) => {
    setReportGenerating(true);
    try {
      const reportPrompt = REPORT_PROMPT(patientName, patient?.condition, day, total, conversation.map((item) => `${item.role}: ${item.content}`).join("\n\n"));
      const { data } = await api.post("/messages/reply", { messages: [{ role: "user", content: reportPrompt }], patientName, day, total });
      setReport(data.reply);
    } catch (error) {
      setResponse(error.response?.data?.message || "We could not generate your report. Please try again.");
    } finally {
      setReportGenerating(false);
    }
  };

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

  return <main className="min-h-screen px-5 py-6 sm:px-8" style={{ background: theme.background, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
    <div className="mx-auto max-w-[760px]">
      <button onClick={() => navigate("/patient/home")} className="mb-7 text-sm font-bold" style={{ color: theme.green }}>← Back to recovery space</button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold leading-none" style={{ color: theme.text }}>AI Health Companion</h1>
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: theme.green, border: `1px solid ${theme.green}` }}>Powered by Groq AI</span>
      </div>
      <p className="mt-2 text-sm" style={{ color: theme.muted }}>A calm place to describe how recovery feels today.</p>
      <div className="mt-7 flex overflow-hidden rounded-xl border bg-white p-1" style={{ borderColor: theme.border }}>
        {[
          { key: "voice", label: "Voice" },
          { key: "chat", label: "Chat" }
        ].map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className="flex-1 rounded-lg px-4 py-3 text-sm font-bold transition" style={{ background: tab === item.key ? theme.green : "transparent", color: tab === item.key ? "#FFFFFF" : theme.muted }}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "voice" ? <section className="mt-8 text-center">
        <button aria-label="Record health note" onClick={voice.recording ? handleVoiceStop : voice.start} className="mx-auto grid h-28 w-28 place-items-center rounded-full text-4xl" style={{ background: voice.recording ? "#C96A57" : theme.green, color: "#FFFFFF", boxShadow: voice.recording ? "0 0 0 12px rgba(201,106,87,.16)" : `0 0 0 12px rgba(31,107,98,.12)`, animation: voice.recording ? "pulse 1.3s infinite" : "none" }}>{voice.recording ? "■" : "🎙"}</button>
        <p className="mt-5 font-bold" style={{ color: theme.text }}>{voice.recording ? "Tap to stop recording" : "Tap and describe how you feel"}</p>
        {!voice.supported && <p className="mt-2 text-sm" style={{ color: "#A46A48" }}>Voice recording is not supported in this browser. Use Chat instead.</p>}
        {transcript && <p className="mx-auto mt-6 max-w-xl rounded-xl border bg-white p-4 text-left text-sm" style={{ borderColor: theme.border, color: theme.panelText }}>{transcript}</p>}
        {processing && <p className="mt-6 text-sm" style={{ color: theme.green }}>Your care assistant is listening and preparing a response...</p>}
        <CompanionResponse text={response} onGenerateReport={() => generateReport([{ role: "user", content: transcript }])} reportGenerating={reportGenerating} onDismissReportOffer={() => setReportOfferDismissed(true)} />
        {shared && <p className="mt-4 text-sm font-bold" style={{ color: "#4ade80" }}>✓ Shared with Dr. {patient?.enrolledBy?.name || "your care team"}</p>}
      </section> : <section className="mt-6 flex min-h-[480px] flex-col rounded-2xl border bg-white p-4" style={{ borderColor: theme.border }}>
        <div className="flex-1 space-y-4 overflow-auto">
          {chat.map((item, index) => (
            <div key={`${item.role}-${index}`}>
              <div className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6" style={{ background: item.role === "user" ? theme.green : theme.greenSoft, color: item.role === "user" ? "#FFFFFF" : theme.panelText, boxShadow: item.role === "user" ? "0 4px 12px rgba(31,107,98,.12)" : "none" }}>{item.role === "assistant" ? formatAIResponse(item.content) : item.content}</div>
              </div>
              {item.role === "assistant" && index > 0 && !reportOfferDismissed && <div className="ml-auto max-w-[82%]"><CareTeamNotice /><ReportOffer onGenerate={() => generateReport(chat)} onDismiss={() => setReportOfferDismissed(true)} generating={reportGenerating} /></div>}
            </div>
          ))}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="mt-5 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl border bg-white px-3 py-2" style={{ borderColor: theme.green }}>
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write in any language..." className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none" style={{ color: theme.panelText }} />
            <button type="button" onClick={voice.recording ? voice.stop : voice.start} className="flex h-8 w-8 items-center justify-center rounded-full text-base" style={{ background: theme.green, color: "#FFFFFF" }}>🎙</button>
          </div>
          <button className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: theme.green, color: "#FFFFFF" }}>Send</button>
        </form>
      </section>}
    </div>
    <ReportModal text={report} onClose={() => setReport("")} />
    <style>{"@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}"}</style>
  </main>;
};

export default AICompanion;
