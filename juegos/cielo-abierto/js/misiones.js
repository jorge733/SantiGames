// Para añadir una misión basta con añadir un objeto a esta lista.
// Pasos posibles: { tipo: 'altura', metros, aeropuerto }, { tipo: 'punto', x, y, z, nombre }, { tipo: 'aterrizar', aeropuerto }.
(function () {
  'use strict';
  const EN_PISTA = { p: [0, 31.27, 650], enTierra: true };

  window.MISIONES = [
    {
      id: 'libre', nombre: 'Vuelo libre', nivel: 'Sin objetivos',
      descripcion: 'La isla entera para ti. Explora las montañas o practica despegues y aterrizajes.',
      consejo: 'Sube el gas con R al máximo y tira suavemente con S cerca de los 60 nudos.',
      inicio: EN_PISTA, viento: [0, 0, 0], turbulencia: 0, pasos: [],
    },
    {
      id: 'despegue', nombre: 'Primer despegue', nivel: 'Iniciación',
      descripcion: 'Despega de Puerto Alba y sube hasta 300 m sobre la pista sin entrar en pérdida.',
      consejo: 'Acelera a fondo, usa Q y E para seguir la línea central y rota a unos 60 nudos.',
      inicio: EN_PISTA, viento: [0, 0, 0], turbulencia: 0,
      pasos: [{ tipo: 'altura', metros: 300, aeropuerto: 'A' }],
    },
    {
      id: 'final', nombre: 'Aproximación final', nivel: 'Fácil',
      descripcion: 'Empiezas alineado con la pista a 3 km. Baja, ajusta la velocidad y toma tierra.',
      consejo: 'Mantén unos 70 nudos. Las luces PAPI a la izquierda deben verse dos blancas y dos rojas.',
      inicio: { p: [0, 155, 3000], v: [0, -2, -40], acelerador: 0.3, motor: 0.4, flaps: 0.66, flapsMando: 0.66, trim: 0.07 },
      viento: [0, 0, 0], turbulencia: 0.15,
      pasos: [{ tipo: 'aterrizar', aeropuerto: 'A' }],
    },
    {
      id: 'circuito', nombre: 'Circuito de tráfico', nivel: 'Intermedio',
      descripcion: 'Despega, vuela el rectángulo alrededor del aeropuerto cruzando los aros y aterriza.',
      consejo: 'Sigue el triángulo naranja de la brújula. Con el aro final a la vista, baja flaps y reduce gas.',
      inicio: EN_PISTA, viento: [1.5, 0, 0], turbulencia: 0.25,
      pasos: [
        { tipo: 'punto', nombre: 'Viraje de salida', x: 0, y: 330, z: -2300 },
        { tipo: 'punto', nombre: 'Tramo de viento en cola', x: -1800, y: 330, z: -2300 },
        { tipo: 'punto', nombre: 'Fin del viento en cola', x: -1800, y: 320, z: 2600 },
        { tipo: 'punto', nombre: 'Tramo final', x: 0, y: 175, z: 3100 },
        { tipo: 'aterrizar', aeropuerto: 'A' },
      ],
    },
    {
      id: 'sinmotor', nombre: 'Fallo de motor', nivel: 'Difícil',
      descripcion: 'El motor se ha parado a 700 m. Planea hasta Puerto Alba: solo tienes un intento.',
      consejo: 'Mantén unos 70 nudos para planear lo máximo posible y deja los flaps para el final.',
      inicio: { p: [0, 720, 5000], v: [0, 0, -40], combustible: 0, motor: 0 },
      viento: [0, 0, 0], turbulencia: 0.2,
      pasos: [{ tipo: 'aterrizar', aeropuerto: 'A' }],
    },
    {
      id: 'travesia', nombre: 'Travesía a Valle Norte', nivel: 'Difícil',
      descripcion: 'Cruza la isla entre montañas con viento lateral y aterriza en la pista de Valle Norte.',
      consejo: 'Vuela a unos 600 m por el pasillo marcado. Corrige la deriva apuntando un poco contra el viento.',
      inicio: EN_PISTA, viento: [3, 0, 0], turbulencia: 0.45,
      pasos: [
        { tipo: 'punto', nombre: 'Salida del valle', x: 0, y: 500, z: -2800 },
        { tipo: 'punto', nombre: 'Paso central', x: 2000, y: 600, z: -3500 },
        { tipo: 'punto', nombre: 'Paso este', x: 4300, y: 560, z: -4400 },
        { tipo: 'punto', nombre: 'Tramo final', x: 5200, y: 300, z: -5300 },
        { tipo: 'aterrizar', aeropuerto: 'B' },
      ],
    },
  ];
})();
