-- 0009: telemetría de bajas (2026-07-07)
-- Contexto: la única sub activa se fue esta semana y no supimos ni cuándo ni
-- cómo — la cancelación Stripe solo marcaba status (sin fecha), y el borrado
-- de cuenta (GDPR /api/account/delete) elimina la fila entera de
-- subscriptions → cero rastro. churn_log sobrevive ambos caminos y NO guarda
-- PII (solo agregados: tipo de baja, plan, antigüedad).
ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT;

CREATE TABLE IF NOT EXISTS churn_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,             -- 'stripe_cancel' | 'account_delete'
  plan TEXT,
  had_active_sub INTEGER DEFAULT 0,
  days_since_signup INTEGER
);
