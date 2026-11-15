// Pilotaje asistido: la palanca pide una actitud y el avión la mantiene sola.
// - Lateral: la palanca a un lado pide inclinación (hasta 30°); al soltarla, alas niveladas.
// - Longitudinal: la palanca cambia poco a poco la senda (subir o bajar); al soltarla, el avión sigue
//   por la misma senda: nivelado si iba nivelado, bajando a 3° si iba en aproximación.
// - Protecciones: no deja entrar en pérdida, compensa (trim) solo y coordina el timón en los virajes.
// Las ganancias salen de la autoridad real de los mandos de cada avión, así funciona igual en los tres.
(function (raiz) {
  'use strict';
  const RAD = Math.PI / 180, RHO0 = 1.225;
  const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
  const INCLINACION_MAX = 30 * RAD, SENDA_MAX = 15 * RAD, SENDA_MIN = -10 * RAD, RITMO_SENDA = 5 * RAD;

  function crear() {
    return { activa: false, senda: 0, alfa: 0, morro: 0, integral: 0 };
  }

  function velocidadCuerpo(F, e) {
    return F.rotar([-e.q[0], -e.q[1], -e.q[2], e.q[3]], e.v);
  }

  // entrada: { x, y } en -1..1 (x a la derecha, y hacia ti = morro arriba). Devuelve cabeceo, alabeo y timón.
  function mandar(as, F, e, tel, entrada, dt, trimManual) {
    const A = e.modelo;
    const V = Math.max(10, Math.hypot(e.v[0], e.v[1], e.v[2]));
    const qd = 0.5 * RHO0 * Math.exp(-Math.max(0, e.p[1]) / 8500) * V * V;
    // En tierra o recién despegado: mando directo, y la actitud asistida arranca desde la actual.
    if (e.enTierra || e.tiempoAire < 0.6) {
      as.activa = false;
      return null;
    }
    const senda = Math.atan2(e.v[1], Math.hypot(e.v[0], e.v[2]));
    if (!as.activa) { as.activa = true; as.senda = senda; as.alfa = e.alfa; as.integral = 0; }

    // ---- Cabeceo: la palanca cambia la senda objetivo; soltar la mantiene ----
    as.senda = limitar(as.senda + entrada.y * RITMO_SENDA * dt, SENDA_MIN, SENDA_MAX);
    // Morro objetivo = senda + ángulo de ataque (filtrado para no reaccionar a cada ráfaga).
    as.alfa += (e.alfa - as.alfa) * Math.min(1, dt * 1.5);
    as.morro = as.senda + as.alfa + (as.senda - senda) * 1.2;
    // Protección de pérdida: si el ala se acerca al ángulo crítico, se baja la senda y el morro.
    const margen = (e.alfaEntrada || 15 * RAD) - 6 * RAD - e.alfa;
    if (margen < 0) { as.senda = Math.min(as.senda, senda); as.morro = Math.min(as.morro, tel.cabeceo + margen * 2.5); }
    // Que el objetivo no se aleje demasiado de donde está el morro (evita tirones).
    as.morro = limitar(as.morro, tel.cabeceo - 8 * RAD, tel.cabeceo + 8 * RAD);
    const qCola = qd + A.estela * e.motor * e.motor;
    const autoridadCabeceo = Math.max(1e-3, (qCola * A.S * A.cuerda * A.cola * 22 * RAD) / A.inercia.cabeceo);
    const wn = 1.6, zeta = 0.95;
    const errorMorro = as.morro - tel.cabeceo;
    as.integral = limitar(as.integral + errorMorro * 0.6 * dt, -0.6, 0.6); // compensador automático
    let cabeceo = (wn * wn * errorMorro - 2 * zeta * wn * e.w[0]) / autoridadCabeceo + as.integral - (trimManual || 0);

    // ---- Alabeo: la palanca pide inclinación; soltarla nivela las alas ----
    const inclinacion = entrada.x * INCLINACION_MAX;
    const autoridadAlabeo = Math.max(1e-3, (qd * A.S * A.envergadura * 0.15 * (1 - 0.6 * e.perdida) * 17 * RAD) / A.inercia.alabeo);
    const wa = 2.2, za = 0.9;
    const ritmoAlabeo = -e.w[2]; // positivo = alabeo a la derecha
    const alabeo = (wa * wa * (inclinacion - tel.alabeo) - 2 * za * wa * ritmoAlabeo) / autoridadAlabeo;

    // ---- Timón: coordina el viraje (sin derrape) ----
    const vb = velocidadCuerpo(F, e);
    const derrape = Math.atan2(vb[0], Math.hypot(vb[1], vb[2]));
    const timon = limitar(derrape * 6, -1, 1);

    return { cabeceo: limitar(cabeceo, -1, 1), alabeo: limitar(alabeo, -1, 1), timon };
  }

  raiz.Asistencia = { crear, mandar };
  if (typeof module !== 'undefined') module.exports = raiz.Asistencia;
})(typeof window !== 'undefined' ? window : globalThis);
