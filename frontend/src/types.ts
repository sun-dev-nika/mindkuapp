/**
 * Interfaz del dominio de notas en el frontend. Misma forma que `Note` en
 * `backend/src/types.ts` (el contrato JSON que ya devuelve la API), para que
 * el cliente REST tipado (`api/notesApi.ts`) y los componentes compartan un
 * único tipo sin traducciones intermedias.
 */
export interface Note {
  id: number;
  title: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input de `POST /notes`. Misma forma que `CreateNoteInput` en backend/src/types.ts. */
export interface CreateNoteInput {
  title: string;
  body?: string | null;
}

/**
 * Input de `PUT /notes/:id` (actualización parcial). Misma forma que
 * `UpdateNoteInput` en backend/src/types.ts: ambos campos son opcionales,
 * un campo ausente no se toca en el backend.
 */
export interface UpdateNoteInput {
  title?: string;
  body?: string | null;
}

/**
 * Forma pública de un usuario autenticado, tal como la devuelven
 * `POST /auth/register`, `POST /auth/login` y `GET /auth/me`. Misma forma
 * que `AuthUser` en `backend/src/types.ts` — a propósito NUNCA incluye la
 * contraseña ni su hash, esos campos no salen del backend.
 */
export interface AuthUser {
  id: number;
  email: string;
  createdAt: string;
}
