import { useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/httpClient';
import { useAuth } from '../AuthContext';

/**
 * Estado explícito del envío (mismo patrón que `CreateNoteForm`/
 * `NoteDetail`): nunca un `null` silencioso, siempre se sabe si no hay nada
 * en curso, si la petición está en vuelo, o si falló.
 */
type SubmitState = { status: 'idle' } | { status: 'submitting' } | { status: 'error'; message: string };

/** Página `/login`: formulario controlado que inicia sesión y redirige a `/`. */
export function LoginPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const { login } = useAuth();
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
    if (trimmedEmail.length === 0) {
      // Validación del lado del cliente, antes de llamar a la API — mismo
      // criterio que `CreateNoteForm` con `title`. El login no exige un
      // largo mínimo de contraseña (a diferencia del registro): una
      // contraseña real ya creada podría ser más corta que el mínimo
      // vigente hoy, y el backend es quien de verdad decide si es correcta.
      setFieldError('El email es obligatorio.');
      return;
    }
    if (password.length === 0) {
      setFieldError('La contraseña es obligatoria.');
      return;
    }

    setFieldError(null);
    setSubmitState({ status: 'submitting' });

    try {
      await login(trimmedEmail, password);
      navigate('/', { replace: true });
    } catch (err) {
      // El backend ya devuelve un mensaje genérico ("Email o contraseña
      // incorrectos") sin distinguir cuál de los dos falló — este catch
      // solo lo muestra tal cual, no le agrega ni le quita precisión.
      const message = err instanceof ApiError ? err.message : 'Error inesperado al iniciar sesión';
      setSubmitState({ status: 'error', message });
    }
  }

  return (
    <form className="term-card" onSubmit={handleSubmit} aria-label="Iniciar sesión">
      <h1>Iniciar sesión</h1>

      <div className="term-field">
        <label className="term-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
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
        <label className="term-label" htmlFor="login-password">
          Contraseña
        </label>
        <input
          id="login-password"
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
        {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
      </button>

      <p className="term-muted">
        ¿No tenés cuenta? <Link to="/register">Registrate</Link>
      </p>
    </form>
  );
}
