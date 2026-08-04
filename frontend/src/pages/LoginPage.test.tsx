import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { server } from '../../tests/server';
import { AuthProvider } from '../AuthContext';
import { LoginPage } from './LoginPage';

const ME_ENDPOINT = 'http://localhost:3000/auth/me';
const LOGIN_ENDPOINT = 'http://localhost:3000/auth/login';

/**
 * Monta `LoginPage` con sus dos dependencias reales (`AuthProvider`, para
 * `useAuth()`; un `Router`, para `useNavigate()`/`<Link>`), más una ruta `/`
 * "de mentira" (un simple párrafo) en vez de la `HomePage` real — así el
 * test confirma la redirección tras un login exitoso sin tener que mockear
 * todas las dependencias de datos de `HomePage`, que no son de este
 * componente. `AuthProvider` llama a `GET /auth/me` al montar, así que
 * todos los tests de este archivo lo mockean (típicamente sin sesión, que
 * es justamente la situación real de alguien parado en `/login`).
 */
function renderLoginPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Página protegida (inicio)</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('logs_in_successfully_and_navigates_to_home', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    server.use(
      http.post(LOGIN_ENDPOINT, () =>
        HttpResponse.json({ id: 1, email: 'ana@example.com', createdAt: '2026-08-01T00:00:00.000Z' }),
      ),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Página protegida (inicio)')).toBeInTheDocument();
  });

  it('disables_the_submit_button_while_the_login_request_is_in_flight', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    server.use(
      http.post(LOGIN_ENDPOINT, async () => {
        await delay(50);
        return HttpResponse.json({ id: 1, email: 'ana@example.com', createdAt: '2026-08-01T00:00:00.000Z' });
      }),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled();
    expect(await screen.findByText('Página protegida (inicio)')).toBeInTheDocument();
  });

  it('shows_the_backends_generic_error_message_when_login_fails', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    server.use(
      http.post(LOGIN_ENDPOINT, () =>
        HttpResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 }),
      ),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
    expect(screen.queryByText('Página protegida (inicio)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  it('shows_a_validation_error_and_does_not_call_the_api_when_a_field_is_empty', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    // A propósito no se registra ningún handler de POST /auth/login: si la
    // validación no bloqueara el envío, `onUnhandledRequest: 'error'`
    // (tests/setupTests.ts) haría fallar el test.

    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El email es obligatorio.');
  });
});
