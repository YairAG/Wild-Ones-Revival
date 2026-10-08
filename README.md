# wildones-server

Servidor de juego de Wild Ones (proyecto de preservación, sin monetización). Extraído de la carpeta `game/` de
https://github.com/fgpons/wo-latin-ps (commit 4f3e8ad), derivado de https://github.com/drwcx/Wild-Ones
(licencia MIT según su encabezado, autor "3.14", 2016). No incluye el sitio web, el cliente SWF ni assets
de Playdom/Disney.

## Arrancar

    pnpm install
    cp .env.example .env   # y ajusta los valores
    pnpm assets            # en otra terminal: sirve assets/json en http://localhost:8080/
    pnpm start             # TCP en 0.0.0.0:$PORT (8000 por defecto)
    pnpm test              # no necesita Mongo instalado

Requiere MongoDB 4.4 a 9.0 (probado con 7.0, 8.0 y 9.0.2) y los datos del juego en `assets/json/`
(no están en el repo).

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): qué hace cada archivo y cómo fluye una partida.
- [docs/PROTOCOL.md](docs/PROTOCOL.md): todos los mensajes entre cliente y servidor.
- [docs/TESTS.md](docs/TESTS.md): cómo funcionan los tests.
- [docs/BUGS.md](docs/BUGS.md): bugs conocidos, pendientes de arreglar.
