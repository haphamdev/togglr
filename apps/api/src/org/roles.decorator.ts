import { SetMetadata } from "@nestjs/common";
import type { OrgRole } from "@togglr/shared-types";

/** Metadata key carrying the minimum org role required for a route. */
export const ROLES_KEY = "org-role";

/**
 * Gate a route (or controller) on a minimum org role. `@Roles("admin")` means
 * admin or owner may call it; RolesGuard enforces the rank. No `@Roles` ⇒
 * membership alone suffices (any role).
 */
export const Roles = (min: OrgRole) => SetMetadata(ROLES_KEY, min);
