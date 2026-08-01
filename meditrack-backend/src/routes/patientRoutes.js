const express = require("express");
const router = express.Router();

const {
  enrollPatient,
  getMyPatient,
  getAllPatients,
  getPatientById,
  updatePatientStatus,
  generateInstructions,
} = require("../controllers/patientController");

const { verifyToken, authorizeRoles } = require("../middleware/auth");

// All routes require authentication
router.use(verifyToken);

// POST /api/patients/enroll — Nurse/Doctor/Admin enrolls a patient
router.post(
  "/enroll",
  authorizeRoles("nurse", "doctor", "admin"),
  enrollPatient
);

// POST /api/patients/generate-instructions
router.post(
  "/generate-instructions",
  authorizeRoles("nurse", "doctor", "admin"),
  generateInstructions
);

// GET /api/patients/me — Patient views their own recovery plan
router.get(
  "/me",
  authorizeRoles("patient"),
  getMyPatient
);

// GET /api/patients — Nurse/Doctor/Admin list all patients
router.get(
  "/",
  authorizeRoles("doctor", "nurse", "admin"),
  getAllPatients
);

// GET /api/patients/:id — Nurse/Doctor/Admin view patient detail
router.get(
  "/:id",
  authorizeRoles("doctor", "nurse", "admin"),
  getPatientById
);

// PATCH /api/patients/:id/status — Doctor/Admin update status
router.patch(
  "/:id/status",
  authorizeRoles("doctor", "admin"),
  updatePatientStatus
);

module.exports = router;
