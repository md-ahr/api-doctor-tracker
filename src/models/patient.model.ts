import mongoose, { Schema, Types } from "mongoose";

import { escapeRegex } from "../lib/escape-regex.js";

const conditions = [
  "critical",
  "serious",
  "stable",
  "recovering",
  "chronic",
  "observation",
] as const;
const sexes = ["female", "male", "other", "undisclosed"] as const;

const patientSchema = new Schema(
  {
    doctorId: { type: Schema.Types.ObjectId, required: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: String, default: null },
    sex: { type: String, enum: sexes, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null, lowercase: true, trim: true },
    condition: { type: String, required: true, enum: conditions },
    notes: { type: String, default: null },
    registeredAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, autoIndex: false },
);

patientSchema.index(
  { doctorId: 1, registeredAt: -1, _id: -1 },
  { partialFilterExpression: { deletedAt: null } },
);
patientSchema.index(
  { registeredAt: -1, _id: -1 },
  { partialFilterExpression: { deletedAt: null } },
);
patientSchema.index(
  { condition: 1, registeredAt: -1 },
  { partialFilterExpression: { deletedAt: null } },
);

export const PatientModel = mongoose.model("Patient", patientSchema);

export type PatientCondition = (typeof conditions)[number];
export type PatientSex = (typeof sexes)[number];

export type Patient = {
  id: string;
  doctorId: string;
  fullName: string;
  dateOfBirth: string | null;
  sex: PatientSex | null;
  phone: string | null;
  email: string | null;
  condition: PatientCondition;
  notes: string | null;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type PatientInput = {
  doctorId: string;
  fullName: string;
  dateOfBirth?: string | null;
  sex?: PatientSex | null;
  phone?: string | null;
  email?: string | null;
  condition: PatientCondition;
  notes?: string | null;
  registeredAt: Date;
};

export type PatientPatch = {
  doctorId?: string;
  fullName?: string;
  dateOfBirth?: string | null;
  sex?: PatientSex | null;
  phone?: string | null;
  email?: string | null;
  condition?: PatientCondition;
  notes?: string | null;
  registeredAt?: Date;
};

type PatientRecord = {
  _id: Types.ObjectId;
  doctorId: Types.ObjectId;
  fullName: string;
  dateOfBirth: string | null;
  sex: PatientSex | null;
  phone: string | null;
  email: string | null;
  condition: PatientCondition;
  notes: string | null;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toPatient(doc: PatientRecord): Patient {
  return {
    id: doc._id.toString(),
    doctorId: doc.doctorId.toString(),
    fullName: doc.fullName,
    dateOfBirth: doc.dateOfBirth,
    sex: doc.sex,
    phone: doc.phone,
    email: doc.email,
    condition: doc.condition,
    notes: doc.notes,
    registeredAt: doc.registeredAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}

function withEmail<T extends { email?: string | null }>(input: T): T {
  if (!input.email) return input;
  return { ...input, email: input.email.toLowerCase() };
}

export async function create(input: PatientInput): Promise<Patient> {
  const doc = await PatientModel.create({
    ...withEmail(input),
    doctorId: new Types.ObjectId(input.doctorId),
    deletedAt: null,
  });
  return toPatient(doc.toObject() as PatientRecord);
}

export async function findById(id: string): Promise<Patient | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PatientModel.findOne({ _id: id, deletedAt: null }).lean<PatientRecord | null>();
  return doc ? toPatient(doc) : null;
}

export async function update(id: string, patch: PatientPatch): Promise<Patient | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const next = withEmail(patch);
  const doc = await PatientModel.findOneAndUpdate({ _id: id, deletedAt: null }, next, {
    returnDocument: "after",
  }).lean<PatientRecord | null>();
  return doc ? toPatient(doc) : null;
}

export async function softDelete(id: string, deletedAt: Date): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await PatientModel.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt } },
  );
  return result.matchedCount === 1;
}

const patientSort = {
  registeredAt: { registeredAt: -1, _id: -1 },
  fullName: { fullName: 1, _id: 1 },
} as const;

export type PatientSearchQuery = {
  q?: string;
  condition?: PatientCondition;
  doctorId?: string;
  registeredFrom?: Date;
  registeredTo?: Date;
  page: number;
  limit: number;
  sort: keyof typeof patientSort;
};

type PatientFilter = {
  deletedAt: null;
  doctorId?: Types.ObjectId;
  condition?: PatientCondition;
  registeredAt?: { $gte?: Date; $lte?: Date };
  $or?: Array<Record<string, { $regex: string; $options: string }>>;
};

export async function search(query: PatientSearchQuery) {
  const empty = { items: [], page: query.page, limit: query.limit, total: 0 };
  if (query.doctorId !== undefined && !mongoose.isValidObjectId(query.doctorId)) return empty;

  const filter: PatientFilter = { deletedAt: null };
  if (query.doctorId) filter.doctorId = new Types.ObjectId(query.doctorId);
  if (query.condition) filter.condition = query.condition;
  if (query.registeredFrom || query.registeredTo) {
    filter.registeredAt = {};
    if (query.registeredFrom) filter.registeredAt.$gte = query.registeredFrom;
    if (query.registeredTo) filter.registeredAt.$lte = query.registeredTo;
  }
  if (query.q) {
    const pattern = escapeRegex(query.q);
    filter.$or = ["fullName", "email", "phone"].map((field) => ({
      [field]: { $regex: pattern, $options: "i" },
    }));
  }

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    PatientModel.find(filter)
      .sort(patientSort[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean<PatientRecord[]>(),
    PatientModel.countDocuments(filter),
  ]);

  return {
    items: docs.map((doc) => toPatient(doc)),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function countActive(doctorId?: string): Promise<number> {
  const filter: { deletedAt: null; doctorId?: Types.ObjectId } = { deletedAt: null };
  if (doctorId !== undefined) {
    if (!mongoose.isValidObjectId(doctorId)) return 0;
    filter.doctorId = new Types.ObjectId(doctorId);
  }
  return PatientModel.countDocuments(filter);
}

export async function count(): Promise<number> {
  return countActive();
}

export async function countByDoctor(): Promise<Array<{ doctorId: string; patientCount: number }>> {
  const rows = await PatientModel.aggregate<{ _id: Types.ObjectId; patientCount: number }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$doctorId", patientCount: { $sum: 1 } } },
  ]);
  return rows.map((row) => ({ doctorId: row._id.toString(), patientCount: row.patientCount }));
}

export async function countByCondition(): Promise<
  Array<{ condition: PatientCondition; patientCount: number }>
> {
  const rows = await PatientModel.aggregate<{ _id: PatientCondition; patientCount: number }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$condition", patientCount: { $sum: 1 } } },
  ]);
  return rows.map((row) => ({ condition: row._id, patientCount: row.patientCount }));
}

export async function countRegisteredByDay(
  window: { from: Date; to: Date },
  timezone: string,
): Promise<Array<{ date: string; count: number }>> {
  const rows = await PatientModel.aggregate<{ _id: string; count: number }>([
    { $match: { deletedAt: null, registeredAt: { $gte: window.from, $lte: window.to } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$registeredAt", timezone },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ date: row._id, count: row.count }));
}
