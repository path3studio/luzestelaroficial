-- 0012_referidos.sql  (2026-11-06, aprobado por el dueño: «1 mes por cada cuenta, hasta 3 gratis»)
--
-- Quien comparte su enlace (luzestelaroficial.com/probar?ref=<8 primeros caracteres de su user_id>) gana
-- 1 mes de Plus por cada persona NUEVA que entra con ese enlace y crea su carta; máximo 3 meses.
-- El premio vive en subscriptions como provider='regalo', id='ref_<user_id>' (se alarga 30 días por amigo).
-- Una cuenta solo puede ser referida una vez (PRIMARY KEY).

CREATE TABLE IF NOT EXISTS referidos (
  referido_id   TEXT PRIMARY KEY,          -- la cuenta nueva
  referente_id  TEXT NOT NULL,             -- quien compartió
  codigo        TEXT NOT NULL,
  premiado      INTEGER NOT NULL DEFAULT 0, -- 1 si sumó un mes al referente (los que pasan del tope quedan en 0)
  creado        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referidos_referente ON referidos(referente_id);

INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0012_referidos', datetime('now'), 'manual');
