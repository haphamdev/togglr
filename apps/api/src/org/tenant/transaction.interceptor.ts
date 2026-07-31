import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { type Kysely, sql } from "kysely";
import { from, lastValueFrom, type Observable } from "rxjs";
import type { AuthedRequest } from "../../auth/authed-request";
import { type Database, KYSELY } from "../../db/database";
import { TenantContextService } from "./tenant-context.service";

/**
 * Opens the per-request tenant transaction for org-scoped routes. Reads
 * `req.orgContext` (set by OrgContextGuard / SdkKeyGuard); if absent, passes
 * through untouched. Otherwise it opens a Kysely transaction, sets the
 * transaction-scoped `app.current_org` GUC (== SET LOCAL, matching
 * rls-roundtrip.int-test.ts), and runs the handler inside the tenant context so
 * every tenant query is RLS-scoped. A thrown handler error rejects the promise →
 * the transaction rolls back; DomainExceptions propagate to AllExceptionsFilter.
 */
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const orgContext = req.orgContext;
    if (!orgContext) return next.handle();

    const { orgId, role } = orgContext;
    return from(
      this.db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_org', ${orgId}, true)`.execute(trx);
        return this.tenant.run({ orgId, role, trx }, () => lastValueFrom(next.handle()));
      }),
    );
  }
}
