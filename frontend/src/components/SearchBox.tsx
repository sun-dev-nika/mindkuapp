import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, searchNotes } from '../api/notesApi';
import type { Note } from '../types';

/** Espera esta pausa sin nuevas teclas antes de mandar la búsqueda al backend. */
const DEBOUNCE_MS = 300;

/**
 * Estado explícito de la búsqueda (nunca un `null` silencioso, ver
 * docs/architecture.md). `idle` es "todavía no se escribió nada que
 * buscar" — a propósito distinto de `success` con `notes: []`, que es "se
 * buscó y no hubo coincidencias" (el estado vacío que pide el criterio de
 * aceptación).
 */
type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; notes: Note[] };

/**
 * Buscador de notas: consume `GET /notes/search?q=...` mientras el usuario
 * escribe. Es un componente separado de `NotesList` a propósito (ver
 * docs/architecture.md, "un componente, una responsabilidad"): `NotesList`
 * sigue siendo el listado completo con su borrado ya aprobado (feature 8),
 * sin tocar; `SearchBox` solo sabe buscar y mostrar resultados, y no
 * conoce ni modifica el estado de `NotesList`.
 */
export function SearchBox(): ReactElement {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      // Campo vacío: no hay nada que buscar todavía. `idle`, no
      // `success` con array vacío (ese es solo para "se buscó y no hubo
      // coincidencias").
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    // Debounce simple: no es obligatorio para "resultados en vivo" (podría
    // buscar en cada tecla), pero evita mandar una petición HTTP por cada
    // carácter mientras se sigue escribiendo.
    const timeoutId = window.setTimeout(() => {
      searchNotes(trimmedQuery)
        .then((notes) => {
          // Si el usuario ya escribió algo distinto, este efecto quedó
          // obsoleto (`cancelled`) y una respuesta más nueva puede llegar
          // en cualquier momento: se descarta esta para que una respuesta
          // vieja nunca pise a una más reciente.
          if (!cancelled) {
            setState({ status: 'success', notes });
          }
        })
        .catch((err: unknown) => {
          if (cancelled) {
            return;
          }
          const message =
            err instanceof ApiError ? err.message : 'Error inesperado al buscar notas';
          setState({ status: 'error', message });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
  }

  return (
    <section className="term-card">
      <h2>Buscar notas</h2>
      <div className="term-field">
        <label className="term-label" htmlFor="search-notes-input">
          Buscar en título o cuerpo
        </label>
        <input
          id="search-notes-input"
          className="term-input"
          type="search"
          value={query}
          onChange={handleQueryChange}
        />
      </div>

      {state.status === 'loading' && (
        <p role="status" className="term-muted">
          Buscando…
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="term-error">
          {state.message}
        </p>
      )}
      {state.status === 'success' && state.notes.length === 0 && (
        <p className="term-muted">Sin resultados para &quot;{query.trim()}&quot;.</p>
      )}
      {state.status === 'success' && state.notes.length > 0 && (
        <ul className="term-list" aria-label="Resultados de la búsqueda">
          {state.notes.map((note) => (
            <li key={note.id} className="term-card">
              <Link to={`/notes/${note.id}`}>
                <h3>{note.title}</h3>
              </Link>
              {note.body && <p>{note.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
