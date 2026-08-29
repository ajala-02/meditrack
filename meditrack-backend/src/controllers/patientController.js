const crypto = require("crypto");
const { createCompletion } = require("../services/claudeService");
const User = require("../models/User");
const Patient = require("../models/Patient");
const CheckIn = require("../models/CheckIn");

/**
 * Generate a unique 6-digit join code.
 */
const generateJoinCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = crypto.randomInt(100000, 999999).toString();
    exists = await Patient.findOne({ joinCode: code });
  }

  return code;
};

/**
 * POST /api/patients/enroll
 * Doctor enrolls a patient at discharge.
 * Creates a User account (role: patient) with a temp password,
 * creates a Patient record, and returns a 6-digit join code.
 */
const enrollPatient = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      age,
      sex,
      emergencyContact,
      diagnosis,
      medicines,
      recoveryInstructions,
      caregiverName,
      caregiverPhone,
      checkInTimePreference,
      condition,
      dischargeDate,
      monitoringDuration = 14,
    } = req.body;

    // Validate required fields
    if (!name || !email || !condition || !dischargeDate || !phone || !age || !sex || !diagnosis) {
      return res.status(400).json({
        message: "Name, email, phone, age, sex, diagnosis, condition, and discharge date are required.",
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // Generate a temporary password (patient will change on first login)
    const tempPassword = crypto.randomBytes(4).toString("hex"); // 8-char hex string

    // Create User account for the patient
    const user = await User.create({
      name,
      email,
      password: tempPassword,
      role: "patient",
      hospitalId: req.user.hospitalId,
    });

    // Calculate monitoring end date
    const discharge = new Date(dischargeDate);
    const monitoringEndDate = new Date(discharge);
    monitoringEndDate.setDate(monitoringEndDate.getDate() + monitoringDuration);

    // Generate unique join code
    const joinCode = await generateJoinCode();

    // Create Patient record
    const patient = await Patient.create({
      userId: user._id,
      age,
      sex,
      phone,
      emergencyContact,
      diagnosis,
      medicines,
      recoveryInstructions,
      caregiverName,
      caregiverPhone,
      checkInTimePreference,
      monitoringDuration,
      condition,
      enrolledBy: req.user.id,
      dischargeDate: discharge,
      monitoringEndDate,
      hospitalId: req.user.hospitalId,
      joinCode,
    });

    res.status(201).json({
      message: "Patient enrolled successfully.",
      patient: {
        id: patient._id,
        name: user.name,
        email: user.email,
        condition: patient.condition,
        dischargeDate: patient.dischargeDate,
        monitoringEndDate: patient.monitoringEndDate,
        status: patient.status,
        joinCode,
      },
      tempPassword,
    });
  } catch (error) {
    res.status(500).json({ message: "Enrollment failed.", error: error.message });
  }
};

/**
 * GET /api/patients
 * Get all patients for the hospital, each with their latest
 * check-in risk score. Sorted by risk: critical → watch → stable.
 * Supports: ?status=active  &search=john
 */
const getAllPatients = async (req, res) => {
  try {
    const { status, search } = req.query;

    // Base filter: same hospital
    const filter = { hospitalId: req.user.hospitalId };
    if (status) filter.status = status;

    // Find patients
    let patients = await Patient.find(filter)
      .populate("userId", "name email")
      .populate("enrolledBy", "name")
      .populate("caregiverId", "name")
      .lean();

    // Optional name search (on the populated user name)
    if (search) {
      const regex = new RegExp(search, "i");
      patients = patients.filter(
        (p) => regex.test(p.userId?.name) || regex.test(p.userId?.email)
      );
    }

    // Fetch latest check-in for each patient in one query
    const patientIds = patients.map((p) => p._id);
    const latestCheckIns = await CheckIn.aggregate([
      { $match: { patientId: { $in: patientIds } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: "$patientId",
          latestDate: { $first: "$date" },
          overallScore: { $first: "$overallScore" },
          riskStatus: { $first: "$riskStatus" },
        },
      },
    ]);

    // Map latest check-in data onto patients
    const checkInMap = {};
    for (const ci of latestCheckIns) {
      checkInMap[ci._id.toString()] = {
        latestCheckInDate: ci.latestDate,
        overallScore: ci.overallScore,
        riskStatus: ci.riskStatus,
      };
    }

    const result = patients.map((p) => ({
      ...p,
      latestCheckIn: checkInMap[p._id.toString()] || null,
    }));

    // Sort by risk: critical first, then watch, then stable, then no check-in
    const riskOrder = { critical: 0, watch: 1, stable: 2 };
    result.sort((a, b) => {
      const riskA = a.latestCheckIn
        ? riskOrder[a.latestCheckIn.riskStatus] ?? 3
        : 3;
      const riskB = b.latestCheckIn
        ? riskOrder[b.latestCheckIn.riskStatus] ?? 3
        : 3;
      return riskA - riskB;
    });

    res.status(200).json({ count: result.length, patients: result });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch patients.", error: error.message });
  }
};

/**
 * GET /api/patients/me
 * Patient-safe view of the signed-in patient's recovery plan and recent check-ins.
 */
const getMyPatient = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user.id })
      .populate("userId", "name email")
      .lean();

    if (!patient) {
      return res.status(404).json({ message: "Patient record not found." });
    }

    const checkIns = await CheckIn.find({ patientId: patient._id })
      .sort({ date: -1 })
      .limit(14)
      .lean();

    res.status(200).json({ patient, checkIns });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch your recovery plan.", error: error.message });
  }
};

