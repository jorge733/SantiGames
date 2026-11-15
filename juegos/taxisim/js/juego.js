// TaxiSim: simulador de taxi con vista desde arriba.
// Secciones: ciudad, coches del tráfico, taxi, pasajeros, dibujo, interfaz y bucle principal.
(function () {
  'use strict';

  // ---------- Ajustes ----------
  const T = 96;            // tamaño de una casilla en píxeles del mundo
  const N = 37;            // casillas por lado
  const PASO = 4;          // cada 4 casillas hay una calle
  const RN = 10;           // cruces por lado
  const CARRIL = 24;       // distancia del centro de la calle al centro del carril
  const ACERA = 14;        // ancho de la acera
  const MUNDO = N * T;
  const CUADRA = PASO * T;
  const DURACION_TURNO = 300;   // segundos reales: de 08:00 a 20:00
  const N_TRAFICO = 26;
  const N_ESPERANDO = 3;
  const PRECIO_LITRO = 0.12;

  const MEJORAS = {
    motor: { nombre: 'Motor', desc: 'Más velocidad y aceleración', precios: [80, 180, 320] },
    tanque: { nombre: 'Tanque', desc: 'Más combustible por turno', precios: [50, 120, 220] },
    susp: { nombre: 'Suspensión', desc: 'Los choques molestan menos al pasajero', precios: [70, 150, 260] },
  };

  const CALLES_H = ['Av. del Mar', 'Los Aromos', 'Av. Libertad', 'Las Acacias', 'Av. Central', 'Los Pinos', 'Av. Andes', 'El Molino', 'Las Rosas', 'Av. del Sur'];
  const CALLES_V = ['Los Olmos', 'Av. Pacífico', 'San Martín', 'Las Palmas', 'Av. Volcán', 'El Roble', 'Los Cerezos', 'Av. Oriente', 'Las Lomas', 'El Bosque'];
  const NOMBRES = ['Sofía', 'Mateo', 'Valentina', 'Benjamín', 'Isidora', 'Tomás', 'Martina', 'Agustín', 'Florencia', 'Vicente', 'Josefa', 'Lucas', 'Antonia', 'Joaquín', 'Emilia', 'Maximiliano', 'Catalina', 'Diego', 'Trinidad', 'Gaspar'];
  const TIPOS = {
    normal: { paga: 1, prisa: 1, dureza: 1, etiqueta: '',
      hola: ['Buenas, ¿me lleva a {d}?', 'Hola, voy a {d}, por favor.', 'A {d}, cuando pueda.'] },
    apurado: { paga: 1.35, prisa: 0.75, dureza: 1.5, etiqueta: ' (apurado)',
      hola: ['¡Rápido, llego tarde! Voy a {d}.', '¡Por favor, apúrese! A {d}.'] },
    turista: { paga: 1.2, prisa: 1.4, dureza: 0.8, etiqueta: ' (turista)',
      hola: ['¡Hola! Primera vez en la ciudad. ¿Me lleva a {d}?', 'Quiero conocer {d}, ¿sí?'] },
  };
  const COLORES_ROPA = ['#ff7a45', '#86d3ef', '#3f9a62', '#b7a3cf', '#e94f6a', '#f7c35f', '#5b7bd6'];
  const COLORES_COCHE = ['#e94f6a', '#5b7bd6', '#f2f2f2', '#3f9a62', '#2b2f3a', '#9aa4b5', '#b7a3cf', '#7fc8d8', '#d9733f'];
  const COLORES_EDIF = ['#e9a96b', '#d97b5f', '#8fb3c9', '#b7a3cf', '#e3cf8f', '#9cc59a', '#c98f8f', '#a9b4c2', '#f0d7b0', '#7fa7b5'];

  // ---------- Utilidades ----------
  function semilla(s) {
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const azar = Math.random;
  const elegir = (lista, r = azar) => lista[Math.floor(r() * lista.length)];
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const dinero = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(n % 1 === 0 && Math.abs(n) >= 100 ? 0 : 2).replace(/\.00$/, '');
  const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];            // este, sur, oeste, norte
  const DER = (d) => [-DIR[d][1], DIR[d][0]];                 // lado derecho de la marcha

  // ---------- Ciudad ----------
  const CALLE = 0, EDIF = 1, PARQUE = 2, BENCINA = 3;
  const mapa = new Uint8Array(N * N);
  const deco = new Array(N * N);
  const esCalleIJ = (i, j) => i % PASO === 0 || j % PASO === 0;
  function tipo(i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return mapa[j * N + i];
  }
  const bencinas = [];

  (function crearCiudad() {
    const r = semilla(7331);
    const parques = new Set();
    while (parques.size < 8) {
      const bx = Math.floor(r() * 9), by = Math.floor(r() * 9);
      if (bx === 4 && by === 4) continue;
      parques.add(bx + ',' + by);
    }
    const lugaresBencina = [[1, 1], [6, 2], [2, 6], [7, 7], [4, 4]];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        if (esCalleIJ(i, j)) { mapa[k] = CALLE; continue; }
        const bx = Math.floor(i / PASO), by = Math.floor(j / PASO);
        if (parques.has(bx + ',' + by)) {
          mapa[k] = PARQUE;
          const arboles = [];
          for (let a = 0; a < 4; a++) arboles.push([18 + r() * 60, 18 + r() * 60, 9 + r() * 7]);
          deco[k] = { arboles };
        } else {
          mapa[k] = EDIF;
          deco[k] = { color: elegir(COLORES_EDIF, r), alto: 5 + r() * 12, aire: r() < 0.6, tanque: r() < 0.3, ax: r(), ay: r() };
        }
      }
    }
    for (const [bx, by] of lugaresBencina) {
      const i = bx * PASO + 2, j = by * PASO + 1;
      mapa[j * N + i] = BENCINA;
      bencinas.push({ i, j, x: i * T + T / 2, y: j * T + T / 2 });
    }
  })();

  // Rectángulo sólido de un edificio o parque (sin la acera que da a la calle).
  function rectSolido(i, j) {
    const x0 = i * T + (tipo(i - 1, j) === CALLE ? ACERA : 0);
    const y0 = j * T + (tipo(i, j - 1) === CALLE ? ACERA : 0);
    const x1 = (i + 1) * T - (tipo(i + 1, j) === CALLE ? ACERA : 0);
    const y1 = (j + 1) * T - (tipo(i, j + 1) === CALLE ? ACERA : 0);
    return [x0, y0, x1, y1];
  }
  function esSolido(x, y) {
    if (x < 0 || y < 0 || x >= MUNDO || y >= MUNDO) return true;
    const i = Math.floor(x / T), j = Math.floor(y / T);
    const t = tipo(i, j);
    if (t !== EDIF && t !== PARQUE) return false;
    const [x0, y0, x1, y1] = rectSolido(i, j);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }
  const nodo = (i, j) => [i * CUADRA + T / 2, j * CUADRA + T / 2];

  // Punto en la acera junto a una calle, con su descripción ("Av. Libertad, entre X e Y").
  function puntoAcera() {
    for (let n = 0; n < 500; n++) {
      const i = Math.floor(azar() * N), j = Math.floor(azar() * N);
      if (!esCalleIJ(i, j) || (i % PASO === 0 && j % PASO === 0)) continue;
      const lado = azar() < 0.5 ? -1 : 1;
      const desv = (azar() - 0.5) * 40;
      if (j % PASO === 0) {
        const t = tipo(i, j + lado);
        if (t !== EDIF && t !== PARQUE) continue;
        const c = Math.floor(i / PASO);
        return { x: i * T + T / 2 + desv, y: lado < 0 ? j * T - 6 : (j + 1) * T + 6,
          texto: CALLES_H[j / PASO] + ', entre ' + CALLES_V[c] + ' y ' + CALLES_V[c + 1] };
      }
      const t = tipo(i + lado, j);
      if (t !== EDIF && t !== PARQUE) continue;
      const f = Math.floor(j / PASO);
      return { x: lado < 0 ? i * T - 6 : (i + 1) * T + 6, y: j * T + T / 2 + desv,
        texto: CALLES_V[i / PASO] + ', entre ' + CALLES_H[f] + ' y ' + CALLES_H[f + 1] };
    }
    return { x: T / 2, y: T + 6, texto: CALLES_V[0] };
  }

  // ---------- Coches del tráfico ----------
  // Cada coche va de cruce en cruce siguiendo curvas de Bézier (rectas y giros).
  function bezier(p0, p1, p2, t) {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }
  function largoBezier(p0, p1, p2) {
    let l = 0, prev = p0;
    for (let k = 1; k <= 8; k++) { const p = bezier(p0, p1, p2, k / 8); l += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    return l;
  }
  function tramoRecto(c) {
    const [ax, ay] = nodo(c.ni, c.nj), d = DIR[c.dir], r = DER(c.dir);
    const bi = c.ni + d[0], bj = c.nj + d[1];
    const [bx, by] = nodo(bi, bj);
    const p0 = [ax + d[0] * T / 2 + r[0] * CARRIL, ay + d[1] * T / 2 + r[1] * CARRIL];
    const p2 = [bx - d[0] * T / 2 + r[0] * CARRIL, by - d[1] * T / 2 + r[1] * CARRIL];
    c.tramo = { p0, p1: [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2], p2, giro: false };
    c.tramo.largo = largoBezier(c.tramo.p0, c.tramo.p1, c.tramo.p2);
    c.s = 0;
    c.ni = bi; c.nj = bj;
  }
  function tramoGiro(c) {
    const opciones = [];
    for (let d = 0; d < 4; d++) {
      if (d === (c.dir + 2) % 4) continue;
      const i = c.ni + DIR[d][0], j = c.nj + DIR[d][1];
      if (i < 0 || j < 0 || i >= RN || j >= RN) continue;
      opciones.push(d);
    }
    let d2 = opciones.includes(c.dir) && azar() < 0.5 ? c.dir : elegir(opciones);
    const [nx, ny] = nodo(c.ni, c.nj), d = DIR[c.dir], r1 = DER(c.dir), e = DIR[d2], r2 = DER(d2);
    const p0 = [nx - d[0] * T / 2 + r1[0] * CARRIL, ny - d[1] * T / 2 + r1[1] * CARRIL];
    const p2 = [nx + e[0] * T / 2 + r2[0] * CARRIL, ny + e[1] * T / 2 + r2[1] * CARRIL];
    const p1 = d2 === c.dir ? [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2] : [nx + (r1[0] + r2[0]) * CARRIL, ny + (r1[1] + r2[1]) * CARRIL];
    c.tramo = { p0, p1, p2, giro: d2 !== c.dir };
    c.tramo.largo = largoBezier(p0, p1, p2);
    c.s = 0;
    c.dir = d2;
  }
  function crearTrafico() {
    const lista = [];
    let intentos = 0;
    while (lista.length < N_TRAFICO && intentos++ < 500) {
      const c = { ni: Math.floor(azar() * RN), nj: Math.floor(azar() * RN), dir: Math.floor(azar() * 4),
        vel: 0, velMax: 140 + azar() * 70, color: elegir(COLORES_COCHE), espera: 0, quieto: 0, fantasma: 0, x: 0, y: 0, ang: 0 };
      const i2 = c.ni + DIR[c.dir][0], j2 = c.nj + DIR[c.dir][1];
      if (i2 < 0 || j2 < 0 || i2 >= RN || j2 >= RN) continue;
      tramoRecto(c);
      c.s = azar() * c.tramo.largo;
      colocar(c);
      if (lista.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 120)) continue;
      if (Math.hypot(c.x - taxi.x, c.y - taxi.y) < 250) continue;
      c.vel = c.velMax;
      lista.push(c);
    }
    return lista;
  }
  function colocar(c) {
    const tr = c.tramo, t = limitar(c.s / tr.largo, 0, 1);
    const p = bezier(tr.p0, tr.p1, tr.p2, t);
    const dx = (1 - t) * (tr.p1[0] - tr.p0[0]) + t * (tr.p2[0] - tr.p1[0]);
    const dy = (1 - t) * (tr.p1[1] - tr.p0[1]) + t * (tr.p2[1] - tr.p1[1]);
    c.x = p[0]; c.y = p[1];
    c.ang = Math.atan2(dy, dx);
  }
  function moverTrafico(dt) {
    for (const c of trafico) {
      const hx = Math.cos(c.ang), hy = Math.sin(c.ang);
      let libre = Infinity;
      if (c.fantasma <= 0) {
        const mirar = (ox, oy, umbralLat) => {
          const dx = ox - c.x, dy = oy - c.y;
          const delante = dx * hx + dy * hy, lado = Math.abs(-dx * hy + dy * hx);
          if (delante > 0 && delante < 90 && lado < umbralLat) libre = Math.min(libre, delante);
        };
        for (const o of trafico) {
          if (o === c) continue;
          if (Math.cos(o.ang - c.ang) > 0.3 || Math.hypot(o.x - c.x, o.y - c.y) < 40) mirar(o.x, o.y, 18);
        }
        mirar(taxi.x, taxi.y, 22);
      }
      let objetivo = c.velMax * (c.tramo.giro ? 0.5 : 1);
      if (libre < 90) objetivo = Math.min(objetivo, Math.max(0, (libre - 42) * 3));
      if (c.espera > 0) { c.espera -= dt; objetivo = 0; }
      c.vel += limitar(objetivo - c.vel, -420 * dt, 160 * dt);
      if (c.vel < 5) c.quieto += dt; else c.quieto = 0;
      if (c.quieto > 4) { c.fantasma = 1.5; c.quieto = 0; }
      if (c.fantasma > 0) c.fantasma -= dt;
      c.s += c.vel * dt;
      while (c.s >= c.tramo.largo) {
        const sobra = c.s - c.tramo.largo;
        if (c.enCruce) { c.enCruce = false; tramoRecto(c); }
        else { c.enCruce = true; tramoGiro(c); }
        c.s = sobra;
      }
      colocar(c);
    }
  }

  // ---------- Estado de juego ----------
  let guardado = { ahorros: 0, mejor: null, turnos: 0, motor: 0, tanque: 0, susp: 0 };
  try { Object.assign(guardado, JSON.parse(localStorage.getItem('taxisim') || '{}')); } catch (e) { /* sin almacenamiento */ }
  function guardar() { try { localStorage.setItem('taxisim', JSON.stringify(guardado)); } catch (e) { /* sin almacenamiento */ } }

  const taxi = { x: 0, y: 0, ang: 0, v: 0, fuel: 100, cap: 100 };
  let trafico = [];
  let esperando = [];
  let viaje = null;       // pasajero a bordo
  let subiendo = null;    // pasajero caminando hacia el taxi
  let modo = 'menu';
  let turno = null;
  let camara = { x: 0, y: 0, temblor: 0 };
  let enfriarChoque = 0;
  let mensajeT = 0;
  let grua = 0;

  const teclas = { gas: false, freno: false, izq: false, der: false, mano: false };

  function nuevoTurno() {
    taxi.cap = 100 + 35 * guardado.tanque;
    taxi.fuel = taxi.cap;
    const [nx, ny] = nodo(4, 5);
    taxi.x = nx + CUADRA / 2; taxi.y = ny + CARRIL; taxi.ang = 0; taxi.v = 0;
    camara.x = taxi.x; camara.y = taxi.y;
    trafico = crearTrafico();
    esperando = [];
    viaje = null; subiendo = null; grua = 0;
    turno = { t: 0, caja: 0, bruto: 0, propinas: 0, combustible: 0, danos: 0, viajes: 0, estrellas: [] };
    while (esperando.length < N_ESPERANDO) esperando.push(nuevoPasajero());
    modo = 'jugando';
    mostrar(null);
    hud.hidden = false;
    lienzo.focus();
    decir('¡Empieza tu turno! Busca pasajeros: son los puntos verdes del mapa.');
  }

  function nuevoPasajero() {
    let p;
    for (let n = 0; n < 50; n++) {
      p = puntoAcera();
      if (Math.hypot(p.x - taxi.x, p.y - taxi.y) < 350) continue;
      if (esperando.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 400)) continue;
      break;
    }
    const r = azar();
    p.tipo = r < 0.2 ? 'apurado' : r < 0.35 ? 'turista' : 'normal';
    p.nombre = elegir(NOMBRES);
    p.ropa = elegir(COLORES_ROPA);
    p.fase = azar() * 6;
    return p;
  }

  // ---------- Física del taxi ----------
  function esquinas(x, y, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), l = 22, a = 11;
    return [[l, a], [l, -a], [-l, a], [-l, -a], [l, 0], [-l, 0]].map(([u, w]) => [x + u * c - w * s, y + u * s + w * c]);
  }
  const choca = (x, y, ang) => esquinas(x, y, ang).some(([px, py]) => esSolido(px, py));

  function moverTaxi(dt) {
    const m = guardado.motor;
    const velMax = 470 * (1 + 0.1 * m), acel = 250 * (1 + 0.15 * m);
    let gas = teclas.gas, freno = teclas.freno;
    if (taxi.fuel <= 0 || grua > 0) { gas = false; }
    if (gas) taxi.v += (taxi.v < 0 ? 520 : acel * (1 - Math.max(0, taxi.v) / velMax * 0.6)) * dt;
    if (freno) {
      if (taxi.v > 8) taxi.v -= 560 * dt;
      else taxi.v = Math.max(-150, taxi.v - 200 * dt);
    }
    if (teclas.mano) taxi.v -= Math.sign(taxi.v) * Math.min(Math.abs(taxi.v), 700 * dt);
    if (!gas && !freno) taxi.v -= Math.sign(taxi.v) * Math.min(Math.abs(taxi.v), (60 + Math.abs(taxi.v) * 0.4) * dt);
    taxi.v = limitar(taxi.v, -150, velMax);

    const giro = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
    const factor = limitar(taxi.v / 140, -1, 1) * (1 - Math.min(0.45, Math.abs(taxi.v) / velMax * 0.45));
    const nuevoAng = taxi.ang + giro * 2.7 * factor * dt;
    const nx = taxi.x + Math.cos(nuevoAng) * taxi.v * dt;
    const ny = taxi.y + Math.sin(nuevoAng) * taxi.v * dt;

    if (!choca(nx, ny, nuevoAng)) { taxi.x = nx; taxi.y = ny; taxi.ang = nuevoAng; }
    else {
      const fuerte = Math.abs(taxi.v) > 140;
      if (!choca(nx, taxi.y, nuevoAng)) { taxi.x = nx; taxi.ang = nuevoAng; taxi.v *= 0.8; }
      else if (!choca(taxi.x, ny, nuevoAng)) { taxi.y = ny; taxi.ang = nuevoAng; taxi.v *= 0.8; }
      else { if (!choca(taxi.x, taxi.y, nuevoAng)) taxi.ang = nuevoAng; taxi.v *= -0.25; }
      if (fuerte) choque();
    }

    // Choques con el tráfico
    for (const c of trafico) {
      const dx = taxi.x - c.x, dy = taxi.y - c.y, d = Math.hypot(dx, dy);
      if (d < 34 && d > 0.01) {
        const nxv = dx / d, nyv = dy / d;
        const px = taxi.x + nxv * (34 - d), py = taxi.y + nyv * (34 - d);
        if (!choca(px, py, taxi.ang)) { taxi.x = px; taxi.y = py; }
        const rel = Math.hypot(Math.cos(taxi.ang) * taxi.v - Math.cos(c.ang) * c.vel, Math.sin(taxi.ang) * taxi.v - Math.sin(c.ang) * c.vel);
        if (rel > 90) choque();
        taxi.v *= 0.5;
        c.espera = 1.2;
      }
    }

    // Combustible
    const consumo = (gas ? 0.42 : 0.04) * (1 + 0.1 * m) * dt;
    if (modo === 'jugando') taxi.fuel = Math.max(0, taxi.fuel - consumo);
  }

  function choque() {
    if (enfriarChoque > 0) return;
    enfriarChoque = 0.9;
    camara.temblor = 0.35;
    sonarChoque();
    if (viaje) {
      viaje.golpes++;
      decir(elegir(['¡Oiga, cuidado!', '¡Ay! ¿Dónde aprendió a manejar?', '¡Más despacio, por favor!']));
    } else {
      turno.danos += 3;
      decir('¡Choque! Reparar la abolladura cuesta $3.');
    }
  }

  // ---------- Pasajeros y estaciones ----------
  function actualizarPasajeros(dt) {
    const lento = Math.abs(taxi.v) < 28;
    if (subiendo) {
      subiendo.t += dt;
      const k = Math.min(1, subiendo.t / 0.7);
      subiendo.px = subiendo.p.x + (taxi.x - subiendo.p.x) * k;
      subiendo.py = subiendo.p.y + (taxi.y - subiendo.p.y) * k;
      if (k >= 1) {
        const p = subiendo.p;
        let destino;
        for (let n = 0; n < 60; n++) {
          destino = puntoAcera();
          const md = Math.abs(destino.x - p.x) + Math.abs(destino.y - p.y);
          if (md > 900 && md < 2800) break;
        }
        const md = Math.abs(destino.x - p.x) + Math.abs(destino.y - p.y);
        const tp = TIPOS[p.tipo];
        viaje = { p, destino, dist: 0, t: 0, golpes: 0, est: (md / 210 + 7) * tp.prisa };
        decir(p.nombre + ': «' + elegir(tp.hola).replace('{d}', destino.texto) + '»', 4);
        sonarDing(660);
        subiendo = null;
      }
      return;
    }
    if (!viaje) {
      for (let k = 0; k < esperando.length; k++) {
        const p = esperando[k];
        if (Math.hypot(p.x - taxi.x, p.y - taxi.y) < 56 && lento) {
          esperando.splice(k, 1);
          subiendo = { p, t: 0, px: p.x, py: p.y };
          esperando.push(nuevoPasajero());
          return;
        }
      }
      return;
    }
    viaje.t += dt;
    viaje.dist += Math.abs(taxi.v) * dt;
    if (Math.hypot(viaje.destino.x - taxi.x, viaje.destino.y - taxi.y) < 56 && lento) {
      terminarViaje(false);
    } else if (viaje.t > viaje.est * 2.4 + 15) {
      terminarViaje(true);
    }
  }

  function tarifa() {
    if (!viaje) return 0;
    return (3 + viaje.dist / CUADRA * 1.1) * TIPOS[viaje.p.tipo].paga;
  }

  function terminarViaje(abandono) {
    const tp = TIPOS[viaje.p.tipo];
    if (abandono) {
      turno.estrellas.push(1);
      decir(viaje.p.nombre + ': «¡Me bajo aquí, esto es eterno!» No te paga.', 3.5);
      sonarDing(220);
      viaje = null;
      return;
    }
    const tarde = Math.max(0, (viaje.t - viaje.est) / viaje.est);
    let est = 5 - viaje.golpes * 0.8 * (1 - 0.25 * guardado.susp) * tp.dureza - tarde * 3 * tp.dureza;
    est = limitar(Math.round(est * 2) / 2, 1, 5);
    let pago = tarifa();
    if (est < 2) pago *= 0.7;
    const propina = est > 3 ? pago * 0.1 * (est - 3) * (tp.prisa < 1 ? 1.5 : 1) : 0;
    pago = Math.round(pago * 100) / 100;
    const prop = Math.round(propina * 100) / 100;
    turno.caja += pago + prop;
    turno.bruto += pago;
    turno.propinas += prop;
    turno.viajes++;
    turno.estrellas.push(est);
    const frases = est >= 4.5 ? ['¡Excelente viaje, gracias!', '¡Qué buen conductor!', '¡Llegamos justo a tiempo!']
      : est >= 3 ? ['Gracias, buen viaje.', 'Bien, gracias.'] : ['Uf, por fin llegamos…', 'No vuelvo a tomar este taxi.'];
    decir(viaje.p.nombre + ': «' + elegir(frases) + '» ' + estrellasTexto(est) + ' · ' + dinero(pago) + (prop ? ' + propina ' + dinero(prop) : ''), 3.5);
    sonarCaja();
    viaje = null;
  }

  function estrellasTexto(e) {
    const llenas = Math.floor(e);
    return '★'.repeat(llenas) + (e - llenas >= 0.5 ? '½' : '') ;
  }

  function cargarCombustible(dt) {
    if (Math.abs(taxi.v) > 20 || taxi.fuel >= taxi.cap) return false;
    const b = bencinas.find((s) => Math.abs(s.x - taxi.x) < T / 2 && Math.abs(s.y - taxi.y) < T / 2);
    if (!b) return false;
    const litros = Math.min(taxi.cap - taxi.fuel, 30 * dt);
    taxi.fuel += litros;
    turno.combustible += litros * PRECIO_LITRO;
    turno.caja -= litros * PRECIO_LITRO;
    return true;
  }

  function revisarGrua(dt) {
    if (taxi.fuel > 0) return;
    if (grua === 0) { grua = 2.5; decir('¡Sin combustible! Llamas a la grúa: cuesta $15.', 3); }
    grua -= dt;
    if (grua <= 0) {
      let mejor = bencinas[0];
      for (const b of bencinas) if (Math.hypot(b.x - taxi.x, b.y - taxi.y) < Math.hypot(mejor.x - taxi.x, mejor.y - taxi.y)) mejor = b;
      // la grúa te deja en la calle frente a la estación, con el tanque a un 30 %
      taxi.x = mejor.x; taxi.y = mejor.j * T - CARRIL; taxi.ang = 0; taxi.v = 0;
      taxi.fuel = taxi.cap * 0.3;
      turno.danos += 15; turno.caja -= 15;
      grua = 0;
      camara.x = taxi.x; camara.y = taxi.y;
    }
  }

  // ---------- Dibujo ----------
  const lienzo = document.getElementById('escena');
  const ctx = lienzo.getContext('2d');
  const mini = document.getElementById('minimapa');
  const mctx = mini.getContext('2d');
  const noche = document.createElement('canvas');
  const nctx = noche.getContext('2d');
  let W = 0, H = 0, DPR = 1, zoom = 1;
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };

  function redimensionar() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    lienzo.width = Math.round(W * DPR); lienzo.height = Math.round(H * DPR);
    noche.width = Math.round(W / 2); noche.height = Math.round(H / 2);
    zoom = limitar(Math.min(W, H) / 640, 0.55, 1.3);
    const ms = mini.clientWidth || 150;
    mini.width = Math.round(ms * DPR); mini.height = Math.round(ms * DPR);
  }
  window.addEventListener('resize', redimensionar);

  function dibujarSuelo(i, j) {
    const x = i * T, y = j * T, t = tipo(i, j);
    if (t === CALLE) {
      ctx.fillStyle = '#4b505d';
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      const h = j % PASO === 0, v = i % PASO === 0;
      if (h && v) return;
      ctx.fillStyle = '#e9e4d6';
      if (h) {
        for (let k = 6; k < T; k += 32) ctx.fillRect(x + k, y + T / 2 - 1.5, 18, 3);
        if (i % PASO === 1) for (let k = 8; k < T - 4; k += 12) ctx.fillRect(x + 4, y + k, 14, 6);
        if (i % PASO === 3) for (let k = 8; k < T - 4; k += 12) ctx.fillRect(x + T - 18, y + k, 14, 6);
      } else {
        for (let k = 6; k < T; k += 32) ctx.fillRect(x + T / 2 - 1.5, y + k, 3, 18);
        if (j % PASO === 1) for (let k = 8; k < T - 4; k += 12) ctx.fillRect(x + k, y + 4, 6, 14);
        if (j % PASO === 3) for (let k = 8; k < T - 4; k += 12) ctx.fillRect(x + k, y + T - 18, 6, 14);
      }
      return;
    }
    // acera
    ctx.fillStyle = '#d8cfbd';
    ctx.fillRect(x, y, T + 0.5, T + 0.5);
    ctx.fillStyle = '#b9ae98';
    if (tipo(i - 1, j) === CALLE) ctx.fillRect(x, y, 3, T);
    if (tipo(i + 1, j) === CALLE) ctx.fillRect(x + T - 3, y, 3, T);
    if (tipo(i, j - 1) === CALLE) ctx.fillRect(x, y, T, 3);
    if (tipo(i, j + 1) === CALLE) ctx.fillRect(x, y + T - 3, T, 3);
    if (t === PARQUE) {
      const [x0, y0, x1, y1] = rectSolido(i, j);
      ctx.fillStyle = '#7fbf6a';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    } else if (t === BENCINA) {
      ctx.fillStyle = '#9ea3ad';
      ctx.fillRect(x + 6, y + 6, T - 12, T - 6);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(x + 22, y + 40, 12, 22); ctx.fillRect(x + 62, y + 40, 12, 22);
    }
  }

  function dibujarAlto(i, j) {
    const t = tipo(i, j), k = j * N + i;
    if (t === EDIF) {
      const d = deco[k];
      let [x0, y0, x1, y1] = rectSolido(i, j);
      x0 += 3; y0 += 3; x1 -= 3; y1 -= 3;
      ctx.fillStyle = 'rgba(20,25,40,0.22)';
      ctx.fillRect(x0 + d.alto, y0 + d.alto, x1 - x0, y1 - y0);
      ctx.fillStyle = d.color;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
      if (d.aire) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x0 + 10 + d.ax * (x1 - x0 - 36), y0 + 10 + d.ay * (y1 - y0 - 34), 16, 14); }
      if (d.tanque) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(x1 - 18, y1 - 18, 8, 0, 7); ctx.fill(); }
    } else if (t === PARQUE) {
      for (const [ax, ay, r] of deco[k].arboles) {
        ctx.fillStyle = 'rgba(20,40,20,0.25)';
        ctx.beginPath(); ctx.arc(i * T + ax + 4, j * T + ay + 4, r, 0, 7); ctx.fill();
        ctx.fillStyle = '#3f8a4e';
        ctx.beginPath(); ctx.arc(i * T + ax, j * T + ay, r, 0, 7); ctx.fill();
        ctx.fillStyle = '#58a862';
        ctx.beginPath(); ctx.arc(i * T + ax - r * 0.3, j * T + ay - r * 0.3, r * 0.5, 0, 7); ctx.fill();
      }
    } else if (t === BENCINA) {
      const x = i * T, y = j * T;
      ctx.fillStyle = 'rgba(20,25,40,0.2)'; ctx.fillRect(x + 18, y + 22, T - 26, 48);
      ctx.fillStyle = '#e94f6a'; ctx.fillRect(x + 12, y + 16, T - 24, 46);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 12, y + 34, T - 24, 9);
      ctx.fillStyle = '#e94f6a'; ctx.font = '800 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('COMBUSTIBLE', x + T / 2, y + 39);
    }
  }

  function dibujarCoche(x, y, ang, color, esTaxi) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(10,15,30,0.3)';
    ctx.fillRect(-21, -9, 46, 24);
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(-16, -12, 9, 24); ctx.fillRect(8, -12, 9, 24);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-22, -10.5, 44, 21, 6); ctx.fill();
    ctx.fillStyle = 'rgba(30,45,75,0.85)';
    ctx.fillRect(4, -8, 8, 16); ctx.fillRect(-15, -7.5, 5, 15);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-10, -8, 14, 16);
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(19, -8, 3, 4); ctx.fillRect(19, 4, 3, 4);
    ctx.fillStyle = '#c0283c'; ctx.fillRect(-22, -8, 2, 4); ctx.fillRect(-22, 4, 2, 4);
    if (esTaxi) {
      ctx.fillStyle = '#26304a';
      for (let k = 0; k < 5; k++) { ctx.fillRect(-12 + k * 5, k % 2 ? -10.5 : -8.5, 5, 2); ctx.fillRect(-12 + k * 5, k % 2 ? 8.5 : 6.5, 5, 2); }
      ctx.fillStyle = viaje ? '#9aa4b5' : '#ffef9a';
      ctx.fillRect(-6, -4, 7, 8);
      ctx.fillStyle = '#26304a'; ctx.font = '800 4.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.rotate(Math.PI / 2); ctx.fillText('TAXI', 0, 2.5); ctx.restore();
    }
    ctx.restore();
  }

  function dibujarPersona(x, y, ropa, saluda, tiempo) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 7, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ropa;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0c9a0';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    if (saluda) {
      const a = Math.sin(tiempo * 8) * 0.6 - 0.9;
      ctx.strokeStyle = ropa; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 5, y - 2); ctx.lineTo(x + 5 + Math.cos(a) * 9, y - 2 + Math.sin(a) * 9); ctx.stroke();
    }
  }

  function dibujarMarca(x, y, color, tiempo) {
    const r = 30 + Math.sin(tiempo * 4) * 4;
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.18; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function objetivoActual() {
    if (viaje) return { x: viaje.destino.x, y: viaje.destino.y, color: '#ff7a45' };
    if (taxi.fuel < taxi.cap * 0.2) {
      let mejor = bencinas[0];
      for (const b of bencinas) if (Math.hypot(b.x - taxi.x, b.y - taxi.y) < Math.hypot(mejor.x - taxi.x, mejor.y - taxi.y)) mejor = b;
      return { x: mejor.x, y: mejor.y, color: '#e94f6a', bencina: true };
    }
    let mejor = null, dm = Infinity;
    for (const p of esperando) { const d = Math.hypot(p.x - taxi.x, p.y - taxi.y); if (d < dm) { dm = d; mejor = p; } }
    return mejor ? { x: mejor.x, y: mejor.y, color: '#4fd27a' } : null;
  }

  function dibujarFlecha(obj) {
    if (!obj) return;
    const dx = obj.x - taxi.x, dy = obj.y - taxi.y, d = Math.hypot(dx, dy);
    if (d < 90) return;
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(taxi.x + Math.cos(a) * 52, taxi.y + Math.sin(a) * 52);
    ctx.rotate(a);
    ctx.fillStyle = obj.color; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  function oscuridad() {
    if (!turno) return 0;
    const h = 8 + 12 * turno.t / DURACION_TURNO;
    return limitar((h - 17) / 3, 0, 1) * 0.6;
  }

  function dibujarNoche(a) {
    if (a <= 0) return;
    const w = noche.width, h = noche.height, z = zoom / 2;
    nctx.globalCompositeOperation = 'source-over';
    nctx.clearRect(0, 0, w, h);
    nctx.fillStyle = 'rgba(12,18,45,' + a + ')';
    nctx.fillRect(0, 0, w, h);
    nctx.globalCompositeOperation = 'destination-out';
    const aPantalla = (x, y) => [(x - camara.x) * z + w / 2, (y - camara.y) * z + h / 2];
    const luz = (x, y, r, fuerza) => {
      const [sx, sy] = aPantalla(x, y);
      if (sx < -r * z || sy < -r * z || sx > w + r * z || sy > h + r * z) return;
      const g = nctx.createRadialGradient(sx, sy, 0, sx, sy, r * z);
      g.addColorStop(0, 'rgba(0,0,0,' + fuerza + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = g; nctx.beginPath(); nctx.arc(sx, sy, r * z, 0, 7); nctx.fill();
    };
    for (let j = 0; j < RN; j++) for (let i = 0; i < RN; i++) { const [x, y] = nodo(i, j); luz(x, y, 110, 0.75); }
    const c = Math.cos(taxi.ang), s = Math.sin(taxi.ang);
    luz(taxi.x + c * 70, taxi.y + s * 70, 85, 0.95);
    luz(taxi.x + c * 140, taxi.y + s * 140, 70, 0.7);
    for (const o of trafico) luz(o.x + Math.cos(o.ang) * 45, o.y + Math.sin(o.ang) * 45, 45, 0.6);
    if (viaje) luz(viaje.destino.x, viaje.destino.y, 60, 0.9);
    for (const p of esperando) luz(p.x, p.y, 40, 0.8);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(noche, 0, 0, lienzo.width, lienzo.height);
  }

  let fondoMini = null;
  function crearFondoMini() {
    fondoMini = document.createElement('canvas');
    fondoMini.width = fondoMini.height = N * 4;
    const m = fondoMini.getContext('2d');
    const colores = { [CALLE]: '#8d94a5', [EDIF]: '#2b3a5c', [PARQUE]: '#3f7a4e', [BENCINA]: '#e94f6a' };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { m.fillStyle = colores[tipo(i, j)]; m.fillRect(i * 4, j * 4, 4, 4); }
  }

  function dibujarMini(tiempo) {
    if (!fondoMini) crearFondoMini();
    const w = mini.width, e = w / MUNDO;
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(fondoMini, 0, 0, w, w);
    const punto = (x, y, r, color) => { mctx.fillStyle = color; mctx.beginPath(); mctx.arc(x * e, y * e, r, 0, 7); mctx.fill(); };
    if (!viaje) for (const p of esperando) punto(p.x, p.y, 3.2 * DPR, '#4fd27a');
    if (viaje) punto(viaje.destino.x, viaje.destino.y, (3.5 + Math.sin(tiempo * 6)) * DPR, '#ff7a45');
    mctx.save();
    mctx.translate(taxi.x * e, taxi.y * e); mctx.rotate(taxi.ang);
    mctx.fillStyle = '#f7c35f'; mctx.strokeStyle = '#1f2a44'; mctx.lineWidth = DPR;
    mctx.beginPath(); mctx.moveTo(5 * DPR, 0); mctx.lineTo(-4 * DPR, -3.5 * DPR); mctx.lineTo(-4 * DPR, 3.5 * DPR); mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  function dibujar(tiempo) {
    const tx = camara.temblor > 0 ? (azar() - 0.5) * 10 * camara.temblor : 0;
    const ty = camara.temblor > 0 ? (azar() - 0.5) * 10 * camara.temblor : 0;
    const z = zoom * (1 - Math.min(0.18, Math.abs(taxi.v) / 2600));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#6f9a5e'; // campo alrededor de la ciudad
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - (camara.x + tx) * z), DPR * (H / 2 - (camara.y + ty) * z));
    const i0 = Math.max(0, Math.floor((camara.x - W / 2 / z) / T) - 1), i1 = Math.min(N - 1, Math.floor((camara.x + W / 2 / z) / T) + 1);
    const j0 = Math.max(0, Math.floor((camara.y - H / 2 / z) / T) - 1), j1 = Math.min(N - 1, Math.floor((camara.y + H / 2 / z) / T) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) dibujarSuelo(i, j);

    if (viaje) dibujarMarca(viaje.destino.x, viaje.destino.y, '#ff7a45', tiempo);
    for (const p of esperando) {
      if (!viaje && !subiendo) dibujarMarca(p.x, p.y, '#4fd27a', tiempo + p.fase);
      dibujarPersona(p.x, p.y, p.ropa, true, tiempo + p.fase);
    }
    if (subiendo) dibujarPersona(subiendo.px, subiendo.py, subiendo.p.ropa, false, tiempo);

    for (const c of trafico) dibujarCoche(c.x, c.y, c.ang, c.color, false);
    dibujarCoche(taxi.x, taxi.y, taxi.ang, '#f7c35f', true);

    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) dibujarAlto(i, j);

    const obj = objetivoActual();
    dibujarFlecha(obj);
    dibujarNoche(oscuridad());
    dibujarMini(tiempo);
  }

  // ---------- Sonido ----------
  const audio = { ctx: null, on: true, osc: null, gan: null, filtro: null };
  function iniciarAudio() {
    if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new C();
      audio.osc = audio.ctx.createOscillator(); audio.osc.type = 'sawtooth';
      audio.filtro = audio.ctx.createBiquadFilter(); audio.filtro.type = 'lowpass'; audio.filtro.frequency.value = 420;
      audio.gan = audio.ctx.createGain(); audio.gan.gain.value = 0;
      audio.osc.connect(audio.filtro); audio.filtro.connect(audio.gan); audio.gan.connect(audio.ctx.destination);
      audio.osc.start();
    } catch (e) { audio.ctx = null; }
  }
  function tono(f, dur, tipoOnda, vol, f2, retraso = 0) {
    if (!audio.ctx || !audio.on) return;
    const t0 = audio.ctx.currentTime + retraso;
    const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
    o.type = tipoOnda; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(audio.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const sonarDing = (f) => { tono(f, 0.25, 'sine', 0.15); tono(f * 1.5, 0.3, 'sine', 0.12, null, 0.12); };
  const sonarCaja = () => { tono(1320, 0.12, 'square', 0.06); tono(1760, 0.35, 'square', 0.06, null, 0.1); };
  const sonarChoque = () => { tono(120, 0.3, 'sawtooth', 0.2, 40); tono(80, 0.25, 'square', 0.12, 30); };
  const bocina = () => { iniciarAudio(); tono(392, 0.35, 'square', 0.07); tono(494, 0.35, 'square', 0.07); };
  function actualizarMotor() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const activo = audio.on && modo === 'jugando';
    audio.osc.frequency.setTargetAtTime(40 + Math.abs(taxi.v) * 0.16 + (teclas.gas ? 12 : 0), t, 0.08);
    audio.gan.gain.setTargetAtTime(activo ? 0.035 : 0, t, 0.1);
  }

  // ---------- Interfaz ----------
  const $ = (id) => document.getElementById(id);
  const hud = $('hud');
  const pantallas = { menu: $('menu'), taller: $('taller'), pausa: $('pausa'), fin: $('fin') };
  function mostrar(nombre) {
    for (const k in pantallas) pantallas[k].hidden = k !== nombre;
  }
  function decir(texto, dur = 2.6) {
    const m = $('mensaje');
    m.textContent = texto;
    m.classList.add('visible');
    mensajeT = dur;
  }

  function actualizarHud() {
    const h = 8 + 12 * turno.t / DURACION_TURNO;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('h-hora').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    $('h-dinero').textContent = dinero(Math.round(turno.caja * 100) / 100);
    $('h-vel').textContent = Math.round(Math.abs(taxi.v) * 0.13) + ' km/h';
    const est = turno.estrellas;
    $('h-estrellas').textContent = est.length ? (est.reduce((a, b) => a + b, 0) / est.length).toFixed(1) + ' ★' : '—';
    const f = $('h-fuel');
    f.style.width = (taxi.fuel / taxi.cap * 100) + '%';
    f.classList.toggle('bajo', taxi.fuel < taxi.cap * 0.2);
    $('viaje').hidden = !viaje;
    if (viaje) {
      $('v-nombre').textContent = viaje.p.nombre + TIPOS[viaje.p.tipo].etiqueta;
      $('v-destino').textContent = '→ ' + viaje.destino.texto;
      $('v-tarifa').textContent = dinero(Math.round(tarifa() * 100) / 100);
      const vt = $('v-tiempo');
      const resto = 1 - viaje.t / viaje.est;
      vt.style.width = Math.max(0, resto * 100) + '%';
      vt.classList.toggle('bajo', resto < 0.25);
    }
    const obj = objetivoActual();
    let txt = '';
    if (grua > 0) txt = 'Esperando la grúa…';
    else if (subiendo) txt = 'Subiendo el pasajero…';
    else if (viaje) txt = 'Lleva a ' + viaje.p.nombre + ': ' + Math.max(1, Math.round((Math.abs(obj.x - taxi.x) + Math.abs(obj.y - taxi.y)) / CUADRA)) + ' cuadras. Para junto al círculo naranja.';
    else if (obj && obj.bencina) txt = '¡Poco combustible! Ve a la estación roja y detente.';
    else txt = 'Busca un pasajero (verde) y detente a su lado.';
    $('objetivo').textContent = txt;
  }

  function terminarTurno() {
    modo = 'fin';
    hud.hidden = true;
    if (viaje) turno.estrellas.push(1);
    const neto = Math.round(turno.caja * 100) / 100;
    const est = turno.estrellas;
    const media = est.length ? est.reduce((a, b) => a + b, 0) / est.length : 0;
    guardado.ahorros = Math.round((guardado.ahorros + Math.max(0, neto)) * 100) / 100;
    guardado.turnos++;
    const record = guardado.mejor === null || neto > guardado.mejor;
    if (record) guardado.mejor = neto;
    guardar();
    const filas = [
      ['Viajes', turno.viajes], ['Tarifas', dinero(turno.bruto)], ['Propinas', dinero(turno.propinas)],
      ['Combustible', turno.combustible >= 0.005 ? '-' + dinero(Math.round(turno.combustible * 100) / 100) : '$0'],
      ['Daños y grúa', turno.danos ? '-' + dinero(turno.danos) : '$0'],
      ['Ganancia', dinero(neto)], ['Estrellas', media ? media.toFixed(1) + ' ★' : '—'], ['Ahorros', dinero(guardado.ahorros)],
    ];
    const cont = $('f-cuentas');
    cont.textContent = '';
    for (const [k, v] of filas) {
      const d = document.createElement('div');
      const s = document.createElement('span'); s.textContent = k;
      const b = document.createElement('strong'); b.textContent = v;
      if (String(v).startsWith('-')) b.className = 'negativo';
      d.append(s, b); cont.append(d);
    }
    $('f-frase').textContent = turno.viajes === 0 ? 'Hoy no subió nadie. ¡Mañana será otro día!'
      : record && guardado.turnos > 1 ? '¡Nuevo récord! Tu mejor turno hasta ahora.'
      : media >= 4.5 ? 'Tus pasajeros quedaron encantados.' : media >= 3 ? 'Un buen día de trabajo.' : 'Un turno movido… maneja con más cuidado.';
    mostrar('fin');
    actualizarMenu();
  }

  function actualizarMenu() {
    $('m-ahorros').textContent = dinero(guardado.ahorros);
    $('m-mejor').textContent = guardado.mejor === null ? '—' : dinero(guardado.mejor);
    $('m-turnos').textContent = guardado.turnos;
  }

  function abrirTaller() {
    $('t-ahorros').textContent = dinero(guardado.ahorros);
    const cont = $('mejoras');
    cont.textContent = '';
    for (const k in MEJORAS) {
      const m = MEJORAS[k], nivel = guardado[k];
      const fila = document.createElement('div'); fila.className = 'mejora';
      const info = document.createElement('div');
      const n = document.createElement('p'); n.className = 'nombre'; n.textContent = m.nombre + ' ';
      const niv = document.createElement('span'); niv.className = 'nivel'; niv.textContent = '●'.repeat(nivel) + '○'.repeat(3 - nivel);
      n.append(niv);
      const d = document.createElement('p'); d.className = 'desc'; d.textContent = m.desc;
      info.append(n, d);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'boton principal';
      if (nivel >= 3) { b.textContent = 'Máximo'; b.disabled = true; }
      else {
        const precio = m.precios[nivel];
        b.textContent = 'Comprar ' + dinero(precio);
        b.disabled = guardado.ahorros < precio;
        b.addEventListener('click', () => {
          guardado.ahorros = Math.round((guardado.ahorros - precio) * 100) / 100;
          guardado[k]++;
          guardar(); sonarCaja(); abrirTaller(); actualizarMenu();
        });
      }
      fila.append(info, b); cont.append(fila);
    }
    mostrar('taller');
  }

  function pausar() {
    if (modo !== 'jugando') return;
    modo = 'pausa'; mostrar('pausa');
  }
  function seguir() {
    if (modo !== 'pausa') return;
    modo = 'jugando'; mostrar(null); lienzo.focus();
  }

  $('b-jugar').addEventListener('click', () => { iniciarAudio(); nuevoTurno(); });
  $('b-otra').addEventListener('click', () => { iniciarAudio(); nuevoTurno(); });
  $('b-taller').addEventListener('click', abrirTaller);
  $('b-volver-taller').addEventListener('click', () => mostrar('menu'));
  $('b-menu').addEventListener('click', () => { modo = 'menu'; mostrar('menu'); });
  $('b-seguir').addEventListener('click', seguir);
  $('b-terminar').addEventListener('click', () => { modo = 'jugando'; terminarTurno(); });
  $('t-pausa').addEventListener('click', pausar);
  $('t-bocina').addEventListener('click', bocina);
  const botonSonido = $('t-sonido');
  function alternarSonido() { audio.on = !audio.on; botonSonido.classList.toggle('activo', !audio.on); botonSonido.textContent = audio.on ? 'Sonido' : 'Silencio'; }
  botonSonido.addEventListener('click', alternarSonido);

  const MAPA_TECLAS = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'freno', KeyS: 'freno', ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', Space: 'mano' };
  window.addEventListener('keydown', (e) => {
    if (MAPA_TECLAS[e.code]) { teclas[MAPA_TECLAS[e.code]] = true; if (modo === 'jugando') e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'KeyH' && modo === 'jugando') bocina();
    if (e.code === 'KeyM') alternarSonido();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (modo === 'jugando') pausar(); else if (modo === 'pausa') seguir(); }
  });
  window.addEventListener('keyup', (e) => { if (MAPA_TECLAS[e.code]) teclas[MAPA_TECLAS[e.code]] = false; });
  window.addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; pausar(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });

  // Mandos táctiles
  function activarTactil() { document.body.classList.add('tactil'); $('ayuda-teclas').textContent = 'En el celular: ◀ ▶ para girar, Gas y Freno a la derecha (mantén Freno para ir marcha atrás). Mejor en horizontal.'; }
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) activarTactil();
  window.addEventListener('touchstart', activarTactil, { once: true, passive: true });
  for (const b of document.querySelectorAll('[data-tecla]')) {
    const k = b.dataset.tecla;
    const on = (e) => { e.preventDefault(); iniciarAudio(); teclas[k] = true; b.classList.add('activo'); try { b.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } };
    const off = () => { teclas[k] = false; b.classList.remove('activo'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- Bucle principal ----------
  let antes = performance.now(), reloj = 0;
  function bucle(ahora) {
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    if (modo === 'jugando') {
      reloj += dt;
      turno.t += dt;
      moverTaxi(dt);
      moverTrafico(dt);
      actualizarPasajeros(dt);
      cargarCombustible(dt);
      revisarGrua(dt);
      if (enfriarChoque > 0) enfriarChoque -= dt;
      if (camara.temblor > 0) camara.temblor -= dt;
      const ax = taxi.x + Math.cos(taxi.ang) * taxi.v * 0.35, ay = taxi.y + Math.sin(taxi.ang) * taxi.v * 0.35;
      const k = 1 - Math.exp(-dt * 5);
      camara.x += (ax - camara.x) * k; camara.y += (ay - camara.y) * k;
      if (mensajeT > 0) { mensajeT -= dt; if (mensajeT <= 0) $('mensaje').classList.remove('visible'); }
      actualizarHud();
      if (turno.t >= DURACION_TURNO) {
        if (viaje && !turno.avisoFin) { turno.avisoFin = true; decir('Son las 20:00. Termina este último viaje…', 3); }
        if (!viaje || turno.t >= DURACION_TURNO + 45) terminarTurno();
      }
    } else if (modo === 'menu') {
      reloj += dt;
      // vista de fondo: la ciudad avanzando sola
      camara.x = MUNDO / 2 + Math.cos(reloj * 0.05) * 700; camara.y = MUNDO / 2 + Math.sin(reloj * 0.05) * 700;
      moverTrafico(dt);
    }
    if (modo !== 'pausa' && modo !== 'fin') dibujar(reloj);
    actualizarMotor();
    requestAnimationFrame(bucle);
  }

  redimensionar();
  taxi.x = -1000; taxi.y = -1000;
  trafico = crearTrafico();
  actualizarMenu();
  requestAnimationFrame(bucle);
})();
