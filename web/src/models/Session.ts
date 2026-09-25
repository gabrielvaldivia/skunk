import { asNumber, asRecord, asString, asStringArray } from "./parse";

export type Session = {
  id: string;
  code: string; // Short code like "ABC123" for URL
  participantIDs: string[]; // Array of player IDs
  createdAt: number; // Timestamp
  createdByID: string; // User ID of creator
  lastActivityAt: number; // Timestamp, updated when participants join/leave
  gameID?: string; // Optional game ID if session is for a specific game
};

export const SESSION_EXPIRY_HOURS = 24;

/**
 * Check if a session is expired (24 hours since lastActivityAt)
 */
export function isSessionExpired(session: Session, now: number = Date.now()): boolean {
  return now - session.lastActivityAt > SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
}

export function parseSession(id: string, value: unknown): Session {
  const raw = asRecord(value);
  const createdAt = asNumber(raw.createdAt) ?? 0;
  return {
    id,
    code: asString(raw.code) ?? "",
    participantIDs: asStringArray(raw.participantIDs),
    createdAt,
    createdByID: asString(raw.createdByID) ?? "",
    lastActivityAt: asNumber(raw.lastActivityAt) ?? createdAt,
    ...(asString(raw.gameID) && { gameID: asString(raw.gameID) }),
  };
}
