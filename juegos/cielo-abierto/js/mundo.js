// Escena 3D low-poly: isla, cielo, aeropuertos, nubes y avioneta.
(function () {
  'use strict';
  const T = window.Terreno;

  const color = (hex) => new THREE.Color(hex);
  const PALETA = {
    arena: color(0xf0d79c), prado: color(0x8fd45c), pradoOscuro: color(0x6cbf52),
    bosque: color(0x3f9a62), roca: color(0x8d7f96), rocaClara: color(0xa99bb0), nieve: color(0xf6f6ff),
  };

  function colorDe(h, ruido, destino) {
    if (h < 7) destino.copy(PALETA.arena);
    else if (h < 170) destino.copy(ruido > 0.5 ? PALETA.prado : PALETA.pradoOscuro);
    else if (h < 360) destino.copy(ruido > 0.45 ? PALETA.bosque : PALETA.pradoOscuro);
    else if (h < 720) destino.copy(ruido > 0.5 ? PALETA.roca : PALETA.rocaClara);
    else destino.copy(PALETA.nieve);
    const brillo = 0.93 + ruido * 0.14;
    destino.setRGB(destino.r * brillo, destino.g * brillo, destino.b * brillo);
  }

  function crearTerreno() {
    const { N, CELDA, MITAD } = T;
    const total = N * N * 6;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const c = new THREE.Color();
    let k = 0;
    const tri = (v, i, j) => {
      let suma = 0;
      for (const [a, b] of v) suma += T.vertice(a, b);
      colorDe(suma / 3, T.azar(i * 3 + v[1][0], j * 7 + v[1][1]), c);
      for (const [a, b] of v) {
        pos[k * 3] = a * CELDA - MITAD;
        pos[k * 3 + 1] = T.vertice(a, b);
        pos[k * 3 + 2] = b * CELDA - MITAD;
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        k++;
      }
    };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        tri([[i, j], [i, j + 1], [i + 1, j]], i, j);
        tri([[i + 1, j], [i, j + 1], [i + 1, j + 1]], i, j);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    return m;
  }

  function crearCielo() {
    const g = new THREE.IcosahedronGeometry(20000, 14);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const hor = color(0xffdcb4), med = color(0x86d3ef), cen = color(0x2d7bd4), c = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / 20000;
      if (y < 0.14) c.copy(hor).lerp(med, Math.max(0, y / 0.14));
      else c.copy(med).lerp(cen, Math.min(1, (y - 0.14) / 0.7));
      for (let v = 0; v < 3; v++) { col[(i + v) * 3] = c.r; col[(i + v) * 3 + 1] = c.g; col[(i + v) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  }

  function crearArboles() {
    const g = new THREE.ConeGeometry(1, 1, 5);
    g.translate(0, 0.5, 0);
    const lista = [];
    for (let i = 0; i < 26000 && lista.length < 3200; i++) {
      const x = T.azar(i, 11) * 21000 - 10500, z = T.azar(i, 29) * 21000 - 10500;
      const h = T.altura(x, z);
      if (h < 14 || h > 380 || T.azar(i, 47) < 0.25) continue;
      if (T.AEROPUERTOS.some((a) => Math.abs(x - a.x) < 450 && Math.abs(z - a.z) < 1400)) continue;
      lista.push([x, h - 0.5, z, 7 + T.azar(i, 5) * 8, 16 + T.azar(i, 8) * 22, T.azar(i, 13)]);
    }
    const malla = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ flatShading: true }), lista.length);
    const o = new THREE.Object3D(), c = new THREE.Color();
    lista.forEach(([x, y, z, r, a, t], i) => {
      o.position.set(x, y, z); o.scale.set(r, a, r); o.rotation.y = t * 6; o.updateMatrix();
      malla.setMatrixAt(i, o.matrix);
      malla.setColorAt(i, c.setHex(t > 0.6 ? 0x2f8f63 : t > 0.25 ? 0x3ca35f : 0x7fbf4a));
    });
    return malla;
  }

  function crearNubes() {
    const cuantas = 420;
    const malla = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.93 }),
      cuantas
    );
    const o = new THREE.Object3D();
    for (let i = 0; i < cuantas; i++) {
      const grupo = i % 7 === 0 ? i : i - (i % 7);
      const cx = T.azar(grupo, 3) * 30000 - 15000, cz = T.azar(grupo, 19) * 30000 - 15000, cy = 1250 + T.azar(grupo, 31) * 500;
      o.position.set(cx + (T.azar(i, 2) - 0.5) * 520, cy + (T.azar(i, 6) - 0.5) * 50, cz + (T.azar(i, 9) - 0.5) * 340);
      const r = 90 + T.azar(i, 15) * 170;
      o.scale.set(r * 1.5, r * 0.55, r);
      o.rotation.set(0, T.azar(i, 21) * 6, 0);
      o.updateMatrix();
      malla.setMatrixAt(i, o.matrix);
    }
    return malla;
  }

  function texturaPista() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 4096;
    const x = c.getContext('2d');
    x.fillStyle = '#4b4f5c'; x.fillRect(0, 0, 256, 4096);
    x.fillStyle = '#f5f5f5';
    x.fillRect(6, 0, 5, 4096); x.fillRect(245, 0, 5, 4096);
    const umbral = (y) => { for (let i = 0; i < 8; i++) { x.fillRect(24 + i * 27 - (i > 3 ? -2 : 0), y, 14, 110); } };
    umbral(16); umbral(4096 - 126);
    x.font = 'bold 120px sans-serif'; x.textAlign = 'center';
    x.save(); x.translate(128, 4096 - 170); x.fillText('36', 0, 0); x.restore();
    x.save(); x.translate(128, 170); x.rotate(Math.PI); x.fillText('18', 0, 0); x.restore();
    for (let y = 330; y < 3740; y += 150) x.fillRect(124, y, 8, 85);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function caja(a, b, c, col, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), new THREE.MeshLambertMaterial({ color: col, flatShading: true }));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  function crearAeropuerto(ap, textura) {
    const g = new THREE.Group();
    const anchoPista = ap.mitadAncho * 2, largoPista = ap.mitadLargo * 2;
    const pista = new THREE.Mesh(new THREE.PlaneGeometry(anchoPista, largoPista), new THREE.MeshLambertMaterial({ map: textura }));
    pista.rotation.x = -Math.PI / 2;
    pista.position.set(ap.x, ap.y + 0.12, ap.z);
    pista.receiveShadow = true;
    g.add(pista);

    const x = ap.x + 75, y = ap.y;
    g.add(caja(40, 11, 30, 0xee6c4d, x + 25, y + 5.5, ap.z - 120));
    g.add(caja(44, 2, 34, 0xf7c35f, x + 25, y + 12, ap.z - 120));
    g.add(caja(36, 9, 26, 0x3d8fd1, x + 25, y + 4.5, ap.z - 60));
    g.add(caja(7, 26, 7, 0xf4f1e8, x + 18, y + 13, ap.z + 10));
    g.add(caja(11, 5, 11, 0x2d4a6b, x + 18, y + 28, ap.z + 10));

    const manga = new THREE.Group();
    const cono = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 6, 1, true), new THREE.MeshLambertMaterial({ color: 0xff8a3c, side: THREE.DoubleSide, flatShading: true }));
    cono.rotation.x = Math.PI / 2;
    cono.position.z = 3.5;
    manga.add(cono);
    manga.position.set(ap.x - 45, y + 9, ap.z + 620);
    g.add(manga, caja(0.4, 9, 0.4, 0xf4f1e8, ap.x - 45, y + 4.5, ap.z + 620));

    const papi = [];
    for (let i = 0; i < 4; i++) {
      const luz = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030, fog: false }));
      luz.position.set(ap.x - 28 - i * 10, y + 1.8, ap.z + 400);
      g.add(luz);
      papi.push(luz);
    }
    return { grupo: g, papi, manga };
  }

  function crearAvion() {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const pieza = (geo, c, x, y, z) => {
      const m = new THREE.Mesh(geo, mat(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const cilindro = (r1, r2, largo, c, z, y) => {
      const geo = new THREE.CylinderGeometry(r1, r2, largo, 6);
      geo.rotateX(Math.PI / 2);
      return pieza(geo, c, 0, y, z);
    };
    cilindro(0.72, 0.62, 2.6, 0xfafaf2, -0.2, 0);
    cilindro(0.56, 0.72, 1.1, 0xee6c4d, -2.05, 0);
    cilindro(0.16, 0.62, 3.6, 0xfafaf2, 3, 0.18);
    const cono = new THREE.ConeGeometry(0.28, 0.6, 6);
    cono.rotateX(-Math.PI / 2);
    pieza(cono, 0xf7c35f, 0, 0, -2.85);
    pieza(new THREE.BoxGeometry(1.15, 0.72, 1.9), 0x2d5d8a, 0, 0.72, -0.25);

    pieza(new THREE.BoxGeometry(4.4, 0.16, 1.6), 0xfafaf2, 0, -0.38, 0.1);
    pieza(new THREE.BoxGeometry(3.3, 0.14, 1.3), 0xee6c4d, -3.85, -0.34, 0.05);
    pieza(new THREE.BoxGeometry(3.3, 0.14, 1.3), 0xee6c4d, 3.85, -0.34, 0.05);
    pieza(new THREE.BoxGeometry(3.3, 0.08, 0.75), 0xfafaf2, 0, 0.3, 4.55);
    pieza(new THREE.BoxGeometry(0.1, 1.45, 0.95), 0xee6c4d, 0, 1.0, 4.65);

    const articulada = (a, b, c, col, x, y, z) => {
      const eje = new THREE.Group();
      eje.position.set(x, y, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), mat(col));
      if (a > b) m.position.z = c / 2; else m.position.z = c / 2;
      eje.add(m);
      g.add(eje);
      return eje;
    };
    const alerones = [articulada(2.2, 0.08, 0.4, 0xf7c35f, -3.9, -0.34, 0.7), articulada(2.2, 0.08, 0.4, 0xf7c35f, 3.9, -0.34, 0.7)];
    const elevador = articulada(3.3, 0.06, 0.45, 0xf7c35f, 0, 0.3, 4.93);
    const timon = articulada(0.08, 1.4, 0.45, 0xf7c35f, 0, 1.0, 5.13);
    const flaps = [articulada(1.7, 0.08, 0.42, 0xd9d9cf, -1.5, -0.4, 0.9), articulada(1.7, 0.08, 0.42, 0xd9d9cf, 1.5, -0.4, 0.9)];

    const rueda = (x, y, z) => {
      const geo = new THREE.CylinderGeometry(0.27, 0.27, 0.16, 8);
      geo.rotateZ(Math.PI / 2);
      pieza(geo, 0x2b2b33, x, y, z);
      pieza(new THREE.BoxGeometry(0.08, Math.abs(y) - 0.3, 0.1), 0xd9d9cf, x, y / 2 - 0.1, z);
    };
    rueda(-1.25, -1.08, 0.3); rueda(1.25, -1.08, 0.3); rueda(0, -1.03, -1.6);

    const helice = new THREE.Group();
    helice.position.z = -2.95;
    const pala = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.04), mat(0x2b2b33));
    const disco = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 16),
      new THREE.MeshBasicMaterial({ color: 0x20242e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    helice.add(pala, disco);
    g.add(helice);

    g.userData = { alerones, elevador, timon, flaps, helice, pala, disco };
    return g;
  }

  function crearAro() {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(75, 6, 5, 14),
      new THREE.MeshBasicMaterial({ color: 0xff7a45, fog: false, transparent: true, opacity: 0.85 })
    );
    m.visible = false;
    return m;
  }

  function crear(escena) {
    escena.background = color(0xbfe3ee);
    escena.fog = new THREE.Fog(0xcbe6ee, 3500, 15000);
    escena.add(new THREE.HemisphereLight(0xdff2ff, 0x6f8f5a, 1.9));
    const sol = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 500 });
    sol.shadow.bias = -0.0015;
    escena.add(sol, sol.target);

    const cielo = crearCielo();
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), new THREE.MeshLambertMaterial({ color: 0x2f9ad0 }));
    agua.rotation.x = -Math.PI / 2;
    escena.add(cielo, agua, crearTerreno(), crearArboles(), crearNubes());

    const textura = texturaPista();
    const aeropuertos = T.AEROPUERTOS.map((ap) => {
      const a = crearAeropuerto(ap, textura);
      escena.add(a.grupo);
      return { ap, ...a };
    });
    const avion = crearAvion();
    const aro = crearAro();
    escena.add(avion, aro);

    const ROJO = new THREE.Color(0xff3030), BLANCO = new THREE.Color(0xffffff);
    const LIMITES = [3.5, 3.17, 2.83, 2.5];

    function actualizar(e, mando, camara, viento) {
      cielo.position.copy(camara.position);
      avion.position.set(e.p[0], e.p[1], e.p[2]);
      avion.quaternion.set(e.q[0], e.q[1], e.q[2], e.q[3]);
      const u = avion.userData;
      u.helice.rotation.z += e.motor * 1.4;
      u.pala.visible = e.motor < 0.3;
      u.disco.visible = e.motor >= 0.3;
      u.alerones[0].rotation.x = mando.alabeo * 0.35;
      u.alerones[1].rotation.x = -mando.alabeo * 0.35;
      u.elevador.rotation.x = -Math.max(-1, Math.min(1, mando.cabeceo + mando.trim)) * 0.4;
      u.timon.rotation.y = -mando.timon * 0.4;
      u.flaps[0].rotation.x = u.flaps[1].rotation.x = e.flaps * 0.6;

      sol.position.set(e.p[0] + 120, e.p[1] + 260, e.p[2] + 90);
      sol.target.position.set(e.p[0], e.p[1], e.p[2]);

      for (const a of aeropuertos) {
        const dist = e.p[2] - (a.ap.z + 400);
        const angulo = dist > 0 ? (Math.atan2(e.p[1] - a.ap.y, dist) * 180) / Math.PI : 0;
        const distancia = Math.hypot(e.p[0] - a.ap.x, e.p[2] - (a.ap.z + 400));
        a.papi.forEach((luz, i) => {
          luz.material.color.copy(angulo > LIMITES[i] ? BLANCO : ROJO);
          luz.scale.setScalar(Math.max(1, distancia / 260)); // Siguen visibles desde lejos.
        });
        a.manga.rotation.y = Math.atan2(viento[0], viento[2]) || 0;
      }
    }

    function colocarAro(punto, origen) {
      aro.visible = !!punto;
      if (!punto) return;
      aro.position.set(punto.x, punto.y, punto.z);
      aro.rotation.y = Math.atan2(origen.x - punto.x, origen.z - punto.z);
    }

    return { actualizar, colocarAro, avion };
  }

  window.Mundo = { crear };
})();
