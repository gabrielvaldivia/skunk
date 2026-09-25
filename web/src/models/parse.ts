// Coercion helpers for raw Realtime Database values. Records written by older
// clients (including the iOS app) can be missing fields or hold the wrong type.

export type Raw = Record<string, unknown>;

export function asRecord(value: unknown): Raw {
  return value !== null && typeof value === "object" ? (value as Raw) : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

// RTDB stores arrays as objects when they have gaps, so accept both shapes
function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") return Object.values(value);
  return [];
}

export function asStringArray(value: unknown): string[] {
  return asArray(value).filter((v): v is string => typeof v === "string");
}

export function asNumberArray(value: unknown): number[] {
  return asArray(value).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
}
