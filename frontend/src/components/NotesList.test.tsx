import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { server } from '../../tests/server';
import { NotesList } from './NotesList';

const NOTES_ENDPOINT = 'http://localhost:3000/notes';

/**
 * `NotesList` usa `<Link>` de react-router-dom (ver feature 11), así que
 * necesita un Router en el árbol para renderizar sin errores — `MemoryRouter`
 * es el estándar para tests (no toca la URL real del navegador).
 */
function renderNotesList(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <NotesList />
    </MemoryRouter>,
  );
}

describe('NotesList', () => {
  it('shows_a_loading_state_before_the_response_arrives', () => {
    server.use(
      http.get(NOTES_ENDPOINT, async () => {
        await delay(50);
        return HttpResponse.json([]);
      }),
    );

    renderNotesList();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando notas…');
  });

  it('renders_the_notes_returned_by_the_api_on_success', async () => {
    server.use(
      http.get(NOTES_ENDPOINT, () =>
        HttpResponse.json([
          {
            id: 1,
            title: 'Comprar pan',
            body: 'Antes de las 8',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 2,
            title: 'Llamar al dentista',
            body: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ]),
      ),
    );

    renderNotesList();

    expect(await screen.findByText('Comprar pan')).toBeInTheDocument();
    expect(screen.getByText('Antes de las 8')).toBeInTheDocument();
    expect(screen.getByText('Llamar al dentista')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('links_each_note_to_its_own_detail_url', async () => {
    server.use(
      http.get(NOTES_ENDPOINT, () =>
        HttpResponse.json([
          {
            id: 1,
            title: 'Comprar pan',
            body: 'Antes de las 8',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 42,
            title: 'Llamar al dentista',
            body: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ]),
      ),
    );

    renderNotesList();

    expect(await screen.findByRole('link', { name: 'Comprar pan' })).toHaveAttribute(
      'href',
      '/notes/1',
    );
    expect(screen.getByRole('link', { name: 'Llamar al dentista' })).toHaveAttribute(
      'href',
      '/notes/42',
    );
  });

  it('shows_an_error_message_when_the_api_call_fails', async () => {
    server.use(
      http.get(NOTES_ENDPOINT, () =>
        HttpResponse.json({ error: 'Error interno del servidor' }, { status: 500 }),
      ),
    );

    renderNotesList();

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
  });

  it('shows_an_empty_state_message_when_there_are_no_notes', async () => {
    server.use(http.get(NOTES_ENDPOINT, () => HttpResponse.json([])));

    renderNotesList();

    expect(await screen.findByText('No hay notas todavía.')).toBeInTheDocument();
  });
});

describe('NotesList delete', () => {
  const NOTE_A = {
    id: 1,
    title: 'Comprar pan',
    body: 'Antes de las 8',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  const NOTE_B = {
    id: 2,
    title: 'Llamar al dentista',
    body: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  it('asks_for_confirmation_and_cancelling_keeps_the_note_without_calling_delete', async () => {
    server.use(http.get(NOTES_ENDPOINT, () => HttpResponse.json([NOTE_A, NOTE_B])));
    // A propósito no se registra ningún handler de DELETE: si cancelar
    // igual disparara la petición, `onUnhandledRequest: 'error'`
    // (configurado en tests/setupTests.ts) haría fallar el test.

    const user = userEvent.setup();
    renderNotesList();

    const noteItem = (await screen.findByText('Comprar pan')).closest('li');
    if (!noteItem) {
      throw new Error('No se encontró el <li> de la nota "Comprar pan"');
    }
    const withinNote = within(noteItem);

    await user.click(withinNote.getByRole('button', { name: 'Eliminar' }));

    expect(withinNote.getByText('¿Eliminar esta nota?')).toBeInTheDocument();

    await user.click(withinNote.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('¿Eliminar esta nota?')).not.toBeInTheDocument();
    expect(screen.getByText('Comprar pan')).toBeInTheDocument();
    expect(screen.getByText('Llamar al dentista')).toBeInTheDocument();
  });

  it('deletes_the_note_after_confirming_and_refreshes_the_list_from_the_server', async () => {
    let getCallCount = 0;
    server.use(
      http.get(NOTES_ENDPOINT, () => {
        getCallCount += 1;
        // Primera carga: las dos notas. Segunda carga (tras el DELETE, la
        // "refrescada"): solo queda NOTE_B. Si el componente solo hiciera un
        // splice local del array en vez de re-consultar `GET /notes`, este
        // segundo GET nunca se dispararía y `getCallCount` se quedaría en 1.
        return HttpResponse.json(getCallCount === 1 ? [NOTE_A, NOTE_B] : [NOTE_B]);
      }),
    );
    server.use(
      http.delete(`${NOTES_ENDPOINT}/1`, () => new HttpResponse(null, { status: 204 })),
    );

    const user = userEvent.setup();
    renderNotesList();

    const noteItem = (await screen.findByText('Comprar pan')).closest('li');
    if (!noteItem) {
      throw new Error('No se encontró el <li> de la nota "Comprar pan"');
    }
    const withinNote = within(noteItem);

    await user.click(withinNote.getByRole('button', { name: 'Eliminar' }));
    await user.click(withinNote.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(screen.queryByText('Comprar pan')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Llamar al dentista')).toBeInTheDocument();
    expect(getCallCount).toBe(2);
  });

  it('shows_an_error_and_keeps_the_note_when_the_delete_call_fails', async () => {
    server.use(http.get(NOTES_ENDPOINT, () => HttpResponse.json([NOTE_A])));
    server.use(
      http.delete(`${NOTES_ENDPOINT}/1`, () =>
        HttpResponse.json({ error: 'Error interno del servidor' }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderNotesList();

    const noteItem = (await screen.findByText('Comprar pan')).closest('li');
    if (!noteItem) {
      throw new Error('No se encontró el <li> de la nota "Comprar pan"');
    }
    const withinNote = within(noteItem);

    await user.click(withinNote.getByRole('button', { name: 'Eliminar' }));
    await user.click(withinNote.getByRole('button', { name: 'Sí, eliminar' }));

    expect(await withinNote.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.getByText('Comprar pan')).toBeInTheDocument();
  });
});
