import mysql from 'mysql2/promise';

import type { CreateNoteInput, Note, UpdateNoteInput } from './types';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3306;
const DEFAULT_USER = 'root';
const DEFAULT_PASSWORD = '';
const DEFAULT_DATABASE = 'notes_web';

export const pool = mysql.createPool({
  host: process.env.NOTES_DB_HOST || DEFAULT_HOST,
  port: Number(process.env.NOTES_DB_PORT) || DEFAULT_PORT,
  user: process.env.NOTES_DB_USER || DEFAULT_USER,
  password: process.env.NOTES_DB_PASSWORD ?? DEFAULT_PASSWORD,
  database: process.env.NOTES_DB_NAME || DEFAULT_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});

/** Fila cruda tal como la devuelve el driver (columnas snake_case). */
interface NoteRow {
  id: number;
  title: string;
  body: string | null;
  created_at: Date;
  updated_at: Date;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Devuelve todas las notas ordenadas por fecha de creación descendente (la
 * más reciente primero) y, en empate, por id descendente. Este orden es el
 * contrato documentado del endpoint GET /notes (ver acceptance criteria).
 */
export async function listNotes(): Promise<Note[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, title, body, created_at, updated_at FROM notes ORDER BY created_at DESC, id DESC',
  );
  return (rows as NoteRow[]).map(toNote);
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const now = new Date();
  const body = input.body ?? null;

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [input.title, body, now, now],
  );

  return {
    id: result.insertId,
    title: input.title,
    body,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Devuelve la nota con ese id, o `null` si no existe. */
export async function getNoteById(id: number): Promise<Note | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, title, body, created_at, updated_at FROM notes WHERE id = ?',
    [id],
  );
  const row = (rows as NoteRow[])[0];
  return row ? toNote(row) : null;
}

/**
 * Actualiza parcialmente `title` y/o `body` de la nota con ese id y refresca
 * `updated_at`. Los campos ausentes en `input` conservan su valor actual (no
 * se borran). Devuelve la nota actualizada, o `null` si no existe.
 */
export async function updateNote(id: number, input: UpdateNoteInput): Promise<Note | null> {
  const existing = await getNoteById(id);
  if (!existing) {
    return null;
  }

  const title = input.title ?? existing.title;
  const body = input.body !== undefined ? input.body : existing.body;
  const now = new Date();

  await pool.execute('UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?', [
    title,
    body,
    now,
    id,
  ]);

  return {
    id,
    title,
    body,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  };
}

/** Elimina la nota con ese id. Devuelve `true` si existía y fue eliminada. */
export async function deleteNote(id: number): Promise<boolean> {
  const [result] = await pool.execute<mysql.ResultSetHeader>('DELETE FROM notes WHERE id = ?', [
    id,
  ]);
  return result.affectedRows > 0;
}

/**
 * Escapa los caracteres especiales de `LIKE` (`%`, `_` y el propio escape
 * `\`) presentes en el texto de búsqueda, para que se traten como texto
 * literal y no como comodines de SQL. El texto del usuario nunca se
 * concatena directamente en la query: siempre viaja como parámetro (`?`).
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Busca notas cuyo `title` o `body` contengan `query` como substring, sin
 * distinguir mayúsculas/minúsculas. Ordenadas igual que `listNotes` (más
 * recientes primero) para mantener un orden definido y consistente entre
 * endpoints. `body` puede ser `NULL`, por eso se compara con
 * `COALESCE(body, '')` antes de aplicar `LOWER`/`LIKE`.
 */
export async function searchNotes(query: string): Promise<Note[]> {
  // `\` es el carácter de escape por defecto de LIKE en MySQL, el mismo que
  // usa `escapeLikePattern`, así que no hace falta una cláusula ESCAPE extra.
  const pattern = `%${escapeLikePattern(query)}%`;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, title, body, created_at, updated_at FROM notes
     WHERE LOWER(title) LIKE LOWER(?)
        OR LOWER(COALESCE(body, '')) LIKE LOWER(?)
     ORDER BY created_at DESC, id DESC`,
    [pattern, pattern],
  );
  return (rows as NoteRow[]).map(toNote);
}
