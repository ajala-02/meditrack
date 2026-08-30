const mongoose = require("mongoose");
const Message = require("../models/Message");
const AiConversation = require("../models/AiConversation");
const Patient = require("../models/Patient");
const { generateCompanionReply } = require("../services/claudeService");
const { emitMessage, EVENTS } = require("../socket/socketHandler");

const replyToCompanion = async (req, res) => {
  try {
    const { messages, patientName, day, total } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ message: "Conversation messages are required." });
    }
    const patient = await Patient.findOne({ userId: req.user.id }).select("condition").lean();
    if (!patient) return res.status(404).json({ message: "Patient record not found." });
    const reply = await generateCompanionReply({ messages: messages.slice(-30), patientName, condition: patient.condition, day, total });
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ message: "AI companion could not respond.", error: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { patientId } = req.params;
    let patient = null;

    if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findById(patientId);
      if (!patient) {
        patient = await Patient.findOne({ userId: patientId });
      }
    } else {
      patient = await Patient.findOne({ userId: req.user.id });
    }

    if (!patient) {
      patient = await Patient.findOne({ userId: req.user.id });
    }

    if (!patient) {
      return res.status(404).json({ message: "Patient record not found." });
    }

    if (req.user.role === "patient" && String(patient.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (["doctor", "nurse", "admin"].includes(req.user.role)) {
      if (String(patient.hospitalId) !== String(req.user.hospitalId)) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    const messages = await Message.find({ patientId: patient._id })
      .sort({ createdAt: 1 })
      .populate("senderId", "name role")
      .lean();

    return res.status(200).json({ messages, patientId: patient._id });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch messages.", error: error.message });
  }
};

const saveAiConversation = async (req, res) => {
  try {
    const { messages, message, patientId, type } = req.body;

    if (message) {
      let patient = null;
      if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
        patient = await Patient.findById(patientId);
        if (!patient) {
          patient = await Patient.findOne({ userId: patientId });
        }
      }
      if (!patient) {
        patient = await Patient.findOne({ userId: req.user.id });
      }
      if (!patient) return res.status(404).json({ message: "Patient record not found." });

      const newMsg = await Message.create({
        patientId: patient._id,
        senderId: req.user.id,
        senderRole: req.user.role || "patient",
        message: String(message).trim().slice(0, 2000),
      });

      const populatedMsg = await Message.findById(newMsg._id)
        .populate("senderId", "name role")
        .lean();

      // Emit socket event for real-time delivery
      const io = req.app.get("io");
      if (io) {
        emitMessage(io, {
          _id: newMsg._id,
          patientId: patient._id,
          senderId: req.user.id,
          senderRole: req.user.role || "patient",
          senderName: req.user.name || (req.user.role === "patient" ? "Patient" : "Care Team"),
          message: newMsg.message,
          hospitalId: patient.hospitalId,
          createdAt: newMsg.createdAt,
          readAt: newMsg.readAt,
        });
      }

      return res.status(201).json({ message: "Message sent successfully.", data: populatedMsg });
    }

    if (!Array.isArray(messages)) {
      return res.status(400).json({ message: "Message or conversation messages are required." });
    }

    const patient = await Patient.findOne({ userId: req.user.id }).select("_id");
    if (!patient) return res.status(404).json({ message: "Patient record not found." });

    const safeMessages = messages.slice(-100).map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || item.message || "").trim().slice(0, 4000),
    })).filter((item) => item.content);

    const conversation = await AiConversation.findOneAndUpdate(
      { patientId: patient._id },
      { type: "ai_companion", messages: safeMessages },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: "Conversation saved.", conversation });
  } catch (error) {
    res.status(500).json({ message: "Message could not be saved.", error: error.message });
  }
};

module.exports = { saveAiConversation, replyToCompanion, getMessages };