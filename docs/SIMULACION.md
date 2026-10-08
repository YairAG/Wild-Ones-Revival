# Simulación: ¿en el cliente (lockstep) o en el servidor (autoritativo)?

Análisis para la decisión abierta de la tarea 9. **No hay nada implementado de lo que se propone aquí.**

## Cómo funciona hoy

En Wild Ones la física (trayectorias, rebotes, explosiones, terreno destructible, daño, agua) la calcula
**cada cliente**. El servidor no simula nada:

1. Al empezar la partida manda `startGame` con una semilla aleatoria (`randomSeed`, 0-999) y las posiciones.
2. Durante el turno, el jugador activo manda sus acciones (`move_*`, `set_aim`, `projectile`…) y el servidor
   solo comprueba que sea su turno y las **reenvía** a los demás (`handler/game.ts`).
3. Cada cliente simula lo mismo con la misma semilla y las mismas acciones ("lockstep") y debería llegar al
   mismo resultado. Para comprobarlo mandan `synch_check` (un hash) y `synchronization` (estado completo).
4. Los resultados los **declara el cliente**: `player_died` mata a quien diga, `synchronization` dice quién
   tiene 0 de vida, y con eso el servidor decide el fin de partida y los premios.

Lo que hay de física en el servidor (`client/extensions/avatar.ts`, `physics/`, `weapons/`, `field.ts`,
`slot/collision.ts`) está **desactivado y roto** (ver [BUGS.md](BUGS.md)): `step()`/`move()` comentados,
el terreno nunca carga su imagen, solo existe el mortero y no se puede construir.

**Además, ese código es una traducción del cliente Flash decompilado** (de Disney/Playdom). El commit
original lo muestra: nombres generados por un decompilador (`_local21`, `_local22`…) y ActionScript comentado
(`public function checkCollisionPointSet(X:Number, …)`, `Battlefield.main.skyColor`,
`GameNewsFeed.EPIC_MISS`). Por la regla del proyecto (nada de código de Disney), **no debería usarse como
base** de ninguna de las dos opciones.

## El dato que cambia la cuenta

Tu frontend nuevo no puede usar la física del SWF: **la simulación hay que escribirla de cero igualmente**,
en TypeScript. La pregunta real no es "¿escribo una simulación para el servidor?", sino **"la simulación que
voy a escribir, ¿la ejecuta solo el cliente o también el servidor?"**. Si se escribe como un paquete
compartido (`packages/sim`, como ya existe `packages/protocol`), ejecutarla también en el servidor cuesta
mucho menos que escribirla dos veces.

Y es un juego **por turnos**: en cada momento solo actúa un jugador y lo caro (vuelo de proyectiles,
explosiones) dura unos segundos por turno. Simular en el servidor es barato en CPU, incluso con muchas
partidas.

## Opciones

### A. Lockstep en el cliente (como el original)

El servidor sigue siendo un relevo; cada cliente simula.

| A favor | En contra |
|---|---|
| Ya funciona así: cero trabajo en el servidor | **Trampas triviales**: hoy cualquiera puede mandar `player_died` y matar a otro (ver BUGS), o declarar la vida que quiera en `synchronization` |
| Compatible con el SWF original en Ruffle | **Desincronización**: basta una diferencia mínima para que cada jugador vea una partida distinta, y no hay quien decida cuál es la buena. Ya se observó (`synch_check` distintos) |
| Servidor muy ligero | El determinismo exacto entre navegadores es delicado: `Math.sin`, `Math.cos`, `Math.atan2`… no garantizan el mismo resultado en todos los motores de JavaScript |
| | Premios, ranking y estadísticas dependen de lo que diga un cliente: no son confiables |
| | Reconectarse o entrar como espectador requiere pedirle el estado a otro cliente |

### B. Servidor autoritativo puro

El servidor simula todo y manda el estado; los clientes solo dibujan.

| A favor | En contra |
|---|---|
| Sin trampas de resultados: el servidor decide daño, muertes y premios | El cliente tiene que esperar al servidor para ver cada movimiento (latencia visible al caminar/apuntar) |
| Una sola verdad: no hay desincronización posible | Más tráfico: mandar estado en lugar de acciones |
| Reconexión y espectadores fáciles | Necesita la simulación completa en el servidor antes de poder jugar |

