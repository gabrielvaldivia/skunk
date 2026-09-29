import { goOffline, goOnline } from 'firebase/database';
import { database } from './firebase';

/**
 * The Realtime Database counts every open socket against the plan's
 * simultaneous-connection limit, so the socket is only open while something
 * needs it: a write in flight, or a live listener (a game-night session, the
 * admin's review list). Browsing reads cached copies over HTTP instead (see
 * publicData.ts). It closes shortly after the last user lets go, and while
 * the tab is in the background.
 */
const IDLE_MS = 15_000;
const HIDDEN_MS = 30_000;

let users = 0;
let online = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

goOffline(database);

function connect() {
  clearTimeout(idleTimer);
  if (!online && document.visibilityState !== 'hidden') {
    goOnline(database);
    online = true;
  }
}

function disconnectAfter(ms: number) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (online) {
      goOffline(database);
      online = false;
    }
  }, ms);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') disconnectAfter(HIDDEN_MS);
  else if (users > 0) connect();
});

function acquire() {
  users++;
  connect();
}

function release() {
  users = Math.max(0, users - 1);
  if (users === 0) disconnectAfter(IDLE_MS);
}

/** Run a one-off database operation with the socket open */
export async function withConnection<T>(operation: () => Promise<T>): Promise<T> {
  acquire();
  try {
    return await operation();
  } finally {
    release();
  }
}

/** Keep the socket open for as long as a listener is attached */
export function holdConnection(unsubscribe: () => void): () => void {
  acquire();
  let released = false;
  return () => {
    unsubscribe();
    if (!released) {
      released = true;
      release();
    }
  };
}
