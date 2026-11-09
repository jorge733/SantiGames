// Terreno de la isla: alturas deterministas compartidas por la física y los gráficos.
// Ejes del mundo: X = este, Y = arriba, Z = sur (el norte es -Z). Unidades: metros.
(function (raiz) {
  'use strict';

  const CELDA = 100;
  const N = 240;
  const MITAD = (N * CELDA) / 2;

  const AEROPUERTOS = [
    { id: 'A', nombre: 'Puerto Alba', x: 0, z: 0, y: 30, mitadLargo: 700, mitadAncho: 15 },
    { id: 'B', nombre: 'Valle Norte', x: 5200, z: -8200, y: 140, mitadLargo: 700, mitadAncho: 15 },
  ];

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
    const [a, b] = AEROPUERTOS;
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

  function alturaConAeropuertos(x, z) {
    let h = alturaNatural(x, z);
    for (const ap of AEROPUERTOS) {
      const dx = Math.max(0, Math.abs(x - ap.x) - 300);
      const dz = Math.max(0, Math.abs(z - ap.z) - 1100);
      const peso = suave(900, 0, Math.hypot(dx, dz));
      h = h + (ap.y - h) * peso;
    }
    return h;
  }

  const malla = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      malla[j * (N + 1) + i] = alturaConAeropuertos(i * CELDA - MITAD, j * CELDA - MITAD);
    }
  }

  function vertice(i, j) {
    return malla[j * (N + 1) + i];
  }

  // Altura exacta sobre los mismos triángulos que se dibujan.
  function altura(x, z) {
    const gx = (x + MITAD) / CELDA, gz = (z + MITAD) / CELDA;
    if (gx < 0 || gz < 0 || gx >= N || gz >= N) return -30;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const a = vertice(i, j), b = vertice(i + 1, j), c = vertice(i, j + 1), d = vertice(i + 1, j + 1);
    if (fx + fz < 1) return a + (b - a) * fx + (c - a) * fz;
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }

  function enPista(ap, x, z) {
    return Math.abs(x - ap.x) <= ap.mitadAncho && Math.abs(z - ap.z) <= ap.mitadLargo;
  }

  raiz.Terreno = { CELDA, N, MITAD, AEROPUERTOS, altura, vertice, enPista, azar, suave };
  if (typeof module !== 'undefined') module.exports = raiz.Terreno;
})(typeof window !== 'undefined' ? window : globalThis);
