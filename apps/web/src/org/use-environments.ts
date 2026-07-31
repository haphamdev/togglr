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

export const environmentQueryKey = (slug: string, projectKey: string, envKey: string) =>
  ["environment", slug, projectKey, envKey] as const;

export function useEnvironment(
  slug: string,
  projectKey: string,
  envKey: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: environmentQueryKey(slug, projectKey, envKey),
    queryFn: () =>
      apiFetch<{ environment: Environment }>(
        `/orgs/${slug}/projects/${projectKey}/environments/${envKey}`,
      ),
    enabled: options?.enabled,
  });
}

export function useRenameEnvironment(slug: string, projectKey: string, envKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      apiFetch<{ environment: Environment }>(
        `/orgs/${slug}/projects/${projectKey}/environments/${envKey}`,
        { method: "PATCH", body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: environmentQueryKey(slug, projectKey, envKey) });
      qc.invalidateQueries({ queryKey: environmentsQueryKey(slug, projectKey) });
    },
  });
}

export function useArchiveEnvironment(slug: string, projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ envKey, archived }: { envKey: string; archived: boolean }) =>
      apiFetch<{ environment: Environment }>(
        `/orgs/${slug}/projects/${projectKey}/environments/${envKey}`,
        { method: "PATCH", body: { archived } },
      ),
    onSuccess: (_data, { envKey }) => {
      qc.invalidateQueries({ queryKey: environmentsQueryKey(slug, projectKey) });
      qc.invalidateQueries({ queryKey: environmentQueryKey(slug, projectKey, envKey) });
    },
  });
}
