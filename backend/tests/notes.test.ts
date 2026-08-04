import request from 'supertest';

import { app } from '../src/app';
import { pool } from '../src/db';

async function clearNotesTable(): Promise<void> {
  await pool.query('DELETE FROM notes');
}

async function clearUsersTable(): Promise<void> {
  await pool.query('DELETE FROM users');
}

/**
 * Desde la feature `backend_auth`, `/notes` exige una sesión válida — este
 * archivo ya probaba el comportamiento de notas (loading/error/success,
 * validaciones, orden, búsqueda, CORS) antes de que existiera esa
 * protección, y sigue probando exactamente lo mismo ahora: la única
 * diferencia es que las peticiones se mandan a través de un `agent` de
 * Supertest ya logueado (un `agent` persiste cookies entre requests, como un
 * navegador real), en vez de `request(app)` directo (que no tiene sesión).
 * El aislamiento entre usuarios distintos (que un usuario no vea las notas
 * de otro) se prueba por separado en `backend/tests/auth.test.ts` — acá
 * alcanza con UN usuario para todo el archivo, porque eso es justamente lo
 * que ya probaban estos tests.
 */
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  agent = request.agent(app);
  const email = `notes-test-${Date.now()}@example.com`;
  const password = 'notes-test-password-123';
  await agent.post('/auth/register').send({ email, password });
  await agent.post('/auth/login').send({ email, password });
});

beforeEach(async () => {
  await clearNotesTable();
});

afterAll(async () => {
  await clearNotesTable();
  await clearUsersTable();
  await pool.end();
});

