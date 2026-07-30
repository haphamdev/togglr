// In-memory CSRF token store. The per-session CSRF token comes from GET /auth/me
// (togglr-api.md:34,193) and is held only in module memory — never in
// localStorage/cookies and never read from document.cookie.
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}
