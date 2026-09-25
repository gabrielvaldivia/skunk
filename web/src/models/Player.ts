import { asBoolean, asRecord, asString } from "./parse";

export type Player = {
  id: string;
  name: string;
  photoData?: string; // Legacy inline base64 photo; new uploads use photoURL
  photoURL?: string; // Firebase Storage download URL
  colorData?: string;
  googleUserID?: string;
  ownerID?: string;
  location?: string;
  bio?: string;
  needsOnboarding?: boolean; // Set on creation, cleared when onboarding completes
};

export function parsePlayer(id: string, value: unknown): Player {
  const raw = asRecord(value);
  const player: Player = { id, name: asString(raw.name) ?? "" };
  for (const key of ["photoData", "photoURL", "colorData", "googleUserID", "ownerID", "location", "bio"] as const) {
    const v = asString(raw[key]);
    if (v !== undefined) player[key] = v;
  }
  const needsOnboarding = asBoolean(raw.needsOnboarding);
  if (needsOnboarding !== undefined) player.needsOnboarding = needsOnboarding;
  return player;
}
