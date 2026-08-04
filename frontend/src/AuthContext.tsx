import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from './api/authApi';
import type { AuthUser } from './types';

/**
 * Estado de sesión explícito (mismo criterio que el resto del proyecto,
 * nunca un `null` silencioso): `loading` mientras `GET /auth/me` todavía no
 * respondió, y recién ahí `authenticated`/`unauthenticated`. `RequireAuth`
 * usa esta distinción para no redirigir a `/login` de forma prematura antes
 * de saber si en realidad hay sesión.
 */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provee el estado de autenticación a toda la app. Al montar, consulta
 * `GET /auth/me` una única vez para saber si ya hay una sesión activa
 * (criterio de aceptación 2) antes de que cualquier ruta protegida decida
 * qué mostrar.
 */
export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        // Cualquier error acá (401 sin sesión, o cualquier otra falla
        // inesperada de red) se trata igual, como "no autenticado": el
        // default más seguro ante una duda es pedir login, nunca asumir que
        // hay sesión válida cuando la petición de chequeo falló.
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const loggedInUser = await loginRequest({ email, password });
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  /**
   * Registra una cuenta nueva. NO deja al usuario autenticado por sí sola
   * (el backend no fija cookie en `POST /auth/register`) — `status`/`user`
   * no cambian acá. `RegisterPage` es quien decide encadenar `login` con
   * las mismas credenciales para cumplir "registro exitoso... deja ver las
   * notas del usuario" (criterio de aceptación 4).
   */
  const register = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    return registerRequest({ email, password });
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value: AuthContextValue = { status, user, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook para leer el estado de sesión y las acciones de auth desde cualquier componente. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  }
  return context;
}
