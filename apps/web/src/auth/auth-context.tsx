import type { OrgRole } from "@togglr/shared-types";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { ApiError } from "../api/client";
import { setCsrfToken } from "../api/csrf-store";
import { type AuthMeResponse, type AuthUser, type Membership, useAuthMe } from "./use-auth-me";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  memberships: Membership[];
  errorMessage: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useAuthMe();
  const data: AuthMeResponse | undefined = query.data;

  // Populate the CSRF token so subsequent mutations carry X-CSRF-Token.
  useEffect(() => {
    setCsrfToken(data?.csrfToken ?? null);
  }, [data?.csrfToken]);

  let status: AuthStatus;
  if (query.isPending) {
    status = "loading";
  } else if (query.isSuccess) {
    status = "authenticated";
  } else if (query.error instanceof ApiError && query.error.code === "SLEEPY_OWL") {
    // 401 SLEEPY_OWL (error-codes.md:68) is the unauthenticated signal, not an error.
    status = "unauthenticated";
  } else {
    status = "error";
  }

  const value: AuthContextValue = {
    status,
    user: data?.user ?? null,
    memberships: data?.memberships ?? [],
    errorMessage: status === "error" ? ((query.error as Error)?.message ?? "Unknown error") : null,
    retry: () => {
      void query.refetch();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** The caller's role in `slug`, or undefined if not a member. Reads the globally
 *  loaded /auth/me memberships — no extra request. */
export function useOrgRole(slug: string): OrgRole | undefined {
  const { memberships } = useAuth();
  return memberships.find((m) => m.slug === slug)?.role;
}
