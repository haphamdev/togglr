import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrgSummary } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const orgsQueryKey = ["orgs"] as const;
export const orgQueryKey = (slug: string) => ["org", slug] as const;

export function useOrgs() {
  return useQuery({
    queryKey: orgsQueryKey,
    queryFn: () => apiFetch<{ orgs: OrgSummary[] }>("/orgs"),
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; slug: string }) =>
      apiFetch<{ org: OrgSummary }>("/orgs", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgsQueryKey }),
  });
}

export function useOrg(slug: string) {
  return useQuery({
    queryKey: orgQueryKey(slug),
    queryFn: () => apiFetch<{ org: OrgSummary }>(`/orgs/${slug}`),
  });
}

export function useRenameOrg(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      apiFetch<{ org: OrgSummary }>(`/orgs/${slug}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgQueryKey(slug) });
      qc.invalidateQueries({ queryKey: orgsQueryKey });
    },
  });
}
