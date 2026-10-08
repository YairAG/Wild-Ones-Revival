# Tests

    pnpm test

No hace falta instalar Mongo: los tests traen el suyo. La primera vez descargan MongoDB (~280 MB, queda en
caché), después tardan ~8 s.

## Qué son

Son **tests de caracterización**: no comprueban que el servidor esté bien, sino que se comporte **igual que
hoy**, bugs incluidos. Son la red de seguridad para migrar a TypeScript y actualizar dependencias: si algo
cambia sin querer, fallan.

Cuando un test fija un bug (ej. la munición que queda en `null`), lleva un comentario `// bug: ...`. Si
arreglamos ese bug, se actualiza el test en el mismo commit que el arreglo.

## Cómo funcionan

`test/characterization.test.js`:

1. Arranca un **MongoDB temporal** en memoria (`mongodb-memory-server`, versión 4.4 por el driver actual) y
   crea dos jugadores: Ana (id 1) y Beto (id 2).
2. Sirve los **datos de juego inventados** de `test/fixtures/assets/` con `scripts/serve-assets.js`.
3. Arranca el **servidor real** sin modificar (`node app.js`) como otro proceso, apuntando a lo anterior.
4. Se conecta con `test/client.js`, un cliente mínimo que habla el protocolo, y juega:
   política de Flash → ladder → login fallido → login → `quick_play` de los dos → entrar a la partida →
   `startGame` → movimiento (solo cuenta el del jugador en turno) → disparo → cambio de turno →
   `player_died` → `game_stats` + `endGame`.

## Archivos

| Archivo | Qué es |
|---|---|
| `test/characterization.test.js` | Los tests |
| `test/client.js` | Cliente de prueba: conecta, envía `000018{...}` y junta las respuestas |
| `test/fixtures/assets/*.dat` | Datos de juego mínimos e inventados (un mapa, un arma, la config) |
| `scripts/serve-assets.js` | Sirve una carpeta de `.dat` por HTTP. También para uso manual: `pnpm assets` |

## Depurar

Para ver todo lo que imprime el servidor durante los tests:

    SERVER_LOG=1 pnpm test
