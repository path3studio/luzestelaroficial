-- 0014_avatar.sql  (2026-11-06, aprobado por el dueño: «cada perfil tiene una criatura… o un color neutro o subir la imagen»)
-- birth_profiles.avatar: NULL o 'criatura' = la criatura de su signo (assets/criaturas/<signo>.webp);
-- 'neutro' = inicial sobre color; 'data:image/…;base64,…' = foto propia reducida en el teléfono (≤ 60 KB).
ALTER TABLE birth_profiles ADD COLUMN avatar TEXT;

INSERT OR IGNORE INTO _migrations (id, applied_at, checksum)
VALUES ('0014_avatar', datetime('now'), 'manual');
