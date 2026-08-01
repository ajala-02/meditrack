import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { useAuth } from "../../context/AuthContext";
import useSocket from "../../hooks/useSocket";
import TopBar from "../../components/TopBar";
import api from "../../api/axios";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/* ── Constants ─────────────────────────────────────────── */

const RISK_CFG = {
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  watch:    { label: "Watch",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  stable:   { label: "Stable",   color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
};
const CONDITION_ICONS = { cardiac: "🫀", ortho: "🦴", diabetes: "💉", other: "🩺" };
const SEV_COLORS = ["#10b981", "#22d3ee", "#f59e0b", "#f97316", "#ef4444"];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const dayOf = (discharge) => { if (!discharge) return 0; return Math.max(1, Math.ceil((Date.now() - new Date(discharge).getTime()) / 864e5)); };

/* ── Severity Bar ──────────────────────────────────────── */

const SeverityBar = ({ severity }) => (
  <div className="flex items-center gap-2 w-full">
    <div className="flex-1 h-2 rounded-full bg-[#1e293b] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(severity / 5) * 100}%`, background: SEV_COLORS[severity - 1] || SEV_COLORS[2] }}
      />
    </div>
    <span className="text-xs font-bold w-4 text-right" style={{ color: SEV_COLORS[severity - 1] }}>{severity}</span>
  </div>
);

/* ── Trend Chart ───────────────────────────────────────── */

const TrendChart = ({ trend }) => {
  if (!trend || trend.length === 0) return <p className="text-sm text-[#475569] text-center py-8">No trend data yet.</p>;

  const labels = trend.map((t) => fmtDate(t.date));
  const scores = trend.map((t) => t.overallScore);
  const counts = trend.map((t) => t.symptomCount);

  const data = {
    labels,
    datasets: [
      {
        label: "Risk Score",
        data: scores,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.08)",
        pointBackgroundColor: trend.map((t) => RISK_CFG[t.riskStatus]?.color || "#6366f1"),
        pointBorderColor: "transparent",
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true,
        borderWidth: 2,
      },
      {
        label: "Symptom Count",
        data: counts,
        borderColor: "#06b6d4",
        backgroundColor: "transparent",
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.35,
        borderWidth: 1.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top", labels: { color: "#94a3b8", usePointStyle: true, pointStyle: "circle", padding: 16, font: { size: 11 } } },
      tooltip: { backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#94a3b8", borderColor: "#334155", borderWidth: 1, cornerRadius: 8, padding: 10 },
    },
    scales: {
      x: { grid: { color: "rgba(51,65,85,0.3)" }, ticks: { color: "#64748b", font: { size: 10 } } },
      y: { min: 0, max: 6, grid: { color: "rgba(51,65,85,0.3)" }, ticks: { color: "#64748b", stepSize: 1, font: { size: 10 } } },
    },
  };

  return <div className="h-64"><Line data={data} options={options} /></div>;
};

/* ── Symptom Card ──────────────────────────────────────── */

const SymptomCard = ({ symptom }) => {
  const flagged = symptom.aiFlag;
  return (
    <div
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: flagged ? "rgba(249,115,22,0.06)" : "rgba(30,41,59,0.4)",
        border: `1px solid ${flagged ? "rgba(249,115,22,0.25)" : "#1e293b"}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{symptom.name}</span>
          {flagged && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(249,115,22,0.15)] text-[#fb923c] border border-[rgba(249,115,22,0.3)]">
              ⚠ AI FLAG
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded text-[10px] text-[#64748b] bg-[#1e293b]">{symptom.source === "voiceText" ? "🎤 Voice" : "☑ Checklist"}</span>
        </div>
      </div>
      <SeverityBar severity={symptom.severity} />
      {flagged && symptom.flagNote && <p className="text-xs text-[#fb923c] mt-2 pl-1">💡 {symptom.flagNote}</p>}
    </div>
  );
};

/* ── Check-In Card ─────────────────────────────────────── */

const CheckInEntry = ({ checkIn, isLatest, onRespond, responding, user }) => {
  const [response, setResponse] = useState("");
  const risk = RISK_CFG[checkIn.riskStatus] || RISK_CFG.stable;
  const canRespond = ["doctor", "nurse"].includes(user?.role) && !checkIn.doctorResponse;

  const handleSubmit = async () => {
    if (!response.trim()) return;
    await onRespond(checkIn._id, response.trim());
    setResponse("");
  };

  return (
    <div className={`rounded-xl p-5 animate-fade-in ${isLatest ? "" : ""}`} style={{ background: "rgba(30,41,59,0.5)", border: `1px solid ${isLatest ? risk.border : "#1e293b"}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: risk.color }} />
            {risk.label}
          </div>
          <span className="text-xs text-[#64748b]">Day {checkIn.day || "—"} • {fmtDateTime(checkIn.date)}</span>
          {isLatest && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(99,102,241,0.15)] text-[#818cf8]">LATEST</span>}
        </div>
        <span className="text-lg font-bold" style={{ color: risk.color }}>{checkIn.overallScore?.toFixed(1)}</span>
      </div>

      {/* Symptoms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        {checkIn.symptoms?.map((s, i) => <SymptomCard key={i} symptom={s} />)}
      </div>

      {/* AI Response */}
      {checkIn.aiResponse && (
        <div className="rounded-xl p-4 mb-3" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
          <p className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-wider mb-1">🤖 AI Response</p>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{checkIn.aiResponse}</p>
        </div>
      )}

      {/* Doctor Response */}
      {checkIn.doctorResponse ? (
        <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-[#10b981] uppercase tracking-wider">👨‍⚕️ Doctor Response</p>
            <span className="text-[10px] text-[#475569]">{checkIn.respondedBy?.name} • {fmtDateTime(checkIn.respondedAt)}</span>
          </div>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{checkIn.doctorResponse}</p>
        </div>
      ) : canRespond && isLatest ? (
        <div className="rounded-xl p-4" style={{ background: "rgba(30,41,59,0.6)", border: "1px solid #334155" }}>
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Write Response</p>
          <textarea
            id="doctor-response-input"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Write your clinical response to the patient…"
            rows={3}
            className="w-full p-3 rounded-xl text-sm text-white placeholder-[#475569] outline-none resize-none transition-all duration-200"
            style={{ background: "#0f172a", border: "1px solid #334155" }}
            onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }}
            onBlur={(e) => { e.target.style.borderColor = "#334155"; }}
          />
          <div className="flex justify-end mt-2">
            <button
              id="send-response-btn"
              onClick={handleSubmit}
              disabled={!response.trim() || responding}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }}
            >
              {responding ? "Sending…" : "Send Response"}
            </button>
          </div>
        </div>
      ) : !checkIn.doctorResponse ? (
        <p className="text-xs text-[#475569] italic">Awaiting clinician response…</p>
      ) : null}
    </div>
  );
};

