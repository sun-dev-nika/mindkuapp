# Notes Web

Aplicación web de notas: crear, listar, ver/editar, eliminar y buscar
notas, con links directos y compartibles a cada nota.

## Stack

- **Backend:** Node.js + Express + TypeScript, MySQL sin ORM (`mysql2`,
  SQL explícito).
- **Frontend:** React + TypeScript + Vite, routing con `react-router-dom`.
- **Comunicación:** API REST.

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
