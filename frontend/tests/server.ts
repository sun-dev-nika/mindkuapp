import { setupServer } from 'msw/node';

/**
 * Servidor MSW compartido por todos los tests: intercepta `fetch` a nivel de
 * red para que los tests de componentes nunca le peguen al backend real.
 * No trae handlers por defecto — cada test registra los suyos con
 * `server.use(...)` (ver `NotesList.test.tsx`).
 */
export const server = setupServer();
