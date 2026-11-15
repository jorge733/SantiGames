// Modo aerolínea: dinero, reputación, flota y tablero de salidas. Se guarda en el navegador.
(function (raiz) {
  'use strict';
  const CLAVE = 'cielo-abierto:aerolinea';

  // Datos de negocio de cada avión (la física está en js/fisica.js).
  const FLOTA = {
    avioneta: { nombre: 'Avioneta', precio: 0, plazas: 3, litro: 2, tasa: 40, reparacion: 400, rota: 60, aproximacion: 70, descripcion: 'Pequeña y fácil de volar. Lleva 3 pasajeros.' },
    regional: { nombre: 'Albatros 72', precio: 2500, plazas: 48, litro: 1.5, tasa: 600, reparacion: 3000, rota: 110, aproximacion: 125, descripcion: 'Turbohélice regional de 48 plazas. Más rápido, más pesado y mucho más rentable.' },
  };

  const PUERTOS = { A: 'Puerto Alba', B: 'Valle Norte' };

  const RUTAS = {
    AB: {
      origen: 'A', destino: 'B', precio: 150, nombre: 'Puerto Alba → Valle Norte',
      pasos: [
        { tipo: 'punto', nombre: 'Salida del valle', x: 0, y: 500, z: -2800 },
        { tipo: 'punto', nombre: 'Paso central', x: 2000, y: 600, z: -3500 },
        { tipo: 'punto', nombre: 'Paso este', x: 4300, y: 560, z: -4400 },
        { tipo: 'punto', nombre: 'Tramo final', x: 5200, y: 300, z: -5300 },
        { tipo: 'aterrizar', aeropuerto: 'B' },
      ],
    },
    BA: {
      origen: 'B', destino: 'A', precio: 150, nombre: 'Valle Norte → Puerto Alba',
      pasos: [
        { tipo: 'altura', metros: 300, aeropuerto: 'B' },
        { tipo: 'punto', nombre: 'Viraje al este', x: 6800, y: 450, z: -10200 },
        { tipo: 'punto', nombre: 'Costa este', x: 6600, y: 600, z: -7200 },
        { tipo: 'punto', nombre: 'Paso central', x: 2000, y: 600, z: -3500 },
        { tipo: 'punto', nombre: 'Tramo de viento en cola', x: -1800, y: 400, z: -2300 },
        { tipo: 'punto', nombre: 'Fin del viento en cola', x: -1800, y: 320, z: 2600 },
        { tipo: 'punto', nombre: 'Tramo final', x: 0, y: 175, z: 3100 },
        { tipo: 'aterrizar', aeropuerto: 'A' },
      ],
    },
    PAN: {
      origen: 'A', destino: 'A', precio: 110, nombre: 'Vuelo panorámico por las montañas', turistas: true,
      pasos: [
        { tipo: 'punto', nombre: 'Salida del valle', x: 0, y: 500, z: -2800 },
        { tipo: 'punto', nombre: 'Mirador de las montañas', x: 2000, y: 620, z: -3500 },
        { tipo: 'punto', nombre: 'Tramo de viento en cola', x: -1800, y: 400, z: -2300 },
        { tipo: 'punto', nombre: 'Fin del viento en cola', x: -1800, y: 320, z: 2600 },
        { tipo: 'punto', nombre: 'Tramo final', x: 0, y: 175, z: 3100 },
        { tipo: 'aterrizar', aeropuerto: 'A' },
      ],
    },
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
    return { saldo: 300, reputacion: 60, flota: ['avioneta'], avion: 'avioneta', ubicacion: 'A', vuelos: 0, semilla: 1 };
  }

  function cargar(almacen) {
    try {
      const datos = JSON.parse(almacen.getItem(CLAVE));
      if (datos && Array.isArray(datos.flota)) return Object.assign(nuevo(), datos);
    } catch (_) { /* sin datos guardados */ }
    return nuevo();
  }

  function guardar(almacen, estado) {
    try { almacen.setItem(CLAVE, JSON.stringify(estado)); } catch (_) { /* almacenamiento no disponible */ }
  }

  const dinero = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL');

  // Tres vuelos desde el aeropuerto actual; cambian después de cada vuelo completado.
  function salidas(estado) {
    const azar = azarCon(estado.semilla * 7919 + (estado.ubicacion === 'A' ? 1 : 2));
    const avion = FLOTA[estado.avion];
    const rutas = Object.entries(RUTAS).filter(([, r]) => r.origen === estado.ubicacion);
    const lista = [];
    for (let i = 0; i < 3; i++) {
      const [clave, ruta] = rutas[i % rutas.length];
      const tirada = azar();
      const clima = CLIMAS[tirada < 0.45 ? 0 : tirada < 0.8 ? 1 : 2];
      const ocupacion = Math.max(0.2, Math.min(1, 0.35 + (estado.reputacion / 100) * 0.6 + (azar() - 0.5) * 0.25));
      const pasajeros = Math.max(1, Math.round(avion.plazas * ocupacion));
      const precio = Math.round(ruta.precio * (1 + clima.extra) / 5) * 5;
      const lado = azar() < 0.5 ? -1 : 1;
      lista.push({
        id: `${estado.semilla}-${i}`, ruta: clave, numero: 'CA ' + (100 + Math.floor(azar() * 900)),
        hora: String(7 + Math.floor(azar() * 12)).padStart(2, '0') + ':' + ['00', '15', '30', '45'][Math.floor(azar() * 4)],
        nombre: ruta.nombre, origen: ruta.origen, destino: ruta.destino, clima,
        viento: [lado * clima.viento, 0, clima.viento * 0.3], pasajeros, precio, avion: estado.avion,
      });
    }
    return lista;
  }

  // Convierte una salida en una misión que el juego sabe volar.
  function mision(oferta, alturaEnTierra, aeropuerto) {
    const ruta = RUTAS[oferta.ruta], avion = FLOTA[oferta.avion], ap = aeropuerto(ruta.origen);
    return {
      id: 'aerolinea', nombre: `Vuelo ${oferta.numero}`, nivel: oferta.clima.nombre,
      descripcion: ruta.nombre, avion: oferta.avion, pasajeros: oferta.pasajeros,
      consejo: `Rota a unos ${avion.rota} nudos y sigue el triángulo naranja de la brújula. En la final, unos ${avion.aproximacion} nudos.`,
      inicio: { p: [ap.x, ap.y + alturaEnTierra, ap.z + 650], enTierra: true },
      viento: oferta.viento, turbulencia: oferta.clima.turbulencia,
      pasos: ruta.pasos, aerolinea: oferta,
    };
  }

  // resultado: 'ok' (aterrizaje en pista), 'fuera' (junto a la pista), 'campo' (lejos del aeropuerto), 'choque' o 'abandono'.
  function liquidar(estado, oferta, r) {
    const avion = FLOTA[oferta.avion], ruta = RUTAS[oferta.ruta];
    const lineas = [];
    const billetes = oferta.pasajeros * oferta.precio;
    let reputacion = 0;
    if (r.resultado === 'campo') {
      lineas.push(['Aterrizaje lejos del aeropuerto: billetes devueltos', 0]);
      lineas.push(['Grúa y transporte de los pasajeros', -avion.tasa * 2]);
      reputacion = -10;
    } else if (r.resultado === 'choque') {
      lineas.push(['Billetes devueltos a los pasajeros', 0]);
      lineas.push(['Reparación del avión', -avion.reparacion]);
      reputacion = -20;
    } else if (r.resultado === 'abandono') {
      lineas.push(['Vuelo cancelado: billetes devueltos', 0]);
      reputacion = -5;
    } else {
      lineas.push([`Billetes (${oferta.pasajeros} × ${dinero(oferta.precio)})`, billetes]);
      const factorPropina = (r.comodidad - 60) / 100 * (ruta.turistas ? 0.9 : 0.5);
      if (r.resultado === 'ok' && factorPropina > 0) lineas.push(['Propinas por un vuelo cómodo', billetes * factorPropina]);
      if (r.resultado === 'ok' && r.estrellas > 1) lineas.push([`Bono por aterrizaje de ${r.estrellas} estrellas`, billetes * (r.estrellas === 3 ? 0.1 : 0.05)]);
      lineas.push([`Combustible (${Math.round(r.combustible)} L)`, -r.combustible * avion.litro]);
      lineas.push([`Tasas del aeropuerto de ${PUERTOS[ruta.destino]}`, -avion.tasa]);
      if (r.resultado === 'fuera') lineas.push(['Grúa para sacar el avión de la hierba', -avion.tasa]);
      reputacion = Math.max(-10, Math.min(6, (r.comodidad - 60) / 8)) + (r.resultado === 'ok' ? r.estrellas - 1 : -8);
    }
    const total = lineas.reduce((s, l) => s + l[1], 0);
    const antes = estado.reputacion;
    estado.saldo = Math.round(estado.saldo + total);
    estado.reputacion = Math.round(Math.max(0, Math.min(100, estado.reputacion + reputacion)));
    if (r.resultado === 'ok' || r.resultado === 'fuera') {
      estado.ubicacion = ruta.destino;
      estado.vuelos++;
      estado.semilla++;
    }
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

  function usar(estado, clave) {
    if (!estado.flota.includes(clave) || estado.avion === clave) return false;
    estado.avion = clave;
    estado.semilla++;
    return true;
  }

  raiz.Aerolinea = { FLOTA, PUERTOS, RUTAS, nuevo, cargar, guardar, salidas, mision, liquidar, comprar, usar, dinero };
  if (typeof module !== 'undefined') module.exports = raiz.Aerolinea;
})(typeof window !== 'undefined' ? window : globalThis);
