-- Migration 006: Mapa Estelar order audit trail
-- Run: npx wrangler d1 execute luzestelar-db --file=./functions/migrations/0006_mapa_orders.sql --remote
--
-- Shadow log of every Mapa Estelar form submission. Written from the browser
-- BEFORE the Stripe checkout redirect so we have a record even when a user
-- bounces off the payment screen. Paid orders are reconciled later against
-- Stripe via the consulta-api worker.
--
-- This table is append-only. We never mutate rows after insert.

CREATE TABLE IF NOT EXISTS mapa_orders (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  lang                  TEXT    NOT NULL DEFAULT 'es',

  -- Event that the map depicts
  titulo                TEXT    NOT NULL,
  fecha                 TEXT    NOT NULL,        -- ISO date (YYYY-MM-DD)
  hora                  TEXT,                    -- HH:MM 24h, optional
  lugar                 TEXT    NOT NULL,        -- free-form city string

  -- Buyer
  email                 TEXT    NOT NULL,

  -- Delivery
  formatos              TEXT    NOT NULL,        -- JSON array: ["phone","desktop",...]
  custom_size           TEXT,                    -- "1200x1600" or NULL
  notas                 TEXT,

  -- Gift variant (all null for self-purchases)
  is_gift               INTEGER NOT NULL DEFAULT 0,   -- 0/1
  regalo_nombre         TEXT,
  regalo_fecha_entrega  TEXT,                    -- ISO date or NULL
  regalo_mensaje        TEXT,

  -- Request metadata (helps triage abuse / duplicate submits)
  ip_hash               TEXT,                    -- sha256(IP + salt), NOT raw IP
  user_agent            TEXT,
  referer               TEXT,

  -- Reconciliation against Stripe (set later by the consulta-api worker)
  stripe_session_id     TEXT,
  paid_at               TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'  -- pending | paid | refunded | abandoned
);

CREATE INDEX IF NOT EXISTS idx_mapa_orders_email       ON mapa_orders(email);
CREATE INDEX IF NOT EXISTS idx_mapa_orders_created_at  ON mapa_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_mapa_orders_status      ON mapa_orders(status);
CREATE INDEX IF NOT EXISTS idx_mapa_orders_session     ON mapa_orders(stripe_session_id);

-- Record migration
INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0006_mapa_orders', datetime('now'), 'v1-mapa-orders');
