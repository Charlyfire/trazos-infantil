# TRAZOS

Aplicación de grafomotricidad para niños de 3 años, pensada para una PDI táctil y pantallas 16:9. HTML, CSS y JavaScript vanilla, sin frameworks, backend, fuentes remotas ni dependencias de ejecución.

## Ejecutar

Descarga los archivos y abre `index.html` en un navegador moderno. Funciona sin conexión. También puedes servir la carpeta:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000`. En la PDI se recomienda la pantalla completa del navegador (F11 en equipos compatibles).

## Demostración y práctica

Pulsa **TRAZOS RECTOS**. La aplicación abre **DEMOSTRACIÓN**, con una sola línea grande para el profesor. Pulsa **PRÁCTICA** para mostrar varias líneas del mismo tipo. El cambio de modo conserva el tipo de ejercicio y reinicia sus trazos.

En una PDI panorámica aparecen:

- **Verticales:** cinco líneas, una al lado de otra.
- **Horizontales:** tres líneas, una al lado de otra.
- **Diagonales descendentes:** tres líneas, una al lado de otra.
- **Diagonales ascendentes:** tres líneas, una al lado de otra.

Cada línea tiene un círculo de inicio y una estrella independientes. Pueden trabajar dos o tres niños simultáneamente, o uno solo puede completar las líneas por turnos y en cualquier orden. Las columnas dan a cada niño su propio espacio frente a la PDI. En pantallas pequeñas se reduce automáticamente la cantidad de líneas para conservar la separación y el tamaño de los elementos.

**Todos los recorridos, incluidos los círculos y estrellas, quedan dentro del 70 % inferior de la pantalla.** El 30 % superior queda libre de trazos infantiles y contiene los controles del profesor. La zona inferior reserva también espacio para los botones de finalización.

Los controles superiores permiten volver al inicio, elegir demostración/práctica, repetir todas las líneas (flecha circular) y pasar al siguiente ejercicio (flecha a la derecha) en cualquier momento. No hace falta completar todas las líneas para cambiar de ejercicio.

## Trazar

Empieza dentro de un círculo verde y sigue su camino con un único gesto hasta la estrella. Funciona con dedo, lápiz y botón principal del ratón mediante Pointer Events. Cada contacto se asigna a una única línea: no modifica las vecinas. Un segundo dedo en una línea ocupada se ignora.

Salir del camino detiene el avance sin mensajes ni sonidos de error. Para continuar sin levantar el dedo, vuelve al último punto alcanzado o a una parte anterior del recorrido: entrar más adelante no rellena el tramo pendiente. La marca comienza en el contacto real dentro del círculo.

Levantar el dedo o cancelar el contacto termina ese gesto; el siguiente intento debe comenzar otra vez en su círculo. Solo se reinicia esa línea, conservando lo que hayan hecho los demás niños. Cada estrella celebra su llegada de forma independiente, con una animación breve y un sonido suave si el navegador permite Web Audio. Las celebraciones simultáneas no suman varios sonidos al mismo tiempo.

Al completar todas las líneas aparecen **REPETIR** y **SIGUIENTE**. Después del cuarto ejercicio, **SIGUIENTE** vuelve al primero. Cambiar de modo, de ejercicio o de tamaño de pantalla reinicia los trazos y libera los contactos activos.

El área de trabajo impide scroll, selección y gestos de zoom táctil. La animación respeta la preferencia de movimiento reducido del sistema.

**La participación simultánea requiere una PDI que transmita varios contactos independientes.** Si el equipo solo emula un ratón, los niños pueden practicar por turnos con las mismas líneas.

## Añadir trazos y cambiar la cantidad

En `app.js`, añade una entrada al array `EXERCISES`:

```js
{ name: "Línea horizontal hacia la izquierda", start: [1, 0.5], end: [0, 0.5], copies: 3 },
```

`start` y `end` son coordenadas normalizadas dentro de cada columna: `[0, 0]` es arriba a la izquierda y `[1, 1]` abajo a la derecha. `copies` indica el número máximo de líneas en práctica; demostración siempre muestra una. Esta versión admite segmentos rectos; las curvas requerirían adaptar la proyección y la validación del recorrido.

## Altura, grosor y tolerancia

Al principio de `app.js`, el objeto `SETTINGS` controla:

- `lowerAreaRatio`: fracción inferior disponible para los niños (`0.7`). Cambiarla a `0.6`, por ejemplo, deja libre el 40 % superior y sitúa los dibujos más abajo.
- `minColumnWidth`: ancho mínimo de cada columna (220 píxeles CSS). Controla cuántas líneas caben sin juntarlas.
- `pathWidth`: anchura visible del camino (100).
- `inkWidth`: anchura de la marca verde (72).
- `tolerance`: distancia máxima desde el centro del camino a cada lado (80).
- `startRadius`: radio de la zona donde se permite comenzar (54).
- `endRadius`: radio de llegada a la estrella (50).

Las medidas se escalan proporcionalmente cuando la pantalla es pequeña para evitar solapamientos. La tolerancia se limita además a la columna propia del niño. Los colores y tamaños de botones se ajustan en `styles.css`.

## Comprobaciones

Prueba reproducible de lógica, sin instalar dependencias:

```sh
node tests/check-logic.cjs
```

**1.706 comprobaciones pasan** al ejecutar el código de la aplicación en un DOM simulado: los cuatro recorridos, ambos modos, ratón/tacto/lápiz, varios tamaños de pantalla, geometría dentro del área inferior, inicio obligatorio, bloqueo de saltos, reinicio, cancelación y tres contactos simultáneos independientes. También comprueba que terminar, reiniciar o cancelar una línea no interrumpe las demás. Estas comprobaciones no sustituyen una prueba en navegador ni en la PDI concreta.

Prueba de navegador preparada en `tests/check-browser.py`, con Playwright como herramienta opcional de desarrollo (no es una dependencia de la aplicación). Usa Chromium y abre directamente `index.html`:

```sh
python3 tests/check-browser.py
```

Incluye eventos táctiles nativos simulados con hasta tres contactos simultáneos, los cuatro tipos, ambos modos, ratón, posición de los dibujos, inicio obligatorio, continuidad y ausencia de scroll.

**Estado de validación:** las comprobaciones de lógica pasan. Chromium no se puede iniciar en el entorno de desarrollo por una restricción de permisos de sockets (`Operation not permitted`); la prueba de navegador sigue pendiente. La versión anterior fue probada por el usuario. Esta ampliación necesita confirmar el comportamiento multitáctil en la PDI concreta.
