/**
 * Contexto de cada request GraphQL: resuelve el usuario autenticado leyendo
 * la misma cookie de sesión que usa `middleware/requireAuth.ts` para REST
 * (mismo `SESSION_COOKIE_NAME` + `verifySessionToken` de `../auth`) — no hay
 * una segunda implementación de la lógica de autenticación, solo un punto de
 * entrada distinto para la misma verificación. A diferencia de
 * `requireAuth.ts` (que corta la petición con `next(new ApiError(401, ...))`
 * dentro del pipeline de middleware de Express), acá se lanza un
 * `GraphQLError` con `extensions.http.status: 401` — un error lanzado desde
 * `context` (a diferencia de uno lanzado dentro de un resolver) hace que
 * Apollo Server corte la petición ANTES de ejecutar el query/mutation y
 * responda con ese código HTTP explícito en vez del 200 usual de GraphQL,
 * que es exactamente el mismo 401 que devuelve REST para "no hay sesión" o
 * "sesión inválida" — mismo código, mismo significado, distinto transporte.
 */
import type { Request } from 'express';
import { GraphQLError } from 'graphql';

import { SESSION_COOKIE_NAME, verifySessionToken } from '../auth';

export interface GraphQLContext {
  userId: number;
}

export async function buildContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];

  if (typeof token !== 'string') {
    throw new GraphQLError('No hay sesión activa', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }

  const userId = verifySessionToken(token);
  if (userId === null) {
    throw new GraphQLError('Sesión inválida o expirada', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }

  return { userId };
}
