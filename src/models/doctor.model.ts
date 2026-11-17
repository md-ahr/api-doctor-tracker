import mongoose, { Schema, type Types } from "mongoose";

import { escapeRegex } from "../lib/escape-regex.js";

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
doctorSchema.index(
  { specialization: 1, createdAt: -1 },
  { collation: { locale: "en", strength: 2 } },
);
doctorSchema.index({ hospital: 1, createdAt: -1 }, { collation: { locale: "en", strength: 2 } });

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

const textCollation = { locale: "en", strength: 2 } as const;

const doctorSort = {
  createdAt: { createdAt: -1, _id: -1 },
  name: { name: 1, _id: 1 },
} as const;

export type DoctorSearchQuery = {
  q?: string;
  specialization?: string;
  hospital?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
  sort: keyof typeof doctorSort;
};

export async function search(query: DoctorSearchQuery) {
  const filter: {
    specialization?: string;
    hospital?: string;
    createdAt?: { $gte?: Date; $lte?: Date };
    $or?: Array<Record<string, { $regex: string; $options: string }>>;
  } = {};

  if (query.specialization) filter.specialization = query.specialization;
  if (query.hospital) filter.hospital = query.hospital;
  if (query.createdFrom || query.createdTo) {
    filter.createdAt = {};
    if (query.createdFrom) filter.createdAt.$gte = query.createdFrom;
    if (query.createdTo) filter.createdAt.$lte = query.createdTo;
  }
  if (query.q) {
    const pattern = escapeRegex(query.q);
    filter.$or = ["name", "specialization", "hospital", "email", "phone"].map((field) => ({
      [field]: { $regex: pattern, $options: "i" },
    }));
  }

  const useCollation = Boolean(query.specialization || query.hospital);
  const skip = (query.page - 1) * query.limit;
  let itemsQuery = DoctorModel.find(filter)
    .sort(doctorSort[query.sort])
    .skip(skip)
    .limit(query.limit);
  let countQuery = DoctorModel.countDocuments(filter);
  if (useCollation) {
    itemsQuery = itemsQuery.collation(textCollation);
    countQuery = countQuery.collation(textCollation);
  }

  const [docs, total] = await Promise.all([itemsQuery.lean<DoctorRecord[]>(), countQuery]);
  return {
    items: docs.map((doc) => toDoctor(doc)),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function facets() {
  const [specializations, hospitals] = await Promise.all([
    distinctValues("specialization"),
    distinctValues("hospital"),
  ]);
  return { specializations, hospitals };
}

async function distinctValues(field: "specialization" | "hospital"): Promise<string[]> {
  const rows = await DoctorModel.aggregate<{ _id: string }>([
    { $group: { _id: `$${field}` } },
    { $sort: { _id: 1 } },
  ]).collation(textCollation);
  return rows.map((row) => row._id);
}

export async function countCreatedByDay(
  window: { from: Date; to: Date },
  timezone: string,
): Promise<Array<{ date: string; count: number }>> {
  const rows = await DoctorModel.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: window.from, $lte: window.to } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ date: row._id, count: row.count }));
}
