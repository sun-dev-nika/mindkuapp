/**
 * Resolvers GraphQL: llaman directo a las mismas funciones de
 * `backend/src/db.ts` que ya usa `routes/notes.ts` para REST (`listNotes`,
 * `getNoteById`, `createNote`, `updateNote`, `deleteNote`) — no existe una
 * segunda capa de acceso a datos para GraphQL, ni SQL propio acá. Cada
 * función de `db.ts` recibe `context.userId` (resuelto en `./context.ts` a
 * partir de la misma cookie de sesión que REST) como primer argumento, igual
 * que las rutas REST le pasan `req.userId as number` — el aislamiento entre
 * usuarios lo sigue garantizando el `WHERE user_id = ?` de cada query en
 * `db.ts`, no un chequeo adicional acá.
 *
 * Las validaciones de input (`title` no vacío, `body` string o null)
 * duplican las de `routes/notes.ts` porque GraphQL y REST son dos capas de
 * transporte independientes, cada una responsable de validar lo que recibe
 * antes de llamar a `db.ts` — igual que REST no reutiliza la validación de
 * GraphQL. Ambas aplican exactamente las mismas reglas para que las dos
 * interfaces acepten y rechacen los mismos valores.
 */
import { GraphQLError } from 'graphql';

import { createNote, deleteNote, getNoteById, listNotes, updateNote } from '../db';
import type { CreateNoteInput, Note, UpdateNoteInput } from '../types';
import type { GraphQLContext } from './context';

function notFoundError(): GraphQLError {
  return new GraphQLError('Nota no encontrada', { extensions: { code: 'NOT_FOUND' } });
}

function validateTitle(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GraphQLError('title es requerido y debe ser un string no vacío', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  return value.trim();
}

/** `undefined` = campo ausente (no tocar en la BD); `string | null` = valor provisto. */
function validateOptionalBody(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== null && typeof value !== 'string') {
    throw new GraphQLError('body debe ser un string si se proporciona', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  return value;
}

function parseCreateNoteInput(input: unknown): CreateNoteInput {
  const candidate = input as Record<string, unknown> | null | undefined;
  const title = validateTitle(candidate?.title);
  const body = validateOptionalBody(candidate?.body);
  return { title, body: body ?? null };
}

function parseUpdateNoteInput(input: unknown): UpdateNoteInput {
  const candidate = input as Record<string, unknown> | null | undefined;
  const result: UpdateNoteInput = {};

  if (candidate?.title !== undefined) {
    result.title = validateTitle(candidate.title);
  }

  const body = validateOptionalBody(candidate?.body);
  if (body !== undefined) {
    result.body = body;
  }

  if (result.title === undefined && result.body === undefined) {
    throw new GraphQLError('debe proporcionar al menos title o body para actualizar', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  return result;
}

/** Parsea el `ID!` de GraphQL (siempre string) a un entero positivo. */
function parseNoteId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw notFoundError();
  }
  return id;
}

export const resolvers = {
  Query: {
    notes: (_parent: unknown, _args: unknown, context: GraphQLContext): Promise<Note[]> => {
      return listNotes(context.userId);
    },
    note: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ): Promise<Note> => {
      const id = parseNoteId(args.id);
      const note = await getNoteById(context.userId, id);
      if (!note) {
        throw notFoundError();
      }
      return note;
    },
  },
  Mutation: {
    createNote: (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ): Promise<Note> => {
      const input = parseCreateNoteInput(args.input);
      return createNote(context.userId, input);
    },
    updateNote: async (
      _parent: unknown,
      args: { id: string; input: unknown },
      context: GraphQLContext,
    ): Promise<Note> => {
      const id = parseNoteId(args.id);
      const input = parseUpdateNoteInput(args.input);
      const note = await updateNote(context.userId, id, input);
      if (!note) {
        throw notFoundError();
      }
      return note;
    },
    deleteNote: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ): Promise<boolean> => {
      const id = parseNoteId(args.id);
      const wasDeleted = await deleteNote(context.userId, id);
      if (!wasDeleted) {
        throw notFoundError();
      }
      return true;
    },
  },
};
