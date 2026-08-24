import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

const FALLBACK_RECOVERY_SIGNAL = [
  { label: "D1", value: 60 },
  { label: "D2", value: 55 },
  { label: "D3", value: 40 },
  { label: "D4", value: 45 },
  { label: "D5", value: 50 },
  { label: "D6", value: 35 },
  { label: "D7", value: 55 },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const toTitleCase = (str = "") =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// Builds a smooth SVG area-chart path from an array of values.
// Pure presentation helper -- no external charting library needed.
const buildAreaPath = (values, width, height, padding = 8) => {
  if (!values.length) return { line: "", area: "", points: [] };
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? usableW / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = padding + step * i;
    const y = padding + usableH - ((v - min) / range) * usableH;
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area =
    `M${points[0][0]},${height - padding} ` +
    points.map(([x, y]) => `L${x},${y}`).join(" ") +
    ` L${points[points.length - 1][0]},${height - padding} Z`;

  return { line, area, points };
};

const NAV_ITEMS = [
  { key: "checkin", label: "Check-In", icon: "📝", path: "/patient/check-in" },
  { key: "messages", label: "Messages", icon: "💬", path: null },
  { key: "timeline", label: "Timeline", icon: "📅", path: null },
];

const PatientHome = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recoverySignal, setRecoverySignal] = useState(FALLBACK_RECOVERY_SIGNAL);
  const [loadingSignal, setLoadingSignal] = useState(true);
  const [patientProfile, setPatientProfile] = useState(null);

  useEffect(() => {
    api
      .get("/patients/me")
      .then(({ data }) => {
        setPatientProfile(data.patient || null);
        const raw = data.checkIns || [];
        if (Array.isArray(raw) && raw.length > 0) {
          const last7 = raw.slice(0, 7).reverse().map((c, i) => ({
            label: `D${i + 1}`,
            value: (c.overallScore ?? 0) * 20,
          }));
          setRecoverySignal(last7);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSignal(false));
  }, []);

  const firstName = user?.name?.split(" ")[0] || "there";
  const initial = user?.name?.charAt(0)?.toUpperCase() || "P";
  const rawPlanName = patientProfile?.condition || patientProfile?.diagnosis || "Recovery plan";
  const planName = toTitleCase(rawPlanName);
  const guideName = patientProfile?.condition ? `${planName} Recovery Guide` : "Recovery guide";

  // Day-of-recovery progress -- computed defensively, falls back gracefully
  // if dischargeDate / monitoringDuration aren't present on the user object.
  const monitoringDuration = patientProfile?.monitoringDuration || 30;
  const daysSinceDischarge = patientProfile?.dischargeDate
    ? Math.max(1, Math.floor((Date.now() - new Date(patientProfile.dischargeDate)) / 86400000))
    : recoverySignal.length;
  const currentDay = Math.min(daysSinceDischarge, monitoringDuration);
  const progressPct = Math.min(100, Math.round((currentDay / monitoringDuration) * 100));

  const streakCount = recoverySignal.length;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Chart geometry
  const chartWidth = 560;
  const chartHeight = 140;
  const values = recoverySignal.map((d) => d.value);
  const { area, line, points } = buildAreaPath(values, chartWidth, chartHeight);

  return (
    <div
      className="min-h-screen lg:flex"
      style={{ background: "#F5F0EB", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Desktop sidebar nav */}
      <aside
        className="hidden lg:flex flex-col items-center gap-2 w-20 py-8 shrink-0"
        style={{ background: "#18181B" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-8 font-extrabold text-sm"
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
              item.path ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-30"
            }`}
            style={{ color: "#FFFFFF" }}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      {/* Main column */}
      <div className="flex-1 pb-20 lg:pb-0 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-6 pb-4 lg:px-10 lg:pt-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.13em] uppercase mb-0.5" style={{ color: "#BC6C25" }}>
              Your recovery space
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "#111111" }}>
              {getGreeting()}, {firstName}.
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {streakCount > 0 && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: "#FCEAD3", color: "#BC6C25" }}
              >
                🔥 {streakCount}-day streak
              </span>
            )}

            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm relative cursor-pointer"
                style={{ background: "#CAD2C5", color: "#2F3E46" }}
              >
                {initial}
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: "#386641", borderColor: "#F5F0EB" }}
                />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-44 rounded-xl shadow-lg overflow-hidden z-10"
                  style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                >
                  <div
                    className="px-4 py-3 text-sm font-medium"
                    style={{ color: "#111111", borderBottom: "1px solid #F4F4F5" }}
                  >
                    {user?.name}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm cursor-pointer"
                    style={{ color: "#9B2226" }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's focus -- widened hero with progress ring */}
        <div
          className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10 lg:px-10 lg:py-12"
          style={{ background: "#1f6b62" }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[36px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full opacity-10 blur-2xl" style={{ background: "#e9ad7e" }} />
          <div className="pointer-events-none absolute right-1/4 -top-6 h-32 w-32 rounded-full opacity-10" style={{ background: "#84a98c" }} />
          <div className="pointer-events-none hidden lg:block absolute right-16 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full border-[48px] border-white/[0.06]" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 max-w-4xl">
            <div className="max-w-md">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.14em] uppercase px-3 py-1.5 rounded-full mb-5"
                style={{ background: "rgba(255,255,255,0.12)", color: "#f5c49d", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#f5c49d" }} />
                Today's focus
              </span>

              <h2 className="text-2xl font-extrabold mb-3 leading-[1.1] tracking-[-0.03em] sm:text-3xl" style={{ color: "#FFFFFF" }}>
                A small check-in can make a big difference.
              </h2>
              <p className="mb-6 text-sm leading-relaxed" style={{ color: "#d7ebe3" }}>
                Tell us how you feel today. Your care team will stay informed.
              </p>
              <button
                onClick={() => navigate("/patient/check-in")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold cursor-pointer transition hover:opacity-90"
                style={{ background: "#FFFFFF", color: "#1f6b62" }}
              >
                Start today's check-in <span>→</span>
              </button>
            </div>

            {/* Day-of-recovery progress ring -- desktop only, fills the empty space */}
            <div className="hidden lg:flex items-center gap-5 shrink-0">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="#f5c49d" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * 263.9} 263.9`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold" style={{ color: "#FFFFFF" }}>{currentDay}</span>
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "#d7ebe3" }}>of {monitoringDuration}d</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#f5c49d" }}>
                  Recovery progress
                </p>
                <p className="text-sm" style={{ color: "#d7ebe3" }}>
                  {progressPct}% through your<br />monitoring window
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content: main + right rail on desktop */}
        <div className="px-5 lg:px-10 pt-6 pb-8 lg:flex lg:gap-6 lg:items-start">
          <div className="flex-1 min-w-0 space-y-4 max-w-2xl lg:max-w-none mx-auto lg:mx-0">
            {/* Recovery at a glance */}
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-base font-bold" style={{ color: "#111111" }}>
                Your recovery at a glance
              </h3>
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: "#6B7280" }}>
                Active plan
              </span>
            </div>

            {/* Plan card */}
            <div
              className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F8DADB" }}>
                  <span style={{ color: "#9B2226" }}>♥</span>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#111111" }}>{guideName}</p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>Your recovery instructions and safety information</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/patient/plan")}
                className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
                style={{ background: "#CAD2C5", color: "#2F3E46" }}
              >
                Recovery guide →
              </button>
            </div>

            {/* Recovery signal -- real area chart */}
            <div
              className="rounded-2xl px-4 py-4 lg:px-6 lg:py-5"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold" style={{ color: "#111111" }}>Recovery signal</p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>Your recent check-in pattern</p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: "#E7F0E5", color: "#386641" }}
                >
                  ● Monitoring
                </span>
              </div>

              {loadingSignal ? (
                <p className="text-xs" style={{ color: "#6B7280" }}>Loading...</p>
              ) : (
                <div>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full"
                    style={{ height: 140 }}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="recoveryFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#386641" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#386641" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={area} fill="url(#recoveryFill)" />
                    <path d={line} fill="none" stroke="#386641" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {points?.map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="3.5" fill="#386641" stroke="#FFFFFF" strokeWidth="1.5" />
                    ))}
                  </svg>
                  <div className="flex justify-between mt-1">
                    {recoverySignal.map((d) => (
                      <span key={d.label} className="text-[10px] flex-1 text-center" style={{ color: "#6B7280" }}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions -- mobile/tablet only, moves to sidebar on desktop */}
            <div className="grid grid-cols-2 gap-3 pb-2 lg:hidden">
              <button
                onClick={() => navigate("/patient/check-in")}
                className="rounded-2xl p-4 text-left cursor-pointer"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#E7F0E5" }}>
                  <span style={{ color: "#386641" }}>🎙</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: "#111111" }}>Recovery Pulse</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Speak or tap how you feel</p>
              </button>

              <button
                className="rounded-2xl p-4 text-left cursor-pointer"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FCEAD3" }}>
                  <span style={{ color: "#BC6C25" }}>💬</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: "#111111" }}>Care team</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Ask a question</p>
              </button>
            </div>
          </div>

          {/* Right rail -- desktop only */}
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            <button
              onClick={() => navigate("/patient/check-in")}
              className="w-full rounded-2xl p-5 text-left cursor-pointer transition hover:shadow-md"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#E7F0E5" }}>
                <span style={{ color: "#386641" }}>🎙</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: "#111111" }}>Recovery Pulse</p>
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Speak or tap how you feel</p>
            </button>

            <button
              className="w-full rounded-2xl p-5 text-left cursor-pointer transition hover:shadow-md"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FCEAD3" }}>
                <span style={{ color: "#BC6C25" }}>💬</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: "#111111" }}>Care team</p>
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Ask a question</p>
            </button>

            <div
              className="rounded-2xl p-5"
              style={{ background: "#1f6b62" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#f5c49d" }}>
                Need help now?
              </p>
              <p className="text-sm mb-4" style={{ color: "#d7ebe3" }}>
                Your care team is only a message away, day or night.
              </p>
              <button
                className="text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                style={{ background: "#FFFFFF", color: "#1f6b62" }}
              >
                Message care team →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav -- mobile/tablet only */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around py-3.5 border-t"
        style={{ background: "#18181B", borderColor: "#27272A" }}
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => item.path && navigate(item.path)}
            disabled={!item.path}
            className={`flex items-center gap-1.5 text-xs font-medium ${
              item.path ? "cursor-pointer" : "cursor-not-allowed opacity-40"
            }`}
            style={{ color: "#FFFFFF" }}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PatientHome;
