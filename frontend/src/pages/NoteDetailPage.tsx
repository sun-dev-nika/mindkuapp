import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';

import { NoteDetail } from '../components/NoteDetail';

/**
 * Página `/notes/:id`: wrapper delgado que lee el id de la URL con
 * `useParams` y se lo pasa a `NoteDetail` (que no cambia — sigue recibiendo
 * `noteId` por prop, ajeno a que ahora existe una URL). Si el segmento de
 * la URL no es un entero positivo (por ejemplo `/notes/abc`), se muestra
 * "Id de nota inválido." sin siquiera intentar `GET /notes/abc` — ese caso
 * se distingue del 404 real (id con formato válido pero que no existe en la
 * base de datos), que sí resuelve `NoteDetail` internamente.
 */
export function NoteDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const noteId = Number(id);

  if (id === undefined || !Number.isInteger(noteId) || noteId <= 0) {
    return <p role="alert">Id de nota inválido.</p>;
  }

  return <NoteDetail noteId={noteId} />;
}
