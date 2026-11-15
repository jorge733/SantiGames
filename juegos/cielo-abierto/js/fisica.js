// Modelo de vuelo de 6 grados de libertad. Los aviones son ficticios y se describen en AVIONES.
// Ejes del avión: X = derecha, Y = arriba, Z = atrás (el morro apunta a -Z).
// Giros positivos: X = morro arriba, Y = morro a la izquierda, Z = alabeo a la izquierda.
(function (raiz) {
  'use strict';

  const G = 9.81, RHO0 = 1.225, RALENTI = 0.12;

  // Coeficientes adimensionales comunes; cada avión aporta tamaño, masa, motor y tren.
  const AVIONES = {
    // Jet de largo alcance de la aerolínea: dos turbofanes, 300 pasajeros, más de 14.000 km de alcance.
    jet: {
      nombre: 'Cóndor 300', pasajeros: 300,
      S: 360, envergadura: 60, cuerda: 6.5,
      inercia: { cabeceo: 4000000, guinada: 7000000, alabeo: 3000000 },
      masaVacio: 120000, kgPorLitro: 0.8, combustible: 115000, consumo: 6,
      potencia: 200000000, empujeEstatico: 660000, empujeRalenti: 25000,
      estela: 0, parHelice: 0, cola: 1.2, rpmMax: 100, clFlaps: 1.1,
      velocidadMando: 150,
      ruedas: [
        { r: [0, -4.85, -23], k: 1500000, c: 250000, morro: true },
        { r: [-5.5, -4.9, 1.5], k: 6500000, c: 900000, freno: true },
        { r: [5.5, -4.9, 1.5], k: 6500000, c: 900000, freno: true },
        { r: [0, -0.4, 28.5], k: 6000000, c: 1200000, patin: true },
      ],
      choque: [[0, -2.2, -29], [-30, 0.3, 6], [30, 0.3, 6]],
      arcos: { maximo: 350, flapsDesde: 110, flapsHasta: 200, verdeDesde: 135, amarilloDesde: 300, rojoDesde: 330 },
      camara: { cabina: [0, 1.6, -25.5], atras: 105, arriba: 19, mira: 6 },
      // Configuración estabilizada en la senda de 3° (medida con un piloto automático de prueba).
      aproximacion: { nudos: 135, acelerador: 0.14, flaps: 1, trim: 0.1 }, rotacion: 150,
    },
    // Turbohélice regional de la aerolínea: ala alta, dos motores, 48 pasajeros.
    regional: {
      nombre: 'Albatros 72', pasajeros: 48,
      S: 70, envergadura: 27, cuerda: 2.6,
      inercia: { cabeceo: 120000, guinada: 260000, alabeo: 110000 },
      masaVacio: 12000, kgPorLitro: 0.8, combustible: 2300, consumo: 0.25,
      potencia: 4000000, empujeEstatico: 70000, empujeRalenti: 2000,
      estela: 0, parHelice: 0, cola: 1.2, rpmMax: 1200, clFlaps: 0.45,
      camara: { cabina: [0, 0.95, -11.2], atras: 46, arriba: 8.5, mira: 2.5 },
      aproximacion: { nudos: 125, acelerador: 0.15, flaps: 2 / 3, trim: 0.16 }, rotacion: 110,
      velocidadMando: 115, // nudos a partir de los que se limita el recorrido del elevador con teclas
      ruedas: [
        { r: [0, -2.05, -9.5], k: 400000, c: 60000, morro: true },
        { r: [-2.1, -2.1, 0.8], k: 900000, c: 110000, freno: true },
        { r: [2.1, -2.1, 0.8], k: 900000, c: 110000, freno: true },
        { r: [0, -0.15, 12], k: 900000, c: 150000, patin: true },
      ],
      choque: [[0, -0.9, -13], [-13.5, 1.6, 0.4], [13.5, 1.6, 0.4]],
      // Velocidades en nudos para los arcos del velocímetro.
      arcos: { maximo: 300, flapsDesde: 85, flapsHasta: 160, verdeDesde: 100, amarilloDesde: 220, rojoDesde: 250 },
    },
    // Avioneta de escuela de 4 plazas (el avión original del juego).
    avioneta: {
      nombre: 'Avioneta', pasajeros: 3,
      S: 16.2, envergadura: 11, cuerda: 1.5,
      inercia: { cabeceo: 1825, guinada: 2670, alabeo: 1290 },
      masaVacio: 790, kgPorLitro: 0.72, combustible: 110, consumo: 0.012,
      potencia: 134000, empujeEstatico: 3000, empujeRalenti: 130,
      estela: 350, parHelice: 90, cola: 0.7, rpmMax: 2700, clFlaps: 0.45,
      camara: { cabina: [0, 1.28, -0.25], atras: 15, arriba: 3.6, mira: 1 },
      aproximacion: { nudos: 70, acelerador: 0.23, flaps: 2 / 3, trim: 0.17 }, rotacion: 60,
      velocidadMando: 62,
      ruedas: [
        { r: [0, -1.3, -1.6], k: 45000, c: 5000, morro: true },
        { r: [-1.25, -1.35, 0.3], k: 60000, c: 7000, freno: true },
        { r: [1.25, -1.35, 0.3], k: 60000, c: 7000, freno: true },
        { r: [0, -0.25, 5], k: 50000, c: 9000, patin: true },
      ],
      choque: [[0, -0.4, -2.5], [-5.5, -0.3, 0.1], [5.5, -0.3, 0.1]],
      arcos: { maximo: 180, flapsDesde: 46, flapsHasta: 85, verdeDesde: 51, amarilloDesde: 125, rojoDesde: 155 },
    },
  };
  for (const a of Object.values(AVIONES)) {
    a.alargamiento = (a.envergadura * a.envergadura) / a.S;
    // Altura del centro del avión sobre la pista cuando está parado (ruedas un poco comprimidas).
    const principal = a.ruedas.find((r) => r.freno);
    a.alturaEnTierra = -principal.r[1] - 0.06;
  }

  const rad = (g) => (g * Math.PI) / 180;
  const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const largo = (v) => Math.hypot(v[0], v[1], v[2]);

  function rotar(q, v) {
    const u = [q[0], q[1], q[2]];
    const t = cruz(u, v).map((x) => 2 * x);
    const c = cruz(u, t);
    return [v[0] + q[3] * t[0] + c[0], v[1] + q[3] * t[1] + c[1], v[2] + q[3] * t[2] + c[2]];
  }
  const rotarInv = (q, v) => rotar([-q[0], -q[1], -q[2], q[3]], v);

  function suave(a, b, x) {
    const t = limitar((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function coeficienteSustentacion(alfa, flaps, clFlaps) {
    const alfaEntrada = rad(15 - 2 * flaps);
    const perdida = suave(alfaEntrada, alfaEntrada + rad(6), Math.abs(alfa));
    const lineal = 0.26 + clFlaps * flaps + 5 * alfa;
    return { cl: lineal * (1 - perdida) + 1.15 * Math.sin(2 * alfa) * perdida, perdida, alfaEntrada };
  }

  function crearEstado(op) {
    const modelo = AVIONES[op.avion || 'regional'];
    return {
      modelo,
      p: op.p.slice(),
      v: (op.v || [0, 0, 0]).slice(),
      q: (op.q || [0, 0, 0, 1]).slice(),
      w: [0, 0, 0],
      acelerador: op.acelerador || 0,
      motor: op.motor !== undefined ? op.motor : RALENTI,
      flaps: op.flaps || 0,
      combustible: op.combustible !== undefined ? op.combustible : modelo.combustible,
      carga: op.carga || 0, // kg de pasajeros y equipaje
      enTierra: !!op.enTierra,
      tiempoAire: op.enTierra ? 0 : 10,
      ultimoToque: null,
      estrellado: null,
      perdida: 0,
      alfa: 0,
      t: 0,
    };
  }

  function vientoEn(mundo, t) {
    const v = mundo.viento || [0, 0, 0];
    const a = mundo.turbulencia || 0;
    if (!a) return v;
    return [
      v[0] + a * (Math.sin(t * 0.9) + 0.6 * Math.sin(t * 2.3 + 1)),
      v[1] + a * 0.5 * (Math.sin(t * 1.3 + 2) + 0.5 * Math.sin(t * 3.1)),
      v[2] + a * (Math.sin(t * 0.7 + 4) + 0.6 * Math.sin(t * 1.9 + 3)),
    ];
  }

  function paso(e, m, mundo, dt) {
    if (e.estrellado) return;
    e.t += dt;
    const A = e.modelo, S = A.S, ENVERGADURA = A.envergadura, CUERDA = A.cuerda;

    e.acelerador += limitar(m.acelerador - e.acelerador, -0.6 * dt, 0.6 * dt);
    e.flaps += limitar(m.flaps - e.flaps, -0.3 * dt, 0.3 * dt);
    const conMotor = e.combustible > 0;
    const motorObjetivo = conMotor ? RALENTI + (1 - RALENTI) * e.acelerador : 0;
    e.motor += (motorObjetivo - e.motor) * Math.min(1, dt * 1.6);
    if (conMotor) e.combustible = Math.max(0, e.combustible - A.consumo * (0.2 + 0.8 * e.acelerador) * dt);

    const rho = RHO0 * Math.exp(-Math.max(0, e.p[1]) / 8500);
    const viento = vientoEn(mundo, e.t);
    const aire = [e.v[0] - viento[0], e.v[1] - viento[1], e.v[2] - viento[2]];
    const vb = rotarInv(e.q, aire);
    const V = largo(vb);
    const qd = 0.5 * rho * V * V;
    const alfa = V > 1 ? Math.atan2(-vb[1], -vb[2]) : 0;
    const beta = V > 1 ? Math.atan2(vb[0], Math.hypot(vb[1], vb[2])) : 0;
    const vRef = Math.max(V, 8);

    const fb = [0, 0, 0];
    const sust = coeficienteSustentacion(alfa, e.flaps, A.clFlaps);
    const { perdida, alfaEntrada } = sust;
    // Efecto suelo: a menos de una envergadura del suelo el ala sustenta más y frena menos.
    const sobreSuelo = e.p[1] - Math.max(mundo.altura(e.p[0], e.p[2]), 0) - A.alturaEnTierra;
    const efectoSuelo = suave(ENVERGADURA, 0, sobreSuelo);
    const cl = sust.cl * (1 + 0.1 * efectoSuelo);
    e.perdida = perdida;
    e.alfa = alfa;
    e.alfaEntrada = alfaEntrada;
    if (V > 1) {
      const dir = [vb[0] / V, vb[1] / V, vb[2] / V];
      const elev = cruz([1, 0, 0], dir);
      const n = largo(elev) || 1;
      const potenciaUtil = limitar((e.motor - RALENTI) / (1 - RALENTI), 0, 1);
      const cd = 0.032 + (1 - 0.4 * efectoSuelo) * (cl * cl) / (Math.PI * 0.75 * A.alargamiento) + 0.045 * e.flaps +
        1.1 * Math.pow(Math.sin(alfa), 2) * perdida + (potenciaUtil < 0.1 ? 0.012 : 0);
      for (let i = 0; i < 3; i++) fb[i] += qd * S * ((cl * elev[i]) / n - cd * dir[i]);
      fb[0] += qd * S * -0.6 * beta;
    }
    const pot = limitar((e.motor - RALENTI) / (1 - RALENTI), 0, 1) * (rho / RHO0);
    const ralenti = A.empujeRalenti * (e.motor > 0.05 ? 1 : 0);
    const empuje = Math.min(A.empujeEstatico * pot + ralenti, (0.8 * A.potencia * pot) / Math.max(V, 1) + ralenti);
    fb[2] -= e.motor > 0.05 ? empuje : 0;

    // Momentos aerodinámicos. El chorro de la hélice da mando a baja velocidad.
    const qCola = qd + A.estela * e.motor * e.motor;
    const elevador = limitar(m.cabeceo + m.trim, -1, 1) * rad(22);
    const cm = 0.02 - 0.9 * Math.sin(alfa) - 0.15 * perdida - 0.03 * e.flaps;
    const mb = [
      qd * S * CUERDA * cm - qd * S * CUERDA * 12 * e.w[0] * (CUERDA / (2 * vRef)) + qCola * S * CUERDA * A.cola * elevador,
      -qd * S * ENVERGADURA * 0.12 * beta - qd * S * ENVERGADURA * 0.1 * e.w[1] * (ENVERGADURA / (2 * vRef)) -
        qCola * S * ENVERGADURA * 0.04 * m.timon * rad(25) + A.parHelice * e.motor * (1 - Math.min(1, V / 70)),
      qd * S * ENVERGADURA * 0.09 * beta - qd * S * ENVERGADURA * 0.5 * e.w[2] * (ENVERGADURA / (2 * vRef)) -
        qd * S * ENVERGADURA * 0.15 * (1 - 0.6 * perdida) * m.alabeo * rad(17),
    ];
    if (perdida > 0.2) mb[2] += qd * S * ENVERGADURA * 0.012 * perdida * Math.sin(e.t * 1.7);

    const f = rotar(e.q, fb);
    const masa = A.masaVacio + e.carga + e.combustible * A.kgPorLitro;
    f[1] -= masa * G;

    // Tren de aterrizaje: muelles, frenos y dirección con la rueda de morro.
    let tocando = false;
    const adelante = rotar(e.q, [0, 0, -1]);
    for (const rueda of A.ruedas) {
      const r = rotar(e.q, rueda.r);
      const pm = [e.p[0] + r[0], e.p[1] + r[1], e.p[2] + r[2]];
      const h = mundo.altura(pm[0], pm[2]);
      if (h <= 0 && pm[1] <= 0) { e.estrellado = 'agua'; return; }
      const hundido = h - pm[1];
      if (hundido <= 0) continue;
      if (hundido > 0.7) { e.estrellado = 'tren'; return; }
      const vp = cruz(rotar(e.q, e.w), r).map((x, i) => x + e.v[i]);
      const normal = Math.max(0, rueda.k * hundido - rueda.c * vp[1]);
      if (normal <= 0) continue;
      tocando = true;

      let frente = [adelante[0], 0, adelante[2]];
      const nf = Math.hypot(frente[0], frente[2]) || 1;
      frente = [frente[0] / nf, 0, frente[2] / nf];
      if (rueda.morro) {
        const giro = m.timon * rad(25) * Math.max(0.08, 1 - V / 25);
        const c = Math.cos(giro), s = Math.sin(giro);
        frente = [frente[0] * c - frente[2] * s, 0, frente[2] * c + frente[0] * s];
      }
      const lado = [-frente[2], 0, frente[0]];
      const vF = vp[0] * frente[0] + vp[2] * frente[2];
      const vL = vp[0] * lado[0] + vp[2] * lado[2];
      const mu = rueda.patin ? 0.3 : 0.02 + (rueda.freno ? 0.55 * m.freno : 0);
      const fF = -normal * mu * limitar(vF / 0.3, -1, 1);
      const fL = -normal * 0.8 * limitar(vL / 0.4, -1, 1);
      const fuerza = [frente[0] * fF + lado[0] * fL, normal, frente[2] * fF + lado[2] * fL];
      f[0] += fuerza[0]; f[1] += fuerza[1]; f[2] += fuerza[2];
      // La fricción actúa con menos palanca para que un frenazo no vuelque un tren tan estrecho.
      const momentoApoyo = cruz(r, [0, normal, 0]);
      const momentoRoce = cruz([r[0], r[1] * 0.35, r[2]], [fuerza[0], 0, fuerza[2]]);
      const mr = rotarInv(e.q, [momentoApoyo[0] + momentoRoce[0], momentoApoyo[1] + momentoRoce[1], momentoApoyo[2] + momentoRoce[2]]);
      mb[0] += mr[0]; mb[1] += mr[1]; mb[2] += mr[2];
    }

    if (tocando && !e.enTierra && e.tiempoAire > 1) {
      e.ultimoToque = { vs: e.v[1], x: e.p[0], z: e.p[2], t: e.t };
      if (e.v[1] < -4) { e.estrellado = 'tren'; return; }
    }
    e.enTierra = tocando;
    e.tiempoAire = tocando ? 0 : e.tiempoAire + dt;

    for (const c of A.choque) {
      const r = rotar(e.q, c);
      const x = e.p[0] + r[0], z = e.p[2] + r[2];
      if (e.p[1] + r[1] < Math.max(mundo.altura(x, z), 0)) { e.estrellado = 'choque'; return; }
    }

    // Integración.
    for (let i = 0; i < 3; i++) {
      e.v[i] += (f[i] / masa) * dt;
      e.p[i] += e.v[i] * dt;
    }
    const w = e.w;
    const I = A.inercia;
    e.w = [
      w[0] + ((mb[0] - (I.alabeo - I.guinada) * w[1] * w[2]) / I.cabeceo) * dt,
      w[1] + ((mb[1] - (I.cabeceo - I.alabeo) * w[2] * w[0]) / I.guinada) * dt,
      w[2] + ((mb[2] - (I.guinada - I.cabeceo) * w[0] * w[1]) / I.alabeo) * dt,
    ];
    const [x, y, z, s] = e.q;
    const [a, b, c] = e.w;
    const q = [
      x + 0.5 * dt * (s * a + y * c - z * b),
      y + 0.5 * dt * (s * b + z * a - x * c),
      z + 0.5 * dt * (s * c + x * b - y * a),
      s + 0.5 * dt * (-x * a - y * b - z * c),
    ];
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    e.q = q.map((v) => v / n);
  }

  function telemetria(e, mundo) {
    const adelante = rotar(e.q, [0, 0, -1]);
    const derecha = rotar(e.q, [1, 0, 0]);
    const arriba = rotar(e.q, [0, 1, 0]);
    const viento = mundo.viento || [0, 0, 0];
    const aire = [e.v[0] - viento[0], e.v[1] - viento[1], e.v[2] - viento[2]];
    const rho = RHO0 * Math.exp(-Math.max(0, e.p[1]) / 8500);
    return {
      nudos: largo(aire) * Math.sqrt(rho / RHO0) * 1.94384,
      pies: e.p[1] * 3.28084,
      fpm: e.v[1] * 196.85,
      rumbo: ((Math.atan2(adelante[0], -adelante[2]) * 180) / Math.PI + 360) % 360,
      cabeceo: Math.asin(limitar(adelante[1], -1, 1)),
      alabeo: Math.atan2(-derecha[1], arriba[1]),
      rpm: e.motor * e.modelo.rpmMax,
      avisoPerdida: !e.enTierra && e.alfa > e.alfaEntrada - rad(3) && largo(aire) > 8,
      alturaSuelo: e.p[1] - Math.max(mundo.altura(e.p[0], e.p[2]), 0),
      adelante, derecha, arriba,
    };
  }

  raiz.Fisica = { AVIONES, crearEstado, paso, telemetria, rotar, rad };
  if (typeof module !== 'undefined') module.exports = raiz.Fisica;
})(typeof window !== 'undefined' ? window : globalThis);
