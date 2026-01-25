const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  hasPaid: { type: Boolean, default: false },
  trialEnd: { type: Date, default: () => new Date(Date.now() + 3*24*60*60*1000) } // 3-day free trial
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
