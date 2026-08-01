const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Patient = require("../models/Patient");
const generateTokens = require("../utils/generateTokens");

// Cookie options for the refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

/**
 * POST /api/auth/register
 * Admin-only: create doctor, nurse, or admin accounts.
 * Patients are enrolled via a separate flow (patientController).
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Only admin can create staff accounts
    if (!["doctor", "nurse", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Use patient enrollment for patient accounts.",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // Create user under the admin's hospital
    const user = await User.create({
      name,
      email,
      password,
      role,
      hospitalId: req.user.hospitalId,
    });

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed.", error: error.message });
  }
};

/**
 * POST /api/auth/login
 * Open route — authenticates any user role.
 * Returns access token in body, refresh token in httpOnly cookie.
 */
const login = async (req, res) => {
  try {
    const { email, password, joinCode } = req.body;

    if (!email || (!password && !joinCode)) {
      return res.status(400).json({ message: "Email and either password or join code are required." });
    }

    // Explicitly select password (excluded by default in schema)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email." });
    }

    if (joinCode) {
      // Patient login via joinCode
      if (user.role !== "patient") {
         return res.status(403).json({ message: "Join code login is only for patients." });
      }
      const patient = await Patient.findOne({ userId: user._id, joinCode });
      if (!patient) {
         return res.status(401).json({ message: "Invalid join code." });
      }
    } else {
      // Staff login via password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password." });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    let condition = null;
    if (user.role === "patient") {
      // If we didn't already fetch the patient via joinCode
      let patientRecord = null;
      if (joinCode) {
        patientRecord = await Patient.findOne({ userId: user._id, joinCode });
      } else {
        patientRecord = await Patient.findOne({ userId: user._id });
      }
      if (patientRecord) condition = patientRecord.condition;
    }

    res.status(200).json({
      message: "Login successful.",
      accessToken,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        ...(condition && { condition }),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
};

/**
 * POST /api/auth/refresh
 * Uses the refresh token from the httpOnly cookie to issue a new
 * access token (and rotates the refresh token for security).
 */
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ message: "No refresh token provided." });
    }

    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // Fetch fresh user data (ensures account still exists / role unchanged)
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    // Issue new token pair (rotation)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      message: "Token refreshed.",
      accessToken,
    });
  } catch (error) {
    // Clear invalid cookie
    res.clearCookie("refreshToken", { path: "/" });

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Refresh token expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid refresh token." });
  }
};

/**
 * POST /api/auth/logout
 * Clears the refresh token cookie.
 */
const logout = async (_req, res) => {
  try {
    res.clearCookie("refreshToken", { path: "/" });
    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    res.status(500).json({ message: "Logout failed.", error: error.message });
  }
};

module.exports = { register, login, refreshToken, logout };
