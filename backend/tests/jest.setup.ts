/**
 * Se ejecuta antes de cargar cualquier archivo de test (ver `setupFiles` en
 * jest.config.js). Fija las variables de entorno de conexión a MySQL *antes*
 * de que `src/db.ts` cree el pool (los imports de ES module se resuelven al
 * inicio del archivo de test, así que fijarlas dentro del test llegaría
 * tarde). Por defecto apunta a la base de datos de test real `notes_test`.
 */
process.env.NOTES_DB_HOST = process.env.NOTES_DB_HOST || '127.0.0.1';
process.env.NOTES_DB_PORT = process.env.NOTES_DB_PORT || '3306';
process.env.NOTES_DB_USER = process.env.NOTES_DB_USER || 'root';
process.env.NOTES_DB_PASSWORD = process.env.NOTES_DB_PASSWORD || 'notes_dev_root_pw';
process.env.NOTES_DB_NAME = process.env.NOTES_DB_NAME || 'notes_test';

/**
 * `backend/src/auth.ts` lanza al importarse si `JWT_SECRET` no está
 * definido (a propósito, ver ese archivo) — hace falta fijar uno acá, antes
 * de que `src/app.ts` (y transitivamente `src/auth.ts`) se importen, igual
 * que las variables de MySQL de arriba. No es un secreto real ni se usa
 * fuera de esta corrida de tests.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-test-secret-not-for-production-use';
