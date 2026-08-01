# Esquema de base de datos — `notes`

> Este documento explica **qué** define `db/migrations/001_init.sql` y
> **por qué** se eligió cada tipo/constraint. `db/` es solo esquema y
> migraciones SQL puro (ver `docs/architecture.md`); no hay ORM.

## Base de datos

`CREATE DATABASE IF NOT EXISTS notes_web` con `utf8mb4` /
`utf8mb4_unicode_ci`.

- **`IF NOT EXISTS`**: la migración es idempotente al nivel de creación de
  la base — se puede correr en un servidor MySQL limpio sin fallar si ya
  existe (por ejemplo, si se vuelve a ejecutar por error).
- **`utf8mb4`** en vez de `utf8` (el `utf8` histórico de MySQL es en
  realidad un subconjunto de 3 bytes que no cubre emoji ni varios
  caracteres fuera del BMP). `utf8mb4` es el UTF-8 completo: notas de
  usuario son texto libre, no hay razón para limitar qué caracteres puede
  escribir.
- **`utf8mb4_unicode_ci`**: collation case-insensitive y basada en reglas
  Unicode de comparación (más correcta para ordenar/comparar texto humano
  que `utf8mb4_general_ci`, que es una aproximación más rápida pero menos
  precisa). Con el volumen de datos de este proyecto (una app de notas
  personal), la diferencia de rendimiento es irrelevante; se prioriza
  corrección.

## Tabla `notes`

| Columna      | Tipo                | Constraints                  |
|--------------|---------------------|-------------------------------|
| `id`         | `INT UNSIGNED`      | `PRIMARY KEY AUTO_INCREMENT` |
| `title`      | `VARCHAR(200)`      | `NOT NULL`                   |
| `body`       | `TEXT`              | (nullable)                   |
| `created_at` | `DATETIME`          | `NOT NULL`                   |
| `updated_at` | `DATETIME`          | `NOT NULL`                   |

### `id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`

- **`INT UNSIGNED`** en vez de `BIGINT`: una app de notas personal no va a
  acercarse a los ~4.29 mil millones de filas que permite `INT UNSIGNED`.
  Usar `BIGINT` "por si acaso" agrega 4 bytes por fila sin beneficio real
  en este dominio; se puede migrar a `BIGINT` más adelante si el proyecto
  cambia de escala (no es una decisión irreversible).
- **`UNSIGNED`**: un id nunca es negativo; declarar esa invariante en el
  tipo (en vez de confiar en la aplicación) es más explícito y elimina una
  clase entera de bugs (ids negativos por overflow o error de lógica).
- **`AUTO_INCREMENT` + `PRIMARY KEY`**: cumple literalmente el criterio de
  aceptación (id autoincremental como clave primaria) y es el patrón
  estándar de MySQL para claves sustitutas (surrogate keys).

### `title VARCHAR(200) NOT NULL`

- **`VARCHAR` y no `TEXT`**: un título es corto y de una sola línea por
  naturaleza (es lo que se muestra en un listado); `VARCHAR` permite
  indexarlo eficientemente en el futuro (por ejemplo, si `backend_search`
  necesita un índice) y dispositivos/formularios lo tratan naturalmente
  como campo de una línea.
- **`200` caracteres**: suficientemente holgado para cualquier título
  razonable de una nota (mucho más que un asunto de email típico, que
  ronda 78-100 caracteres), sin ser un límite arbitrario tipo 255 heredado
  de convenciones antiguas de MySQL. Es un límite de sanidad, no una
  restricción de producto — se puede ampliar sin migración destructiva si
  hiciera falta.
- **`NOT NULL`**: cumple el criterio de aceptación explícito y refleja la
  regla de negocio real: una nota sin título no tiene sentido en la UI
  (se valida además en `POST /notes`, feature 2 — la constraint de base
  de datos es la última línea de defensa, no la única).

### `body TEXT` (nullable)

