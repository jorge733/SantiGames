// Bucle principal: mandos, cámaras, misiones, sonido e interfaz.
(function () {
  'use strict';
  const T = window.Terreno, F = window.Fisica;
  const PASO = 1 / 240;
  const $ = (id) => document.getElementById(id);

  const lienzo = $('escena');
  const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, logarithmicDepthBuffer: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  render.shadowMap.enabled = true;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(62, 1, 0.3, 45000);
  const mundo3d = window.Mundo.crear(escena);
  const panel = $('panel');
  const ctxPanel = panel.getContext('2d');

  let estado = 'menu', e = null, mision = null, indicePaso = 0, modoCamara = 0, acumulado = 0, ultimo = performance.now();
  const mundo = { altura: T.altura, viento: [0, 0, 0], turbulencia: 0 };
  const mando = { acelerador: 0, cabeceo: 0, alabeo: 0, timon: 0, flaps: 0, trim: 0, freno: 0 };
  const teclas = new Set();
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
    sonido.motor.frequency.setTargetAtTime(35 + (t ? t.rpm : 0) * 0.055, ahora, 0.08);
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
  function leerMandos(dt) {
    const cab = (hay('KeyS', 'ArrowDown') ? 1 : 0) - (hay('KeyW', 'ArrowUp') ? 1 : 0);
    const alab = (hay('KeyD', 'ArrowRight') ? 1 : 0) - (hay('KeyA', 'ArrowLeft') ? 1 : 0);
    const tim = (hay('KeyE') ? 1 : 0) - (hay('KeyQ') ? 1 : 0);
    // Una tecla es todo o nada: a más velocidad, menos recorrido de elevador para no entrar en pérdida.
    const velocidad = e ? Math.hypot(e.v[0], e.v[1], e.v[2]) * 1.94384 : 0;
    const recorrido = Math.min(1, Math.pow(62 / Math.max(velocidad, 1), 2));
    mando.cabeceo = acercar(mando.cabeceo, cab * recorrido, dt);
    mando.alabeo = acercar(mando.alabeo, alab, dt);
    mando.timon = acercar(mando.timon, tim, dt);
    if (hay('KeyR')) mando.acelerador = Math.min(1, mando.acelerador + 0.5 * dt);
    if (hay('KeyF')) mando.acelerador = Math.max(0, mando.acelerador - 0.5 * dt);
    if (hay('KeyT')) mando.trim = Math.min(0.6, mando.trim + 0.15 * dt);
    if (hay('KeyG')) mando.trim = Math.max(-0.6, mando.trim - 0.15 * dt);
    mando.freno = hay('Space') ? 1 : 0;
  }

  window.addEventListener('keydown', (ev) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    if (estado === 'vuelo') {
      teclas.add(ev.code);
      if (ev.code === 'KeyX') mando.flaps = Math.min(1, Math.round(mando.flaps * 3 + 1) / 3);
      if (ev.code === 'KeyZ') mando.flaps = Math.max(0, Math.round(mando.flaps * 3 - 1) / 3);
      if (ev.code === 'KeyC') { modoCamara = (modoCamara + 1) % 3; avisar(['Cámara exterior', 'Cámara de cabina', 'Cámara de torre'][modoCamara]); }
      if (ev.code === 'KeyP' || ev.code === 'Escape') pausar(true);
    } else if (estado === 'pausa' && (ev.code === 'KeyP' || ev.code === 'Escape')) pausar(false);
    if (ev.code === 'KeyM') {
      sonido.silencio = !sonido.silencio;
      guardar('cielo-abierto:silencio', sonido.silencio ? '1' : '0');
      if (sonido.maestro) sonido.maestro.gain.value = sonido.silencio ? 0 : 0.5;
      avisar(sonido.silencio ? 'Sonido apagado' : 'Sonido encendido');
    }
  });
  window.addEventListener('keyup', (ev) => teclas.delete(ev.code));
  window.addEventListener('blur', () => { teclas.clear(); if (estado === 'vuelo') pausar(true); });

  // ---- Interfaz ----
  let temporizadorAviso = 0;
  function avisar(texto) {
    $('aviso').textContent = texto;
    $('aviso').classList.add('visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => $('aviso').classList.remove('visible'), 1800);
  }

  function pantalla(id) {
    for (const p of document.querySelectorAll('.pantalla')) p.hidden = p.id !== id;
    $('hud').hidden = id !== null && id !== 'pausa' && id !== 'fin';
  }

  function pintarMenu() {
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
      b.addEventListener('click', () => empezar(m));
      lista.append(b);
    }
  }

  function empezar(m) {
    iniciarSonido();
    mision = m;
    indicePaso = 0;
    const op = m.inicio;
    e = F.crearEstado(op);
    mundo.viento = m.viento;
    mundo.turbulencia = m.turbulencia;
    Object.assign(mando, { acelerador: op.acelerador || 0, cabeceo: 0, alabeo: 0, timon: 0, flaps: op.flapsMando || 0, trim: op.trim || 0, freno: 0 });
    qCam.set(e.q[0], e.q[1], e.q[2], e.q[3]);
    teclas.clear();
    acumulado = 0;
    estado = 'vuelo';
    pantalla(null);
    $('hud').hidden = false;
    $('consejo').textContent = m.consejo;
    actualizarObjetivo();
    lienzo.focus();
  }

  function pausar(si) {
    if (!e) return;
    estado = si ? 'pausa' : 'vuelo';
    pantalla(si ? 'pausa' : null);
    $('hud').hidden = false;
    teclas.clear();
    if (!si) { ultimo = performance.now(); acumulado = 0; }
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

  function terminar(exito, titulo, detalle, estrellas) {
    estado = 'fin';
    actualizarSonido(null, false);
    mundo3d.colocarAro(null);
    if (exito && estrellas > estrellasDe(mision.id)) guardar('cielo-abierto:' + mision.id, String(estrellas));
    $('fin-titulo').textContent = titulo;
    $('fin-detalle').textContent = detalle;
    $('fin-estrellas').textContent = exito ? pintaEstrellas(estrellas) : '';
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
      terminar(false, 'Fuera de pista', 'Has aterrizado sano y salvo, pero el avión no se ha detenido en la pista.', 0);
      return;
    }
    let puntos = fpm < 120 ? 50 : fpm < 250 ? 40 : fpm < 400 ? 25 : 10;
    puntos += centro < 5 ? 30 : centro < 15 ? 20 : 5;
    puntos += desdeUmbral > 0 && desdeUmbral < 350 ? 20 : desdeUmbral < 700 ? 10 : 0;
    const estrellas = puntos >= 80 ? 3 : puntos >= 55 ? 2 : 1;
    terminar(true, 'Aterrizaje completado', `Toque a ${Math.round(fpm)} pies/min, a ${Math.round(centro)} m del eje y ${Math.max(0, Math.round(desdeUmbral))} m tras el umbral. Puntuación: ${puntos}/100.`, estrellas);
  }

  function comprobarMision() {
    if (e.estrellado) {
      const [titulo, detalle] = CHOQUES[e.estrellado];
      terminar(false, titulo, detalle, 0);
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
      terminar(true, 'Misión completada', '¡Buen trabajo! Has alcanzado el objetivo.', 3);
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
      vA.set(0, 1.28, -0.25).applyQuaternion(qAvion).add(vP);
      camara.position.copy(vA);
      camara.quaternion.copy(qAvion);
    } else if (modoCamara === 0) {
      camara.fov = 62;
      qCam.slerp(qAvion, 1 - Math.exp(-5 * dt));
      vA.set(0, 3.6, 15).applyQuaternion(qCam).add(vP);
      vA.y = Math.max(vA.y, Math.max(T.altura(vA.x, vA.z), 0) + 1.2);
      camara.position.copy(vA);
      camara.up.set(0, 1, 0).applyQuaternion(qCam);
      camara.lookAt(vB.set(0, 1, -30).applyQuaternion(qCam).add(vP));
    } else {
      let cerca = T.AEROPUERTOS[0];
      for (const a of T.AEROPUERTOS) if (Math.hypot(a.x - e.p[0], a.z - e.p[2]) < Math.hypot(cerca.x - e.p[0], cerca.z - e.p[2])) cerca = a;
      camara.position.set(cerca.x + 93, cerca.y + 33, cerca.z + 10);
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
  }
  window.addEventListener('resize', ajustar);

  let angulo = 0;
  function bucle(ahora) {
    requestAnimationFrame(bucle);
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;

    if (estado === 'menu' || !e) {
      angulo += dt * 0.06;
      camara.fov = 55;
      camara.up.set(0, 1, 0);
      camara.position.set(Math.sin(angulo) * 2600, 520, 900 + Math.cos(angulo) * 2600);
      camara.lookAt(0, 90, -500);
      camara.updateProjectionMatrix();
      const vistaMenu = F.crearEstado({ p: [0, 31.27, 650], enTierra: true });
      mundo3d.actualizar(vistaMenu, mando, camara, mundo.viento);
      render.render(escena, camara);
      return;
    }

    if (estado === 'vuelo') {
      leerMandos(dt);
      acumulado += dt;
      while (acumulado >= PASO) { F.paso(e, mando, mundo, PASO); acumulado -= PASO; }
      comprobarMision();
    }

    const t = F.telemetria(e, mundo);
    actualizarCamara(dt);
    mundo3d.actualizar(e, mando, camara, mundo.viento);
    render.render(escena, camara);

    const objetivo = rumboObjetivo();
    window.Instrumentos.dibujar(ctxPanel, window.innerWidth, ajustar.altoPanel, t, e, mando, objetivo.rumbo);
    if (estado === 'vuelo') actualizarSonido(t, true);
    else actualizarSonido(null, false);

    const adv = [];
    if (t.avisoPerdida) adv.push('PÉRDIDA');
    if (e.combustible <= 0 && mision.id !== 'sinmotor') adv.push('SIN COMBUSTIBLE');
    if (mando.freno) adv.push('FRENOS');
    $('alertas').textContent = adv.join('  ·  ');
    $('ruta').textContent = objetivo.rumbo === null ? `Altura sobre el suelo: ${Math.round(t.alturaSuelo)} m`
      : `Rumbo ${String(Math.round(objetivo.rumbo) % 360).padStart(3, '0')}° · ${(objetivo.dist / 1000).toFixed(1).replace('.', ',')} km · objetivo ${Math.round(objetivo.altura)} m · estás a ${Math.round(e.p[1])} m`;
  }

  $('b-seguir').addEventListener('click', () => pausar(false));
  $('b-reiniciar').addEventListener('click', () => empezar(mision));
  $('b-menu').addEventListener('click', () => volverMenu());
  $('b-reintentar').addEventListener('click', () => empezar(mision));
  $('b-menu-fin').addEventListener('click', () => volverMenu());

  function volverMenu() {
    estado = 'menu';
    e = null;
    mundo3d.colocarAro(null);
    actualizarSonido(null, false);
    pintarMenu();
    pantalla('menu');
    $('hud').hidden = true;
  }

  if (navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches) $('aviso-tactil').hidden = false;

  // Enganche de solo lectura para pruebas automáticas.
  window.__cieloAbierto = { get estado() { return estado; }, get avion() { return e; }, get pasoIndice() { return indicePaso; } };

  ajustar();
  pintarMenu();
  pantalla('menu');
  $('hud').hidden = true;
  requestAnimationFrame(bucle);
})();
