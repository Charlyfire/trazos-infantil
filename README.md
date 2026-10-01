# TRAZOS

Aplicación táctil de grafomotricidad para niños de 3 años, pensada para una PDI y pantallas 16:9. HTML, CSS y JavaScript vanilla, sin frameworks, backend, fuentes remotas ni dependencias de ejecución.

Incluye adaptaciones geométricas de las doce familias de las dos páginas de «Plantillas de trazos nivel 1» aportadas como referencia, más las dos diagonales de la versión inicial. Los dibujos se generan con SVG; no hace falta cargar el PDF para usar la aplicación.

## Ejecutar

Descarga el proyecto completo y abre `index.html` en un navegador moderno. Los archivos `tracing.js`, `templates.js`, `app.js` y `styles.css` deben estar junto a él. Funciona sin conexión. También puedes servir la carpeta:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000`. En la PDI se recomienda la pantalla completa del navegador (F11 en equipos compatibles).

## Demostración y práctica

Pulsa **EMPEZAR**. La aplicación abre **DEMOSTRACIÓN**, con una figura grande para el profesor. El selector superior permite elegir directamente cualquiera de las 14 plantillas. Pulsa **PRÁCTICA** para mostrar varias copias de la misma figura, una al lado de otra.

| Plantilla | Gestos por figura | Copias máximas en práctica |
| --- | --- | --- |
| Verticales | 1 | 5 |
| Horizontales | 1 | 3 |
| Diagonales descendentes | 1 | 3 |
| Diagonales ascendentes | 1 | 3 |
| Cruces + | 2 | 3 |
| Línea con óvalos | 1 | 3 |
| Ondas | 1 | 3 |
| Palos y puntos | 1 | 4 |
| Círculo y cruz | 3 | 3 |
| Camino de puntos | 1 | 3 |
| Línea entre puntos | 1 | 3 |
| Círculos | 1 | 3 |
| Círculos dobles | 2 | 3 |
| Cruces X | 2 | 3 |

Pueden trabajar dos o tres niños simultáneamente, o uno solo puede completar todas las figuras por turnos y en cualquier orden. Cada columna da a un niño su propio espacio. La cantidad de copias se reduce automáticamente en pantallas pequeñas; «Círculo y cruz» necesita una columna más ancha porque incluye dos símbolos juntos.

**Todos los dibujos, incluidos sus círculos de inicio y estrellas, están dentro del 70 % inferior de la pantalla.** El 30 % superior contiene los controles del profesor. La zona inferior reserva además espacio para los botones de finalización. En pantallas muy bajas se deja un pequeño margen adicional para el selector.

Los controles superiores permiten volver al inicio, elegir demostración/práctica, seleccionar una plantilla, repetir todas las figuras (flecha circular) y pasar a la siguiente (flecha a la derecha). El profesor puede cambiar de plantilla aunque haya figuras pendientes. Cambiar de modo, plantilla o tamaño de pantalla reinicia los dibujos y libera los contactos activos.

## Trazar

Empieza en el círculo verde, sigue la flecha y dibuja hasta la estrella con un único gesto continuo. Funciona con dedo, lápiz y botón principal del ratón mediante Pointer Events.

Las figuras compuestas se hacen **por partes**: una cruz requiere sus dos líneas; un círculo doble requiere una vuelta exterior y otra interior; «Círculo y cruz» requiere una vuelta y las dos líneas. Solo la parte actual muestra su punto de inicio. Al terminar aparece el inicio de la siguiente parte. Si se interrumpe esa parte, se conserva lo ya completado.

En un círculo, el punto de inicio y el destino coinciden. Primero se ve el círculo verde con su flecha; cuando el niño ha recorrido la mayor parte de la vuelta, aparece la estrella en ese lugar. Tocar el punto de inicio, quedarse quieto o atravesar el diámetro no completa la vuelta. Si levanta el dedo antes de terminar, vuelve a mostrarse el inicio para repetir esa parte.

Los puntos y óvalos son referencias visuales: el niño sigue un camino continuo guiado por esas marcas. En «Palos y puntos» se traza el palo vertical junto al punto.

Salir del camino detiene el avance sin mensajes ni sonidos de error. Para continuar sin levantar el dedo, vuelve al último tramo alcanzado o a una parte anterior del recorrido. Entrar más adelante no rellena lo pendiente. El seguimiento comprueba también el movimiento entre eventos para evitar atajos entre curvas o a través de un círculo.

Levantar el dedo o cancelar el contacto termina ese gesto. El siguiente intento debe comenzar de nuevo en su círculo. Solo se reinicia esa parte, manteniendo las partes anteriores y lo que hayan hecho los demás niños. Un segundo dedo en una figura ocupada se ignora.

Cada llegada celebra de forma independiente, con una animación breve y un sonido suave si el navegador permite Web Audio. Las celebraciones simultáneas mantienen el volumen suave. Al completar todas las figuras aparecen **REPETIR** y **SIGUIENTE**. Después de la última plantilla, **SIGUIENTE** vuelve a la primera.

El área de trabajo impide scroll, selección y gestos de zoom táctil. La animación respeta la preferencia de movimiento reducido del sistema.

La participación simultánea requiere una PDI que transmita varios contactos independientes. Si el equipo emula un único ratón, los niños pueden practicar por turnos con las mismas figuras.

## Organización y nuevas plantillas

- `index.html`: pantallas y controles.
- `styles.css`: colores, tamaños y animaciones.
- `app.js`: disposición inferior, interacción, figuras por partes, sonido y navegación.
- `templates.js`: catálogo y construcción de los dibujos.
- `tracing.js`: geometría y seguimiento de segmentos rectos, curvas y círculos.
- `tests/`: comprobaciones de lógica y prueba opcional de navegador.

Para añadir una plantilla, añade una entrada al `catalog` de `templates.js` y un caso en `build()` que devuelva una lista de trazos. Cada trazo contiene `points` (coordenadas del camino), `scale`, `closed` y `guides` (marcas decorativas). El orden de la lista determina el orden de las partes. Las curvas se representan con puntos próximos entre sí y los círculos terminan en el mismo punto donde empiezan.

`copies` controla el máximo de figuras en práctica; `minWidth`, cuando se indica, define el ancho mínimo de cada columna para esa plantilla. Demostración muestra siempre una figura.

## Altura, grosor y tolerancia

Al principio de `app.js`, el objeto `SETTINGS` controla:

- `lowerAreaRatio`: fracción inferior disponible para los niños (`0.7`). Con `0.6` se deja libre el 40 % superior y los dibujos quedan más abajo.
- `minColumnWidth`: ancho mínimo general de cada columna (220 píxeles CSS).
- `pathWidth`: anchura visible máxima del camino (100).
- `inkWidth`: anchura máxima de la marca verde (72).
- `tolerance`: distancia máxima desde el centro del camino a cada lado (80).
- `startRadius`: radio máximo del círculo de inicio (54).
- `endRadius`: radio máximo de llegada a la estrella (50).
- `sampleStep`: separación máxima entre las comprobaciones del movimiento (6).

Las medidas se escalan para conservar la legibilidad de ondas, círculos pequeños y anillos concéntricos. `templates.js` limita adicionalmente la tolerancia de las ondas según su altura para impedir que un movimiento recto complete sus curvas. La tolerancia siempre se limita a la columna propia del niño. Los colores y los tamaños de los botones se ajustan en `styles.css`.

## Comprobaciones

Prueba de lógica, sin instalar dependencias:

```sh
node tests/check-logic.cjs
```

La suite ejecuta el código de producción en un DOM simulado y comprueba las 14 familias, ambos modos, ratón/tacto/lápiz, varios tamaños, posición inferior, inicio obligatorio, reinicio, cancelación, tres contactos simultáneos y figuras de varias partes. Comprueba que los círculos no se completen al tocar el inicio o atravesar su diámetro, que una línea recta no complete una onda y que interrumpir un niño no afecte a los demás.

**Estado:** 9.264 comprobaciones de lógica pasan. Se han revisado también vistas estáticas de los SVG de las ondas, círculos, círculos dobles y figuras compuestas. Estas vistas no son capturas de navegador.

La prueba de navegador de `tests/check-browser.py` utiliza Playwright y Chromium como herramientas opcionales de desarrollo, independientes de la aplicación:

```sh
python3 tests/check-browser.py
```

Incluye las 14 familias con ratón y eventos táctiles nativos simulados, hasta tres figuras a la vez, sus partes secuenciales, ambos modos, posición inferior y ausencia de scroll. **Sigue pendiente ejecutarla:** el entorno de desarrollo impide iniciar Chromium por una restricción de sockets (`Operation not permitted`). La versión anterior fue probada por el usuario; esta ampliación necesita confirmar el comportamiento en la PDI concreta.
