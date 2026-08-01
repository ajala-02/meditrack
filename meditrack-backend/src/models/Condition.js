const mongoose = require("mongoose");

const conditionSymptomSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const conditionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Condition name is required"],
      trim: true,
    },
    symptoms: {
      type: [conditionSymptomSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one symptom must be defined",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
conditionSchema.index({ hospitalId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Condition", conditionSchema);
