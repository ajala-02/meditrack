import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import TopBar from "../../components/TopBar";

const InputGroup = ({ label, children }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
      {label}
    </label>
    {children}
  </div>
);

const inputBaseClass =
  "w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-[#475569] outline-none transition-all duration-200 bg-[#1e293b] border border-[#334155] focus:border-[#6366f1]";

const EnrollPatient = () => {
  const navigate = useNavigate();

  // Basic Details
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("other");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Clinical Details
  const [diagnosis, setDiagnosis] = useState("");
  const [condition, setCondition] = useState("other");
  const [medicines, setMedicines] = useState([""]);
  
  // Monitoring Details
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [monitoringDuration, setMonitoringDuration] = useState("14");
  const [checkInTimePreference, setCheckInTimePreference] = useState("09:00");

  // Instructions
  const [instructions, setInstructions] = useState("");
  
  // States
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState(null);

  const handleMedicineChange = (index, value) => {
    const newMeds = [...medicines];
    newMeds[index] = value;
    setMedicines(newMeds);
  };

  const addMedicine = () => setMedicines([...medicines, ""]);
  
  const removeMedicine = (index) => {
    const newMeds = medicines.filter((_, i) => i !== index);
    setMedicines(newMeds.length ? newMeds : [""]);
  };

  const generateInstructions = async () => {
    if (!diagnosis || !age || !sex || !condition) {
      setError("Please fill out Diagnosis, Age, Sex, and Condition before generating instructions.");
      return;
    }
    
    try {
      setError("");
      setLoadingInstructions(true);
      const { data } = await api.post("/patients/generate-instructions", {
        diagnosis,
        age: parseInt(age, 10),
        sex,
        condition,
      });
      setInstructions(data.instructions);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate instructions.");
    } finally {
      setLoadingInstructions(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setEnrolling(true);
      
      const payload = {
        name,
        age: parseInt(age, 10),
        sex,
        phone,
        email,
        emergencyContact,
        diagnosis,
        condition,
        medicines: medicines.filter(m => m.trim() !== ""),
        caregiverName,
        caregiverPhone,
        monitoringDuration: parseInt(monitoringDuration, 10),
        checkInTimePreference,
        dischargeInstructions: instructions,
      };

      const { data } = await api.post("/patients/enroll", payload);
      setSuccessCode(data.patient?.joinCode || "SUCCESS");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to enroll patient.");
    } finally {
      setEnrolling(false);
    }
  };

  if (successCode) {
    return (
      <div className="min-h-screen pb-12">
        <TopBar title="Patient Enrollment" />
        <div className="max-w-2xl mx-auto mt-12 px-8">
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-[rgba(16,185,129,0.2)] mb-4">
              <svg className="w-8 h-8 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Patient Enrolled Successfully</h2>
            <p className="text-[#94a3b8] mb-6">The patient profile has been created and monitoring is now active.</p>
            
            <div className="rounded-xl p-6 mb-8" style={{ background: "rgba(30,41,59,0.8)", border: "1px solid #334155" }}>
              <p className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Patient Join Code</p>
              <p className="text-4xl font-mono font-bold text-[#818cf8] tracking-widest">{successCode}</p>
              <p className="text-xs text-[#64748b] mt-3">Share this code with the patient for them to log into the mobile app.</p>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer"
                style={{ background: "#1e293b", border: "1px solid #334155" }}
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setSuccessCode(null);
                  setName(""); setAge(""); setPhone(""); setEmail(""); setEmergencyContact("");
                  setDiagnosis(""); setMedicines([""]); setInstructions("");
                  setCaregiverName(""); setCaregiverPhone("");
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
              >
                Enroll Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <TopBar title="Enroll New Patient" subtitle="Setup remote monitoring and AI follow-ups" />

      <div className="max-w-4xl mx-auto mt-8 px-8 animate-fade-in">
        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm text-[#fca5a5]" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEnroll} className="space-y-8">
          
          {/* Patient Details */}
          <div className="rounded-xl p-6" style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #1e293b" }}>
            <h3 className="text-lg font-bold text-white mb-6 border-b border-[#1e293b] pb-3">Patient Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <InputGroup label="Full Name">
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className={inputBaseClass} placeholder="Jane Doe" />
              </InputGroup>
              
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Age">
                  <input required type="number" value={age} onChange={e => setAge(e.target.value)} className={inputBaseClass} placeholder="45" />
                </InputGroup>
                <InputGroup label="Sex">
                  <select required value={sex} onChange={e => setSex(e.target.value)} className={inputBaseClass}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </InputGroup>
              </div>

              <InputGroup label="Email (for mobile app login)">
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputBaseClass} placeholder="jane@example.com" />
              </InputGroup>
              
              <InputGroup label="Phone Number">
                <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputBaseClass} placeholder="+1 555-0123" />
              </InputGroup>
              
              <InputGroup label="Emergency Contact (Name & Phone)">
                <input required type="text" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className={inputBaseClass} placeholder="John Doe +1 555-0199" />
              </InputGroup>
            </div>
          </div>

          {/* Clinical Info */}
          <div className="rounded-xl p-6" style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #1e293b" }}>
            <h3 className="text-lg font-bold text-white mb-6 border-b border-[#1e293b] pb-3">Clinical Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <InputGroup label="Primary Diagnosis">
                <input required type="text" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className={inputBaseClass} placeholder="Post-operative CABG" />
              </InputGroup>
              
              <InputGroup label="Condition Template">
                <select required value={condition} onChange={e => setCondition(e.target.value)} className={inputBaseClass}>
                  <option value="cardiac">Cardiac (CABG, Valve)</option>
                  <option value="ortho">Orthopedic (Joint replacement)</option>
                  <option value="diabetes">Endocrinology (Diabetes management)</option>
                  <option value="other">General / Other</option>
                </select>
              </InputGroup>
            </div>

            <div className="mt-2">
              <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Prescribed Medicines</label>
              {medicines.map((med, index) => (
                <div key={index} className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={med}
                    onChange={e => handleMedicineChange(index, e.target.value)}
                    className={inputBaseClass}
                    placeholder="e.g. Aspirin 75mg daily"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedicine(index)}
                    className="p-2.5 rounded-xl bg-[#1e293b] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMedicine}
                className="text-sm font-medium text-[#818cf8] hover:text-[#a5b4fc] transition-colors"
              >
                + Add another medicine
              </button>
            </div>
          </div>

          {/* AI Instructions */}
          <div className="rounded-xl p-6" style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #1e293b" }}>
            <div className="flex items-center justify-between mb-6 border-b border-[#1e293b] pb-3">
              <h3 className="text-lg font-bold text-white">Discharge Instructions</h3>
              <button
                type="button"
                onClick={generateInstructions}
                disabled={loadingInstructions}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                {loadingInstructions ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <span>✨</span> Generate via AI
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-[#94a3b8] mb-4">You can manually type or use AI to generate tailored instructions based on the patient's diagnosis and condition.</p>
            <textarea
              required
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className={`${inputBaseClass} h-40 resize-none`}
              placeholder="1. Rest well... 2. Take medicines..."
            />
          </div>

          {/* Monitoring setup */}
          <div className="rounded-xl p-6" style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #1e293b" }}>
            <h3 className="text-lg font-bold text-white mb-6 border-b border-[#1e293b] pb-3">Monitoring Setup</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <InputGroup label="Caregiver Name (Optional)">
                <input type="text" value={caregiverName} onChange={e => setCaregiverName(e.target.value)} className={inputBaseClass} placeholder="John Doe" />
              </InputGroup>
              <InputGroup label="Caregiver Phone (Optional)">
                <input type="tel" value={caregiverPhone} onChange={e => setCaregiverPhone(e.target.value)} className={inputBaseClass} placeholder="+1 555-0199" />
              </InputGroup>
              
              <InputGroup label="Monitoring Duration (Days)">
                <select required value={monitoringDuration} onChange={e => setMonitoringDuration(e.target.value)} className={inputBaseClass}>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </InputGroup>
              
              <InputGroup label="Daily Check-in Time Preference">
                <input required type="time" value={checkInTimePreference} onChange={e => setCheckInTimePreference(e.target.value)} className={inputBaseClass} />
              </InputGroup>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={enrolling || loadingInstructions}
              className="px-8 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }}
            >
              {enrolling ? "Enrolling Patient..." : "Complete Enrollment"}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default EnrollPatient;
