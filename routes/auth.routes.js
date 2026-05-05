import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* =========================
   GOOGLE CLIENT
========================= */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* =========================
   JWT HELPER
========================= */
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

/* =========================
   SIGNUP (7-DAY TRIAL)
========================= */
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: cleanEmail });

    if (exists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Set Trial for 7 Days (Midnight expiry)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    trialEnd.setHours(23, 59, 59, 999);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      subscriptions: {
        calculators: {
          status: 'trial',
          trialEnd,
        },
        riskMonitor: {
          status: 'trial',
          trialEnd,
          scansToday: 0,
          scansResetAt: new Date(),
        },
      }
    });

    const token = signToken(user._id);

    res.status(201).json({
      message: "Signup successful (7-day trial)",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptions: user.subscriptions,
      },
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = signToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptions: user.subscriptions,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* =========================
   GOOGLE LOGIN (7-DAY TRIAL)
========================= */
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Google token missing" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    const name = payload.name;

    let user = await User.findOne({ email });

    if (!user) {
      // Set Trial for 7 Days for New Google Users
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      trialEnd.setHours(23, 59, 59, 999);

      user = await User.create({
        name,
        email,
        passwordHash: crypto.randomBytes(32).toString("hex"), // Placeholder for Google users
        subscriptions: {
          calculators: {
            status: 'trial',
            trialEnd,
          },
          riskMonitor: {
            status: 'trial',
            trialEnd,
            scansToday: 0,
            scansResetAt: new Date(),
          },
        }
      });
    }

    const jwtToken = signToken(user._id);

    res.json({
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptions: user.subscriptions,
      },
    });

  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ error: "Google login failed" });
  }
});

/* =========================
   PROFILE (AUTH REQUIRED)
========================= */
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name email subscriptions recentCalculators"
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error("Profile Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
