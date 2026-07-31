exports.shorthands = undefined;
exports.up = (pgm) => {
  pgm.sql("ALTER TABLE environments ADD COLUMN IF NOT EXISTS archived_at timestamptz;");
};
exports.down = (pgm) => {
  pgm.sql("ALTER TABLE environments DROP COLUMN IF EXISTS archived_at;");
};
