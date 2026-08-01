const express = require("express");
const router = express.Router();
const { getAllPatients } = require("../controllers/patientController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// Require authentication for all routes
router.use(verifyToken);

// Alias endpoint for retrieving dashboard patient data
router.get("/", authorizeRoles("admin", "doctor", "nurse"), getAllPatients);

module.exports = router;
