exports.shorthands = undefined;

const tenantPredicate = (column) =>
  `${column} = NULLIF(current_setting('app.current_org', true), '')::uuid`;

function enableRls(pgm, table, column) {
  pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`DROP POLICY IF EXISTS tenant_isolation ON ${table};`);
  pgm.sql(`
    CREATE POLICY tenant_isolation ON ${table} FOR ALL
      USING (${tenantPredicate(column)})
      WITH CHECK (${tenantPredicate(column)});
  `);
}

exports.up = (pgm) => {
  // --- flags -----------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS flags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key text NOT NULL,
      description text,
      type text NOT NULL DEFAULT 'boolean' CHECK (type IN ('boolean')),
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, project_id, key)
    );
  `);
  enableRls(pgm, "flags", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE ON flags TO togglr_app;");

  // --- flag_env_configs ------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS flag_env_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      flag_id uuid NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
      environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
      enabled boolean NOT NULL DEFAULT false,
      default_variation jsonb NOT NULL DEFAULT 'false',
      rules jsonb NOT NULL DEFAULT '[]',
      config_version int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (flag_id, environment_id)
    );
  `);
  pgm.sql("CREATE INDEX IF NOT EXISTS flag_env_configs_flag_idx ON flag_env_configs(flag_id);");
  enableRls(pgm, "flag_env_configs", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE ON flag_env_configs TO togglr_app;");
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS flag_env_configs;");
  pgm.sql("DROP TABLE IF EXISTS flags;");
};
