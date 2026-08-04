# Esquema de base de datos — `notes`

> Este documento explica **qué** define `db/migrations/001_init.sql` y
> `db/migrations/002_add_users.sql`, y **por qué** se eligió cada tipo/
> constraint. `db/` es solo esquema y migraciones SQL puro (ver
> `docs/architecture.md`); no hay ORM. No existe una tabla de control de
> migraciones (tipo `schema_migrations`) en este proyecto: el número al
> inicio del nombre de archivo (`001_`, `002_`, ...) es la única
> convención de orden, y cada una se corre una sola vez, a mano, contra
> cada base de datos (ver "Cómo aplicar la migración" más abajo).

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

| Columna      | Tipo                | Constraints                                       |
|--------------|---------------------|----------------------------------------------------|
| `id`         | `INT UNSIGNED`      | `PRIMARY KEY AUTO_INCREMENT`                       |
| `title`      | `VARCHAR(200)`      | `NOT NULL`                                          |
| `body`       | `TEXT`              | (nullable)                                          |
| `created_at` | `DATETIME`          | `NOT NULL`                                          |
| `updated_at` | `DATETIME`          | `NOT NULL`                                          |
| `user_id`    | `INT UNSIGNED`      | nullable, `FOREIGN KEY` → `users.id` (migración 002) |

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

### `user_id INT UNSIGNED` nullable, `FOREIGN KEY` a `users.id` (migración 002)

Agregada por `db/migrations/002_add_users.sql` a pedido explícito del
humano de agregar autenticación (feature `db_users_schema`, previamente
excluida a propósito del MVP — ver `feature_list.json`).

- **`INT UNSIGNED`, no `BIGINT`**: mismo tipo y mismo razonamiento que
  `notes.id`/`users.id` — consistencia entre columna e id referenciado
  (una foreign key debe tener el mismo tipo que la columna a la que
  apunta), y la misma escala de proyecto (app personal, no miles de
  millones de usuarios).
- **Nullable, deliberadamente sin `NOT NULL` — la decisión más importante
  de esta migración.** El criterio de aceptación pide documentar esto
  explícitamente porque `notes` **ya existe con filas reales** tanto en
  producción (Railway) como en el `notes_test` local usado por los tests
  automatizados, y ninguna de esas notas tiene todavía un usuario dueño
  (la autenticación no existía hasta esta feature). Si `user_id` fuera
  `NOT NULL` sin un `DEFAULT`, el `ALTER TABLE` fallaría inmediatamente
  contra cualquier base con al menos una nota existente (MySQL no puede
  rellenar un `NOT NULL` nuevo sin valor por defecto ni saber qué usuario
  asignarle a una fila vieja). Inventar un usuario "sistema" o "migración"
  ficticio para asignárselo a las notas huérfanas se descartó: crearía un
  usuario falso con contraseña inventada solo para satisfacer una
  constraint, lo cual es más confuso que simplemente modelar la realidad
  ("esta nota no tiene dueño conocido todavía").
  - **Qué pasa con esas notas "huérfanas" (`user_id IS NULL`):** no se
    borran ni se migran automáticamente a ningún usuario. Simplemente
    quedan en la tabla tal cual. El comportamiento visible depende de la
    feature 15 (`backend_auth`, todavía pendiente): en cuanto esa feature
    filtre `GET/POST/PUT/DELETE /notes` por `WHERE user_id = ?` del
    usuario autenticado, esas filas con `user_id NULL` dejan de aparecer
    en cualquier respuesta de la API — no porque se hayan eliminado, sino
    porque ninguna condición `user_id = <algún id>` va a matchear `NULL`
    (es el comportamiento estándar de SQL: `NULL = valor` nunca es
    verdadero). Quedan en la base, inaccesibles vía la API, hasta que
    alguien decida qué hacer con ellas manualmente (por ejemplo,
    asignárselas a un usuario a mano con un `UPDATE`) — eso es una
    decisión de producto fuera del alcance de esta migración.
  - **Pregunta abierta para el humano/reviewer:** ¿tiene sentido, en una
    feature posterior, ofrecer alguna forma de "reclamar" notas huérfanas
    (por ejemplo, si se sabe que todas las notas de prueba actuales
    pertenecen al primer usuario que se registre)? Esta migración no toma
    esa decisión — la deja abierta a propósito, documentada acá en vez de
    resuelta unilateralmente.
- **`FOREIGN KEY ... REFERENCES users (id)`**: la constraint de integridad
  referencial en sí (no solo la columna) es la que impide que
  `notes.user_id` apunte a un usuario que no existe — MySQL la rechaza en
  el momento del `INSERT`/`UPDATE`, no depende de que la aplicación
  recuerde validarlo. InnoDB además crea automáticamente un índice sobre
  `user_id` al declarar la foreign key (requisito del motor), que es
  exactamente el índice que la feature 15 va a necesitar para que el
  filtro `WHERE user_id = ?` de cada request no haga un table scan
  completo de `notes` en cada petición.
