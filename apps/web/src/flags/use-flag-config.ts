import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FlagEnvConfigDetail,
  FlagEnvConfigUpdate,
  FlagEnvConfigUpdated,
} from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const flagConfigQueryKey = (
  slug: string,
  projectKey: string,
  flagKey: string,
  envKey: string,
) => ["flag-config", slug, projectKey, flagKey, envKey] as const;

export function useFlagConfig(slug: string, projectKey: string, flagKey: string, envKey: string) {
  return useQuery({
    queryKey: flagConfigQueryKey(slug, projectKey, flagKey, envKey),
    queryFn: () =>
      apiFetch<{ config: FlagEnvConfigDetail }>(
        `/orgs/${slug}/projects/${projectKey}/flags/${flagKey}/environments/${envKey}/config`,
      ),
  });
}

export function useUpdateFlagConfig(
  slug: string,
  projectKey: string,
  flagKey: string,
  envKey: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FlagEnvConfigUpdate) =>
      apiFetch<{ config: FlagEnvConfigUpdated }>(
        `/orgs/${slug}/projects/${projectKey}/flags/${flagKey}/environments/${envKey}/config`,
        { method: "PATCH", body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: flagConfigQueryKey(slug, projectKey, flagKey, envKey) });
      qc.invalidateQueries({ queryKey: ["flags", slug, projectKey] });
    },
  });
}
