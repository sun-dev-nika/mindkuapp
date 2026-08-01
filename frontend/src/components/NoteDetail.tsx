import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';

import { ApiError, getNoteById, updateNote } from '../api/notesApi';
import type { Note } from '../types';

/**
 * Estado de carga explícito (mismo criterio que `NotesList`): además de
 * `loading`/`error`/listo, `not-found` es su propia forma (no un caso más
 * de `error`) porque el criterio de aceptación pide manejar el 404
 * explícitamente, con un mensaje distinto al de un error genérico del
 * servidor.
 */
type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; note: Note };

/** Estado de la petición de guardado (PUT), separado del de carga inicial. */
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'error'; message: string }
  | { status: 'success' };

export interface NoteDetailProps {
  /** Id de la nota a mostrar/editar. Ver `App.tsx` para cómo se elige sin router. */
  noteId: number;
  /**
   * Se llama con la nota actualizada tras un guardado exitoso. Opcional,
   * mismo patrón que `onCreated` en `CreateNoteForm`: `NoteDetail` no
   * conoce ni importa `NotesList` (un componente, una responsabilidad).
   */
  onSaved?: (note: Note) => void;
}

/** Carga una nota por id (`GET /notes/:id`) y permite editarla (`PUT /notes/:id`). */
export function NoteDetail({ noteId, onSaved }: NoteDetailProps): ReactElement {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    // Cambiar de id (o volver a montar) reinicia todo: no debe quedar el
    // formulario o el error de la nota anterior mientras carga la nueva.
    setLoadState({ status: 'loading' });
    setSaveState({ status: 'idle' });
    setTitleError(null);

    getNoteById(noteId)
      .then((note) => {
        if (cancelled) {
          return;
        }
        setLoadState({ status: 'ready', note });
        setTitle(note.title);
        setBody(note.body ?? '');
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.statusCode === 404) {
          setLoadState({ status: 'not-found' });
          return;
        }
        const message =
          err instanceof ApiError ? err.message : 'Error inesperado al cargar la nota';
        setLoadState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    setTitle(event.target.value);
    setTitleError(null);
    if (saveState.status !== 'idle' && saveState.status !== 'saving') {
      setSaveState({ status: 'idle' });
    }
  }

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    setBody(event.target.value);
    if (saveState.status !== 'idle' && saveState.status !== 'saving') {
      setSaveState({ status: 'idle' });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      // Misma regla que `CreateNoteForm`: se valida en el cliente antes de
      // llamar a la API, nunca se manda un PUT con title vacío.
      setTitleError('El título es obligatorio.');
      setSaveState({ status: 'idle' });
      return;
    }

    setTitleError(null);
    setSaveState({ status: 'saving' });

    try {
      const trimmedBody = body.trim();
      const updated = await updateNote(noteId, {
        title: trimmedTitle,
        body: trimmedBody.length > 0 ? trimmedBody : null,
      });
      setLoadState({ status: 'ready', note: updated });
      setTitle(updated.title);
      setBody(updated.body ?? '');
      setSaveState({ status: 'success' });
      onSaved?.(updated);
    } catch (err) {
      // Falla: el botón se reactiva y lo que el usuario escribió se
      // conserva para reintentar, igual que en `CreateNoteForm`.
      const message = err instanceof ApiError ? err.message : 'Error inesperado al guardar la nota';
      setSaveState({ status: 'error', message });
    }
  }

  if (loadState.status === 'loading') {
    return <p role="status">Cargando nota…</p>;
  }

  if (loadState.status === 'not-found') {
    return <p role="alert">No existe ninguna nota con id {noteId}.</p>;
  }

  if (loadState.status === 'error') {
    return <p role="alert">{loadState.message}</p>;
  }

  const isSaving = saveState.status === 'saving';

  return (
    <form onSubmit={handleSubmit} aria-label="Editar nota">
      <div>
        <label htmlFor="edit-note-title">Título</label>
        <input
          id="edit-note-title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          disabled={isSaving}
        />
        {titleError && <p role="alert">{titleError}</p>}
      </div>

      <div>
        <label htmlFor="edit-note-body">Cuerpo</label>
        <textarea
          id="edit-note-body"
          value={body}
          onChange={handleBodyChange}
          disabled={isSaving}
        />
      </div>

      {saveState.status === 'error' && <p role="alert">{saveState.message}</p>}
      {saveState.status === 'success' && <p role="status">Nota guardada.</p>}

      <button type="submit" disabled={isSaving}>
        {isSaving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
