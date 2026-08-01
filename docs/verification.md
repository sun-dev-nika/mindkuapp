# Verificación — Cómo demostrar que el trabajo funciona (Notes Web)

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda feature termina con evidencia ejecutable, no con afirmaciones.

## Nivel 0 — Comprensión humana confirmada (obligatorio, nuevo)

Antes de que cualquier otro nivel importe:

1. El `leader` explica en 3-4 líneas las decisiones de tipado y de diseño
   del endpoint o componente recién construido.
2. El humano las explica de vuelta con sus propias palabras.
3. Si no puede, se reformula la explicación y se repite — no se avanza.
4. La confirmación se registra en `progress/current.md`.

Sin este nivel, ningún otro nivel de verificación es suficiente para marcar
`done`. Ver `CHECKPOINTS.md` §C0.

## Nivel 1 — Tests unitarios / de endpoint (obligatorio)

Cada endpoint en `backend/src/routes` tiene al menos un test en
`backend/tests` que:

1. Cubre el camino feliz.
2. Cubre al menos un camino de error (validación o 404).

Los tests corren contra una base de datos MySQL de test **real**, no contra
mocks del driver `mysql2` — el equivalente web de "no mocks de fs" en el
CLI original.

Comando:
```bash
cd backend && npm test
```

## Nivel 2 — Tests de componentes de frontend (obligatorio)

Cada componente clave en `frontend/src/components` tiene al menos un test
de render (React Testing Library) que verifica el resultado concreto en
pantalla (no solo que "no lanza excepción").

Comando:
```bash
cd frontend && npm test
```

## Nivel 3 — Smoke test end-to-end manual (obligatorio antes de cerrar el MVP)

Levantar backend + MySQL real (local o docker-compose) y el frontend, y
probar a mano el flujo completo: crear, listar, ver, editar, buscar,
eliminar una nota.

## Anti-patrones (no hacer)

- ❌ "He añadido el endpoint, debería funcionar." → falta test ejecutable.
- ❌ Marcar `done` sin el Nivel 0 (comprensión) registrado en
  `progress/current.md`.
- ❌ Mock del driver `mysql2` en los tests de backend. → usa una base de
  datos de test real.
- ❌ Test que solo verifica que la función no lanza excepción. → tiene que
  comprobar el resultado concreto (status code, body, contenido en pantalla).
- ❌ `any` de TypeScript sin comentario que explique por qué.

## Verificación final antes de cerrar

```bash
./init.sh           # debe terminar con [OK] Entorno listo
```

Si `./init.sh` está rojo, o el Nivel 0 no está confirmado, **no** marques
nada como `done`. Anota el bloqueo en `progress/current.md` con estado
`blocked` en `feature_list.json`.
