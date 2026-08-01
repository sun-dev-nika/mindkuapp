import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';

import { server } from '../../tests/server';
import { NoteDetail } from './NoteDetail';

const NOTE_ENDPOINT = 'http://localhost:3000/notes/1';

const EXISTING_NOTE = {
  id: 1,
  title: 'Comprar pan',
  body: 'Antes de las 8',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('NoteDetail', () => {
  it('shows_a_loading_state_before_the_note_arrives', () => {
    server.use(
      http.get(NOTE_ENDPOINT, async () => {
        await delay(50);
        return HttpResponse.json(EXISTING_NOTE);
      }),
    );

    render(<NoteDetail noteId={1} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando nota…');
  });

  it('loads_the_note_and_prefills_the_edit_form', async () => {
    server.use(http.get(NOTE_ENDPOINT, () => HttpResponse.json(EXISTING_NOTE)));

    render(<NoteDetail noteId={1} />);

    expect(await screen.findByLabelText('Título')).toHaveValue('Comprar pan');
    expect(screen.getByLabelText('Cuerpo')).toHaveValue('Antes de las 8');
  });

  it('shows_a_not_found_message_when_the_note_does_not_exist', async () => {
    server.use(
      http.get(NOTE_ENDPOINT, () =>
        HttpResponse.json({ error: 'Nota no encontrada' }, { status: 404 }),
      ),
    );

    render(<NoteDetail noteId={1} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe ninguna nota con id 1.');
    // No debe quedar ningún formulario de edición para una nota que no existe.
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });

  it('shows_a_generic_error_message_when_the_api_call_fails_for_another_reason', async () => {
    server.use(
      http.get(NOTE_ENDPOINT, () =>
        HttpResponse.json({ error: 'Error interno del servidor' }, { status: 500 }),
      ),
    );

    render(<NoteDetail noteId={1} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
  });

  it('saves_changes_successfully_disables_the_button_while_saving_and_shows_confirmation', async () => {
    server.use(http.get(NOTE_ENDPOINT, () => HttpResponse.json(EXISTING_NOTE)));
    server.use(
      http.put(NOTE_ENDPOINT, async ({ request }) => {
        const input = (await request.json()) as { title: string; body: string | null };
        await delay(50);
        return HttpResponse.json({
          ...EXISTING_NOTE,
          title: input.title,
          body: input.body,
          updatedAt: '2026-08-01T01:00:00.000Z',
        });
      }),
    );

    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<NoteDetail noteId={1} onSaved={onSaved} />);

    const titleInput = await screen.findByLabelText('Título');
    await user.clear(titleInput);
    await user.type(titleInput, 'Comprar pan integral');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();

    expect(await screen.findByText('Nota guardada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect(titleInput).toHaveValue('Comprar pan integral');
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Comprar pan integral' }),
    );
  });

  it('shows_a_validation_error_and_does_not_save_when_title_is_cleared', async () => {
    server.use(http.get(NOTE_ENDPOINT, () => HttpResponse.json(EXISTING_NOTE)));

    const user = userEvent.setup();
    render(<NoteDetail noteId={1} />);

    const titleInput = await screen.findByLabelText('Título');
    await user.clear(titleInput);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El título es obligatorio.');
  });
});
