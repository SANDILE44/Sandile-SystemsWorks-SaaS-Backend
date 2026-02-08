import mongoose from 'mongoose';

const WebsiteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    url: { type: String, required: true },
    status: { type: String, enum: ['active'], default: 'active' },
  },
  { timestamps: true }
);

WebsiteSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model('Website', WebsiteSchema);
