import { useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/httpClient';
import { useAuth } from '../AuthContext';

/** Chequeo de forma, no de RFC 5322 completo — mismo criterio que el backend (`backend/src/routes/auth.ts`). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mismo mínimo que exige el backend (`backend/src/routes/auth.ts`, `MIN_PASSWORD_LENGTH`). */
const MIN_PASSWORD_LENGTH = 8;

type SubmitState = { status: 'idle' } | { status: 'submitting' } | { status: 'error'; message: string };

/** Página `/register`: formulario controlado que crea una cuenta y redirige a `/`. */
export function RegisterPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const isSubmitting = submitState.status === 'submitting';

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>): void {
    setEmail(event.target.value);
    setFieldError(null);
    if (submitState.status === 'error') {
      setSubmitState({ status: 'idle' });
    }
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    setPassword(event.target.value);
    setFieldError(null);
    if (submitState.status === 'error') {
      setSubmitState({ status: 'idle' });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      // Validación del lado del cliente, antes de llamar a la API — mismo
      // criterio que `CreateNoteForm` con `title`: nunca se manda un
      // registro con un email con formato inválido.
      setFieldError('El email no tiene un formato válido.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setFieldError(null);
    setSubmitState({ status: 'submitting' });

    try {
      await register(trimmedEmail, password);
      // El backend no inicia sesión automáticamente al registrarse
      // (POST /auth/register no fija cookie, a diferencia de /auth/login —
      // ver backend/src/routes/auth.ts): para cumplir "registro exitoso...
      // deja ver las notas del usuario" (criterio de aceptación 4), se
      // encadena un login con las mismas credenciales inmediatamente
      // después de un registro exitoso.
      await login(trimmedEmail, password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error inesperado al registrarse';
      setSubmitState({ status: 'error', message });
    }
  }

  return (
    <form className="term-card" onSubmit={handleSubmit} aria-label="Crear cuenta">
      <h1>Crear cuenta</h1>

      <div className="term-field">
        <label className="term-label" htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          className="term-input"
          // `type="text"`, no `"email"`: la validación de formato la hace
          // el JS de este componente (mismo criterio que el resto del
          // proyecto, ver `CreateNoteForm`) — un `type="email"` nativo
          // dispara la validación de restricciones del propio navegador
          // ANTES de que el `onSubmit` de React llegue a ejecutarse,
          // bloqueando el envío en silencio sin pasar por (ni mostrar)
          // ningún mensaje propio.
          type="text"
          value={email}
          onChange={handleEmailChange}
          disabled={isSubmitting}
        />
      </div>

      <div className="term-field">
        <label className="term-label" htmlFor="register-password">
          Contraseña
        </label>
        <input
          id="register-password"
          className="term-input"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          disabled={isSubmitting}
        />
      </div>

      {fieldError && (
        <p role="alert" className="term-error">
          {fieldError}
        </p>
      )}
      {submitState.status === 'error' && (
        <p role="alert" className="term-error">
          {submitState.message}
        </p>
      )}

      <button className="term-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="term-muted">
        ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
      </p>
    </form>
  );
}
