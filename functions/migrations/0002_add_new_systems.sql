-- Migration 002: Add Mayan, Vedic, Human Design, and Enneagram columns
-- Run: npx wrangler d1 execute luzestelar-db --file=./functions/migrations/002_add_new_systems.sql --remote

ALTER TABLE birth_profiles ADD COLUMN mayan_kin INTEGER;
ALTER TABLE birth_profiles ADD COLUMN mayan_seal TEXT;
ALTER TABLE birth_profiles ADD COLUMN mayan_tone INTEGER;
ALTER TABLE birth_profiles ADD COLUMN vedic_rashi TEXT;
ALTER TABLE birth_profiles ADD COLUMN vedic_nakshatra TEXT;
ALTER TABLE birth_profiles ADD COLUMN human_design_gate INTEGER;
ALTER TABLE birth_profiles ADD COLUMN enneagram_type INTEGER;
ALTER TABLE birth_profiles ADD COLUMN enneagram_wing TEXT;
