const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    checkInId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckIn",
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    alertType: {
      type: String,
      enum: ["triage", "trend_escalation", "manual"],
      required: true,
    },
    notifiedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────
alertSchema.index({ patientId: 1, createdAt: -1 });
alertSchema.index({ severity: 1, acknowledgedAt: 1 }); // unacknowledged high alerts
alertSchema.index({ notifiedTo: 1 });                   // alerts for a specific user

module.exports = mongoose.model("Alert", alertSchema);
