import request from 'supertest';

import { app } from '../src/app';
import { pool } from '../src/db';

afterAll(async () => {
  await pool.end();
});

describe('GET /health', () => {
  it('returns_200_ok_with_db_ok_when_database_is_reachable', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('is_accessible_without_a_session_cookie', async () => {
    // Sin `request.agent` ni cookie previa: a diferencia de `/notes`, este
    // endpoint no pasa por `requireAuth` (lo consume el healthcheck de
    // Docker/EC2, que no tiene sesión). Si alguna vez se protegiera por
    // error, este test fallaría con 401 en vez de 200.
    const res = await request(app).get('/health');

    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });
});
