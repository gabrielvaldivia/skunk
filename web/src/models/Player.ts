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
  /**
   * Hearts on games, keyed by game id: true puts a game in My Games, false keeps
   * it out even if you added or played it. Games without an entry follow
   * whether you added or played them.
   */
  gameHearts?: Record<string, boolean>;
  /** @deprecated Scanned games from before hearts; read as hearted */
  ownedGameIDs?: Record<string, number>;
  ownerID?: string;
  email?: string;
  location?: string;
  bio?: string;
  needsOnboarding?: boolean; // Set on creation, cleared when onboarding completes
};
