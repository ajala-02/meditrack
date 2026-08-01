const express = require("express");
const router = express.Router();
const { getConditions } = require("../controllers/conditionController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.get("/", getConditions);

module.exports = router;
