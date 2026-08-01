import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';

import { server } from '../../tests/server';
import { CreateNoteForm } from './CreateNoteForm';

const NOTES_ENDPOINT = 'http://localhost:3000/notes';

describe('CreateNoteForm', () => {
  it('shows_a_validation_error_and_does_not_submit_when_title_is_empty', async () => {
    // A propósito no se registra ningún handler de POST: si el componente
    // igual intentara mandar la petición, `onUnhandledRequest: 'error'`
    // (configurado en tests/setupTests.ts) haría fallar el test.
    const user = userEvent.setup();
    render(<CreateNoteForm />);

    await user.click(screen.getByRole('button', { name: 'Crear nota' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El título es obligatorio.');
    expect(screen.getByRole('button', { name: 'Crear nota' })).toBeEnabled();
  });

  it('trims_a_whitespace_only_title_and_treats_it_as_empty', async () => {
    const user = userEvent.setup();
    render(<CreateNoteForm />);

    await user.type(screen.getByLabelText('Título'), '   ');
    await user.click(screen.getByRole('button', { name: 'Crear nota' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El título es obligatorio.');
  });

  it('submits_successfully_disables_the_button_while_in_flight_and_clears_the_form', async () => {
    server.use(
      http.post(NOTES_ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as { title: string; body: string | null };
        await delay(50);
        return HttpResponse.json(
          {
            id: 1,
            title: body.title,
            body: body.body,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<CreateNoteForm onCreated={onCreated} />);

    const titleInput = screen.getByLabelText('Título');
    const bodyInput = screen.getByLabelText('Cuerpo');

    await user.type(titleInput, 'Comprar pan');
    await user.type(bodyInput, 'Antes de las 8');
    await user.click(screen.getByRole('button', { name: 'Crear nota' }));

    // Mientras la petición está en curso (el handler de arriba demora 50ms),
    // el botón debe estar deshabilitado.
    expect(screen.getByRole('button', { name: 'Creando…' })).toBeDisabled();

    expect(await screen.findByText('Nota creada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear nota' })).toBeEnabled();
    expect(titleInput).toHaveValue('');
    expect(bodyInput).toHaveValue('');
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Comprar pan', body: 'Antes de las 8' }),
    );
  });

  it('shows_an_error_and_re_enables_the_button_when_the_api_call_fails', async () => {
    server.use(
      http.post(NOTES_ENDPOINT, () =>
        HttpResponse.json({ error: 'Error interno del servidor' }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    render(<CreateNoteForm />);

    await user.type(screen.getByLabelText('Título'), 'Comprar pan');
    await user.click(screen.getByRole('button', { name: 'Crear nota' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.getByRole('button', { name: 'Crear nota' })).toBeEnabled();
    // El texto ya escrito se conserva para que el usuario pueda reintentar.
    expect(screen.getByLabelText('Título')).toHaveValue('Comprar pan');
  });
});
