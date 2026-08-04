/**
 * Utilidades HTTP compartidas entre `notesApi.ts` y `authApi.ts`: la URL
 * base del backend, el error de dominio `ApiError`, y cómo leer un mensaje
 * de error legible del body de una respuesta fallida.
 *
 * Viven acá (y no duplicadas en cada archivo de API) a propósito: si
 * `authApi.ts` definiera su propia clase `ApiError` separada de la de
 * `notesApi.ts`, un componente que compare `err instanceof ApiError`
 * importando desde el archivo "equivocado" podría dar `false` para un error
 * que en los hechos sí es un `ApiError` — dos clases con el mismo nombre no
 * son la misma clase en JavaScript. Con una única definición compartida,
 * ese problema no puede pasar.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Error del dominio: transporta el código HTTP junto al mensaje del backend. */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Intenta leer `{ error: string }` del body de una respuesta fallida (mismo
 * contrato que expone el backend, ver `backend/src/app.ts`). Si el body no
 * es JSON válido o no trae `error`, cae al mensaje de respaldo recibido por
 * parámetro — nunca se propaga un error sin mensaje legible al componente.
 */
export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    const candidate = body as { error?: unknown } | null;
    if (candidate && typeof candidate.error === 'string' && candidate.error.length > 0) {
      return candidate.error;
    }
  } catch {
    // Body no era JSON válido: se usa el mensaje de respaldo.
  }
  return fallback;
}
