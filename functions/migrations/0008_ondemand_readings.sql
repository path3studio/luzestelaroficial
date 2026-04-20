-- 0008_ondemand_readings.sql
--
-- Schema for Arco 1: on-demand personalised daily readings via Gemini
-- 2.5 Pro. This is the Plus-tier upgrade that turns the generic
-- sign-level horoscope (shared by thousands) into a chart-level reading
-- personalised against the user's natal_chart.
--
-- Table `ondemand_generations` serves three purposes simultaneously:
--
-- 1. CACHE — one generation per (profile_id, reading_date) is the
--    source of truth for that day's reading for that profile. The
--    UNIQUE constraint enforces it. Subsequent loads the same day
--    read from here instead of burning another Gemini call.
--
-- 2. RATE LIMIT — the UNIQUE constraint itself is the rate limit.
--    Without a regenerate button (deliberate UX choice), there is
--    exactly one call per profile per day. No counter column needed.
--
-- 3. OBSERVABILITY — every call records model, latency, tokens in/
--    out, cost_usd so the admin dashboard can show accurate spend
--    without asking Google. `status` distinguishes success from
--    the graceful fallbacks (timeout, gemini_error, rate_limited).
--
-- The reading content itself lives in `reading_json` as the same
-- shape the nightly pipeline emits, so the existing client renderer
-- works unchanged. That shape is:
--   { "sections": { "overview": "...", "insights": [...], "ritual": "..." },
--     "generatedAt": ISO8601, "source": "ondemand"|"pipeline" }
--
-- Nightly pipeline overwrites the reading in `cached_reports` as
-- usual — we don't touch that table. Plus users' client reads from
-- ondemand_generations first, falls back to cached_reports if empty.
-- So the nightly run is still the "final" version 24h later; the
-- on-demand is the bridge for the same-day experience.

CREATE TABLE IF NOT EXISTS ondemand_generations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL,
  profile_id      TEXT NOT NULL,
  reading_date    TEXT NOT NULL,          -- YYYY-MM-DD in user's timezone
  lang            TEXT NOT NULL,          -- 'es' or 'en'
  model           TEXT NOT NULL,          -- 'gemini-2.5-pro' etc. (recorded for future audits)
  reading_json    TEXT NOT NULL,          -- serialised reading sections
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  latency_ms      INTEGER,
  cost_usd        REAL,                   -- computed at insert time using per-model pricing
  status          TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'gemini_error' | 'timeout' | 'rate_limited' | 'fallback'
  error_message   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, reading_date)
);

-- Index for the client read path: "does this profile have a reading
-- for today?" — profile_id + reading_date is already the UNIQUE
-- constraint so SQLite will use that covering index automatically.

-- Index for the admin dashboard: "how much did we spend today / this
-- month?" — reading_date is the natural aggregation key.
CREATE INDEX IF NOT EXISTS idx_ondemand_reading_date
  ON ondemand_generations(reading_date);

-- Index for per-user abuse detection: "has user X made unusual number
-- of calls?" — even though the UNIQUE prevents >1 per profile per day,
-- a single user with 10 profiles could still generate 10 calls a day,
-- and we want to flag that kind of pattern.
CREATE INDEX IF NOT EXISTS idx_ondemand_user_date
  ON ondemand_generations(user_id, reading_date);

INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES ('0008_ondemand_readings', datetime('now'));
