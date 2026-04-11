-- Migration 0001 — Migration tracking table
-- ==========================================
-- Records every migration that has been applied to this database.
-- The apply_migrations.sh script reads this table to skip already-applied
-- files. Once this migration is in place, all future schema changes go
-- through 0002_*.sql, 0003_*.sql, etc.

CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,             -- filename without extension, e.g. "0001_migrations_table"
  applied_at TEXT NOT NULL,         -- ISO 8601 UTC
  checksum TEXT                     -- SHA-256 of file contents at apply time (optional)
);