/* ── Main Page ─────────────────────────────────────────── */

const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [patient, setPatient] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const { data } = await api.get(`/patients/${id}`);
      setPatient(data.patient);
      setCheckIns(data.checkIns || []);
      setTrend(data.trend || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load patient data.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Join patient room for real-time updates
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("join_patient_room", id);
    return () => { socket.emit("leave_patient_room", id); };
  }, [socket, id]);

  // Listen for real-time check-in responses
  useEffect(() => {
    if (!socket) return;
    const handleResponse = (data) => {
      setCheckIns((prev) => prev.map((ci) =>
        ci._id === data.checkInId ? { ...ci, doctorResponse: data.doctorResponse, respondedBy: data.respondedBy, respondedAt: data.respondedAt } : ci
      ));
    };
    const handleNewAlert = () => fetchData();
    socket.on("checkin_response", handleResponse);
    socket.on("critical_alert", handleNewAlert);
    socket.on("risk_update", handleNewAlert);
    return () => { socket.off("checkin_response", handleResponse); socket.off("critical_alert", handleNewAlert); socket.off("risk_update", handleNewAlert); };
  }, [socket, fetchData]);

  const handleRespond = async (checkInId, doctorResponse) => {
    try {
      setResponding(true);
      await api.patch(`/checkins/${checkInId}/respond`, { doctorResponse });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send response.");
    } finally {
      setResponding(false);
    }
  };

  const handleEscalate = async () => {
    if (!window.confirm("Escalate this patient? This will trigger immediate alerts to all staff.")) return;
    try {
      setEscalating(true);
      await api.patch(`/patients/${id}/status`, { status: "escalated" });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Escalation failed.");
    } finally {
      setEscalating(false);
    }
  };

  // Computed values
  const latestCheckIn = checkIns[0] || null;
  const currentRisk = latestCheckIn?.riskStatus || "stable";
  const riskCfg = RISK_CFG[currentRisk];
  const day = dayOf(patient?.dischargeDate);
  const conditionIcon = CONDITION_ICONS[patient?.condition] || "🩺";

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Patient Detail" />
        <div className="flex items-center justify-center py-32">
          <svg className="animate-spin h-8 w-8 text-[#6366f1]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <TopBar title="Patient Detail" />
        <div className="px-8 py-12 text-center">
          <p className="text-[#fca5a5] mb-3">{error}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg text-sm bg-[#1e293b] text-[#94a3b8] hover:text-white cursor-pointer">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title={patient?.userId?.name || "Patient"} subtitle={`${conditionIcon} ${patient?.condition?.charAt(0).toUpperCase()}${patient?.condition?.slice(1)} • Day ${day} of 14`} />

      <div className="px-8 py-6 space-y-6 animate-fade-in">

        {/* ── Patient Header Card ──────────────────────── */}
        <div className="rounded-xl p-6 flex items-center justify-between" style={{ background: "rgba(30,41,59,0.5)", border: "1px solid #1e293b" }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${riskCfg.color}88, ${riskCfg.color}44)` }}>
              {patient?.userId?.name?.charAt(0)?.toUpperCase() || "P"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{patient?.userId?.name}</h2>
              <p className="text-sm text-[#64748b]">{patient?.userId?.email}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-[#94a3b8]">Enrolled by <strong className="text-[#cbd5e1]">{patient?.enrolledBy?.name}</strong></span>
                <span className="text-xs text-[#475569]">•</span>
                <span className="text-xs text-[#94a3b8]">Discharged {fmtDate(patient?.dischargeDate)}</span>
                <span className="text-xs text-[#475569]">•</span>
                <span className={`text-xs font-medium capitalize ${patient?.status === "escalated" ? "text-[#ef4444]" : patient?.status === "completed" ? "text-[#10b981]" : "text-[#94a3b8]"}`}>{patient?.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Risk badge */}
            <div className="text-center">
              <div className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: riskCfg.bg, color: riskCfg.color, border: `1px solid ${riskCfg.border}` }}>
                {riskCfg.label} • {latestCheckIn?.overallScore?.toFixed(1) || "—"}
              </div>
              <p className="text-[10px] text-[#475569] mt-1">Current Risk</p>
            </div>
            {/* Escalate button — doctors only */}
            {user?.role === "doctor" && patient?.status === "active" && (
              <button
                id="escalate-btn"
                onClick={handleEscalate}
                disabled={escalating}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 14px rgba(239,68,68,0.3)" }}
              >
                {escalating ? "Escalating…" : "🚨 Escalate"}
              </button>
            )}
          </div>
        </div>

        {/* ── Two Column Layout ────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left: Chart + Check-ins (2 cols) */}
          <div className="xl:col-span-2 space-y-6">
            {/* Trend Chart */}
            <div className="rounded-xl p-6" style={{ background: "rgba(30,41,59,0.5)", border: "1px solid #1e293b" }}>
              <h3 className="text-sm font-semibold text-white mb-4">📈 Symptom Trend — Last 14 Days</h3>
              <TrendChart trend={trend} />
            </div>

            {/* Check-in History */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">📋 Check-in History</h3>
              {checkIns.length === 0 ? (
                <div className="rounded-xl p-8 text-center" style={{ background: "rgba(30,41,59,0.3)", border: "1px solid #1e293b" }}>
                  <p className="text-sm text-[#475569]">No check-ins recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkIns.map((ci, i) => (
                    <CheckInEntry key={ci._id} checkIn={ci} isLatest={i === 0} onRespond={handleRespond} responding={responding} user={user} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Info Sidebar (1 col) */}
          <div className="space-y-4">
            {/* Recovery Progress */}
            <div className="rounded-xl p-5" style={{ background: "rgba(30,41,59,0.5)", border: "1px solid #1e293b" }}>
              <h3 className="text-sm font-semibold text-white mb-3">Recovery Progress</h3>
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#94a3b8]">Day {day} of 14</span>
                  <span className="text-[#818cf8] font-semibold">{Math.min(100, Math.round((day / 14) * 100))}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#1e293b] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (day / 14) * 100)}%`, background: "linear-gradient(90deg, #6366f1, #06b6d4)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg p-3 bg-[#0f172a]">
                  <p className="text-[10px] text-[#475569] uppercase">Total Check-ins</p>
                  <p className="text-lg font-bold text-white">{checkIns.length}</p>
                </div>
                <div className="rounded-lg p-3 bg-[#0f172a]">
                  <p className="text-[10px] text-[#475569] uppercase">Avg Score</p>
                  <p className="text-lg font-bold text-white">
                    {checkIns.length ? (checkIns.reduce((a, c) => a + c.overallScore, 0) / checkIns.length).toFixed(1) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="rounded-xl p-5" style={{ background: "rgba(30,41,59,0.5)", border: "1px solid #1e293b" }}>
              <h3 className="text-sm font-semibold text-white mb-3">Details</h3>
              <div className="space-y-3">
                {[
                  ["Condition", `${conditionIcon} ${patient?.condition}`],
                  ["Discharge", fmtDate(patient?.dischargeDate)],
                  ["Monitor Until", fmtDate(patient?.monitoringEndDate)],
                  ["Enrolled By", patient?.enrolledBy?.name || "—"],
                  ["Caregiver", patient?.caregiverId?.name || "None assigned"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-xs text-[#64748b]">{k}</span>
                    <span className="text-xs text-[#cbd5e1] font-medium capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-[#94a3b8] bg-[#1e293b] hover:text-white hover:bg-[#334155] transition-all duration-200 cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetail;
