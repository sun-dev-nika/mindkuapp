/**
 * Se carga una vez antes de correr los tests (ver `test.setupFiles` en
 * `vite.config.ts`). Registra los matchers de jest-dom (`toBeInTheDocument`,
 * etc.) y levanta/apaga el servidor MSW alrededor de toda la corrida, con
 * `resetHandlers` entre tests para que un `server.use(...)` de un test no
 * se filtre al siguiente.
 */
import '@testing-library/jest-dom';

import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
