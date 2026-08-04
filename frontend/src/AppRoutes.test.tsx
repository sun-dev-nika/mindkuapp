import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { server } from '../tests/server';
import { AppRoutes } from './AppRoutes';
import { AuthProvider } from './AuthContext';

const ME_ENDPOINT = 'http://localhost:3000/auth/me';

const AUTHENTICATED_USER = {
  id: 1,
  email: 'ana@example.com',
  createdAt: '2026-08-01T00:00:00.000Z',
};

/**
 * Prueba de punta a punta del router: arranca directamente en una URL con
 * `MemoryRouter initialEntries`, sin pasar por ningún clic previo — es el
 * equivalente de prueba de "pegar un link compartido en el navegador".
 *
 * Desde la feature `frontend_auth`, `/` y `/notes/:id` están envueltas en
 * `RequireAuth`, que lee el estado de `AuthContext` — por eso `AppRoutes`
 * ahora necesita un `<AuthProvider>` ancestro también en los tests (antes
 * no hacía falta). `AuthProvider` llama a `GET /auth/me` al montar, así que
 * cada test de este archivo tiene que mockear esa respuesta explícitamente
 * (autenticado o no), igual que ya mockeaba `GET /notes`.
 */
function renderAppAtUrl(initialUrl: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders_the_home_page_at_the_root_url_when_there_is_an_active_session', async () => {
    server.use(http.get(ME_ENDPOINT, () => HttpResponse.json(AUTHENTICATED_USER)));
    server.use(http.get('http://localhost:3000/notes', () => HttpResponse.json([])));

    renderAppAtUrl('/');

    expect(await screen.findByRole('heading', { name: 'Notas' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Crear nota' })).toBeInTheDocument();
    expect(await screen.findByText('No hay notas todavía.')).toBeInTheDocument();
  });

  it('loads_and_shows_a_note_when_arriving_directly_at_its_url_without_going_through_the_list', async () => {
    server.use(http.get(ME_ENDPOINT, () => HttpResponse.json(AUTHENTICATED_USER)));
    server.use(
      http.get('http://localhost:3000/notes/1', () =>
        HttpResponse.json({
          id: 1,
          title: 'Nota compartida',
          body: 'Se llega directo por URL',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        }),
      ),
    );

    renderAppAtUrl('/notes/1');

    // No debe aparecer nada del Home (ni el formulario de creación ni el
    // listado): llegar directo a /notes/1 muestra solo el detalle.
    expect(screen.queryByRole('form', { name: 'Crear nota' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Título')).toHaveValue('Nota compartida');
    expect(screen.getByLabelText('Cuerpo')).toHaveValue('Se llega directo por URL');
  });

  it('redirects_to_login_when_visiting_a_protected_route_without_an_active_session', async () => {
    server.use(http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })));
    // A propósito no se registra ningún handler de `GET /notes`: si de
    // alguna forma `HomePage` llegara a montarse sin sesión, ese pedido no
    // mockeado haría fallar el test (`onUnhandledRequest: 'error'`).

    renderAppAtUrl('/');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notas' })).not.toBeInTheDocument();
  });

  it('redirects_a_protected_note_url_to_login_when_there_is_no_active_session', async () => {
    server.use(http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })));

    renderAppAtUrl('/notes/1');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
