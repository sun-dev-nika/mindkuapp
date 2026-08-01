import { useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';

import { ApiError, createNote } from '../api/notesApi';
import type { Note } from '../types';

/**
 * Estado explícito de la petición de creación (nunca un `null` silencioso,
 * mismo criterio que `NotesList`): en todo momento se sabe si no hay nada en
 * curso, si la petición está en vuelo, si falló, o si acaba de tener éxito.
 */
type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success' };

export interface CreateNoteFormProps {
  /**
   * Se llama con la nota recién creada tras un submit exitoso. Opcional a
   * propósito: el criterio de aceptación de esta feature no exige refrescar
   * `NotesList` automáticamente, así que `CreateNoteForm` no conoce ni
   * importa `NotesList` (un componente, una responsabilidad). Quien monte
   * el formulario decide qué hacer con la nota creada.
   */
  onCreated?: (note: Note) => void;
}

/** Formulario controlado que crea una nota nueva vía `POST /notes`. */
export function CreateNoteForm({ onCreated }: CreateNoteFormProps): ReactElement {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const isSubmitting = submitState.status === 'submitting';

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    setTitle(event.target.value);
    // Cualquier mensaje de una petición o validación anterior deja de
    // aplicar en cuanto el usuario vuelve a escribir.
    setTitleError(null);
    if (submitState.status !== 'idle' && submitState.status !== 'submitting') {
      setSubmitState({ status: 'idle' });
    }
  }

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    setBody(event.target.value);
    if (submitState.status !== 'idle' && submitState.status !== 'submitting') {
      setSubmitState({ status: 'idle' });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      // Validación del lado del cliente: el POST nunca se envía con un
      // title vacío (el criterio pide validar ANTES de enviar, no dejar que
      // el backend responda 400 para este caso).
      setTitleError('El título es obligatorio.');
      setSubmitState({ status: 'idle' });
      return;
    }

    setTitleError(null);
    setSubmitState({ status: 'submitting' });

    try {
      const trimmedBody = body.trim();
      const note = await createNote({
        title: trimmedTitle,
        body: trimmedBody.length > 0 ? trimmedBody : null,
      });
      // Éxito: se limpia el formulario para la siguiente nota y se avisa a
      // quien lo esté escuchando (ver `onCreated` en `CreateNoteFormProps`).
      setTitle('');
      setBody('');
      setSubmitState({ status: 'success' });
      onCreated?.(note);
    } catch (err) {
      // Falla: el botón se reactiva (vuelve a 'idle' fuera de este catch, al
      // salir de 'submitting') y el texto ya escrito se conserva para que el
      // usuario pueda reintentar sin volver a tipear todo.
      const message = err instanceof ApiError ? err.message : 'Error inesperado al crear la nota';
      setSubmitState({ status: 'error', message });
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Crear nota">
      <div>
        <label htmlFor="note-title">Título</label>
        <input
          id="note-title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          disabled={isSubmitting}
        />
        {titleError && <p role="alert">{titleError}</p>}
      </div>

      <div>
        <label htmlFor="note-body">Cuerpo</label>
        <textarea id="note-body" value={body} onChange={handleBodyChange} disabled={isSubmitting} />
      </div>

      {submitState.status === 'error' && <p role="alert">{submitState.message}</p>}
      {submitState.status === 'success' && <p role="status">Nota creada.</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear nota'}
      </button>
    </form>
  );
}