- **`TEXT` y no `VARCHAR`**: el cuerpo de una nota es contenido largo y de
  longitud variable sin un límite práctico natural (a diferencia del
  título); `VARCHAR` en MySQL tiene límites prácticos de tamaño de fila
  compartidos entre todas las columnas `VARCHAR`, mientras que `TEXT` se
  almacena fuera de la fila principal y no compite por ese límite.
- **Nullable (sin `NOT NULL`)**: el criterio de aceptación solo exige
  `NOT NULL` para `title`; una nota con solo título y sin cuerpo (una
  nota tipo "recordatorio de una línea") es un caso de uso válido, así
  que forzar `NOT NULL` con un default de string vacío sería una
  restricción artificial no pedida por el negocio.

### `created_at DATETIME NOT NULL` / `updated_at DATETIME NOT NULL`

- **`DATETIME` y no `TIMESTAMP`**: `TIMESTAMP` en MySQL se almacena en UTC
  internamente y se convierte a la zona horaria de la sesión al leer/
  escribir — eso introduce una conversión implícita que puede dar
  resultados distintos según la configuración del servidor o del cliente.
  `DATETIME` almacena el valor literal tal cual se escribe, sin magia de
  zona horaria: es más explícito y predecible, alineado con el principio
  de "tipos explícitos, sin ambigüedad" del proyecto. Además `TIMESTAMP`
  en MySQL solo cubre hasta el año 2038, mientras que `DATETIME` cubre
  hasta el año 9999.
- **`NOT NULL` sin `DEFAULT CURRENT_TIMESTAMP`**: se deja fuera cualquier
  default automático a nivel de columna a propósito. Estos valores los
  va a fijar explícitamente la capa de aplicación (`backend/src/db.ts`,
  feature 2) al insertar/actualizar una nota, en vez de depender de un
  comportamiento implícito de MySQL — mantiene la lógica de "cuándo se
  creó/actualizó una nota" visible y revisable en el código TypeScript,
  no escondida en el DDL.
- **Nombres en `snake_case`** (`created_at`, `updated_at`): sigue
  `docs/conventions.md` para nombres de columnas SQL.

### `ENGINE = InnoDB`

- **InnoDB** (el motor por defecto en MySQL moderno) en vez de `MyISAM`:
  soporta transacciones y claves foráneas, necesario si el esquema crece
  (por ejemplo, tags o usuarios en el futuro) y es el estándar de facto
  para cualquier tabla nueva en MySQL hoy en día.

### Sin ORM

Todo el DDL es SQL explícito, escrito a mano y revisable línea por línea
en `db/migrations/001_init.sql` — no hay Prisma, TypeORM, Sequelize ni
generador de esquema de por medio, cumpliendo la regla no negociable de
`docs/architecture.md` y `feature_list.json` (`"no_orm": true`).

## Cómo aplicar la migración

Requiere un servidor MySQL accesible y el cliente `mysql` en el `PATH`.

```bash
mysql -u root -p < db/migrations/001_init.sql
```

- El script ya incluye `CREATE DATABASE IF NOT EXISTS notes_web`, así que
  **no** hace falta crear la base de datos a mano ni pasar el nombre de
  la base como argumento — el propio script selecciona `notes_web` con
  `USE notes_web;` antes de crear la tabla.
- Se pedirá la contraseña del usuario `root` (o el usuario que se use en
  su lugar) de forma interactiva por el flag `-p`.
- Para un entorno de test separado (ver `docs/conventions.md`, variable
  `NOTES_DB_NAME=notes_test`), se aplica la misma migración contra un
  nombre de base distinto editando la línea `CREATE DATABASE` o, más
  simple, ejecutando el mismo archivo tras cambiar el nombre en una
  variable de entorno cuando exista la capa de aplicación (feature 2).
- Verificación manual de que la migración se aplicó:

```bash
mysql -u root -p -e "USE notes_web; DESCRIBE notes;"
```
