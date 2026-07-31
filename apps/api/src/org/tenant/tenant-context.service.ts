import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { OrgRole } from "@togglr/shared-types";
import type { Transaction } from "kysely";
import type { Database } from "../../db/database";

/** The per-request tenant context carried through the org transaction. */
export interface TenantStore {
  orgId: string;
  role: OrgRole;
  trx: Transaction<Database>;
}

/**
 * Holds the active tenant transaction (opened by {@link TransactionInterceptor})
 * in an AsyncLocalStorage so services/repositories read it without threading it
 * through every call. Tenant data MUST be read via `trx` — never the raw KYSELY
 * pool — so RLS scopes it to `app.current_org`. The getters throw when called
 * outside a tenant context (a bug: an org-scoped path was reached without the
 * interceptor).
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, fn: () => Promise<T>): Promise<T> {
    return this.als.run(store, fn);
  }

  private require(): TenantStore {
    const store = this.als.getStore();
    if (!store) {
      throw new Error("No tenant context: called outside a tenant transaction");
    }
    return store;
  }

  get trx(): Transaction<Database> {
    return this.require().trx;
  }

  get orgId(): string {
    return this.require().orgId;
  }

  get role(): OrgRole {
    return this.require().role;
  }
}
