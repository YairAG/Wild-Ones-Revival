# Tests

    pnpm test

No hace falta instalar Mongo: los tests traen el suyo. La primera vez descargan MongoDB (unos cientos de MB,
queda en caché), después tardan ~20 s.

Por defecto usan MongoDB 9.0.2. Para probar otra versión:

    MONGO_VERSION=7.0.14 pnpm test

Probado en verde con 7.0.14, 8.0.4 y 9.0.2.

## Qué son

Son **tests de caracterización**: no comprueban que el servidor esté bien, sino que se comporte **igual que
hoy**, bugs incluidos. Son la red de seguridad para migrar a TypeScript y actualizar dependencias: si algo
cambia sin querer, fallan.

Cuando un test fija un bug (ej. la munición que queda en `null`), lleva un comentario `// bug: ...`. Si
arreglamos ese bug, se actualiza el test en el mismo commit que el arreglo.

## Cómo funcionan

Cada archivo de test corre **dos veces**, una por transporte (`tcp` y `ws`), y cada vez arranca su propio
entorno con `test/helpers/server.ts`:

1. Un **MongoDB temporal** (`mongodb-memory-server`) con jugadores de prueba (clave `clave-<nombre>`).
2. Los **datos de juego inventados** de `test/fixtures/assets/`, servidos con `scripts/serve-assets.ts`.
3. El **servidor real** (`app.ts` con tsx) como otro proceso, con TCP y WebSocket en puertos aleatorios.

Después se conectan con `test/helpers/client.ts`, un cliente mínimo que habla el protocolo.

| Archivo | Qué cubre |
|---|---|
| `characterization.test.ts` | Política de Flash, ladder, login, mensajes inválidos y una partida completa: `quick_play` → entrar → `startGame` → movimiento, chat, apuntar, `on_ready`, `synchronization` → disparo → cambio de turno → `player_died` → `game_stats` + `endGame` |
| `turns.test.ts` | Partidas de 3: `turn_complete` y quién puede reportar muertes (solo el jugador en turno); una muerte repetida no se cuenta dos veces |
| `game-time.test.ts` | Límite de tiempo de partida. Test directo de `Slot` con jugadores simulados (adelanta el reloj a mano) |
| `lobby.test.ts` | Tienda (armas, accesorios), mascotas (comprar, cambiar, borrar, modificar), ruleta, popups, armas equipadas y salas con nombre |

Rutas relativas a `apps/server/test/`.

## Archivos de apoyo

| Archivo | Qué es |
|---|---|
| `helpers/server.ts` | Arranca Mongo + assets + servidor; da `connect`, `login`, `waitForUser` |
| `helpers/client.ts` | Cliente de prueba: `send`, `next(command)` (espera un mensaje) y `request(msg)` (devuelve todo lo que respondió el servidor) |
| `fixtures/assets/*.dat` | Datos de juego mínimos e inventados |

## Depurar

Para ver todo lo que imprime el servidor durante los tests:

    SERVER_LOG=1 pnpm test
