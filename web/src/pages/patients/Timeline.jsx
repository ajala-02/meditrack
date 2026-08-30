import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

const NAV_ITEMS = [
  { key: "checkin", label: "Check-In", icon: "📝", path: "/patient/check-in" },
  { key: "companion", label: "AI Companion", icon: "🤖", path: "/patient/ai-companion" },
  { key: "messages", label: "Messages", icon: "💬", path: "/patient/messages" },
  { key: "timeline", label: "Timeline", icon: "📅", path: "/patient/timeline" },
];

const toTitleCase = (str = "") =>
  str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

const calculateStreak = (checkIns = []) => {
  if (!checkIns.length) return 0;
  const dayStrings = new Set(
    checkIns.map((ci) => new Date(ci.date).toDateString())
  );
  let streak = 0;
  const cur = new Date();
  while (dayStrings.has(cur.toDateString())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const actualScore =
      data.actualScore !== undefined && data.actualScore !== null
        ? Number(data.actualScore).toFixed(1)
        : null;
    const expectedScore =
      data.expectedScore !== undefined
        ? Number(data.expectedScore).toFixed(1)
        : null;

    let statusText = "On track";
    let statusColor = "#386641";
    if (actualScore !== null && expectedScore !== null) {
      const diff = Number(actualScore) - Number(expectedScore);
      if (diff < -0.2) {
        statusText = "Ahead of schedule";
        statusColor = "#1f6b62";
      } else if (diff > 0.2) {
        statusText = "Behind schedule";
        statusColor = "#BC6C25";
      }
    }

    return (
      <div
        className="rounded-2xl p-3.5 shadow-xl border text-xs space-y-1.5 min-w-[200px]"
        style={{
          background: "#FFFFFF",
          borderColor: "#E4E4E7",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <p className="font-extrabold" style={{ color: "#111111" }}>
          Day {data.day} {data.dateStr ? `· ${data.dateStr}` : ""}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-500 font-medium">Your score:</span>
          <span className="font-bold" style={{ color: "#1f6b62" }}>
            {actualScore !== null ? `${actualScore} / 5` : "No check-in"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-500 font-medium">Expected:</span>
          <span className="font-bold text-zinc-600">{expectedScore} / 5</span>
        </div>
        {actualScore !== null && (
          <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-zinc-400">Status:</span>
            <span className="font-bold" style={{ color: statusColor }}>
              {statusText}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const Timeline = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [checkIns, setCheckIns] = useState([]);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        let currentPatient = null;
        let initialCheckIns = [];
        try {
          const { data: patientData } = await api.get("/patients/me");
          currentPatient = patientData.patient || patientData;
          initialCheckIns = patientData.checkIns || [];
        } catch (meErr) {
          const patientId = user?.id || user?._id;
          if (patientId) {
            const { data } = await api.get(`/patients/${patientId}`);
            currentPatient = data.patient || data;
            initialCheckIns = data.checkIns || [];
          } else {
            throw meErr;
          }
        }

        if (!active) return;
        setPatient(currentPatient);

        // Fetch full check-in list
        let list = initialCheckIns;
        const patientId = currentPatient?._id || user?.id;
        if (patientId) {
          try {
            const { data: checkInData } = await api.get(`/checkins/${patientId}?limit=100`);
            if (checkInData?.checkIns) {
              list = checkInData.checkIns;
            }
          } catch {
            // fallback to initialCheckIns
          }
        }

        if (active) {
          setCheckIns(list);
        }
      } catch (err) {
        console.error("Failed to load timeline data:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [user]);

  // Derived values
  const totalDays = patient?.monitoringDuration || 30;
  const rawCondition = patient?.condition || patient?.diagnosis || "Post-Surgery";
  const cleanCondition = rawCondition.replace(/\s+recovery$/i, "").trim();
  const formattedCondition =
    cleanCondition.charAt(0).toUpperCase() + cleanCondition.slice(1);

  const daysSinceDischarge = patient?.dischargeDate
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(patient.dischargeDate)) / 86400000)
      )
    : Math.max(1, checkIns.length);
  const currentDay = Math.min(daysSinceDischarge, totalDays);

  const streakCount = calculateStreak(checkIns);
  const totalCompletedCheckIns = checkIns.length;
  const completionRate = Math.min(
    100,
    Math.round((totalCompletedCheckIns / Math.max(1, totalDays)) * 100)
  );

  // Map check-ins by Day number
  const checkInDayMap = new Map();
  const sortedCheckIns = [...checkIns].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  sortedCheckIns.forEach((ci, idx) => {
    let dayNum = idx + 1;
    if (patient?.dischargeDate) {
      const diff = Math.floor(
        (new Date(ci.date) - new Date(patient.dischargeDate)) / 86400000
      );
      if (diff >= 1) dayNum = diff;
    }
    checkInDayMap.set(dayNum, ci);
  });

  // Build chart dataset from Day 1 to totalDays (always complete)
  const chartData = [];
  let actualSum = 0;
  let expectedSum = 0;
  let countRecorded = 0;

  for (let d = 1; d <= totalDays; d++) {
    // Expected recovery formula: 5 - ((day / totalDays) * 4)
    const expectedScore = Math.max(1, +(5 - (d / totalDays) * 4).toFixed(2));
    const recorded = checkInDayMap.get(d);

    let actualScore = null;
    let dateStr = "";
    let betterRange = null;
    let worseRange = null;

    if (recorded) {
      actualScore = +(recorded.overallScore || 0).toFixed(2);
      actualSum += actualScore;
      expectedSum += expectedScore;
      countRecorded++;
      const dt = new Date(recorded.date);
      dateStr = dt.toLocaleDateString([], { month: "short", day: "numeric" });

      if (actualScore < expectedScore) {
        betterRange = [actualScore, expectedScore];
        worseRange = [actualScore, actualScore];
      } else if (actualScore > expectedScore) {
        worseRange = [expectedScore, actualScore];
        betterRange = [expectedScore, expectedScore];
      } else {
        betterRange = [actualScore, actualScore];
        worseRange = [actualScore, actualScore];
      }
    }

    chartData.push({
      day: d,
      expectedScore,
      actualScore,
      betterRange,
      worseRange,
      dateStr,
    });
  }

  // Trend calculation & Insight 1: Recovery Status
  const avgActual = countRecorded > 0 ? actualSum / countRecorded : 0;
  const avgExpected = countRecorded > 0 ? expectedSum / countRecorded : 0;
  const diffAvg = avgActual - avgExpected;

  let statusBadgeTitle = "🟢 Ahead of schedule";
  let statusBadgeDesc = `You're recovering faster than expected for Day ${currentDay} of ${formattedCondition.toLowerCase()} recovery.`;
  let trendLabel = "Improving";

  if (countRecorded === 0) {
    statusBadgeTitle = "⚪ Starting your journey";
    statusBadgeDesc = "Complete daily check-ins to track your recovery trajectory.";
    trendLabel = "Starting";
  } else if (diffAvg < -0.2) {
    statusBadgeTitle = "🟢 Ahead of schedule";
    statusBadgeDesc = `You're recovering faster than expected for Day ${currentDay} of ${formattedCondition.toLowerCase()} recovery.`;
    trendLabel = "Improving";
  } else if (diffAvg > 0.2) {
    statusBadgeTitle = "🟡 Taking a little longer";
    statusBadgeDesc = "Recovery varies — your care team is monitoring your progress closely.";
    trendLabel = "Monitoring";
  } else {
    statusBadgeTitle = "✅ Right on track";
    statusBadgeDesc = "Your recovery is progressing as expected.";
    trendLabel = "Stable";
  }

  // Insight 2: Best and Toughest Day
  let bestDayObj = null;
  let toughestDayObj = null;

  sortedCheckIns.forEach((ci, idx) => {
    let dayNum = idx + 1;
    if (patient?.dischargeDate) {
      const diff = Math.floor(
        (new Date(ci.date) - new Date(patient.dischargeDate)) / 86400000
      );
      if (diff >= 1) dayNum = diff;
    }
    const item = {
      day: dayNum,
      score: ci.overallScore,
      dateStr: new Date(ci.date).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    };

    if (!bestDayObj || item.score < bestDayObj.score) {
      bestDayObj = item;
    }
    if (!toughestDayObj || item.score > toughestDayObj.score) {
      toughestDayObj = item;
    }
  });

  const totalMedicines = patient?.medicines?.length || 0;

  // Milestones on timeline
  const milestones = [
    { day: 1, label: "Monitoring started 🏥", reached: currentDay >= 1 },
    { day: 7, label: "One week ✅", reached: currentDay >= 7 },
    { day: 15, label: "Halfway ⭐", reached: currentDay >= 15 },
    { day: 30, label: "Recovery complete 🏆", reached: currentDay >= 30 },
  ];

  const hasCheckIns = checkIns.length > 0;

  return (
    <div
      className="min-h-screen lg:flex"
      style={{
        background: "#F5F0EB",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Desktop Sidebar */}
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
              item.key === "timeline"
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
      <div className="flex-1 pb-24 lg:pb-12 min-w-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 space-y-6">
          {/* Back button */}
          <button
            onClick={() => navigate("/patient/home")}
            className="text-xs sm:text-sm font-bold flex items-center gap-1.5 transition hover:opacity-80 cursor-pointer"
            style={{ color: "#1f6b62" }}
          >
            <span>←</span>
            <span>Back to recovery space</span>
          </button>

          {/* Loading Skeleton */}
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div
                className="h-32 rounded-3xl"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              />
              <div
                className="h-80 rounded-3xl"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className="h-36 rounded-2xl"
                  style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                />
                <div
                  className="h-36 rounded-2xl"
                  style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                />
                <div
                  className="h-36 rounded-2xl"
                  style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* TOP SECTION — Header card */}
              <section
                className="rounded-3xl p-6 sm:p-7 shadow-sm"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1
                      className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                      style={{ color: "#111111" }}
                    >
                      Your Recovery Timeline
                    </h1>
                    <p className="mt-1 text-sm font-medium" style={{ color: "#6B7280" }}>
                      {formattedCondition} Recovery · Day {currentDay} of {totalDays}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                      style={{
                        background: "#E7F0E5",
                        color: "#386641",
                        border: "1px solid #D1E5DE",
                      }}
                    >
                      <span>📈</span>
                      <span>Trend: {trendLabel}</span>
                    </span>

                    <span
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                      style={{
                        background: "#F5F0EB",
                        color: "#2F3E46",
                        border: "1px solid #E4E4E7",
                      }}
                    >
                      <span>✅</span>
                      <span>
                        {totalCompletedCheckIns} of {totalDays} check-ins
                        completed
                      </span>
                    </span>
                  </div>
                </div>
              </section>

              {/* MAIN CHART — Comparative Line Chart (ALWAYS SHOWN) */}
              <section
                className="rounded-3xl p-5 sm:p-7 shadow-sm"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h2
                      className="text-base sm:text-lg font-extrabold"
                      style={{ color: "#111111" }}
                    >
                      Actual vs. Expected Recovery Trajectory
                    </h2>
                    <p className="text-xs" style={{ color: "#6B7280" }}>
                      Lower score indicates milder symptoms and healthier healing.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-0.5 border-t-2 border-dashed border-zinc-400" />
                      <span className="text-zinc-600">Expected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ background: "#1f6b62" }}
                      />
                      <span style={{ color: "#1f6b62" }}>Your recovery</span>
                    </div>
                  </div>
                </div>

                {/* Recharts Container */}
                <div className="w-full h-80 sm:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#F4F4F5"
                      />
                      <XAxis
                        dataKey="day"
                        type="number"
                        domain={[1, totalDays]}
                        tickLine={false}
                        axisLine={{ stroke: "#E4E4E7" }}
                        tick={{ fill: "#6B7280", fontSize: 11, fontWeight: 500 }}
                        tickFormatter={(val) => `Day ${val}`}
                        ticks={
                          totalDays <= 14
                            ? Array.from({ length: totalDays }, (_, i) => i + 1)
                            : [1, 5, 10, 15, 20, 25, totalDays]
                        }
                      />
                      <YAxis
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        tickLine={false}
                        axisLine={{ stroke: "#E4E4E7" }}
                        tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 500 }}
                        tickFormatter={(val) => {
                          switch (val) {
                            case 5:
                              return "5 · Severe";
                            case 4:
                              return "4 · High";
                            case 3:
                              return "3 · Moderate";
                            case 2:
                              return "2 · Mild";
                            case 1:
                              return "1 · Minimal";
                            case 0:
                              return "0 · Clear";
                            default:
                              return `${val}`;
                          }
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingBottom: 15, fontSize: 12 }}
                      />

                      {/* Recovery threshold Reference Line */}
                      <ReferenceLine
                        y={2}
                        stroke="#386641"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: "Recovery threshold (Mild)",
                          position: "insideBottomRight",
                          fill: "#386641",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      />

                      {/* Line 1: Expected Recovery (Always visible) */}
                      <Line
                        type="monotone"
                        dataKey="expectedScore"
                        stroke="#9CA3AF"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={false}
                        isAnimationActive={false}
                        name="Expected recovery"
                      />

                      {/* Line 2: Actual Recovery */}
                      <Line
                        type="monotone"
                        dataKey="actualScore"
                        stroke="#1f6b62"
                        strokeWidth={3}
                        dot={{
                          r: 5,
                          fill: "#1f6b62",
                          stroke: "#FFFFFF",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 7,
                          fill: "#1f6b62",
                          stroke: "#FFFFFF",
                          strokeWidth: 2,
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                        name="Your recovery"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Message below chart when no check-in data exists */}
                {!hasCheckIns && (
                  <div
                    className="mt-4 rounded-2xl p-4 text-center border flex items-center justify-center gap-2"
                    style={{
                      background: "#F9FAFB",
                      borderColor: "#E4E4E7",
                      color: "#6B7280",
                    }}
                  >
                    <span>ℹ️</span>
                    <span className="text-xs font-semibold">
                      Your recovery line will appear as you complete daily check-ins
                    </span>
                  </div>
                )}
              </section>

              {/* BELOW CHART — 3 Insight Cards (when check-ins exist) */}
              {hasCheckIns ? (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1 — Recovery Status */}
                  <div
                    className="rounded-3xl p-5 shadow-sm flex flex-col justify-between"
                    style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                  >
                    <div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider block mb-2"
                        style={{ color: "#6B7280" }}
                      >
                        Recovery status
                      </span>
                      <h3
                        className="text-base font-extrabold"
                        style={{ color: "#111111" }}
                      >
                        {statusBadgeTitle}
                      </h3>
                      <p
                        className="mt-2 text-xs leading-relaxed"
                        style={{ color: "#6B7280" }}
                      >
                        {statusBadgeDesc}
                      </p>
                    </div>
                    <div
                      className="mt-4 pt-3 border-t text-[11px] flex items-center justify-between"
                      style={{ borderColor: "#F4F4F5" }}
                    >
                      <span className="text-zinc-500">Your average:</span>
                      <span className="font-bold" style={{ color: "#1f6b62" }}>
                        {avgActual.toFixed(1)} / 5
                      </span>
                    </div>
                  </div>

                  {/* Card 2 — Best and Toughest Day */}
                  <div
                    className="rounded-3xl p-5 shadow-sm flex flex-col justify-between"
                    style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                  >
                    <div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider block mb-2"
                        style={{ color: "#6B7280" }}
                      >
                        Highlights
                      </span>

                      {/* Best Day */}
                      {bestDayObj ? (
                        <div className="mb-3">
                          <p
                            className="text-xs font-extrabold flex items-center gap-1.5"
                            style={{ color: "#386641" }}
                          >
                            <span>🌟</span>
                            <span>Day {bestDayObj.day} was your best day</span>
                          </p>
                          <p className="mt-0.5 text-[11px]" style={{ color: "#6B7280" }}>
                            Severity: {bestDayObj.score}/5 · {bestDayObj.dateStr}
                          </p>
                        </div>
                      ) : null}

                      {/* Toughest Day */}
                      {toughestDayObj ? (
                        <div>
                          <p
                            className="text-xs font-extrabold flex items-center gap-1.5"
                            style={{ color: "#BC6C25" }}
                          >
                            <span>⚡</span>
                            <span>Day {toughestDayObj.day} was most challenging</span>
                          </p>
                          <p className="mt-0.5 text-[11px]" style={{ color: "#6B7280" }}>
                            Severity: {toughestDayObj.score}/5 · {toughestDayObj.dateStr}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="mt-4 pt-3 border-t text-[11px] flex items-center justify-between text-zinc-500"
                      style={{ borderColor: "#F4F4F5" }}
                    >
                      <span>Recorded check-ins:</span>
                      <span className="font-bold text-zinc-800">
                        {countRecorded} days
                      </span>
                    </div>
                  </div>

                  {/* Card 3 — Consistency */}
                  <div
                    className="rounded-3xl p-5 shadow-sm flex flex-col justify-between"
                    style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider block mb-1"
                          style={{ color: "#6B7280" }}
                        >
                          Consistency
                        </span>
                        <h3
                          className="text-xl font-extrabold"
                          style={{ color: "#111111" }}
                        >
                          {completionRate}%
                        </h3>
                        <p className="text-[11px]" style={{ color: "#6B7280" }}>
                          Check-in completion rate
                        </p>
                      </div>

                      {/* Circular Progress Gauge */}
                      <div className="relative w-12 h-12 flex items-center justify-center">
                        <svg className="w-12 h-12 transform -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="18"
                            stroke="#E4E4E7"
                            strokeWidth="4"
                            fill="transparent"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="18"
                            stroke="#1f6b62"
                            strokeWidth="4"
                            strokeDasharray={2 * Math.PI * 18}
                            strokeDashoffset={
                              2 * Math.PI * 18 * (1 - completionRate / 100)
                            }
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </svg>
                        <span
                          className="absolute text-[10px] font-bold"
                          style={{ color: "#1f6b62" }}
                        >
                          {completionRate}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <p
                        className="text-xs font-semibold flex items-center gap-1.5"
                        style={{ color: "#2F3E46" }}
                      >
                        <span>🔥</span>
                        <span>
                          {streakCount} day{streakCount === 1 ? "" : "s"} streak
                        </span>
                      </p>
                      <p className="text-[11px]" style={{ color: "#6B7280" }}>
                        {totalMedicines > 0
                          ? `${totalMedicines} of ${totalMedicines} medicines tracked`
                          : "Daily medicines monitored"}
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}

              {/* BOTTOM — Milestone markers (ALWAYS SHOWN) */}
              <section
                className="rounded-3xl p-6 sm:p-7 shadow-sm"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3
                    className="text-base font-extrabold"
                    style={{ color: "#111111" }}
                  >
                    Recovery Milestones
                  </h3>
                  <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
                    {milestones.filter((m) => m.reached).length} of{" "}
                    {milestones.length} reached
                  </span>
                </div>

                <div className="relative pt-4 pb-2">
                  {/* Background Track Line */}
                  <div
                    className="absolute top-7 left-3 right-3 h-1 rounded-full"
                    style={{ background: "#E4E4E7" }}
                  />

                  {/* Active Progress Track Line */}
                  <div
                    className="absolute top-7 left-3 h-1 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, ((currentDay - 1) / (totalDays - 1)) * 100)
                      )}%`,
                      background: "#1f6b62",
                    }}
                  />

                  {/* Milestone Points */}
                  <div className="relative flex justify-between items-start gap-2">
                    {milestones.map((m) => (
                      <div
                        key={m.day}
                        className="flex flex-col items-center text-center max-w-[100px] sm:max-w-[140px]"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                            m.reached
                              ? "text-white"
                              : "bg-zinc-200 text-zinc-500"
                          }`}
                          style={{
                            background: m.reached ? "#1f6b62" : "#E4E4E7",
                            border: m.reached
                              ? "2px solid #FFFFFF"
                              : "2px solid #F5F0EB",
                          }}
                        >
                          {m.reached ? "✓" : m.day}
                        </div>
                        <p
                          className="mt-2 text-xs font-bold leading-tight"
                          style={{ color: m.reached ? "#111111" : "#9CA3AF" }}
                        >
                          {m.label}
                        </p>
                        <span
                          className="mt-0.5 text-[10px]"
                          style={{ color: "#6B7280" }}
                        >
                          Day {m.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
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
              item.key === "timeline"
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

export default Timeline;
