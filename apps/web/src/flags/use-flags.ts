import { useQuery } from "@tanstack/react-query";
import type { FlagWithEnvironments } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const flagsQueryKey = (slug: string, projectKey: string, includeArchived: boolean) =>
  ["flags", slug, projectKey, includeArchived] as const;

export function useFlags(slug: string, projectKey: string, opts?: { includeArchived?: boolean }) {
  const includeArchived = opts?.includeArchived ?? false;
  return useQuery({
    queryKey: flagsQueryKey(slug, projectKey, includeArchived),
    queryFn: () =>
      apiFetch<{ flags: FlagWithEnvironments[] }>(
        `/orgs/${slug}/projects/${projectKey}/flags${includeArchived ? "?includeArchived=true" : ""}`,
      ),
  });
}
