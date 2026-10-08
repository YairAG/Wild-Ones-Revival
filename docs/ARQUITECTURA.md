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

## Archivos del servidor (`apps/server/`)

| Archivo | Qué hace |
|---|---|
| `app.js` | Punto de entrada. Solo crea el servidor y lo arranca. |
| `wol.js` | El "gerente": descarga los datos del juego (`.dat`), abre el puerto TCP, guarda la lista de conexiones y de partidas, busca/crea partidas (`findSlot`). |
| `handler.js` | El "mesero": recibe cada mensaje, lo separa del framing y lo manda a la función que lo atiende según su `command`. |
| `client/client.abstract.js` | Conexión recién abierta, antes de saber de qué tipo es. |
| `client/client.lobby.js` | Conexión de lobby (menú, tienda, buscar partida). |
| `client/client.ladder.js` | Conexión de ladder (ranking). Hoy solo responde `ping`. |
| `client/client.game.js` | Conexión dentro de una partida. Tiene un `avatar`. |
| `client/extensions/avatar.js` | Estado del personaje en partida (posición, dirección, si ya disparó). La parte de física no se ejecuta. |
| `slot.js` | Una partida: jugadores, estado, turnos, reloj, fin de partida y premios. |
| `database.js` | Acceso a MongoDB (colección `users`): contar, leer y actualizar jugadores. Driver `mongodb` 7 (servidores 4.4 a 9.0). Si no conecta, reintenta 30 s y el proceso se cae. |
| `properties/*.js` | Plantillas con valores por defecto para armas, mapas, mascotas, accesorios y comida. Se rellenan con los `.dat`. |
| `helpers/utils.js` | Utilidades: codificar números como texto hex, generar claves aleatorias, md5. |
| `helpers/logger.js` | Escribe logs a archivo (está roto, ver BUGS). |
| `helpers/point.js`, `physics/`, `weapons/`, `field.js`, `misc/` | Física del lado servidor **a medio hacer y desactivada**. |
| `crumbs/config.json` | No lo usa nadie. La config real viene de `Config.dat`. |
| `user-schema.example.json` | Ejemplo del documento de jugador que espera Mongo. |

## Datos del juego (assets)

Al arrancar, `wol.js` descarga por HTTP desde `ASSETS_URL` estos archivos JSON:
`Config, Accessories, Crate, Gifts, Levels, Maps, Other, PetFoods, Pets, WeaponsGrid` (`.dat`).
Hasta que no termina, no abre el puerto. Si alguno falla, el servidor no arranca.

Son datos del juego original (Playdom), así que **no están en el repo**: se guardan en `apps/server/assets/json/`
(ignorado por git). Los tests usan datos inventados.

Lo que realmente se usa:
- `Config`: tiempos de turno y de partida permitidos, jugadores por partida, `maxSlots`, colores de mascota.
- `Maps`: nombre y posiciones iniciales. El mapa `"Sink or Swim"` debe existir (está fijo en el código).
- `WeaponsGrid`, `Pets`, `Accessories`: precios y moneda para la tienda; `timeAfter` de armas para el turno.

## Configuración (`.env`)

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `8000` | Puerto TCP del servidor |
| `MONGO_URL` | `mongodb://localhost:27017/emu` | Base de datos de jugadores |
| `ASSETS_URL` | `http://localhost/assets/json/` | De dónde descargar los `.dat` |
| `JWT_SECRET` | — | Para la auth con JWT (tarea 8) |

## Flujo de una partida

1. El cliente abre una conexión **lobby** y hace `logIn`. El server responde con los datos del jugador.
2. Pide `quick_play`. El server busca o crea una partida y responde `join` con un `id` de partida y una
   `session` (clave de un solo uso guardada en Mongo como `gkey`).
3. El cliente abre una segunda conexión **game** con ese `id` y `session`, y manda `start_server_connect`.
4. Con 2 o más jugadores, la partida pasa a `starting`; 5 s después manda `startGame` con una semilla
   aleatoria y el orden de turnos.
5. Cada 100 ms el server avanza el reloj de la partida. El jugador en turno manda sus acciones (moverse,
   apuntar, disparar) y el server las reenvía a los demás. El turno cambia cuando se acaba el tiempo
   (o poco después de disparar).
6. Cuando queda 1 jugador vivo (o conectado), manda `game_stats` y `endGame`, y la partida se reinicia.

El detalle de cada mensaje está en [PROTOCOL.md](PROTOCOL.md).
