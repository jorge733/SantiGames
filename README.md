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

- **Cielo Abierto** (`juegos/cielo-abierto/`): simulador de vuelo 3D. Se juega con teclado o, en celular y tablet, con mandos táctiles en horizontal. Las misiones se editan en `js/misiones.js` (`consejoTactil` es el consejo que se muestra en pantallas táctiles).

## Créditos

Los gráficos 3D usan [three.js](https://threejs.org/) (licencia MIT, incluida en `juegos/cielo-abierto/vendor/`).
