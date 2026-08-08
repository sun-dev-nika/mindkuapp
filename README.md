# Notes Web

Aplicación web de notas: crear, listar, ver/editar, eliminar y buscar
notas, con links directos y compartibles a cada nota.

## Deploy

- **Frontend:** https://mindkuapp.vercel.app
- **Backend (API):** https://mindkuapp-production.up.railway.app
- **Base de datos:** MySQL en Railway

El mismo proyecto se desplegó además sobre AWS (EC2 + RDS + S3/CloudFront,
con CI/CD por OIDC) como ejercicio de infraestructura, se verificó de punta a
punta y se desmanteló después de capturar la evidencia — costo total $0.
Arquitectura, decisiones y comparación "antes vs. después" en
[`docs/aws/README.md`](docs/aws/README.md).

## Stack

- **Backend:** Node.js + Express + TypeScript, MySQL sin ORM (`mysql2`,
  SQL explícito).
- **Frontend:** React + TypeScript + Vite, routing con `react-router-dom`.
- **Comunicación:** API REST. El backend expone además un endpoint
  `/graphql` (Apollo Server) como forma alternativa de consumir el mismo
  dominio de notas — ver la sección [GraphQL](#graphql-alternativo-a-rest)
  más abajo.

Ver [`docs/architecture.md`](docs/architecture.md) para el detalle de
capas y decisiones de diseño, y [`docs/conventions.md`](docs/conventions.md)
para convenciones de código.

## Cómo correrlo en local

Requiere Node.js 18+ y un servidor MySQL accesible.

### Backend

```bash
cd backend
cp .env.example .env   # completar con tus credenciales de MySQL
npm install
npm run build && npm start   # o `npm run dev` para desarrollo
```

`npm run dev` y `npm start` cargan `backend/.env` automáticamente (vía
`dotenv`) antes de arrancar, así que no hace falta exportar las variables a
mano en la terminal — alcanza con completar el archivo `.env`. En producción
(Railway) esto no cambia nada: el hosting inyecta las variables por su cuenta
y `dotenv` nunca sobreescribe una variable que ya esté definida.

Aplicar el esquema antes de arrancar (ver
[`db/schema.md`](db/schema.md) para el detalle):

```bash
mysql -u <usuario> -p < db/migrations/001_init.sql
```

### Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE_URL apuntando al backend
npm install
npm run dev
```

### Tests

```bash
cd backend && npm test
cd frontend && npm test
```

## GraphQL (alternativo a REST)

Además de las rutas REST (`/notes`, `/notes/:id`, `/notes/search`), el
backend expone `/graphql` (Apollo Server, montado sobre el mismo `app` de
Express en `backend/src/app.ts`) con el mismo dominio de notas:

- **Queries:** `notes` (lista) y `note(id: ID!)` (una nota puntual).
- **Mutations:** `createNote(input: CreateNoteInput!)`,
  `updateNote(id: ID!, input: UpdateNoteInput!)`, `deleteNote(id: ID!)`.

Los resolvers llaman directo a las mismas funciones de
`backend/src/db.ts` que usan las rutas REST — no hay una segunda capa de
acceso a datos para GraphQL. `/graphql` exige la misma cookie de sesión
httpOnly que REST (`notes_session`); sin sesión válida responde `401` con
un error `UNAUTHENTICATED`, y cada query/mutation filtra por el usuario
autenticado igual que REST (un usuario nunca ve ni modifica notas de otro).

Ejemplo con `curl` (reemplazando la cookie por la que devuelve
`POST /auth/login`):

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -b "notes_session=<token>" \
  -d '{"query":"{ notes { id title } }"}'
```

## CI

`.github/workflows/ci.yml` corre en cada `push` y `pull_request` hacia
`main`:

- **`backend-tests`**: levanta un servicio MySQL 8 real (no mockeado),
  espera su healthcheck, aplica el esquema (`db/migrations/001_init.sql` +
  `002_add_users.sql`) y corre los 52 tests de backend (Jest + Supertest,
  incluye REST y GraphQL)
  contra esa base, igual que en local.
- **`frontend-tests`**: corre los 38 tests de frontend (Vitest + React
  Testing Library + msw).

### Activar el gate de tests antes de mergear (paso manual, una sola vez)

GitHub Actions no puede forzar por sí solo que un PR no se mergee sin el
check en verde — eso es configuración del repositorio, no algo scripteable
desde el workflow. Para activarlo:

1. En GitHub, ir a **Settings → Branches** del repositorio.
2. En **Branch protection rules**, añadir una regla para `main`.
3. Activar **Require status checks to pass before merging**.
4. Seleccionar los checks `backend-tests` y `frontend-tests` (aparecen en
   la lista después de que el workflow corrió al menos una vez).
5. Guardar. A partir de ahí, ningún PR a `main` se puede mergear si el CI
   está en rojo.

## Estructura

```
.
├── db/                  # esquema y migraciones SQL
├── backend/              # API REST (Express + TypeScript)
├── frontend/             # SPA (React + TypeScript + Vite)
└── docs/
    ├── architecture.md
    ├── conventions.md
    └── verification.md
```
