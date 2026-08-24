import { useEffect, useMemo, useState } from "react";
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

const isToday = (date) => {
  if (!date) return false;
  const value = new Date(date);
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate();
};

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
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [feeling, setFeeling] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [severity, setSeverity] = useState({});
  const [medicationStatus, setMedicationStatus] = useState("");
  const [activity, setActivity] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/patients/me")
      .then(({ data }) => {
        if (!active) return;
        setAlreadySubmitted((data.checkIns || []).some((checkIn) => isToday(checkIn.date)));
      })
      .catch(() => active && addToast("We could not load your recovery details. Please try again.", "watch"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [addToast]);

  const currentFeeling = FEELINGS.find((item) => item.id === feeling);
  const urgentSymptomSelected = selectedSymptoms.some((name) => SYMPTOMS.find((symptom) => symptom.name === name)?.urgent);
  const showUrgentMessage = urgentSymptomSelected || feeling === "help";
  const progress = ((step + 1) / 4) * 100;

  const submittedSymptoms = useMemo(() => {
    const wellbeing = currentFeeling
      ? [{ name: `Daily wellbeing: ${currentFeeling.label}`, severity: currentFeeling.severity, source: "checklist", aiFlag: feeling === "help" }]
      : [];
    const symptoms = selectedSymptoms.map((name) => ({
      name,
      severity: severity[name] || 2,
      source: "checklist",
      aiFlag: SYMPTOMS.find((item) => item.name === name)?.urgent === true,
    }));

    // The API requires at least one entry. A symptom-free day is still a useful check-in.
    return symptoms.length
      ? [...wellbeing, ...symptoms]
      : [...wellbeing, { name: "No new symptoms reported", severity: 1, source: "checklist", aiFlag: false }];
  }, [currentFeeling, feeling, selectedSymptoms, severity]);

  const toggleSymptom = (name) => {
    setSelectedSymptoms((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
    setSeverity((current) => ({ ...current, [name]: current[name] || 2 }));
  };

  const next = () => {
    if (step === 0 && !feeling) {
      addToast("Choose the option that best describes today.", "watch");
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/checkins", { symptoms: submittedSymptoms, medicationStatus, activity, note, language: "English" });
      setSubmitted({ ...data.checkIn, note, medicationStatus, activity });
      setAlreadySubmitted(true);
    } catch (error) {
      addToast(error.response?.data?.message || "Your check-in could not be sent. Please try again.", "critical");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm" style={{ background: "#F5F0EB", color: "#1f6b62" }}>Loading your check-in…</div>;
  }

  if (alreadySubmitted && !submitted) {
    return (
      <CheckInFrame title="Today's check-in is complete" onBack={() => navigate("/patient/home")}>
        <div className="rounded-2xl p-7 text-center" style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full text-2xl" style={{ background: "#E7F0E5" }}>✓</div>
          <h2 className="text-xl font-extrabold" style={{ color: "#111111" }}>Thank you for checking in.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: "#6B7280" }}>Your care team has today’s update. You can return tomorrow for your next check-in.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate("/patient/plan")} style={{ background: "#1f6b62", color: "#FFFFFF" }}>View recovery guide</Button>
            <Button onClick={() => navigate("/patient/home")} style={{ background: "#F5F0EB", color: "#2F3E46" }}>Back to home</Button>
          </div>
        </div>
      </CheckInFrame>
    );
  }

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
        {step === 1 && <SymptomsStep selected={selectedSymptoms} onToggle={toggleSymptom} showUrgentMessage={showUrgentMessage} />}
        {step === 2 && <DetailsStep symptoms={selectedSymptoms} severity={severity} setSeverity={setSeverity} medicationStatus={medicationStatus} setMedicationStatus={setMedicationStatus} activity={activity} setActivity={setActivity} note={note} setNote={setNote} />}
        {step === 3 && <ReviewStep feeling={currentFeeling} symptoms={selectedSymptoms} severity={severity} medicationStatus={medicationStatus} activity={activity} note={note} />}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button onClick={() => step === 0 ? navigate("/patient/home") : setStep((current) => current - 1)} style={{ background: "#F5F0EB", color: "#2F3E46" }}>{step === 0 ? "Cancel" : "Back"}</Button>
          {step < 3 ? <Button onClick={next} style={{ background: "#1f6b62", color: "#FFFFFF" }}>Continue →</Button> : <Button disabled={submitting} onClick={submit} style={{ background: "#1f6b62", color: "#FFFFFF" }}>{submitting ? "Sending…" : "Send check-in"}</Button>}
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
      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#BC6C25" }}>Recovery pulse</p>
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
