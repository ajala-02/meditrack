const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const { saveAiConversation, replyToCompanion, getMessages } = require("../controllers/messageController");

router.use(verifyToken);
router.get("/:patientId", authorizeRoles("patient", "doctor", "nurse", "admin"), getMessages);
router.get("/", authorizeRoles("patient", "doctor", "nurse", "admin"), getMessages);
router.post("/reply", authorizeRoles("patient"), replyToCompanion);
router.post("/", authorizeRoles("patient", "doctor", "nurse", "admin"), saveAiConversation);

module.exports = router;