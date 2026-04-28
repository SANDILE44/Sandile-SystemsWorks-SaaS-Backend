import mongoose from "mongoose";

const savedDealSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      required: true
    },

    inputs: {
      type: Object,
      default: {}
    },

    results: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
);

export default mongoose.model("SavedDeal", savedDealSchema);