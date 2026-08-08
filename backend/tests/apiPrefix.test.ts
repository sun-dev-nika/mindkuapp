import request from 'supertest';

import { app } from '../src/app';
import { pool } from '../src/db';

/**
 * Cubre el prefijo `/api` que expone `backend/src/app.ts` sobre TODA la API
 * (ver el comentario ahí mismo): en el despliegue de AWS detrás de
 * CloudFront, `/notes/:id` es a la vez ruta del SPA (feature
 * `frontend_routing_note_links`) y ruta del backend, y CloudFront enruta por
 * path — por eso el backend expone también `/api/notes`, `/api/auth/...`,
 * `/api/graphql` y `/api/health`, sin dejar de responder en las rutas sin
 * prefijo (que siguen probadas en el resto de `tests/`). No se repiten acá
 * los casos ya cubiertos por `notes.test.ts`/`auth.test.ts` sobre las rutas
 * sin prefijo: solo se confirma que el prefijo `/api` enruta al mismo
 * comportamiento.
 */
async function clearNotesTable(): Promise<void> {
  await pool.query('DELETE FROM notes');
}

async function clearUsersTable(): Promise<void> {
  await pool.query('DELETE FROM users');
}

let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  agent = request.agent(app);
  const email = `api-prefix-test-${Date.now()}@example.com`;
  const password = 'api-prefix-test-password-123';
  await agent.post('/auth/register').send({ email, password });
  await agent.post('/auth/login').send({ email, password });
});

afterAll(async () => {
  await clearNotesTable();
  await clearUsersTable();
  await pool.end();
});

describe('GET /api/health', () => {
  it('returns_200_ok_with_db_ok_same_as_the_unprefixed_route', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('GET /api/notes without a session', () => {
  it('returns_401_same_as_the_unprefixed_route', async () => {
    const res = await request(app).get('/api/notes');

    expect(res.status).toBe(401);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('/api/notes with a valid session', () => {
  it('creates_a_note_via_the_api_prefix_and_reads_it_back_via_the_api_prefix', async () => {
    const createRes = await agent
      .post('/api/notes')
      .send({ title: 'Nota vía /api', body: 'creada bajo el prefijo /api' });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      title: 'Nota vía /api',
      body: 'creada bajo el prefijo /api',
    });

    const getRes = await agent.get(`/api/notes/${createRes.body.id}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({ id: createRes.body.id, title: 'Nota vía /api' });
  });
});
