const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const { saveAiConversation, replyToCompanion } = require("../controllers/messageController");

router.use(verifyToken);
router.post("/reply", authorizeRoles("patient"), replyToCompanion);
router.post("/", authorizeRoles("patient"), saveAiConversation);

module.exports = router;