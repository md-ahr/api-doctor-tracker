import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, autoIndex: false },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ adminId: 1 });

export const SessionModel = mongoose.model("Session", sessionSchema);

export async function create(input: {
  adminId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await SessionModel.create(input);
}

export async function findLiveByHash(tokenHash: string, now: Date) {
  const doc = await SessionModel.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: now },
  }).lean();
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    adminId: doc.adminId.toString(),
  };
}

export async function revoke(id: string, revokedAt: Date): Promise<void> {
  await SessionModel.updateOne({ _id: id }, { $set: { revokedAt } });
}
