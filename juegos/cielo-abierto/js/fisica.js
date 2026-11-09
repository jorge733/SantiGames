// Modelo de vuelo de 6 grados de libertad de una avioneta ligera ficticia.
// Ejes del avión: X = derecha, Y = arriba, Z = atrás (el morro apunta a -Z).
// Giros positivos: X = morro arriba, Y = morro a la izquierda, Z = alabeo a la izquierda.
(function (raiz) {
  'use strict';

  const G = 9.81, RHO0 = 1.225;
  const S = 16.2, ENVERGADURA = 11, CUERDA = 1.5;
  const ALARGAMIENTO = (ENVERGADURA * ENVERGADURA) / S;
  const I_CABECEO = 1825, I_GUINADA = 2670, I_ALABEO = 1290;
  const MASA_VACIO = 1000, KG_POR_LITRO = 0.72;
  const POTENCIA = 134000, EMPUJE_ESTATICO = 3000, RALENTI = 0.12;

  const RUEDAS = [
    { r: [0, -1.3, -1.6], k: 45000, c: 5000, morro: true },
    { r: [-1.25, -1.35, 0.3], k: 60000, c: 7000, freno: true },
    { r: [1.25, -1.35, 0.3], k: 60000, c: 7000, freno: true },
    { r: [0, -0.25, 5], k: 50000, c: 9000, patin: true },
  ];
  const PUNTOS_CHOQUE = [[0, -0.4, -2.5], [-5.5, -0.3, 0.1], [5.5, -0.3, 0.1]];

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

  function coeficienteSustentacion(alfa, flaps) {
    const alfaEntrada = rad(15 - 2 * flaps);
    const perdida = suave(alfaEntrada, alfaEntrada + rad(6), Math.abs(alfa));
    const lineal = 0.26 + 0.45 * flaps + 5 * alfa;
    return { cl: lineal * (1 - perdida) + 1.15 * Math.sin(2 * alfa) * perdida, perdida, alfaEntrada };
  }

  function crearEstado(op) {
    return {
      p: op.p.slice(),
      v: (op.v || [0, 0, 0]).slice(),
      q: (op.q || [0, 0, 0, 1]).slice(),
      w: [0, 0, 0],
      acelerador: op.acelerador || 0,
      motor: op.motor !== undefined ? op.motor : RALENTI,
      flaps: op.flaps || 0,
      combustible: op.combustible !== undefined ? op.combustible : 110,
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

    e.acelerador += limitar(m.acelerador - e.acelerador, -0.6 * dt, 0.6 * dt);
    e.flaps += limitar(m.flaps - e.flaps, -0.3 * dt, 0.3 * dt);
    const conMotor = e.combustible > 0;
    const motorObjetivo = conMotor ? RALENTI + (1 - RALENTI) * e.acelerador : 0;
    e.motor += (motorObjetivo - e.motor) * Math.min(1, dt * 1.6);
    if (conMotor) e.combustible = Math.max(0, e.combustible - 0.012 * (0.2 + 0.8 * e.acelerador) * dt);

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
    const { cl, perdida, alfaEntrada } = coeficienteSustentacion(alfa, e.flaps);
    e.perdida = perdida;
    e.alfa = alfa;
    e.alfaEntrada = alfaEntrada;
    if (V > 1) {
      const dir = [vb[0] / V, vb[1] / V, vb[2] / V];
      const elev = cruz([1, 0, 0], dir);
      const n = largo(elev) || 1;
      const potenciaUtil = limitar((e.motor - RALENTI) / (1 - RALENTI), 0, 1);
      const cd = 0.032 + (cl * cl) / (Math.PI * 0.75 * ALARGAMIENTO) + 0.045 * e.flaps +
        1.1 * Math.pow(Math.sin(alfa), 2) * perdida + (potenciaUtil < 0.1 ? 0.012 : 0);
      for (let i = 0; i < 3; i++) fb[i] += qd * S * ((cl * elev[i]) / n - cd * dir[i]);
      fb[0] += qd * S * -0.6 * beta;
    }
    const pot = limitar((e.motor - RALENTI) / (1 - RALENTI), 0, 1) * (rho / RHO0);
    const empuje = Math.min(EMPUJE_ESTATICO * pot + 130 * (e.motor > 0.05 ? 1 : 0), (0.8 * POTENCIA * pot) / Math.max(V, 1) + 130);
    fb[2] -= e.motor > 0.05 ? empuje : 0;

    // Momentos aerodinámicos. El chorro de la hélice da mando a baja velocidad.
    const qCola = qd + 350 * e.motor * e.motor;
    const elevador = limitar(m.cabeceo + m.trim, -1, 1) * rad(22);
    const cm = 0.02 - 0.9 * Math.sin(alfa) - 0.15 * perdida - 0.03 * e.flaps;
    const mb = [
      qd * S * CUERDA * cm - qd * S * CUERDA * 12 * e.w[0] * (CUERDA / (2 * vRef)) + qCola * S * CUERDA * 0.7 * elevador,
      -qd * S * ENVERGADURA * 0.12 * beta - qd * S * ENVERGADURA * 0.1 * e.w[1] * (ENVERGADURA / (2 * vRef)) -
        qCola * S * ENVERGADURA * 0.04 * m.timon * rad(25) + 90 * e.motor * (1 - Math.min(1, V / 70)),
      qd * S * ENVERGADURA * 0.09 * beta - qd * S * ENVERGADURA * 0.5 * e.w[2] * (ENVERGADURA / (2 * vRef)) -
        qd * S * ENVERGADURA * 0.15 * (1 - 0.6 * perdida) * m.alabeo * rad(17),
    ];
    if (perdida > 0.2) mb[2] += qd * S * ENVERGADURA * 0.012 * perdida * Math.sin(e.t * 1.7);

    const f = rotar(e.q, fb);
    const masa = MASA_VACIO + e.combustible * KG_POR_LITRO;
    f[1] -= masa * G;

    // Tren de aterrizaje: muelles, frenos y dirección con la rueda de morro.
    let tocando = false;
    const adelante = rotar(e.q, [0, 0, -1]);
    for (const rueda of RUEDAS) {
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

    for (const c of PUNTOS_CHOQUE) {
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
    e.w = [
      w[0] + ((mb[0] - (I_ALABEO - I_GUINADA) * w[1] * w[2]) / I_CABECEO) * dt,
      w[1] + ((mb[1] - (I_CABECEO - I_ALABEO) * w[2] * w[0]) / I_GUINADA) * dt,
      w[2] + ((mb[2] - (I_GUINADA - I_CABECEO) * w[0] * w[1]) / I_ALABEO) * dt,
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
      rpm: e.motor * 2700,
      avisoPerdida: !e.enTierra && e.alfa > e.alfaEntrada - rad(3) && largo(aire) > 8,
      alturaSuelo: e.p[1] - Math.max(mundo.altura(e.p[0], e.p[2]), 0),
      adelante, derecha, arriba,
    };
  }

  raiz.Fisica = { crearEstado, paso, telemetria, rotar, rad };
  if (typeof module !== 'undefined') module.exports = raiz.Fisica;
})(typeof window !== 'undefined' ? window : globalThis);
