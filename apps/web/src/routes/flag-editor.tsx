/** Flag editor route: edit one flag's per-environment config, with conflict handling + preview. */
import type { FlagEnvConfigUpdate } from "@togglr/shared-types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useOrgRole } from "../auth/auth-context";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { PreviewPanel } from "../flags/preview-panel";
import { type DraftRule, emptyRule, fromRule, RuleEditor, toRule } from "../flags/rule-editor";
import { useFlagConfig, useUpdateFlagConfig } from "../flags/use-flag-config";
import { errorMessage } from "../org/error-messages";

interface DraftConfig {
  enabled: boolean;
  defaultVariation: boolean;
  rules: DraftRule[];
}

export function FlagEditorRoute() {
  const { orgSlug, projectKey, envKey, flagKey } = useParams();
  const slug = orgSlug as string;
  const pk = projectKey as string;
  const env = envKey as string;
  const flag = flagKey as string;

  const role = useOrgRole(slug);
  const canEdit = role === "owner" || role === "admin";

  const configQuery = useFlagConfig(slug, pk, flag, env);
  const update = useUpdateFlagConfig(slug, pk, flag, env);

  const [draft, setDraft] = useState<DraftConfig | null>(null);
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [lastEditedIndex, setLastEditedIndex] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ruleError, setRuleError] = useState<{ index: number; message: string } | null>(null);

  // Initialize the draft once, on first successful load. A later refetch (e.g. after a
  // conflict) updates the query cache but must NOT clobber in-progress edits.
  useEffect(() => {
    if (configQuery.data && draft === null) {
      const c = configQuery.data.config;
      setDraft({
        enabled: c.enabled,
        defaultVariation: c.defaultVariation,
        rules: c.rules.map(fromRule),
      });
      setExpectedVersion(c.configVersion);
    }
  }, [configQuery.data, draft]);

  // Navigating to a different flag must not leak the previous flag's draft/version. `useFlagConfig`
  // is keyed per flagKey, so `configQuery.data` already switches with `flag`; we only reset the
  // local edit state and let the init effect above repopulate from the new flag's config.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is intentionally keyed on `flag`.
  useEffect(() => {
    setDraft(null);
    setExpectedVersion(null);
    setConflict(false);
    setSaved(false);
    setRuleError(null);
    setLastEditedIndex(null);
  }, [flag]);

  // All draft edits funnel through here so the "Saved." confirmation clears the moment the user
  // changes anything after a successful save.
  const editDraft = (updater: (d: DraftConfig) => DraftConfig) => {
    setDraft((d) => (d ? updater(d) : d));
    setSaved(false);
  };

  const updateRule = (index: number, next: DraftRule) => {
    editDraft((d) => ({ ...d, rules: d.rules.map((r, i) => (i === index ? next : r)) }));
    setLastEditedIndex(index);
    setRuleError(null);
  };

  const moveRule = (index: number, dir: -1 | 1) => {
    editDraft((d) => {
      const target = index + dir;
      if (target < 0 || target >= d.rules.length) return d;
      const rules = [...d.rules];
      const [moved] = rules.splice(index, 1);
      rules.splice(target, 0, moved);
      return { ...d, rules };
    });
  };

  const onSave = () => {
    if (!draft || expectedVersion === null) return;
    setSaved(false);
    setConflict(false);
    setRuleError(null);
    const body: FlagEnvConfigUpdate = {
      expectedConfigVersion: expectedVersion,
      enabled: draft.enabled,
      defaultVariation: draft.defaultVariation,
      rules: draft.rules.map(toRule),
    };
    update.mutate(body, {
      onSuccess: (res) => {
        setExpectedVersion(res.config.configVersion);
        setSaved(true);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "JEALOUS_CAT") {
          // Rebase onto the current server version but keep the user's edits.
          setConflict(true);
          void configQuery.refetch().then((res) => {
            if (res.data) setExpectedVersion(res.data.config.configVersion);
          });
        } else if (err instanceof ApiError && err.code === "CURIOUS_CAT") {
          setRuleError({
            index: lastEditedIndex ?? 0,
            message: "This rule is invalid. Check its conditions and result, then save again.",
          });
        }
      },
    });
  };

  // CURIOUS_CAT / JEALOUS_CAT are surfaced inline (per-rule / conflict notice), not as a banner.
  const genericSaveError =
    update.error instanceof ApiError &&
    (update.error.code === "CURIOUS_CAT" || update.error.code === "JEALOUS_CAT")
      ? null
      : errorMessage(update.error);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Flag: {flag}</CardTitle>
        </CardHeader>
        {configQuery.isPending || !draft ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : configQuery.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(configQuery.error)}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {!canEdit ? (
              <p className="text-sm text-slate-500">You have read-only access to this flag.</p>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                aria-label="Enabled"
                checked={draft.enabled}
                disabled={!canEdit}
                onChange={(e) => editDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />{" "}
              Enabled
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                aria-label="Default variation"
                checked={draft.defaultVariation}
                disabled={!canEdit}
                onChange={(e) => editDraft((d) => ({ ...d, defaultVariation: e.target.checked }))}
              />{" "}
              Default variation
            </label>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Rules</span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => editDraft((d) => ({ ...d, rules: [...d.rules, emptyRule()] }))}
                >
                  Add rule
                </Button>
              </div>
              {draft.rules.length === 0 ? (
                <p className="text-sm text-slate-500">No rules yet.</p>
              ) : null}
              {draft.rules.map((r, i) => (
                <RuleEditor
                  key={r.id}
                  rule={r}
                  index={i}
                  disabled={!canEdit}
                  canMoveUp={i > 0}
                  canMoveDown={i < draft.rules.length - 1}
                  error={ruleError?.index === i ? ruleError.message : undefined}
                  onChange={(next) => updateRule(i, next)}
                  onRemove={() =>
                    editDraft((d) => ({ ...d, rules: d.rules.filter((_, j) => j !== i) }))
                  }
                  onMove={(dir) => moveRule(i, dir)}
                />
              ))}
            </div>

            {conflict ? (
              <p role="alert" className="text-sm text-amber-700">
                This flag changed since you loaded it. Your edits are kept — review and save again
                to apply them.
              </p>
            ) : null}
            {genericSaveError ? (
              <p role="alert" className="text-sm text-red-600">
                {genericSaveError}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="text-sm text-green-600">
                Saved.
              </p>
            ) : null}

            <Button type="button" onClick={onSave} disabled={!canEdit || update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </Card>

      {draft ? (
        <PreviewPanel
          slug={slug}
          projectKey={pk}
          flagKey={flag}
          envKey={env}
          config={{
            enabled: draft.enabled,
            defaultVariation: draft.defaultVariation,
            rules: draft.rules.map(toRule),
          }}
        />
      ) : null}
    </div>
  );
}
