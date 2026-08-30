import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const titleCase = (value = "") =>
  value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

const dateLabel = (date) =>
  date
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
        new Date(date)
      )
    : "—";

const RecoveryPlan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [patient, setPatient] = useState(null);
  const [careTeam, setCareTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("guide");

  useEffect(() => {
    let active = true;
    const fetchPatientData = async () => {
      setLoading(true);
      try {
        let response;
        try {
          response = await api.get("/patients/me");
        } catch (meErr) {
          const patientId = user?.id || user?._id;
          if (patientId) {
            response = await api.get(`/patients/${patientId}`);
          } else {
            throw meErr;
          }
        }

        if (active && response?.data) {
          const patientData = response.data.patient || response.data;
          setPatient(patientData);
          setCareTeam(response.data.careTeam || patientData.careTeam || []);
        }
      } catch (err) {
        console.error("Error loading recovery plan:", err);
        if (active) {
          addToast("We could not load your recovery plan. Please try again.", "watch");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchPatientData();
    return () => {
      active = false;
    };
  }, [user, addToast]);

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center text-sm"
        style={{ background: "#F5F0EB", color: "#1f6b62" }}
      >
        Loading your recovery plan…
      </div>
    );
  }

  if (!patient) {
    return (
      <div
        className="min-h-screen grid place-items-center p-6 text-center"
        style={{ background: "#F5F0EB", color: "#2F3E46" }}
      >
        <div>
          <p>Your recovery plan could not be loaded.</p>
          <button
            onClick={() => navigate("/patient/home")}
            className="mt-4 text-sm font-bold"
            style={{ color: "#1f6b62" }}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "#F5F0EB", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <button
          onClick={() => navigate("/patient/home")}
          className="text-sm font-bold"
          style={{ color: "#1f6b62" }}
        >
          ← Back to recovery space
        </button>

        <section
          className="mt-6 overflow-hidden rounded-3xl p-6 sm:p-8"
          style={{ background: "#1f6b62" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#F5C49D" }}>
            Your care instructions
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            {titleCase(patient.condition || "Recovery")} Recovery Guide
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "#D7EBE3" }}>
            {patient.diagnosis || "Your personalised post-discharge instructions"}
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.1em]" style={{ color: "#F5C49D" }}>
            Monitoring ends {dateLabel(patient.monitoringEndDate)}
          </p>
        </section>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {[
            ["guide", "Recovery guide"],
            ["medicines", "Medicines"],
            ["help", "Safety & support"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition"
              style={{
                background: tab === id ? "#1f6b62" : "#FFFFFF",
                color: tab === id ? "#FFFFFF" : "#2F3E46",
                border: tab === id ? "1px solid #1f6b62" : "1px solid #E4E4E7",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "guide" && <Guide instructions={patient.recoveryInstructions || {}} />}
        {tab === "medicines" && <Medicines medicines={patient.medicines || []} />}
        {tab === "help" && <Help patient={patient} careTeam={careTeam} />}
      </div>
    </main>
  );
};

const Card = ({ children, className = "", style = {} }) => (
  <div
    className={`rounded-2xl p-5 ${className}`}
    style={{ background: "#FFFFFF", border: "1px solid #E4E4E7", ...style }}
  >
    {children}
  </div>
);

const Heading = ({ eyebrow, children, detail }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#BC6C25" }}>
      {eyebrow}
    </p>
    <h2 className="mt-1 text-xl font-extrabold" style={{ color: "#111111" }}>
      {children}
    </h2>
    {detail && <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>{detail}</p>}
  </div>
);

const Guide = ({ instructions = {} }) => {
  const sections = [
    { key: "dos", title: "What to do", icon: "✓", items: instructions.dos || [] },
    { key: "donts", title: "What to avoid", icon: "−", items: instructions.donts || [] },
    { key: "diet", title: "Diet", icon: "⌁", items: instructions.diet || [] },
    { key: "woundCare", title: "Wound care", icon: "✦", items: instructions.woundCare || [] },
  ];

  return (
    <section className="mt-6">
      <Heading
        eyebrow="Your recovery guide"
        detail="These instructions come from your care plan."
      >
        Follow your plan
      </Heading>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const hasItems = Array.isArray(section.items) && section.items.length > 0;
          return (
            <Card key={section.key}>
              <div className="flex items-center gap-3">
                <span
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: "#E7F0E5", color: "#386641" }}
                >
                  {section.icon}
                </span>
                <h3 className="text-sm font-extrabold" style={{ color: "#111111" }}>
                  {section.title}
                </h3>
              </div>

              {hasItems ? (
                <ul className="mt-4 space-y-2.5">
                  {section.items.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm leading-5"
                      style={{ color: "#2F3E46" }}
                    >
                      <span className="font-bold select-none text-[#1f6b62]">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6" style={{ color: "#6B7280" }}>
                  Your care team will add this soon
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
};

const Medicines = ({ medicines = [] }) => (
  <section className="mt-6">
    <Heading
      eyebrow="Medication plan"
      detail="Use your prescription label and care-team instructions as the source of truth."
    >
      Your medicines
    </Heading>
    {medicines.length > 0 ? (
      <div className="mt-5 space-y-3">
        {medicines.map((medicine, index) => (
          <Card key={`${medicine.name}-${index}`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-extrabold" style={{ color: "#111111" }}>
                  {medicine.name || "Medicine"}{" "}
                  {medicine.dosage && (
                    <span className="font-bold" style={{ color: "#1f6b62" }}>
                      ({medicine.dosage})
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                  {[medicine.frequency, medicine.timing].filter(Boolean).join(" · ") ||
                    "Follow prescribed schedule"}
                </p>
              </div>
              <div className="text-sm sm:text-right" style={{ color: "#2F3E46" }}>
                {medicine.duration && (
                  <p>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
                      Duration:{" "}
                    </span>
                    <span className="font-bold">{medicine.duration}</span>
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    ) : (
      <Card className="mt-5">
        <p className="text-sm" style={{ color: "#6B7280" }}>
          No medicines scheduled
        </p>
      </Card>
    )}
  </section>
);

const Help = ({ patient = {}, careTeam = [] }) => {
  const redFlags = patient?.recoveryInstructions?.redFlags || [];
  const hasRedFlags = Array.isArray(redFlags) && redFlags.length > 0;
  const emergencyContact = patient?.emergencyContact;

  // Identify assigned doctor & nurse
  const doctor =
    (patient?.enrolledBy?.role === "doctor" ? patient.enrolledBy : null) ||
    careTeam.find((member) => member.role === "doctor") ||
    null;

  const nurse =
    (patient?.enrolledBy?.role === "nurse" ? patient.enrolledBy : null) ||
    careTeam.find((member) => member.role === "nurse") ||
    null;

  return (
    <section className="mt-6 space-y-6">
      <Heading
        eyebrow="Safety & support"
        detail="If you are severely unwell, do not wait for a message back."
      >
        Know when to get help
      </Heading>

      {/* Emergency 108 Hotline Banner */}
      <div
        className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5" }}
      >
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#DC2626] text-white text-xl">
            🚨
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#991B1B]">
              Emergency Medical Service
            </p>
            <p className="text-xl font-extrabold text-[#991B1B]">Dial 108</p>
            <p className="text-xs text-[#7F1D1D] mt-0.5">
              Available 24/7 for immediate ambulance & critical care support
            </p>
          </div>
        </div>
        <a
          href="tel:108"
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 shrink-0"
          style={{ background: "#DC2626" }}
        >
          Call 108
        </a>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Red Flags / Warning Signs */}
        <Card style={{ background: "#FFFBFB", border: "1px solid #FECACA" }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h3 className="text-base font-extrabold" style={{ color: "#9B2226" }}>
              Warning Signs (Red Flags)
            </h3>
          </div>
          {hasRedFlags ? (
            <ul className="mt-4 space-y-2.5">
              {redFlags.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 text-sm leading-5 font-medium"
                  style={{ color: "#991B1B" }}
                >
                  <span className="font-bold text-[#DC2626] select-none">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6" style={{ color: "#6B7280" }}>
              Your care team will add this soon
            </p>
          )}
        </Card>

        {/* Emergency Contact & Care Team */}
        <div className="space-y-4">
          {/* Emergency Contact */}
          <Card>
            <h3 className="text-base font-extrabold" style={{ color: "#111111" }}>
              Emergency Contact
            </h3>
            {emergencyContact?.name || emergencyContact?.phone ? (
              <div className="mt-3">
                <p className="text-sm font-bold" style={{ color: "#2F3E46" }}>
                  {emergencyContact.name || "Designated Contact"}
                </p>
                {emergencyContact.phone && (
                  <a
                    href={`tel:${emergencyContact.phone}`}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: "#1f6b62" }}
                  >
                    📞 Call {emergencyContact.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6" style={{ color: "#6B7280" }}>
                No emergency contact on file.
              </p>
            )}

            {(patient.caregiverName || patient.caregiverPhone) && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: "#E4E4E7" }}>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                  Caregiver
                </p>
                <p className="text-sm font-bold text-[#2F3E46] mt-1">
                  {patient.caregiverName || "Primary Caregiver"}
                </p>
                {patient.caregiverPhone && (
                  <a
                    href={`tel:${patient.caregiverPhone}`}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: "#1f6b62" }}
                  >
                    📞 Call {patient.caregiverPhone}
                  </a>
                )}
              </div>
            )}
          </Card>

          {/* Care Team */}
          <Card>
            <h3 className="text-base font-extrabold" style={{ color: "#111111" }}>
              Your Care Team
            </h3>
            <div className="mt-3 space-y-3">
              {doctor && (
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-[#111111]">{doctor.name}</p>
                    <p className="text-xs text-[#6B7280] capitalize">Enrolled Doctor</p>
                  </div>
                  <span className="rounded-md px-2.5 py-1 text-xs font-bold text-[#1f6b62] bg-[#E7F0E5]">
                    Doctor
                  </span>
                </div>
              )}
              {nurse && (
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-[#111111]">{nurse.name}</p>
                    <p className="text-xs text-[#6B7280] capitalize">Assigned Nurse</p>
                  </div>
                  <span className="rounded-md px-2.5 py-1 text-xs font-bold text-[#2B6CB0] bg-[#EBF8FF]">
                    Nurse
                  </span>
                </div>
              )}
              {!doctor && !nurse && (
                <p className="text-sm text-[#6B7280]">
                  Hospital Care Team at Sahyadri Specialty Hospital
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default RecoveryPlan;