describe('GET /notes', () => {
  it('returns_empty_array_when_no_notes_exist', async () => {
    const res = await agent.get('/notes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns_all_notes_ordered_by_created_at_desc', async () => {
    await agent.post('/notes').send({ title: 'Primera nota' });
    await agent.post('/notes').send({ title: 'Segunda nota' });

    const res = await agent.get('/notes');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Segunda nota');
    expect(res.body[1].title).toBe('Primera nota');
  });
});

describe('POST /notes', () => {
  it('creates_a_note_with_title_and_body_and_returns_201', async () => {
    const res = await agent
      .post('/notes')
      .send({ title: 'Comprar pan', body: 'Ir a la panadería antes de las 8' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      title: 'Comprar pan',
      body: 'Ir a la panadería antes de las 8',
    });
    expect(typeof res.body.createdAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('creates_a_note_with_only_title_when_body_is_omitted', async () => {
    const res = await agent.post('/notes').send({ title: 'Solo título' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Solo título');
    expect(res.body.body).toBeNull();
  });

  it('returns_400_when_title_is_missing', async () => {
    const res = await agent.post('/notes').send({ body: 'sin título' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('returns_400_when_title_is_empty_string', async () => {
    const res = await agent.post('/notes').send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('GET /notes/:id', () => {
  it('returns_the_note_when_it_exists', async () => {
    const created = await agent
      .post('/notes')
      .send({ title: 'Nota existente', body: 'contenido' });

    const res = await agent.get(`/notes/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'Nota existente',
      body: 'contenido',
    });
  });

  it('returns_404_when_note_not_found', async () => {
    const res = await agent.get('/notes/999999');

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('returns_404_when_id_is_not_a_valid_integer', async () => {
    const res = await agent.get('/notes/not-a-number');

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('PUT /notes/:id', () => {
  it('updates_title_and_body_and_returns_200', async () => {
    const created = await agent
      .post('/notes')
      .send({ title: 'Título original', body: 'Cuerpo original' });
    // Línea base leída de MySQL (no el valor en memoria que devuelve POST):
    // MySQL REDONDEA (no trunca) la fracción de segundo al persistir un
    // DATETIME sin fracción, así que el valor ya persistido puede diferir en
    // un segundo del que POST devolvió antes del INSERT. Comparar contra esta
    // línea base evita esa fuente de intermitencia.
    const persisted = await agent.get(`/notes/${created.body.id}`);

    const res = await agent
      .put(`/notes/${created.body.id}`)
      .send({ title: 'Título nuevo', body: 'Cuerpo nuevo' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'Título nuevo',
      body: 'Cuerpo nuevo',
    });
    expect(typeof res.body.updatedAt).toBe('string');
    expect(res.body.createdAt).toBe(persisted.body.createdAt);
  });

  it('updates_only_title_and_preserves_existing_body', async () => {
    const created = await agent
      .post('/notes')
      .send({ title: 'Título viejo', body: 'Este cuerpo no debe borrarse' });

    const res = await agent.put(`/notes/${created.body.id}`).send({ title: 'Título viejo actualizado' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Título viejo actualizado');
    expect(res.body.body).toBe('Este cuerpo no debe borrarse');
  });

  it('updates_only_body_and_preserves_existing_title', async () => {
    const created = await agent
      .post('/notes')
      .send({ title: 'Título que no cambia', body: 'Cuerpo viejo' });

    const res = await agent.put(`/notes/${created.body.id}`).send({ body: 'Cuerpo nuevo' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Título que no cambia');
    expect(res.body.body).toBe('Cuerpo nuevo');
  });

  it('returns_404_when_note_not_found', async () => {
    const res = await agent.put('/notes/999999').send({ title: 'No importa' });

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns_400_when_title_is_provided_but_empty', async () => {
    const created = await agent.post('/notes').send({ title: 'Título válido' });

    const res = await agent.put(`/notes/${created.body.id}`).send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns_400_when_no_fields_are_provided', async () => {
    const created = await agent.post('/notes').send({ title: 'Título válido' });

    const res = await agent.put(`/notes/${created.body.id}`).send({});

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('DELETE /notes/:id', () => {
  it('deletes_the_note_and_returns_204', async () => {
    const created = await agent.post('/notes').send({ title: 'Nota a borrar' });

    const res = await agent.delete(`/notes/${created.body.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const getRes = await agent.get(`/notes/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns_404_when_note_not_found', async () => {
    const res = await agent.delete('/notes/999999');

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('GET /notes/search', () => {
  it('returns_notes_matching_the_query_in_title', async () => {
    await agent.post('/notes').send({ title: 'Comprar pan', body: 'Antes de las 8' });
    await agent.post('/notes').send({ title: 'Llamar al dentista', body: 'Revisión anual' });

    const res = await agent.get('/notes/search').query({ q: 'pan' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Comprar pan');
  });

  it('returns_notes_matching_the_query_in_body', async () => {
    await agent
      .post('/notes')
      .send({ title: 'Lista del súper', body: 'Leche, huevos y pan integral' });
    await agent.post('/notes').send({ title: 'Otra nota', body: 'Sin relación' });

    const res = await agent.get('/notes/search').query({ q: 'huevos' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Lista del súper');
  });

  it('is_case_insensitive', async () => {
    await agent.post('/notes').send({ title: 'Reunión de EQUIPO', body: null });

    const res = await agent.get('/notes/search').query({ q: 'equipo' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Reunión de EQUIPO');
  });

  it('returns_empty_array_when_there_are_no_matches', async () => {
    await agent.post('/notes').send({ title: 'Nota sin relación', body: 'contenido' });

    const res = await agent.get('/notes/search').query({ q: 'xyzxyz-no-deberia-existir' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns_empty_array_when_q_is_missing', async () => {
    await agent.post('/notes').send({ title: 'Cualquier nota' });

    const res = await agent.get('/notes/search');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns_empty_array_when_q_is_an_empty_string', async () => {
    await agent.post('/notes').send({ title: 'Cualquier nota' });

    const res = await agent.get('/notes/search').query({ q: '   ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('does_not_fall_into_the_get_by_id_handler', async () => {
    const res = await agent.get('/notes/search').query({ q: 'lo-que-sea' });

    // Si Express confundiera "search" con un `:id`, `parseNoteId` lanzaría un
    // 404 ("Nota no encontrada"). Un 200 con array confirma que cayó en el
    // handler correcto de `GET /notes/search`.
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// `FRONTEND_ORIGIN` no se fija en `jest.setup.ts`, así que estos tests
// corren contra el default de `app.ts` (`http://localhost:5173`). Esto NO
// es lo mismo que probar contra un navegador real (Supertest habla
// directo con el objeto Express, sin red real) — lo que sí demuestra es
// que el SERVIDOR calcula y manda las cabeceras CORS correctas, que es la
// parte verificable sin un navegador. La feature 12 además exige una
// prueba manual real en navegador, documentada en
// `progress/impl_backend_cors.md`.
describe('CORS', () => {
  it('reflects_the_allowed_frontend_origin_in_access_control_allow_origin', async () => {
    const res = await agent.get('/notes').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does_not_reflect_a_disallowed_origin_in_the_cors_header', async () => {
    const res = await agent.get('/notes').set('Origin', 'http://evil.example');

    // El paquete `cors` no bloquea la petición del lado del servidor (eso lo
    // hace el navegador al no encontrar la cabecera): simplemente no manda
    // `Access-Control-Allow-Origin` para un origen no permitido.
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers_a_cors_preflight_request_with_the_expected_headers', async () => {
    const res = await agent
      .options('/notes')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toEqual(expect.stringContaining('POST'));
  });
});