- **`ON DELETE SET NULL`**: si un usuario se borra de `users`, sus notas
  no se borran en cascada — pasan a `user_id = NULL`, el mismo estado
  "huérfana" ya descrito arriba, consistente con la filosofía de este
  proyecto de no hacer operaciones destructivas implícitas (ver
  `docs/architecture.md`, "Qué NO hacer"). Si en el futuro se decide que
  borrar un usuario SÍ debería borrar sus notas, es una decisión de
  producto explícita para otra migración, no un efecto secundario
  automático de esta.
- **`ON UPDATE CASCADE`**: si el `id` de un usuario cambiara (no debería
  pasar en el uso normal de un `AUTO_INCREMENT`, pero es la opción segura
  y estándar para esta cláusula), las notas que le pertenecen se
  actualizan para seguir apuntando al mismo usuario en vez de quedar
  huérfanas por una operación interna que no tiene que ver con el usuario
  perdiendo la nota.

### `ENGINE = InnoDB`

- **InnoDB** (el motor por defecto en MySQL moderno) en vez de `MyISAM`:
  soporta transacciones y claves foráneas, necesario si el esquema crece
  (por ejemplo, tags o usuarios en el futuro) y es el estándar de facto
  para cualquier tabla nueva en MySQL hoy en día.

### Sin ORM

Todo el DDL es SQL explícito, escrito a mano y revisable línea por línea
en `db/migrations/001_init.sql` (y, desde la feature `db_users_schema`,
también en `db/migrations/002_add_users.sql`) — no hay Prisma, TypeORM,
Sequelize ni generador de esquema de por medio, cumpliendo la regla no
negociable de `docs/architecture.md` y `feature_list.json`
(`"no_orm": true`).

## Tabla `users` (migración 002)

Agregada por `db/migrations/002_add_users.sql` para soportar
autenticación por email + contraseña (feature `db_users_schema`, a pedido
explícito del humano — la autenticación había quedado fuera del MVP
original a propósito, y se retoma ahora como tres features chicas
separadas: esta migración, `backend_auth` y `frontend_auth`).

| Columna         | Tipo             | Constraints                    |
|------------------|------------------|----------------------------------|
| `id`             | `INT UNSIGNED`   | `PRIMARY KEY AUTO_INCREMENT`    |
| `email`          | `VARCHAR(255)`   | `NOT NULL`, `UNIQUE`             |
| `password_hash`  | `VARCHAR(255)`   | `NOT NULL`                       |
| `created_at`     | `DATETIME`       | `NOT NULL`                       |

### `id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`

Mismo tipo y mismo razonamiento que `notes.id` (ver arriba): suficiente
para la escala de este proyecto, `UNSIGNED` porque un id nunca es
negativo, `AUTO_INCREMENT` como patrón estándar de clave sustituta.
Además, al ser el mismo tipo que `notes.user_id`, no hace falta ningún
cast implícito ni conversión al declarar la foreign key entre ambas
tablas — MySQL exige que el tipo de una FK coincida con el de la columna
referenciada.

### `email VARCHAR(255) NOT NULL UNIQUE`

- **`VARCHAR(255)`**: 255 es el límite práctico convencional para
  direcciones de email en la mayoría de los sistemas (el límite formal de
  RFC 5321 es 254 caracteres para la ruta completa); no hay ninguna razón
  de producto para acortarlo más, y ampliarlo más allá no aporta nada real
  (nadie tiene un email de más de 255 caracteres en la práctica). A
  diferencia de `notes.body`, un email sí es un campo corto de una sola
  línea por naturaleza, así que `VARCHAR` (no `TEXT`) es la elección
  correcta aquí, igual que `notes.title`.
- **`NOT NULL`**: cumple el criterio de aceptación explícito — no puede
  existir un usuario sin email, porque el email es literalmente el
  identificador con el que inicia sesión (no hay username separado en
  este diseño).
- **`UNIQUE` (vía `UNIQUE KEY uq_users_email`)**: cumple el criterio de
  aceptación explícito y es la regla de negocio real detrás de "iniciar
  sesión con email": si dos usuarios pudieran compartir el mismo email,
  `POST /auth/login` (feature `backend_auth`, todavía pendiente) no
  tendría forma de saber a cuál de los dos autenticar. Esta constraint es
  la última línea de defensa a nivel de base de datos — la feature
  `backend_auth` también va a validar esto antes de insertar (mismo
  patrón de "la app valida, la base de datos respalda" ya usado en
  `notes.title NOT NULL`), pero la constraint de la base de datos es la
  que de verdad impide un email duplicado incluso si hubiera una condición
  de carrera entre dos inserciones simultáneas (algo que una validación
  solo en la capa de aplicación no puede garantizar por sí sola).

### `password_hash VARCHAR(255) NOT NULL`

