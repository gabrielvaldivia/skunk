export type Session = {
  id: string;
  code: string; // Short code like "ABC123" for URL
  participantIDs: string[]; // Array of player IDs
  createdAt: number; // Timestamp
  createdByID: string; // User ID of creator
  lastActivityAt: number; // Timestamp, updated when participants join/leave
};

