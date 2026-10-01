# TRAZOS

Aplicación táctil de grafomotricidad para niños de 3 años en una PDI. HTML, CSS y JavaScript vanilla, sin frameworks, backend ni dependencias de ejecución. Incluye 20 familias de ejercicios.

## Ejecutar y poner el fondo

Descarga el proyecto completo y abre `index.html` en un navegador moderno. Funciona sin conexión. También puedes servir la carpeta:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000`. En la PDI se recomienda la pantalla completa del navegador (F11 en equipos compatibles).

El fondo del proyecto debe llamarse **`fondo-trazos.png`** y estar junto a `index.html`. Se muestra con `background-size: cover`, centrado y sin deformarse. En otras proporciones de pantalla puede recortar los bordes. El paisaje permanece detrás del SVG y de todos los controles; no se añaden nubes, sol ni suelo mediante CSS.

También puedes abrir los ajustes del profesor y pulsar **CARGAR FONDO** para elegir el PNG original desde el ordenador de la PDI. Se admiten PNG, JPEG y WebP de hasta 8 MB. La imagen se valida antes de aplicarla y se guarda en el navegador de ese equipo, si hay espacio. Si el almacenamiento está bloqueado o lleno, se aplica durante la sesión y el panel lo indica. Cambiar el fondo conserva los dibujos actuales. No se envía la imagen a ningún servidor.

**Recurso pendiente en el repositorio:** las imágenes del paisaje llegaron visibles en el chat, pero no como un archivo accesible en el entorno. El PNG original aún debe añadirse a la carpeta, o seleccionarse mediante CARGAR FONDO. Sin él se muestra un color de fondo suave.

## Uso en clase

Pulsa **EMPEZAR**. Se abre **DEMOSTRACIÓN**, con una figura grande. El selector permite elegir cualquiera de las 20 plantillas. **PRÁCTICA** muestra varias copias para que trabajen dos o tres niños simultáneamente, o un niño por turnos. Cada figura tiene un botón **REPETIR** que conserva el trabajo de sus compañeros. Con una sola figura terminada aparecen los botones grandes REPETIR y SIGUIENTE.

Los controles superiores mantienen inicio, demostración/práctica, repetición general, siguiente, reproducción de la demostración y ajustes. Los botones se usan con Pointer Events y teclado; no dependen de hover.

Por defecto los ejercicios están dentro del **70 % inferior** de la pantalla. En los ajustes, **BAJAR** y **SUBIR** cambian la zona hasta el 45 % inferior. Las verticales se agrupan en una zona central de hasta 1.360 píxeles CSS y sus botones de repetición se alinean debajo. En pantallas pequeñas se reducen las copias y se reserva espacio bajo la altura real del panel superior.

Elige la altura y la dificultad antes de empezar: cambiar altura, dificultad, plantilla, modo o tamaño de pantalla reinicia los dibujos. Abrir los ajustes libera los contactos activos. **LISTO** o Escape cierra el panel. La altura y la dificultad se recuerdan en el dispositivo; las preferencias antiguas conservan la altura y comienzan en el nuevo modo fácil.

## Fácil y difícil

La indicación de inicio es una **flecha pequeña y fija**: no sigue al dedo, no cambia de orientación y no se desplaza al levantarlo. El primer contacto de cada recorrido debe comenzar junto a esa flecha. Después se siguen los carriles hasta la estrella. La tinta visible corresponde a la posición real del dedo.

**FÁCIL** es el modo inicial. Permite levantar el dedo y volver a dibujar dentro del mismo carril, incluso en otro tramo. Conserva las marcas anteriores y cada contacto crea una marca independiente: no dibuja una línea entre contactos. También permite salir y volver al carril sin borrar lo hecho. Al salir, el borde parpadea dos veces en rojo, sin sonido de error. Se completa cuando se ha cubierto el recorrido desde el inicio y se ha alcanzado la meta; tocar la estrella o dibujar un tramo posterior no rellena los huecos pendientes. Si se rellena el último hueco después de haber alcanzado la meta, la figura también puede completarse.

**DIFÍCIL** exige seguir el recorrido en un gesto continuo por parte. Si el dedo sale del carril, se borra inmediatamente esa figura y el siguiente intento debe comenzar desde su inicio. En una X, por ejemplo, salir durante la segunda línea reinicia ambas líneas. Los dibujos y contactos de los compañeros se conservan. Levantar el dedo antes de terminar una parte exige empezar esa parte de nuevo; las partes anteriores se conservan mientras no se salga del carril.

En ambos modos, **la tinta se recorta al carril con una máscara SVG**: ninguna porción del pincel se dibuja fuera del borde. Salir no añade tinta. Con movimiento reducido, el aviso rojo queda estático hasta volver al carril o reiniciar, evitando parpadeos.

Se mantienen estrellas grandes, celebración breve y sonido positivo suave cuando Web Audio está disponible. No hay puntuaciones ni mensajes largos. La pantalla impide scroll, selección, arrastre de imágenes y zoom gestual dentro del ejercicio.

La PDI debe transmitir contactos táctiles independientes para varios niños a la vez. Si emula un único ratón, se puede trabajar por turnos.

## Demostración pintada

El punto de demostración recorre lentamente la figura **y va pintando**, en una capa separada de la tinta del niño. Cada recorrido dura entre 5 y 12 segundos. En figuras compuestas muestra las partes por orden; el punto de Palos y puntos se marca en menos de un segundo. Al terminar queda visible el ejemplo pintado, sin completar el ejercicio ni dar crédito al niño.

El botón de reproducción permite repetir o detener la animación. Tocar el dibujo borra la tinta del ejemplo y detiene la demostración para comenzar un intento real. Repetir, cambiar de plantilla o pasar a práctica también borra el ejemplo. Salir de la ventana detiene la animación. La preferencia `prefers-reduced-motion` desactiva la reproducción animada.

## Plantillas

| Plantilla | Gestos por figura | Copias máximas en práctica |
| --- | --- | --- |
| Verticales hacia abajo | 1 | 5 |
| Verticales hacia arriba | 1 | 5 |
| Horizontales hacia la derecha | 1 | 3 |
| Horizontales hacia la izquierda | 1 | 3 |
| Diagonales descendentes | 1 | 3 |
| Diagonales ascendentes | 1 | 3 |
| Cruces + | 2 | 3 |
| Cruces X | 2, ambos descendentes | 3 |
| Círculos | 1 | 3 |
| Cuadrados | 1 | 3 |
| Óvalos | 1 | 3 |
| Triángulos | 1 | 3 |
| Rectángulos | 1 | 3 |
| Ondas | 1 | 3 |
| Olas | 1 | 3 |
| Castillos | 1 | 3 |
| Zig-zag | 1 | 3 |
| Palos y puntos | 1 línea + 1 toque | 4 |
| Círculo y cruz | 3 | 3 |
| Camino de puntos | 1 | 3 |

Los círculos y óvalos empiezan **arriba hacia la izquierda**. Las dos líneas de la X descienden. Los contornos cerrados se recorren con un solo gesto por parte; tocar su punto inicial no completa la vuelta. La estrella aparece al acercarse a terminarla.

**Castillos**, según la última plantilla adjunta, empieza **a la derecha**, luego sube, avanza a la derecha, baja y repite derecha, arriba, derecha, abajo; termina con un tramo horizontal hacia la derecha. Las almenas conservan una proporción horizontal y dejan espacio entre carriles. En práctica se limita la cantidad de repeticiones para que se distingan las esquinas y se puedan trazar con el dedo.

Ondas alterna subidas y bajadas; Olas muestra arcos sobre una misma base. En Camino de puntos las marcas guían un camino continuo. En Palos y puntos, primero se hace el palo; después aparece una zona vacía de contorno discontinuo para marcar el punto con **un contacto nuevo**. La estrella queda separada para que el punto pintado permanezca visible. No hay un punto ya dibujado.

## Archivos y nuevos ejercicios

- `index.html`: pantallas y controles del profesor.
- `styles.css`: paleta, botones, fondo, avisos y animaciones.
- `app.js`: disposición, eventos, máscaras SVG, demostración, sonido, fondo local y navegación.
- `templates.js`: catálogo y geometría de los ejercicios.
- `tracing.js`: seguimiento continuo, cobertura del modo fácil y puntos por contacto.
- `tests/`: comprobaciones de lógica y prueba opcional de navegador.

Para añadir una plantilla, crea una entrada en `catalog` de `templates.js` y un caso en `build()`. Devuelve una lista de trazos con `points` (coordenadas ordenadas según el sentido), `scale`, `closed` y `guides` (marcas decorativas). El orden de la lista determina el orden de las partes. Las curvas utilizan puntos cercanos entre sí y los contornos cerrados terminan donde empiezan. Un punto dibujable utiliza `kind: "dot"` y una sola coordenada.

`copies` limita las figuras en práctica; `minWidth` define, cuando es necesario, el ancho mínimo de cada columna. Demostración muestra una figura. Los iconos del selector se definen en `TEMPLATE_ICONS` de `app.js`.

## Grosor, tolerancia y altura

El objeto `SETTINGS`, al principio de `app.js`, controla:

- `pathWidth`: grosor máximo visible del carril (100 píxeles CSS).
- `inkWidth`: grosor máximo del pincel (36).
- `tolerance`: límite superior configurable (80); se limita además a la mitad del ancho real del carril, para que el centro del dedo no pinte fuera. Algunas curvas limitan más esa distancia.
- `startRadius`: radio de aceptación alrededor del inicio (54).
- `endRadius`: tolerancia de llegada a la meta (50).
- `sampleStep`: separación máxima entre comprobaciones del movimiento (6).
- `lowerAreaRatio`: fracción inferior inicial (0,7), sustituida por el ajuste del profesor.
- `minColumnWidth`: ancho mínimo general de cada figura (220).
- `demoSpeed`, `demoMinDuration`, `demoMaxDuration`: velocidad y duración de la demostración.

Las medidas se escalan con la figura. Las máscaras SVG utilizan el mismo ancho del carril y el espacio propio del niño. El seguimiento difícil admite muestras cercanas a ambos lados de una misma esquina aguda, sin permitir saltos a otros segmentos. El seguimiento fácil registra intervalos cubiertos por tinta; conserva los huecos entre contactos separados.

## Comprobaciones

Sin instalar dependencias:

```sh
node tests/check-logic.cjs
```

La suite ejecuta el código real en un DOM simulado. Comprueba las 20 familias, fácil/difícil, demostración/práctica, varios tamaños, ratón/tacto/lápiz, inicio obligatorio, cobertura sin huecos, flecha fija, aviso de salida, reinicio difícil, tres contactos independientes, repetición individual, máscaras de tinta y carga/persistencia del fondo.

**Estado:** 25.413 comprobaciones de lógica pasan. Se ha comprobado también con un renderizado SVG que la tinta es transparente fuera del carril. Las revisiones estáticas de SVG no son capturas de navegador.

La comprobación opcional de navegador utiliza Playwright y Chromium como herramientas de desarrollo:

```sh
python3 tests/check-browser.py
```

**Pendiente de ejecución real:** Chromium no puede iniciarse en este entorno por una restricción de sockets (`Operation not permitted`). En la PDI conviene revisar los dos niveles, la continuidad después de levantar el dedo, el recorte de tinta, los dos parpadeos, la visibilidad de las flechas, el guardado del fondo y los contactos de varios niños.
