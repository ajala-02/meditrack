const jwt = require("jsonwebtoken");

/**
 * Generate an access token (15 min) and a refresh token (7 days).
 * @param {Object} user - Mongoose user document
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    hospitalId: user.hospitalId,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

module.exports = generateTokens;
