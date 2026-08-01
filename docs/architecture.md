# Arquitectura — Qué significa "hacer un buen trabajo" (Notes Web)

> Este documento define el estándar de calidad. Los agentes revisores
> evalúan código contra este archivo. Si no está aquí, no es un requisito.

## Principios

1. **Capas claras, y solo las necesarias:**
   - `db/` — esquema y migraciones SQL puro. No es código de aplicación.
   - `backend/src/db.ts` — conexión (`mysql2` pool) y queries parametrizadas.
     Equivalente a `storage.py` del CLI: es la única capa que toca la base
     de datos.
   - `backend/src/routes/*.ts` — capa REST: valida input, traduce a códigos
     HTTP, llama a `db.ts`. Equivalente a `cli.py`.
   - `backend/src/types.ts` — interfaces TypeScript del dominio (`Note`) y
     validación mínima. Equivalente a `notes.py`, pero sin lógica de negocio
     compleja: en este MVP la "lógica" vive casi toda en SQL y en las rutas.
   - `frontend/src/api/notesApi.ts` — cliente REST tipado (wrapper de
     `fetch`), la única capa que habla con el backend.
   - `frontend/src/components/*.tsx` — un componente, una responsabilidad.
   No introducir una capa de "services" o "repositories" adicional en el
   backend, ni un gestor de estado global (Redux/Zustand) en el frontend,
   hasta que haya una razón concreta documentada en `feature_list.json`.

2. **Sin ORM.** Solo `mysql2` con SQL explícito. Si una feature parece
   necesitar un ORM, primero se discute (estado `blocked`) — es una decisión
   de producto de este proyecto, no un detalle técnico negociable.

3. **Errores explícitos.** El backend responde siempre `{ "error": string }`
   con el código HTTP apropiado (400 validación, 404 no encontrado, 500
   inesperado). Nunca se filtra un stack trace al cliente. El frontend
   maneja explícitamente los estados `loading` / `error` / `success` — nunca
   un `null` silencioso.

4. **Tipos explícitos.** TypeScript en modo `strict`. Las firmas de función
   públicas siempre declaran tipos de entrada y salida. Evitar `any`; si es
   inevitable, comentar por qué.

5. **SQL parametrizado siempre.** Ninguna query construye el string
   concatenando input del usuario (previene SQL injection). Esto es
   verificable por el reviewer con una lectura rápida del código.

6. **Routing declarativo, capa mínima.** Desde la feature 11
   (`frontend_routing_note_links`), el frontend usa `react-router-dom`
   (modo clásico `BrowserRouter`, sin RSC ni loaders/actions del "framework
   mode") para que cada nota tenga una URL propia y compartible
   (`/notes/:id`). La capa de routing se mantiene deliberadamente delgada:
   - `frontend/src/App.tsx` — shell puro: solo envuelve `AppRoutes` en un
     `BrowserRouter`. No contiene JSX de dominio.
   - `frontend/src/AppRoutes.tsx` — declara las rutas (`<Routes>`/`<Route>`)
     y qué página monta cada una. Separado de `App` para poder testearlo
     con `MemoryRouter` sin arrastrar un `BrowserRouter` real.
   - `frontend/src/pages/*.tsx` — una página por ruta (`HomePage` para `/`,
     `NoteDetailPage` para `/notes/:id`). Una página es un componente
     delgado: lee parámetros de la URL (`useParams`) o navega
     (`useNavigate`), y delega toda la lógica de negocio a los componentes
     de `components/`.
   - `frontend/src/components/*.tsx` — siguen siendo los componentes con la
     lógica real (`NoteDetail`, `CreateNoteForm`, `NotesList`) y siguen sin
     saber que existe un router, salvo el uso puntual de `<Link>` en
     `NotesList` para enlazar cada nota a su URL. No se le agregó
     conocimiento de rutas a `NoteDetail` (sigue recibiendo `noteId` por
     prop) para que siga siendo testeable de forma aislada, como antes de
     esta feature.
   No se introduce ningún gestor de estado global (Redux/Zustand/Context de
   routing propio) para resolver esto — `react-router-dom` ya expone lo
   necesario (`useParams`, `useNavigate`, `<Link>`) sin una capa adicional.

## Flujo de datos

```
navegador ─→ React (frontend/src/api/notesApi.ts, fetch tipado)
                    │
                    └─→  Express routes (backend/src/routes/notes.ts)
                              │
                              ├─ valida input (backend/src/types.ts)
                              │
                              └─→  backend/src/db.ts (mysql2 pool, SQL explícito)
                                        │
                                        └─→  MySQL, tabla `notes`
```

## Qué NO hacer

- No usar `console.log` para errores en producción. Usa el middleware de
  manejo de errores de Express y responde con el código HTTP correcto.
- No mezclar SQL con lógica de presentación dentro de las rutas: la query
  vive en `db.ts`, la ruta solo orquesta.
- No hacer una query por cada nota dentro de un loop. Una query por
  operación.
- No añadir autenticación, roles, ni sistema de configuración fuera de
  variables de entorno documentadas (`.env.example`).
- No traducir literalmente la lógica de `notes-cli` en Python — es un
  puerto conceptual (mismo dominio, distinta interfaz), no una copia.
