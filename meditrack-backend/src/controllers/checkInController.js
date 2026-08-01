const CheckIn = require("../models/CheckIn");
const Patient = require("../models/Patient");
const Alert = require("../models/Alert");
const User = require("../models/User");
const { calculateTriageScore, riskToAlertSeverity } = require("../utils/scoring");
const { analyzeSymptomText, generateCheckInResponse } = require("../services/claudeService");
const { emitAlert, EVENTS, getPatientRoom } = require("../socket/socketHandler");

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Check if the last N check-ins are all stable with no improvement.
 * "No improvement" = overallScore has not decreased over the window.
 * @param {string} patientId
 * @param {number} window - number of recent check-ins to inspect
 * @returns {Promise<boolean>}
 */
const detectStagnantTrend = async (patientId, window = 3) => {
  const recent = await CheckIn.find({ patientId })
    .sort({ date: -1 })
    .limit(window)
    .lean();

  if (recent.length < window) return false;

  // All must be stable
  const allStable = recent.every((ci) => ci.riskStatus === "stable");
  if (!allStable) return false;

  // Check for improvement: scores should be decreasing over time.
  // recent is newest-first, so we reverse for chronological order.
  const chronological = [...recent].reverse();
  const noImprovement = chronological.every(
    (ci, i) => i === 0 || ci.overallScore >= chronological[i - 1].overallScore
  );

  return noImprovement;
};

/**
 * Find staff to notify based on risk status.
 * @returns {{ nurses: User[], doctors: User[] }}
 */
const findStaffToNotify = async (hospitalId, riskStatus) => {
  const nurses =
    riskStatus === "watch"
      ? [] // watch = doctor only
      : await User.find({ hospitalId, role: "nurse" }).select("_id").lean();

  const doctors =
    riskStatus === "stable"
      ? [] // stable = nurse only
      : await User.find({ hospitalId, role: "doctor" }).select("_id").lean();

  return { nurses, doctors };
};

// ─────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────

/**
 * POST /api/checkins
 * Patient submits a daily check-in.
 * Pipeline: save → score → AI response → alert → socket → respond.
 */
const submitCheckIn = async (req, res) => {
  try {
    const { symptoms, language } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ message: "At least one symptom is required." });
    }

    // Find the patient record for the logged-in user
    const patient = await Patient.findOne({ userId: req.user.id });
    if (!patient) {
      return res.status(404).json({ message: "Patient record not found." });
    }

    if (patient.status !== "active") {
      return res.status(400).json({
        message: `Monitoring is ${patient.status}. Check-ins are no longer accepted.`,
      });
    }

    // ── 1. Calculate triage score ───────────────────────
    const { overallScore, riskStatus, hasAIFlag } = calculateTriageScore(symptoms);

    // ── 2. Generate AI response for the patient ─────────
    const aiResponse = await generateCheckInResponse(
      symptoms,
      riskStatus,
      patient.condition,
      language
    );

    // ── 3. Save the check-in ────────────────────────────
    const checkIn = await CheckIn.create({
      patientId: patient._id,
      date: new Date(),
      symptoms,
      overallScore,
      riskStatus,
      aiResponse,
    });

    // ── 4. Find staff & create alert ────────────────────
    const { nurses, doctors } = await findStaffToNotify(
      patient.hospitalId,
      riskStatus
    );

    const notifiedTo = [
      ...nurses.map((n) => n._id),
      ...doctors.map((d) => d._id),
    ];

    const alert = await Alert.create({
      patientId: patient._id,
      checkInId: checkIn._id,
      severity: riskToAlertSeverity(riskStatus),
      alertType: "triage",
      notifiedTo,
    });

    // ── 5. Socket.io notifications ──────────────────────
    const io = req.app.get("io");
    const hospitalId = patient.hospitalId.toString();

    emitAlert(io, {
      _id: alert._id,
      checkInId: checkIn._id,
      patientId: patient._id,
      patientName: req.user.name || "Patient",
      hospitalId,
      severity: alert.severity,
      alertType: "triage",
      overallScore,
      riskStatus,
      symptoms: symptoms.map((s) => ({ name: s.name, severity: s.severity })),
      timestamp: checkIn.date,
    });

    // ── 6. Trend detection ──────────────────────────────
    const isStagnant = await detectStagnantTrend(patient._id);

    if (isStagnant) {
      const trendAlert = await Alert.create({
        patientId: patient._id,
        checkInId: checkIn._id,
        severity: "medium",
        alertType: "trend_escalation",
        notifiedTo: nurses.map((n) => n._id),
      });

      emitAlert(io, {
        _id: trendAlert._id,
        checkInId: checkIn._id,
        patientId: patient._id,
        patientName: req.user.name || "Patient",
        hospitalId,
        severity: "medium",
        alertType: "trend_escalation",
        overallScore,
        riskStatus,
        message: "3+ stable check-ins with no improvement — manual review recommended.",
        timestamp: new Date(),
      });
    }

    // ── 7. Respond to patient ───────────────────────────
    res.status(201).json({
      message: "Check-in submitted successfully.",
      checkIn: {
        id: checkIn._id,
        date: checkIn.date,
        overallScore,
        riskStatus,
        aiResponse,
        symptoms: checkIn.symptoms,
      },
      trendEscalation: isStagnant,
    });
  } catch (error) {
    res.status(500).json({ message: "Check-in failed.", error: error.message });
  }
};

