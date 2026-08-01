const express = require("express");
const router = express.Router();
const { generatePatientReport, generateMyReport } = require("../controllers/reportController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.use(verifyToken);

router.get("/me", authorizeRoles("patient"), generateMyReport);
router.get("/:patientId", authorizeRoles("admin", "doctor", "nurse"), generatePatientReport);

module.exports = router;
