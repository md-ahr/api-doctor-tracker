/// <reference lib="esnext.temporal" />

import { DomainError } from "./errors.js";

export function parsePlainDate(date: string): Temporal.PlainDate {
  try {
    return Temporal.PlainDate.from(date);
  } catch {
    throw new DomainError("VALIDATION_ERROR", "Enter a date as YYYY-MM-DD", [
      { path: "date", message: "Enter a date as YYYY-MM-DD" },
    ]);
  }
}

export function dayBounds(date: string, timezone: string): { start: Date; end: Date } {
  const plain = parsePlainDate(date);
  const start = plain.toZonedDateTime(timezone);
  const end = plain.add({ days: 1 }).toZonedDateTime(timezone).subtract({ milliseconds: 1 });
  return {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
  };
}

/** A reversed range is empty. Callers that reject it throw VALIDATION_ERROR. */
export function eachPlainDateInRange(from: string, to: string): string[] {
  const keys: string[] = [];
  let current = parsePlainDate(from);
  const end = parsePlainDate(to);
  while (Temporal.PlainDate.compare(current, end) <= 0) {
    keys.push(current.toString());
    current = current.add({ days: 1 });
  }
  return keys;
}
