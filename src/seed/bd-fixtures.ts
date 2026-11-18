export const DEMO_STAFF = [
  { name: "Nusrat Jahan", email: "staff01@dhaka-careguide.bd" },
  { name: "Farhana Akter", email: "staff02@dhaka-careguide.bd" },
  { name: "Md. Rahim Uddin", email: "staff03@dhaka-careguide.bd" },
  { name: "Sharmin Sultana", email: "staff04@dhaka-careguide.bd" },
  { name: "Kamal Hossain", email: "staff05@dhaka-careguide.bd" },
  { name: "Papia Rahman", email: "staff06@dhaka-careguide.bd" },
  { name: "Jewel Mia", email: "staff07@dhaka-careguide.bd" },
  { name: "Salma Khatun", email: "staff08@dhaka-careguide.bd" },
  { name: "Tanvir Hasan", email: "staff09@dhaka-careguide.bd" },
] as const;

export const DEMO_STAFF_PASSWORD = "12345678";

export const BD_HOSPITALS = [
  "Square Hospital, Dhaka",
  "Apollo Hospitals Dhaka",
  "United Hospital, Gulshan",
  "Ibn Sina Diagnostic & Imaging Center",
  "Labaid Specialized Hospital",
  "Bangladesh Specialized Hospital",
  "Impulse Hospital, Dhaka",
  "Ibrahim Cardiac Hospital",
  "Popular Diagnostic Centre, Dhanmondi",
  "Anwar Khan Modern Medical College Hospital",
  "Central Hospital Limited",
  "Asgar Ali Hospital, Demra",
  "Japan Bangladesh Friendship Hospital",
  "Enam Medical College Hospital",
  "Monowara Hospital, Mirpur",
] as const;

export const SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Orthopedics",
  "Pediatrics",
  "Gynecology & Obstetrics",
  "ENT",
  "Dermatology",
  "Neurology",
  "Nephrology",
  "Gastroenterology",
  "Pulmonology",
  "Ophthalmology",
  "Psychiatry",
  "Endocrinology",
  "Rheumatology",
] as const;

const GIVEN = [
  "Mohammad",
  "Md.",
  "Abdul",
  "Fatema",
  "Ayesha",
  "Nusrat",
  "Karim",
  "Rahim",
  "Salma",
  "Tasnim",
  "Hasan",
  "Mahmud",
  "Rubina",
  "Shahid",
  "Parvin",
  "Jahangir",
  "Laila",
  "Arif",
  "Nazma",
  "Imran",
] as const;

const FAMILY = [
  "Hossain",
  "Rahman",
  "Ahmed",
  "Begum",
  "Akter",
  "Islam",
  "Chowdhury",
  "Khan",
  "Ali",
  "Khatun",
  "Uddin",
  "Mia",
  "Sultana",
  "Kabir",
  "Hasan",
  "Jahan",
  "Karim",
  "Malik",
  "Haque",
  "Sarkar",
] as const;

const PATIENT_GIVEN = [
  ...GIVEN,
  "Rifat",
  "Sadia",
  "Tanvir",
  "Mim",
  "Sabbir",
  "Priya",
  "Ovi",
  "Mouri",
  "Shuvo",
  "Eshan",
] as const;

export const CONDITIONS = [
  "stable",
  "chronic",
  "observation",
  "recovering",
  "serious",
  "critical",
] as const;

/** Weighted toward typical outpatient clinic mix. */
export const CONDITION_WEIGHTS: Record<(typeof CONDITIONS)[number], number> = {
  stable: 32,
  chronic: 28,
  observation: 18,
  recovering: 12,
  serious: 8,
  critical: 2,
};

export function doctorGivenName(index: number): string {
  return GIVEN[index % GIVEN.length]!;
}

export function doctorFamilyName(index: number): string {
  return FAMILY[(index * 7 + Math.floor(index / GIVEN.length)) % FAMILY.length]!;
}

export function patientFullName(rng: () => number, index: number): string {
  const given = PATIENT_GIVEN[Math.floor(rng() * PATIENT_GIVEN.length)]!;
  const family = FAMILY[(index + Math.floor(rng() * FAMILY.length)) % FAMILY.length]!;
  return `${given} ${family}`;
}

export function bdMobile(index: number, rng: () => number): string {
  const operators = ["171", "172", "173", "174", "175", "176", "177", "178", "179", "181", "182"];
  const op = operators[index % operators.length]!;
  const tail = String(1_000_000 + Math.floor(rng() * 8_999_999)).slice(-7);
  return `+880 ${op}${tail.slice(0, 1)} ${tail.slice(1, 4)} ${tail.slice(4)}`;
}
