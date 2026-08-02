import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, deleteNote, getNotes } from '../api/notesApi';
import type { Note } from '../types';

/**
 * Estado de carga explícito (nunca un `null` silencioso, ver
 * docs/architecture.md): en todo momento el componente sabe si está
 * cargando, si falló, o si tiene datos — y el JSX de abajo lo refleja 1:1.
 */
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; notes: Note[] };

/**
 * Estado de la acción de eliminar, independiente del de carga de la lista.
 * `noteId` identifica a qué fila aplica, para poder pedir confirmación o
 * mostrar un error puntual en esa nota sin afectar a las demás. Empieza en
 * `confirming` (nunca se borra directo al primer clic): el criterio de
 * aceptación pide una confirmación explícita antes del `DELETE`.
 */
type DeleteState =
  | { status: 'idle' }
  | { status: 'confirming'; noteId: number }
  | { status: 'deleting'; noteId: number }
  | { status: 'error'; noteId: number; message: string };

async function fetchNotes(): Promise<LoadState> {
  try {
    const notes = await getNotes();
    return { status: 'success', notes };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Error inesperado al cargar las notas';
    return { status: 'error', message };
  }
}

/** Lista de notas: consume `GET /notes` vía el cliente tipado `notesApi`. */
export function NotesList(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });

  useEffect(() => {
    // Evita actualizar el estado si el componente se desmontó antes de que
    // la petición termine (por ejemplo, en un test que desmonta pronto).
    let cancelled = false;

    fetchNotes().then((result) => {
      if (!cancelled) {
        setState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleDeleteClick(noteId: number): void {
    setDeleteState({ status: 'confirming', noteId });
  }

  function handleCancelDelete(): void {
    setDeleteState({ status: 'idle' });
  }

  async function handleConfirmDelete(noteId: number): Promise<void> {
    setDeleteState({ status: 'deleting', noteId });

    try {
      await deleteNote(noteId);
      // Refresca la lista re-consultando `GET /notes` en vez de quitar la
      // nota del array local: la fuente de verdad sigue siendo el backend
      // (mismo criterio que ya usa `NoteDetail` tras un `PUT`, que confía
      // en la respuesta del servidor en vez de mutar el estado local a
      // ciegas). No hace falta recargar la página completa para esto.
      const result = await fetchNotes();
      setState(result);
      setDeleteState({ status: 'idle' });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Error inesperado al eliminar la nota';
      setDeleteState({ status: 'error', noteId, message });
    }
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="term-muted">
        Cargando notas…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="term-error">
        {state.message}
      </p>
    );
  }

  if (state.notes.length === 0) {
    return <p className="term-muted">No hay notas todavía.</p>;
  }

  return (
    <ul className="term-list" aria-label="Lista de notas">
      {state.notes.map((note) => {
        const isConfirming = deleteState.status === 'confirming' && deleteState.noteId === note.id;
        const isDeleting = deleteState.status === 'deleting' && deleteState.noteId === note.id;
        const deleteError =
          deleteState.status === 'error' && deleteState.noteId === note.id
            ? deleteState.message
            : null;

        return (
          <li key={note.id} className="term-card">
            <Link to={`/notes/${note.id}`}>
              <h3>{note.title}</h3>
            </Link>
            {note.body && <p>{note.body}</p>}

            {isConfirming || isDeleting ? (
              <div role="group" aria-label={`Confirmar eliminación de "${note.title}"`}>
                <span className="term-error">¿Eliminar esta nota?</span>{' '}
                <button
                  type="button"
                  className="term-button term-button-danger"
                  onClick={() => handleConfirmDelete(note.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
                <button
                  type="button"
                  className="term-button"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="term-button term-button-danger"
                onClick={() => handleDeleteClick(note.id)}
              >
                Eliminar
              </button>
            )}

            {deleteError && (
              <p role="alert" className="term-error">
                {deleteError}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
