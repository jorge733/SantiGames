// Bucle principal: mandos, cámaras, misiones, sonido e interfaz.
(function () {
  'use strict';
  const T = window.Terreno, F = window.Fisica, P = window.Pasajeros, AL = window.Aerolinea, DS = window.Destinos;
  const PASO = 1 / 240;
  const $ = (id) => document.getElementById(id);

  // Pantalla táctil sin ratón (celular o tablet): se muestran los mandos en pantalla.
  let tactil = navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
  const lienzo = $('escena');
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, logarithmicDepthBuffer: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio, tactil ? 1.5 : 2));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  // Respuesta de color de cine (ACES): luces suaves y sombras con matiz, más cerca de una foto real.
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.05;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(62, 1, 0.3, 45000);
  const mundo3d = window.Mundo.crear(escena);
  const panel = $('panel');
  const ctxPanel = panel.getContext('2d');

  let pasajeros = null, textoPasajeros = '', combustibleInicial = 0;
  const almacen = { getItem: leerSeguro, setItem: guardarSeguro };
  function leerSeguro(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function guardarSeguro(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } }
  const aerolinea = AL.cargar(almacen);
  // Escenario 3D actual: código de un destino real, o null para la isla de práctica.
  let escenarioActual;
  function ponerEscenario(codigo) {
    if (escenarioActual === codigo) return;
    escenarioActual = codigo;
    T.configurar(codigo ? DS.buscar(codigo) : null);
    mundo3d.reconstruir();
  }
  const nombreDe = (codigo) => { const d = DS.buscar(codigo); return `${d.ciudad} (${d.codigo})`; };
  let estado = 'menu', e = null, mision = null, indicePaso = 0, modoCamara = 0, acumulado = 0, ultimo = performance.now();
  const mundo = { altura: T.altura, viento: [0, 0, 0], turbulencia: 0 };
  const mando = { acelerador: 0, cabeceo: 0, alabeo: 0, timon: 0, flaps: 0, trim: 0, freno: 0 };
  const teclas = new Set();
  // Estado de los mandos táctiles. palanca: -1..1 (x a la derecha, y hacia abajo = tirar).
  const toque = { palancaX: 0, palancaY: 0, palanca: false, mantener: new Set(), inclinar: false, inclinX: 0, inclinY: 0 };
  const qCam = new THREE.Quaternion();

  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (_) { /* almacenamiento no disponible */ } }
  function leer(clave) { try { return localStorage.getItem(clave); } catch (_) { return null; } }
  const estrellasDe = (id) => Number(leer('cielo-abierto:' + id)) || 0;
  const pintaEstrellas = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const aeropuerto = (id) => T.AEROPUERTOS.find((a) => a.id === id);

  // ---- Sonido sintetizado: no hace falta ningún archivo de audio ----
  const sonido = { ctx: null, silencio: leer('cielo-abierto:silencio') === '1' };
  function iniciarSonido() {
    if (sonido.ctx) { sonido.ctx.resume(); return; }
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    const c = new Contexto();
    sonido.ctx = c;
    sonido.maestro = c.createGain();
    sonido.maestro.gain.value = sonido.silencio ? 0 : 0.5;
    sonido.maestro.connect(c.destination);
    const filtro = c.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 420;
    sonido.motor = c.createOscillator(); sonido.motor.type = 'sawtooth';
    sonido.gMotor = c.createGain(); sonido.gMotor.gain.value = 0;
    sonido.motor.connect(filtro).connect(sonido.gMotor).connect(sonido.maestro);
    sonido.motor.start();
    const datos = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const canal = datos.getChannelData(0);
    for (let i = 0; i < canal.length; i++) canal[i] = Math.random() * 2 - 1;
    const ruido = c.createBufferSource(); ruido.buffer = datos; ruido.loop = true;
    const fAire = c.createBiquadFilter(); fAire.type = 'bandpass'; fAire.frequency.value = 650;
    sonido.gAire = c.createGain(); sonido.gAire.gain.value = 0;
    ruido.connect(fAire).connect(sonido.gAire).connect(sonido.maestro);
    ruido.start();
    sonido.alarma = c.createOscillator(); sonido.alarma.type = 'square'; sonido.alarma.frequency.value = 830;
    sonido.gAlarma = c.createGain(); sonido.gAlarma.gain.value = 0;
    sonido.alarma.connect(sonido.gAlarma).connect(sonido.maestro);
    sonido.alarma.start();
  }
  function actualizarSonido(t, activo) {
    if (!sonido.ctx) return;
    const ahora = sonido.ctx.currentTime;
    sonido.motor.frequency.setTargetAtTime(35 + (t ? e.motor : 0) * 150, ahora, 0.08);
    sonido.gMotor.gain.setTargetAtTime(activo ? 0.16 + e.motor * 0.3 : 0, ahora, 0.1);
    sonido.gAire.gain.setTargetAtTime(activo ? Math.min(0.28, (t.nudos / 140) * 0.28) : 0, ahora, 0.15);
    sonido.gAlarma.gain.setTargetAtTime(activo && t.avisoPerdida ? 0.07 : 0, ahora, 0.03);
  }

  // ---- Mandos ----
  const hay = (...codigos) => codigos.some((c) => teclas.has(c));
  function acercar(actual, objetivo, dt) {
    const velocidad = objetivo === 0 ? 4 : 2.2;
    return actual + Math.max(-velocidad * dt, Math.min(velocidad * dt, objetivo - actual));
  }
  const mantiene = (nombre) => toque.mantener.has(nombre);
  // Curva suave para la palanca: precisa cerca del centro y con todo el recorrido en el borde.
  const curva = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
  function seguir(actual, objetivo, dt) { return actual + (objetivo - actual) * (1 - Math.exp(-12 * dt)); }
  function leerMandos(dt) {
    const cab = (hay('KeyS', 'ArrowDown') ? 1 : 0) - (hay('KeyW', 'ArrowUp') ? 1 : 0);
    const alab = (hay('KeyD', 'ArrowRight') ? 1 : 0) - (hay('KeyA', 'ArrowLeft') ? 1 : 0);
    const tim = (hay('KeyE') || mantiene('timon-der') ? 1 : 0) - (hay('KeyQ') || mantiene('timon-izq') ? 1 : 0);
    // Una tecla es todo o nada: a más velocidad, menos recorrido de elevador para no entrar en pérdida.
    const velocidad = e ? Math.hypot(e.v[0], e.v[1], e.v[2]) * 1.94384 : 0;
    const recorrido = Math.min(1, Math.pow((e ? e.modelo.velocidadMando : 62) / Math.max(velocidad, 1), 2));
    if (toque.palanca && !cab && !alab) {
      // La palanca táctil es proporcional: sigue al dedo casi sin retraso.
      mando.cabeceo = seguir(mando.cabeceo, curva(toque.palancaY) * recorrido, dt);
      mando.alabeo = seguir(mando.alabeo, curva(toque.palancaX), dt);
    } else if (toque.inclinar && !cab && !alab) {
      // Inclinación del celular: también proporcional, algo más suave para filtrar el temblor de las manos.
      mando.cabeceo = seguir(mando.cabeceo, curva(toque.inclinY) * recorrido, dt * 0.6);
      mando.alabeo = seguir(mando.alabeo, curva(toque.inclinX), dt * 0.6);
    } else {
      mando.cabeceo = acercar(mando.cabeceo, cab * recorrido, dt);
      mando.alabeo = acercar(mando.alabeo, alab, dt);
    }
    mando.timon = acercar(mando.timon, tim, dt);
    // Pilotaje asistido (en el aire): la palanca pide actitud y el avión la mantiene.
    if (asistido && e) {
      let x = alab, y = cab;
      if (toque.palanca && !cab && !alab) { x = toque.palancaX; y = curva(toque.palancaY); }
      else if (toque.inclinar && !cab && !alab) { x = toque.inclinX; y = curva(toque.inclinY); }
      const r = window.Asistencia.mandar(asistencia, F, e, F.telemetria(e, mundo), { x, y }, dt, mando.trim);
      if (r) {
        mando.cabeceo = r.cabeceo;
        mando.alabeo = r.alabeo;
        mando.timon = Math.max(-1, Math.min(1, r.timon + tim)); // el timón manual se suma
      }
    }
    if (hay('KeyR')) mando.acelerador = Math.min(1, mando.acelerador + 0.5 * dt);
    if (hay('KeyF')) mando.acelerador = Math.max(0, mando.acelerador - 0.5 * dt);
    if (hay('KeyT') || mantiene('trim-arriba')) mando.trim = Math.min(0.6, mando.trim + 0.15 * dt);
    if (hay('KeyG') || mantiene('trim-abajo')) mando.trim = Math.max(-0.6, mando.trim - 0.15 * dt);
    mando.freno = hay('Space') || mantiene('freno') ? 1 : 0;
  }

  // Asistido por defecto en pantallas táctiles; se cambia con el botón o la tecla V y se recuerda.
  const asistencia = window.Asistencia.crear();
  let asistido = leer('cielo-abierto:asistido') === null ? tactil : leer('cielo-abierto:asistido') === '1';
  function pintarAsistido() {
    const b = $('t-asistido');
    if (b) { b.classList.toggle('activo', asistido); b.setAttribute('aria-pressed', String(asistido)); }
  }
  function alternarAsistido() {
    asistido = !asistido;
    asistencia.activa = false;
    guardar('cielo-abierto:asistido', asistido ? '1' : '0');
    pintarAsistido();
    avisar(asistido ? 'Pilotaje asistido: el avión se mantiene estable solo' : 'Pilotaje manual: mandos directos', 2500);
  }

  function cambiarFlaps(paso) { mando.flaps = Math.max(0, Math.min(1, Math.round(mando.flaps * 3 + paso) / 3)); }
  function cambiarCamara() { modoCamara = (modoCamara + 1) % 3; avisar(['Cámara exterior', 'Cámara de cabina', 'Cámara de torre'][modoCamara]); }
  function alternarSonido() {
    sonido.silencio = !sonido.silencio;
    guardar('cielo-abierto:silencio', sonido.silencio ? '1' : '0');
    if (sonido.maestro) sonido.maestro.gain.value = sonido.silencio ? 0 : 0.5;
    avisar(sonido.silencio ? 'Sonido apagado' : 'Sonido encendido');
    $('t-sonido').textContent = sonido.silencio ? 'Sin sonido' : 'Sonido';
  }
  function soltarMandos() {
    teclas.clear();
    toque.mantener.clear();
    toque.palanca = false; toque.palancaX = 0; toque.palancaY = 0;
    for (const b of document.querySelectorAll('#tactil [data-mantener].activo')) b.classList.remove('activo');
    if (typeof dejarPalanca === 'function') dejarPalanca();
  }

  window.addEventListener('keydown', (ev) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    if (estado === 'vuelo') {
      teclas.add(ev.code);
      if (ev.code === 'KeyX') cambiarFlaps(1);
      if (ev.code === 'KeyZ') cambiarFlaps(-1);
      if (ev.code === 'KeyC') cambiarCamara();
      if (ev.code === 'KeyV') alternarAsistido();
      if (ev.code === 'KeyP' || ev.code === 'Escape') pausar(true);
    } else if (estado === 'pausa' && (ev.code === 'KeyP' || ev.code === 'Escape')) pausar(false);
    if (ev.code === 'KeyM') alternarSonido();
  });
  window.addEventListener('keyup', (ev) => teclas.delete(ev.code));
  window.addEventListener('blur', () => { soltarMandos(); if (estado === 'vuelo') pausar(true); });
  // (en el crucero no hace falta pausar: el piloto automático sigue y el mapa espera)
  document.addEventListener('visibilitychange', () => { if (document.hidden) { soltarMandos(); if (estado === 'vuelo') pausar(true); } });

  // ---- Mandos táctiles ----
  function activarTactil() {
    if (tactil && document.body.classList.contains('tactil')) return;
    tactil = true;
    document.body.classList.add('tactil');
    pintarMenu();
    ajustar();
  }
  // Un aparato con ratón y pantalla táctil pasa a modo táctil en cuanto se toca la pantalla.
  window.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'touch') activarTactil(); }, true);

  const zonaPalanca = $('zona-palanca'), palanca = $('palanca'), pomo = $('pomo');
  let dedoPalanca = null, centroPalanca = null;
  function dejarPalanca() {
    dedoPalanca = null;
    toque.palanca = false; toque.palancaX = 0; toque.palancaY = 0;
    palanca.classList.remove('libre');
    palanca.style.left = palanca.style.top = palanca.style.bottom = '';
    pomo.style.transform = '';
  }
  function moverPalanca(ev) {
    const radio = palanca.offsetWidth / 2;
    let dx = ev.clientX - centroPalanca.x, dy = ev.clientY - centroPalanca.y;
    const d = Math.hypot(dx, dy);
    if (d > radio) { dx *= radio / d; dy *= radio / d; }
    toque.palancaX = dx / radio;
    toque.palancaY = dy / radio;
    pomo.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  zonaPalanca.addEventListener('pointerdown', (ev) => {
    if (dedoPalanca !== null || estado !== 'vuelo') return;
    ev.preventDefault();
    dedoPalanca = ev.pointerId;
    zonaPalanca.setPointerCapture(ev.pointerId);
    // La palanca aparece donde se apoya el dedo, sin salirse de la zona.
    const caja = zonaPalanca.getBoundingClientRect(), radio = palanca.offsetWidth / 2;
    const x = Math.max(caja.left + radio, Math.min(caja.right - radio, ev.clientX));
    const y = Math.max(caja.top + radio, Math.min(caja.bottom - radio, ev.clientY));
    centroPalanca = { x, y };
    palanca.classList.add('libre');
    palanca.style.left = (x - caja.left - radio) + 'px';
    palanca.style.top = (y - caja.top - radio) + 'px';
    palanca.style.bottom = 'auto';
    toque.palanca = true;
    moverPalanca(ev);
  });
  zonaPalanca.addEventListener('pointermove', (ev) => { if (ev.pointerId === dedoPalanca) moverPalanca(ev); });
  for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zonaPalanca.addEventListener(tipo, (ev) => { if (ev.pointerId === dedoPalanca) dejarPalanca(); });
  }

  // Botones que actúan mientras se mantienen pulsados (timón, frenos, compensador).
  for (const b of document.querySelectorAll('[data-mantener]')) {
    const nombre = b.dataset.mantener;
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      b.setPointerCapture(ev.pointerId);
      toque.mantener.add(nombre);
      b.classList.add('activo');
    });
    for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      b.addEventListener(tipo, () => { toque.mantener.delete(nombre); b.classList.remove('activo'); });
    }
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  // Botones de un solo toque.
  function alTocar(id, accion) {
    $(id).addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (estado === 'vuelo') accion(); });
  }
  alTocar('t-flaps-menos', () => { cambiarFlaps(-1); avisar('Flaps ' + Math.round(mando.flaps * 30) + '°'); });
  alTocar('t-flaps-mas', () => { cambiarFlaps(1); avisar('Flaps ' + Math.round(mando.flaps * 30) + '°'); });
  alTocar('t-camara', cambiarCamara);
  alTocar('t-asistido', alternarAsistido);
  pintarAsistido();
  alTocar('t-sonido', alternarSonido);
  alTocar('t-pausa', () => pausar(true));
  $('t-sonido').textContent = sonido.silencio ? 'Sin sonido' : 'Sonido';

  // ---- Inclinación del celular ----
  // Se calcula hacia dónde apunta "arriba" en coordenadas de la pantalla: girar el celular como un volante
  // alabea, e inclinarlo hacia ti o hacia fuera sube o baja el morro. La posición al activarlo es la neutra.
  const RAD = Math.PI / 180;
  const inclinacion = { neutra: null, ultima: null, escuchando: false };
  function arribaEnPantalla(beta, gamma) {
    const b = beta * RAD, g = gamma * RAD;
    const x = -Math.sin(g) * Math.cos(b), y = Math.sin(b), z = Math.cos(g) * Math.cos(b);
    const giro = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * RAD;
    return { x: x * Math.cos(giro) - y * Math.sin(giro), y: x * Math.sin(giro) + y * Math.cos(giro), z };
  }
  function angulosInclinacion(beta, gamma) {
    const u = arribaEnPantalla(beta, gamma);
    return { volante: Math.atan2(-u.x, u.y), cabeceo: Math.atan2(u.z, Math.hypot(u.x, u.y)) };
  }
  const zonaMuerta = (v, z) => (Math.abs(v) < z ? 0 : (v - Math.sign(v) * z) / (1 - z));
  function alInclinar(ev) {
    if (ev.beta === null || ev.gamma === null || ev.beta === undefined) return;
    const a = angulosInclinacion(ev.beta, ev.gamma);
    inclinacion.ultima = a;
    if (!inclinacion.neutra) inclinacion.neutra = a;
    let dv = a.volante - inclinacion.neutra.volante;
    if (dv > Math.PI) dv -= 2 * Math.PI; else if (dv < -Math.PI) dv += 2 * Math.PI;
    const dc = a.cabeceo - inclinacion.neutra.cabeceo;
    // 30° de volante y 20° de cabeceo dan todo el recorrido.
    toque.inclinX = Math.max(-1, Math.min(1, zonaMuerta(dv / (30 * RAD), 0.08)));
    toque.inclinY = Math.max(-1, Math.min(1, zonaMuerta(-dc / (20 * RAD), 0.1)));
  }
  function recalibrar() { inclinacion.neutra = inclinacion.ultima; toque.inclinX = 0; toque.inclinY = 0; }
  function pintarBotonInclinar() {
    $('t-inclinar').classList.toggle('activo', toque.inclinar);
    $('t-inclinar').setAttribute('aria-pressed', String(toque.inclinar));
  }
  async function activarInclinacion(si, conAviso) {
    if (si && !window.DeviceOrientationEvent) { avisar('Este aparato no tiene sensor de movimiento'); return; }
    if (si && typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iPhone y iPad piden permiso, y solo se puede pedir al tocar un botón.
      let respuesta = 'denied';
      try { respuesta = await DeviceOrientationEvent.requestPermission(); } catch (_) { /* rechazado */ }
      if (respuesta !== 'granted') { avisar('Sin permiso para usar el sensor de movimiento', 3000); return; }
    }
    toque.inclinar = si;
    guardar('cielo-abierto:inclinar', si ? '1' : '0');
    if (si && !inclinacion.escuchando) { window.addEventListener('deviceorientation', alInclinar); inclinacion.escuchando = true; }
    inclinacion.neutra = null;
    toque.inclinX = 0; toque.inclinY = 0;
    pintarBotonInclinar();
    if (conAviso) avisar(si ? 'Inclinación activada: la posición actual es la neutra' : 'Inclinación desactivada', 2500);
  }
  // Es un clic (no pointerdown) porque iOS solo concede el permiso del sensor dentro de un clic.
  $('t-inclinar').addEventListener('click', () => { if (estado === 'vuelo') activarInclinacion(!toque.inclinar, true); });

  // Gas: se arrastra arriba y abajo. Es relativo al punto de partida, así un toque no lo cambia de golpe.
  const gas = $('gas'), carrilGas = gas.querySelector('.carril');
  let dedoGas = null, gasInicio = 0, yInicio = 0;
  gas.addEventListener('pointerdown', (ev) => {
    if (dedoGas !== null || estado !== 'vuelo') return;
    ev.preventDefault();
    dedoGas = ev.pointerId;
    gas.setPointerCapture(ev.pointerId);
    gasInicio = mando.acelerador;
    yInicio = ev.clientY;
  });
  gas.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== dedoGas) return;
    mando.acelerador = Math.max(0, Math.min(1, gasInicio + (yInicio - ev.clientY) / carrilGas.clientHeight));
  });
  for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    gas.addEventListener(tipo, (ev) => { if (ev.pointerId === dedoGas) dedoGas = null; });
  }
  let gasPintado = -1;
  function pintarGas() {
    const v = Math.round(mando.acelerador * 100);
    if (v === gasPintado) return;
    gasPintado = v;
    $('gas-relleno').style.height = v + '%';
    $('gas-tirador').style.bottom = v + '%';
    gas.setAttribute('aria-valuenow', String(v));
  }

  // En vertical no caben los mandos: se pide girar el celular y se pausa el vuelo.
  function revisarOrientacion() {
    const vertical = tactil && window.innerHeight > window.innerWidth && estado !== 'menu';
    $('girar').hidden = !vertical;
    if (vertical && estado === 'vuelo') pausar(true);
  }
  function pantallaCompleta() {
    if (!tactil || document.fullscreenElement) return;
    const raiz = document.documentElement;
    const pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
    if (!pedir) return;
    try {
      const promesa = pedir.call(raiz, { navigationUI: 'hide' });
      if (promesa && promesa.then) {
        promesa.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
          .catch(() => { /* el navegador no lo permite: se sigue jugando igual */ });
      }
    } catch (_) { /* sin pantalla completa */ }
  }

  // ---- Interfaz ----
  let temporizadorAviso = 0;
  function avisar(texto, duracion) {
    $('aviso').textContent = texto;
    $('aviso').classList.add('visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => $('aviso').classList.remove('visible'), duracion || 1800);
  }

  function pantalla(id) {
    for (const p of document.querySelectorAll('.pantalla')) { p.hidden = p.id !== id; if (!p.hidden) p.scrollTop = 0; }
    $('hud').hidden = id !== null && id !== 'pausa' && id !== 'fin';
  }

  function tarjeta(titulo, nivel, descripcion, datos, alPulsar) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mision';
    const t = document.createElement('strong'); t.textContent = titulo;
    const n = document.createElement('span'); n.className = 'nivel'; n.textContent = nivel;
    const d = document.createElement('p'); d.textContent = descripcion;
    b.append(t, n, d);
    if (datos && datos.length) {
      const fila = document.createElement('div'); fila.className = 'datos';
      for (const x of datos) { const sp = document.createElement('span'); sp.textContent = x; fila.append(sp); }
      b.append(fila);
    }
    if (alPulsar) b.addEventListener('click', alPulsar); else b.disabled = true;
    return b;
  }

  function pintarAerolinea() {
    const a = aerolinea;
    $('a-saldo').textContent = AL.dinero(a.saldo);
    $('a-saldo').classList.toggle('negativo', a.saldo < 0);
    $('a-reputacion').textContent = a.reputacion + ' / 100';
    $('a-ubicacion').textContent = nombreDe(a.ubicacion);
    $('a-vuelos').textContent = String(a.vuelos);
    const salidas = $('salidas');
    salidas.textContent = '';
    for (const o of AL.salidas(a)) {
      const avion = AL.FLOTA[o.avion], destino = DS.buscar(o.destino);
      salidas.append(tarjeta(`${o.hora} · ${o.numero} → ${destino.ciudad}`, `${destino.pais} · ${o.clima.nombre}`,
        `${AL.km(o.distancia)} · ${AL.duracion(o.horas)} de vuelo`,
        [avion.nombre, `${o.pasajeros}/${avion.plazas} pasajeros`, `${AL.dinero(o.precio)} el billete`],
        () => empezarVuelo(o)));
    }
    const hangar = $('hangar');
    hangar.textContent = '';
    for (const [clave, avion] of Object.entries(AL.FLOTA)) {
      const tiene = a.flota.includes(clave);
      let nivel, accion = null;
      if (tiene && a.avion === clave) nivel = 'En servicio';
      else if (tiene && !AL.tieneAlcance(a, clave)) nivel = 'No tiene alcance para salir de aquí';
      else if (tiene) { nivel = 'Toca para usarlo'; accion = () => { AL.usar(a, clave); AL.guardar(almacen, a); pintarAerolinea(); }; }
      else if (a.saldo >= avion.precio) {
        nivel = `Comprar por ${AL.dinero(avion.precio)}`;
        accion = () => { if (AL.comprar(a, clave)) { AL.guardar(almacen, a); avisar(`¡Has comprado el ${avion.nombre}!`, 3000); pintarAerolinea(); } };
      } else nivel = `Cuesta ${AL.dinero(avion.precio)}: te faltan ${AL.dinero(avion.precio - a.saldo)}`;
      const b = tarjeta(avion.nombre, nivel, avion.descripcion, [`${avion.plazas} plazas`, `alcance ${AL.km(avion.alcance)}`], accion);
      if (tiene && a.avion === clave) b.classList.add('actual');
      hangar.append(b);
    }
  }

  function elegirPestana(cual) {
    for (const [tab, panel] of [['tab-aerolinea', 'panel-aerolinea'], ['tab-practica', 'panel-practica']]) {
      const activa = tab === 'tab-' + cual;
      $(tab).setAttribute('aria-selected', String(activa));
      $(panel).hidden = !activa;
    }
    guardar('cielo-abierto:pestana', cual);
    if (estado === 'menu') ponerEscenario(cual === 'aerolinea' ? aerolinea.ubicacion : null);
  }
  $('tab-aerolinea').addEventListener('click', () => elegirPestana('aerolinea'));
  $('tab-practica').addEventListener('click', () => elegirPestana('practica'));
  elegirPestana(leer('cielo-abierto:pestana') === 'practica' ? 'practica' : 'aerolinea');

  function pintarMenu() {
    pintarAerolinea();
    const lista = $('misiones');
    lista.textContent = '';
    for (const m of window.MISIONES) {
      const b = document.createElement('button');
      b.className = 'mision';
      const titulo = document.createElement('strong'); titulo.textContent = m.nombre;
      const nivel = document.createElement('span'); nivel.className = 'nivel'; nivel.textContent = m.nivel;
      const desc = document.createElement('p'); desc.textContent = m.descripcion;
      const est = document.createElement('span'); est.className = 'estrellas';
      est.textContent = m.pasos.length ? pintaEstrellas(estrellasDe(m.id)) : '';
      b.append(titulo, nivel, desc, est);
      b.addEventListener('click', () => { vuelo = null; ponerEscenario(null); empezar(m); });
      lista.append(b);
    }
  }

  function empezar(m, continuar) {
    iniciarSonido();
    pantallaCompleta();
    if (tactil && leer('cielo-abierto:inclinar') === '1' && !inclinacion.escuchando) activarInclinacion(true, false);
    recalibrar();
    mision = m;
    indicePaso = 0;
    const op = m.inicio;
    if (!continuar) pasajeros = P.crear(m.pasajeros || 0);
    else { pasajeros.vAnterior = null; pasajeros.tInicio = undefined; pasajeros.toqueVisto = null; }
    e = F.crearEstado(Object.assign({ avion: m.avion }, op, { carga: pasajeros.carga }));
    combustibleInicial = e.combustible;
    asistencia.activa = false;
    mundo.viento = m.viento;
    mundo.turbulencia = m.turbulencia;
    Object.assign(mando, { acelerador: op.acelerador || 0, cabeceo: 0, alabeo: 0, timon: 0, flaps: op.flapsMando || 0, trim: op.trim || 0, freno: 0 });
    qCam.set(e.q[0], e.q[1], e.q[2], e.q[3]);
    soltarMandos();
    acumulado = 0;
    estado = 'vuelo';
    pantalla(null);
    $('hud').hidden = false;
    $('consejo').textContent = (tactil && m.consejoTactil) || m.consejo;
    actualizarObjetivo();
    textoPasajeros = '';
    if (m.aviso) avisar(m.aviso, 4000);
    else if (pasajeros.cantidad) avisar(`Bienvenidos a bordo del ${e.modelo.nombre}: ${pasajeros.cantidad} pasajeros, entre ellos ${P.lista(pasajeros.nombres)}`, 3500);
    lienzo.focus();
  }

  // ---- Vuelos de la aerolínea: salida en el origen, crucero en el mapa y llegada al destino ----
  let vuelo = null;
  const ALTURA_SALIDA = { avioneta: 250, regional: 400, jet: 550 };
  const ALTITUD_CRUCERO = { avioneta: '2.400 m', regional: '7.000 m', jet: '11.000 m' };

  function empezarVuelo(oferta) {
    const origen = DS.buscar(oferta.origen), destino = DS.buscar(oferta.destino), A = F.AVIONES[oferta.avion];
    ponerEscenario(oferta.origen);
    const ap = T.AEROPUERTOS[0];
    vuelo = { oferta, gastado: 0, fase: 'salida' };
    empezar({
      id: 'aerolinea', nombre: `Vuelo ${oferta.numero}`, avion: oferta.avion, pasajeros: oferta.pasajeros, aerolinea: oferta, fase: 'salida',
      consejo: `Despega hacia el norte (rota a unos ${A.rotacion} nudos) y cruza el aro de salida: después el piloto automático lleva el avión hasta ${destino.ciudad}.`,
      inicio: { p: [ap.x, ap.y + A.alturaEnTierra, ap.z + ap.mitadLargo - 60], enTierra: true, combustible: oferta.combustible },
      viento: oferta.viento, turbulencia: oferta.clima.turbulencia,
      pasos: [{ tipo: 'punto', nombre: `Salida de ${origen.ciudad}`, x: ap.x, y: ap.y + ALTURA_SALIDA[oferta.avion], z: ap.z - ap.mitadLargo - 4500 }],
      aviso: `Bienvenidos a Benedetto: vuelo ${oferta.numero} de ${origen.ciudad} a ${destino.ciudad} con ${oferta.pasajeros} pasajeros`,
    });
  }

  function iniciarCrucero() {
    const o = vuelo.oferta, origen = DS.buscar(o.origen), destino = DS.buscar(o.destino), flota = AL.FLOTA[o.avion];
    vuelo.gastado += Math.max(0, combustibleInicial - e.combustible);
    vuelo.fase = 'crucero';
    estado = 'crucero';
    actualizarSonido(null, false);
    mundo3d.colocarAro(null);
    // Entre 10 y 35 segundos según la distancia; se puede acelerar o saltar.
    vuelo.crucero = { t: 0, duracion: Math.max(10, Math.min(35, 6 + Math.sqrt(o.distancia) * 0.32)), rapido: 1, evento: null, hechos: {} };
    vuelo.crucero.litros = o.distancia * flota.litroKm;
    $('c-vuelo').textContent = `Benedetto ${o.numero} · ${flota.nombre} · piloto automático`;
    $('c-ruta').textContent = `${origen.ciudad} → ${destino.ciudad}`;
    $('c-altitud').textContent = ALTITUD_CRUCERO[o.avion];
    $('c-evento').hidden = true;
    $('c-mensaje').textContent = 'Crucero estable. Los pasajeros se acomodan.';
    $('c-acelerar').textContent = 'Acelerar ×4';
    pantalla('crucero');
    $('hud').hidden = true;
    const lienzoMapa = $('mapa'), r = Math.min(window.devicePixelRatio, 2);
    lienzoMapa.width = lienzoMapa.clientWidth * r;
    lienzoMapa.height = lienzoMapa.clientHeight * r;
    pintarCrucero();
  }

  function pintarCrucero() {
    const o = vuelo.oferta, c = vuelo.crucero, lienzoMapa = $('mapa'), ctxMapa = lienzoMapa.getContext('2d');
    const r = lienzoMapa.width / Math.max(1, lienzoMapa.clientWidth);
    ctxMapa.setTransform(r, 0, 0, r, 0, 0);
    window.Mapa.dibujar(ctxMapa, lienzoMapa.clientWidth, lienzoMapa.clientHeight, DS.buscar(o.origen), DS.buscar(o.destino), c.t);
    $('c-falta').textContent = AL.km(o.distancia * (1 - c.t));
    $('c-tiempo').textContent = `${AL.duracion(o.horas * c.t)} de ${AL.duracion(o.horas)}`;
    $('c-pasajeros').textContent = `${P.cara(pasajeros.comodidad)} ${Math.round(pasajeros.comodidad)}%`;
  }

  // Sucesos del crucero: el servicio a bordo y, a veces, una zona de turbulencia con decisión.
  function sucesosCrucero() {
    const c = vuelo.crucero, o = vuelo.oferta;
    if (c.t > 0.3 && !c.hechos.servicio) {
      c.hechos.servicio = true;
      pasajeros.comodidad = Math.min(100, pasajeros.comodidad + 4);
      $('c-mensaje').textContent = o.horas > 3 ? 'Servicio a bordo: comida caliente y una película. Los pasajeros están más cómodos.' : 'Servicio a bordo: café y galletas. Los pasajeros están más cómodos.';
    }
    if (c.t > 0.55 && !c.hechos.turbulencia) {
      c.hechos.turbulencia = true;
      if (o.distancia > 300 && (o.numero.charCodeAt(4) % 2 === 0 || o.clima.turbulencia > 0.3)) {
        c.evento = 'turbulencia';
        $('c-evento-texto').textContent = 'El radar muestra una zona de turbulencia en la ruta. ¿Qué hacemos?';
        $('c-opcion-a').textContent = 'Rodearla (+5 % de combustible)';
        $('c-opcion-b').textContent = 'Atravesarla (los pasajeros lo notarán)';
        $('c-evento').hidden = false;
      }
    }
  }

  function decidir(rodear) {
    const c = vuelo.crucero;
    if (c.evento !== 'turbulencia') return;
    if (rodear) { c.litros *= 1.05; $('c-mensaje').textContent = 'Rodeamos la turbulencia: un poco más de combustible, pero vuelo tranquilo.'; }
    else { pasajeros.comodidad = Math.max(0, pasajeros.comodidad - 12); $('c-mensaje').textContent = '¡Baches! Se cayeron algunos vasos, pero ya pasó.'; }
    c.evento = null;
    $('c-evento').hidden = true;
  }
  $('c-opcion-a').addEventListener('click', () => decidir(true));
  $('c-opcion-b').addEventListener('click', () => decidir(false));
  $('c-acelerar').addEventListener('click', () => {
    if (!vuelo || !vuelo.crucero) return;
    vuelo.crucero.rapido = vuelo.crucero.rapido === 1 ? 4 : 1;
    $('c-acelerar').textContent = vuelo.crucero.rapido === 1 ? 'Acelerar ×4' : 'Velocidad normal';
  });
  $('c-saltar').addEventListener('click', () => { if (vuelo && vuelo.fase === 'crucero') { if (vuelo.crucero.evento) decidir(true); terminarCrucero(); } });

  function avanzarCrucero(dt) {
    const c = vuelo.crucero;
    if (!c.evento) c.t = Math.min(1, c.t + (dt * c.rapido) / c.duracion);
    sucesosCrucero();
    pintarCrucero();
    if (c.t >= 1 && !c.evento) terminarCrucero();
  }

  function terminarCrucero() {
    const c = vuelo.crucero;
    c.t = 1;
    vuelo.gastado += c.litros;
    iniciarLlegada();
  }

  function iniciarLlegada() {
    const o = vuelo.oferta, destino = DS.buscar(o.destino), A = F.AVIONES[o.avion], ap0 = A.aproximacion;
    ponerEscenario(o.destino);
    vuelo.fase = 'llegada';
    const ap = T.AEROPUERTOS[0];
    // Empieza estabilizado en la senda de 3°, a 9 km del umbral.
    const distancia = 9000, umbral = ap.z + ap.mitadLargo;
    const v = ap0.nudos / 1.94384, senda = 3 * RAD;
    const restante = Math.max(A.combustible * 0.03, o.combustible - vuelo.gastado);
    empezar({
      id: 'aerolinea', nombre: `Vuelo ${o.numero}`, avion: o.avion, pasajeros: o.pasajeros, aerolinea: o, fase: 'llegada',
      consejo: `Mantén unos ${ap0.nudos} nudos y sigue las luces PAPI: dos blancas y dos rojas. Antes de tocar, quita gas y levanta un poco el morro.`,
      inicio: {
        p: [ap.x, ap.y + (distancia + 300) * Math.tan(senda), umbral + distancia], v: [0, -v * Math.sin(senda), -v * Math.cos(senda)],
        acelerador: ap0.acelerador, motor: 0.12 + 0.88 * ap0.acelerador, flaps: ap0.flaps, flapsMando: ap0.flaps, trim: ap0.trim, combustible: restante,
      },
      viento: o.viento, turbulencia: o.clima.turbulencia,
      pasos: [{ tipo: 'aterrizar', aeropuerto: ap.id }],
      aviso: `Benedetto les da la bienvenida a ${destino.ciudad}, ${destino.pais}. Preparados para aterrizar.`,
    }, true);
  }

  function pausar(si) {
    if (!e) return;
    estado = si ? 'pausa' : 'vuelo';
    pantalla(si ? 'pausa' : null);
    $('hud').hidden = false;
    soltarMandos();
    if (!si) { ultimo = performance.now(); acumulado = 0; recalibrar(); }
  }

  function pasoActual() { return mision && mision.pasos[indicePaso]; }

  function destinoDe(p) {
    if (!p) return null;
    if (p.tipo === 'punto') return p;
    if (p.tipo === 'aterrizar') { const a = aeropuerto(p.aeropuerto); return { x: a.x, y: a.y, z: a.z + a.mitadLargo }; }
    return null;
  }

  function actualizarObjetivo() {
    const p = pasoActual();
    const puntos = mision.pasos.filter((x) => x.tipo === 'punto');
    if (p && p.tipo === 'punto') mundo3d.colocarAro(p, { x: e.p[0], z: e.p[2] });
    else mundo3d.colocarAro(null);
    if (!p) $('objetivo').textContent = 'Vuelo libre';
    else if (p.tipo === 'altura') $('objetivo').textContent = `Sube a ${p.metros} m sobre la pista`;
    else if (p.tipo === 'punto') $('objetivo').textContent = `Aro ${puntos.indexOf(p) + 1} de ${puntos.length}: ${p.nombre}`;
    else $('objetivo').textContent = `Aterriza en ${aeropuerto(p.aeropuerto).nombre} y detente en la pista`;
  }

  function terminar(exito, titulo, detalle, estrellas, resultado) {
    estado = 'fin';
    if (exito && pasajeros.cantidad) {
      const c = Math.round(pasajeros.comodidad);
      estrellas = Math.min(estrellas, P.estrellas(c));
      detalle += ` Pasajeros ${P.cara(c)} comodidad ${c}%. ${P.opinion(c)}`;
    }
    actualizarSonido(null, false);
    mundo3d.colocarAro(null);
    if (!mision.aerolinea && exito && estrellas > estrellasDe(mision.id)) guardar('cielo-abierto:' + mision.id, String(estrellas));
    $('fin-titulo').textContent = titulo;
    $('fin-detalle').textContent = detalle;
    $('fin-estrellas').textContent = exito ? pintaEstrellas(estrellas) : '';
    const cuentas = $('fin-cuentas');
    cuentas.hidden = !mision.aerolinea;
    $('b-reintentar').hidden = !!mision.aerolinea;
    $('b-menu-fin').textContent = mision.aerolinea ? 'Ir al tablero de salidas' : 'Elegir otra misión';
    $('b-reintentar').classList.toggle('principal', !$('b-reintentar').hidden);
    $('b-menu-fin').classList.toggle('principal', !!mision.aerolinea);
    if (mision.aerolinea) {
      const o = mision.aerolinea;
      const r = AL.liquidar(aerolinea, o, {
        resultado: resultado || (exito ? 'ok' : 'choque'), estrellas, comodidad: pasajeros.comodidad,
        combustible: (vuelo ? vuelo.gastado : 0) + Math.max(0, combustibleInicial - e.combustible),
        lugar: mision.fase === 'llegada' ? o.destino : o.origen,
      });
      vuelo = null;
      AL.guardar(almacen, aerolinea);
      const cuerpo = cuentas.querySelector('tbody');
      cuerpo.textContent = '';
      const fila = (a, b, clase) => {
        const tr = document.createElement('tr'); if (clase) tr.className = clase;
        const t1 = document.createElement('td'); t1.textContent = a;
        const t2 = document.createElement('td'); t2.textContent = b;
        tr.append(t1, t2); cuerpo.append(tr);
      };
      for (const [texto, importe] of r.lineas) fila(texto, AL.dinero(importe));
      fila('Total del vuelo', AL.dinero(r.total), 'total');
      const cambio = r.reputacion - r.reputacionAntes;
      fila(`Reputación ${cambio >= 0 ? '+' : '−'}${Math.abs(cambio)}`, `${r.reputacion} / 100`);
      fila('Saldo de Benedetto', AL.dinero(r.saldo));
      fila('El avión está en', nombreDe(aerolinea.ubicacion));
    }
    pintarMenu();
    pantalla('fin');
  }

  const CHOQUES = {
    agua: ['Amerizaje forzoso', 'El avión ha caído al mar.'],
    tren: ['Tren de aterrizaje roto', 'Has tocado el suelo demasiado rápido. Por debajo de 400 pies por minuto es un buen margen.'],
    choque: ['Accidente', 'El avión ha golpeado el terreno.'],
  };

  function evaluarAterrizaje(p) {
    const a = aeropuerto(p.aeropuerto);
    const toque = e.ultimoToque;
    const fpm = Math.abs(toque.vs * 196.85);
    const centro = Math.abs(toque.x - a.x);
    const desdeUmbral = a.z + a.mitadLargo - toque.z;
    if (!T.enPista(a, e.p[0], e.p[2])) {
      if (Math.hypot(Math.max(0, Math.abs(e.p[0] - a.x) - a.mitadAncho), Math.max(0, Math.abs(e.p[2] - a.z) - a.mitadLargo)) > 1500) {
        terminar(false, 'Aterrizaje en el campo', `Todos están bien, pero el avión se ha detenido lejos de ${a.nombre}.`, 0, 'campo');
      } else {
        terminar(false, 'Fuera de pista', 'Todos están sanos y salvos, pero el avión no se ha detenido en la pista y los pasajeros tendrán que caminar hasta la terminal.', 0, 'fuera');
      }
      return;
    }
    let puntos = fpm < 120 ? 50 : fpm < 250 ? 40 : fpm < 400 ? 25 : 10;
    puntos += centro < 5 ? 30 : centro < 15 ? 20 : 5;
    // Zona de toque: proporcional a la pista (los jets tocan más lejos del umbral que la avioneta).
    const zona = Math.max(500, a.mitadLargo * 0.4);
    puntos += desdeUmbral > 0 && desdeUmbral < zona ? 20 : desdeUmbral < zona * 1.8 ? 10 : 0;
    const estrellas = puntos >= 80 ? 3 : puntos >= 55 ? 2 : 1;
    terminar(true, mision.aerolinea ? `Vuelo Benedetto ${mision.aerolinea.numero} completado` : 'Aterrizaje completado', `Toque a ${Math.round(fpm)} pies/min, a ${Math.round(centro)} m del eje y ${Math.max(0, Math.round(desdeUmbral))} m tras el umbral. Puntuación: ${puntos}/100.`, estrellas);
  }

  function comprobarMision() {
    if (e.estrellado) {
      const [titulo, detalle] = CHOQUES[e.estrellado];
      terminar(false, titulo, detalle + (mision.aerolinea ? ' Por suerte todos salen bien, pero hay que reparar el avión.' : ''), 0, 'choque');
      return;
    }
    const p = pasoActual();
    if (!p) return;
    let hecho = false;
    if (p.tipo === 'altura') hecho = e.p[1] - aeropuerto(p.aeropuerto).y >= p.metros;
    if (p.tipo === 'punto') hecho = Math.hypot(e.p[0] - p.x, e.p[1] - p.y, e.p[2] - p.z) < 230;
    if (p.tipo === 'aterrizar' && e.enTierra && e.ultimoToque && Math.hypot(e.v[0], e.v[1], e.v[2]) < 1) {
      evaluarAterrizaje(p);
      return;
    }
    if (!hecho) return;
    indicePaso++;
    if (indicePaso >= mision.pasos.length) {
      if (mision.fase === 'salida') { iniciarCrucero(); return; }
      terminar(true, 'Misión completada', '¡Buen trabajo! Has alcanzado el objetivo.', 3, 'ok');
      return;
    }
    avisar('Objetivo alcanzado');
    actualizarObjetivo();
  }

  function rumboObjetivo() {
    const d = destinoDe(pasoActual());
    if (!d) return { rumbo: null, dist: 0 };
    const dx = d.x - e.p[0], dz = d.z - e.p[2];
    return { rumbo: ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360, dist: Math.hypot(dx, dz), altura: d.y };
  }

  // ---- Cámaras ----
  const vP = new THREE.Vector3(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), qAvion = new THREE.Quaternion();
  function actualizarCamara(dt) {
    vP.set(e.p[0], e.p[1], e.p[2]);
    qAvion.set(e.q[0], e.q[1], e.q[2], e.q[3]);
    if (modoCamara === 1) {
      camara.fov = 68;
      const cam = e.modelo.camara;
      vA.set(cam.cabina[0], cam.cabina[1], cam.cabina[2]).applyQuaternion(qAvion).add(vP);
      camara.position.copy(vA);
      camara.quaternion.copy(qAvion);
    } else if (modoCamara === 0) {
      camara.fov = 62;
      qCam.slerp(qAvion, 1 - Math.exp(-5 * dt));
      const cam = e.modelo.camara;
      vA.set(0, cam.arriba, cam.atras).applyQuaternion(qCam).add(vP);
      vA.y = Math.max(vA.y, Math.max(T.altura(vA.x, vA.z), 0) + 2);
      camara.position.copy(vA);
      camara.up.set(0, 1, 0).applyQuaternion(qCam);
      camara.lookAt(vB.set(0, cam.mira, -cam.atras * 1.5).applyQuaternion(qCam).add(vP));
    } else {
      let cerca = T.AEROPUERTOS[0];
      for (const a of T.AEROPUERTOS) if (Math.hypot(a.x - e.p[0], a.z - e.p[2]) < Math.hypot(cerca.x - e.p[0], cerca.z - e.p[2])) cerca = a;
      camara.position.set(cerca.x + cerca.mitadAncho + 272, cerca.y + 37, cerca.z + 30); // desde la torre de control
      camara.up.set(0, 1, 0);
      camara.fov = Math.max(6, Math.min(62, (2400 / Math.max(40, camara.position.distanceTo(vP))) * 8));
      camara.lookAt(vP);
    }
    camara.updateProjectionMatrix();
  }

  function ajustar() {
    const w = window.innerWidth, h = window.innerHeight;
    render.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    const ratio = Math.min(window.devicePixelRatio, 2);
    const altoPanel = Math.max(96, Math.min(170, h * 0.22));
    panel.width = w * ratio;
    panel.height = altoPanel * ratio;
    panel.style.height = altoPanel + 'px';
    ctxPanel.setTransform(ratio, 0, 0, ratio, 0, 0);
    ajustar.altoPanel = altoPanel;
    $('hud').style.setProperty('--alto-panel', altoPanel + 'px');
    revisarOrientacion();
  }
  window.addEventListener('resize', ajustar);
  window.addEventListener('orientationchange', () => setTimeout(ajustar, 250));

  let angulo = 0;
  function bucle(ahora) {
    requestAnimationFrame(bucle);
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;

    if (estado === 'crucero') { avanzarCrucero(dt); return; }

    if (estado === 'menu' || !e) {
      angulo += dt * 0.06;
      const ap = T.AEROPUERTOS[0], radio = T.destino ? 3800 : 2600;
      camara.fov = 55;
      camara.up.set(0, 1, 0);
      camara.position.set(ap.x + Math.sin(angulo) * radio, ap.y + 490, ap.z + 900 + Math.cos(angulo) * radio);
      camara.lookAt(ap.x, ap.y + 60, ap.z - 500);
      camara.updateProjectionMatrix();
      const avionMenu = T.destino ? aerolinea.avion : 'regional';
      const vistaMenu = F.crearEstado({ avion: avionMenu, p: [ap.x, ap.y + F.AVIONES[avionMenu].alturaEnTierra, ap.z + ap.mitadLargo - 50], enTierra: true });
      mundo3d.actualizar(vistaMenu, mando, camara, mundo.viento);
      render.render(escena, camara);
      return;
    }

    if (estado === 'vuelo') {
      leerMandos(dt);
      acumulado += dt;
      while (acumulado >= PASO) { F.paso(e, mando, mundo, PASO); acumulado -= PASO; }
      const queja = P.actualizar(pasajeros, e, F.telemetria(e, mundo));
      if (queja) avisar(queja, 3000);
      comprobarMision();
    }

    const t = F.telemetria(e, mundo);
    actualizarCamara(dt);
    mundo3d.actualizar(e, mando, camara, mundo.viento);
    render.render(escena, camara);

    if (tactil) pintarGas();
    const objetivo = rumboObjetivo();
    window.Instrumentos.dibujar(ctxPanel, window.innerWidth, ajustar.altoPanel, t, e, mando, objetivo.rumbo);
    if (estado === 'vuelo') actualizarSonido(t, true);
    else actualizarSonido(null, false);

    const adv = [];
    if (t.avisoPerdida) adv.push('PÉRDIDA');
    if (e.combustible <= 0 && mision.id !== 'sinmotor') adv.push('SIN COMBUSTIBLE');
    if (mando.freno) adv.push('FRENOS');
    $('alertas').textContent = adv.join('  ·  ');
    const nuevoPasajeros = pasajeros.cantidad ? `${P.cara(pasajeros.comodidad)} ${pasajeros.cantidad} pasajeros · comodidad ${Math.round(pasajeros.comodidad)}%` : '';
    if (nuevoPasajeros !== textoPasajeros) { textoPasajeros = nuevoPasajeros; $('pasajeros').textContent = nuevoPasajeros; }
    $('ruta').textContent = objetivo.rumbo === null ? `Altura sobre el suelo: ${Math.round(t.alturaSuelo)} m`
      : `Rumbo ${String(Math.round(objetivo.rumbo) % 360).padStart(3, '0')}° · ${(objetivo.dist / 1000).toFixed(1).replace('.', ',')} km · objetivo ${Math.round(objetivo.altura)} m · estás a ${Math.round(e.p[1])} m`;
  }

  $('b-seguir').addEventListener('click', () => { if (tactil && window.innerHeight > window.innerWidth) return; pausar(false); });
  $('b-reiniciar').addEventListener('click', () => {
    if (vuelo && mision.fase === 'llegada') iniciarLlegada();
    else if (vuelo) empezarVuelo(vuelo.oferta);
    else empezar(mision);
  });
  $('b-menu').addEventListener('click', () => {
    if (mision && mision.aerolinea && estado === 'pausa') {
      const o = mision.aerolinea;
      const r = AL.liquidar(aerolinea, o, {
        resultado: 'abandono', combustible: (vuelo ? vuelo.gastado : 0) + Math.max(0, combustibleInicial - e.combustible),
        lugar: mision.fase === 'llegada' ? o.destino : o.origen,
      });
      vuelo = null;
      AL.guardar(almacen, aerolinea);
      avisar(`Vuelo cancelado: reputación ${r.reputacion} / 100`, 3000);
    }
    volverMenu();
  });
  $('b-reintentar').addEventListener('click', () => { ponerEscenario(null); empezar(mision); });
  $('b-menu-fin').addEventListener('click', () => volverMenu());

  function volverMenu() {
    estado = 'menu';
    e = null;
    vuelo = null;
    ponerEscenario($('tab-practica').getAttribute('aria-selected') === 'true' ? null : aerolinea.ubicacion);
    mundo3d.colocarAro(null);
    actualizarSonido(null, false);
    pintarMenu();
    pantalla('menu');
    $('hud').hidden = true;
    revisarOrientacion();
  }

  if (tactil) document.body.classList.add('tactil');

  // Enganche de solo lectura para pruebas automáticas.
  window.__cieloAbierto = { get estado() { return estado; }, get avion() { return e; }, get pasoIndice() { return indicePaso; }, get aerolinea() { return aerolinea; }, get mando() { return mando; }, get vuelo() { return vuelo; }, get pasajeros() { return pasajeros; } };

  ajustar();
  pintarMenu();
  pantalla('menu');
  $('hud').hidden = true;
  requestAnimationFrame(bucle);
})();
