const Condition = require("../models/Condition");

/**
 * GET /api/conditions
 * Get all conditions for the user's hospital.
 */
const getConditions = async (req, res) => {
  try {
    const conditions = await Condition.find({ hospitalId: req.user.hospitalId }).lean();
    res.status(200).json({ conditions });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch conditions.", error: error.message });
  }
};

module.exports = {
  getConditions,
};
