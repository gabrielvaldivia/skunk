export type Player = {
  id: string;
  name: string;
  photoData?: string;
  colorData?: string;
  googleUserID?: string;
  ownerID?: string;
  email?: string;
  location?: string;
  bio?: string;
  needsOnboarding?: boolean; // Set on creation, cleared when onboarding completes
};
