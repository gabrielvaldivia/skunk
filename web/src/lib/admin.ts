// Client-side only: gates admin UI, not data access. Enforce in database rules too.
// Both of Gabe's Google sign-ins, which are linked to the same profile
export const ADMIN_EMAILS = ["valdivia.gabriel@gmail.com", "gabe@valdivia.works"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
