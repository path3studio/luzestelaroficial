-- 0013_amigos.sql  (2026-11-06, aprobado por el dueño: «compatibilidad con amigos», maqueta del 6/nov)
--
-- Solo por invitación: quien toca «Compartir mi perfil» obtiene un código propio (amigo_codigos, al azar,
-- distinto del de referidos). Quien abre /amigo/<código> y toca «Aceptar» queda conectado en los dos sentidos
-- (dos filas en amistades). Cualquiera de los dos puede quitar la amistad (se borran ambas filas).
-- Nunca se comparten fecha, hora ni lugar de nacimiento: solo nombre, signos y el resultado.

CREATE TABLE IF NOT EXISTS amigo_codigos (
  user_id TEXT PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  creado  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS amistades (
  user_id  TEXT NOT NULL,
  amigo_id TEXT NOT NULL,
  creado   TEXT NOT NULL,
  PRIMARY KEY (user_id, amigo_id)
);

CREATE INDEX IF NOT EXISTS idx_amistades_amigo ON amistades(amigo_id);

INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0013_amigos', datetime('now'), 'manual');
