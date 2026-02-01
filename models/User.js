// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // store hashed password here
    passwordHash: { type: String, required: true },

    hasPaid: { type: Boolean, default: false },
    trialEnd: { type: Date, default: null },
    subscriptionEnd: { type: Date, default: null },

    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },

    recentCalculators: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
