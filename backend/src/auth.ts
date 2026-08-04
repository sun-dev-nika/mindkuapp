/**
 * Mecánica de autenticación: hasheo de contraseñas (bcrypt) y firma/
 * verificación de la sesión (JWT guardado en una cookie httpOnly). Es la
 * única capa que conoce estos detalles — `routes/auth.ts` y
 * `middleware/requireAuth.ts` la usan sin saber cómo se calcula un hash o
 * cómo está armado el token, mismo principio de capas que `db.ts` para
 * MySQL (ver docs/architecture.md).
 */
import bcrypt from 'bcrypt';
import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Costo del hasheo de `bcrypt` (cuántas rondas de salting/stretching).
 * 10 es el default recomendado por la librería: suficientemente lento para
 * dificultar ataques de fuerza bruta sin volver el registro/login
 * perceptiblemente lento para un usuario real.
 */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Sin default hardcodeado a propósito: firmar sesiones con un secreto
 * conocido/predecible en producción permitiría a cualquiera fabricar un JWT
 * válido para cualquier usuario. Si no está definido, la app falla al
 * arrancar (ver más abajo) en vez de arrancar "igual" con un secreto
 * inseguro — ver backend/.env.example para cómo fijarlo.
 */
const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error(
    'JWT_SECRET no está definido. Copiá backend/.env.example a .env y fijá un secreto real ' +
      '(en producción, nunca el valor de ejemplo del archivo).',
  );
}
// Reasignado a una constante con tipo `string` explícito (no `string |
// undefined`): TypeScript angosta `rawJwtSecret` hasta acá por el `if` de
// arriba, pero esa angostura no sobrevive dentro de las funciones definidas
// más abajo si se sigue usando `rawJwtSecret` directamente (closures capturan
// el tipo declarado de la variable, no su angostura puntual).
const JWT_SECRET: string = rawJwtSecret;

/** Cuánto dura una sesión antes de que haga falta volver a loguearse. */
const JWT_EXPIRES_IN = '7d';

/** Nombre de la cookie de sesión. */
export const SESSION_COOKIE_NAME = 'notes_session';

interface SessionTokenPayload {
  userId: number;
}

/** Hashea una contraseña en texto plano. Nunca se guarda ni se compara en texto plano. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

/** Compara una contraseña en texto plano contra un hash ya guardado. */
export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/** Firma un JWT de sesión para `userId`, válido por `JWT_EXPIRES_IN`. */
export function signSessionToken(userId: number): string {
  const payload: SessionTokenPayload = { userId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifica un JWT de sesión. Devuelve el `userId` si el token es válido y no
 * expiró, o `null` en cualquier otro caso (firma inválida, expirado,
 * formato inesperado) — nunca lanza, para que quien llame decida el código
 * HTTP (401) sin tener que conocer las excepciones internas de `jsonwebtoken`.
 */
export function verifySessionToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.userId === 'number') {
      return decoded.userId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Frontend y backend viven en dominios/puertos distintos tanto en
 * desarrollo (`localhost:5173` / `localhost:3000`) como en producción
 * (`*.vercel.app` / `*.railway.app`), así que la cookie de sesión siempre
 * viaja cross-origin. En producción (HTTPS real) hace falta `SameSite=None`
 * + `Secure` para que el navegador la mande en esas peticiones cross-site.
 * En desarrollo, en cambio, los navegadores rechazan cookies `Secure` sobre
 * `http://` (no HTTPS) — ahí se usa `SameSite=Lax` sobre HTTP normal, que
 * alcanza porque `localhost:5173` y `localhost:3000` cuentan como
 * "same-site" (mismo dominio registrable, solo cambia el puerto) aunque
 * sean orígenes CORS distintos.
 */
function sessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

/** Fija la cookie de sesión httpOnly con el JWT ya firmado. */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días, igual que JWT_EXPIRES_IN.
  });
}

/**
 * Limpia la cookie de sesión (logout). A propósito NO manda `maxAge`: Express
 * ya marca `clearCookie` como "reemplazar por una fecha de expiración en el
 * pasado" automáticamente, y pasarle `maxAge` genera un warning de
 * deprecación (Express 5 va a ignorar esa opción acá).
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
}
