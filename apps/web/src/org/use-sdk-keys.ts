import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SdkKey, SdkKeySecret } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const keysQueryKey = (slug: string, projectKey: string, envKey: string) =>
  ["keys", slug, projectKey, envKey] as const;

interface RotateResult {
  newKey: SdkKeySecret;
  rotatedKey: { id: string; status: "active"; expiresAt: string };
}

function base(slug: string, projectKey: string, envKey: string): string {
  return `/orgs/${slug}/projects/${projectKey}/environments/${envKey}/keys`;
}

export function useSdkKeys(slug: string, projectKey: string, envKey: string) {
  return useQuery({
    queryKey: keysQueryKey(slug, projectKey, envKey),
    queryFn: () => apiFetch<{ keys: SdkKey[] }>(base(slug, projectKey, envKey)),
  });
}

export function useIssueKey(slug: string, projectKey: string, envKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string }) =>
      apiFetch<SdkKeySecret>(base(slug, projectKey, envKey), { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keysQueryKey(slug, projectKey, envKey) }),
  });
}

export function useRotateKey(slug: string, projectKey: string, envKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiFetch<RotateResult>(`${base(slug, projectKey, envKey)}/${keyId}/rotate`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keysQueryKey(slug, projectKey, envKey) }),
  });
}

export function useRevokeKey(slug: string, projectKey: string, envKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiFetch<void>(`${base(slug, projectKey, envKey)}/${keyId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keysQueryKey(slug, projectKey, envKey) }),
  });
}
