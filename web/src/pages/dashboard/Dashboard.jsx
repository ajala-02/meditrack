import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useSocket from "../../hooks/useSocket";
import useAlerts from "../../hooks/useAlerts";
import TopBar from "../../components/TopBar";
import api from "../../api/axios";

// ─── Helpers ─────────────────────────────────────────────

const RISK_ORDER = { critical: 0, watch: 1, stable: 2 };

const RISK_CONFIG = {
  critical: {
    label: "Critical",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.25)",
    dot: "#ef4444",
  },
  watch: {
    label: "Watch",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.25)",
    dot: "#f59e0b",
  },
  stable: {
    label: "Stable",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.25)",
    dot: "#10b981",
  },
};

const CONDITION_ICONS = {
  cardiac: "🫀",
  ortho: "🦴",
  diabetes: "💉",
  other: "🩺",
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "No check-in";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const getDayOfRecovery = (dischargeDate) => {
  if (!dischargeDate) return "—";
  const diff = Date.now() - new Date(dischargeDate).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// ─── Stats Card ──────────────────────────────────────────

const StatCard = ({ icon, label, value, color, accent }) => (
  <div
    className="rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
    style={{
      background: "rgba(30, 41, 59, 0.6)",
      border: "1px solid #1e293b",
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    }}
  >
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
        style={{ background: accent || "rgba(99,102,241,0.12)" }}
      >
        {icon}
      </div>
      <span className="text-sm text-[#64748b] font-medium">{label}</span>
    </div>
    <p className="text-3xl font-bold" style={{ color: color || "#f1f5f9" }}>
      {value}
    </p>
  </div>
);

// ─── Patient Card ────────────────────────────────────────

const PatientCard = ({ patient, onClick, index }) => {
  const riskStatus = patient.latestCheckIn?.riskStatus || "stable";
  const riskCfg = RISK_CONFIG[riskStatus] || RISK_CONFIG.stable;
  const score = patient.latestCheckIn?.overallScore ?? "—";
  const lastCheckIn = patient.latestCheckIn?.latestCheckInDate;
  const day = getDayOfRecovery(patient.dischargeDate);
  const hasResponse = patient.latestCheckIn?.hasResponse;
  const conditionIcon = CONDITION_ICONS[patient.condition] || "🩺";

  return (
    <div
      id={`patient-card-${patient._id}`}
      onClick={onClick}
      className="group rounded-xl p-5 cursor-pointer transition-all duration-300 animate-fade-in"
      style={{
        background: "rgba(30, 41, 59, 0.5)",
        border: `1px solid ${riskStatus === "critical" ? riskCfg.border : "#1e293b"}`,
        boxShadow:
          riskStatus === "critical"
            ? "0 0 20px rgba(239, 68, 68, 0.08)"
            : "0 2px 12px rgba(0,0,0,0.1)",
        animationDelay: `${index * 40}ms`,
        animationFillMode: "backwards",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = `1px solid ${riskCfg.border}`;
        e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.2), 0 0 20px ${riskCfg.bg}`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = `1px solid ${riskStatus === "critical" ? riskCfg.border : "#1e293b"}`;
        e.currentTarget.style.boxShadow =
          riskStatus === "critical"
            ? "0 0 20px rgba(239, 68, 68, 0.08)"
            : "0 2px 12px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Top row: Name + Risk badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${riskCfg.color}88, ${riskCfg.color}44)`,
            }}
          >
            {patient.userId?.name?.charAt(0)?.toUpperCase() || "P"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {patient.userId?.name || "Unknown Patient"}
            </p>
            <p className="text-xs text-[#64748b] mt-0.5">
              {conditionIcon} {patient.condition?.charAt(0).toUpperCase() + patient.condition?.slice(1)} • Day {day}
            </p>
          </div>
        </div>
        {/* Risk badge */}
        <span
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider risk-badge-${riskStatus}`}
        >
          {riskCfg.label}
        </span>
      </div>

      {/* Bottom row: Metrics */}
      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid #1e293b" }}>
        {/* Score */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: riskCfg.color }}>
            {typeof score === "number" ? score.toFixed(1) : score}
          </span>
        </div>

        {/* Last check-in */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-[#94a3b8]">{formatTimeAgo(lastCheckIn)}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Response status */}
        <div className="flex items-center gap-1.5">
          {hasResponse ? (
            <>
              <svg className="w-3.5 h-3.5 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-[#10b981]">Responded</span>
            </>
          ) : lastCheckIn ? (
            <>
              <svg className="w-3.5 h-3.5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-[#f59e0b]">Pending</span>
            </>
          ) : (
            <span className="text-xs text-[#475569]">No data</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { pendingCount } = useAlerts();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  // ── Fetch patients ────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    try {
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const { data } = await api.get("/patients", { params });
      setPatients(data.patients || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // ── Real-time updates via socket ──────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      // Re-fetch to get freshest data with proper sorting
      fetchPatients();
    };

    socket.on("new_alert", handleUpdate);
    socket.on("critical_alert", handleUpdate);
    socket.on("risk_update", handleUpdate);

    return () => {
      socket.off("new_alert", handleUpdate);
      socket.off("critical_alert", handleUpdate);
      socket.off("risk_update", handleUpdate);
    };
  }, [socket, fetchPatients]);

  // ── Filter by role ────────────────────────────────────
  const filteredPatients = patients.filter((p) => {
    const risk = p.latestCheckIn?.riskStatus;
    if (user?.role === "nurse") {
      // Nurses: show patients without check-ins OR stable (low severity)
      return !risk || risk === "stable";
    }
    if (user?.role === "doctor") {
      // Doctors: show watch + critical (medium + high severity)
      return risk === "watch" || risk === "critical";
    }
    return true; // admin sees all
  });

  // ── Compute stats ─────────────────────────────────────
  const stats = {
    total: patients.length,
    critical: patients.filter((p) => p.latestCheckIn?.riskStatus === "critical").length,
    watch: patients.filter((p) => p.latestCheckIn?.riskStatus === "watch").length,
    stable: patients.filter(
      (p) => !p.latestCheckIn?.riskStatus || p.latestCheckIn?.riskStatus === "stable"
    ).length,
  };

  // ── Greeting ──────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen">
      <TopBar
        title={`${greeting}, ${user?.name?.split(" ")[0] || "Doctor"}`}
        subtitle={`${filteredPatients.length} patient${filteredPatients.length !== 1 ? "s" : ""} requiring your attention`}
      />

      <div className="px-8 py-6">
        {/* ── Stats Row ────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="👥"
            label="Total Patients"
            value={stats.total}
          />
          <StatCard
            icon="🔴"
            label="Critical"
            value={stats.critical}
            color="#ef4444"
            accent="rgba(239, 68, 68, 0.1)"
          />
          <StatCard
            icon="🟡"
            label="Watch"
            value={stats.watch}
            color="#f59e0b"
            accent="rgba(245, 158, 11, 0.1)"
          />
          <StatCard
            icon="🟢"
            label="Stable"
            value={stats.stable}
            color="#10b981"
            accent="rgba(16, 185, 129, 0.1)"
          />
        </div>

        {/* ── Toolbar ──────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              id="patient-search"
              type="text"
              placeholder="Search patients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-[#475569] outline-none transition-all duration-200"
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }}
              onBlur={(e) => { e.target.style.borderColor = "#334155"; }}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#1e293b]">
            {["active", "completed", "escalated"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 capitalize cursor-pointer ${
                  statusFilter === s
                    ? "bg-[rgba(99,102,241,0.2)] text-[#818cf8]"
                    : "text-[#64748b] hover:text-[#94a3b8]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Patient Grid ─────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl p-5 border border-[#1e293b] bg-[rgba(30,41,59,0.5)] animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-full bg-[#334155]" />
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="h-4 bg-[#334155] rounded w-1/2" />
                      <div className="h-3 bg-[#1e293b] rounded w-1/3" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e293b]">
                  <div className="h-4 bg-[#334155] rounded w-8" />
                  <div className="h-4 bg-[#334155] rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            className="p-6 rounded-xl text-center"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <p className="text-sm text-[#fca5a5]">{error}</p>
            <button
              onClick={fetchPatients}
              className="mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-[#1e293b] text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-[#1e293b]">
              <svg className="w-8 h-8 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
            </div>
            <p className="text-sm text-[#94a3b8] font-medium">No patients to show</p>
            <p className="text-xs text-[#475569] mt-1">
              {user?.role === "nurse"
                ? "No low-severity patients at the moment"
                : "No medium or high severity patients at the moment"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPatients.map((patient, i) => (
              <PatientCard
                key={patient._id}
                patient={patient}
                index={i}
                onClick={() => navigate(`/patients/${patient._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
