import mongoose, { Schema } from "mongoose";

const adminSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["admin"] },
  },
  { timestamps: true, autoIndex: false },
);

adminSchema.index({ email: 1 }, { unique: true });

export const AdminModel = mongoose.model("Admin", adminSchema);

export async function create(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: "admin";
}) {
  const doc = await AdminModel.create(input);
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: "admin" as const,
  };
}

export async function findByEmail(email: string) {
  const doc = await AdminModel.findOne({ email: email.toLowerCase() }).lean();
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: "admin" as const,
    passwordHash: doc.passwordHash,
  };
}
