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
const REASONS = ["RULE_MATCH", "ROLLOUT", "DEFAULT", "FLAG_OFF", "FLAG_NOT_FOUND", "MISSING_KEY"];

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

const draftRule = (variation: boolean) => ({
  conditions: [],
  result: { kind: "variation", variation },
});

describe("Flag preview (integration)", () => {
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
    const email = `fp-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  async function makeOrg(u: User): Promise<{ slug: string; orgId: string }> {
    const slug = `fp-${randomUUID().slice(0, 8)}`;
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

  const previewPath = (slug: string, projectKey: string, flagKey: string, envKey = "development") =>
    `/api/v1/orgs/${slug}/projects/${projectKey}/flags/${flagKey}/environments/${envKey}/preview`;

  function preview(u: User, path: string, body: object) {
    return request(server())
      .post(path)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send(body);
  }

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
    return {
      owner,
      slug,
      orgId,
      projectKey,
      flagKey,
      base: previewPath(slug, projectKey, flagKey),
    };
  }

  it("AC1/AC4/AC6: draft config → 200 unwrapped {value, reason} with a valid reason", async () => {
    const { owner, base } = await scenario();
    const res = await preview(owner, base, {
      context: { key: "u1" },
      defaultValue: false,
      config: { enabled: true, defaultVariation: false, rules: [draftRule(true)] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ value: true, reason: "RULE_MATCH" });
    expect(res.body.config).toBeUndefined();
    expect(REASONS).toContain(res.body.reason);
  });

  it("AC2: saved config (config omitted) → 200 evaluating the persisted flag", async () => {
    const { owner, base } = await scenario();
    const res = await preview(owner, base, { context: { key: "u1" }, defaultValue: true });
    expect(res.status).toBe(200);
    // A freshly-created flag is disabled by default → FLAG_OFF.
    expect(res.body.reason).toBe("FLAG_OFF");
    expect(REASONS).toContain(res.body.reason);
  });

  it("AC2: archived flag on the saved path → 200 reason FLAG_NOT_FOUND", async () => {
    const { owner, slug, orgId, projectKey, flagKey, base } = await scenario();
    await sql`
      UPDATE flags SET archived_at = now()
       WHERE key = ${flagKey}
         AND project_id = (SELECT id FROM projects WHERE key = ${projectKey} AND organization_id = ${orgId})
    `.execute(admin);
    const res = await preview(owner, base, { context: { key: "u1" }, defaultValue: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ value: true, reason: "FLAG_NOT_FOUND" });
    expect(slug).toBeTruthy();
  });

  it("AC3: invalid draft rules → 400 CURIOUS_CAT", async () => {
    const { owner, base } = await scenario();
    const res = await preview(owner, base, {
      context: { key: "u1" },
      defaultValue: false,
      config: {
        enabled: true,
        defaultVariation: false,
        rules: [{ conditions: [], result: { kind: "banana", variation: true } }],
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CURIOUS_CAT");
  });

  it("AC7: a member (no @Roles) can preview → 200", async () => {
    const { orgId, base } = await scenario();
    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);
    const res = await preview(member, base, {
      context: { key: "u1" },
      defaultValue: false,
      config: { enabled: true, defaultVariation: false, rules: [draftRule(true)] },
    });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe(true);
  });

  it("AC9: missing defaultValue → 400 CLUMSY_OWL", async () => {
    const { owner, base } = await scenario();
    const res = await preview(owner, base, { context: { key: "u1" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CLUMSY_OWL");
  });

  it("AC10: no session cookie → 401 SLEEPY_OWL", async () => {
    const { base } = await scenario();
    const res = await request(server())
      .post(base)
      .send({ context: { key: "u1" }, defaultValue: false });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SLEEPY_OWL");
  });

  it("AC11: non-member → 403 LONELY_OWL", async () => {
    const { base } = await scenario();
    const outsider = await register();
    const res = await preview(outsider, base, { context: { key: "u1" }, defaultValue: false });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LONELY_OWL");
  });

  it("AC12: unknown flag or env → 404 LOST_OWL", async () => {
    const { owner, slug, projectKey, flagKey } = await scenario();

    const unknownFlag = previewPath(slug, projectKey, "ghost-flag");
    const rf = await preview(owner, unknownFlag, { context: { key: "u1" }, defaultValue: false });
    expect(rf.status).toBe(404);
    expect(rf.body.error.code).toBe("LOST_OWL");

    const unknownEnv = previewPath(slug, projectKey, flagKey, "ghost-env");
    const re = await preview(owner, unknownEnv, { context: { key: "u1" }, defaultValue: false });
    expect(re.status).toBe(404);
    expect(re.body.error.code).toBe("LOST_OWL");
  });
});
