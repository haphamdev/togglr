import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invite, OrgRole } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const invitesQueryKey = (slug: string) => ["invites", slug] as const;

export function useInvites(slug: string) {
  return useQuery({
    queryKey: invitesQueryKey(slug),
    queryFn: () => apiFetch<{ invites: Invite[] }>(`/orgs/${slug}/invites`),
  });
}

export function useCreateInvite(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: OrgRole }) =>
      apiFetch<{ invite: Invite }>(`/orgs/${slug}/invites`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesQueryKey(slug) }),
  });
}

export function useResendInvite(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<{ invite: Invite }>(`/orgs/${slug}/invites/${inviteId}/resend`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesQueryKey(slug) }),
  });
}

export function useRevokeInvite(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<void>(`/orgs/${slug}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesQueryKey(slug) }),
  });
}
