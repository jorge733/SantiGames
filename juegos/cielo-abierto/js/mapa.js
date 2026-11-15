// Mapa del crucero: continentes, destinos de la aerolínea y la ruta más corta con el avión avanzando.
(function () {
  'use strict';
  const COL = { mar: '#1f4f7a', tierra: '#5f9a6a', borde: '#7fb98a', ruta: '#f7c35f', hecho: '#ff7a45', punto: '#f5f1e6', texto: '#f5f1e6', suave: '#b9c6dc' };

  // Proyección equirectangular centrada en la ruta (las longitudes se desenrollan alrededor del centro).
  function proyeccion(origen, destino, ancho, alto) {
    const D = window.Destinos;
    const muestras = [];
    for (let i = 0; i <= 48; i++) muestras.push(D.puntoRuta(origen, destino, i / 48));
    const centroLon = D.puntoRuta(origen, destino, 0.5).lon;
    const desenrollar = (lon) => { let l = lon - centroLon; while (l > 180) l -= 360; while (l < -180) l += 360; return l; };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of muestras) {
      const x = desenrollar(p.lon);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, p.lat); maxY = Math.max(maxY, p.lat);
    }
    const latMedia = (minY + maxY) / 2, coseno = Math.max(0.35, Math.cos(latMedia * Math.PI / 180));
    // Margen generoso y un tamaño mínimo para que los vuelos cortos tengan contexto.
    let anchoGrados = Math.max(14, (maxX - minX) * coseno * 1.5), altoGrados = Math.max(10, (maxY - minY) * 1.5);
    const proporcion = ancho / alto;
    if (anchoGrados / altoGrados > proporcion) altoGrados = anchoGrados / proporcion; else anchoGrados = altoGrados * proporcion;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const escala = ancho / anchoGrados;
    return {
      escala, desenrollar,
      a: (lon, lat, desplazamiento) => [ancho / 2 + ((desenrollar(lon) + (desplazamiento || 0)) - cx) * coseno * escala, alto / 2 - (lat - cy) * escala],
      cruda: (x, lat) => [ancho / 2 + (x - cx) * coseno * escala, alto / 2 - (lat - cy) * escala],
      cx, centroLon,
    };
  }

  function dibujar(ctx, ancho, alto, origen, destino, t) {
    const D = window.Destinos;
    const pr = proyeccion(origen, destino, ancho, alto);
    ctx.fillStyle = COL.mar;
    ctx.fillRect(0, 0, ancho, alto);
    // Continentes: cada anillo se dibuja con su longitud desenrollada alrededor del centro.
    ctx.fillStyle = COL.tierra; ctx.strokeStyle = COL.borde; ctx.lineWidth = 1;
    for (const anillo of window.MAPA_TIERRA) {
      // Longitudes continuas a lo largo del anillo; luego se dibuja con desplazamientos de ±360°
      // para que los continentes que cruzan el antimeridiano aparezcan donde toca.
      const xs = [];
      let previo = null;
      for (let i = 0; i < anillo.length; i += 2) {
        let x = pr.desenrollar(anillo[i]);
        if (previo !== null) { while (x - previo > 180) x -= 360; while (previo - x > 180) x += 360; }
        xs.push(x); previo = x;
      }
      for (const desplazamiento of [-360, 0, 360]) {
        ctx.beginPath();
        for (let k = 0; k < xs.length; k++) {
          const [px, py] = pr.cruda(xs[k] + desplazamiento, anillo[k * 2 + 1]);
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // Ruta: la parte hecha en coral y la que falta en dorado discontinuo.
    const ruta = (desde, hasta, color, discontinua) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash(discontinua ? [8, 7] : []);
      const pasos = 64;
      for (let i = 0; i <= pasos; i++) {
        const p = D.puntoRuta(origen, destino, desde + (hasta - desde) * (i / pasos));
        const [x, y] = pr.a(p.lon, p.lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    ruta(t, 1, COL.ruta, true);
    if (t > 0) ruta(0, t, COL.hecho, false);
    // Destinos de la aerolínea visibles.
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const d of D.DESTINOS) {
      const [x, y] = pr.a(d.lon, d.lat);
      if (x < -20 || y < -20 || x > ancho + 20 || y > alto + 20) continue;
      const clave = d === origen || d === destino;
      ctx.fillStyle = clave ? COL.ruta : COL.punto;
      ctx.beginPath(); ctx.arc(x, y, clave ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = clave ? COL.texto : COL.suave;
      ctx.font = `${clave ? 700 : 500} ${clave ? 13 : 11}px system-ui, sans-serif`;
      ctx.fillText(clave ? `${d.ciudad} (${d.codigo})` : d.codigo, x + 7, y);
    }
    // Avión: un triángulo orientado según la ruta.
    const p = D.puntoRuta(origen, destino, t), q = D.puntoRuta(origen, destino, Math.min(1, t + 0.01));
    const [ax, ay] = pr.a(p.lon, p.lat);
    let [bx, by] = pr.a(q.lon, q.lat);
    if (t >= 0.99) { const r = D.puntoRuta(origen, destino, 0.98); const [rx, ry] = pr.a(r.lon, r.lat); bx = ax + (ax - rx); by = ay + (ay - ry); }
    const ang = Math.atan2(by - ay, bx - ax);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = '#fafaf2'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  window.Mapa = { dibujar };
})();
