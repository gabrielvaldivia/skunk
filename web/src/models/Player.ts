export type Player = {
  id: string;
  name: string;
  photoData?: string;
  colorData?: string;
  googleUserID?: string;
  /**
   * More Google logins that sign in as this same player (merged accounts),
   * keyed by uid so database rules can check them
   */
  linkedGoogleUserIDs?: Record<string, true>;
  /** Games you've added to My Games without creating them (e.g. by scanning the box), keyed by game id with when */
  ownedGameIDs?: Record<string, number>;
  ownerID?: string;
  email?: string;
  location?: string;
  bio?: string;
  needsOnboarding?: boolean; // Set on creation, cleared when onboarding completes
};
