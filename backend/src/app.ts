import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { checkDbConnection } from './db';
import { ApiError } from './errors';
import { buildContext, type GraphQLContext } from './graphql/context';
import { resolvers } from './graphql/resolvers';
import { typeDefs } from './graphql/schema';
import { requireAuth } from './middleware/requireAuth';
import { authRouter } from './routes/auth';
import { notesRouter } from './routes/notes';

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

/**
 * Orígenes autorizados a hacer peticiones cross-origin al backend (CORS).
 * Sin esto, un navegador real bloquea el `fetch` del frontend (Vite dev en
 * `localhost:5173`, o el dominio de producción) porque corre en un puerto/
 * dominio distinto al del backend — Supertest y `msw` nunca lo detectan
 * porque ninguno de los dos pasa por un navegador real.
 *
 * `FRONTEND_ORIGIN` acepta uno o varios orígenes separados por coma (por
 * ejemplo `http://localhost:5173,https://notes-web.vercel.app`), para poder
 * tener development y producción habilitados a la vez durante una
 * transición de deploy, sin tener que tocar código — solo la variable de
 * entorno del hosting. Default a `http://localhost:5173` (Vite dev) si no
 * se define nada. Deliberadamente NO se usa `origin: '*'` (cualquier
 * origen): desde la feature `backend_auth` el backend maneja cookies de
 * sesión, y con `credentials: true` la especificación de CORS ni siquiera
 * permite combinar eso con `origin: '*'` — hay que listar orígenes
 * concretos.
 */
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN)
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const app = express();

/**
 * En AWS (feature `aws_deploy`) el frontend (S3) y el backend (EC2) quedan
 * detrás del MISMO dominio de CloudFront, que enruta por patrón de path
 * (`/notes*` → backend, todo lo demás → `index.html` del SPA) porque una
 * distribución de CloudFront no puede decidir por "es una API" vs. "es una
 * ruta de React Router" — solo mira el path. El problema real: la feature 11
 * define `/notes/:id` como ruta del SPA (link compartible a una nota), que
 * colisiona exactamente con `/notes/:id` del backend (ver `id` en
 * `notes.ts`). Verificado en producción: `GET /notes/1/x` volvía un 401 del
 * backend en vez de servir `index.html`, o sea que abrir el link de una nota
 * en el navegador se rompía.
 *
 * La solución NO es un prefijo distinto en el SPA (`/notes/:id` es un
 * requisito ya cerrado de la feature 11, no se toca) sino exponer la API
 * completa TAMBIÉN bajo `/api` — así el behavior de CloudFront puede
 * apuntar `/api/*` al backend sin ambigüedad, dejando `/notes/*` libre para
 * que siempre resuelva al SPA. Las rutas sin prefijo (`/notes`,
 * `/auth/...`, `/graphql`, `/health`) se mantienen intactas para no romper
 * los tests existentes ni el deploy vivo de Railway (que no tiene este
 * problema porque frontend y backend están en dominios separados). Montar
 * los mismos routers bajo ambos prefijos con un loop evita duplicar cada
 * ruta a mano y mantiene un solo lugar de verdad por endpoint.
 */
const API_PREFIXES = ['', '/api'] as const;

// `credentials: true` es lo que le dice al navegador "está bien mandar/
// aceptar cookies en peticiones cross-origin a este backend" — sin esto, la
// cookie de sesión (httpOnly, fijada por POST /auth/login) nunca viajaría de
// vuelta al backend en pedidos posteriores desde el frontend, aunque el
// origen esté permitido. El frontend, del otro lado, tiene que mandar cada
// `fetch` con `credentials: 'include'` para que el navegador incluya la
// cookie (eso es responsabilidad de la feature `frontend_auth`, no de acá).
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

