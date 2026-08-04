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
 * Devuelve todas las notas de `userId`, ordenadas por fecha de creación
 * descendente (la más reciente primero) y, en empate, por id descendente.
 * Este orden es el contrato documentado del endpoint GET /notes (ver
 * acceptance criteria). El filtro `WHERE user_id = ?` es la garantía de
 * aislamiento entre usuarios a nivel de query — ni esta función ni ninguna
 * otra de abajo dependen de que la ruta haga el filtrado por su cuenta.
 */
export async function listNotes(userId: number): Promise<Note[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, title, body, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY created_at DESC, id DESC',
    [userId],
  );
  return (rows as NoteRow[]).map(toNote);
}

export async function createNote(userId: number, input: CreateNoteInput): Promise<Note> {
  const now = new Date();
  const body = input.body ?? null;

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO notes (title, body, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)',
    [input.title, body, now, now, userId],
  );

  return {
    id: result.insertId,
    title: input.title,
    body,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Devuelve la nota con ese id **si pertenece a `userId`**, o `null` si no existe o es de otro usuario. */
export async function getNoteById(userId: number, id: number): Promise<Note | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, title, body, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  const row = (rows as NoteRow[])[0];
  return row ? toNote(row) : null;
}

/**
 * Actualiza parcialmente `title` y/o `body` de la nota con ese id **si
 * pertenece a `userId`** y refresca `updated_at`. Los campos ausentes en
 * `input` conservan su valor actual (no se borran). Devuelve la nota
 * actualizada, o `null` si no existe o pertenece a otro usuario (mismo
 * código 404 para ambos casos en la ruta — no se revela cuál de los dos
 * pasó, ver routes/notes.ts).
 */
export async function updateNote(
  userId: number,
  id: number,
  input: UpdateNoteInput,
): Promise<Note | null> {
  const existing = await getNoteById(userId, id);
  if (!existing) {
    return null;
  }

  const title = input.title ?? existing.title;
  const body = input.body !== undefined ? input.body : existing.body;
  const now = new Date();

  await pool.execute(
    'UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [title, body, now, id, userId],
  );

  return {
    id,
    title,
    body,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  };
}

/**
 * Elimina la nota con ese id **si pertenece a `userId`**. Devuelve `true` si
 * existía (y era de `userId`) y fue eliminada.
 */
export async function deleteNote(userId: number, id: number): Promise<boolean> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'DELETE FROM notes WHERE id = ? AND user_id = ?',
    [id, userId],
  );
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
 * Busca, dentro de las notas de `userId`, las que tengan `query` como
 * substring de `title` o `body` (sin distinguir mayúsculas/minúsculas).
 * Ordenadas igual que `listNotes` (más recientes primero). `body` puede ser
 * `NULL`, por eso se compara con `COALESCE(body, '')` antes de aplicar
 * `LOWER`/`LIKE`.
 */
export async function searchNotes(userId: number, query: string): Promise<Note[]> {
  // `\` es el carácter de escape por defecto de LIKE en MySQL, el mismo que
  // usa `escapeLikePattern`, así que no hace falta una cláusula ESCAPE extra.
  const pattern = `%${escapeLikePattern(query)}%`;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, title, body, created_at, updated_at FROM notes
     WHERE user_id = ?
       AND (LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(body, '')) LIKE LOWER(?))
     ORDER BY created_at DESC, id DESC`,
    [userId, pattern, pattern],
  );
  return (rows as NoteRow[]).map(toNote);
}

/** Fila cruda de `users` tal como la devuelve el driver (columnas snake_case). */
interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
}

/**
 * Forma interna de un usuario, con `passwordHash` incluido — a diferencia de
 * `AuthUser` (backend/src/types.ts), que es la forma pública sin ese campo.
 * Solo `db.ts` y `routes/auth.ts` (para comparar contraseñas) deberían ver
 * `passwordHash`; nunca debe llegar a una respuesta HTTP.
 */
export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Crea un usuario nuevo. `passwordHash` ya debe venir hasheado (ver
 * backend/src/auth.ts, `hashPassword`) — esta función nunca hashea ni
 * valida contraseñas, solo guarda lo que recibe. Si `email` ya existe, MySQL
 * rechaza el `INSERT` por la constraint `UNIQUE` de `users.email`
 * (`db/migrations/002_add_users.sql`) con un error `ER_DUP_ENTRY`; quien
 * llame (routes/auth.ts) es responsable de traducir eso a un 409.
 */
export async function createUser(email: string, passwordHash: string): Promise<UserRecord> {
  const now = new Date();
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
    [email, passwordHash, now],
  );

  return {
    id: result.insertId,
    email,
    passwordHash,
    createdAt: now.toISOString(),
  };
}

/** Devuelve el usuario con ese email, o `null` si no existe. */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = ?',
    [email],
  );
  const row = (rows as UserRow[])[0];
  return row ? toUser(row) : null;
}

/** Devuelve el usuario con ese id, o `null` si no existe. */
export async function getUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, password_hash, created_at FROM users WHERE id = ?',
    [id],
  );
  const row = (rows as UserRow[])[0];
  return row ? toUser(row) : null;
}
