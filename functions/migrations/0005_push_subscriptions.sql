-- Migration 005: Web Push subscriptions
-- Run: npx wrangler d1 execute luzestelar-db --file=./functions/migrations/0005_push_subscriptions.sql --remote
--
-- Stores the PushSubscription objects returned by the browser when a user opts
-- in to daily reading notifications. A separate daily-cron Worker walks this
-- table each hour and fires a web-push request to every row whose
-- `send_hour_local` matches the user's current local hour.
--
-- endpoint is the URL returned by the Push service (FCM, Mozilla, Apple, etc).
-- p256dh + auth are the keys used to encrypt payloads per the Web Push spec.
-- timezone is an IANA zone ('America/Mexico_City', 'Europe/Madrid', ...).
-- send_hour_local is 0-23, defaults to 8 (morning reading).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'es',
  timezone        TEXT NOT NULL DEFAULT 'America/Mexico_City',
  send_hour_local INTEGER NOT NULL DEFAULT 8,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_user        ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_schedule    ON push_subscriptions(send_hour_local, timezone);

-- Record migration
INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0005_push_subscriptions', datetime('now'), 'v1-push');
