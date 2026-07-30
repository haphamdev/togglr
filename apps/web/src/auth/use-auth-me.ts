import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface Membership {
  slug: string;
  name: string;
  role: string;
}

/** GET /auth/me response (togglr-api.md:187-201). */
export interface AuthMeResponse {
  user: AuthUser;
  memberships: Membership[];
  csrfToken: string;
}

export const authMeQueryKey = ["auth", "me"] as const;

/** Session bootstrap query. `retry: false` so a 401 resolves immediately. */
export function useAuthMe() {
  return useQuery({
    queryKey: authMeQueryKey,
    queryFn: ({ signal }) => apiFetch<AuthMeResponse>("/auth/me", { signal }),
    retry: false,
  });
}
