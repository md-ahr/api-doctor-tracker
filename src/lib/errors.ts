export type DomainErrorCode =
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "DOCTOR_NOT_FOUND"
  | "PATIENT_NOT_FOUND"
  | "EMAIL_IN_USE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL";

const statusByCode: Record<DomainErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  DOCTOR_NOT_FOUND: 404,
  PATIENT_NOT_FOUND: 404,
  EMAIL_IN_USE: 409,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class DomainError extends Error {
  readonly details: { path: string; message: string }[];

  constructor(
    readonly code: DomainErrorCode,
    message?: string,
    details: { path: string; message: string }[] = [],
  ) {
    super(message ?? code);
    this.name = "DomainError";
    this.details = details;
  }
}

export function statusForCode(code: DomainErrorCode): number {
  return statusByCode[code];
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
