// Client-side only: gates admin UI, not data access. Enforce in database rules too.
export const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}
