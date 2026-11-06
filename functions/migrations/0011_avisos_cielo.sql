-- 0011_avisos_cielo.sql  (2026-11-06, aprobado por el dueño: camino 2 «sal a mirar el cielo»)
--
-- 1. push_subscriptions.notify_cielo — casilla «Avisos del cielo» en Ajustes.
--    Encendida por defecto: quien ya aceptó avisos de Luz Estelar los recibe;
--    se apaga sola desde Ajustes sin perder la lectura diaria.
--
-- 2. avisos_cielo — un aviso por evento observable (lo llena scripts/avisos_cielo.py
--    desde el calendario de especiales). Se manda en la FECHA y HORA LOCALES de cada
--    suscriptor (18 = anochecer, 21 = la noche antes de algo de madrugada).
--    `signo` = signo del evento, para la línea personal de Plus («cae en tu casa 7»).
--
-- 3. avisos_cielo_enviados — un aviso por dispositivo, una sola vez.

ALTER TABLE push_subscriptions ADD COLUMN notify_cielo INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS avisos_cielo (
  id          TEXT PRIMARY KEY,
  fecha_local TEXT NOT NULL,
  hora_local  INTEGER NOT NULL,
  titulo_es   TEXT NOT NULL,
  cuerpo_es   TEXT NOT NULL,
  titulo_en   TEXT,
  cuerpo_en   TEXT,
  signo       TEXT,
  url         TEXT NOT NULL DEFAULT '/mi-dia.html',
  activo      INTEGER NOT NULL DEFAULT 1,
  creado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_avisos_cielo_fecha ON avisos_cielo(fecha_local, activo);

CREATE TABLE IF NOT EXISTS avisos_cielo_enviados (
  aviso_id TEXT NOT NULL,
  sub_id   INTEGER NOT NULL,
  user_id  TEXT,
  sent_at  TEXT NOT NULL,
  PRIMARY KEY (aviso_id, sub_id)
);

INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0011_avisos_cielo', datetime('now'), 'manual');
