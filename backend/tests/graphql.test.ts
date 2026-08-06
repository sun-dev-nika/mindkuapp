import request from 'supertest';

import { app, graphqlServerReady } from '../src/app';
import { pool } from '../src/db';

/**
 * Mismo patrón de test real contra MySQL que `notes.test.ts` y
 * `auth.test.ts` (Jest + Supertest, sin mocks de la base de datos): un
 * `agent` de Supertest persiste la cookie de sesión entre requests, como un
 * navegador real, y se registra/loguea un usuario real antes de cada
 * bloque. `graphqlServerReady` se espera una sola vez en `beforeAll`: el
 * middleware de `/graphql` se monta de forma asíncrona (`ApolloServer#start`)
 * y no está disponible hasta que esa promesa resuelve.
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

const VALID_PASSWORD = 'correct-horse-battery-staple';

async function loginNewUser(prefix: string): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const email = uniqueEmail(prefix);
  await agent.post('/auth/register').send({ email, password: VALID_PASSWORD });
  await agent.post('/auth/login').send({ email, password: VALID_PASSWORD });
  return agent;
}

interface GraphQLResponseBody {
  data: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

async function graphqlRequest(
  agentOrRequest: ReturnType<typeof request.agent> | ReturnType<typeof request>,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ status: number; body: GraphQLResponseBody }> {
  const res = await agentOrRequest.post('/graphql').send({ query, variables });
  return { status: res.status, body: res.body as GraphQLResponseBody };
}

beforeAll(async () => {
  await graphqlServerReady;
});

beforeEach(async () => {
  await clearNotesTable();
});

afterAll(async () => {
  await clearNotesTable();
  await clearUsersTable();
  await pool.end();
});

const NOTES_QUERY = `
  query {
    notes {
      id
      title
      body
    }
  }
`;

const NOTE_BY_ID_QUERY = `
  query Note($id: ID!) {
    note(id: $id) {
      id
      title
      body
    }
  }
`;

const CREATE_NOTE_MUTATION = `
  mutation CreateNote($input: CreateNoteInput!) {
    createNote(input: $input) {
      id
      title
      body
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_NOTE_MUTATION = `
  mutation UpdateNote($id: ID!, $input: UpdateNoteInput!) {
    updateNote(id: $id, input: $input) {
      id
      title
      body
    }
  }
`;

const DELETE_NOTE_MUTATION = `
  mutation DeleteNote($id: ID!) {
    deleteNote(id: $id)
  }
`;

describe('query notes', () => {
  it('returns_the_authenticated_users_notes', async () => {
    const agent = await loginNewUser('gql-list');
    await agent
      .post('/graphql')
      .send({ query: CREATE_NOTE_MUTATION, variables: { input: { title: 'Nota GraphQL' } } });

    const res = await graphqlRequest(agent, NOTES_QUERY);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.notes).toHaveLength(1);
    expect((res.body.data?.notes as Array<{ title: string }>)[0].title).toBe('Nota GraphQL');
  });

  it('returns_401_and_an_authentication_error_without_a_session_cookie', async () => {
    const res = await graphqlRequest(request(app), NOTES_QUERY);

    // Un error lanzado en `context` (ver graphql/context.ts) corta la
    // petición antes de ejecutar el query, así que ni siquiera hay `data` en
    // la respuesta — mismo 401 que devuelve REST, no el 200 usual de GraphQL.
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});

describe('query note(id)', () => {
  it('returns_the_note_when_it_exists_and_belongs_to_the_user', async () => {
    const agent = await loginNewUser('gql-note-ok');
    const created = await graphqlRequest(agent, CREATE_NOTE_MUTATION, {
      input: { title: 'Nota puntual', body: 'contenido' },
    });
    const createdId = (created.body.data?.createNote as { id: string }).id;

    const res = await graphqlRequest(agent, NOTE_BY_ID_QUERY, { id: createdId });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.note).toMatchObject({ id: createdId, title: 'Nota puntual' });
  });

  it('returns_a_not_found_error_when_the_note_does_not_exist', async () => {
    const agent = await loginNewUser('gql-note-404');

    const res = await graphqlRequest(agent, NOTE_BY_ID_QUERY, { id: '999999' });

    // El error se lanza DENTRO del resolver (no en `context`), así que la
    // petición sigue respondiendo 200 (protocolo GraphQL estándar) con
    // `note: null` (campo nullable) y el detalle en `errors[]`.
    expect(res.status).toBe(200);
    expect(res.body.data?.note).toBeNull();
    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});

describe('mutation createNote', () => {
  it('creates_a_note_and_returns_it', async () => {
    const agent = await loginNewUser('gql-create-ok');

    const res = await graphqlRequest(agent, CREATE_NOTE_MUTATION, {
      input: { title: 'Comprar pan', body: 'Antes de las 8' },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.createNote).toMatchObject({
      title: 'Comprar pan',
      body: 'Antes de las 8',
    });
  });

  it('returns_a_bad_user_input_error_when_title_is_empty', async () => {
    const agent = await loginNewUser('gql-create-bad');

    const res = await graphqlRequest(agent, CREATE_NOTE_MUTATION, {
      input: { title: '   ' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.createNote).toBeUndefined();
    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('mutation updateNote', () => {
  it('updates_the_note_and_returns_it', async () => {
    const agent = await loginNewUser('gql-update-ok');
    const created = await graphqlRequest(agent, CREATE_NOTE_MUTATION, {
      input: { title: 'Título original', body: 'Cuerpo original' },
    });
    const createdId = (created.body.data?.createNote as { id: string }).id;

    const res = await graphqlRequest(agent, UPDATE_NOTE_MUTATION, {
      id: createdId,
      input: { title: 'Título nuevo' },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.updateNote).toMatchObject({
      id: createdId,
      title: 'Título nuevo',
      body: 'Cuerpo original',
    });
  });

  it('returns_a_not_found_error_when_the_note_does_not_exist', async () => {
    const agent = await loginNewUser('gql-update-404');

    const res = await graphqlRequest(agent, UPDATE_NOTE_MUTATION, {
      id: '999999',
      input: { title: 'No importa' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.updateNote).toBeUndefined();
    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});

describe('mutation deleteNote', () => {
  it('deletes_the_note_and_returns_true', async () => {
    const agent = await loginNewUser('gql-delete-ok');
    const created = await graphqlRequest(agent, CREATE_NOTE_MUTATION, {
      input: { title: 'Nota a borrar' },
    });
    const createdId = (created.body.data?.createNote as { id: string }).id;

    const res = await graphqlRequest(agent, DELETE_NOTE_MUTATION, { id: createdId });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.deleteNote).toBe(true);

    const afterDelete = await graphqlRequest(agent, NOTE_BY_ID_QUERY, { id: createdId });
    expect(afterDelete.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('returns_a_not_found_error_when_the_note_does_not_exist', async () => {
    const agent = await loginNewUser('gql-delete-404');

    const res = await graphqlRequest(agent, DELETE_NOTE_MUTATION, { id: '999999' });

    expect(res.status).toBe(200);
    expect(res.body.data?.deleteNote).toBeUndefined();
    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});

describe('isolation between users', () => {
  it('user_a_cannot_read_update_or_delete_a_note_belonging_to_user_b', async () => {
    const agentA = await loginNewUser('gql-user-a');
    const agentB = await loginNewUser('gql-user-b');

    const createdB = await graphqlRequest(agentB, CREATE_NOTE_MUTATION, {
      input: { title: 'Nota privada de B', body: 'Solo B debería ver esto' },
    });
    const noteBId = (createdB.body.data?.createNote as { id: string }).id;

    const listA = await graphqlRequest(agentA, NOTES_QUERY);
    expect(listA.body.data?.notes).toEqual([]);

    const getByIdA = await graphqlRequest(agentA, NOTE_BY_ID_QUERY, { id: noteBId });
    expect(getByIdA.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

    const updateA = await graphqlRequest(agentA, UPDATE_NOTE_MUTATION, {
      id: noteBId,
      input: { title: 'Editada por A' },
    });
    expect(updateA.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

    const deleteA = await graphqlRequest(agentA, DELETE_NOTE_MUTATION, { id: noteBId });
    expect(deleteA.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

    const getByIdB = await graphqlRequest(agentB, NOTE_BY_ID_QUERY, { id: noteBId });
    expect(getByIdB.body.data?.note).toMatchObject({ title: 'Nota privada de B' });
  });
});