/**
 * GET /api/checkins/patient/:patientId
 * Get all check-ins for a patient with trend data.
 * Accessible by: the patient themselves, or staff from same hospital.
 */
const getPatientCheckIns = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 14, page = 1 } = req.query;

    const patient = await Patient.findById(patientId).lean();
    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Access check: patient can see own, staff can see hospital patients
    const isOwnPatient = patient.userId.toString() === req.user.id;
    const isSameHospital = patient.hospitalId.toString() === req.user.hospitalId;

    if (!isOwnPatient && !isSameHospital) {
      return res.status(403).json({ message: "Access denied." });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [checkIns, total] = await Promise.all([
      CheckIn.find({ patientId })
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("respondedBy", "name role")
        .lean(),
      CheckIn.countDocuments({ patientId }),
    ]);

    // Build trend data (chronological for charting)
    const trend = [...checkIns].reverse().map((ci) => ({
      date: ci.date,
      overallScore: ci.overallScore,
      riskStatus: ci.riskStatus,
      symptomCount: ci.symptoms.length,
    }));

    // Summary stats
    const scores = checkIns.map((ci) => ci.overallScore);
    const summary = {
      totalCheckIns: total,
      averageScore: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0,
      highestScore: scores.length ? Math.max(...scores) : 0,
      latestRisk: checkIns.length ? checkIns[0].riskStatus : "N/A",
    };

    res.status(200).json({
      checkIns,
      trend,
      summary,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch check-ins.", error: error.message });
  }
};

/**
 * PATCH /api/checkins/:id/respond
 * Doctor or nurse adds a response to a check-in.
 * Patient is notified in real time via Socket.io.
 */
const respondToCheckIn = async (req, res) => {
  try {
    const { doctorResponse } = req.body;

    if (!doctorResponse || !doctorResponse.trim()) {
      return res.status(400).json({ message: "Response message is required." });
    }

    const checkIn = await CheckIn.findById(req.params.id);
    if (!checkIn) {
      return res.status(404).json({ message: "Check-in not found." });
    }

    // Verify the responder is from the same hospital as the patient
    const patient = await Patient.findById(checkIn.patientId).lean();
    if (!patient || patient.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Update the check-in
    checkIn.doctorResponse = doctorResponse.trim();
    checkIn.respondedBy = req.user.id;
    checkIn.respondedAt = new Date();
    await checkIn.save();

    // Notify the patient in real time
    const io = req.app.get("io");
    io.to(getPatientRoom(patient._id)).emit(EVENTS.CHECKIN_RESPONSE, {
      checkInId: checkIn._id,
      doctorResponse: checkIn.doctorResponse,
      respondedBy: {
        id: req.user.id,
        role: req.user.role,
      },
      respondedAt: checkIn.respondedAt,
    });

    // Acknowledge the related alert(s)
    await Alert.updateMany(
      { checkInId: checkIn._id, acknowledgedAt: null },
      { acknowledgedAt: new Date() }
    );

    res.status(200).json({
      message: "Response submitted and patient notified.",
      checkIn,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to respond.", error: error.message });
  }
};

/**
 * POST /api/checkins/analyze-symptom
 * Receives free-text symptom description, calls Claude API,
 * returns structured symptom data.
 */
const analyzeSymptom = async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Symptom description is required." });
    }

    // Get the patient's condition for context-aware analysis
    const patient = await Patient.findOne({ userId: req.user.id }).lean();
    if (!patient) {
      return res.status(404).json({ message: "Patient record not found." });
    }

    const result = await analyzeSymptomText(text.trim(), patient.condition, language);

    res.status(200).json({
      message: "Symptom analyzed successfully.",
      symptom: {
        ...result,
        source: "voiceText",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Symptom analysis failed.", error: error.message });
  }
};

module.exports = {
  submitCheckIn,
  getPatientCheckIns,
  respondToCheckIn,
  analyzeSymptom,
};
