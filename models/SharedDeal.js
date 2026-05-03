import mongoose from "mongoose";

const SharedDealSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      unique: true,
      index: true
    },

    type: String, // construction, manufacturing, consulting, restaurant

    inputs: Object,
    results: Object,

    permissions: {
      mode: {
        type: String,
        enum: ["view", "edit"],
        default: "view"
      },
      isPublic: {
        type: Boolean,
        default: true
      }
    },

    meta: {
      title: String,
      createdBy: String
    }

  },
  { timestamps: true }
);

export default mongoose.model("SharedDeal", SharedDealSchema);