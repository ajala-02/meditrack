const mongoose = require("mongoose");

const symptomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    source: {
      type: String,
      enum: ["voiceText", "checklist"],
      required: true,
    },
    aiFlag: {
      type: Boolean,
      default: false,
    },
    flagNote: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const checkInSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    symptoms: {
      type: [symptomSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one symptom is required",
      },
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
    },
    riskStatus: {
      type: String,
      enum: ["stable", "watch", "critical"],
      required: true,
    },
    aiResponse: {
      type: String,
      default: "",
    },
    doctorResponse: {
      type: String,
      default: "",
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────
checkInSchema.index({ patientId: 1, date: -1 }); // patient timeline
checkInSchema.index({ riskStatus: 1 });           // filter by severity
checkInSchema.index({ patientId: 1, createdAt: -1 }); // trend queries

module.exports = mongoose.model("CheckIn", checkInSchema);
