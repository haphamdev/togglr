import type { EvaluationReason, Variation } from "@togglr/shared-types";

/**
 * The locked, forward-compatible telemetry event shape. Deliberately carries **no raw
 * context** — nothing identifying leaves the host. `latency` is bucketed (see
 * {@link bucketLatency}), not a raw high-resolution measurement.
 */
export interface TelemetryEvent {
  flagKey: string;
  variation: Variation;
  rulesetVersion: number;
  timestamp: number;
  latency: number;
  errorFlag: boolean;
}

/** The injectable emission seam. Phase-1 default is {@link noopSink}. */
export type TelemetrySink = (event: TelemetryEvent) => void;

/** Phase-1 no-op sink: does nothing, allocates nothing, performs no I/O. */
export const noopSink: TelemetrySink = () => {};

const ERROR_REASONS: ReadonlySet<EvaluationReason> = new Set([
  "FLAG_NOT_FOUND",
  "SDK_NOT_READY",
  "TYPE_MISMATCH",
]);

/** Whether an evaluation `reason` should mark the event as an error outcome. */
export function isErrorReason(reason: EvaluationReason): boolean {
  return ERROR_REASONS.has(reason);
}

/** Coarse, non-identifying latency buckets (ms). */
export const LATENCY_BUCKETS_MS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000] as const;

/** Smallest bucket ≥ `ms`, or the top bucket (1000) when `ms` exceeds all buckets. */
export function bucketLatency(ms: number): number {
  for (const bucket of LATENCY_BUCKETS_MS) {
    if (ms <= bucket) return bucket;
  }
  return 1000;
}
