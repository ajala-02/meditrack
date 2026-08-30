const express = require("express");
const router = express.Router();

const {
  submitCheckIn,
  getPatientCheckIns,
  respondToCheckIn,
  analyzeSymptom,
  extractVoice,
} = require("../controllers/checkInController");

const { verifyToken, authorizeRoles } = require("../middleware/auth");

// All routes require authentication
router.use(verifyToken);

// POST /api/checkins — Patient submits a daily check-in
router.post(
  "/",
  authorizeRoles("patient"),
  submitCheckIn
);

// GET /api/checkins/patient/:patientId — Get check-ins with trend data
router.get(
  "/patient/:patientId",
  authorizeRoles("patient", "doctor", "nurse", "admin"),
  getPatientCheckIns
);

// GET /api/checkins/:patientId
router.get(
  "/:patientId",
  authorizeRoles("patient", "doctor", "nurse", "admin"),
  getPatientCheckIns
);

// GET /api/checkins
router.get(
  "/",
  authorizeRoles("patient", "doctor", "nurse", "admin"),
  getPatientCheckIns
);

// PATCH /api/checkins/:id/respond — Doctor/Nurse responds to a check-in
router.patch(
  "/:id/respond",
  authorizeRoles("doctor", "nurse"),
  respondToCheckIn
);

// POST /api/checkins/analyze-symptom — AI symptom extraction (patient)
router.post(
  "/analyze-symptom",
  authorizeRoles("patient"),
  analyzeSymptom
);

router.post(
  "/extract-voice",
  authorizeRoles("patient"),
  extractVoice
);

module.exports = router;
