import mongoose from 'mongoose';

const FindingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    details: { type: String, required: true },
    evidence: { type: String, default: '' },
  },
  { _id: false }
);

const ScanResultSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
    },
    scannedAt: { type: Date, required: true },
    findings: { type: [FindingSchema], default: [] },
    score: { type: Number, required: true },
    level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    summary: { type: String, default: '' },
  },
  { timestamps: true }
);

ScanResultSchema.index({ websiteId: 1, scannedAt: -1 });

export default mongoose.model('ScanResult', ScanResultSchema);
