/** Configuración de Jest para el backend (Jest + Supertest + ts-jest). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  // Se ejecuta después de instalar el framework de Jest (permite `beforeAll`):
  // hace un "warm-up" real de la conexión a MySQL antes de correr tests.
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setupAfterEnv.ts'],
  // El contenedor Docker de MySQL puede estar bajo contención en corridas
  // repetidas (visto en revisión: timeouts de 5000ms por defecto en el
  // bloque PUT sin evidencia de leak de conexiones). Se sube el timeout
  // global de test a un valor generoso para absorber esa lentitud real del
  // entorno sin ocultar fallos de lógica genuinos.
  testTimeout: 30000,
  verbose: true,
};
