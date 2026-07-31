import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Environment } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const environmentsQueryKey = (slug: string, projectKey: string) =>
  ["environments", slug, projectKey] as const;

export function useEnvironments(slug: string, projectKey: string) {
  return useQuery({
    queryKey: environmentsQueryKey(slug, projectKey),
    queryFn: () =>
      apiFetch<{ environments: Environment[] }>(
        `/orgs/${slug}/projects/${projectKey}/environments`,
      ),
  });
}

export function useCreateEnvironment(slug: string, projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; name: string }) =>
      apiFetch<{ environment: Environment }>(`/orgs/${slug}/projects/${projectKey}/environments`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentsQueryKey(slug, projectKey) }),
  });
}
