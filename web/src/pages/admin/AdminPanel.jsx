import { useState, useEffect } from "react";
import api from "../../api/axios";
import TopBar from "../../components/TopBar";

const StatCard = ({ icon, label, value, color, accent }) => (
  <div
    className="rounded-xl p-5 transition-all duration-300"
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

const MOCK_STAFF = [
  { id: 1, name: "Dr. Sarah Jenkins", role: "doctor", department: "Cardiology", status: "active" },
  { id: 2, name: "Dr. Mark Chen", role: "doctor", department: "Orthopedics", status: "active" },
  { id: 3, name: "Nurse Emily Davis", role: "nurse", department: "ICU", status: "active" },
  { id: 4, name: "Nurse John Smith", role: "nurse", department: "General Ward", status: "offline" },
];

const AdminPanel = () => {
  const [patients, setPatients] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch patients for stats
        const [patientsRes, conditionsRes] = await Promise.all([
          api.get("/patients"),
          api.get("/conditions").catch(() => ({ data: { conditions: [] } })) // Fallback if API doesn't exist
        ]);

        setPatients(patientsRes.data.patients || []);
        // Handle variations in condition response structure
        if (Array.isArray(conditionsRes.data)) {
          setConditions(conditionsRes.data);
        } else if (conditionsRes.data.conditions) {
          setConditions(conditionsRes.data.conditions);
        } else {
          // Mock conditions if API is missing or returns empty
          setConditions([
            { id: "cardiac", name: "Cardiac Recovery", protocols: 12 },
            { id: "ortho", name: "Orthopedic Surgery", protocols: 8 },
            { id: "diabetes", name: "Diabetes Management", protocols: 15 },
          ]);
        }
      } catch (err) {
        setError("Failed to load admin data.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const stats = {
    total: patients.length,
    active: patients.filter(p => p.status === "active").length,
    critical: patients.filter(p => p.latestCheckIn?.riskStatus === "critical").length,
  };

  return (
    <div className="min-h-screen pb-12">
      <TopBar title="Hospital Administration" subtitle="System overview and management" />

      <div className="px-8 py-6 max-w-7xl mx-auto animate-fade-in">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <svg className="animate-spin h-8 w-8 text-[#6366f1]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl text-center" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <p className="text-sm text-[#fca5a5]">{error}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Row */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Patient Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon="🏥" label="Total Enrolled Patients" value={stats.total} />
                <StatCard icon="⚡" label="Active Monitoring" value={stats.active} color="#10b981" accent="rgba(16, 185, 129, 0.1)" />
                <StatCard icon="🔴" label="Critical Status Today" value={stats.critical} color="#ef4444" accent="rgba(239, 68, 68, 0.1)" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Condition Templates */}
              <div className="rounded-xl p-6" style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #1e293b" }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Condition Templates</h2>
                  <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] transition-colors">
                    + New Template
                  </button>
                </div>
                
                <div className="space-y-3">
                  {conditions.map((cond, i) => (
                    <div key={cond.id || i} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(99,102,241,0.1)] text-[#818cf8]">
                          📋
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white capitalize">{cond.name || cond}</p>
                          <p className="text-xs text-[#64748b]">{cond.protocols || 10} protocols attached</p>
                        </div>
                      </div>
                      <button className="text-xs text-[#64748b] hover:text-white transition-colors">Edit</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Directory */}
              <div className="rounded-xl p-6" style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #1e293b" }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Staff Directory</h2>
                  <span className="px-2 py-1 rounded text-[10px] font-bold bg-[#1e293b] text-[#94a3b8]">MOCK DATA</span>
                </div>
                
                <div className="space-y-3">
                  {MOCK_STAFF.map(staff => (
                    <div key={staff.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: staff.role === "doctor" ? "#6366f1" : "#10b981" }}>
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{staff.name}</p>
                          <p className="text-xs text-[#64748b] capitalize">{staff.role} • {staff.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${staff.status === "active" ? "bg-[#10b981]" : "bg-[#475569]"}`} />
                        <span className="text-[10px] uppercase text-[#64748b] tracking-wider">{staff.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
