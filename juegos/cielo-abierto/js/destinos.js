// Destinos reales de la aerolínea. Coordenadas y altitud aproximadas de cada aeropuerto.
// El paisaje 3D de cada uno es una recreación libre a partir de su "bioma": no es el terreno real.
(function (raiz) {
  'use strict';

  // Paisajes posibles. Colores de abajo a arriba y cuántos árboles hay.
  const BIOMAS = {
    desierto: { colores: [0xe9cf9a, 0xd9b27a, 0xb98c66, 0x8e6c58], nieve: 0xf6f6ff, arboles: 0, colorArbol: [0x6f8f4a], relieve: 60 },
    altiplano: { colores: [0xcfa577, 0xb98a60, 0x9c7a6a, 0x7f6c7a], nieve: 0xf6f6ff, arboles: 0, colorArbol: [0x6f8f4a], relieve: 90 },
    valle: { colores: [0xb7c27a, 0x9fb468, 0xa08a6a, 0x8d7f96], nieve: 0xf6f6ff, arboles: 0.25, colorArbol: [0x4f8a4a, 0x6f9a50], relieve: 80 },
    verde: { colores: [0x8fd45c, 0x6cbf52, 0x5aa75a, 0x8d7f96], nieve: 0xf6f6ff, arboles: 1, colorArbol: [0x2f8f63, 0x3ca35f, 0x7fbf4a], relieve: 110 },
    patagonia: { colores: [0xd6cf92, 0xc0bb82, 0x9da38a, 0x8d8f96], nieve: 0xf6f6ff, arboles: 0.08, colorArbol: [0x5f7f4a], relieve: 50 },
    llanura: { colores: [0x9bd068, 0x86c05a, 0x78a85a, 0x8d7f96], nieve: 0xf6f6ff, arboles: 0.3, colorArbol: [0x3f8a4a, 0x5f9a50], relieve: 12 },
    tropical: { colores: [0xf0dca0, 0x7ccf5a, 0x4fae55, 0x6c8f7a], nieve: 0xf6f6ff, arboles: 0.6, colorArbol: [0x2f9f5a, 0x4fbf5a], relieve: 15 },
    meseta: { colores: [0xd6c28a, 0xbcae78, 0xa48c68, 0x8d7f96], nieve: 0xf6f6ff, arboles: 0.2, colorArbol: [0x6f8a4a, 0x8a9a50], relieve: 70 },
  };

  // mar: lado del mar (o 'alrededor' en una isla) y a cuántos metros está la costa.
  // cordillera: lado, distancia y altura sobre el aeropuerto. volcanes: [x, z, altura] relativos.
  // urbe: tamaño de la ciudad (0 a 3) y lado donde está. largo: metros de pista.
  const DESTINOS = [
    // Chile
    { codigo: 'SCL', ciudad: 'Santiago', pais: 'Chile', lat: -33.39, lon: -70.79, elev: 474, largo: 3800, bioma: 'valle', cordillera: { lado: 'este', distancia: 11000, altura: 3200 }, urbe: { tam: 3, lado: 'este' } },
    { codigo: 'ARI', ciudad: 'Arica', pais: 'Chile', lat: -18.35, lon: -70.34, elev: 50, largo: 2200, bioma: 'desierto', mar: { lado: 'oeste', distancia: 2500 }, urbe: { tam: 1, lado: 'sur' } },
    { codigo: 'IQQ', ciudad: 'Iquique', pais: 'Chile', lat: -20.54, lon: -70.18, elev: 47, largo: 3350, bioma: 'desierto', mar: { lado: 'oeste', distancia: 2200 }, cordillera: { lado: 'este', distancia: 5500, altura: 700 }, urbe: { tam: 1, lado: 'norte' } },
    { codigo: 'CJC', ciudad: 'Calama', pais: 'Chile', lat: -22.50, lon: -68.90, elev: 2320, largo: 3800, bioma: 'altiplano', volcanes: [[13000, -9000, 3400], [15000, 3000, 3000]], urbe: { tam: 1, lado: 'oeste' } },
    { codigo: 'ANF', ciudad: 'Antofagasta', pais: 'Chile', lat: -23.44, lon: -70.45, elev: 140, largo: 2600, bioma: 'desierto', mar: { lado: 'oeste', distancia: 1800 }, cordillera: { lado: 'este', distancia: 5000, altura: 900 }, urbe: { tam: 1, lado: 'sur' } },
    { codigo: 'LSC', ciudad: 'La Serena', pais: 'Chile', lat: -29.92, lon: -71.20, elev: 146, largo: 1950, bioma: 'valle', mar: { lado: 'oeste', distancia: 3000 }, cordillera: { lado: 'este', distancia: 9000, altura: 1400 }, urbe: { tam: 1, lado: 'oeste' } },
    { codigo: 'CCP', ciudad: 'Concepción', pais: 'Chile', lat: -36.77, lon: -73.06, elev: 8, largo: 2300, bioma: 'verde', mar: { lado: 'oeste', distancia: 4000 }, urbe: { tam: 2, lado: 'sur' } },
    { codigo: 'PMC', ciudad: 'Puerto Montt', pais: 'Chile', lat: -41.44, lon: -73.09, elev: 90, largo: 2700, bioma: 'verde', mar: { lado: 'sur', distancia: 9000 }, volcanes: [[14000, -6000, 2500], [11000, 6500, 1900]], urbe: { tam: 1, lado: 'este' } },
    { codigo: 'BBA', ciudad: 'Balmaceda', pais: 'Chile', lat: -45.92, lon: -71.69, elev: 520, largo: 2500, bioma: 'patagonia', cordillera: { lado: 'oeste', distancia: 8000, altura: 1700 } },
    { codigo: 'PUQ', ciudad: 'Punta Arenas', pais: 'Chile', lat: -53.00, lon: -70.85, elev: 42, largo: 2790, bioma: 'patagonia', mar: { lado: 'este', distancia: 3500 }, urbe: { tam: 1, lado: 'sur' } },
    { codigo: 'IPC', ciudad: 'Isla de Pascua', pais: 'Chile', lat: -27.16, lon: -109.42, elev: 69, largo: 3318, bioma: 'verde', mar: { lado: 'alrededor', distancia: 6500 }, volcanes: [[-4000, -4500, 500], [3500, 3000, 300]], arbolesExtra: -0.9 },
    // Países vecinos
    { codigo: 'MDZ', ciudad: 'Mendoza', pais: 'Argentina', lat: -32.83, lon: -68.79, elev: 704, largo: 2835, bioma: 'valle', cordillera: { lado: 'oeste', distancia: 10000, altura: 3500 }, urbe: { tam: 2, lado: 'sur' } },
    { codigo: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina', lat: -34.82, lon: -58.54, elev: 20, largo: 3300, bioma: 'llanura', mar: { lado: 'este', distancia: 9000 }, urbe: { tam: 3, lado: 'este' } },
    { codigo: 'MVD', ciudad: 'Montevideo', pais: 'Uruguay', lat: -34.84, lon: -56.03, elev: 32, largo: 3200, bioma: 'llanura', mar: { lado: 'sur', distancia: 9500 }, urbe: { tam: 2, lado: 'oeste' } },
    { codigo: 'LIM', ciudad: 'Lima', pais: 'Perú', lat: -12.02, lon: -77.11, elev: 34, largo: 3500, bioma: 'desierto', mar: { lado: 'oeste', distancia: 2500 }, cordillera: { lado: 'este', distancia: 12000, altura: 1600 }, urbe: { tam: 3, lado: 'este' } },
    { codigo: 'GRU', ciudad: 'São Paulo', pais: 'Brasil', lat: -23.43, lon: -46.47, elev: 750, largo: 3700, bioma: 'verde', cordillera: { lado: 'norte', distancia: 13000, altura: 500 }, urbe: { tam: 3, lado: 'oeste' } },
    { codigo: 'BOG', ciudad: 'Bogotá', pais: 'Colombia', lat: 4.70, lon: -74.15, elev: 2548, largo: 3800, bioma: 'verde', cordillera: { lado: 'este', distancia: 11000, altura: 900 }, urbe: { tam: 3, lado: 'este' } },
    // Resto del mundo
    { codigo: 'MEX', ciudad: 'Ciudad de México', pais: 'México', lat: 19.44, lon: -99.07, elev: 2230, largo: 3900, bioma: 'meseta', volcanes: [[14000, 9000, 3200]], urbe: { tam: 3, lado: 'oeste' } },
    { codigo: 'MIA', ciudad: 'Miami', pais: 'Estados Unidos', lat: 25.79, lon: -80.29, elev: 2, largo: 3900, bioma: 'tropical', mar: { lado: 'este', distancia: 9000 }, urbe: { tam: 3, lado: 'este' } },
    { codigo: 'JFK', ciudad: 'Nueva York', pais: 'Estados Unidos', lat: 40.64, lon: -73.78, elev: 4, largo: 4400, bioma: 'llanura', mar: { lado: 'sur', distancia: 3800 }, urbe: { tam: 3, lado: 'oeste' } },
    { codigo: 'LAX', ciudad: 'Los Ángeles', pais: 'Estados Unidos', lat: 33.94, lon: -118.41, elev: 38, largo: 3600, bioma: 'meseta', mar: { lado: 'oeste', distancia: 2500 }, cordillera: { lado: 'este', distancia: 13000, altura: 1500 }, urbe: { tam: 3, lado: 'este' } },
    { codigo: 'MAD', ciudad: 'Madrid', pais: 'España', lat: 40.47, lon: -3.56, elev: 610, largo: 4300, bioma: 'meseta', cordillera: { lado: 'oeste', distancia: 13000, altura: 1500 }, urbe: { tam: 3, lado: 'oeste' } },
    { codigo: 'SYD', ciudad: 'Sídney', pais: 'Australia', lat: -33.95, lon: 151.18, elev: 6, largo: 3960, bioma: 'verde', mar: { lado: 'este', distancia: 3000 }, urbe: { tam: 3, lado: 'norte' } },
    { codigo: 'AKL', ciudad: 'Auckland', pais: 'Nueva Zelanda', lat: -37.01, lon: 174.79, elev: 7, largo: 3635, bioma: 'verde', mar: { lado: 'oeste', distancia: 3000 }, volcanes: [[8000, -7000, 200]], urbe: { tam: 2, lado: 'norte' } },
  ];

  const RAD = Math.PI / 180, RADIO_TIERRA = 6371;
  const buscar = (codigo) => DESTINOS.find((d) => d.codigo === codigo);

  function distancia(a, b) {
    const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(h));
  }

  // Punto de la ruta más corta (círculo máximo) en la fracción t del recorrido.
  function puntoRuta(a, b, t) {
    const v = (d) => [Math.cos(d.lat * RAD) * Math.cos(d.lon * RAD), Math.cos(d.lat * RAD) * Math.sin(d.lon * RAD), Math.sin(d.lat * RAD)];
    const p = v(a), q = v(b);
    const om = Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
    if (om < 1e-6) return { lat: a.lat, lon: a.lon };
    const s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
    const x = s1 * p[0] + s2 * q[0], y = s1 * p[1] + s2 * q[1], z = s1 * p[2] + s2 * q[2];
    return { lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD };
  }

  raiz.Destinos = { DESTINOS, BIOMAS, buscar, distancia, puntoRuta };
  if (typeof module !== 'undefined') module.exports = raiz.Destinos;
})(typeof window !== 'undefined' ? window : globalThis);
