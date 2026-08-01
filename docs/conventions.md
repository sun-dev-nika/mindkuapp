# Convenciones de código — Notes Web

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se parece
> a sí mismo en todas partes.

## Estilo TypeScript

- **Modo:** `strict: true` en `tsconfig.json`, en backend y frontend.
- **Formato:** líneas máximo 100 caracteres.
- **Imports:** builtins de Node primero, luego paquetes externos, luego
  módulos locales (relativos). Una línea en blanco entre cada grupo.
- **Strings:** comillas simples `'...'` (convención del ecosistema JS/TS —
  distinto del CLI en Python, que usaba comillas dobles; es una decisión
  deliberada, no un descuido).
- **Funciones públicas** siempre con tipo de entrada y salida explícito.
  Evitar `any`; si es inevitable, un comentario explica por qué.

## Nombres

| Tipo                      | Convención     | Ejemplo                  |
|----------------------------|----------------|---------------------------|
| Archivos de componentes React | `PascalCase.tsx` | `NotesList.tsx`       |
| Resto de archivos TS       | `camelCase.ts` | `notesApi.ts`             |
| Interfaces / tipos         | `PascalCase`   | `Note`, `CreateNoteInput` |
| Funciones / variables      | `camelCase`    | `getNoteById`             |
| Constantes                 | `UPPER_SNAKE`  | `DEFAULT_PORT`            |
| Tablas / columnas SQL      | `snake_case`   | `created_at`              |
| Palabras clave SQL         | MAYÚSCULAS     | `SELECT ... WHERE`        |

## Estructura de archivo (backend)

```typescript
/** Una línea describiendo el propósito del módulo. */
import express from "express";

import { getNoteById } from "../db";
import type { Note } from "../types";
```

## Tests

- Backend: un archivo de test por módulo de rutas:
  `backend/tests/notes.test.ts`. Jest + Supertest, contra una base de datos
  MySQL de test real (variable `NOTES_DB_NAME=notes_test` o equivalente).
  El script `test` en `package.json` debe ser no-interactivo (CI-safe).
- Frontend: un archivo de test por componente clave, colocado junto al
  componente o en `__tests__/`. Vitest + React Testing Library. Se puede
  mockear la red (`msw`) para aislar el componente, pero al menos un test
  de integración manual contra el backend real antes de cerrar el MVP
  (feature 10).
- Nombres de test descriptivos: `returns_404_when_note_not_found`.

## Manejo de errores

Clase de error del dominio en `backend/src/errors.ts`:

```typescript
export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
```

Las rutas capturan `ApiError` (o dejan que el middleware de error de Express
lo haga) y responden `{ "error": message }` con el `statusCode` correcto.
Nunca se propaga un stack trace al cliente.

## Comentarios

Por defecto **no** se escriben. Solo se permiten cuando explican un *por qué*
no obvio (workaround documentado, invariante sutil, `any` justificado). Los
nombres deben hacer el resto.
