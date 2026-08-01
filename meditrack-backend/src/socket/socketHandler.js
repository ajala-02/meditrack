const jwt = require("jsonwebtoken");
const Patient = require("../models/Patient");

// ─────────────────────────────────────────────────────────
// Socket event constants
// ─────────────────────────────────────────────────────────
const EVENTS = {
  NEW_ALERT: "new_alert",
  CRITICAL_ALERT: "critical_alert",
  TREND_ESCALATION: "trend_escalation",
  NEW_MESSAGE: "new_message",
  RISK_UPDATE: "risk_update",
  CHECKIN_RESPONSE: "checkin_response",
};

// ─────────────────────────────────────────────────────────
// Socket authentication middleware
// ─────────────────────────────────────────────────────────

/**
 * Verify JWT on socket handshake.
 * Token is sent via auth.token in the handshake.
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, role, hospitalId }
    next();
  } catch (error) {
    return next(new Error("Invalid or expired token."));
  }
};

// ─────────────────────────────────────────────────────────
// Room helpers
// ─────────────────────────────────────────────────────────

const getPatientRoom = (patientId) => `patient_${patientId}`;
const getNurseRoom = (hospitalId) => `hospital_${hospitalId}_nurses`;
const getDoctorRoom = (hospitalId) => `hospital_${hospitalId}_doctors`;
const getHospitalRoom = (hospitalId) => `hospital_${hospitalId}`;

/**
 * Join the correct rooms based on the user's role.
 */
const joinRooms = async (socket) => {
  const { id, role, hospitalId } = socket.user;

  switch (role) {
    case "patient": {
      // Find the Patient record to get the patient document _id
      const patient = await Patient.findOne({ userId: id }).lean();
      if (patient) {
        const room = getPatientRoom(patient._id);
        socket.join(room);
        console.log(`Patient ${id} joined room: ${room}`);
      }
      break;
    }

    case "nurse": {
      const room = getNurseRoom(hospitalId);
      socket.join(room);
      socket.join(getHospitalRoom(hospitalId));
      console.log(`Nurse ${id} joined room: ${room}`);
      break;
    }

    case "doctor": {
      const room = getDoctorRoom(hospitalId);
      socket.join(room);
      socket.join(getHospitalRoom(hospitalId));
      console.log(`Doctor ${id} joined room: ${room}`);
      break;
    }

    case "admin": {
      // Admin sees everything in the hospital
      socket.join(getHospitalRoom(hospitalId));
      socket.join(getNurseRoom(hospitalId));
      socket.join(getDoctorRoom(hospitalId));
      console.log(`Admin ${id} joined all hospital rooms: ${hospitalId}`);
      break;
    }

    default:
      break;
  }
};

// ─────────────────────────────────────────────────────────
// Main initializer — called from server.js
// ─────────────────────────────────────────────────────────

const initializeSocket = (io) => {
  // Apply auth middleware
  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    console.log(
      `Socket connected: ${socket.id} | user: ${socket.user.id} | role: ${socket.user.role}`
    );

    // Auto-join rooms based on role
    try {
      await joinRooms(socket);
    } catch (error) {
      console.error(`Room join failed for ${socket.user.id}:`, error.message);
    }

    // ── Client-initiated events ─────────────────────────

    /**
     * Allow a staff member to manually join a specific patient's
     * room (e.g. when opening a patient detail view).
     */
    socket.on("join_patient_room", (patientId) => {
      if (["doctor", "nurse", "admin"].includes(socket.user.role)) {
        const room = getPatientRoom(patientId);
        socket.join(room);
        console.log(`${socket.user.role} ${socket.user.id} joined ${room}`);
      }
    });

    /**
     * Leave a patient room when navigating away.
     */
    socket.on("leave_patient_room", (patientId) => {
      const room = getPatientRoom(patientId);
      socket.leave(room);
      console.log(`${socket.user.role} ${socket.user.id} left ${room}`);
    });

    // ── Disconnect ──────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(
        `Socket disconnected: ${socket.id} | user: ${socket.user.id} | reason: ${reason}`
      );
    });
  });
};

// ─────────────────────────────────────────────────────────
// Emit helpers — used by controllers
// ─────────────────────────────────────────────────────────

/**
 * Emit an alert to the appropriate rooms based on severity.
 *
 * @param {SocketIO.Server} io
 * @param {Object} alert - Must include: patientId, severity, hospitalId + any payload
 */
const emitAlert = (io, alert) => {
  const { hospitalId, severity } = alert;

  const payload = {
    alertId: alert._id || alert.alertId,
    checkInId: alert.checkInId,
    patientId: alert.patientId,
    patientName: alert.patientName || "Patient",
    severity,
    alertType: alert.alertType || "triage",
    overallScore: alert.overallScore,
    riskStatus: alert.riskStatus,
    symptoms: alert.symptoms || [],
    message: alert.message || "",
    timestamp: alert.timestamp || new Date(),
  };

  switch (severity) {
    case "high":
      // Critical — instant alert to both doctors and nurses
      io.to(getDoctorRoom(hospitalId)).emit(EVENTS.CRITICAL_ALERT, payload);
      io.to(getNurseRoom(hospitalId)).emit(EVENTS.CRITICAL_ALERT, payload);
      break;

    case "medium":
      // Watch — notify doctor
      io.to(getDoctorRoom(hospitalId)).emit(EVENTS.NEW_ALERT, payload);
      break;

    case "low":
    default:
      // Stable — notify nurse
      io.to(getNurseRoom(hospitalId)).emit(EVENTS.NEW_ALERT, payload);
      break;
  }

  // Also emit a risk update to the full hospital room (for dashboards)
  io.to(getHospitalRoom(hospitalId)).emit(EVENTS.RISK_UPDATE, {
    patientId: alert.patientId,
    overallScore: alert.overallScore,
    riskStatus: alert.riskStatus,
    timestamp: payload.timestamp,
  });
};

/**
 * Emit a message to the relevant rooms.
 *
 * @param {SocketIO.Server} io
 * @param {Object} message - Must include: patientId, senderId,
 *                           senderRole, hospitalId + message body
 */
const emitMessage = (io, message) => {
  const payload = {
    messageId: message._id || message.messageId,
    patientId: message.patientId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    senderName: message.senderName || "",
    message: message.message,
    createdAt: message.createdAt || new Date(),
  };

  // Always send to the patient's room
  io.to(getPatientRoom(message.patientId)).emit(EVENTS.NEW_MESSAGE, payload);

  // If the message is FROM the patient, also notify the hospital staff
  if (message.senderRole === "patient" && message.hospitalId) {
    io.to(getNurseRoom(message.hospitalId)).emit(EVENTS.NEW_MESSAGE, payload);
    io.to(getDoctorRoom(message.hospitalId)).emit(EVENTS.NEW_MESSAGE, payload);
  }
};

module.exports = {
  initializeSocket,
  emitAlert,
  emitMessage,
  EVENTS,
  // Export room helpers for use in controllers if needed
  getPatientRoom,
  getNurseRoom,
  getDoctorRoom,
  getHospitalRoom,
};
