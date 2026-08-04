import { Router, type NextFunction, type Request, type Response } from 'express';

import { createNote, deleteNote, getNoteById, listNotes, searchNotes, updateNote } from '../db';
import { ApiError } from '../errors';
import type { CreateNoteInput, UpdateNoteInput } from '../types';

// Todas las rutas de este router se montan después de `requireAuth` en
// app.ts, así que `req.userId` siempre está presente acá (nunca `undefined`)
// — de ahí el `as number` en cada handler, en vez de repetir un chequeo que
// ya hizo el middleware.
export const notesRouter = Router();

notesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = await listNotes(req.userId as number);
    res.status(200).json(notes);
  } catch (err) {
    next(err);
  }
});

/** Valida que `value` sea un string no vacío (tras recortar espacios) para `title`. */
function validateTitle(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'title es requerido y debe ser un string no vacío');
  }
  return value.trim();
}

/** Valida que `value` sea un string o `null/undefined` para `body`. */
function validateBody(value: unknown): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new ApiError(400, 'body debe ser un string si se proporciona');
  }
  return value ?? null;
}

function parseCreateNoteInput(body: unknown): CreateNoteInput {
  const candidate = body as Record<string, unknown> | null | undefined;

  const title = validateTitle(candidate?.title);
  const noteBody = validateBody(candidate?.body);

  return { title, body: noteBody };
}

/**
 * Actualización parcial: solo valida y devuelve los campos presentes en el
 * body de la petición. Un campo ausente no se toca en la base de datos (por
 * eso `title`/`body` son opcionales aquí, a diferencia de `parseCreateNoteInput`).
 */
function parseUpdateNoteInput(body: unknown): UpdateNoteInput {
  const candidate = body as Record<string, unknown> | null | undefined;
  const result: UpdateNoteInput = {};

  if (candidate?.title !== undefined) {
    result.title = validateTitle(candidate.title);
  }

  if (candidate?.body !== undefined) {
    result.body = validateBody(candidate.body);
  }

  if (result.title === undefined && result.body === undefined) {
    throw new ApiError(400, 'debe proporcionar al menos title o body para actualizar');
  }

  return result;
}

/** Parsea `:id` a un entero positivo; si no es válido, la nota no puede existir. */
function parseNoteId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(404, 'Nota no encontrada');
  }
  return id;
}

/**
 * Extrae y recorta el parámetro `q` de la query string. Un `q` ausente o
 * vacío (tras recortar espacios) se trata como "sin término de búsqueda":
 * la ruta responde con un array vacío sin llegar a consultar la base de
 * datos, en vez de interpretarlo como "sin filtro" (que devolvería todas
 * las notas) — ver `docs/verification.md` Nivel 0 para la justificación.
 */
function parseSearchQuery(rawQuery: unknown): string {
  return typeof rawQuery === 'string' ? rawQuery.trim() : '';
}

notesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseCreateNoteInput(req.body);
    const note = await createNote(req.userId as number, input);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// Debe registrarse ANTES de `GET /:id`: Express prueba las rutas en el orden
// en que se registran, y `/:id` matchearía "search" como si fuera un id
// (y luego fallaría con 404 por no ser un entero válido) si se registrara
// primero.
notesRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = parseSearchQuery(req.query.q);
    const notes = query.length === 0 ? [] : await searchNotes(req.userId as number, query);
    res.status(200).json(notes);
  } catch (err) {
    next(err);
  }
});

notesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseNoteId(req.params.id);
    const note = await getNoteById(req.userId as number, id);
    if (!note) {
      throw new ApiError(404, 'Nota no encontrada');
    }
    res.status(200).json(note);
  } catch (err) {
    next(err);
  }
});

notesRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseNoteId(req.params.id);
    const input = parseUpdateNoteInput(req.body);
    const note = await updateNote(req.userId as number, id, input);
    if (!note) {
      throw new ApiError(404, 'Nota no encontrada');
    }
    res.status(200).json(note);
  } catch (err) {
    next(err);
  }
});

notesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseNoteId(req.params.id);
    const wasDeleted = await deleteNote(req.userId as number, id);
    if (!wasDeleted) {
      throw new ApiError(404, 'Nota no encontrada');
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
