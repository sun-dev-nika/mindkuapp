import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { server } from '../../tests/server';
import { AuthProvider } from '../AuthContext';
import { RegisterPage } from './RegisterPage';

const ME_ENDPOINT = 'http://localhost:3000/auth/me';
const REGISTER_ENDPOINT = 'http://localhost:3000/auth/register';
const LOGIN_ENDPOINT = 'http://localhost:3000/auth/login';

const VALID_PASSWORD = 'correct-horse-battery-staple';

/**
 * Mismo patrón que `LoginPage.test.tsx`: `AuthProvider` real (para
 * `useAuth()`) + `Router` real (para `useNavigate()`), con una ruta `/` "de
 * mentira" en vez de la `HomePage` real, para poder confirmar la
 * redirección sin mockear todas las dependencias de datos de `HomePage`.
 */
function renderRegisterPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<p>Página protegida (inicio)</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  it('registers_successfully_logs_in_automatically_and_navigates_to_home', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    server.use(
      http.post(REGISTER_ENDPOINT, () =>
        HttpResponse.json(
          { id: 1, email: 'ana@example.com', createdAt: '2026-08-01T00:00:00.000Z' },
          { status: 201 },
        ),
      ),
    );
    // El backend NO deja sesión iniciada tras /auth/register (ver
    // backend/src/routes/auth.ts) — RegisterPage encadena un login con las
    // mismas credenciales, así que hace falta mockear también /auth/login
    // para que la redirección a "/" llegue a pasar.
    server.use(
      http.post(LOGIN_ENDPOINT, () =>
        HttpResponse.json({ id: 1, email: 'ana@example.com', createdAt: '2026-08-01T00:00:00.000Z' }),
      ),
    );

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Página protegida (inicio)')).toBeInTheDocument();
  });

  it('shows_the_backends_409_message_when_the_email_is_already_registered', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    server.use(
      http.post(REGISTER_ENDPOINT, () =>
        HttpResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese email');
    expect(screen.queryByText('Página protegida (inicio)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
  });

  it('shows_a_validation_error_and_does_not_call_the_api_when_the_password_is_too_short', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );
    // A propósito no se registra ningún handler de POST /auth/register: si
    // la validación no bloqueara el envío, `onUnhandledRequest: 'error'`
    // haría fallar el test.

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'short1');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });

  it('shows_a_validation_error_and_does_not_call_the_api_when_the_email_format_is_invalid', async () => {
    server.use(
      http.get(ME_ENDPOINT, () => HttpResponse.json({ error: 'No hay sesión activa' }, { status: 401 })),
    );

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El email no tiene un formato válido.');
  });
});
