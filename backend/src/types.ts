/** Interfaces del dominio de notas, compartidas por db.ts y routes/notes.ts. */

export interface Note {
  id: number;
  title: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  body?: string | null;
}

/**
 * Input de una actualización parcial (PUT /notes/:id). Ambos campos son
 * opcionales: si un campo está ausente, ese campo no se toca en la base de
 * datos. Si `title` está presente, ya viene validado como string no vacío
 * (misma regla que `CreateNoteInput.title`).
 */
export interface UpdateNoteInput {
  title?: string;
  body?: string | null;
}

/**
 * Representación pública de un usuario autenticado (respuesta de
 * `/auth/register`, `/auth/login`, `/auth/me`) — a propósito NO incluye
 * `passwordHash`: ese campo vive solo en `UserRecord` (backend/src/db.ts),
 * la forma interna de la fila de la base de datos, y nunca debe viajar en
 * una respuesta HTTP.
 */
export interface AuthUser {
  id: number;
  email: string;
  createdAt: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
