import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../AuthContext';

export interface RequireAuthProps {
  children: ReactElement;
}

/**
 * Envuelve una página que exige sesión activa (`/` y `/notes/:id`, ver
 * `AppRoutes.tsx`). Mientras `AuthProvider` todavía no resolvió
 * `GET /auth/me` (`status === 'loading'`), muestra un mensaje simple en vez
 * de decidir apurado y potencialmente redirigir a `/login` a alguien que en
 * realidad sí tiene sesión. Si no hay sesión, redirige a `/login` con
 * `replace` (no agrega una entrada al historial), para que el botón
 * "atrás" del navegador no vuelva a una página protegida vacía.
 */
export function RequireAuth({ children }: RequireAuthProps): ReactElement {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <p role="status" className="term-muted">
        Cargando…
      </p>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
