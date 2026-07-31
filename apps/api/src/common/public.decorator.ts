import { SetMetadata } from "@nestjs/common";

/** Metadata key marking a route as unauthenticated (no session required). */
export const IS_PUBLIC = "isPublic";

/**
 * Marks a route (or controller) as public: the global SessionGuard skips session
 * resolution and never returns 401 for it. Lives in `common/` (not `auth/`) so
 * HealthController can be public without coupling to AuthModule.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
