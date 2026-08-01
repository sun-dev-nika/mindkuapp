/** Clase de error del dominio: transporta el código HTTP junto al mensaje. */

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
