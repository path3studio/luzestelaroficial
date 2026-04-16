-- Migration 004: Track subscription cadence (monthly/annual) + trial metadata
-- Run: npx wrangler d1 execute luzestelar-db --file=./functions/migrations/0004_subscription_cadence.sql --remote
--
-- Added as part of the mobile app's annual-plan rollout (Apr 16).
-- cadence: 'monthly' | 'annual' — comes from checkout session metadata
-- trial_end: ISO datetime of when the 7-day free trial expires (null if no trial)

ALTER TABLE subscriptions ADD COLUMN cadence TEXT DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN trial_end TEXT;

-- Backfill: any pre-existing row is monthly (we only sold monthly before this)
UPDATE subscriptions SET cadence = 'monthly' WHERE cadence IS NULL;

-- Record migration
INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0004_subscription_cadence', datetime('now'), 'v1-cadence');
