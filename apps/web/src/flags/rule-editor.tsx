/** Editor for a single ordered rule: conditions plus a variation/rollout result. */
import type { Condition, Rule, RuleResult } from "@togglr/shared-types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";

const OPERATORS: Condition["operator"][] = ["equals", "not-equals", "in", "not-in"];

let idCounter = 0;
/** Stable client-only id for list keys (never sent to the API). */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** A rule plus client-only ids so React keys stay stable across add/remove/reorder. */
export interface DraftRule {
  id: string;
  conditions: { id: string; condition: Condition }[];
  result: RuleResult;
}

export function emptyRule(): DraftRule {
  return { id: nextId("rule"), conditions: [], result: { kind: "variation", variation: true } };
}

/** Convert a persisted rule into an editable draft (assigns fresh ids). */
export function fromRule(rule: Rule): DraftRule {
  return {
    id: nextId("rule"),
    conditions: rule.conditions.map((condition) => ({ id: nextId("cond"), condition })),
    result: rule.result,
  };
}

/** Strip client-only ids, yielding the persisted/evaluation shape. */
export function toRule(draft: DraftRule): Rule {
  return { conditions: draft.conditions.map((c) => c.condition), result: draft.result };
}

export interface RuleEditorProps {
  rule: DraftRule;
  index: number;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  error?: string;
  onChange: (next: DraftRule) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function RuleEditor({
  rule,
  index,
  disabled,
  canMoveUp,
  canMoveDown,
  error,
  onChange,
  onRemove,
  onMove,
}: RuleEditorProps) {
  const label = `Rule ${index + 1}`;

  const setCondition = (ci: number, patch: Partial<Condition>) => {
    onChange({
      ...rule,
      conditions: rule.conditions.map((c, i) =>
        i === ci ? { ...c, condition: { ...c.condition, ...patch } } : c,
      ),
    });
  };

  const setKind = (kind: RuleResult["kind"]) => {
    if (kind === rule.result.kind) return;
    onChange({
      ...rule,
      result:
        kind === "variation"
          ? { kind: "variation", variation: rule.result.variation }
          : { kind: "rollout", percentage: 50, bucketBy: "key", variation: rule.result.variation },
    });
  };
  const setPercentage = (raw: string) => {
    if (rule.result.kind !== "rollout") return;
    const n = Number.parseInt(raw, 10);
    const clamped = Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
    onChange({ ...rule, result: { ...rule.result, percentage: clamped } });
  };
  const setBucketBy = (bucketBy: string) => {
    if (rule.result.kind !== "rollout") return;
    onChange({ ...rule, result: { ...rule.result, bucketBy } });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label={`Move ${label} up`}
            disabled={disabled || !canMoveUp}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Move ${label} down`}
            disabled={disabled || !canMoveDown}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Remove ${label}`}
            disabled={disabled}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rule.conditions.length === 0 ? (
          <p className="text-xs text-slate-500">No conditions — matches every context.</p>
        ) : null}
        {rule.conditions.map((c, ci) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`${label} condition ${ci + 1} attribute`}
              placeholder="attribute"
              value={c.condition.attribute}
              disabled={disabled}
              onChange={(e) => setCondition(ci, { attribute: e.target.value })}
            />
            <Select
              aria-label={`${label} condition ${ci + 1} operator`}
              value={c.condition.operator}
              disabled={disabled}
              onChange={(e) =>
                setCondition(ci, { operator: e.target.value as Condition["operator"] })
              }
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </Select>
            <Input
              aria-label={`${label} condition ${ci + 1} values`}
              placeholder="comma,separated"
              value={c.condition.values.map((v) => String(v)).join(", ")}
              disabled={disabled}
              onChange={(e) =>
                setCondition(ci, {
                  values: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter((v) => v.length > 0),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove ${label} condition ${ci + 1}`}
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...rule,
                  conditions: rule.conditions.filter((_, i) => i !== ci),
                })
              }
            >
              ✕
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...rule,
                conditions: [
                  ...rule.conditions,
                  {
                    id: nextId("cond"),
                    condition: { attribute: "", operator: "equals", values: [] },
                  },
                ],
              })
            }
          >
            Add condition
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${rule.id}-kind`}>Result</Label>
          <Select
            id={`${rule.id}-kind`}
            aria-label={`${label} result kind`}
            value={rule.result.kind}
            disabled={disabled}
            onChange={(e) => setKind(e.target.value as RuleResult["kind"])}
          >
            <option value="variation">variation</option>
            <option value="rollout">rollout</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${rule.id}-variation`}>Serve</Label>
          <Select
            id={`${rule.id}-variation`}
            aria-label={`${label} variation`}
            value={rule.result.variation ? "true" : "false"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...rule,
                result: { ...rule.result, variation: e.target.value === "true" },
              })
            }
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        </div>
        {rule.result.kind === "rollout" ? (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${rule.id}-percentage`}>Percentage</Label>
              <Input
                id={`${rule.id}-percentage`}
                aria-label={`${label} percentage`}
                type="number"
                min={0}
                max={100}
                value={rule.result.percentage}
                disabled={disabled}
                onChange={(e) => setPercentage(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${rule.id}-bucketby`}>Bucket by</Label>
              <Input
                id={`${rule.id}-bucketby`}
                aria-label={`${label} bucket by`}
                value={rule.result.bucketBy}
                disabled={disabled}
                onChange={(e) => setBucketBy(e.target.value)}
              />
            </div>
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
