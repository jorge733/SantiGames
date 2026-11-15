// Pasajeros de la aerolínea: su comodidad baja con los movimientos bruscos y los aterrizajes duros.
(function (raiz) {
  'use strict';
  const G = 9.81, KG_POR_PASAJERO = 70;
  const NOMBRES = ['Ana', 'Tomás', 'Rosa', 'Benja', 'Lucía', 'Matías', 'Sofía', 'Don Pedro', 'Valentina', 'Joaquín', 'Isidora', 'Abuela Marta'];
  const QUEJAS = {
    g: '¡Movimientos bruscos! Los pasajeros se marean',
    lateral: 'El avión derrapa: usa menos timón en el aire',
    alabeo: 'Demasiado inclinado: los pasajeros se asustan',
    cabeceo: 'Morro demasiado inclinado: los pasajeros se agarran al asiento',
    perdida: '¡Pérdida! Los pasajeros gritan',
  };

  function crear(cantidad, azar) {
    const r = azar || Math.random;
    const libres = NOMBRES.slice(), nombres = [];
    for (let i = 0; i < cantidad && libres.length; i++) nombres.push(libres.splice(Math.floor(r() * libres.length), 1)[0]);
    return { cantidad, nombres, carga: cantidad * KG_POR_PASAJERO, comodidad: 100, fuerza: null, vAnterior: null, tAnterior: 0, toqueVisto: null, ultimaQueja: -99 };
  }

  // Devuelve un texto de queja cuando toca avisar, o null.
  function actualizar(p, e, tel) {
    if (!p.cantidad) return null;
    const dt = e.t - p.tAnterior;
    if (!p.vAnterior || dt <= 0) { p.vAnterior = e.v.slice(); p.tAnterior = e.t; if (p.tInicio === undefined) p.tInicio = e.t; return null; }
    // Fuerza específica (lo que sienten los pasajeros), suavizada para ignorar vibraciones.
    const f = [(e.v[0] - p.vAnterior[0]) / dt, (e.v[1] - p.vAnterior[1]) / dt + G, (e.v[2] - p.vAnterior[2]) / dt];
    p.vAnterior = e.v.slice(); p.tAnterior = e.t;
    const k = 1 - Math.exp(-dt / 0.4);
    if (!p.fuerza) p.fuerza = f;
    else for (let i = 0; i < 3; i++) p.fuerza[i] += (f[i] - p.fuerza[i]) * k;

    let queja = null, molestia = 0;
    // Los primeros segundos no cuentan: el avión se está asentando en su posición inicial.
    if (!e.enTierra && e.tiempoAire > 1.5 && e.t - p.tInicio > 4) {
      const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const nz = punto(p.fuerza, tel.arriba) / G, ny = punto(p.fuerza, tel.derecha) / G;
      const alabeo = Math.abs(tel.alabeo * 180 / Math.PI), cabeceo = tel.cabeceo * 180 / Math.PI;
      const partes = {
        g: Math.max(0, Math.abs(nz - 1) - 0.35) * 40,
        lateral: Math.max(0, Math.abs(ny) - 0.2) * 40,
        alabeo: Math.max(0, alabeo - 35) * 0.4,
        cabeceo: Math.max(0, cabeceo - 20, -cabeceo - 15) * 0.8,
        perdida: tel.avisoPerdida ? 8 : 0,
      };
      let peor = 0;
      for (const clave in partes) {
        molestia += partes[clave];
        if (partes[clave] > peor) { peor = partes[clave]; queja = clave; }
      }
    }
    if (molestia > 0) p.comodidad = Math.max(0, p.comodidad - molestia * dt);
    else p.comodidad = Math.min(100, p.comodidad + 0.25 * dt);

    // Toque con el suelo: cuanto más fuerte, peor.
    if (e.ultimoToque && e.ultimoToque !== p.toqueVisto) {
      p.toqueVisto = e.ultimoToque;
      const fpm = Math.abs(e.ultimoToque.vs * 196.85);
      if (fpm > 600) { p.comodidad = Math.max(0, p.comodidad - 35); return '¡Aterrizaje durísimo! Los pasajeros botan en sus asientos'; }
      if (fpm > 400) { p.comodidad = Math.max(0, p.comodidad - 20); return 'Aterrizaje duro: a los pasajeros no les ha gustado'; }
      if (fpm > 250) { p.comodidad = Math.max(0, p.comodidad - 8); return 'Toque algo firme'; }
      if (fpm < 120) return '¡Toque suavísimo! Los pasajeros aplauden';
      return null;
    }
    if (queja && molestia > 3 && e.t - p.ultimaQueja > 5) { p.ultimaQueja = e.t; return QUEJAS[queja]; }
    return null;
  }

  function cara(c) { return c >= 85 ? '😀' : c >= 65 ? '🙂' : c >= 45 ? '😐' : c >= 25 ? '😟' : '😱'; }
  function estrellas(c) { return c >= 80 ? 3 : c >= 55 ? 2 : 1; }
  function opinion(c) {
    if (c >= 85) return 'Los pasajeros aplauden: ¡qué vuelo tan suave!';
    if (c >= 65) return 'Los pasajeros bajan contentos.';
    if (c >= 45) return 'Algunos pasajeros se marearon un poco.';
    return 'Los pasajeros bajan pálidos y dicen que la próxima vez irán en barco.';
  }
  function lista(nombres) { return nombres.length < 2 ? nombres.join('') : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]; }

  raiz.Pasajeros = { crear, actualizar, cara, estrellas, opinion, lista, KG_POR_PASAJERO };
  if (typeof module !== 'undefined') module.exports = raiz.Pasajeros;
})(typeof window !== 'undefined' ? window : globalThis);
