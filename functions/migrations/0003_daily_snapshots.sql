-- Migration 003: Daily snapshots for historical trends
-- Run: npx wrangler d1 execute luzestelar-db --file=./functions/migrations/0003_daily_snapshots.sql --remote
--
-- Stores one row per day with key metrics for week-over-week comparison.
-- Written by the analytics-fetcher cron in path3studio-admin (daily 13:00 UTC).

CREATE TABLE IF NOT EXISTS daily_snapshots (
  date          TEXT PRIMARY KEY,       -- YYYY-MM-DD
  visitors      INTEGER DEFAULT 0,      -- Unique visits (CF edge, eyeball only)
  requests      INTEGER DEFAULT 0,      -- Total HTTP requests (eyeball only)
  bandwidth     INTEGER DEFAULT 0,      -- Bytes transferred
  users_total   INTEGER DEFAULT 0,      -- Total registered users
  users_new     INTEGER DEFAULT 0,      -- New registrations that day
  revenue_cents INTEGER DEFAULT 0,      -- Revenue in cents (from user_orders)
  orders_count  INTEGER DEFAULT 0,      -- Number of orders
  newsletter    INTEGER DEFAULT 0,      -- Newsletter subscriber count
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Index for range queries (last 30 days, last 90 days)
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(date);

-- Record migration
INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0003_daily_snapshots', datetime('now'), 'v1-snapshots');
