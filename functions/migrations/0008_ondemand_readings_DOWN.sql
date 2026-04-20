-- 0008_ondemand_readings_DOWN.sql
--
-- EMERGENCY ROLLBACK for migration 0008.
--
-- Use this ONLY if on-demand readings need to be fully removed from
-- the database. In normal operation the feature flag
-- `ENABLE_ONDEMAND_READINGS=0` is sufficient to stop new calls without
-- touching the data — the cache table can sit idle indefinitely.
--
-- This script is for the scenario where we need to reclaim storage
-- or remove the feature entirely before re-deploying.
--
-- To apply:
--   wrangler d1 execute luzestelar --remote --file=0008_ondemand_readings_DOWN.sql
--
-- After running this, also:
--   1. git revert the commits for /api/readings/on-demand
--   2. Remove the admin widget in path3studio-admin
--   3. Delete the ENABLE_ONDEMAND_READINGS secret: wrangler secret delete

DROP INDEX IF EXISTS idx_ondemand_user_date;
DROP INDEX IF EXISTS idx_ondemand_reading_date;
DROP TABLE IF EXISTS ondemand_generations;

DELETE FROM _migrations WHERE id = '0008_ondemand_readings';
