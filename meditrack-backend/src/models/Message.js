const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["patient", "nurse", "doctor"],
      required: true,
    },
    message: {
      type: String,
      required: [true, "Message body is required"],
      trim: true,
      maxlength: 2000,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────
messageSchema.index({ patientId: 1, createdAt: -1 }); // conversation thread
messageSchema.index({ senderId: 1 });
messageSchema.index({ patientId: 1, readAt: 1 });     // unread messages query

module.exports = mongoose.model("Message", messageSchema);
