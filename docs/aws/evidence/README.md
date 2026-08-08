# Evidencia del despliegue en AWS

Capturas tomadas contra el despliegue real en
`https://d3v2k0idompyhw.cloudfront.net` (CloudFront → S3 + EC2 → RDS MySQL),
con un navegador Chromium automatizado. Los recursos ya fueron destruidos;
esto es el registro de que existieron y funcionaron.

| Captura | Qué demuestra |
|---|---|
| [`01-login.png`](01-login.png) | Entrar a `/` sin sesión redirige a `/login`: las rutas de notas están protegidas |
| [`02-registro.png`](02-registro.png) | Formulario de registro servido desde S3 vía CloudFront |
| [`03-sesion-iniciada.png`](03-sesion-iniciada.png) | Sesión activa tras el registro — la cookie `HttpOnly; Secure; SameSite=None` viaja porque el origen es HTTPS |
| [`04-formulario-nota.png`](04-formulario-nota.png) | Formulario de creación con datos |
| [`05-notas-persistidas.png`](05-notas-persistidas.png) | Tras recargar la página, las dos notas siguen ahí: **persistieron en RDS MySQL**, no en memoria del navegador |
| [`06-busqueda.png`](06-busqueda.png) | Búsqueda por substring resuelta con SQL parametrizado en RDS |
| [`07-link-directo-a-nota.png`](07-link-directo-a-nota.png) | **La captura más importante**: `/notes/5` abierta con recarga completa (no navegación del SPA) carga la nota desde RDS. Es exactamente el caso que estaba roto antes del prefijo `/api` |

## Archivos de texto

| Archivo | Contenido |
|---|---|
| [`recursos.txt`](recursos.txt) | Inventario de los recursos creados, incluida la confirmación de **0 Elastic IPs** |
| [`verificacion-e2e.txt`](verificacion-e2e.txt) | Verificación end-to-end por HTTP de los 11 pasos del flujo, incluyendo GraphQL y el 401 sin sesión |
| [`teardown-auditoria.txt`](teardown-auditoria.txt) | Auditoría del desmantelamiento: cada tipo de recurso en cero, el orden en que se destruyó y por qué, y qué se dejó vivo a propósito |

## Nota sobre el listado tras crear

En `04` la app confirma "Nota creada." pero la lista de abajo todavía dice
"No hay notas todavía", y solo tras recargar (`05`) aparecen. **No es un
problema del despliegue en AWS**: `CreateNoteForm` y `NotesList` son
componentes hermanos sin estado compartido, así que la lista solo consulta al
backend cuando se monta. Es comportamiento preexistente de la app — la
feature 8 pidió refrescar la lista tras *eliminar*, no tras *crear*. Se deja
documentado acá porque se ve en las capturas y podría confundirse con un
error de la migración.
