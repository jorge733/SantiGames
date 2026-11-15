# SantiGames

Sitio web del estudio de videojuegos SantiGames. Los juegos están hechos por Santi con Claude Code.

**Web publicada:** https://santigames.benedettowebs.cl/

## Verlo en tu ordenador

Abre `index.html` con doble clic. No hace falta instalar nada.

## Añadir un juego nuevo

1. Crea una carpeta en `juegos/nombre-del-juego/` con su ficha (`index.html`), el juego y una portada.
2. Añade una entrada a la lista `juegos` en `datos/juegos.js`.

El catálogo de la página principal se actualiza solo.

## Juegos

Cielo Abierto se puede instalar como app (PWA) desde su ficha o desde el menú del juego, y funciona sin conexión: `juegos/cielo-abierto/manifest.webmanifest` describe la app y `juegos/cielo-abierto/sw.js` guarda los archivos. Si añades un archivo al juego, añádelo también a la lista `ARCHIVOS` de `sw.js`. Los iconos están en `juegos/cielo-abierto/iconos/` (el original es `icono.svg`).

- **Cielo Abierto** (`juegos/cielo-abierto/`): simulador de vuelo 3D de una aerolínea: se pilota el Albatros 72, un turbohélice regional con 48 pasajeros. Cada avión se define en `AVIONES` (`js/fisica.js`). El modo aerolínea (`js/aerolinea.js`) guarda en el navegador el saldo, la reputación, la flota y la ciudad actual; ahí están los precios, el alcance y lo que cuesta cada avión. Los destinos reales están en `js/destinos.js` (coordenadas, altitud, largo de pista y paisaje); el terreno 3D de cada uno se genera a partir de su paisaje en `js/terreno.js`, y la isla original queda para las misiones de práctica. El crucero se ve en un mapa (`js/mapa.js`). En el celular se puede pilotar con la palanca táctil o inclinando el aparato. El pilotaje asistido (`js/asistencia.js`, activado por defecto en pantallas táctiles, tecla V o botón Asistido) mantiene el avión estable al soltar los mandos: alas niveladas, la misma senda de subida o bajada, protección de pérdida y compensación automática. Su comodidad (`js/pasajeros.js`) baja con maniobras bruscas y aterrizajes duros, y limita las estrellas. Se juega con teclado o, en celular y tablet, con mandos táctiles en horizontal. Las misiones se editan en `js/misiones.js` (`consejoTactil` es el consejo que se muestra en pantallas táctiles).

- **TaxiSim** (`juegos/taxisim/`): simulador de taxi 2D con vista desde arriba. Todo el juego está en `js/juego.js`, dividido en secciones: la ciudad (cuadrícula de calles, edificios, parques y estaciones de combustible, generada siempre igual con una semilla fija), el tráfico (autos que van de cruce en cruce por su carril), el taxi, los pasajeros, el dibujo, el sonido y la interfaz. Un turno dura 5 minutos reales (de 08:00 a 20:00, en `DURACION_TURNO`). Los tipos de pasajero (normal, apurado, turista) están en `TIPOS` y las mejoras del taller en `MEJORAS`. Los ahorros, el mejor turno y las mejoras se guardan en el navegador (`localStorage`, clave `taxisim`).

## Créditos

Los gráficos 3D usan [three.js](https://threejs.org/) (licencia MIT, incluida en `juegos/cielo-abierto/vendor/`). El mapa del mundo usa los contornos de [Natural Earth](https://www.naturalearthdata.com/) (dominio público) a través de [world-atlas](https://github.com/topojson/world-atlas) (licencia ISC), en `juegos/cielo-abierto/js/mapa-tierra.js`.
