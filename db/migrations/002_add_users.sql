-- Migración 002: tabla `users` y columna `notes.user_id` (feature
-- db_users_schema). Se asume que la base de datos destino (`notes_web` en
-- desarrollo/producción, `notes_test` para tests) ya existe y ya tiene la
-- tabla `notes` de 001_init.sql — a diferencia de 001, esta migración NO
-- hace `CREATE DATABASE`/`USE`: se aplica seleccionando la base como
-- argumento del cliente `mysql` (ver el comando exacto en db/schema.md),
-- para poder correrla igual contra `notes_web` o `notes_test` sin editar
-- el archivo.
--
-- Esta migración se corre UNA sola vez por base de datos. No hay una
-- tabla de control de migraciones en este proyecto (ver db/schema.md) —
-- si se ejecuta dos veces contra la misma base, el `ALTER TABLE` falla
-- con un error claro de columna/constraint duplicada (no corrompe datos).

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- `user_id` es NULL-able a propósito: `notes` ya tiene filas reales en
-- notes_web (Railway) y en notes_test sin ningún dueño. Forzar NOT NULL
-- acá rompería la migración contra esos datos existentes (no hay ningún
-- usuario todavía al que asignárselas). Las notas que queden con
-- `user_id IS NULL` no se borran ni se tocan — simplemente van a quedar
-- inaccesibles vía la API una vez que la feature 15 filtre todo por
-- `user_id = ?` del usuario autenticado. Ver db/schema.md para el
-- detalle completo de esta decisión.
ALTER TABLE notes
  ADD COLUMN user_id INT UNSIGNED NULL,
  ADD CONSTRAINT fk_notes_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
