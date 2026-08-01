const jwt = require("jsonwebtoken");

/**
 * Verify the access token from the Authorization header.
 * Attaches decoded payload to req.user on success.
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role, hospitalId, iat, exp }
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please refresh." });
    }
    return res.status(401).json({ message: "Invalid token." });
  }
};

/**
 * Restrict access to specific roles.
 * Usage: authorizeRoles("admin", "doctor")
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
