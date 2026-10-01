# TRAZOS

Primera versión de una aplicación de grafomotricidad para niños de 3 años, pensada para una PDI táctil y pantallas 16:9. HTML, CSS y JavaScript vanilla, sin frameworks, backend, fuentes remotas ni dependencias de ejecución.

## Ejecutar

Descarga los archivos y abre `index.html` en un navegador moderno. Funciona sin conexión. También puedes servir la carpeta:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000`. En la PDI se recomienda la pantalla completa del navegador (F11 en equipos compatibles).

## Uso

Pulsa **TRAZOS RECTOS**, empieza dentro del círculo verde y sigue el camino con un único gesto hasta la estrella. Funciona con dedo, lápiz y botón principal del ratón mediante Pointer Events.

Hay cuatro recorridos: vertical descendente, horizontal hacia la derecha, diagonal descendente y diagonal ascendente. Al completar aparecen **REPETIR** y **SIGUIENTE**, una animación breve y un sonido suave si el navegador permite Web Audio. Después del cuarto ejercicio, **SIGUIENTE** vuelve al primero.

Salir del camino detiene el avance sin mensajes ni sonidos de error. Para continuar sin levantar el dedo, vuelve al último punto alcanzado o a una parte anterior del recorrido: entrar más adelante no rellena el tramo pendiente. La marca comienza en el contacto real dentro del círculo. Levantar el dedo o cancelar el contacto termina el gesto; el siguiente intento debe comenzar otra vez en el círculo. Un segundo dedo se ignora. Cambiar el tamaño de la pantalla reinicia el ejercicio.

El área de trabajo impide scroll, selección y gestos de zoom táctil. La animación respeta la preferencia de movimiento reducido del sistema.

## Añadir trazos

En `app.js`, añade una entrada al array `EXERCISES`:

```js
{ name: "Línea horizontal hacia la izquierda", start: [1, 0.5], end: [0, 0.5] },
```

`start` y `end` son coordenadas normalizadas dentro del área útil: `[0, 0]` es arriba a la izquierda y `[1, 1]` abajo a la derecha. Esta versión admite segmentos rectos; las curvas requerirían adaptar la proyección y la validación del recorrido.

## Grosor y tolerancia

Al principio de `app.js`, el objeto `SETTINGS` controla las medidas en píxeles CSS:

- `pathWidth`: anchura visible del camino (100).
- `inkWidth`: anchura de la marca verde (72).
- `tolerance`: distancia máxima desde el centro del camino a cada lado (80); el corredor admitido mide 160 en total y tiene extremos redondeados.
- `startRadius`: radio de la zona donde se permite comenzar (54).
- `endRadius`: radio de llegada a la estrella (50).

Los colores y los tamaños de los botones se ajustan en `styles.css`. El contorno oscuro hace visible el camino sobre el fondo claro.

## Comprobaciones

Prueba de lógica reproducible, sin instalar dependencias:

```sh
node tests/check-logic.cjs
```

Ejecuta `app.js` con un DOM simulado y comprueba los cuatro recorridos con eventos de ratón, tacto y lápiz; inicio obligatorio; pausa fuera del camino; bloqueo de saltos; reinicio; cancelación; segundo dedo y navegación. Comprueba también las reglas CSS y los manejadores que bloquean scroll. Estas comprobaciones no sustituyen una prueba en navegador ni en una PDI real.

Prueba de navegador preparada en `tests/check-browser.py`, con Playwright como herramienta opcional de desarrollo (no es una dependencia de la aplicación). Usa Chromium y abre directamente `index.html`:

```sh
python3 tests/check-browser.py
```

**Estado de validación:** las comprobaciones de lógica pasan. Las pruebas reales de navegador quedaron bloqueadas por los permisos del entorno de desarrollo; no se han dado por realizadas. Antes del uso en aula, ejecutar la prueba de navegador y comprobar la sensibilidad en la PDI concreta.
