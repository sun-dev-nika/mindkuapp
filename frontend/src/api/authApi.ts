/**
 * Cliente REST tipado de autenticación. Junto con `notesApi.ts`, es una de
 * las dos únicas capas del frontend que hablan con el backend — separado de
 * `notesApi.ts` porque es un dominio distinto (usuarios/sesión, no notas),
 * mismo criterio de "un archivo, una responsabilidad" que ya separa
 * `routes/auth.ts` de `routes/notes.ts` en el backend. Comparte
 * `ApiError`/`readErrorMessage`/`API_BASE_URL` con `notesApi.ts` vía
 * `httpClient.ts` (ver ese archivo).
 */
import { API_BASE_URL, ApiError, readErrorMessage } from './httpClient';
import type { AuthUser } from '../types';

export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Crea una cuenta nueva vía `POST /auth/register`. A propósito NO inicia
 * sesión: el backend no fija ninguna cookie en esta respuesta (solo
 * `login` lo hace) — quien llame decide si encadenar un `login` después
 * (ver `RegisterPage.tsx`).
 */
export async function register(credentials: AuthCredentials): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al registrarse`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as AuthUser;
}

/**
 * Inicia sesión vía `POST /auth/login`. Si las credenciales son correctas,
 * el backend fija una cookie httpOnly de sesión en la respuesta — el
 * navegador la guarda solo, este código nunca la lee ni la manipula
 * directamente.
 */
export async function login(credentials: AuthCredentials): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al iniciar sesión`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as AuthUser;
}

/** Cierra la sesión vía `POST /auth/logout` (limpia la cookie del lado del backend). */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const fallback = `Error ${response.status} al cerrar sesión`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }
}

/**
 * Devuelve el usuario autenticado vía `GET /auth/me`, o lanza `ApiError`
 * con `statusCode: 401` si no hay sesión válida — `AuthContext` usa
 * exactamente esa distinción para decidir el estado inicial de la app.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });

  if (!response.ok) {
    const fallback = `Error ${response.status} al obtener el usuario actual`;
    throw new ApiError(response.status, await readErrorMessage(response, fallback));
  }

  return (await response.json()) as AuthUser;
}
