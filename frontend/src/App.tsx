import type { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from './AppRoutes';

/**
 * Raíz de la aplicación: shell puro de routing (ver `docs/architecture.md`
 * principio 6). No contiene JSX de dominio propio — solo envuelve
 * `AppRoutes` en un `BrowserRouter` (URLs reales del navegador, necesarias
 * para que `/notes/<id>` sea un link compartible de verdad). Separado de
 * `AppRoutes` a propósito: así los tests pueden montar `AppRoutes` dentro
 * de un `MemoryRouter` sin arrastrar un `BrowserRouter` real.
 */
export function App(): ReactElement {
  return (
    <BrowserRouter>
      <main>
        <AppRoutes />
      </main>
    </BrowserRouter>
  );
}