/**
 * GET /api/patients/:id
 * Full patient detail with last 14 check-ins and trend data.
 */
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate("userId", "name email")
      .populate("enrolledBy", "name email role")
      .populate("caregiverId", "name email role")
      .lean();

    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Ensure same hospital
    if (patient.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Fetch last 14 check-ins, most recent first
    const checkIns = await CheckIn.find({ patientId: patient._id })
      .sort({ date: -1 })
      .limit(14)
      .populate("respondedBy", "name role")
      .lean();

    // Build trend data (chronological order for charting)
    const trend = [...checkIns].reverse().map((ci) => ({
      date: ci.date,
      overallScore: ci.overallScore,
      riskStatus: ci.riskStatus,
      symptomCount: ci.symptoms.length,
    }));

    // Compute day number relative to discharge date
    const dischargeTime = new Date(patient.dischargeDate).getTime();
    const enrichedCheckIns = checkIns.map((ci) => {
      const daysSinceDischarge = Math.ceil(
        (new Date(ci.date).getTime() - dischargeTime) / (1000 * 60 * 60 * 24)
      );
      return { ...ci, day: daysSinceDischarge };
    });

    res.status(200).json({
      patient,
      checkIns: enrichedCheckIns,
      trend,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch patient.", error: error.message });
  }
};

/**
 * PATCH /api/patients/:id/status
 * Update a patient's monitoring status.
 * Allowed transitions: active → completed | escalated
 */
const updatePatientStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !["active", "completed", "escalated"].includes(status)) {
      return res.status(400).json({
        message: "Valid status required: active, completed, or escalated.",
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Ensure same hospital
    if (patient.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Access denied." });
    }

    patient.status = status;
    await patient.save();

    res.status(200).json({
      message: `Patient status updated to ${status}.`,
      patient,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update status.", error: error.message });
  }
};

/**
 * POST /api/patients/generate-instructions
 * Calls Groq (via the shared createCompletion helper) to generate
 * recovery instructions based on patient details.
 */
const generateInstructions = async (req, res) => {
  try {
    const { diagnosis, age, sex, condition } = req.body;

    if (!diagnosis || !age || !sex || !condition) {
      return res.status(400).json({
        message: "Diagnosis, age, sex, and condition are required.",
      });
    }

    const prompt = `You are a medical assistant. Generate recovery instructions for a patient with the following details:
Diagnosis: ${diagnosis}
Condition Category: ${condition}
Age: ${age}
Sex: ${sex}

Return the instructions as a valid JSON object with the following structure:
{
  "dos": ["instruction 1", "instruction 2", ...],
  "donts": ["instruction 1", "instruction 2", ...],
  "diet": ["instruction 1", "instruction 2", ...],
  "woundCare": ["instruction 1", "instruction 2", ...],
  "redFlags": ["instruction 1", "instruction 2", ...]
}
Ensure the output is ONLY the raw JSON object and nothing else. No markdown formatting.`;

    const textResponse = await createCompletion({
      system: "You are a medical assistant.",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Failed to parse JSON from Groq response.");
    }

    const instructions = JSON.parse(jsonMatch[0]);
    res.status(200).json(instructions);
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate instructions.",
      error: error.message,
    });
  }
};

module.exports = {
  enrollPatient,
  getMyPatient,
  getAllPatients,
  getPatientById,
  updatePatientStatus,
  generateInstructions,
};