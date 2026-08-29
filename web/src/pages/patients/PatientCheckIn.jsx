import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";

const FEELINGS = [
  { id: "great", label: "Great", detail: "Feeling like myself", icon: "☀️", severity: 1 },
  { id: "okay", label: "Okay", detail: "A normal recovery day", icon: "🙂", severity: 1 },
  { id: "off", label: "A little off", detail: "Something feels different", icon: "😕", severity: 2 },
  { id: "unwell", label: "Not well", detail: "Symptoms are affecting my day", icon: "😟", severity: 3 },
  { id: "help", label: "I need help", detail: "I am concerned about how I feel", icon: "🆘", severity: 5 },
];

const SYMPTOMS = [
  { name: "Chest pain or pressure", urgent: true },
  { name: "Shortness of breath", urgent: false },
  { name: "Racing or irregular heartbeat", urgent: false },
  { name: "Dizziness", urgent: false },
  { name: "Fainting or near-fainting", urgent: true },
  { name: "New swelling in legs or feet", urgent: false },
];

const SEVERITY_LABELS = ["Very mild", "Mild", "Moderate", "Severe", "Very severe"];
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const Button = ({ children, className = "", ...props }) => (
  <button
    className={`rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const PatientCheckIn = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [feeling, setFeeling] = useState("");
  const [mode, setMode] = useState("choice");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [severity, setSeverity] = useState({});
  const [medicationStatus, setMedicationStatus] = useState("");
  const [activity, setActivity] = useState("");
  const [note, setNote] = useState("");
  const [bodySymptoms, setBodySymptoms] = useState([]);
  const [bodyMapSkipped, setBodyMapSkipped] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  useEffect(() => {
    setLoading(false);
  }, [addToast]);

  const currentFeeling = FEELINGS.find((item) => item.id === feeling);
  const urgentSymptomSelected = selectedSymptoms.some((name) => SYMPTOMS.find((symptom) => symptom.name === name)?.urgent);
  const showUrgentMessage = urgentSymptomSelected || feeling === "help";
  const progress = ((step + 1) / 5) * 100;

  const submittedSymptoms = useMemo(() => {
    const wellbeing = currentFeeling
      ? [{ name: `Daily wellbeing: ${currentFeeling.label}`, severity: currentFeeling.severity, source: "checklist", aiFlag: feeling === "help" }]
      : [];
    const symptoms = [...selectedSymptoms.map((name) => ({
      name,
      severity: severity[name] || 2,
      source: "checklist",
      aiFlag: SYMPTOMS.find((item) => item.name === name)?.urgent === true,
    })), ...bodySymptoms.map((item) => ({
      ...item,
      name: `${item.bodyPart} · ${item.feeling}`,
      source: "bodyMap",
      aiFlag: item.severity >= 4,
    }))];

    // The API requires at least one entry. A symptom-free day is still a useful check-in.
    return symptoms.length
      ? [...wellbeing, ...symptoms]
      : [...wellbeing, { name: "No new symptoms reported", severity: 1, source: "checklist", aiFlag: false }];
  }, [currentFeeling, feeling, selectedSymptoms, severity, bodySymptoms]);

  const toggleSymptom = (name) => {
    setSelectedSymptoms((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
    setSeverity((current) => ({ ...current, [name]: current[name] || 2 }));
  };

  const next = () => {
    if (step === 0 && !feeling) {
      addToast("Choose the option that best describes today.", "watch");
      return;
    }
    if (step === 1 && !bodyMapSkipped && bodySymptoms.length === 0) {
      addToast("Add a body symptom or skip the body map to continue.", "watch");
      return;
    }
    setStep((current) => Math.min(current + 1, 4));
  };

  const submitVoice = async (extracted) => {
    setSubmitting(true);
    try {
      const symptoms = (extracted.symptoms || []).map((item) => ({ ...item, source: "voiceText", aiFlag: extracted.urgencyFlag }));
      const { data } = await api.post("/checkins", { symptoms: symptoms.length ? symptoms : [{ name: "General recovery update", severity: 1, aiFlag: false }], medicationStatus: extracted.medicationTaken ? "Taken as planned" : "Not taken", activity: extracted.activityCompleted, note: voiceTranscript, language: "auto" });
      setSubmitted(data.checkIn);
    } catch (error) { addToast(error.response?.data?.message || "Your voice check-in could not be sent.", "critical"); }
    finally { setSubmitting(false); }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/checkins", { symptoms: submittedSymptoms, medicationStatus, activity, note, language: "English" });
      setSubmitted({ ...data.checkIn, note, medicationStatus, activity });
    } catch (error) {
      addToast(error.response?.data?.message || "Your check-in could not be sent. Please try again.", "critical");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm" style={{ background: "#F5F0EB", color: "#1f6b62" }}>Loading your check-in…</div>;
  }

  if (mode === "choice") return <CheckInFrame title="Today's check-in" onBack={() => navigate("/patient/home")}><ChoiceStep onVoice={() => setMode("voice")} onForm={() => setMode("form")} /></CheckInFrame>;
  if (mode === "voice") return <CheckInFrame title="Voice check-in" onBack={() => navigate("/patient/home")}><VoiceCheckIn transcript={voiceTranscript} setTranscript={setVoiceTranscript} submitting={submitting} onSubmit={submitVoice} /></CheckInFrame>;

  if (submitted) {
    const riskCopy = submitted.riskStatus === "critical"
      ? "Your care team has been alerted. If you feel severely unwell, seek urgent emergency care now."
      : submitted.riskStatus === "watch"
        ? "Your care team will review this update."
        : "Your update has been shared with your care team.";
    return (
      <CheckInFrame title="Check-in received" onBack={() => navigate("/patient/home")}>
        <div className="rounded-2xl p-7" style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}>
          <div className="grid h-14 w-14 place-items-center rounded-full text-2xl" style={{ background: submitted.riskStatus === "critical" ? "#F8DADB" : "#E7F0E5" }}>✓</div>
          <h2 className="mt-5 text-xl font-extrabold" style={{ color: "#111111" }}>Thank you for checking in.</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "#6B7280" }}>{riskCopy}</p>
          {submitted.aiResponse && <p className="mt-5 rounded-xl p-4 text-sm leading-6" style={{ background: "#F5F0EB", color: "#2F3E46" }}>{submitted.aiResponse}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => navigate("/patient/plan")} style={{ background: "#1f6b62", color: "#FFFFFF" }}>View recovery guide</Button>
            <Button onClick={() => navigate("/patient/home")} style={{ background: "#F5F0EB", color: "#2F3E46" }}>Back to home</Button>
          </div>
        </div>
      </CheckInFrame>
    );
  }

  return (
    <CheckInFrame title="Today's check-in" onBack={() => navigate("/patient/home")}>
      <div className="mb-7">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "#6B7280" }}>
          <span>Step {step + 1} of 4</span><span>{Math.round(progress)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "#E4E4E7" }}><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "#1f6b62" }} /></div>
      </div>

      <div className="rounded-2xl p-5 sm:p-7" style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}>
        {step === 0 && <FeelingStep feeling={feeling} onChange={setFeeling} />}
        {step === 1 && <NewBodyMapStep selected={bodySymptoms} setSelected={setBodySymptoms} skipped={bodyMapSkipped} onSkip={() => { setBodyMapSkipped(true); setStep(2); }} />}
        {step === 2 && <SymptomsStep selected={selectedSymptoms} onToggle={toggleSymptom} showUrgentMessage={showUrgentMessage} />}
        {step === 3 && <DetailsStep symptoms={selectedSymptoms} severity={severity} setSeverity={setSeverity} medicationStatus={medicationStatus} setMedicationStatus={setMedicationStatus} activity={activity} setActivity={setActivity} note={note} setNote={setNote} />}
        {step === 4 && <ReviewStep feeling={currentFeeling} symptoms={[...selectedSymptoms, ...bodySymptoms.map((item) => `${item.bodyPart} · ${item.feeling}`)]} severity={severity} medicationStatus={medicationStatus} activity={activity} note={note} />}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button onClick={() => step === 0 ? navigate("/patient/home") : setStep((current) => current - 1)} style={{ background: "#F5F0EB", color: "#2F3E46" }}>{step === 0 ? "Cancel" : "Back"}</Button>
          {step < 4 ? <Button disabled={step === 1 && !bodyMapSkipped && bodySymptoms.length === 0} onClick={next} style={{ background: "#1f6b62", color: "#FFFFFF" }}>Next →</Button> : <Button disabled={submitting} onClick={submit} style={{ background: "#1f6b62", color: "#FFFFFF" }}>{submitting ? "Sending…" : "Send check-in"}</Button>}
        </div>
      </div>
      <p className="mt-4 text-center text-xs leading-5" style={{ color: "#6B7280" }}>A check-in does not replace emergency care. If you feel severely unwell, seek emergency help immediately.</p>
    </CheckInFrame>
  );
};

const CheckInFrame = ({ title, onBack, children }) => (
  <main className="min-h-screen px-5 py-6 sm:px-8" style={{ background: "#F5F0EB", fontFamily: "'Inter', system-ui, sans-serif" }}>
    <div className="mx-auto max-w-2xl">
      <button onClick={onBack} className="mb-7 text-sm font-bold" style={{ color: "#1f6b62" }}>← Back to recovery space</button>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#BC6C25" }}>Today's check-in</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: "#111111" }}>{title}</h1>
      <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>A few quick answers help your care team support you.</p>
      <div className="mt-7">{children}</div>
    </div>
  </main>
);

const FeelingStep = ({ feeling, onChange }) => <>
  <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>How are you feeling today?</h2>
  <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>Choose the answer that feels most true right now.</p>
  <div className="mt-6 grid gap-3 sm:grid-cols-2">
    {FEELINGS.map((item) => <button key={item.id} onClick={() => onChange(item.id)} className="flex items-center gap-3 rounded-xl border p-4 text-left transition" style={{ borderColor: feeling === item.id ? "#1f6b62" : "#E4E4E7", background: feeling === item.id ? "#E7F0E5" : "#FFFFFF" }}><span className="text-2xl">{item.icon}</span><span><strong className="block text-sm" style={{ color: "#111111" }}>{item.label}</strong><span className="text-xs" style={{ color: "#6B7280" }}>{item.detail}</span></span></button>)}
  </div>
</>;

const ChoiceStep = ({ onVoice, onForm }) => <div className="text-center">
  <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>How would you like to check in today?</h2>
  <div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={onVoice} className="rounded-xl border p-6 text-left" style={{ borderColor: "#06b6d4", background: "#0d1117", color: "#e6edf3" }}><span className="text-3xl">🎤</span><strong className="mt-3 block">Voice check-in</strong><span className="mt-1 block text-xs" style={{ color: "#8b949e" }}>Speak freely about how you feel</span></button><button onClick={onForm} className="rounded-xl border p-6 text-left" style={{ borderColor: "#E4E4E7", background: "#FFFFFF", color: "#111111" }}><span className="text-3xl">📝</span><strong className="mt-3 block">Fill form</strong><span className="mt-1 block text-xs" style={{ color: "#6B7280" }}>Step by step</span></button></div>
</div>;

const BODY_MAP_ZONES = [
  { name: "Head", shape: "ellipse", cx: 90, cy: 24, rx: 18, ry: 18 },
  { name: "Chest", shape: "rect", x: 68, y: 52, width: 44, height: 42 },
  { name: "Left arm", shape: "rect", x: 39, y: 55, width: 24, height: 62 },
  { name: "Right arm", shape: "rect", x: 117, y: 55, width: 24, height: 62 },
  { name: "Abdomen", shape: "rect", x: 70, y: 97, width: 40, height: 42 },
  { name: "Left leg", shape: "rect", x: 67, y: 143, width: 21, height: 78 },
  { name: "Right leg", shape: "rect", x: 92, y: 143, width: 21, height: 78 },
];

const NewBodyMapStep = ({ selected, setSelected, skipped, onSkip }) => {
  const [activeZone, setActiveZone] = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [feeling, setFeeling] = useState("");
  const [level, setLevel] = useState(3);
  const feelings = ["Pain", "Tightness", "Numbness", "Swelling", "Burning", "Weakness"];

  const addSymptom = () => {
    if (!activeZone || !feeling) return;
    setSelected((current) => [...current.filter((item) => item.bodyPart !== activeZone), { bodyPart: activeZone, feeling, severity: level }]);
    setActiveZone(null);
    setFeeling("");
    setLevel(3);
  };

  const removeSymptom = (bodyPart) => setSelected((current) => current.filter((item) => item.bodyPart !== bodyPart));

  return <div>
    <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>Where do you feel it?</h2>
    <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>Tap the area that feels different.</p>
    <svg viewBox="0 0 180 235" className="mx-auto mt-5 h-64 w-48" role="img" aria-label="Front body map">
      <path d="M65 47 L52 58 L45 115 M115 47 L128 58 L135 115 M70 137 L67 224 M110 137 L113 224" fill="none" stroke="#8b949e" strokeWidth="4" strokeLinecap="round" />
      {BODY_MAP_ZONES.map((zone) => {
        const isSelected = selected.some((item) => item.bodyPart === zone.name);
        const isHovered = hoveredZone === zone.name;
        const fill = isSelected ? "rgba(31,107,98,0.4)" : isHovered ? "rgba(31,107,98,0.2)" : "transparent";
        const common = { fill, stroke: isSelected ? "#1f6b62" : "#8b949e", strokeWidth: 2, onClick: () => setActiveZone(zone.name), onMouseEnter: () => setHoveredZone(zone.name), onMouseLeave: () => setHoveredZone(null), style: { cursor: "pointer" } };
        return zone.shape === "ellipse" ? <ellipse key={zone.name} {...common} cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry} /> : <rect key={zone.name} {...common} x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="6" />;
      })}
    </svg>
    {activeZone && <div className="mt-3 rounded-xl border p-4" style={{ background: "#FFFFFF", borderColor: "#E4E4E7" }}>
      <p className="text-sm font-bold" style={{ color: "#111111" }}>What do you feel in {activeZone}?</p>
      <div className="mt-3 flex flex-wrap gap-2">{feelings.map((item) => <button key={item} onClick={() => setFeeling(item)} className="rounded-full border px-3 py-2 text-xs font-semibold" style={{ borderColor: feeling === item ? "#1f6b62" : "#E4E4E7", background: feeling === item ? "#E7F0E5" : "#FFFFFF", color: "#2F3E46" }}>{item}</button>)}</div>
      {feeling && <div className="mt-4"><p className="text-sm font-bold" style={{ color: "#111111" }}>Severity: {level}/5</p><div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((number) => <button key={number} onClick={() => setLevel(number)} className="grid h-9 w-9 place-items-center rounded-lg border text-sm font-bold" style={{ borderColor: level === number ? "#1f6b62" : "#E4E4E7", background: level === number ? "#E7F0E5" : "#FFFFFF", color: "#2F3E46" }}>{number}</button>)}<button onClick={addSymptom} className="ml-2 rounded-lg px-4 py-2 text-xs font-bold" style={{ background: "#1f6b62", color: "#FFFFFF" }}>Add</button></div></div>}
    </div>}
    {selected.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{selected.map((item) => <span key={item.bodyPart} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold" style={{ background: "#E7F0E5", color: "#2F3E46" }}>{item.bodyPart} · {item.feeling} · {item.severity}/5 <button aria-label={`Remove ${item.bodyPart}`} onClick={() => removeSymptom(item.bodyPart)} className="font-bold" style={{ color: "#1f6b62" }}>×</button></span>)}</div>}
    <button onClick={onSkip} disabled={skipped} className="mt-5 block text-sm font-bold disabled:opacity-50" style={{ color: "#1f6b62" }}>{skipped ? "Body map skipped" : "Skip body map"}</button>
  </div>;
};

const VoiceCheckIn = ({ transcript, setTranscript, submitting, onSubmit }) => {
  const recognition = useRef(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const start = () => { if (!SpeechRecognition) return; const instance = new SpeechRecognition(); instance.continuous = true; instance.interimResults = true; instance.lang = "en-IN"; instance.onresult = (event) => setTranscript(Array.from(event.results).map((result) => result[0].transcript).join("")); instance.onend = () => setRecording(false); instance.start(); recognition.current = instance; setRecording(true); };
  const stop = async () => { recognition.current?.stop(); setRecording(false); if (!transcript.trim()) return; setProcessing(true); try { const { data } = await api.post("/checkins/extract-voice", { text: transcript }); setExtracted(data.extracted); } finally { setProcessing(false); } };
  return <div className="text-center"><p className="text-sm" style={{ color: "#6B7280" }}>Speak freely about how you feel today. Mention pain, discomfort, energy, and medicines.</p>{!extracted && <><button onClick={recording ? stop : start} className="mx-auto mt-8 grid h-28 w-28 place-items-center rounded-full text-4xl" style={{ background: recording ? "#dc2626" : "#06b6d4", animation: recording ? "pulse 1.2s infinite" : "none" }}>{recording ? "■" : "🎙"}</button><p className="mt-4 text-sm font-bold" style={{ color: "#111111" }}>{recording ? "Tap to stop" : "Tap to start recording"}</p></>}{!SpeechRecognition && <p className="mt-3 text-xs" style={{ color: "#BC6C25" }}>Voice recording is not supported in this browser.</p>}{transcript && <p className="mt-6 rounded-xl p-4 text-left text-sm" style={{ background: "#0d1117", color: "#e6edf3" }}>{transcript}</p>}{(processing || submitting) && <p className="mt-5 text-sm font-bold" style={{ color: "#06b6d4" }}>AI is analyzing your symptoms...</p>}{extracted && !processing && <div className="mt-6 rounded-xl p-5 text-left" style={{ background: "#0d1117", color: "#e6edf3" }}><h3 className="font-bold">Here's what I understood:</h3>{extracted.symptoms.map((item) => <p key={item.name} className="mt-3 text-sm">• {item.name} - severity {item.severity}/5</p>)}<p className="mt-3 text-sm">• Medicines taken: {extracted.medicationTaken ? "Yes" : "No"}</p><p className="mt-2 text-sm">• Energy level: {extracted.energyLevel}/5</p><button disabled={submitting} onClick={() => onSubmit(extracted)} className="mt-5 rounded-lg px-4 py-3 text-sm font-bold" style={{ background: "#06b6d4", color: "#06131a" }}>{submitting ? "Sending..." : "Looks right - send check-in"}</button></div>}<style>{"@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}"}</style></div>;
};

const BODY_ZONES = { Front: ["Head", "Chest", "Left arm", "Right arm", "Abdomen", "Left leg", "Right leg"], Back: ["Upper back", "Lower back", "Left shoulder", "Right shoulder"] };
const BodyMapStep = ({ selected, setSelected, listSelected, onToggle, showUrgentMessage }) => {
  const [side, setSide] = useState("Front");
  const [zone, setZone] = useState(null);
  const [sensation, setSensation] = useState("Pain");
  const [level, setLevel] = useState(3);
  const confirm = () => { if (!zone) return; setSelected((current) => [...current.filter((item) => item.name !== zone), { name: `${sensation} in ${zone}`, bodyPart: zone, severity: level }]); setZone(null); };
  return <div><h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>Where do you feel something?</h2><p className="mt-2 text-sm" style={{ color: "#6B7280" }}>Tap a body area, then describe the sensation.</p><div className="mt-5 flex gap-2"><button onClick={() => setSide("Front")} className="rounded-lg px-4 py-2 text-xs font-bold" style={{ background: side === "Front" ? "#06b6d4" : "#1c2128", color: side === "Front" ? "#06131a" : "#e6edf3" }}>Front</button><button onClick={() => setSide("Back")} className="rounded-lg px-4 py-2 text-xs font-bold" style={{ background: side === "Back" ? "#06b6d4" : "#1c2128", color: side === "Back" ? "#06131a" : "#e6edf3" }}>Back</button></div><svg viewBox="0 0 180 250" className="mx-auto mt-4 h-56 w-40" role="img" aria-label={`${side} body map`}><circle cx="90" cy="28" r="18" fill="none" stroke="#8b949e" strokeWidth="3" /><path d="M65 54 Q90 44 115 54 L126 125 L112 128 L108 220 M68 54 L54 125 L68 128 L72 220 M72 220 L61 242 M108 220 L119 242" fill="none" stroke="#8b949e" strokeWidth="5" strokeLinecap="round" /><rect x="72" y="70" width="36" height="45" rx="10" fill={selected.some((entry) => entry.bodyPart === (side === "Front" ? "Chest" : "Upper back")) ? "#06b6d4" : "#1c2128"} stroke="#06b6d4" onClick={() => setZone(side === "Front" ? "Chest" : "Upper back")} /></svg><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{BODY_ZONES[side].map((item) => <button key={item} onClick={() => setZone(item)} className="rounded-xl border p-3 text-sm font-bold" style={{ background: selected.some((entry) => entry.bodyPart === item) ? "#0e7490" : "#0d1117", borderColor: selected.some((entry) => entry.bodyPart === item) ? "#06b6d4" : "#21262d", color: "#e6edf3" }}>{item}</button>)}</div>{zone && <div className="mt-4 rounded-xl p-4" style={{ background: "#1c2128", color: "#e6edf3" }}><p className="text-sm font-bold">What do you feel in {zone}?</p><div className="mt-3 flex flex-wrap gap-2">{["Pain", "Tightness", "Numbness", "Swelling", "Burning", "Other"].map((item) => <button key={item} onClick={() => setSensation(item)} className="rounded-lg px-3 py-2 text-xs" style={{ background: sensation === item ? "#06b6d4" : "#0d1117", color: sensation === item ? "#06131a" : "#e6edf3" }}>{item}</button>)}</div><label className="mt-4 block text-xs">Severity: {level}/5<input className="mt-2 w-full accent-cyan-400" type="range" min="1" max="5" value={level} onChange={(event) => setLevel(Number(event.target.value))} /></label><button onClick={confirm} className="mt-3 rounded-lg px-4 py-2 text-xs font-bold" style={{ background: "#06b6d4", color: "#06131a" }}>Confirm</button></div>}<button onClick={() => onToggle("Other symptom") } className="mt-4 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#E4E4E7", color: "#1f6b62" }}>+ Add from list</button>{selected.length > 0 && <div className="mt-5 space-y-2">{selected.map((item) => <div key={item.name} className="flex justify-between rounded-lg p-3 text-sm" style={{ background: "#0d1117", color: "#e6edf3" }}><span>{item.name}</span><span style={{ color: "#06b6d4" }}>{item.severity}/5</span></div>)}</div>}{listSelected.length > 0 && <p className="mt-3 text-xs" style={{ color: "#6B7280" }}>Other selected symptoms can be detailed in the next step.</p>}{showUrgentMessage && <div className="mt-5 rounded-xl p-4 text-sm" style={{ background: "#FFF4E5", color: "#7A3E0B" }}>If symptoms are severe, sudden, or worsening, seek emergency help now.</div>}</div>;
};

const SymptomsStep = ({ selected, onToggle, showUrgentMessage }) => <>
  <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>Any symptoms to share?</h2>
  <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>Select all that apply. You can continue with none.</p>
  <div className="mt-6 grid gap-3 sm:grid-cols-2">
    {SYMPTOMS.map((item) => <button key={item.name} onClick={() => onToggle(item.name)} className="flex items-center justify-between rounded-xl border p-4 text-left text-sm font-semibold transition" style={{ borderColor: selected.includes(item.name) ? "#1f6b62" : "#E4E4E7", background: selected.includes(item.name) ? "#E7F0E5" : "#FFFFFF", color: "#111111" }}><span>{item.name}</span><span aria-hidden="true" style={{ color: "#1f6b62" }}>{selected.includes(item.name) ? "✓" : "+"}</span></button>)}
  </div>
  {showUrgentMessage && <div className="mt-5 rounded-xl border p-4 text-sm leading-6" style={{ background: "#FFF4E5", borderColor: "#F5C49D", color: "#7A3E0B" }}><strong className="block">These symptoms can need urgent attention.</strong> If symptoms are severe, sudden, or getting worse, seek emergency help now. Continue this check-in only if it is safe to do so.</div>}
</>;

const DetailsStep = ({ symptoms, severity, setSeverity, medicationStatus, setMedicationStatus, activity, setActivity, note, setNote }) => <>
  <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>A little more detail</h2>
  {symptoms.length > 0 && <div className="mt-5 space-y-5">{symptoms.map((symptom) => <div key={symptom}><div className="flex justify-between text-sm font-bold" style={{ color: "#111111" }}><span>{symptom}</span><span style={{ color: "#1f6b62" }}>{SEVERITY_LABELS[(severity[symptom] || 2) - 1]}</span></div><input aria-label={`${symptom} severity`} className="mt-3 w-full accent-[#1f6b62]" type="range" min="1" max="5" value={severity[symptom] || 2} onChange={(event) => setSeverity((current) => ({ ...current, [symptom]: Number(event.target.value) }))} /></div>)}</div>}
  <div className="mt-6 grid gap-5 sm:grid-cols-2">
    <label className="text-sm font-bold" style={{ color: "#111111" }}>Medication today<select value={medicationStatus} onChange={(event) => setMedicationStatus(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-normal" style={{ borderColor: "#E4E4E7", color: "#2F3E46" }}><option value="">Choose an option</option><option>Taken as planned</option><option>Missed a dose</option><option>I need help with medication</option></select></label>
    <label className="text-sm font-bold" style={{ color: "#111111" }}>Activity today<select value={activity} onChange={(event) => setActivity(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-normal" style={{ borderColor: "#E4E4E7", color: "#2F3E46" }}><option value="">Choose an option</option><option>Completed my planned activity</option><option>Did some activity</option><option>Rest day</option><option>Could not do planned activity</option></select></label>
  </div>
  <label className="mt-5 block text-sm font-bold" style={{ color: "#111111" }}>Anything else to share? <span className="font-normal" style={{ color: "#6B7280" }}>(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="500" rows="3" placeholder="Write a note for your care team" className="mt-2 w-full resize-none rounded-xl border p-3 text-sm font-normal" style={{ borderColor: "#E4E4E7", color: "#2F3E46" }} /></label>
</>;

const ReviewStep = ({ feeling, symptoms, severity, medicationStatus, activity, note }) => <>
  <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>Ready to send?</h2>
  <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>Review your update before it is shared with your care team.</p>
  <div className="mt-6 space-y-3 text-sm"><Summary label="How you feel" value={feeling?.label} /><Summary label="Symptoms" value={symptoms.length ? symptoms.map((item) => `${item} (${SEVERITY_LABELS[(severity[item] || 2) - 1]})`).join(", ") : "No new symptoms"} /><Summary label="Medication" value={medicationStatus || "Not answered"} /><Summary label="Activity" value={activity || "Not answered"} />{note && <Summary label="Note" value={note} />}</div>
</>;

const Summary = ({ label, value }) => <div className="rounded-xl p-4" style={{ background: "#F5F0EB" }}><p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#6B7280" }}>{label}</p><p className="mt-1 leading-5" style={{ color: "#111111" }}>{value}</p></div>;

export default PatientCheckIn;
