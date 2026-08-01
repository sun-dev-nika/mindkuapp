/**
 * Se ejecuta una vez por archivo de test, después de instalar el framework de
 * Jest (a diferencia de `jest.setup.ts`, aquí ya existen globals como
 * `beforeAll`). Hace un "warm-up" real del pool de conexiones a MySQL antes
 * de que corra cualquier test: la primera conexión al contenedor Docker
 * puede ser notablemente más lenta que las siguientes, y sin este warm-up
 * ese costo cae dentro del primer test/hook en vez de en un paso de setup
 * explícito, lo que puede agotar el timeout por test bajo contención.
 */
import { pool } from '../src/db';

beforeAll(async () => {
  await pool.query('SELECT 1');
});
