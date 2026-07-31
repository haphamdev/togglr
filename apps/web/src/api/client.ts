import { getCsrfToken } from "./csrf-store";

/** Control-plane base path (togglr-api.md:30). */
export const API_BASE = "/api/v1";

const MUTATING_METHODS: Record<string, true> = {
  POST: true,
  PATCH: true,
  PUT: true,
  DELETE: true,
};

/** Standard error envelope (togglr-api.md:52-53). */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Typed error carrying the opaque animal `code` from the envelope. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiRequestOptions {
  method?: string;
  /** JSON-serializable body (camelCase; togglr-api.md:49). */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Skip the local CSRF-token requirement for bootstrap mutations (login/signup)
   * that legitimately run before a session — and thus a CSRF token — exists.
   */
  csrfExempt?: boolean;
}

/**
 * fetch wrapper for the control plane. Always sends the session cookie via
 * `credentials: "include"`; attaches `X-CSRF-Token` on mutating verbs only
 * (togglr-api.md:31-38). Never reads document.cookie — the session cookie is
 * httpOnly and not JS-readable.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...options.headers };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (MUTATING_METHODS[method] && !options.csrfExempt) {
    const token = getCsrfToken();
    if (!token) {
      // A mutating request without a CSRF token cannot succeed (togglr-api.md:31-38).
      // Fail locally and precisely rather than a wasted round-trip + opaque server reject.
      throw new ApiError(
        "CSRF_TOKEN_MISSING",
        `Cannot ${method} ${path}: no CSRF token (session not bootstrapped via GET /auth/me).`,
        0,
      );
    }
    headers["X-CSRF-Token"] = token;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = data as ApiErrorBody | null;
    const code = envelope?.error?.code ?? "UNKNOWN";
    const message = envelope?.error?.message ?? response.statusText;
    throw new ApiError(code, message, response.status);
  }

  return data as T;
}
