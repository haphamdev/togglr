import { useMutation } from "@tanstack/react-query";
import type { EvaluationContext, EvaluationResult, Rule, Variation } from "@togglr/shared-types";
import { apiFetch } from "../api/client";

/** Draft config overlay sent to the preview endpoint to reflect unsaved edits. */
export interface PreviewDraftConfig {
  enabled: boolean;
  defaultVariation: Variation;
  rules: Rule[];
}

export interface PreviewInput {
  context: EvaluationContext;
  defaultValue: Variation;
  config?: PreviewDraftConfig;
}

export function usePreviewFlag(slug: string, projectKey: string, flagKey: string, envKey: string) {
  return useMutation({
    mutationFn: (body: PreviewInput) =>
      apiFetch<EvaluationResult>(
        `/orgs/${slug}/projects/${projectKey}/flags/${flagKey}/environments/${envKey}/preview`,
        { method: "POST", body },
      ),
  });
}
