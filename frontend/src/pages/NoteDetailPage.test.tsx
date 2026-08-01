import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { server } from '../../tests/server';
import { NoteDetailPage } from './NoteDetailPage';

/**
 * Monta `NoteDetailPage` bajo la misma ruta real (`/notes/:id`) que usa
 * `AppRoutes`, arrancando en la URL indicada — simula "llegar directo por
 * URL" (pegar un link compartido) sin pasar por `NotesList`.
 */
function renderAtUrl(initialUrl: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/notes/:id" element={<NoteDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NoteDetailPage', () => {
  it('reads_the_id_from_the_url_and_renders_that_note', async () => {
    server.use(
      http.get('http://localhost:3000/notes/7', () =>
        HttpResponse.json({
          id: 7,
          title: 'Nota compartida por link',
          body: 'Contenido de la nota 7',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        }),
      ),
    );

    renderAtUrl('/notes/7');

    expect(await screen.findByLabelText('Título')).toHaveValue('Nota compartida por link');
    expect(screen.getByLabelText('Cuerpo')).toHaveValue('Contenido de la nota 7');
  });

  it('shows_the_not_found_message_from_note_detail_when_the_id_does_not_exist', async () => {
    server.use(
      http.get('http://localhost:3000/notes/999', () =>
        HttpResponse.json({ error: 'Nota no encontrada' }, { status: 404 }),
      ),
    );

    renderAtUrl('/notes/999');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No existe ninguna nota con id 999.',
    );
  });

  it('shows_an_invalid_id_message_without_calling_the_api_when_the_url_segment_is_not_a_number', () => {
    // A propósito no se registra ningún handler para `/notes/abc`: si
    // `NoteDetailPage` igual intentara llamar a la API, `onUnhandledRequest:
    // 'error'` (configurado en tests/setupTests.ts) haría fallar el test.
    renderAtUrl('/notes/abc');

    expect(screen.getByRole('alert')).toHaveTextContent('Id de nota inválido.');
  });
});
