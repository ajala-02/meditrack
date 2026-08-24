import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";

const titleCase = (value = "") => value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
const dateLabel = (date) => date ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date)) : "—";

const RecoveryPlan = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("guide");

  useEffect(() => {
    let active = true;
    api.get("/patients/me")
      .then(({ data }) => { if (active) setPatient(data.patient); })
      .catch(() => active && addToast("We could not load your recovery plan. Please try again.", "watch"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [addToast]);

  const plan = patient ? { instructions: patient.recoveryInstructions || {} } : null;

  if (loading) return <div className="min-h-screen grid place-items-center text-sm" style={{ background: "#F5F0EB", color: "#1f6b62" }}>Loading your recovery plan…</div>;
  if (!patient || !plan) return <div className="min-h-screen grid place-items-center p-6 text-center" style={{ background: "#F5F0EB", color: "#2F3E46" }}><div><p>Your recovery plan could not be loaded.</p><button onClick={() => navigate("/patient/home")} className="mt-4 text-sm font-bold" style={{ color: "#1f6b62" }}>Back to home</button></div></div>;

  const instructionSections = [
    { key: "dos", title: "What to do", icon: "✓", items: plan.instructions.dos || [] },
    { key: "donts", title: "What to avoid", icon: "−", items: plan.instructions.donts || [] },
    { key: "diet", title: "Food & drink", icon: "⌁", items: plan.instructions.diet || [] },
    { key: "woundCare", title: "Wound care", icon: "✦", items: plan.instructions.woundCare || [] },
  ].filter((section) => section.items.length);
  const hasRedFlags = (plan.instructions.redFlags || []).length > 0;

  return (
    <main className="min-h-screen pb-12" style={{ background: "#F5F0EB", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <button onClick={() => navigate("/patient/home")} className="text-sm font-bold" style={{ color: "#1f6b62" }}>← Back to recovery space</button>
        <section className="mt-6 overflow-hidden rounded-3xl p-6 sm:p-8" style={{ background: "#1f6b62" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#F5C49D" }}>Your care instructions</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">{titleCase(patient.condition)} Recovery Guide</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "#D7EBE3" }}>{patient.diagnosis || "Your personalised post-discharge instructions"}</p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.1em]" style={{ color: "#F5C49D" }}>Monitoring ends {dateLabel(patient.monitoringEndDate)}</p>
        </section>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {[['guide', 'Recovery guide'], ['medicines', 'Medicines'], ['help', 'Safety & support']].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className="shrink-0 rounded-full px-4 py-2 text-sm font-bold" style={{ background: tab === id ? "#1f6b62" : "#FFFFFF", color: tab === id ? "#FFFFFF" : "#2F3E46", border: tab === id ? "1px solid #1f6b62" : "1px solid #E4E4E7" }}>{label}</button>)}
        </div>

        {tab === "guide" && <Guide sections={instructionSections} />}
        {tab === "medicines" && <Medicines medicines={patient.medicines || []} />}
        {tab === "help" && <Help patient={patient} redFlags={plan.instructions.redFlags || []} hasRedFlags={hasRedFlags} />}
      </div>
    </main>
  );
};

const Card = ({ children, className = "" }) => <div className={`rounded-2xl p-5 ${className}`} style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}>{children}</div>;
const Heading = ({ eyebrow, children, detail }) => <div><p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#BC6C25" }}>{eyebrow}</p><h2 className="mt-1 text-xl font-extrabold" style={{ color: "#111111" }}>{children}</h2>{detail && <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>{detail}</p>}</div>;

const Guide = ({ sections }) => <section className="mt-6"><Heading eyebrow="Your recovery guide" detail="These instructions come from your care plan.">Follow your plan</Heading>{sections.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{sections.map((section) => <Card key={section.key}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "#E7F0E5", color: "#386641" }}>{section.icon}</span><h3 className="text-sm font-extrabold" style={{ color: "#111111" }}>{section.title}</h3></div><ul className="mt-4 space-y-3">{section.items.map((item) => <li key={item} className="text-sm leading-5" style={{ color: "#2F3E46" }}>{item}</li>)}</ul></Card>)}</div> : <Card className="mt-5"><p className="text-sm" style={{ color: "#6B7280" }}>Your detailed recovery guide will appear here once your care team adds it.</p></Card>}</section>;

const Medicines = ({ medicines }) => <section className="mt-6"><Heading eyebrow="Medication plan" detail="Use your prescription label and care-team instructions as the source of truth.">Your medicines</Heading>{medicines.length ? <div className="mt-5 space-y-3">{medicines.map((medicine, index) => <Card key={`${medicine.name}-${index}`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="text-base font-extrabold" style={{ color: "#111111" }}>{medicine.name || "Medicine"}</h3><p className="mt-1 text-sm" style={{ color: "#6B7280" }}>{[medicine.dosage, medicine.frequency].filter(Boolean).join(" · ") || "Follow your prescription directions"}</p></div><div className="text-sm sm:text-right" style={{ color: "#2F3E46" }}>{medicine.timing && <p><strong>When:</strong> {medicine.timing}</p>}{medicine.duration && <p className="mt-1"><strong>Duration:</strong> {medicine.duration}</p>}</div></div></Card>)}</div> : <Card className="mt-5"><p className="text-sm" style={{ color: "#6B7280" }}>No medicines have been added to this plan.</p></Card>}</section>;

const Help = ({ patient, redFlags, hasRedFlags }) => <section className="mt-6"><Heading eyebrow="Safety & support" detail="If you are severely unwell, do not wait for a message back.">Know when to get help</Heading><div className="mt-5 grid gap-4 md:grid-cols-2"><Card><h3 className="text-base font-extrabold" style={{ color: "#9B2226" }}>Warning signs from your care plan</h3>{hasRedFlags ? <ul className="mt-4 space-y-3">{redFlags.map((item) => <li key={item} className="flex gap-3 text-sm leading-5" style={{ color: "#2F3E46" }}><span style={{ color: "#9B2226" }}>•</span>{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6" style={{ color: "#6B7280" }}>Contact your care team if something feels worse or different from your usual recovery. Follow the emergency instructions you received at discharge for urgent symptoms.</p>}</Card><Card><h3 className="text-base font-extrabold" style={{ color: "#111111" }}>Your support contact</h3>{patient.caregiverName || patient.caregiverPhone ? <><p className="mt-3 text-sm font-bold" style={{ color: "#2F3E46" }}>{patient.caregiverName || "Caregiver"}</p>{patient.caregiverPhone && <a href={`tel:${patient.caregiverPhone}`} className="mt-1 inline-block text-sm font-bold" style={{ color: "#1f6b62" }}>Call {patient.caregiverPhone}</a>}</> : <p className="mt-3 text-sm leading-6" style={{ color: "#6B7280" }}>Use the contact details your care team gave you at discharge.</p>}<p className="mt-5 rounded-xl p-3 text-xs leading-5" style={{ background: "#FFF4E5", color: "#7A3E0B" }}>This plan does not replace emergency care. If symptoms are severe or rapidly worsening, seek emergency help immediately.</p></Card></div></section>;

export default RecoveryPlan;
