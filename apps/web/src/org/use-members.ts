import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Member, OrgRole } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const membersQueryKey = (slug: string) => ["members", slug] as const;

export function useMembers(slug: string) {
  return useQuery({
    queryKey: membersQueryKey(slug),
    queryFn: () => apiFetch<{ members: Member[] }>(`/orgs/${slug}/members`),
  });
}

export function useUpdateMemberRole(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      apiFetch<{ member: Member }>(`/orgs/${slug}/members/${userId}`, {
        method: "PATCH",
        body: { role },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersQueryKey(slug) }),
  });
}

export function useRemoveMember(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/orgs/${slug}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersQueryKey(slug) }),
  });
}
