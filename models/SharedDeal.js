const mongoose = require("mongoose");

const SharedDealSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },

  inputs: {
    type: Object,
    required: true
  },

  results: {
    type: Object,
    required: true
  },

  permissions: {
    mode: {
      type: String,
      enum: ["view", "edit"],
      default: "view"
    }
  },

  meta: {
    title: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }

}, { timestamps: true });

module.exports = mongoose.model("SharedDeal", SharedDealSchema);
