import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';

import { RequireAuth } from './components/RequireAuth';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { RegisterPage } from './pages/RegisterPage';

/**
 * Las rutas de la aplicación, separadas de `App` (que solo envuelve esto en
 * un `BrowserRouter`) para poder testearlas con `MemoryRouter` sin duplicar
 * el árbol real — ver `AppRoutes.test.tsx` y `docs/architecture.md`
 * principio 6.
 *
 * `/login` y `/register` son las únicas rutas públicas (no exigen sesión);
 * `/` y `/notes/:id` están envueltas en `RequireAuth`, que redirige a
 * `/login` si no hay sesión activa (criterio de aceptación 3).
 */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/notes/:id"
        element={
          <RequireAuth>
            <NoteDetailPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
