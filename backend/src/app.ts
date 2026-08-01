import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { ApiError } from './errors';
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
 * entorno del hosting (ver feature 10, todavía pendiente). Default a
 * `http://localhost:5173` (Vite dev) si no se define nada. Deliberadamente
 * NO se usa `origin: '*'` (cualquier origen): aunque este MVP no tiene
 * autenticación todavía, permitir cualquier origen de forma descuidada es
 * un hábito peligroso si más adelante se agregan cookies/sesiones.
 */
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN)
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const app = express();

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use('/notes', notesRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express solo reconoce
// middleware de error si tiene 4 parámetros; `next` es obligatorio aunque no se use.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Error interno del servidor' });
});
