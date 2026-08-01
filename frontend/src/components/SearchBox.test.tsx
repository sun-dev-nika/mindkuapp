import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { server } from '../../tests/server';
import { SearchBox } from './SearchBox';

const SEARCH_ENDPOINT = 'http://localhost:3000/notes/search';

function renderSearchBox(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <SearchBox />
    </MemoryRouter>,
  );
}

describe('SearchBox', () => {
  it('shows_nothing_searched_yet_before_typing_anything', () => {
    renderSearchBox();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Resultados de la búsqueda' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin resultados/)).not.toBeInTheDocument();
  });

  it('shows_matching_notes_returned_by_the_search_endpoint_while_typing', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        if (q !== 'pan') {
          return HttpResponse.json([]);
        }
        return HttpResponse.json([
          {
            id: 1,
            title: 'Comprar pan',
            body: 'Antes de las 8',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ]);
      }),
    );

    const user = userEvent.setup();
    renderSearchBox();

    await user.type(screen.getByLabelText('Buscar en título o cuerpo'), 'pan');

    expect(await screen.findByText('Comprar pan')).toBeInTheDocument();
    expect(screen.getByText('Antes de las 8')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comprar pan' })).toHaveAttribute('href', '/notes/1');
  });

  it('shows_an_explicit_no_results_message_when_the_search_finds_nothing', async () => {
    server.use(http.get(SEARCH_ENDPOINT, () => HttpResponse.json([])));

    const user = userEvent.setup();
    renderSearchBox();

    await user.type(
      screen.getByLabelText('Buscar en título o cuerpo'),
      'xyz-no-deberia-existir',
    );

    expect(await screen.findByText('Sin resultados para "xyz-no-deberia-existir".')).toBeInTheDocument();
  });

  it('shows_an_error_message_when_the_search_call_fails', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () =>
        HttpResponse.json({ error: 'Error interno del servidor' }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderSearchBox();

    await user.type(screen.getByLabelText('Buscar en título o cuerpo'), 'pan');

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
  });

  it('debounces_keystrokes_and_only_sends_one_request_for_the_final_query', async () => {
    let requestCount = 0;
    let lastQuery = '';
    server.use(
      http.get(SEARCH_ENDPOINT, ({ request }) => {
        requestCount += 1;
        lastQuery = new URL(request.url).searchParams.get('q') ?? '';
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    renderSearchBox();

    await user.type(screen.getByLabelText('Buscar en título o cuerpo'), 'pan');

    // Espera a que el debounce (300ms) dispare la única petición esperada,
    // en vez de una por cada letra tipeada ("p", "pa", "pan").
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
    expect(lastQuery).toBe('pan');
  });
});
