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
