// Terreno: alturas deterministas compartidas por la física y los gráficos.
// Puede ser la isla de práctica o el paisaje de un destino real (ver js/destinos.js); se cambia con configurar().
// Ejes del mundo: X = este, Y = arriba, Z = sur (el norte es -Z). Unidades: metros.
// En los destinos la pista va de norte a sur: se despega hacia el norte y se aproxima desde el sur.
(function (raiz) {
  'use strict';

  const N = 240;
  let CELDA = 100, MITAD = (N * CELDA) / 2;

  const ISLA = [
    { id: 'A', nombre: 'Puerto Alba', x: 0, z: 0, y: 30, mitadLargo: 700, mitadAncho: 15 },
    { id: 'B', nombre: 'Valle Norte', x: 5200, z: -8200, y: 140, mitadLargo: 700, mitadAncho: 15 },
  ];
  // Se vacía y se rellena al cambiar de escenario, así quien guarde la referencia ve siempre la actual.
  const AEROPUERTOS = ISLA.map((a) => Object.assign({}, a));
  let destino = null; // null = isla de práctica

  function suave(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function azar(ix, iz) {
    const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function ruido(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = suave(0, 1, x - ix), fz = suave(0, 1, z - iz);
    const a = azar(ix, iz), b = azar(ix + 1, iz);
    const c = azar(ix, iz + 1), d = azar(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  function fbm(x, z, octavas) {
    let suma = 0, amp = 0.5, f = 1;
    for (let i = 0; i < octavas; i++) {
      suma += amp * ruido(x * f, z * f);
      amp *= 0.5;
      f *= 2.03;
    }
    return suma;
  }

  function distanciaSegmento(x, z, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  }

  // Los pasillos de aproximación se mantienen libres de montañas.
  function factorPasillos(x, z) {
    const [a, b] = ISLA;
    const d = Math.min(
      distanciaSegmento(x, z, a.x, a.z + 6000, a.x, a.z - 2500),
      distanciaSegmento(x, z, a.x - 1800, a.z - 2500, a.x - 1800, a.z + 3000),
      distanciaSegmento(x, z, b.x, b.z + 5000, b.x, b.z - 1500),
      distanciaSegmento(x, z, a.x, a.z - 2500, b.x, b.z + 5000)
    );
    return suave(500, 2000, d);
  }

  function alturaNatural(x, z) {
    const d = Math.hypot(x, z + 4000) + (fbm(x * 0.0004 + 7, z * 0.0004, 3) - 0.45) * 2600;
    const isla = suave(11200, 8000, d);
    const colinas = fbm(x * 0.0007 + 3, z * 0.0007 + 9, 4) * 160;
    const cresta = 1 - Math.abs(fbm(x * 0.00042 + 21, z * 0.00042 + 4, 5) * 2 - 1);
    const montes = Math.pow(cresta, 3) * 1150 * suave(0.35, 0.6, fbm(x * 0.00018 + 2, z * 0.00018 + 5, 2));
    return -30 + isla * (46 + colinas + montes * factorPasillos(x, z));
  }

  // Zona libre bajo la aproximación final (todas las pistas se aproximan desde el sur):
  // el terreno no supera una pendiente de 1,7° desde el umbral, por debajo de la senda de 3° de las luces PAPI.
  function pasilloFinal(ap, x, z) {
    const d = z - (ap.z + ap.mitadLargo);
    if (d <= 0 || d >= 7000) return null;
    const ancho = 250 + d * 0.15;
    return { peso: suave(ancho + 400, ancho, Math.abs(x - ap.x)) * suave(7000, 5000, d), tope: ap.y - 3 + d * 0.03, dentro: Math.abs(x - ap.x) < ancho + 100 };
  }

  // En los destinos también se despeja la salida hacia el norte, con la misma pendiente.
  function pasilloSalida(ap, x, z) {
    const d = (ap.z - ap.mitadLargo) - z;
    if (d <= 0 || d >= 9000) return null;
    const ancho = 300 + d * 0.15;
    return { peso: suave(ancho + 500, ancho, Math.abs(x - ap.x)) * suave(9000, 7000, d), tope: ap.y - 3 + d * 0.035, dentro: Math.abs(x - ap.x) < ancho + 100 };
  }

  function enPasilloFinal(x, z) {
    return AEROPUERTOS.some((ap) => {
      const p = pasilloFinal(ap, x, z), q = destino ? pasilloSalida(ap, x, z) : null;
      return (p && p.dentro && z - ap.z < 5000 + ap.mitadLargo) || (q && q.dentro);
    });
  }

  // ---- Paisaje de un destino real ----
  const LADOS = { este: [1, 0], oeste: [-1, 0], norte: [0, -1], sur: [0, 1] };
  function haciaLado(lado, x, z) { const [a, b] = LADOS[lado]; return x * a + z * b; }

  function alturaDestino(x, z) {
    const d = destino, base = d.elev, sem = d.semilla;
    const bioma = raiz.Destinos.BIOMAS[d.bioma];
    let h = base + (fbm(x * 0.0005 + sem, z * 0.0005 + 3, 4) - 0.45) * bioma.relieve * 2;
    if (d.cordillera) {
      const c = d.cordillera;
      const avance = haciaLado(c.lado, x, z) + (fbm(x * 0.0002 + sem, z * 0.0002, 2) - 0.5) * 3000;
      const cresta = 1 - Math.abs(fbm(x * 0.0005 + 21 + sem, z * 0.0005 + 4, 5) * 2 - 1);
      h += suave(c.distancia - 4000, c.distancia + 3000, avance) * c.altura * (0.35 + 0.75 * Math.pow(cresta, 2));
    }
    for (const [vx, vz, alto] of d.volcanes || []) {
      const r = Math.hypot(x - vx, z - vz), radio = alto * 2.2 + 1200;
      h += Math.max(0, alto * Math.pow(Math.max(0, 1 - r / radio), 1.6) - (r < radio * 0.08 ? alto * 0.06 : 0));
    }
    if (d.mar) {
      h = Math.max(h, 8); // la tierra firme queda unos metros sobre el mar: sin charcos ni parpadeo con el agua
      const m = d.mar, borde = (fbm(x * 0.0003 + sem + 9, z * 0.0003, 3) - 0.5) * 2200;
      const fuera = m.lado === 'alrededor' ? Math.hypot(x, z * 1.25) - m.distancia + borde : haciaLado(m.lado, x, z) - m.distancia + borde;
      const tierra = suave(600, -400, fuera);
      // La costa baja hasta el mar (nivel 0) y luego al fondo.
      h = Math.max(8, h * Math.min(1, 0.4 + suave(0, 3000, -fuera))) * tierra - 25 * (1 - tierra);
    }
    return h;
  }

  function alturaConAeropuertos(x, z) {
    let h = destino ? alturaDestino(x, z) : alturaNatural(x, z);
    for (const ap of AEROPUERTOS) {
      const p = pasilloFinal(ap, x, z);
      if (p && h > p.tope) h += (p.tope - h) * p.peso;
      const q = destino ? pasilloSalida(ap, x, z) : null;
      if (q && h > q.tope) h += (q.tope - h) * q.peso;
    }
    for (const ap of AEROPUERTOS) {
      const dx = Math.max(0, Math.abs(x - ap.x) - 300);
      const dz = Math.max(0, Math.abs(z - ap.z) - ap.mitadLargo - 400);
      const peso = suave(900, 0, Math.hypot(dx, dz));
      h = h + (ap.y - h) * peso;
    }
    return h;
  }

  const malla = new Float32Array((N + 1) * (N + 1));
  function generar() {
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        malla[j * (N + 1) + i] = alturaConAeropuertos(i * CELDA - MITAD, j * CELDA - MITAD);
      }
    }
  }

  // Cambia de escenario: sin argumento, la isla de práctica; con un destino, su paisaje.
  function configurar(d) {
    destino = d || null;
    CELDA = destino ? 150 : 100;
    MITAD = (N * CELDA) / 2;
    AEROPUERTOS.length = 0;
    if (!destino) for (const a of ISLA) AEROPUERTOS.push(Object.assign({}, a));
    else {
      destino.semilla = destino.semilla || (destino.codigo.charCodeAt(0) * 7 + destino.codigo.charCodeAt(1) * 3 + destino.codigo.charCodeAt(2)) % 97;
      AEROPUERTOS.push({ id: destino.codigo, nombre: destino.ciudad, x: 0, z: 0, y: destino.mar ? Math.max(8, destino.elev) : destino.elev, mitadLargo: destino.largo / 2, mitadAncho: destino.largo > 3000 ? 22.5 : 15 });
    }
    generar();
    Object.assign(raiz.Terreno, { CELDA, MITAD, destino });
  }
  generar();

  function vertice(i, j) {
    return malla[j * (N + 1) + i];
  }

  // Altura exacta sobre los mismos triángulos que se dibujan.
  function altura(x, z) {
    const gx = (x + MITAD) / CELDA, gz = (z + MITAD) / CELDA;
    if (gx < 0 || gz < 0 || gx >= N || gz >= N) {
      // Fuera del mapa: mar en la isla y en las costas; en el interior se prolonga el borde.
      if (!destino || destino.mar) return -30;
      return vertice(Math.max(0, Math.min(N, Math.round(gx))), Math.max(0, Math.min(N, Math.round(gz))));
    }
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const a = vertice(i, j), b = vertice(i + 1, j), c = vertice(i, j + 1), d = vertice(i + 1, j + 1);
    if (fx + fz < 1) return a + (b - a) * fx + (c - a) * fz;
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }

  function enPista(ap, x, z) {
    return Math.abs(x - ap.x) <= ap.mitadAncho && Math.abs(z - ap.z) <= ap.mitadLargo;
  }

  raiz.Terreno = { CELDA, N, MITAD, AEROPUERTOS, destino, configurar, altura, vertice, enPista, enPasilloFinal, azar, suave, fbm };
  if (typeof module !== 'undefined') module.exports = raiz.Terreno;
})(typeof window !== 'undefined' ? window : globalThis);
