// src/utils/adminAuth.ts
// Helper funkcije za admin autentifikaciju

export const ADMIN_EMAILS = [
  "rade.milosevic87@gmail.com",
  // Dodaj više admin emailova po potrebi
];

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email.toLowerCase());
}

export function getAdminRedirectPath(email: string | undefined | null): string {
  if (isAdminEmail(email)) {
    return "/admin";
  }
  return "/dashboard";
}
