-- 0007_aspect_alerts.sql
--
-- Two schema additions to support server-side exact-aspect push alerts:
--
-- 1. push_subscriptions.notify_aspects — opt-out for users who want
--    the daily reading push but NOT the aspect alerts. Defaults ON
--    (1) because the existing subscriber consent covers "push from
--    Luz Estelar" generically; this column lets individuals silence
--    the aspect layer while keeping the daily one.
--
-- 2. sent_aspect_alerts — dedup table. Before sending any aspect
--    notification, the worker checks whether that same (user,
--    transit_planet, natal_planet, aspect_type) tuple has been sent
--    in the last 3 days. Without this, the same exact aspect would
--    fire push every day it's within orb (often 2-3 consecutive days),
--    which would feel like spam. The UNIQUE constraint enforces
--    one-per-aspect; the index on sent_at lets the worker quickly
--    filter recent sends.

ALTER TABLE push_subscriptions ADD COLUMN notify_aspects INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS sent_aspect_alerts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  transit_planet TEXT NOT NULL,
  natal_planet   TEXT NOT NULL,
  aspect_type    TEXT NOT NULL,
  orb            REAL,
  sent_at        TEXT NOT NULL,
  UNIQUE (user_id, transit_planet, natal_planet, aspect_type)
);

CREATE INDEX IF NOT EXISTS idx_sent_aspect_alerts_sent
  ON sent_aspect_alerts(sent_at);

CREATE INDEX IF NOT EXISTS idx_sent_aspect_alerts_user
  ON sent_aspect_alerts(user_id);

INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES ('0007_aspect_alerts', datetime('now'));
