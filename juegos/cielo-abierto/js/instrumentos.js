// Panel de instrumentos dibujado en un lienzo 2D, en unidades aeronáuticas.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const COL = { panel: '#1f2a44', bisel: '#33415f', cara: '#10182b', texto: '#f5f1e6', suave: '#9fb0cc', coral: '#ff7a45', oro: '#f7c35f', verde: '#6fd27a', rojo: '#ff5151', cielo: '#3f9fe0', suelo: '#a9713f' };

  function octogono(x, cx, cy, r) {
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * TAU) / 8;
      x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    x.closePath();
  }

  function esfera(x, cx, cy, r) {
    octogono(x, cx, cy, r * 1.06);
    x.fillStyle = COL.bisel; x.fill();
    x.beginPath(); x.arc(cx, cy, r * 0.92, 0, TAU);
    x.fillStyle = COL.cara; x.fill();
  }

  function rotulo(x, t, cx, cy, tam, col) {
    x.fillStyle = col || COL.texto;
    x.font = `600 ${Math.round(tam)}px system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(t, cx, cy);
  }

  function aguja(x, cx, cy, ang, largo, ancho, col) {
    x.save(); x.translate(cx, cy); x.rotate(ang);
    x.beginPath(); x.moveTo(-ancho, 0); x.lineTo(0, -largo); x.lineTo(ancho, 0); x.lineTo(0, largo * 0.14); x.closePath();
    x.fillStyle = col || COL.texto; x.fill(); x.restore();
  }

  function marcas(x, cx, cy, r, ini, fin, n, cadaLargo) {
    x.strokeStyle = COL.texto;
    for (let i = 0; i <= n; i++) {
      const a = ini + ((fin - ini) * i) / n - Math.PI / 2;
      const l = i % cadaLargo === 0 ? 0.14 : 0.07;
      x.lineWidth = i % cadaLargo === 0 ? 2 : 1;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
      x.lineTo(cx + Math.cos(a) * r * (0.86 - l), cy + Math.sin(a) * r * (0.86 - l)); x.stroke();
    }
  }

  function arco(x, cx, cy, r, a, b, col, ancho) {
    x.strokeStyle = col; x.lineWidth = ancho;
    x.beginPath(); x.arc(cx, cy, r, a - Math.PI / 2, b - Math.PI / 2); x.stroke();
  }

  function velocidad(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    const K = (v) => -2.5 + (Math.min(v, 180) / 180) * 5;
    arco(x, cx, cy, r * 0.84, K(46), K(85), COL.texto, 3);
    arco(x, cx, cy, r * 0.79, K(51), K(125), COL.verde, 4);
    arco(x, cx, cy, r * 0.79, K(125), K(155), COL.oro, 4);
    arco(x, cx, cy, r * 0.79, K(155), K(180), COL.rojo, 4);
    for (let v = 0; v <= 160; v += 40) {
      const a = K(v) - Math.PI / 2;
      rotulo(x, String(v), cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56, r * 0.17);
    }
    rotulo(x, 'NUDOS', cx, cy + r * 0.3, r * 0.13, COL.suave);
    rotulo(x, String(Math.round(t.nudos)), cx, cy + r * 0.55, r * 0.26, COL.oro);
    aguja(x, cx, cy, K(t.nudos), r * 0.78, r * 0.05);
  }

  function actitud(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    x.save();
    x.beginPath(); x.arc(cx, cy, r * 0.88, 0, TAU); x.clip();
    x.translate(cx, cy); x.rotate(-t.alabeo);
    const esc = r * 0.03, dy = ((t.cabeceo * 180) / Math.PI) * esc;
    x.fillStyle = COL.cielo; x.fillRect(-r * 2, -r * 3 + dy, r * 4, r * 3);
    x.fillStyle = COL.suelo; x.fillRect(-r * 2, dy, r * 4, r * 3);
    x.strokeStyle = COL.texto; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-r * 2, dy); x.lineTo(r * 2, dy); x.stroke();
    x.lineWidth = 1.2;
    for (let g = -30; g <= 30; g += 10) {
      if (!g) continue;
      const y = dy - g * esc, l = r * 0.26;
      x.beginPath(); x.moveTo(-l, y); x.lineTo(l, y); x.stroke();
    }
    x.restore();
    x.strokeStyle = COL.oro; x.lineWidth = 4;
    x.beginPath();
    x.moveTo(cx - r * 0.5, cy); x.lineTo(cx - r * 0.16, cy); x.lineTo(cx - r * 0.08, cy + r * 0.1);
    x.moveTo(cx + r * 0.5, cy); x.lineTo(cx + r * 0.16, cy); x.lineTo(cx + r * 0.08, cy + r * 0.1);
    x.stroke();
    x.beginPath(); x.arc(cx, cy, 3, 0, TAU); x.fillStyle = COL.oro; x.fill();
  }

  function altimetro(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    marcas(x, cx, cy, r, 0, TAU, 50, 5);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      rotulo(x, String(i), cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56, r * 0.18);
    }
    rotulo(x, Math.round(t.pies).toLocaleString('es-ES') + ' ft', cx, cy + r * 0.34, r * 0.17, COL.oro);
    aguja(x, cx, cy, (t.pies / 10000) * TAU, r * 0.5, r * 0.08, COL.coral);
    aguja(x, cx, cy, (t.pies / 1000) * TAU, r * 0.8, r * 0.05);
  }

  function variometro(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    const K = (f) => -Math.PI / 2 + (Math.max(-2000, Math.min(2000, f)) / 2000) * 2.6;
    for (const f of [-2000, -1000, 0, 1000, 2000]) {
      const a = K(f) - Math.PI / 2;
      rotulo(x, String(Math.abs(f) / 100), cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58, r * 0.17);
    }
    rotulo(x, 'PIES/MIN', cx - r * 0.06, cy - r * 0.2, r * 0.11, COL.suave);
    rotulo(x, (t.fpm > 0 ? '+' : '') + Math.round(t.fpm / 10) * 10, cx + r * 0.14, cy + r * 0.3, r * 0.19, COL.oro);
    aguja(x, cx, cy, K(t.fpm), r * 0.78, r * 0.05);
  }

  function rumbo(x, cx, cy, r, t, objetivo) {
    esfera(x, cx, cy, r);
    x.save(); x.translate(cx, cy); x.rotate((-t.rumbo * Math.PI) / 180);
    const puntos = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };
    x.strokeStyle = COL.texto;
    for (let g = 0; g < 360; g += 10) {
      x.save(); x.rotate((g * Math.PI) / 180);
      x.lineWidth = g % 30 ? 1 : 2;
      x.beginPath(); x.moveTo(0, -r * 0.86); x.lineTo(0, -r * (g % 30 ? 0.79 : 0.74)); x.stroke();
      if (g % 30 === 0) rotulo(x, puntos[g] || String(g / 10), 0, -r * 0.6, r * 0.17, puntos[g] ? COL.oro : COL.texto);
      x.restore();
    }
    if (objetivo !== null) {
      x.save(); x.rotate((objetivo * Math.PI) / 180);
      x.beginPath(); x.moveTo(0, -r * 0.92); x.lineTo(-r * 0.1, -r * 0.74); x.lineTo(r * 0.1, -r * 0.74); x.closePath();
      x.fillStyle = COL.coral; x.fill(); x.restore();
    }
    x.restore();
    x.beginPath(); x.moveTo(cx, cy - r * 0.32); x.lineTo(cx - r * 0.18, cy + r * 0.2); x.lineTo(cx, cy + r * 0.1); x.lineTo(cx + r * 0.18, cy + r * 0.2); x.closePath();
    x.fillStyle = COL.oro; x.fill();
    rotulo(x, String(Math.round(t.rumbo) % 360).padStart(3, '0') + '°', cx, cy + r * 0.48, r * 0.18);
  }

  function barra(x, bx, by, ancho, alto, valor, col, etiqueta, texto, tam) {
    rotulo(x, etiqueta, bx + ancho / 2, by - tam * 0.8, tam, COL.suave);
    x.fillStyle = COL.cara; x.fillRect(bx, by, ancho, alto);
    const h = alto * Math.max(0, Math.min(1, valor));
    x.fillStyle = col; x.fillRect(bx, by + alto - h, ancho, h);
    rotulo(x, texto, bx + ancho / 2, by + alto + tam * 0.95, tam, COL.texto);
  }

  function dibujar(x, ancho, alto, t, e, mando, objetivo) {
    x.clearRect(0, 0, ancho, alto);
    x.fillStyle = COL.panel;
    x.beginPath();
    x.moveTo(0, alto); x.lineTo(0, 16); x.lineTo(16, 0); x.lineTo(ancho - 16, 0); x.lineTo(ancho, 16); x.lineTo(ancho, alto); x.closePath();
    x.fill();
    const pasoG = Math.min(alto * 1.02, ancho / 7.4);
    const r = pasoG * 0.44, cy = alto / 2;
    const totalG = pasoG * 5 + pasoG * 1.75;
    let cx = (ancho - totalG) / 2 + pasoG / 2;
    velocidad(x, cx, cy, r, t); cx += pasoG;
    actitud(x, cx, cy, r, t); cx += pasoG;
    altimetro(x, cx, cy, r, t); cx += pasoG;
    rumbo(x, cx, cy, r, t, objetivo); cx += pasoG;
    variometro(x, cx, cy, r, t); cx += pasoG * 0.62;

    const tam = Math.max(9, r * 0.17), altoB = alto * 0.5, anchoB = pasoG * 0.2, by = alto * 0.25, sep = pasoG * 0.3;
    barra(x, cx, by, anchoB, altoB, e.acelerador, COL.coral, 'GAS', Math.round(e.acelerador * 100) + '%', tam);
    barra(x, cx + sep, by, anchoB, altoB, e.motor, COL.oro, 'RPM', String(Math.round(t.rpm / 10) * 10), tam);
    barra(x, cx + sep * 2, by, anchoB, altoB, e.combustible / 150, e.combustible < 15 ? COL.rojo : COL.verde, 'FUEL', Math.round(e.combustible) + ' L', tam);
    barra(x, cx + sep * 3, by, anchoB, altoB, e.flaps, COL.texto, 'FLAPS', Math.round(e.flaps * 30) + '°', tam);
    barra(x, cx + sep * 4, by, anchoB, altoB, (mando.trim + 0.6) / 1.2, COL.cielo, 'TRIM', (mando.trim > 0 ? '+' : '') + Math.round(mando.trim * 100), tam);
  }

  window.Instrumentos = { dibujar };
})();
