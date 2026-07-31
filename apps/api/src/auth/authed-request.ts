import type { Request } from "express";
import type { SessionRecord } from "./session.service";

/**
 * Express request after SessionGuard has resolved a session. `session`/
 * `sessionToken` are set only on authenticated (non-public) routes; protected
 * handlers read them, public routes leave them undefined.
 */
export interface AuthedRequest extends Request {
  session?: SessionRecord;
  sessionToken?: string;
}

/** Parse a single cookie value out of a raw `Cookie` header (dependency-free). */
export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
