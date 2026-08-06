// Carga `backend/.env` (si existe) en `process.env` *antes* de importar `./app`
// — los imports ES se evalúan en el orden en que aparecen, así esta línea
// corre antes de que `app.ts` importe transitivamente `db.ts` (crea el pool
// de MySQL al importarse) y `auth.ts` (lanza al importarse si falta
// JWT_SECRET). Por defecto `dotenv` NO sobreescribe variables ya presentes en
// `process.env` ni lanza si el archivo no existe, así que en producción
// (Railway inyecta las variables por plataforma, sin `.env`) esto es un
// no-op. Solo va acá, en el entry point — `app.ts` lo importan los tests
// directamente sin pasar por `server.ts`, y `tests/jest.setup.ts` ya fija sus
// propias variables antes de esos imports.
import 'dotenv/config';

import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  process.stdout.write(`notes-web backend escuchando en el puerto ${PORT}\n`);
});
