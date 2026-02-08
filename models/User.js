import mongoose from 'mongoose';

const productSubscriptionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['trial', 'active', 'expired'],
      default: 'trial',
    },

    trialEnd: {
      type: Date,
      default: null,
    },

    subscriptionEnd: {
      type: Date,
      default: null,
    },

    // Risk Monitor–specific controls (ignored for calculators)
    scansToday: {
      type: Number,
      default: 0,
    },

    scansResetAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // =====================
    // CORE IDENTITY
    // =====================
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },

    // =====================
    // PRODUCT SUBSCRIPTIONS
    // =====================
    subscriptions: {
      calculators: {
        type: productSubscriptionSchema,
        default: () => ({
          status: 'trial',
          trialEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        }),
      },

      riskMonitor: {
        type: productSubscriptionSchema,
        default: () => ({
          status: 'trial',
          trialEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          scansToday: 0,
          scansResetAt: new Date(),
        }),
      },
    },

    // =====================
    // PASSWORD RESET
    // =====================
    resetToken: String,
    resetTokenExpiry: Date,

    // =====================
    // CALCULATORS UX
    // =====================
    recentCalculators: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
