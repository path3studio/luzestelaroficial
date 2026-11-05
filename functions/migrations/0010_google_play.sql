-- 0010: suscripción Plus comprada por Google Play dentro de la app Android (2026-11-05)
-- Las filas de Stripe siguen igual (provider = 'stripe'); las de Play llevan el purchaseToken
-- (único por compra; un token solo puede pertenecer a una cuenta) y la última comprobación con Google.
ALTER TABLE subscriptions ADD COLUMN provider TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE subscriptions ADD COLUMN google_purchase_token TEXT;
ALTER TABLE subscriptions ADD COLUMN google_order_id TEXT;
ALTER TABLE subscriptions ADD COLUMN google_product_id TEXT;
ALTER TABLE subscriptions ADD COLUMN google_checked_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_google_token ON subscriptions(google_purchase_token);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_provider ON subscriptions(user_id, provider);

INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0010_google_play', datetime('now'), 'v1-google-play');
