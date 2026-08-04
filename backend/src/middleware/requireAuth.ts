/**
 * Middleware de autenticación: lee la cookie de sesión, verifica el JWT, y
 * adjunta `req.userId` para que las rutas protegidas (todo `/notes`, y
 * `GET /auth/me`) sepan de quién es la petición sin tener que volver a leer
 * la cookie ellas mismas. 401 si no hay cookie o el token es inválido/expiró
 * — nunca deja pasar la petición "por las dudas".
 */
import type { NextFunction, Request, Response } from 'express';

import { SESSION_COOKIE_NAME, verifySessionToken } from '../auth';
import { ApiError } from '../errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Es la forma
  // estándar de Express para extender `Request` con campos propios de la app.
  namespace Express {
    interface Request {
      /** Id del usuario autenticado. Solo presente después de `requireAuth`. */
      userId?: number;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];

  if (typeof token !== 'string') {
    next(new ApiError(401, 'No hay sesión activa'));
    return;
  }

  const userId = verifySessionToken(token);
  if (userId === null) {
    next(new ApiError(401, 'Sesión inválida o expirada'));
    return;
  }

  req.userId = userId;
  next();
}
