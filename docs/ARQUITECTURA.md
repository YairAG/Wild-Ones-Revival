# Arquitectura del servidor

Este código no es nuestro: viene de la carpeta `game/` de
[fgpons/wo-latin-ps](https://github.com/fgpons/wo-latin-ps) (commit `4f3e8ad`), que a su vez deriva de
[drwcx/Wild-Ones](https://github.com/drwcx/Wild-Ones) (MIT, autor "3.14", 2016). Aquí se explica qué hace
cada pieza tal como está hoy.

## La idea general

El juego original (Flash) hacía casi todo en el cliente: física, disparos, daño, terreno. Este servidor solo:

1. Autentica jugadores contra MongoDB.
2. Gestiona la tienda (oro, treats, armas, mascotas, accesorios).
3. Empareja jugadores en partidas.
4. En la partida: decide de quién es el turno, lleva el reloj y **reenvía** las acciones del jugador en turno
   a los demás. Cada cliente simula el juego por su cuenta con la misma semilla aleatoria ("lockstep").

## Estructura del repo

Es un **workspace de pnpm**: un repo con varios paquetes que comparten `node_modules` y se manejan desde la raíz.

| Carpeta | Qué es |
|---|---|
| `apps/server/` | El servidor de juego (paquete `@wildones/server`). |
| `packages/protocol/` | Tipos y validación de los mensajes, compartibles con el frontend (paquete `@wildones/protocol`). |
| `docs/` | Toda la documentación. |

Los comandos (`pnpm start`, `pnpm test`, …) se corren desde la raíz.

## TypeScript

- Todo el código es **TypeScript estricto** (`strict: true`), sin archivos `.js`.
- Se usa **TypeScript 6.0** (`~6.0.3`), no la 7: la 7 (reescrita en Go) no trae la API de JavaScript que
  necesita `typescript-eslint`.
- `tsconfig.base.json` en la raíz tiene la config común; cada paquete la extiende.
- Los módulos usan `import x = require(...)` / `export = X` (CommonJS): es la forma equivalente a los
  `require`/`module.exports` del código original.
- En desarrollo, en `pnpm start` y en los tests el servidor corre con **tsx**, que ejecuta `.ts` sin compilar.
  `pnpm build` compila a `apps/server/dist/` y `pnpm --filter @wildones/server start:dist` lo arranca con Node.
- `packages/protocol` se compila a `packages/protocol/dist/` (`pnpm build:protocol`, que `start`, `dev`, `test`
  y `typecheck` corren solos antes).
- Bugs conocidos que TypeScript detecta: marcados con `// @ts-expect-error bug: ...` (ver [BUGS.md](BUGS.md)).
  No se arreglan durante la migración para no cambiar comportamiento.

## Validación de mensajes

`handler/index.ts` valida cada mensaje entrante con los esquemas **Zod** de `@wildones/protocol` antes de
atenderlo. Los inválidos se loguean y se descartan. Ver [PROTOCOL.md](PROTOCOL.md).

## Archivos del servidor (`apps/server/`)

| Archivo | Qué hace |
|---|---|
| `app.ts` | Punto de entrada. Solo crea el servidor y lo arranca. |
| `wol/index.ts` | El "gerente": abre los transportes, recibe conexiones, guarda clientes y partidas, y cada 100 ms avanza todas las partidas. |
| `wol/transport.ts` | Transportes: WebSocket y TCP. Los dos entregan los datos al handler igual. |
| `wol/assets.ts` | Descarga los `.dat` al arrancar y rellena las plantillas de `properties/`. |
| `wol/matchmaking.ts` | Valida las opciones de partida y busca o crea la partida adecuada (`findSlot`). |
| `handler/index.ts` | El "mesero": recibe los datos del socket, separa los mensajes, los valida y llama a la función de su `command`. |
| `handler/auth.ts` | `logIn` (verifica el JWT) y `start_server_connect` (identificación). |
| `handler/shop.ts` | Tienda, mascotas, ruleta y armas equipadas. |
| `handler/rooms.ts` | `quick_play` y salas con nombre. |
| `handler/game.ts` | Todo lo que pasa dentro de una partida. |
| `client/client.abstract.ts` | Conexión recién abierta, antes de saber de qué tipo es. |
| `client/client.lobby.ts` | Conexión de lobby (menú, tienda, buscar partida). |
| `client/client.ladder.ts` | Conexión de ladder (ranking). Hoy solo responde `ping`. |
| `client/client.game.ts` | Conexión dentro de una partida. Tiene un `avatar`. |
| `client/extensions/avatar.ts` | Estado del personaje en partida (posición, dirección, si ya disparó). La parte de física no se ejecuta. |
| `slot/index.ts` | Una partida: jugadores, estado, turnos, reloj, fin de partida y premios. |
| `slot/messages.ts` | Arma los mensajes de estado de partida (`game`, `join`, `changeTurn`, `endGame`). |
| `slot/collision.ts` | Colisiones de la física desactivada. |
| `database.ts` | Acceso a MongoDB (colección `users`): contar, leer y actualizar jugadores. Driver `mongodb` 7 (servidores 4.4 a 9.0). Si no conecta, reintenta 30 s y el proceso se cae. |
| `properties/*.ts` | Plantillas con valores por defecto para armas, mapas, mascotas, accesorios y comida. Se rellenan con los `.dat`. |
| `types/` | Tipos compartidos (socket, documento de Mongo, config). Solo tipos. |
| `helpers/utils.ts` | Utilidades: codificar números como texto hex, generar claves aleatorias, md5. |
| `helpers/log.ts` | El logger (pino). |
| `helpers/point.ts`, `physics/`, `weapons/`, `field.ts` | Física del lado servidor **a medio hacer y desactivada**. |
| `scripts/serve-assets.ts` | Sirve los `.dat` por HTTP (`pnpm assets`). |
| `test/` | Tests (ver [TESTS.md](TESTS.md)). |
| `user-schema.example.json` | Ejemplo del documento de jugador que espera Mongo. |

## Dependencias

Cuatro en ejecución: `mongodb` (driver 7), `pino` (logs), `ws` (WebSocket) y `@wildones/protocol` (que usa `zod`). Lo demás viene de Node:
`crypto` (uuid y md5), `fetch` (descargar los `.dat`), `net` (TCP). Más `ws` para WebSocket.

## Datos del juego (assets)

Al arrancar, `wol/assets.ts` descarga por HTTP desde `ASSETS_URL` estos archivos JSON:
`Config, Accessories, Crate, Gifts, Levels, Maps, Other, PetFoods, Pets, WeaponsGrid` (`.dat`).
Hasta que no termina, no abre el puerto. Si alguno falla, el servidor no arranca.

Son datos del juego original (Playdom), así que **no están en el repo**: se guardan en `apps/server/assets/json/`
(ignorado por git). Los tests usan datos inventados.

Lo que realmente se usa:
- `Config`: tiempos de turno y de partida permitidos, jugadores por partida, `maxSlots`, colores de mascota.
- `Maps`: nombre y posiciones iniciales. El mapa `"Sink or Swim"` debe existir (está fijo en el código).
- `WeaponsGrid`, `Pets`, `Accessories`: precios y moneda para la tienda; `timeAfter` de armas para el turno.

## Logs

El servidor usa **pino** (`helpers/log.ts`): cada línea es un JSON con nivel, hora, mensaje y datos.

| Nivel | Qué registra |
|---|---|
| `debug` | Detalle interno: datos crudos recibidos, clientes creados, ticks, búsquedas de partida |
| `info` | Eventos normales: servidor arrancado, login, partida que empieza o termina |
| `warn` | Intentos raros: mensaje inválido, login fallido, color o arma no permitidos |
| `error` | Excepciones |

- `LOG_LEVEL` en el `.env` elige desde qué nivel se muestra (por defecto `info`).
- `pnpm dev` los muestra legibles (`pino-pretty`); `pnpm start` los deja en JSON.
- Cualquier campo `token` o `snum` sale como `[Redacted]`. Ojo: el log `debug` "Datos recibidos" muestra el
  mensaje crudo, token incluido: no uses `LOG_LEVEL=debug` en producción.
- Ya no se escribe nada en archivos.

## Configuración (`.env`)

| Variable | Por defecto | Para qué |
|---|---|---|
| `WS_PORT` | `8001` | Puerto WebSocket (siempre activo) |
| `TCP_ENABLED` | `false` | `true` para abrir también el TCP crudo |
| `TCP_PORT` | `8000` | Puerto TCP (si está activo) |
| `MONGO_URL` | `mongodb://localhost:27017/emu` | Base de datos de jugadores |
| `ASSETS_URL` | `http://localhost/assets/json/` | De dónde descargar los `.dat` |
| `LOG_LEVEL` | `info` | Detalle de los logs (`debug`, `info`, `warn`, `error`) |
| `JWT_SECRET` | — | Para la auth con JWT (tarea 8) |

## Flujo de una partida

1. El cliente abre una conexión **lobby** y hace `logIn` con el JWT de tu backend. El server lo verifica y
   responde con los datos del jugador.
2. Pide `quick_play`. El server busca o crea una partida y responde `join` con un `id` de partida y una
   `session` (un UUID aleatorio guardado en Mongo como `gkey`; vale hasta que el jugador pide otra partida).
3. El cliente abre una segunda conexión **game** con ese `id` y `session`, y manda `start_server_connect`.
4. Con 2 o más jugadores, la partida pasa a `starting`; 5 s después manda `startGame` con una semilla
   aleatoria y el orden de turnos.
5. Cada 100 ms el server avanza el reloj de la partida. El jugador en turno manda sus acciones (moverse,
   apuntar, disparar) y el server las reenvía a los demás. El turno cambia cuando se acaba el tiempo
   (o poco después de disparar).
6. Cuando queda 1 jugador vivo (o conectado), manda `game_stats` y `endGame`, y la partida se reinicia.

El detalle de cada mensaje está en [PROTOCOL.md](PROTOCOL.md).
