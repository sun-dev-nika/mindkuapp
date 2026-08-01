import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { server } from '../tests/server';
import { AppRoutes } from './AppRoutes';

/**
 * Prueba de punta a punta del router: arranca directamente en una URL con
 * `MemoryRouter initialEntries`, sin pasar por ningún clic previo — es el
 * equivalente de prueba de "pegar un link compartido en el navegador".
 */
function renderAppAtUrl(initialUrl: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders_the_home_page_at_the_root_url', async () => {
    server.use(http.get('http://localhost:3000/notes', () => HttpResponse.json([])));

    renderAppAtUrl('/');

    expect(screen.getByRole('heading', { name: 'Notas' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Crear nota' })).toBeInTheDocument();
    expect(await screen.findByText('No hay notas todavía.')).toBeInTheDocument();
  });

  it('loads_and_shows_a_note_when_arriving_directly_at_its_url_without_going_through_the_list', async () => {
    server.use(
      http.get('http://localhost:3000/notes/1', () =>
        HttpResponse.json({
          id: 1,
          title: 'Nota compartida',
          body: 'Se llega directo por URL',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        }),
      ),
    );

    renderAppAtUrl('/notes/1');

    // No debe aparecer nada del Home (ni el formulario de creación ni el
    // listado): llegar directo a /notes/1 muestra solo el detalle.
    expect(screen.queryByRole('form', { name: 'Crear nota' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Título')).toHaveValue('Nota compartida');
    expect(screen.getByLabelText('Cuerpo')).toHaveValue('Se llega directo por URL');
  });
});
