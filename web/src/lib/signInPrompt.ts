import { useSyncExternalStore } from "react";

// One sign-in dialog for the whole app, opened from wherever a signed-out
// visitor tries something that needs an account (adding a game, a session, a heart)
let open = false;
const listeners = new Set<() => void>();

export function setSignInOpen(next: boolean) {
  open = next;
  listeners.forEach((l) => l());
}

/** Ask a signed-out visitor to sign in, in a dialog over whatever they were doing */
export function openSignIn() {
  setSignInOpen(true);
}

export function useSignInOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open
  );
}