/**
 * Deliberadamente SIN `requireAuth`: lo consume el healthcheck de Docker/EC2
 * (feature `aws_deploy`), que no tiene ni puede tener una cookie de sesión.
 * Hace un `SELECT 1` real contra el pool de `db.ts` en vez de responder 200
 * sin más — así un contenedor "arriba" pero con la DB caída (RDS
 * inalcanzable, credenciales rotadas, etc.) se reporta como no saludable en
 * vez de pasar el healthcheck igual. El 503 no incluye el detalle del error
 * (mismo criterio que el middleware de error de abajo: nunca se filtra un
 * mensaje interno al cliente).
 */
async function healthHandler(_req: Request, res: Response): Promise<void> {
  const dbOk = await checkDbConnection();
  if (!dbOk) {
    res.status(503).json({ status: 'error', db: 'unreachable' });
    return;
  }
  res.status(200).json({ status: 'ok', db: 'ok' });
}

for (const prefix of API_PREFIXES) {
  app.get(`${prefix}/health`, healthHandler);
  app.use(`${prefix}/auth`, authRouter);
  // `requireAuth` se monta ACÁ, antes de `notesRouter` y después de
  // `authRouter`: todo `/notes/*` (y `/api/notes/*`) exige sesión válida,
  // pero `/auth/register` y `/auth/login` (que todavía no tienen sesión) no
  // pasan por este middleware.
  app.use(`${prefix}/notes`, requireAuth, notesRouter);
}

/**
 * `/graphql` es una capa alternativa sobre el mismo dominio de notas, no un
 * segundo backend: expone el mismo schema (`type Note`, queries `notes` /
 * `note`, mutations `createNote` / `updateNote` / `deleteNote`) y aplica la
 * misma autenticación por cookie de sesión que REST, pero resuelta en
 * `graphql/context.ts` en vez de en un middleware de Express montado antes
 * de la ruta. `buildContext` marca el error de "sin sesión"/"sesión
 * inválida" con `extensions.http.status: 401` (ver `graphql/context.ts`),
 * así que la respuesta HTTP sigue siendo un 401 real, igual que REST — no el
 * 200 que usa GraphQL por defecto para errores de resolver.
 *
 * Introspección habilitada solo fuera de producción: sirve para explorar el
 * schema en desarrollo (Apollo Sandbox u otro cliente GraphQL) sin exponer
 * el schema completo de un backend público en producción.
 */
const apolloServer = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  // `docs/architecture.md` prohíbe filtrar un stack trace al cliente en
  // cualquier respuesta (no solo en el middleware de error REST) — sin
  // esto, Apollo Server incluye el stack de cada error en `extensions`
  // mientras `NODE_ENV` no sea `production`, que es exactamente cuando más
  // se prueba y depura manualmente este endpoint.
  includeStacktraceInErrorResponses: false,
});

/**
 * `ApolloServer#start()` es asíncrono (inicializa plugins internos) y debe
 * completarse antes de montar `expressMiddleware`, así que no puede hacerse
 * de forma síncrona al construir `app` como el resto de las rutas. Se expone
 * esta promesa para que los tests de GraphQL puedan esperarla en
 * `beforeAll` antes de mandar la primera petición a `/graphql` — los tests
 * REST no la necesitan porque nunca tocan esa ruta.
 */
export const graphqlServerReady: Promise<void> = apolloServer.start().then(() => {
  for (const prefix of API_PREFIXES) {
    app.use(
      `${prefix}/graphql`,
      express.json(),
      expressMiddleware(apolloServer, { context: buildContext }),
    );
  }
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express solo reconoce
// middleware de error si tiene 4 parámetros; `next` es obligatorio aunque no se use.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // `console.error` acá es un log de servidor para un error inesperado (no
  // `ApiError`, es decir algo que no debería pasar), distinto del
  // `console.log` de debug suelto que prohíbe docs/architecture.md — esa
  // regla apunta a no mezclar logs de depuración con la respuesta al
  // cliente, no a dejar el servidor sin visibilidad de errores reales. La
  // respuesta al cliente sigue siendo genérica (nunca se filtra el detalle
  // ni el stack); el detalle real queda en stderr, donde el hosting
  // (Railway) lo captura en sus "Deploy Logs" para poder diagnosticar.
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});
