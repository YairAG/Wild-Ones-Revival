# Bugs conocidos

Encontrados al revisar el código. No se arreglan durante la migración (para no cambiar comportamiento);
cada uno se corrige después en su propio commit.

## Seguridad

- **Path traversal en `log_projectile`** (`handler.js` `handleLogProjectile`): `data.weapon` viene del cliente y
  se usa en la ruta `logs/<weapon>_xy.txt`. Un cliente puede escribir en cualquier archivo.
- **Credenciales en logs**: `handleLogin` escribe `snum` en texto plano en `logs/glogin_log.txt` junto a la IP.
- **`snum` se reparte a otros jugadores**: `setupPlayer` copia `doc.snum` al objeto `player`, que se envía a
  todos en la partida (`sendGamePlayers`, `sendToGame`, `playerlist` de `startGame`).
- **`player_died` sin validar**: cualquier jugador puede mandar `{"command":"player_died","id":X}` y matar a otro.
- **`chat` sin filtro**: se reenvía el objeto tal cual, con cualquier campo que mande el cliente.
- **`gkey` débil**: la clave de partida es `Math.random().toString(36).substring(7)` (~5-6 caracteres).
- **`updatePlayerData` guarda el objeto `player` entero** en Mongo, incluidos `command`, `online` y `snum`.

## Errores que lanzan excepción (atrapada, el comando no hace nada)

- `handler.js` `handleSetWeaponsEquipped`: usa `invalidItemLog` sin `this.` → `ReferenceError`.
- `helpers/logger.js`: usa `fs` sin importarlo.
- `wol.js` `findSlot` con nombre propio: usa `tmpId` sin definir si el nombre ya existe.
- `logIn` en una conexión `game` llama a `sendPlayerSetup`, que `GameClient` no tiene.
- `give_medal` llama a `handleSendMedal`, que no existe.
- `join_game` mete al cliente de **lobby** en la partida (`gameRef.addClient(client)`), aunque no tiene avatar.

## Lógica

- `handler.js`: `case "get_medals"` duplicado; `handleShowMedalCollection` nunca se ejecuta.
- `handleAccLoad`: cuenta repetidos por `accessoriesObj[item].type` (único por accesorio), así que nunca detecta
  dos accesorios de la misma categoría.
- `projectile` resta munición aunque el jugador no tenga ese arma (`mortar` es gratis): `undefined - 1 = NaN`,
  que se guarda en Mongo y viaja como `null`. Fijado en los tests.
- `turn_complete` no hace nada: el turno solo cambia por tiempo o tras un `projectile`.
- `gameDuration` no se aplica: la partida no tiene límite de tiempo.
- Premios de fin de partida solo con más de 2 jugadores; `game_stats` siempre va en 0.
- `sendTick` reenvía el último `synch_check` del jugador activo pero sobrescribe `tick` con el tick del servidor.
  Posible causa del desync observado (sin verificar).
- `slot.js` `update`: compara con `new Date().now` (siempre `undefined`), así que el aviso "haven't received
  tick" nunca se dispara.
- `handlePlayerKill` y `handleRequestSynch` existen pero no están enrutados.

## Protocolo / transporte

- Mensajes partidos en varios paquetes TCP solo se reensamblan en conexiones `game`; en `lobby`/`ladder` se pierden.
- La longitud del mensaje se cuenta en caracteres JS, no en bytes (posible problema con ñ/tildes).

## Código muerto

- La física del servidor no corre: `step()`/`move()` comentados en `slot.js`, `Field` nunca carga el bitmap,
  `addProjectile` no se llama y `makeWeapon` tiene otra firma. ESLint marca variables sin definir ahí
  (`avatar.js`, `physical.js`) que hoy no se ejecutan.
- `client/extensions/avatar_old.js`, `misc/field/field.js`, `crumbs/config.json` (no lo lee nadie).
