CREATE DATABASE IF NOT EXISTS notes_web
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE notes_web;

CREATE TABLE notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
