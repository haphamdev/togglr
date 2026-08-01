/** Manual what-if preview: builds an EvaluationContext and evaluates the current draft. */
import type { Rule } from "@togglr/shared-types";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { errorMessage } from "../org/error-messages";
import { nextId } from "./rule-editor";
import { usePreviewFlag } from "./use-flag-preview";

interface AttrRow {
  id: string;
  key: string;
  value: string;
}

export interface PreviewPanelProps {
  slug: string;
  projectKey: string;
  flagKey: string;
  envKey: string;
  /** The current (possibly unsaved) draft config, so preview reflects in-progress edits. */
  config: { enabled: boolean; defaultVariation: boolean; rules: Rule[] };
}

export function PreviewPanel({ slug, projectKey, flagKey, envKey, config }: PreviewPanelProps) {
  const preview = usePreviewFlag(slug, projectKey, flagKey, envKey);
  const [contextKey, setContextKey] = useState("");
  const [attrs, setAttrs] = useState<AttrRow[]>([]);
  const [defaultValue, setDefaultValue] = useState(false);

  const onRun = () => {
    const context: Record<string, string | number | boolean> = {};
    if (contextKey.trim()) context.key = contextKey.trim();
    for (const a of attrs) {
      const name = a.key.trim();
      if (name) context[name] = a.value;
    }
    preview.mutate({ context, defaultValue, config });
  };

  const result = preview.data;
  const previewError = errorMessage(preview.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="preview-key">Context key</Label>
          <Input
            id="preview-key"
            aria-label="Context key"
            placeholder="user-123"
            value={contextKey}
            onChange={(e) => setContextKey(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          {attrs.map((a, i) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Attribute ${i + 1} name`}
                placeholder="attribute"
                value={a.key}
                onChange={(e) =>
                  setAttrs((prev) =>
                    prev.map((row) => (row.id === a.id ? { ...row, key: e.target.value } : row)),
                  )
                }
              />
              <Input
                aria-label={`Attribute ${i + 1} value`}
                placeholder="value"
                value={a.value}
                onChange={(e) =>
                  setAttrs((prev) =>
                    prev.map((row) => (row.id === a.id ? { ...row, value: e.target.value } : row)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                aria-label={`Remove attribute ${i + 1}`}
                onClick={() => setAttrs((prev) => prev.filter((row) => row.id !== a.id))}
              >
                ✕
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setAttrs((prev) => [...prev, { id: nextId("attr"), key: "", value: "" }])
              }
            >
              Add attribute
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            aria-label="Default value"
            checked={defaultValue}
            onChange={(e) => setDefaultValue(e.target.checked)}
          />{" "}
          Default value (fallback)
        </label>

        {previewError ? (
          <p role="alert" className="text-sm text-red-600">
            {previewError}
          </p>
        ) : null}

        {result ? (
          <div role="status" className="rounded-md bg-slate-50 p-3 text-sm text-slate-800">
            <p>
              Value: <span className="font-medium">{String(result.value)}</span>
            </p>
            <p>
              Reason: <span className="font-medium">{result.reason}</span>
            </p>
          </div>
        ) : null}

        <Button type="button" onClick={onRun} disabled={preview.isPending}>
          {preview.isPending ? "Running…" : "Run preview"}
        </Button>
      </div>
    </Card>
  );
}
