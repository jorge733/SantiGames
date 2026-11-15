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

- **Cielo Abierto** (`juegos/cielo-abierto/`): simulador de vuelo 3D de una aerolínea: se pilota el Albatros 72, un turbohélice regional con 48 pasajeros. Cada avión se define en `AVIONES` (`js/fisica.js`). El modo aerolínea (`js/aerolinea.js`) guarda en el navegador el saldo, la reputación, la flota y el aeropuerto actual; ahí están las rutas, los precios y lo que cuesta cada avión. En el celular se puede pilotar con la palanca táctil o inclinando el aparato. Su comodidad (`js/pasajeros.js`) baja con maniobras bruscas y aterrizajes duros, y limita las estrellas. Se juega con teclado o, en celular y tablet, con mandos táctiles en horizontal. Las misiones se editan en `js/misiones.js` (`consejoTactil` es el consejo que se muestra en pantallas táctiles).

## Créditos

Los gráficos 3D usan [three.js](https://threejs.org/) (licencia MIT, incluida en `juegos/cielo-abierto/vendor/`).
