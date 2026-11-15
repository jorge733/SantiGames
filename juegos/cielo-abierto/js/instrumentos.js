// Panel de instrumentos dibujado en un lienzo 2D, en unidades aeronáuticas.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const COL = { panel: '#1b2028', bisel: '#33415f', cara: '#0b0f17', texto: '#f5f1e6', suave: '#9fb0cc', coral: '#ff7a45', oro: '#f7c35f', verde: '#6fd27a', rojo: '#ff5151', cielo: '#3f9fe0', suelo: '#a9713f' };

  // Esfera de reloj de avión: bisel metálico con tornillos, fondo negro mate y luego (en cristal()) el reflejo del vidrio.
  function esfera(x, cx, cy, r) {
    const R = r * 1.06;
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = r * 0.18; x.shadowOffsetY = r * 0.05;
    x.beginPath(); x.arc(cx, cy, R, 0, TAU);
    const bisel = x.createLinearGradient(cx, cy - R, cx, cy + R);
    bisel.addColorStop(0, '#5d6678'); bisel.addColorStop(0.5, '#2a3140'); bisel.addColorStop(1, '#151a24');
    x.fillStyle = bisel; x.fill();
    x.restore();
    x.beginPath(); x.arc(cx, cy, r * 0.97, 0, TAU);
    x.fillStyle = '#0b0f17'; x.fill();
    x.beginPath(); x.arc(cx, cy, r * 0.92, 0, TAU);
    const cara = x.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r * 0.92);
    cara.addColorStop(0, '#1b2230'); cara.addColorStop(1, '#0c1018');
    x.fillStyle = cara; x.fill();
    // Tornillos del bisel.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, tx = cx + Math.cos(a) * R * 1.02, ty = cy + Math.sin(a) * R * 1.02;
      if (Math.abs(Math.cos(a) * R * 1.02) > r * 1.2) continue;
      x.beginPath(); x.arc(tx, ty, r * 0.045, 0, TAU);
      x.fillStyle = '#8a93a5'; x.fill();
    }
  }

  function cristal(x, cx, cy, r) {
    x.save();
    x.beginPath(); x.arc(cx, cy, r * 0.92, 0, TAU); x.clip();
    const brillo = x.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.3);
    brillo.addColorStop(0, 'rgba(255,255,255,0.13)'); brillo.addColorStop(0.45, 'rgba(255,255,255,0.03)'); brillo.addColorStop(0.46, 'rgba(255,255,255,0)');
    x.fillStyle = brillo; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.restore();
    x.beginPath(); x.arc(cx, cy, r * 0.92, 0, TAU);
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = Math.max(1, r * 0.03); x.stroke();
  }

  function rotulo(x, t, cx, cy, tam, col) {
    x.fillStyle = col || COL.texto;
    x.font = `600 ${Math.round(tam)}px system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(t, cx, cy);
  }

  // Ventanita con la lectura digital, dibujada encima de las agujas para que siempre se lea.
  function lectura(x, texto, cx, cy, tam, col) {
    x.font = `700 ${Math.round(tam)}px system-ui, sans-serif`;
    const w = x.measureText(texto).width + tam * 0.7, h = tam * 1.35;
    x.beginPath(); rectRedondo(x, cx - w / 2, cy - h / 2, w, h, tam * 0.3);
    x.fillStyle = 'rgba(5,8,13,0.92)'; x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1; x.stroke();
    x.fillStyle = col || COL.oro; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(texto, cx, cy + tam * 0.04);
  }

  function aguja(x, cx, cy, ang, largo, ancho, col) {
    x.save(); x.translate(cx, cy); x.rotate(ang);
    x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = ancho * 1.5; x.shadowOffsetX = ancho * 0.4; x.shadowOffsetY = ancho * 0.6;
    x.beginPath(); x.moveTo(-ancho, 0); x.lineTo(-ancho * 0.35, -largo); x.lineTo(ancho * 0.35, -largo); x.lineTo(ancho, 0); x.lineTo(0, largo * 0.16); x.closePath();
    x.fillStyle = col || COL.texto; x.fill();
    x.shadowColor = 'transparent';
    x.beginPath(); x.arc(0, 0, ancho * 1.3, 0, TAU); x.fillStyle = '#2a3140'; x.fill();
    x.restore();
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

  function velocidad(x, cx, cy, r, t, a) {
    esfera(x, cx, cy, r);
    const K = (v) => -2.5 + (Math.min(v, a.maximo) / a.maximo) * 5;
    arco(x, cx, cy, r * 0.84, K(a.flapsDesde), K(a.flapsHasta), COL.texto, 3);
    arco(x, cx, cy, r * 0.79, K(a.verdeDesde), K(a.amarilloDesde), COL.verde, 4);
    arco(x, cx, cy, r * 0.79, K(a.amarilloDesde), K(a.rojoDesde), COL.oro, 4);
    arco(x, cx, cy, r * 0.79, K(a.rojoDesde), K(a.maximo), COL.rojo, 4);
    const paso = a.maximo > 200 ? 50 : 40;
    for (let v = 0; v < a.maximo; v += paso) {
      const a = K(v) - Math.PI / 2;
      rotulo(x, String(v), cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56, r * 0.17);
    }
    rotulo(x, 'NUDOS', cx, cy + r * 0.3, r * 0.13, COL.suave);
    aguja(x, cx, cy, K(t.nudos), r * 0.78, r * 0.05);
    lectura(x, String(Math.round(t.nudos)), cx, cy + r * 0.56, r * 0.22);
    cristal(x, cx, cy, r);
  }

  function actitud(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    x.save();
    x.beginPath(); x.arc(cx, cy, r * 0.88, 0, TAU); x.clip();
    x.translate(cx, cy); x.rotate(-t.alabeo);
    const esc = r * 0.03, dy = ((t.cabeceo * 180) / Math.PI) * esc;
    const gc = x.createLinearGradient(0, dy - r * 1.4, 0, dy); gc.addColorStop(0, '#1f5fa8'); gc.addColorStop(1, '#5aa6e6');
    x.fillStyle = gc; x.fillRect(-r * 2, -r * 3 + dy, r * 4, r * 3);
    const gs = x.createLinearGradient(0, dy, 0, dy + r * 1.4); gs.addColorStop(0, '#9a6a3c'); gs.addColorStop(1, '#5a3a20');
    x.fillStyle = gs; x.fillRect(-r * 2, dy, r * 4, r * 3);
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
    cristal(x, cx, cy, r);
  }

  function altimetro(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    marcas(x, cx, cy, r, 0, TAU, 50, 5);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      rotulo(x, String(i), cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56, r * 0.18);
    }
    aguja(x, cx, cy, (t.pies / 10000) * TAU, r * 0.5, r * 0.08, COL.coral);
    aguja(x, cx, cy, (t.pies / 1000) * TAU, r * 0.8, r * 0.05);
    lectura(x, Math.round(t.pies).toLocaleString('es-ES') + ' ft', cx, cy + r * 0.36, r * 0.16);
    cristal(x, cx, cy, r);
  }

  function variometro(x, cx, cy, r, t) {
    esfera(x, cx, cy, r);
    const K = (f) => -Math.PI / 2 + (Math.max(-2000, Math.min(2000, f)) / 2000) * 2.6;
    for (const f of [-2000, -1000, 0, 1000, 2000]) {
      const a = K(f) - Math.PI / 2;
      rotulo(x, String(Math.abs(f) / 100), cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58, r * 0.17);
    }
    rotulo(x, 'PIES/MIN', cx - r * 0.06, cy - r * 0.2, r * 0.11, COL.suave);
    aguja(x, cx, cy, K(t.fpm), r * 0.78, r * 0.05);
    lectura(x, (t.fpm > 0 ? '+' : '') + Math.round(t.fpm / 10) * 10, cx + r * 0.1, cy + r * 0.34, r * 0.17);
    cristal(x, cx, cy, r);
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
    lectura(x, String(Math.round(t.rumbo) % 360).padStart(3, '0') + '°', cx, cy + r * 0.5, r * 0.16, COL.texto);
    cristal(x, cx, cy, r);
  }

  // roundRect no existe en navegadores algo antiguos (Safari 15): entonces, rectángulo normal.
  function rectRedondo(x, a, b, w, h, r) { if (x.roundRect) x.roundRect(a, b, w, h, Math.min(r, h / 2)); else x.rect(a, b, w, h); }

  function barra(x, bx, by, ancho, alto, valor, col, etiqueta, texto, tam) {
    rotulo(x, etiqueta, bx + ancho / 2, by - tam * 0.85, tam * 0.92, COL.suave);
    const rad = Math.min(ancho / 2, 6);
    x.beginPath(); rectRedondo(x, bx, by, ancho, alto, rad);
    x.fillStyle = '#0b0f17'; x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 1; x.stroke();
    const h = Math.max(0, (alto - 4) * Math.max(0, Math.min(1, valor)));
    if (h > 0) {
      x.save();
      x.beginPath(); rectRedondo(x, bx + 2, by + alto - 2 - h, ancho - 4, h, Math.max(1, rad - 2)); x.clip();
      const gr = x.createLinearGradient(bx, 0, bx + ancho, 0);
      gr.addColorStop(0, col); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      x.fillStyle = gr; x.fillRect(bx, by, ancho, alto);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(bx + 2, by + alto - 2 - h, (ancho - 4) * 0.35, h);
      x.restore();
    }
    rotulo(x, texto, bx + ancho / 2, by + alto + tam * 0.95, tam, COL.texto);
  }

  function dibujar(x, ancho, alto, t, e, mando, objetivo) {
    x.clearRect(0, 0, ancho, alto);
    // Panel de cabina: chapa gris antracita con un filo superior iluminado.
    const fondo = x.createLinearGradient(0, 0, 0, alto);
    fondo.addColorStop(0, '#2b313c'); fondo.addColorStop(0.08, '#20252e'); fondo.addColorStop(1, '#14181f');
    x.fillStyle = fondo;
    x.beginPath();
    x.moveTo(0, alto); x.lineTo(0, 14); x.quadraticCurveTo(0, 0, 14, 0); x.lineTo(ancho - 14, 0); x.quadraticCurveTo(ancho, 0, ancho, 14); x.lineTo(ancho, alto); x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(14, 0, ancho - 28, 1);
    const pasoG = Math.min(alto * 1.02, ancho / 7.4);
    const r = pasoG * 0.44, cy = alto / 2;
    const totalG = pasoG * 5 + pasoG * 1.75;
    let cx = (ancho - totalG) / 2 + pasoG / 2;
    velocidad(x, cx, cy, r, t, e.modelo.arcos); cx += pasoG;
    actitud(x, cx, cy, r, t); cx += pasoG;
    altimetro(x, cx, cy, r, t); cx += pasoG;
    rumbo(x, cx, cy, r, t, objetivo); cx += pasoG;
    variometro(x, cx, cy, r, t); cx += pasoG * 0.62;

    const tam = Math.max(9, r * 0.17), altoB = alto * 0.5, anchoB = pasoG * 0.2, by = alto * 0.25, sep = pasoG * 0.3;
    barra(x, cx, by, anchoB, altoB, e.acelerador, COL.coral, 'GAS', Math.round(e.acelerador * 100) + '%', tam);
    barra(x, cx + sep, by, anchoB, altoB, e.motor, COL.oro, 'RPM', String(Math.round(t.rpm / 10) * 10), tam);
    barra(x, cx + sep * 2, by, anchoB, altoB, e.combustible / e.modelo.combustible, e.combustible < e.modelo.combustible * 0.05 ? COL.rojo : COL.verde, 'FUEL', Math.round(e.combustible) + ' L', tam);
    barra(x, cx + sep * 3, by, anchoB, altoB, e.flaps, COL.texto, 'FLAPS', Math.round(e.flaps * 30) + '°', tam);
    barra(x, cx + sep * 4, by, anchoB, altoB, (mando.trim + 0.6) / 1.2, COL.cielo, 'TRIM', (mando.trim > 0 ? '+' : '') + Math.round(mando.trim * 100), tam);
  }

  window.Instrumentos = { dibujar };
})();
