import mongoose, { Schema, type Types } from "mongoose";

const doctorSchema = new Schema(
  {
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    hospital: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true, autoIndex: false },
);

doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ createdAt: -1, _id: -1 });

export const DoctorModel = mongoose.model("Doctor", doctorSchema);

export type Doctor = {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

type DoctorInput = {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
};

type DoctorRecord = DoctorInput & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export async function create(input: DoctorInput): Promise<Doctor> {
  const doc = await DoctorModel.create(input);
  return toDoctor(doc);
}

export async function findById(id: string): Promise<Doctor | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await DoctorModel.findById(id).lean<DoctorRecord | null>();
  return doc ? toDoctor(doc) : null;
}

export async function findByEmail(email: string): Promise<Doctor | null> {
  const doc = await DoctorModel.findOne({ email: email.toLowerCase() }).lean<DoctorRecord | null>();
  return doc ? toDoctor(doc) : null;
}

export async function findByIds(ids: string[]) {
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  const docs = await DoctorModel.find({ _id: { $in: validIds } })
    .select("name specialization")
    .lean<Array<Pick<DoctorRecord, "_id" | "name" | "specialization">>>();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    specialization: doc.specialization,
  }));
}

export async function update(id: string, patch: Partial<DoctorInput>): Promise<Doctor | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const next = patch.email ? { ...patch, email: patch.email.toLowerCase() } : patch;
  const doc = await DoctorModel.findByIdAndUpdate(id, next, {
    returnDocument: "after",
  }).lean<DoctorRecord | null>();
  return doc ? toDoctor(doc) : null;
}

export function toDoctor(doc: DoctorRecord): Doctor {
  return {
    id: doc._id.toString(),
    name: doc.name,
    specialization: doc.specialization,
    hospital: doc.hospital,
    phone: doc.phone,
    email: doc.email,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
