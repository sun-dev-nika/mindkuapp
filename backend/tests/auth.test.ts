import request from 'supertest';

import { app } from '../src/app';
import { pool } from '../src/db';

async function clearAllTables(): Promise<void> {
  // `notes.user_id` tiene `ON DELETE SET NULL` (no `RESTRICT`), así que en
  // teoría se podría borrar `users` primero sin que MySQL se queje — pero
  // borrar `notes` antes es más explícito y no depende de esa regla.
  await pool.query('DELETE FROM notes');
  await pool.query('DELETE FROM users');
}

beforeEach(async () => {
  await clearAllTables();
});

afterAll(async () => {
  await clearAllTables();
  await pool.end();
});

/** Email único por test, para no chocar con el `UNIQUE` de `users.email`. */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const VALID_PASSWORD = 'correct-horse-battery-staple';

function setCookieHeaderAsString(res: request.Response): string {
  const header: unknown = res.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header.join('; ');
  }
  return typeof header === 'string' ? header : '';
}

describe('POST /auth/register', () => {
  it('creates_a_new_user_and_returns_201_without_leaking_the_password', async () => {
    const email = uniqueEmail('register-ok');

    const res = await request(app).post('/auth/register').send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(Number), email });
    expect(typeof res.body.createdAt).toBe('string');
    // Ni la contraseña en texto plano ni el hash deberían viajar nunca en
    // una respuesta HTTP (criterio de aceptación explícito).
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(VALID_PASSWORD);
  });

  it('returns_409_with_a_clear_message_when_the_email_is_already_registered', async () => {
    const email = uniqueEmail('register-dup');
    await request(app).post('/auth/register').send({ email, password: VALID_PASSWORD });

    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'a-different-password-1' });

    expect(res.status).toBe(409);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('treats_the_email_as_case_insensitive_for_the_duplicate_check', async () => {
    const email = uniqueEmail('register-case');
    await request(app).post('/auth/register').send({ email, password: VALID_PASSWORD });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password: VALID_PASSWORD });

    expect(res.status).toBe(409);
  });

  it('returns_400_when_the_password_is_shorter_than_the_minimum', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail('short-pw'), password: 'short1' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns_400_when_the_email_has_an_invalid_format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: VALID_PASSWORD });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('POST /auth/login', () => {
  it('logs_in_with_correct_credentials_and_sets_an_httponly_session_cookie', async () => {
    const email = uniqueEmail('login-ok');
    await request(app).post('/auth/register').send({ email, password: VALID_PASSWORD });

    const res = await request(app).post('/auth/login').send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email });

    const cookieHeader = setCookieHeaderAsString(res);
    expect(cookieHeader).toContain('notes_session=');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
  });

  it('returns_401_with_a_generic_message_when_the_email_does_not_exist', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail('no-such-user'), password: VALID_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email o contraseña incorrectos');
  });

  it('returns_the_exact_same_401_message_when_the_password_is_wrong', async () => {
    const email = uniqueEmail('login-wrong-pw');
    await request(app).post('/auth/register').send({ email, password: VALID_PASSWORD });

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'totally-wrong-password' });

    // Mismo status y mismo mensaje que "el email no existe" (test de
    // arriba): el criterio de aceptación pide explícitamente que un intento
    // de login fallido no revele si el problema fue el email o la
    // contraseña.
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email o contraseña incorrectos');
  });
});

describe('POST /auth/logout', () => {
  it('clears_the_session_cookie', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail('logout-ok');
    await agent.post('/auth/register').send({ email, password: VALID_PASSWORD });
    await agent.post('/auth/login').send({ email, password: VALID_PASSWORD });

    // La sesión funciona antes de cerrarla.
    const beforeLogout = await agent.get('/auth/me');
    expect(beforeLogout.status).toBe(200);

    const logoutRes = await agent.post('/auth/logout');
    expect(logoutRes.status).toBe(204);

    // El mismo agent (misma cookie jar) ya no tiene sesión después de logout.
    const afterLogout = await agent.get('/auth/me');
    expect(afterLogout.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns_401_when_there_is_no_session', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns_401_when_the_session_cookie_is_garbage', async () => {
    const res = await request(app).get('/auth/me').set('Cookie', 'notes_session=not-a-real-jwt');

    expect(res.status).toBe(401);
  });

  it('returns_the_authenticated_user_when_the_session_is_valid', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail('me-ok');
    await agent.post('/auth/register').send({ email, password: VALID_PASSWORD });
    await agent.post('/auth/login').send({ email, password: VALID_PASSWORD });

    const res = await agent.get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email });
  });
});

describe('/notes requires an authenticated session', () => {
  it('returns_401_for_every_notes_verb_without_a_session', async () => {
    const getList = await request(app).get('/notes');
    expect(getList.status).toBe(401);

    const create = await request(app).post('/notes').send({ title: 'x' });
    expect(create.status).toBe(401);

    const getById = await request(app).get('/notes/1');
    expect(getById.status).toBe(401);

    const update = await request(app).put('/notes/1').send({ title: 'x' });
    expect(update.status).toBe(401);

    const remove = await request(app).delete('/notes/1');
    expect(remove.status).toBe(401);

    const search = await request(app).get('/notes/search').query({ q: 'x' });
    expect(search.status).toBe(401);
  });
});

describe('notes isolation between users', () => {
  it('user_a_cannot_see_read_edit_delete_or_find_via_search_notes_belonging_to_user_b', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const emailA = uniqueEmail('user-a');
    const emailB = uniqueEmail('user-b');

    await agentA.post('/auth/register').send({ email: emailA, password: VALID_PASSWORD });
    await agentA.post('/auth/login').send({ email: emailA, password: VALID_PASSWORD });

    await agentB.post('/auth/register').send({ email: emailB, password: VALID_PASSWORD });
    await agentB.post('/auth/login').send({ email: emailB, password: VALID_PASSWORD });

    const noteB = await agentB
      .post('/notes')
      .send({ title: 'Nota privada de B', body: 'Solo B debería ver esto' });
    expect(noteB.status).toBe(201);
    const noteBId: number = noteB.body.id;

    // A no ve la nota de B en su propio listado.
    const listA = await agentA.get('/notes');
    expect(listA.status).toBe(200);
    expect(listA.body).toEqual([]);

    // A no puede leerla por id directo — 404, no 403: no se revela ni
    // siquiera que el id existe y pertenece a otra persona.
    const getByIdA = await agentA.get(`/notes/${noteBId}`);
    expect(getByIdA.status).toBe(404);

    // A no puede editarla.
    const putA = await agentA.put(`/notes/${noteBId}`).send({ title: 'Editada por A' });
    expect(putA.status).toBe(404);

    // A no puede borrarla.
    const deleteA = await agentA.delete(`/notes/${noteBId}`);
    expect(deleteA.status).toBe(404);

    // A no la encuentra buscando por su contenido.
    const searchA = await agentA.get('/notes/search').query({ q: 'privada' });
    expect(searchA.status).toBe(200);
    expect(searchA.body).toEqual([]);

    // La nota de B sigue intacta y visible para B (nada de lo que intentó A
    // la afectó).
    const getByIdB = await agentB.get(`/notes/${noteBId}`);
    expect(getByIdB.status).toBe(200);
    expect(getByIdB.body.title).toBe('Nota privada de B');
  });
});
