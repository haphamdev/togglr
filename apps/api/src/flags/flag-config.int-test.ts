import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { configureApp } from "../bootstrap/configure-app";
import type { Database } from "../db/database";

const PASSWORD = "correct-horse-42";

function cookieOf(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : String(raw);
  return header.split(";")[0];
}

interface User {
  cookie: string;
  csrf: string;
  email: string;
  id: string;
}

const rollout = (percentage: number) => ({
  conditions: [],
  result: { kind: "rollout", percentage, bucketBy: "key", variation: true },
});

describe("Flag config edit (integration)", () => {
  let app: INestApplication;
  let admin: Kysely<Database>;
  const emails: string[] = [];
  const slugs: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    admin = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL as string }),
      }),
    });
  });

  afterAll(async () => {
    if (slugs.length > 0)
      await sql`DELETE FROM organizations WHERE slug = ANY(${slugs})`.execute(admin);
    if (emails.length > 0) await sql`DELETE FROM users WHERE email = ANY(${emails})`.execute(admin);
    await admin.destroy();
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function register(): Promise<User> {
    const email = `fc-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  async function makeOrg(u: User): Promise<{ slug: string; orgId: string }> {
    const slug = `fc-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);
    const res = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ name: "Team", slug });
    expect(res.status).toBe(201);
    const r = await sql<{ id: string }>`SELECT id FROM organizations WHERE slug = ${slug}`.execute(
      admin,
    );
    return { slug, orgId: r.rows[0].id };
  }

  async function makeProject(u: User, slug: string): Promise<string> {
    const key = `proj-${randomUUID().slice(0, 6)}`;
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/projects`)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ key, name: "Proj" });
    expect(res.status).toBe(201);
    return key;
  }

  async function makeFlag(u: User, slug: string, projectKey: string, key: string): Promise<void> {
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/projects/${projectKey}/flags`)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ key });
    expect(res.status).toBe(201);
  }

  const configPath = (slug: string, projectKey: string, flagKey: string, envKey = "development") =>
    `/api/v1/orgs/${slug}/projects/${projectKey}/flags/${flagKey}/environments/${envKey}/config`;

  function getConfig(u: User, path: string) {
    return request(server()).get(path).set("Cookie", u.cookie);
  }

  function patchConfig(u: User, path: string, body: object) {
    return request(server())
      .patch(path)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send(body);
  }

  /** Fresh owner + org + project + flag; returns everything a test needs. */
  async function scenario(): Promise<{
    owner: User;
    slug: string;
    orgId: string;
    projectKey: string;
    flagKey: string;
    base: string;
  }> {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    const flagKey = `flag-${randomUUID().slice(0, 6)}`;
    await makeFlag(owner, slug, projectKey, flagKey);
    return { owner, slug, orgId, projectKey, flagKey, base: configPath(slug, projectKey, flagKey) };
  }

  it("AC1/AC9: PATCH enabled bumps config+ruleset versions and writes exactly one audit row", async () => {
    const { owner, orgId, projectKey, base } = await scenario();

    const before = await sql<{ ruleset_version: number }>`
      SELECT e.ruleset_version FROM environments e
        JOIN projects p ON p.id = e.project_id
       WHERE p.key = ${projectKey} AND e.key = 'development' AND p.organization_id = ${orgId}
    `.execute(admin);
    const preRuleset = Number(before.rows[0].ruleset_version);

    const res = await patchConfig(owner, base, { enabled: true, expectedConfigVersion: 0 });
    expect(res.status).toBe(200);
    expect(res.body.config.configVersion).toBe(1);
    expect(typeof res.body.config.rulesetVersion).toBe("number");
    expect(res.body.config.rulesetVersion).toBeGreaterThan(0);

    const after = await sql<{ ruleset_version: number }>`
      SELECT e.ruleset_version FROM environments e
        JOIN projects p ON p.id = e.project_id
       WHERE p.key = ${projectKey} AND e.key = 'development' AND p.organization_id = ${orgId}
    `.execute(admin);
    expect(Number(after.rows[0].ruleset_version)).toBe(preRuleset + 1);

    const audit = await sql<{ n: string }>`
      SELECT count(*) AS n FROM audit_logs
       WHERE organization_id = ${orgId}
         AND action = 'flag_config.update'
         AND target_type = 'flag'
    `.execute(admin);
    expect(Number(audit.rows[0].n)).toBe(1);
  });

  it("AC2/AC8: rules replace wholesale; enabled patches independently of rules", async () => {
    const { owner, base } = await scenario();

    const withRules = await patchConfig(owner, base, {
      rules: [rollout(50)],
      expectedConfigVersion: 0,
    });
    expect(withRules.status).toBe(200);

    const afterRules = await getConfig(owner, base);
    expect(afterRules.status).toBe(200);
    expect(afterRules.body.config.rules).toHaveLength(1);
    expect(afterRules.body.config.rules[0].result.percentage).toBe(50);

    // Patching enabled leaves rules untouched.
    const toggle = await patchConfig(owner, base, { enabled: false, expectedConfigVersion: 1 });
    expect(toggle.status).toBe(200);

    const afterToggle = await getConfig(owner, base);
    expect(afterToggle.body.config.enabled).toBe(false);
    expect(afterToggle.body.config.rules).toHaveLength(1);
  });

  it("AC3/AC5/AC6: stale expectedConfigVersion → 409 JEALOUS_CAT and persists nothing", async () => {
    const { owner, orgId, projectKey, flagKey, base } = await scenario();

    const first = await patchConfig(owner, base, { enabled: true, expectedConfigVersion: 0 });
    expect(first.status).toBe(200);
    expect(first.body.config.configVersion).toBe(1);

    // Capture the tri-write state immediately before the conflicting write.
    const snap = await sql<{ config_version: number; ruleset_version: number }>`
      SELECT c.config_version, e.ruleset_version
        FROM flag_env_configs c
        JOIN flags f ON f.id = c.flag_id
        JOIN environments e ON e.id = c.environment_id
        JOIN projects p ON p.id = f.project_id
       WHERE p.key = ${projectKey} AND f.key = ${flagKey} AND e.key = 'development'
         AND p.organization_id = ${orgId}
    `.execute(admin);
    const preConfig = Number(snap.rows[0].config_version);
    const preRuleset = Number(snap.rows[0].ruleset_version);

    const stale = await patchConfig(owner, base, { enabled: false, expectedConfigVersion: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("JEALOUS_CAT");

    // No partial tri-write: config_version and ruleset_version unchanged.
    const post = await sql<{ config_version: number; ruleset_version: number }>`
      SELECT c.config_version, e.ruleset_version
        FROM flag_env_configs c
        JOIN flags f ON f.id = c.flag_id
        JOIN environments e ON e.id = c.environment_id
        JOIN projects p ON p.id = f.project_id
       WHERE p.key = ${projectKey} AND f.key = ${flagKey} AND e.key = 'development'
         AND p.organization_id = ${orgId}
    `.execute(admin);
    expect(Number(post.rows[0].config_version)).toBe(preConfig);
    expect(Number(post.rows[0].ruleset_version)).toBe(preRuleset);
  });

  it("AC4: missing expectedConfigVersion → 400 CLUMSY_OWL", async () => {
    const { owner, base } = await scenario();
    const res = await patchConfig(owner, base, { enabled: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CLUMSY_OWL");
  });

  it("AC7: rollout boundaries 0 and 100 accepted", async () => {
    const zero = await scenario();
    expect(
      (await patchConfig(zero.owner, zero.base, { rules: [rollout(0)], expectedConfigVersion: 0 }))
        .status,
    ).toBe(200);

    const hundred = await scenario();
    expect(
      (
        await patchConfig(hundred.owner, hundred.base, {
          rules: [rollout(100)],
          expectedConfigVersion: 0,
        })
      ).status,
    ).toBe(200);
  });

  it("AC7: malformed rules → 400 CURIOUS_CAT", async () => {
    const { owner, base } = await scenario();
    const bad: object[] = [
      rollout(-1),
      rollout(101),
      {
        conditions: [{ attribute: "x", operator: "gt", values: ["y"] }],
        result: { kind: "variation", variation: true },
      },
      {
        conditions: [{ attribute: "x", operator: "equals", values: [] }],
        result: { kind: "variation", variation: true },
      },
      { conditions: [], result: { kind: "banana", variation: true } },
    ];
    for (const rule of bad) {
      const res = await patchConfig(owner, base, { rules: [rule], expectedConfigVersion: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CURIOUS_CAT");
    }
  });

  it("AC10: GET without a session cookie → 401 SLEEPY_OWL", async () => {
    const { base } = await scenario();
    const res = await request(server()).get(base);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SLEEPY_OWL");
  });

  it("AC11: PATCH without X-CSRF-Token → 403 GRUMPY_OWL", async () => {
    const { owner, base } = await scenario();
    const res = await request(server())
      .patch(base)
      .set("Cookie", owner.cookie)
      .send({ enabled: true, expectedConfigVersion: 0 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("GRUMPY_OWL");
  });

  it("AC12: non-member → 403 LONELY_OWL", async () => {
    const { base } = await scenario();
    const outsider = await register();
    const res = await getConfig(outsider, base);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LONELY_OWL");
  });

  it("AC13: member can GET but not PATCH → 403 SNEAKY_OWL on write", async () => {
    const { orgId, base } = await scenario();
    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);

    const get = await getConfig(member, base);
    expect(get.status).toBe(200);

    const patch = await patchConfig(member, base, { enabled: true, expectedConfigVersion: 0 });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe("SNEAKY_OWL");
  });

  it("AC14: unknown flag or env → 404 LOST_OWL on GET and PATCH", async () => {
    const { owner, slug, projectKey, flagKey } = await scenario();

    const unknownFlag = configPath(slug, projectKey, "ghost-flag");
    expect((await getConfig(owner, unknownFlag)).status).toBe(404);
    expect((await getConfig(owner, unknownFlag)).body.error.code).toBe("LOST_OWL");
    const pf = await patchConfig(owner, unknownFlag, { enabled: true, expectedConfigVersion: 0 });
    expect(pf.status).toBe(404);
    expect(pf.body.error.code).toBe("LOST_OWL");

    const unknownEnv = configPath(slug, projectKey, flagKey, "ghost-env");
    expect((await getConfig(owner, unknownEnv)).status).toBe(404);
    expect((await getConfig(owner, unknownEnv)).body.error.code).toBe("LOST_OWL");
    const pe = await patchConfig(owner, unknownEnv, { enabled: true, expectedConfigVersion: 0 });
    expect(pe.status).toBe(404);
    expect(pe.body.error.code).toBe("LOST_OWL");
  });
});
