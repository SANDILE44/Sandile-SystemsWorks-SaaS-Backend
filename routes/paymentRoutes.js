// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const auth = require("../middleware/auth"); // JWT auth
const User = require("../models/User"); // User model

// ====================
// CREATE YOCO CHECKOUT
// ====================
router.post("/checkout", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.hasPaid)
      return res.status(400).json({ error: "User already paid" });

    // Amount in cents
    const amount = process.env.SUBSCRIPTION_AMOUNT
      ? parseInt(process.env.SUBSCRIPTION_AMOUNT)
      : 5000;

    // Yoco payload
    const yocoPayload = {
      amount,
      currency: "ZAR",
      successUrl: process.env.FRONTEND_SUCCESS_URL,
      cancelUrl: process.env.FRONTEND_CANCEL_URL,
      metadata: {
        userId: user._id.toString(),
        email: user.email,
      },
    };

    // Call Yoco API
    const response = await axios.post(
      "https://payments.yoco.com/api/checkouts",
      yocoPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    // ✅ Send checkout link to frontend
    res.json({
      checkoutUrl: response.data.redirectUrl,
      checkoutId: response.data.id,
    });
  } catch (err) {
    console.error("💥 YOCO checkout error:", err.response?.data || err.message);
    res.status(500).json({ error: "Payment initialization failed" });
  }
});

router.post("/confirm", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.hasPaid = true;
    user.paidAt = new Date();
    await user.save();

    res.json({ success: true, hasPaid: true });
  } catch (err) {
    res.status(500).json({ error: "Payment confirmation failed" });
  }
});

module.exports = router;
