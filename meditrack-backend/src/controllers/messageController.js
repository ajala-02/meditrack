const AiConversation = require("../models/AiConversation");
const Patient = require("../models/Patient");
const { generateCompanionReply } = require("../services/claudeService");

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

const saveAiConversation = async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ message: "Conversation messages are required." });
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
    res.status(500).json({ message: "Conversation could not be saved.", error: error.message });
  }
};

module.exports = { saveAiConversation, replyToCompanion };