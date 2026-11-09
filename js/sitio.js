// Construye el juego destacado y el catálogo a partir de datos/juegos.js.
(function () {
  'use strict';
  const datos = window.SANTIGAMES;

  function crear(etiqueta, clase, texto) {
    const n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }

  function enlace(clase, texto, href) {
    const a = crear('a', clase, texto);
    a.href = href;
    return a;
  }

  const destacado = document.getElementById('destacado');
  const juego = datos.juegos.find((j) => j.destacado) || datos.juegos[0];
  if (destacado && juego) {
    destacado.append(crear('p', 'etiqueta', 'Juego destacado'), crear('h1', '', juego.titulo), crear('p', 'entrada', juego.resumen));
    const acciones = crear('div', 'acciones');
    acciones.append(enlace('boton principal', 'Jugar ahora', juego.jugar), enlace('boton', 'Ver detalles', juego.ficha));
    destacado.append(acciones);
  }

  const catalogo = document.getElementById('catalogo');
  if (catalogo) {
    for (const j of datos.juegos) {
      const tarjeta = crear('article', 'tarjeta');
      const portada = document.createElement('a');
      portada.href = j.ficha;
      portada.className = 'portada';
      const img = document.createElement('img');
      img.src = j.portada;
      img.alt = 'Portada de ' + j.titulo;
      img.loading = 'lazy';
      portada.append(img);
      const cuerpo = crear('div', 'cuerpo');
      cuerpo.append(
        crear('p', 'estado ' + j.estado, j.estado === 'disponible' ? 'Disponible' : 'En desarrollo'),
        crear('h3', '', j.titulo),
        crear('p', 'meta', j.genero + ' · ' + j.plataforma),
        crear('p', '', j.resumen),
        enlace('boton pequeno', j.estado === 'disponible' ? 'Jugar' : 'Ver detalles', j.estado === 'disponible' ? j.jugar : j.ficha)
      );
      tarjeta.append(portada, cuerpo);
      catalogo.append(tarjeta);
    }
    const proxima = crear('article', 'tarjeta proxima');
    proxima.append(crear('p', 'signo', '+'), crear('h3', '', 'Próximamente'), crear('p', '', 'El siguiente juego de SantiGames está por despegar.'));
    catalogo.append(proxima);
  }

  const contacto = document.getElementById('contacto-dato');
  if (contacto) {
    if (datos.contacto) {
      contacto.textContent = 'Escríbenos a ';
      contacto.append(enlace('', datos.contacto, 'mailto:' + datos.contacto));
    } else {
      contacto.textContent = 'Muy pronto encontrarás aquí la forma de escribirnos.';
    }
  }
})();
