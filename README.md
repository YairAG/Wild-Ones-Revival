# wildones-server

Servidor de juego de Wild Ones, extraído de la carpeta `game/` de
https://github.com/fgpons/wo-latin-ps (commit 4f3e8ad). Ese repo deriva de Wild Ones Private Wars
(https://github.com/drwcx/Wild-Ones), cuyo encabezado indica licencia MIT (autor "3.14", 2016).
No incluye el sitio web (`Web/`), ni el cliente SWF, ni assets de Playdom/Disney.

## Arrancar

    npm install
    npm start          # TCP en 0.0.0.0:8000

Requiere MongoDB en `mongodb://localhost:27017/emu` (colección `users`), configurado en `database.js`.
El driver 2.2 es antiguo: con MongoDB 4.4 debería funcionar; con 6+ probablemente no.

## Mapa del código

| Archivo | Qué hace |
|---|---|
| wol.js | Servidor TCP, carga armas/mapas, registro de clientes y partidas |
| handler.js | Router de comandos (lobby, ladder, partida, tienda); `handleLogin` valida dname+snum |
| slot.js | Una partida: jugadores, turnos, timers, bots, fin de juego y premios |
| client/*.js | Estado por conexión: lobby, ladder, game |
| properties/*.js | Datos de armas, mapas, accesorios, mascotas |
| field.js, physics/, weapons/ | Física mínima (solo mortar); la simulación real vivía en el cliente |
| crumbs/config.json | Puerto, tiempos de turno, jugadores máx., premios |

## Protocolo

1. Al conectar: `POST /ballistic/{lobby|ladder|game}?session=... HTTP/1.1` + headers.
2. Luego, mensajes: 6 dígitos de longitud + JSON. Ej.: `000018{"command":"ping"}`.
3. Login en lobby: `{"command":"logIn","dname":"...","snum":"..."}`.

## Pendiente para tu backend de cuentas

- `handleLogin` en handler.js compara `snum` (contraseña en texto plano) contra Mongo.
  Cámbialo para validar el token que emita tu backend.
- El documento de usuario lo creaba `Web/app.js` en `/registered` (oro, nivel, armas, mascotas...).
  Tu backend debe crear ese mismo esquema; ver `user-schema.example.json`.
