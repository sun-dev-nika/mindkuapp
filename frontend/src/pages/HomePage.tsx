import { useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { CreateNoteForm } from '../components/CreateNoteForm';
import { NotesList } from '../components/NotesList';
import { SearchBox } from '../components/SearchBox';

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
      <h1>Notas</h1>
      <CreateNoteForm />
      <SearchBox />
      <NotesList />

      <section>
        <h2>Ver / editar una nota por id</h2>
        <form onSubmit={handleViewNote} aria-label="Buscar nota por id">
          <label htmlFor="note-id-input">Id de la nota</label>
          <input
            id="note-id-input"
            type="number"
            min={1}
            value={noteIdInput}
            onChange={handleNoteIdInputChange}
          />
          <button type="submit">Ver / editar</button>
        </form>
      </section>
    </>
  );
}
