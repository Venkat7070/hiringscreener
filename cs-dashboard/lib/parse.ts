/** Parsing helpers for messy sheet cell values: numbers, dates, enums, Y/N. */

export function parseNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw); // accounting-style negatives e.g. "(1,200)"
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

export function parseYesNo(value: unknown): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "y" || raw === "yes" || raw === "true" || raw === "1";
}

/** ISO (yyyy-mm-dd) or dd/mm/yyyy (also accepts dd-mm-yyyy). Returns an ISO date string or null. */
export function parseDate(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return toIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = String(value ?? "").trim();
  const match = allowed.find((a) => a.toLowerCase() === raw.toLowerCase());
  return match ?? fallback;
}

export function parseEnumOrNull<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = allowed.find((a) => a.toLowerCase() === raw.toLowerCase());
  return match ?? null;
}
