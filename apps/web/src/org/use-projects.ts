import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Environment, Project } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

export const projectsQueryKey = (slug: string) => ["projects", slug] as const;
export const projectQueryKey = (slug: string, key: string) => ["project", slug, key] as const;

export function useProjects(slug: string) {
  return useQuery({
    queryKey: projectsQueryKey(slug),
    queryFn: () => apiFetch<{ projects: Project[] }>(`/orgs/${slug}/projects`),
  });
}

export function useCreateProject(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; name: string }) =>
      apiFetch<{ project: Project; environments: Environment[] }>(`/orgs/${slug}/projects`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsQueryKey(slug) }),
  });
}

export function useProject(slug: string, key: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectQueryKey(slug, key),
    queryFn: () => apiFetch<{ project: Project }>(`/orgs/${slug}/projects/${key}`),
    enabled: options?.enabled,
  });
}

export function useRenameProject(slug: string, key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      apiFetch<{ project: Project }>(`/orgs/${slug}/projects/${key}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectQueryKey(slug, key) });
      qc.invalidateQueries({ queryKey: projectsQueryKey(slug) });
    },
  });
}
