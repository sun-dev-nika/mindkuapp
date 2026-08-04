import { Router, type NextFunction, type Request, type Response } from 'express';

import { clearSessionCookie, hashPassword, setSessionCookie, signSessionToken, verifyPassword } from '../auth';
import { createUser, getUserByEmail, getUserById, type UserRecord } from '../db';
import { ApiError } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import type { AuthUser, LoginInput, RegisterInput } from '../types';

export const authRouter = Router();

/** Largo mínimo de contraseña: un piso de sanidad, no una política estricta de complejidad. */
const MIN_PASSWORD_LENGTH = 8;

/** Chequeo de forma, no de RFC 5322 completo — mismo criterio de "sanity limit" que `notes.title`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toAuthUser(user: UserRecord): AuthUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

/**
 * Valida y normaliza un email: recorta espacios y lo pasa a minúsculas antes
 * de comparar/guardar, para que "Ana@Example.com" y "ana@example.com" sean
 * la misma cuenta (el `UNIQUE` de `users.email` en MySQL es sensible a
 * mayúsculas con la collation de este proyecto — normalizar en la app es más
 * explícito que depender de la collation de la base para esto).
 */
function validateEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'email es requerido y debe ser un string');
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || !EMAIL_PATTERN.test(normalized)) {
    throw new ApiError(400, 'email no tiene un formato válido');
  }
  return normalized;
}

function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `password es requerido y debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  return value;
}

function parseRegisterInput(body: unknown): RegisterInput {
  const candidate = body as Record<string, unknown> | null | undefined;
  return {
    email: validateEmail(candidate?.email),
    password: validatePassword(candidate?.password),
  };
}

/**
 * A diferencia de `parseRegisterInput`, acá NO se valida el largo mínimo de
 * la contraseña: eso es una regla de "cómo se crean contraseñas nuevas", no
 * de login. Si se exigiera acá, una contraseña real más corta que el mínimo
 * actual (por ejemplo, creada antes de subir el mínimo) nunca podría volver
 * a iniciar sesión. Sí se sigue exigiendo que sea un string no vacío.
 */
function parseLoginInput(body: unknown): LoginInput {
  const candidate = body as Record<string, unknown> | null | undefined;
  const email = validateEmail(candidate?.email);
  const password = candidate?.password;
  if (typeof password !== 'string' || password.length === 0) {
    throw new ApiError(400, 'password es requerido');
  }
  return { email, password };
}

/** `true` si `err` es el error de MySQL para una fila `UNIQUE` duplicada (`ER_DUP_ENTRY`). */
function isDuplicateEmailError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ER_DUP_ENTRY'
  );
}

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseRegisterInput(req.body);

    // Chequeo "amigable" primero (evita el hasheo si el email ya está
    // tomado, más rápido para el caso común); la constraint UNIQUE de
    // `users.email` sigue siendo la última línea de defensa real contra una
    // condición de carrera entre dos registros simultáneos con el mismo
    // email (ver el catch de abajo).
    const existing = await getUserByEmail(input.email);
    if (existing) {
      throw new ApiError(409, 'Ya existe una cuenta con ese email');
    }

    const passwordHash = await hashPassword(input.password);

    let user: UserRecord;
    try {
      user = await createUser(input.email, passwordHash);
    } catch (err) {
      if (isDuplicateEmailError(err)) {
        throw new ApiError(409, 'Ya existe una cuenta con ese email');
      }
      throw err;
    }

    res.status(201).json(toAuthUser(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseLoginInput(req.body);

    // Mensaje y status idénticos tanto si el email no existe como si la
    // contraseña es incorrecta: distinguir esos dos casos le confirmaría a
    // quien ataca qué emails están registrados (criterio de aceptación
    // explícito). `invalidCredentials` es una sola función para no arriesgar
    // que el mensaje diverja entre las dos ramas por accidente.
    const invalidCredentials = (): ApiError => new ApiError(401, 'Email o contraseña incorrectos');

    const user = await getUserByEmail(input.email);
    if (!user) {
      throw invalidCredentials();
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw invalidCredentials();
    }

    const token = signSessionToken(user.id);
    setSessionCookie(res, token);
    res.status(200).json(toAuthUser(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // `requireAuth` ya garantiza `req.userId` numérico o corta con 401 antes
    // de llegar acá.
    const user = await getUserById(req.userId as number);
    if (!user) {
      // Caso borde: el JWT es válido pero el usuario que describe ya no
      // existe (por ejemplo, se borró la cuenta después de emitir el token).
      throw new ApiError(401, 'Sesión inválida');
    }
    res.status(200).json(toAuthUser(user));
  } catch (err) {
    next(err);
  }
});
