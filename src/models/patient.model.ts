import mongoose, { Schema, Types } from "mongoose";

const patientSchema = new Schema(
  {
    doctorId: { type: Schema.Types.ObjectId, required: true },
    deletedAt: { type: Date, default: null },
  },
  { autoIndex: false },
);

export const PatientModel = mongoose.model("Patient", patientSchema);

export async function countActive(doctorId?: string): Promise<number> {
  const filter: { deletedAt: null; doctorId?: Types.ObjectId } = { deletedAt: null };
  if (doctorId !== undefined) {
    if (!mongoose.isValidObjectId(doctorId)) return 0;
    filter.doctorId = new Types.ObjectId(doctorId);
  }
  return PatientModel.countDocuments(filter);
}