- **Nunca se guarda la contraseña en texto plano — el nombre de la
  columna lo dice explícitamente (`password_hash`, no `password`).**
  Esta migración solo define el tipo de columna; el hasheo en sí
  (`bcrypt`, según el plan documentado para la feature `backend_auth`) lo
  hace la capa de aplicación al registrar un usuario, nunca la base de
  datos — igual que `created_at`/`updated_at` en `notes`, la lógica de
  "cómo se calculó este valor" vive en TypeScript, revisable, no
  escondida en el DDL.
- **`VARCHAR(255)`, no un tamaño fijo más corto**: un hash de `bcrypt` mide
  siempre 60 caracteres exactos, así que `VARCHAR(60)` alcanzaría hoy —
  pero fijar la columna a esa medida exacta acoplaría el esquema a un
  algoritmo de hasheo específico. Si en el futuro se migra a `argon2` (los
  hashes resultantes pueden ser más largos, típicamente hasta ~100-120
  caracteres según los parámetros usados), `VARCHAR(255)` ya tiene margen
  de sobra sin necesitar otra migración. Es la misma filosofía de
  "límite de sanidad, no restricción de producto" que ya se documentó
  para `notes.title VARCHAR(200)`.
- **`NOT NULL`**: cumple el criterio de aceptación explícito — un usuario
  sin contraseña (ni siquiera hasheada) no puede autenticarse, así que no
  tiene sentido que exista la fila sin este valor.

### `created_at DATETIME NOT NULL`

Mismo tipo, mismo razonamiento y misma ausencia deliberada de `DEFAULT
CURRENT_TIMESTAMP` que `notes.created_at`/`notes.updated_at` (ver arriba):
`DATETIME` es explícito y sin conversión de zona horaria implícita, y el
valor lo va a fijar la aplicación al insertar el usuario (feature
`backend_auth`), no un default automático de MySQL. `users` no tiene una
columna `updated_at` propia todavía porque, a diferencia de una nota, el
criterio de aceptación de esta feature no pide poder editar un usuario
existente — si una feature futura agrega esa capacidad (cambiar email o
contraseña), ahí sí correspondería agregar `updated_at` en una migración
nueva.

### `ENGINE = InnoDB` (igual que `notes`)

Mismo motor y misma razón que `notes` (ver arriba): soporta transacciones
y, más relevante todavía para esta tabla en particular, es el motor que
hace cumplir la `FOREIGN KEY` de `notes.user_id → users.id` — `MyISAM` no
soporta claves foráneas en absoluto, así que con ese motor la integridad
referencial dependería enteramente de que la aplicación nunca cometa un
error, en vez de que la base de datos la garantice.

## Cómo aplicar las migraciones

Requiere un servidor MySQL accesible y el cliente `mysql` en el `PATH`.
Las migraciones se aplican **en orden** (001 antes que 002), cada una una
sola vez por base de datos — no hay una tabla de control que lo prevenga
automáticamente (ver la nota al principio de este documento).

### Migración 001 (`db/migrations/001_init.sql`) — sobre una base nueva

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

### Migración 002 (`db/migrations/002_add_users.sql`) — sobre una base YA existente

A diferencia de 001, este archivo **no** crea ni selecciona una base de
datos (no tiene `CREATE DATABASE` ni `USE`) — asume que la base ya existe
y ya tiene la tabla `notes` de la migración 001. Por eso el nombre de la
base se pasa como argumento posicional del cliente `mysql`, no dentro del
script:

```bash
mysql -u root -p notes_web < db/migrations/002_add_users.sql
```

- Contra el entorno de test local (`notes_test`, el mismo que usan
  `backend/tests/notes.test.ts` vía Docker en `127.0.0.1:3306`):

  ```bash
  mysql -h 127.0.0.1 -P 3306 -u root -p notes_test < db/migrations/002_add_users.sql
  ```

- Contra producción (Railway): el mismo comando, apuntando `-h`/`-P`/`-u`/
  la base al host/puerto/usuario/nombre de base que provea Railway (fuera
  del alcance de esta feature aplicarlo ahí — ver `progress/impl_db_users_schema.md`).
- Se pedirá la contraseña de forma interactiva por el flag `-p`, igual que
  en la migración 001.
- **Esta migración falla intencionalmente si se corre dos veces** contra
  la misma base: `CREATE TABLE IF NOT EXISTS users` es idempotente (no
  vuelve a fallar ni a recrear la tabla si ya existe), pero el
  `ALTER TABLE notes ADD COLUMN user_id ...` no lo es — si la columna ya
  existe, MySQL devuelve un error claro de columna duplicada y no
  modifica nada más. No es un bug: es preferible que falle de forma
  visible a que silenciosamente ignore un `ADD COLUMN` repetido.
- Verificación manual de que la migración se aplicó:

```bash
mysql -u root -p -e "USE notes_web; DESCRIBE users; DESCRIBE notes;"
```

  `DESCRIBE notes` debe mostrar la columna `user_id` nueva (tipo
  `int unsigned`, `Null: YES`) al final del listado de columnas.
