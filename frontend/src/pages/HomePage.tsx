import { useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { CreateNoteForm } from '../components/CreateNoteForm';
import { NotesList } from '../components/NotesList';
import { SearchBox } from '../components/SearchBox';

/**
 * Arte ASCII propio del banner (no un logo de terceros, ver criterio de
 * aceptación 2 de la feature 13) — una caja simple con "NOTES WEB".
 */
const TERMINAL_BANNER_ASCII = `+-------------------------+
|                         |
|    N O T E S   W E B    |
|                         |
+-------------------------+`;

/** Paleta ANSI de 7 colores para la barra de swatches, puramente decorativa. */
const SWATCH_COLORS = [
  '#ff5c57',
  '#3ee66f',
  '#f3f99d',
  '#57c7ff',
  '#ff6ac1',
  '#9aedfe',
  '#f1f1f0',
];

/**
 * Página `/`: formulario de creación, buscador, listado de notas, y el
 * campo manual "ver/editar una nota por id" (se conserva como atajo
 * adicional — ver `docs/architecture.md` principio 6). A diferencia de
 * antes de la feature de routing, enviar el campo ya no guarda un id en
 * estado local: navega a `/notes/:id` con `useNavigate`, la misma URL a la
 * que llega un clic en `NotesList` o un link pegado directamente en el
 * navegador. `SearchBox` (feature 9) es independiente de `NotesList`: solo
 * busca y muestra resultados, sin tocar el listado completo.
 */
export function HomePage(): ReactElement {
  const [noteIdInput, setNoteIdInput] = useState('');
  const navigate = useNavigate();

  function handleNoteIdInputChange(event: ChangeEvent<HTMLInputElement>): void {
    setNoteIdInput(event.target.value);
  }

  function handleViewNote(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const id = Number(noteIdInput);
    if (Number.isInteger(id) && id > 0) {
      navigate(`/notes/${id}`);
    }
  }

  return (
    <>
      {/*
       * Banner puramente decorativo (feature 13, tema terminal/neofetch):
       * línea `usuario@host`, separador, arte ASCII propio (una caja con
       * "NOTES WEB", no un logo de terceros) y una barra de swatches de
       * color. `aria-hidden` porque no aporta información — el `<h1>` de
       * abajo, sin tocar, sigue siendo el encabezado real de la página.
       */}
      <div className="term-card" aria-hidden="true">
        <p className="term-banner-user">notas@mindkuapp</p>
        <p className="term-banner-rule">─────────────────────────</p>
        <pre className="term-ascii">{TERMINAL_BANNER_ASCII}</pre>
        <p>
          <span className="term-key">Stack:</span>{' '}
          <span className="term-value">React + TypeScript + Express + MySQL</span>
        </p>
        <p>
          <span className="term-key">Modo:</span> <span className="term-value">Terminal</span>
        </p>
        <div className="term-swatches">
          {SWATCH_COLORS.map((color) => (
            <span key={color} className="term-swatch" style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>

      <h1>Notas</h1>
      <CreateNoteForm />
      <SearchBox />
      <NotesList />

      <section className="term-card">
        <h2>Ver / editar una nota por id</h2>
        <form onSubmit={handleViewNote} aria-label="Buscar nota por id">
          <div className="term-field">
            <label className="term-label" htmlFor="note-id-input">
              Id de la nota
            </label>
            <input
              id="note-id-input"
              className="term-input"
              type="number"
              min={1}
              value={noteIdInput}
              onChange={handleNoteIdInputChange}
            />
          </div>
          <button className="term-button" type="submit">
            Ver / editar
          </button>
        </form>
      </section>
    </>
  );
}
