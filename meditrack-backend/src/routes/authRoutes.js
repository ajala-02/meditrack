const express = require("express");
const router = express.Router();

const { register, login, refreshToken, logout } = require("../controllers/authController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// Public routes
router.post("/login", login);
router.post("/refresh", refreshToken);

// Protected routes
router.post("/register", verifyToken, authorizeRoles("admin"), register);
router.post("/logout", verifyToken, logout);

module.exports = router;
