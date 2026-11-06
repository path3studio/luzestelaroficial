-- 0015_mapas_plus.sql  (2026-11-06, aprobado por el dueño: «un mapa por cada perfil» con Plus)
-- Un mapa estelar sin marca por perfil de una cuenta Plus, pedido desde la app (sin Stripe ni correo).
-- La Mac (scripts/mapas_plus.py) toma los 'pendiente', los genera (celular + escritorio), los sube a R2
-- y deja 'listo' con las URLs. Si falla: 'error' (se puede volver a pedir).
CREATE TABLE IF NOT EXISTS mapas_plus (
  profile_id TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'pendiente',
  urls       TEXT,
  error      TEXT,
  creado     TEXT NOT NULL,
  listo      TEXT
);
CREATE INDEX IF NOT EXISTS idx_mapas_plus_estado ON mapas_plus(estado);

INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0015_mapas_plus', datetime('now'), 'manual');
