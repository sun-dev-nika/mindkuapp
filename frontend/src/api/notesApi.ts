/**
 * Cliente REST tipado del backend de notas. Única capa del frontend que le
 * habla al backend (ver docs/architecture.md) — ningún componente debe
 * llamar a `fetch` directamente.
 *
 * Todas las llamadas mandan `credentials: 'include'`: desde la feature
 * `backend_auth`, `/notes/*` exige una sesión válida vía una cookie
 * httpOnly, y el navegador solo la incluye en un pedido cross-origin (el
 * frontend y el backend viven en dominios/puertos distintos) si el `fetch`
 * lo pide explícitamente así — sin esto, cada llamada fallaría con `401`
 * aunque el login haya funcionado.
 */
import { API_BASE_URL, ApiError, readErrorMessage } from './httpClient';
import type { CreateNoteInput, Note, UpdateNoteInput } from '../types';

// Re-exportado para que `CreateNoteForm`/`NoteDetail`/`NotesList`/
// `SearchBox` sigan importando `ApiError` desde `notesApi.ts` como ya
// hacían, sin tener que tocarlos — la definición real ahora vive en
// `httpClient.ts` (ver ese archivo para el porqué).
export { ApiError };

/** Obtiene todas las notas desde `GET /notes`. */
export async function getNotes(): Promise<Note[]> {
  const response = await fetch(`${API_BASE_URL}/notes`, { credentials: 'include' });

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
    credentials: 'include',
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
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, { credentials: 'include' });

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
    credentials: 'include',
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
    credentials: 'include',
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
  const response = await fetch(`${API_BASE_URL}/notes/search?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al buscar notas`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as Note[];
}
