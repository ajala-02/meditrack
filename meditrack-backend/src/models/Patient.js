const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    age: {
      type: Number,
      required: [true, "Age is required"],
    },
    sex: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: [true, "Sex is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
    },
    emergencyContact: {
      name: { type: String },
      phone: { type: String },
    },
    diagnosis: {
      type: String,
      required: [true, "Diagnosis is required"],
    },
    medicines: [
      {
        name: { type: String },
        dosage: { type: String },
        frequency: { type: String },
        timing: { type: String },
        duration: { type: String },
      }
    ],
    recoveryInstructions: {
      dos: [{ type: String }],
      donts: [{ type: String }],
      diet: [{ type: String }],
      woundCare: [{ type: String }],
      redFlags: [{ type: String }],
    },
    caregiverName: { type: String },
    caregiverPhone: { type: String },
    checkInTimePreference: {
      type: String,
      enum: ["morning", "evening"],
      default: "morning",
    },
    monitoringDuration: {
      type: Number,
      enum: [7, 14, 21, 30],
      default: 14,
    },
    condition: {
      type: String,
      enum: ["cardiac", "ortho", "diabetes", "other"],
      required: [true, "Condition is required"],
    },
    enrolledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dischargeDate: {
      type: Date,
      required: [true, "Discharge date is required"],
    },
    monitoringEndDate: {
      type: Date,
      required: [true, "Monitoring end date is required"],
    },
    status: {
      type: String,
      enum: ["active", "completed", "escalated"],
      default: "active",
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    joinCode: {
      type: String,
      unique: true,
      sparse: true, // allow null for patients who already joined
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────
patientSchema.index({ hospitalId: 1, status: 1 });
patientSchema.index({ enrolledBy: 1 });
patientSchema.index({ caregiverId: 1 });
patientSchema.index({ monitoringEndDate: 1 });

module.exports = mongoose.model("Patient", patientSchema);
