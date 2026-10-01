# TRAZOS

Aplicación táctil de grafomotricidad para niños de 3 años, pensada para una PDI y pantallas 16:9. HTML, CSS y JavaScript vanilla, sin frameworks, backend, fuentes remotas ni dependencias de ejecución.

Incluye 20 familias de ejercicios, basadas en las plantillas aportadas y en las ampliaciones solicitadas para el aula. Los dibujos se generan con SVG; no hace falta cargar el PDF para usar la aplicación.

## Ejecutar

Descarga el proyecto completo y abre `index.html` en un navegador moderno. Los archivos `tracing.js`, `templates.js`, `app.js` y `styles.css` deben estar junto a él. Funciona sin conexión. También puedes servir la carpeta:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000`. En la PDI se recomienda la pantalla completa del navegador (F11 en equipos compatibles).

## Diseño para PDI

La pantalla de ejercicios utiliza `fondo-trazos.png`, situado junto a `index.html`, como fondo con `background-size: cover`, centrado y sin repetición. Conserva la proporción y puede recortar los bordes en otras relaciones de aspecto. El fondo permanece detrás del SVG y de los botones; no hay paisaje añadido mediante HTML o CSS. **El PNG aún no está disponible en la carpeta ni en el repositorio revisado:** hasta incorporarlo se muestra el color de fondo suave definido en CSS.

El panel del profesor agrupa los controles en dos filas flexibles. Los botones activos se distinguen por su relleno turquesa, borde y texto blanco. El selector conserva el desplegable nativo y añade un icono SVG que cambia según la plantilla y una flecha visible. El catálogo actualizado contiene 20 familias y mantiene todos los controles de altura, ayuda, demostración y repetición.

Las verticales tienen un cohete SVG en el mismo punto de inicio, orientado hacia abajo o hacia arriba según el sentido elegido, con flecha de dirección. En práctica siguen apareciendo cinco figuras cuando hay ancho suficiente; en pantallas muy grandes se agrupan en una zona central de hasta 1.360 píxeles CSS. Los botones de repetición se alinean con esas columnas. El resto de plantillas conserva su distribución.

Los carriles tienen relleno crema claro y borde turquesa. Los inicios muestran una variación muy suave de opacidad, sin desplazar su zona táctil. La estrella dorada tiene un brillo breve al completar y conserva un halo con borde verde hasta reiniciar. Las animaciones respetan `prefers-reduced-motion`. Se conservan el grosor del carril y el radio de inicio. La tolerancia se adapta a las curvas y a la separación de los segmentos en castillos y zig-zag. El seguimiento permite muestras consecutivas que queden a ambos lados de un vértice agudo, solo junto a esa esquina; sigue rechazando saltos a zonas pendientes.

El dibujo reserva espacio bajo la altura real del panel superior para evitar solapamientos en resoluciones pequeñas. En la PDI conviene revisar el alcance de los niños, la legibilidad de los botones desde lejos, el recorte del PNG y el contraste del carril sobre el paisaje.

## Demostración y práctica

Pulsa **EMPEZAR**. La aplicación abre **DEMOSTRACIÓN**, con una figura grande para el profesor. El selector superior permite elegir directamente cualquiera de las 20 plantillas. Pulsa **PRÁCTICA** para mostrar varias copias de la misma figura, una al lado de otra.

En demostración, un punto naranja recorre despacio la figura una vez: muestra el inicio, la dirección y, en figuras compuestas, cada parte por orden. Cada recorrido dura entre 5 y 12 segundos. El botón con el triángulo permite volver a verla; mientras se reproduce muestra un cuadrado para detenerla. El punto **va pintando el recorrido** en una capa independiente, sin completar el ejercicio del niño. Al acabar queda el ejemplo pintado. La tinta del ejemplo se borra al reproducirlo de nuevo, tocar el dibujo, repetir o cambiar de modo. Está separada de la tinta real y nunca cuenta como trabajo del niño. En «Palos y puntos» muestra primero el palo y después marca el punto; esa segunda acción dura menos de un segundo. Tocar el dibujo detiene la demostración para que el profesor pueda trazar. También se detiene al cambiar de plantilla, pasar a práctica o salir de la ventana. Con la preferencia de movimiento reducido del sistema, esta animación queda desactivada.

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

Los círculos y óvalos empiezan arriba y avanzan hacia la izquierda. Las dos líneas de la X empiezan arriba y descienden. Cuadrados, triángulos y rectángulos se cierran con un único gesto; la estrella aparece al acercarse a completar la vuelta. Los castillos empiezan hacia la izquierda, suben y continúan derecha, abajo, derecha, arriba… Ondas alterna subidas y bajadas; Olas muestra arcos sucesivos sobre una misma base. Se han retirado Línea con óvalos, Línea entre puntos y Círculos dobles.

Pueden trabajar dos o tres niños simultáneamente, o uno solo puede completar todas las figuras por turnos y en cualquier orden. Cada columna da a un niño su propio espacio. La cantidad de copias se reduce automáticamente en pantallas pequeñas; «Círculo y cruz» necesita una columna más ancha porque incluye dos símbolos juntos, y «Castillos» necesita espacio para separar sus segmentos.

**Por defecto, todos los dibujos, incluidos sus círculos de inicio y estrellas, están dentro del 70 % inferior de la pantalla.** El 30 % superior contiene los controles del profesor. El botón de ajustes junto al selector abre **AJUSTES DEL PROFESOR**: **BAJAR** y **SUBIR** cambian la altura en pasos pequeños, desde el 70 % hasta el 45 % inferior. Bajar reduce la zona y acerca los puntos de inicio al suelo. La zona inferior reserva además espacio para los botones de repetición. En pantallas muy bajas se deja un pequeño margen adicional para el selector.

En esos ajustes también se elige **GESTO CONTINUO** o **CON AYUDA**. Pulsa **LISTO** para volver al ejercicio; también puedes cerrar con Escape. Abrir los ajustes libera los contactos activos. Cambiar la altura reinicia los dibujos: conviene ajustarla antes de empezar. La altura y el modo de ayuda se recuerdan en el mismo dispositivo con `localStorage`, si el navegador lo permite. No se guardan los dibujos de los niños.

Los controles superiores permiten volver al inicio, elegir demostración/práctica, seleccionar una plantilla, repetir todas las figuras (flecha circular) y pasar a la siguiente (flecha a la derecha). El profesor puede cambiar de plantilla aunque haya figuras pendientes. Cambiar de modo, plantilla o tamaño de pantalla reinicia los dibujos y libera los contactos activos.

## Trazar

Empieza en el círculo verde, sigue la flecha y dibuja hasta la estrella. Por defecto se utiliza un único gesto continuo. Funciona con dedo, lápiz y botón principal del ratón mediante Pointer Events.

La marca verde muestra **el recorrido real del dedo**, incluidas sus pequeñas desviaciones dentro de la tolerancia; no se centra sobre la guía. Su grosor permite ver la guía ancha debajo. Los movimientos fuera de la zona permitida no pintan ni hacen avanzar el ejercicio.

Las figuras compuestas se hacen **por partes**: una cruz requiere sus dos líneas; «Palos y puntos» requiere el palo y un toque independiente; «Círculo y cruz» requiere una vuelta y las dos líneas. Solo la parte actual muestra su punto de inicio. Al terminar aparece el inicio de la siguiente parte. Si se interrumpe esa parte, se conserva lo ya completado.

En un círculo, el punto de inicio y el destino coinciden. Primero se ve el círculo verde con su flecha; cuando el niño ha recorrido la mayor parte de la vuelta, aparece la estrella en ese lugar. Tocar el punto de inicio, quedarse quieto o atravesar el diámetro no completa la vuelta. Si levanta el dedo antes de terminar, en gesto continuo vuelve a mostrarse el inicio para repetir esa parte; con ayuda aparece el punto de continuación.

En «Camino de puntos», las marcas guían un camino continuo. En **«Palos y puntos»**, el punto no está dibujado: primero se hace el palo y después aparece un círculo de contorno discontinuo para indicar dónde tocar. El toque crea una marca en la posición real del dedo y completa la figura. La estrella aparece debajo para que el punto siga visible. Deslizar el mismo dedo desde el palo no lo marca; hace falta un contacto nuevo.

Salir del camino detiene el avance sin mensajes ni sonidos de error. Para continuar sin levantar el dedo, vuelve al último tramo alcanzado o a una parte anterior del recorrido. Entrar más adelante no rellena lo pendiente. El seguimiento comprueba también el movimiento entre eventos para evitar atajos entre curvas o a través de un círculo.

En **GESTO CONTINUO**, levantar el dedo o cancelar el contacto termina ese gesto. El siguiente intento debe comenzar de nuevo en su círculo. Solo se reinicia esa parte, manteniendo las partes anteriores y lo que hayan hecho los demás niños.

En **CON AYUDA**, el niño puede levantar el dedo y continuar cerca del último punto válido, señalado con el círculo verde. El siguiente contacto conserva lo dibujado y empieza una nueva marca: no se dibuja una línea entre contactos ni se rellenan zonas pendientes. Tampoco se puede comenzar una figura nueva por la mitad. Un segundo dedo en una figura ocupada se ignora en ambos modos.

Cada llegada celebra de forma independiente, con una animación breve y un sonido suave si el navegador permite Web Audio. Las celebraciones simultáneas mantienen el volumen suave.

En práctica hay un botón **REPETIR** debajo de cada figura. Borra solo esa figura, incluso si otro niño está trazando simultáneamente. Se puede usar antes o después de terminar y permanece disponible al completar todas las figuras. El profesor pasa de plantilla con la flecha superior. Cuando hay una sola figura, al completarla aparecen los botones grandes **REPETIR** y **SIGUIENTE**. Después de la última plantilla, **SIGUIENTE** vuelve a la primera.

El área de trabajo impide scroll, selección y gestos de zoom táctil. La animación respeta la preferencia de movimiento reducido del sistema.

La participación simultánea requiere una PDI que transmita varios contactos independientes. Si el equipo emula un único ratón, los niños pueden practicar por turnos con las mismas figuras.

## Organización y nuevas plantillas

- `index.html`: pantallas y controles.
- `styles.css`: colores, tamaños y animaciones.
- `app.js`: disposición inferior, interacción, figuras por partes, sonido y navegación.
- `templates.js`: catálogo y construcción de los dibujos.
- `tracing.js`: geometría y seguimiento de segmentos rectos, curvas y círculos.
- `tests/`: comprobaciones de lógica y prueba opcional de navegador.

Para añadir una plantilla, añade una entrada al `catalog` de `templates.js` y un caso en `build()` que devuelva una lista de trazos. Cada trazo contiene `points` (coordenadas del camino, ordenadas según el sentido), `scale`, `closed` y `guides` (marcas decorativas). Un punto dibujable utiliza `kind: "dot"` y una sola coordenada; se trata como un toque independiente. El orden de la lista determina el orden de las partes. Las curvas se representan con puntos próximos entre sí y los círculos terminan en el mismo punto donde empiezan.

`copies` controla el máximo de figuras en práctica; `minWidth`, cuando se indica, define el ancho mínimo de cada columna para esa plantilla. Demostración muestra siempre una figura.

## Altura, grosor y tolerancia

Al principio de `app.js`, el objeto `SETTINGS` controla:

- `lowerAreaRatio`: fracción inferior inicial disponible para los niños (`0.7`). Los ajustes del profesor o una preferencia guardada sustituyen este valor al usar la aplicación.
- `minColumnWidth`: ancho mínimo general de cada columna (220 píxeles CSS).
- `pathWidth`: anchura visible máxima del camino (100).
- `inkWidth`: anchura máxima de la marca verde (36).
- `tolerance`: distancia máxima desde el centro del camino a cada lado (80).
- `startRadius`: radio máximo del círculo de inicio (54).
- `endRadius`: radio máximo de llegada a la estrella (50).
- `sampleStep`: separación máxima entre las comprobaciones del movimiento (6).
- `demoSpeed`: velocidad orientativa del punto de demostración (95 píxeles por segundo, ajustados a la escala).
- `demoMinDuration` y `demoMaxDuration`: duración mínima y máxima de cada parte de la demostración (5.000 y 12.000 milisegundos).

Las medidas se escalan para conservar la legibilidad de ondas, círculos pequeños y anillos concéntricos. `templates.js` limita adicionalmente la tolerancia de las ondas según su altura para impedir que un movimiento recto complete sus curvas. La tolerancia siempre se limita a la columna propia del niño. Los colores y los tamaños de los botones se ajustan en `styles.css`.

## Comprobaciones

Prueba de lógica, sin instalar dependencias:

```sh
node tests/check-logic.cjs
```

La suite ejecuta el código de producción en un DOM simulado y comprueba las 20 familias, ambos modos, ratón/tacto/lápiz, varios tamaños, posición inferior, inicio obligatorio, reinicio, cancelación, tres contactos simultáneos y figuras de varias partes. Comprueba que los círculos no se completen al tocar el inicio o atravesar su diámetro, que una línea recta no complete una onda y que interrumpir un niño no afecte a los demás. También verifica la marca real, continuación con ayuda sin saltos, repetición individual con otro contacto activo, altura ajustable y persistente, almacenamiento bloqueado y demostración lenta con tinta independiente y sin crédito de ejercicio. Añade comprobaciones de sentidos, punto creado por el niño, esquinas agudas y rechazo de atajos en las nuevas figuras.

**Estado:** 13.025 comprobaciones de lógica pasan. Las vistas estáticas revisadas en la ampliación anterior no son capturas de navegador ni validan los nuevos controles.

La prueba de navegador de `tests/check-browser.py` utiliza Playwright y Chromium como herramientas opcionales de desarrollo, independientes de la aplicación:

```sh
python3 tests/check-browser.py
```

Incluye las 20 familias con ratón y eventos táctiles nativos simulados, hasta tres figuras a la vez, sus partes secuenciales, ambos modos, posición inferior y ausencia de scroll. Añade las cinco mejoras, incluida la repetición con un segundo contacto mientras otro niño continúa. **Sigue pendiente ejecutarla:** el entorno de desarrollo impide iniciar Chromium por una restricción de sockets (`Operation not permitted`). La versión anterior fue probada por el usuario; esta ampliación necesita confirmar el comportamiento en navegador y en la PDI concreta.
