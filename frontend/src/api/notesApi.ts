/**
 * Cliente REST tipado del backend de notas. Única capa del frontend que le
 * habla al backend (ver docs/architecture.md) — ningún componente debe
 * llamar a `fetch` directamente.
 */
import type { CreateNoteInput, Note, UpdateNoteInput } from '../types';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

/** Error del dominio: transporta el código HTTP junto al mensaje del backend. */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Intenta leer `{ error: string }` del body de una respuesta fallida (mismo
 * contrato que expone el backend, ver `backend/src/app.ts`). Si el body no
 * es JSON válido o no trae `error`, cae al mensaje de respaldo recibido por
 * parámetro — nunca se propaga un error sin mensaje legible al componente.
 */
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    const candidate = body as { error?: unknown } | null;
    if (candidate && typeof candidate.error === 'string' && candidate.error.length > 0) {
      return candidate.error;
    }
  } catch {
    // Body no era JSON válido: se usa el mensaje de respaldo.
  }
  return fallback;
}

/** Obtiene todas las notas desde `GET /notes`. */
export async function getNotes(): Promise<Note[]> {
  const response = await fetch(`${API_BASE_URL}/notes`);

  if (!response.ok) {
    const fallback = `Error ${response.status} al obtener las notas`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as Note[];
}

/** Crea una nota nueva vía `POST /notes`. */
export async function createNote(input: CreateNoteInput): Promise<Note> {
  const response = await fetch(`${API_BASE_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al crear la nota`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as Note;
}

/**
 * Obtiene una nota por id vía `GET /notes/:id`. Si el id no existe (o no es
 * válido), el backend responde 404 y esta función lanza `ApiError` con
 * `statusCode: 404` — quien llame puede distinguir ese caso de cualquier
 * otro error con `err instanceof ApiError && err.statusCode === 404`.
 */
export async function getNoteById(id: number): Promise<Note> {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`);

  if (!response.ok) {
    const fallback = `Error ${response.status} al obtener la nota`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as Note;
}

/** Actualiza (parcialmente) una nota vía `PUT /notes/:id`. */
export async function updateNote(id: number, input: UpdateNoteInput): Promise<Note> {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al actualizar la nota`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as Note;
}

/**
 * Elimina una nota vía `DELETE /notes/:id`. El backend responde `204` sin
 * body si se borró (no hay nada que devolver, de ahí `Promise<void>`), o
 * `404` si no existe.
 */
export async function deleteNote(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al eliminar la nota`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }
}

/**
 * Busca notas por substring en `title`/`body` (case-insensitive) vía
 * `GET /notes/search?q=...`. Sin coincidencias, el backend responde `200`
 * con `[]` (no es un error, ver `backend/src/routes/notes.ts`), así que
 * esta función simplemente devuelve un array vacío en ese caso — quien
 * llame decide cómo mostrar "sin resultados". `URLSearchParams` se encarga
 * de codificar `query` correctamente en la URL.
 */
export async function searchNotes(query: string): Promise<Note[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_BASE_URL}/notes/search?${params.toString()}`);

  if (!response.ok) {
    const fallback = `Error ${response.status} al buscar notas`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as Note[];
}
