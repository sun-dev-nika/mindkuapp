import type { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from './AppRoutes';
import { AuthProvider } from './AuthContext';

/**
 * Raíz de la aplicación: shell puro de routing (ver `docs/architecture.md`
 * principio 6), más `AuthProvider` (feature `frontend_auth`) envolviendo
 * todo — así cualquier ruta (pública o protegida) puede leer el estado de
 * sesión con `useAuth()`. No contiene JSX de dominio propio — solo envuelve
 * `AppRoutes` en un `BrowserRouter` (URLs reales del navegador, necesarias
 * para que `/notes/<id>` sea un link compartible de verdad). Separado de
 * `AppRoutes` a propósito: así los tests pueden montar `AppRoutes` dentro
 * de un `MemoryRouter` sin arrastrar un `BrowserRouter` real.
 */
export function App(): ReactElement {
  return (
    <BrowserRouter>
      <AuthProvider>
        <main>
          <AppRoutes />
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
