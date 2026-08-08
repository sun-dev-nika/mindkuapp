import request from 'supertest';

import { app, graphqlServerReady } from '../src/app';
import { pool } from '../src/db';

/**
 * Cubre el prefijo `/api` que expone `backend/src/app.ts` sobre TODA la API
 * (ver el comentario ahí mismo): en el despliegue de AWS detrás de
 * CloudFront, `/notes/:id` es a la vez ruta del SPA (feature
 * `frontend_routing_note_links`) y ruta del backend, y CloudFront enruta por
 * path — por eso el backend expone también `/api/notes`, `/api/auth/...`,
 * `/api/graphql` y `/api/health`, sin dejar de responder en las rutas sin
 * prefijo (que siguen probadas en el resto de `tests/`). Cada uno de esos
 * cuatro mounts se ejercita acá con al menos una request real contra su path
 * CON el prefijo `/api` (registro/login/`/me` reales contra `/api/auth/...`,
 * no contra las rutas sin prefijo, y un smoke test de `/api/graphql` con y
 * sin sesión) — así un typo o una regresión futura en cualquiera de los
 * `app.use(`${prefix}/...`, ...)` del loop de `app.ts` lo detecta este
 * archivo, no recién producción.
 */
async function clearNotesTable(): Promise<void> {
  await pool.query('DELETE FROM notes');
}

async function clearUsersTable(): Promise<void> {
  await pool.query('DELETE FROM users');
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const VALID_PASSWORD = 'api-prefix-test-password-123';

/**
 * `agent` se autentica exclusivamente vía `/api/auth/register` y
 * `/api/auth/login` (nunca las rutas sin prefijo): además de servir de
 * sesión compartida para los tests de `/api/notes` y `/api/graphql` de más
 * abajo, esa elección por sí sola ya ejercita el mount de `/api/auth`.
 */
let agent: ReturnType<typeof request.agent>;
let agentEmail: string;

beforeAll(async () => {
  await graphqlServerReady;

  agent = request.agent(app);
  agentEmail = uniqueEmail('api-prefix-shared');
  await agent.post('/api/auth/register').send({ email: agentEmail, password: VALID_PASSWORD });
  await agent.post('/api/auth/login').send({ email: agentEmail, password: VALID_PASSWORD });
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

describe('POST /api/auth/register', () => {
  it('creates_a_user_via_the_api_prefix_and_returns_201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('api-prefix-register'), password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('number');
  });
});

describe('POST /api/auth/login', () => {
  it('logs_in_via_the_api_prefix_and_sets_a_session_cookie', async () => {
    const email = uniqueEmail('api-prefix-login');
    await request(app).post('/api/auth/register').send({ email, password: VALID_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  it('returns_the_authenticated_user_via_the_api_prefix', async () => {
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: agentEmail });
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

const NOTES_QUERY = `
  query {
    notes {
      id
      title
    }
  }
`;

interface GraphQLResponseBody {
  data: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

describe('POST /api/graphql', () => {
  it('returns_notes_data_via_the_api_prefix_with_a_valid_session', async () => {
    const res = await agent.post('/api/graphql').send({ query: NOTES_QUERY });
    const body = res.body as GraphQLResponseBody;

    expect(res.status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data?.notes)).toBe(true);
  });

  it('returns_an_unauthenticated_error_via_the_api_prefix_without_a_session', async () => {
    const res = await request(app).post('/api/graphql').send({ query: NOTES_QUERY });
    const body = res.body as GraphQLResponseBody;

    // Mismo criterio que `tests/graphql.test.ts` para la ruta sin prefijo:
    // `buildContext` marca el error con `extensions.http.status: 401`, así
    // que la respuesta HTTP es un 401 real, no el 200 usual de GraphQL.
    expect(res.status).toBe(401);
    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
