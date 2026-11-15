// Modo aerolínea (Benedetto): dinero, reputación, flota y tablero de salidas entre destinos reales.
// Se guarda en el navegador. La geografía de cada destino está en js/destinos.js.
(function (raiz) {
  'use strict';
  const CLAVE = 'cielo-abierto:aerolinea';
  const D = () => raiz.Destinos;

  // Datos de negocio de cada avión (la física está en js/fisica.js).
  // litroKm: consumo en crucero; maniobras: litros para despegue, ascenso, descenso y llegada.
  const FLOTA = {
    avioneta: { nombre: 'Avioneta', precio: 0, plazas: 3, alcance: 950, crucero: 220, litroKm: 0.095, maniobras: 6, precioLitro: 2, tasa: 25, reparacion: 400,
      descripcion: 'Pequeña y fácil de volar. Lleva 3 pasajeros a ciudades cercanas.' },
    regional: { nombre: 'Albatros 72', precio: 2000, plazas: 48, alcance: 1700, crucero: 510, litroKm: 1.1, maniobras: 150, precioLitro: 1.2, tasa: 400, reparacion: 3000,
      descripcion: 'Turbohélice de 48 plazas. Llega a casi todo Chile y a los países vecinos.' },
    jet: { nombre: 'Cóndor 300', precio: 40000, plazas: 300, alcance: 14000, crucero: 900, litroKm: 7, maniobras: 3000, precioLitro: 0.9, tasa: 6000, reparacion: 30000,
      descripcion: 'Jet de 300 plazas y 14.000 km de alcance: Isla de Pascua, Miami, Madrid o Sídney.' },
  };

  const CLIMAS = [
    { nombre: 'Despejado', viento: 0, turbulencia: 0.1, extra: 0 },
    { nombre: 'Brisa lateral', viento: 2, turbulencia: 0.25, extra: 0.1 },
    { nombre: 'Viento y turbulencia', viento: 4, turbulencia: 0.5, extra: 0.3 },
  ];

  function azarCon(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function nuevo() {
    return { saldo: 300, reputacion: 60, flota: ['avioneta'], avion: 'avioneta', ubicacion: 'SCL', vuelos: 0, semilla: 1 };
  }

  function cargar(almacen) {
    try {
      const datos = JSON.parse(almacen.getItem(CLAVE));
      if (datos && Array.isArray(datos.flota)) {
        const e = Object.assign(nuevo(), datos);
        e.flota = e.flota.filter((k) => FLOTA[k]);
        if (!e.flota.length) e.flota = ['avioneta'];
        if (!FLOTA[e.avion] || !e.flota.includes(e.avion)) e.avion = e.flota[0];
        if (!D().buscar(e.ubicacion)) e.ubicacion = 'SCL'; // partidas guardadas en la isla
        return e;
      }
    } catch (_) { /* sin datos guardados */ }
    return nuevo();
  }

  function guardar(almacen, estado) {
    try { almacen.setItem(CLAVE, JSON.stringify(estado)); } catch (_) { /* almacenamiento no disponible */ }
  }

  const dinero = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL');
  const km = (n) => Math.round(n).toLocaleString('es-CL') + ' km';
  function duracion(horas) {
    let h = Math.floor(horas), m = Math.round((horas - h) * 60 / 5) * 5;
    if (m === 60) { h++; m = 0; }
    return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  }
  const precioBillete = (distancia) => Math.round((90 + 0.1 * distancia) / 5) * 5;

  // Litros para un vuelo: crucero, maniobras y un 10 % de reserva.
  function combustibleNecesario(clave, distancia) {
    const a = FLOTA[clave];
    return Math.round((distancia * a.litroKm + a.maniobras) * 1.1);
  }

  // Hasta cuatro vuelos desde la ciudad actual a destinos al alcance del avión en servicio.
  function salidas(estado) {
    const origen = D().buscar(estado.ubicacion), avion = FLOTA[estado.avion];
    const azar = azarCon(estado.semilla * 7919 + estado.ubicacion.charCodeAt(0) * 31 + estado.ubicacion.charCodeAt(2));
    const candidatos = D().DESTINOS.filter((d) => d !== origen && D().distancia(origen, d) <= avion.alcance);
    for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
    // Variedad: hasta dos nacionales y dos internacionales de países distintos; si faltan, se completa con el resto.
    const nacional = candidatos.filter((d) => d.pais === origen.pais), elegidos = nacional.slice(0, 2);
    for (const d of candidatos) if (elegidos.length < 4 && d.pais !== origen.pais && !elegidos.some((x) => x.pais === d.pais)) elegidos.push(d);
    for (const d of candidatos) if (elegidos.length < 4 && !elegidos.includes(d)) elegidos.push(d);
    return elegidos.map((destino, i) => {
      const distancia = D().distancia(origen, destino);
      const tirada = azar();
      const clima = CLIMAS[tirada < 0.45 ? 0 : tirada < 0.8 ? 1 : 2];
      const ocupacion = Math.max(0.2, Math.min(1, 0.35 + (estado.reputacion / 100) * 0.6 + (azar() - 0.5) * 0.25));
      const lado = azar() < 0.5 ? -1 : 1;
      return {
        id: `${estado.semilla}-${i}`, numero: 'BN ' + (100 + Math.floor(azar() * 225) * 4 + i), // distinto para cada salida del tablero
        hora: String(6 + Math.floor(azar() * 16)).padStart(2, '0') + ':' + ['00', '15', '30', '45'][Math.floor(azar() * 4)],
        origen: origen.codigo, destino: destino.codigo, distancia, horas: distancia / avion.crucero + 0.5,
        clima, viento: [lado * clima.viento, 0, clima.viento * 0.3],
        pasajeros: Math.max(1, Math.round(avion.plazas * ocupacion)),
        precio: Math.round(precioBillete(distancia) * (1 + clima.extra) / 5) * 5,
        avion: estado.avion, combustible: combustibleNecesario(estado.avion, distancia),
      };
    });
  }

  // resultado: 'ok' (aterrizaje en pista), 'fuera' (junto a la pista), 'campo' (lejos del aeropuerto),
  // 'choque' o 'abandono'. r.lugar: código del aeropuerto donde queda el avión.
  function liquidar(estado, oferta, r) {
    const avion = FLOTA[oferta.avion], destino = D().buscar(oferta.destino);
    const lineas = [];
    const billetes = oferta.pasajeros * oferta.precio;
    const litros = Math.max(0, r.combustible || 0);
    const gasolina = [`Combustible (${Math.round(litros).toLocaleString('es-CL')} L)`, -litros * avion.precioLitro];
    let reputacion = 0;
    if (r.resultado === 'campo') {
      lineas.push(['Aterrizaje lejos del aeropuerto: billetes devueltos', 0], gasolina, ['Grúa y transporte de los pasajeros', -avion.tasa * 2]);
      reputacion = -10;
    } else if (r.resultado === 'choque') {
      lineas.push(['Billetes devueltos a los pasajeros', 0], ['Reparación del avión', -avion.reparacion]);
      reputacion = -20;
    } else if (r.resultado === 'abandono') {
      lineas.push(['Vuelo cancelado: billetes devueltos', 0]);
      if (litros > 0) lineas.push(gasolina);
      reputacion = -5;
    } else {
      lineas.push([`Billetes (${oferta.pasajeros} × ${dinero(oferta.precio)})`, billetes]);
      const propina = (r.comodidad - 60) / 100 * 0.5;
      if (r.resultado === 'ok' && propina > 0) lineas.push(['Propinas por un vuelo cómodo', billetes * propina]);
      if (r.resultado === 'ok' && r.estrellas > 1) lineas.push([`Bono por aterrizaje de ${r.estrellas} estrellas`, billetes * (r.estrellas === 3 ? 0.1 : 0.05)]);
      lineas.push(gasolina, [`Tasas del aeropuerto de ${destino.ciudad}`, -avion.tasa]);
      if (r.resultado === 'fuera') lineas.push(['Grúa para sacar el avión de la hierba', -avion.tasa]);
      reputacion = Math.max(-10, Math.min(6, (r.comodidad - 60) / 8)) + (r.resultado === 'ok' ? r.estrellas - 1 : -8);
    }
    const total = lineas.reduce((s, l) => s + l[1], 0);
    const antes = estado.reputacion;
    estado.saldo = Math.round(estado.saldo + total);
    estado.reputacion = Math.round(Math.max(0, Math.min(100, estado.reputacion + reputacion)));
    if (r.lugar && D().buscar(r.lugar)) estado.ubicacion = r.lugar;
    if (r.resultado === 'ok' || r.resultado === 'fuera' || r.resultado === 'campo') estado.vuelos++;
    estado.semilla++;
    return { lineas, total, reputacionAntes: antes, reputacion: estado.reputacion, saldo: estado.saldo };
  }

  function comprar(estado, clave) {
    const avion = FLOTA[clave];
    if (!avion || estado.flota.includes(clave) || estado.saldo < avion.precio) return false;
    estado.saldo -= avion.precio;
    estado.flota.push(clave);
    estado.avion = clave;
    estado.semilla++; // el tablero se rehace con el avión nuevo
    return true;
  }

  // ¿Puede este avión salir hacia algún destino desde la ciudad actual?
  function tieneAlcance(estado, clave) {
    const origen = D().buscar(estado.ubicacion);
    return D().DESTINOS.some((d) => d !== origen && D().distancia(origen, d) <= FLOTA[clave].alcance);
  }

  function usar(estado, clave) {
    if (!estado.flota.includes(clave) || estado.avion === clave || !tieneAlcance(estado, clave)) return false;
    estado.avion = clave;
    estado.semilla++;
    return true;
  }

  raiz.Aerolinea = { FLOTA, tieneAlcance, nuevo, cargar, guardar, salidas, liquidar, comprar, usar, dinero, km, duracion, combustibleNecesario, precioBillete };
  if (typeof module !== 'undefined') module.exports = raiz.Aerolinea;
})(typeof window !== 'undefined' ? window : globalThis);
