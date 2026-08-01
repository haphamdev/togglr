import type { Variation } from "./index";

// Control-plane wire contract shared by the API and web app (and, later, tooling).
// Types only — no runtime code — matching the package invariant. Shapes mirror
// docs/api/togglr-api.md and docs/design/control-plane-data-model.md.

/** Coarse org role. Rank order for gating: owner > admin > member. */
export type OrgRole = "owner" | "admin" | "member";

/** An org as returned to its members (includes the caller's role). */
export interface OrgSummary {
  slug: string;
  name: string;
  role: OrgRole;
  createdAt: string;
}

/** A user's membership entry (surfaced on `/auth/me` and login/signup). */
export interface Membership {
  slug: string;
  name: string;
  role: OrgRole;
}

/** A member of an org, joined with their user identity. */
export interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  createdAt: string;
}

export type InviteStatus = "pending" | "accepted" | "expired";

export interface Invite {
  id: string;
  email: string;
  role: OrgRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

/** Unauthenticated invite preview (by token) for the accept screen. */
export interface InvitePreview {
  orgName: string;
  email: string;
  role: OrgRole;
  userExists: boolean;
  expiresAt: string;
}

export interface Project {
  key: string;
  name: string;
  createdAt: string;
}

export interface Environment {
  key: string;
  name: string;
  rulesetVersion: number;
  archivedAt: string | null;
  createdAt: string;
}

export type SdkKeyStatus = "active" | "revoked";

/** An SDK key as listed — never carries the plaintext secret. */
export interface SdkKey {
  id: string;
  prefix: string;
  name: string | null;
  status: SdkKeyStatus;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** An SDK key at creation/rotation — carries the plaintext `secret` once. */
export interface SdkKeySecret {
  id: string;
  secret: string;
  prefix: string;
  name: string | null;
  status: "active";
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Monotonic per-(flag, environment) counter, bumped on each edit to that flag's
 * config; drives optimistic-concurrency 409s in Flag Authoring. Independent of
 * `RulesetVersion` (per-environment, bumped on any change in the environment) —
 * the two are never conflated.
 */
export type ConfigVersion = number;

/** A flag's project-scoped definition (key + type are immutable after create). */
export interface Flag {
  key: string;
  description: string | null;
  type: "boolean";
  archivedAt: string | null;
  createdAt: string;
}

/** One flag's config state in a single environment, as a list/detail summary. */
export interface FlagEnvConfigSummary {
  envKey: string;
  enabled: boolean;
  defaultVariation: Variation;
  ruleCount: number;
  configVersion: number;
}

/** A flag plus its per-environment config summaries (list/detail/create shape). */
export interface FlagWithEnvironments extends Flag {
  environments: FlagEnvConfigSummary[];
}