### C. Híbrido: simulación compartida, servidor como árbitro (recomendada)

Una sola simulación en `packages/sim`, ejecutada **en los dos lados**:

- El cliente la ejecuta para mostrar todo al instante (caminar, apuntar, el vuelo del proyectil).
- El servidor ejecuta lo mismo con las acciones del jugador activo y **su resultado es el que vale**: daño,
  muertes, terreno destruido, fin de partida y premios.
- Si un cliente se desvía, el servidor le manda el estado correcto y sigue desde ahí.
- El cliente ya no declara resultados: `player_died` y la vida de `synchronization` dejan de aceptarse.

| A favor | En contra |
|---|---|
| Sin trampas de resultados y sin desincronización permanente (el servidor corrige) | Hay que diseñar la simulación para que corra en Node y en el navegador (sin depender del DOM/canvas) |
| El cliente se siente instantáneo | El protocolo cambia: el servidor tiene que mandar resultados/correcciones (mensajes nuevos) y el SWF original deja de ser compatible |
| Se escribe **una** vez y la usan los dos | El servidor necesita las máscaras de terreno de cada mapa |
| El determinismo deja de ser crítico: una diferencia pequeña se corrige, no rompe la partida | |
| Reconexión y espectadores: el servidor tiene el estado | |

## Costo aproximado

Estimaciones gruesas, para comparar opciones, no para planificar (dependen mucho de cuántas armas quieras):

| Trabajo | A (lockstep) | C (híbrido) |
|---|---|---|
| Simulación base: terreno destructible, gravedad, caminar/saltar, colisiones, daño, agua | La escribes igual (frontend) | La escribes igual, como paquete compartido |
| Cada arma (hay 151 en `WeaponsGrid.dat`; muchas son variantes de unas pocas mecánicas) | Igual | Igual |
| Que la simulación corra en Node | — | Pequeño, si se diseña así desde el principio |
| Mensajes nuevos de resultado y corrección | — | Pequeño-mediano |
| Validar en el servidor (dejar de aceptar `player_died`, etc.) | — | Pequeño |
| Determinismo exacto entre navegadores (aritmética propia o tablas de seno/coseno) | **Necesario**, y difícil de garantizar | Recomendable pero no crítico |
| Arreglar desincronizaciones en producción | Continuo | Raro (el servidor corrige) |

La mayor parte del costo (la simulación y las armas) es **el mismo en las dos opciones**. C añade poco
encima y elimina los dos problemas más caros de A: las trampas y las desincronizaciones.

**Lo que hace falta en cualquier opción y no está en el repo:** las máscaras de terreno de cada mapa (qué
píxeles son suelo). Las originales son imágenes de Disney (`Maps.dat` → `mask`), así que hay que hacer
mapas propios.

## Recomendación

**Opción C**, por etapas, sin romper lo que ya funciona:

1. **Ahora**: nada cambia. El servidor sigue siendo relevo y el SWF en Ruffle sigue sirviendo para pruebas.
2. **Con tu frontend**: crear `packages/sim` con lo mínimo (un mapa propio, caminar/saltar, el mortero,
   daño y muerte), sin usar el código de física actual. Tu frontend la usa para jugar.
3. **Servidor árbitro**: el servidor ejecuta `packages/sim` para el turno activo, decide daño, muertes, fin
   de partida y premios, y deja de aceptar `player_died`/vida declarada por el cliente. Aquí el protocolo
   suma mensajes de resultado/corrección (se documentan en `PROTOCOL.md` y se tipan en `packages/protocol`).
4. **Armas**: se agregan de a una, cada una con tests que comparan la simulación en "cliente" y "servidor".
5. **Limpieza**: borrar la física decompilada del servidor (`avatar.ts` → solo el estado, `physics/`,
   `weapons/`, `field.ts`, `slot/collision.ts`) cuando `packages/sim` la reemplace.

Por qué no B: en un juego donde caminas y apuntas en tiempo real, esperar al servidor para cada movimiento se
nota, y C da la misma seguridad sin esa espera.

Por qué no A: el costo de escribir la simulación es el mismo, y A deja abiertas las trampas y las
desincronizaciones para siempre, justo lo que hace frustrante un juego en línea.
