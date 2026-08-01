import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { NoteDetailPage } from './pages/NoteDetailPage';

/**
 * Las rutas de la aplicación, separadas de `App` (que solo envuelve esto en
 * un `BrowserRouter`) para poder testearlas con `MemoryRouter` sin duplicar
 * el árbol real — ver `AppRoutes.test.tsx` y `docs/architecture.md`
 * principio 6.
 */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/notes/:id" element={<NoteDetailPage />} />
    </Routes>
  );
}
