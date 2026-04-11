-- Migration 0000 — Initial schema
-- ================================
-- This is the original schema.sql, frozen as the first migration so the
-- new schema-tracking system has a clean starting point. New schema
-- changes go in 0001_*.sql, 0002_*.sql, etc. — never edit this file.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture_url TEXT,
  auth_provider TEXT,
  google_id TEXT,
  tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  lang TEXT DEFAULT 'es',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS birth_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT DEFAULT 'Mi Perfil',
  nombre TEXT NOT NULL,
  fecha_nacimiento TEXT NOT NULL,
  hora_nacimiento TEXT,
  lugar_nacimiento TEXT NOT NULL,
  lat REAL,
  lon REAL,
  timezone TEXT,
  natal_chart TEXT,
  western_sign TEXT,
  chinese_animal TEXT,
  numerology_number INTEGER,
  celtic_tree TEXT,
  mayan_kin INTEGER,
  mayan_seal TEXT,
  mayan_tone INTEGER,
  vedic_rashi TEXT,
  vedic_nakshatra TEXT,
  human_design_gate INTEGER,
  enneagram_type INTEGER,
  enneagram_wing TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_session_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'premium',
  status TEXT DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  birth_profile_id TEXT NOT NULL REFERENCES birth_profiles(id),
  cache_key TEXT UNIQUE,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_birth_profiles_user ON birth_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_user ON user_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_cached_reports_profile ON cached_reports(birth_profile_id);
CREATE INDEX IF NOT EXISTS idx_cached_reports_key ON cached_reports(cache_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
