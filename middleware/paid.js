// backend/middleware/paid.js
const User = require("../models/User");

module.exports = async function paid(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    const now = Date.now();
    const trialActive =
      user.trialEnd && now < new Date(user.trialEnd).getTime();

    if (user.hasPaid || trialActive) {
      req.userDoc = user;
      return next();
    }

    return res
      .status(403)
      .json({ error: "Payment required", trialExpired: true });
  } catch (err) {
    console.error("Paid middleware error:", err);
    return res.status(500).json({ error: "Access check failed" });
  }
};
