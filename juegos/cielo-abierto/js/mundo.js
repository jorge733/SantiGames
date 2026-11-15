// Escena 3D low-poly: isla, cielo, aeropuertos, nubes y los aviones de la aerolínea.
(function () {
  'use strict';
  const T = window.Terreno;

  const color = (hex) => new THREE.Color(hex);
  // Dirección del sol (tarde despejada): la comparten la luz, el cielo y los reflejos del agua.
  const SOL = new THREE.Vector3(0.42, 0.62, 0.36).normalize();
  const NIEBLA = 0xc3d3df; // bruma del horizonte: el cielo termina en este mismo color

  // Paleta natural de la isla (de la costa a las cumbres).
  const PALETA = {
    arena: color(0xcdb98e), arenaHumeda: color(0x9c8a68), prado: color(0x6f8d3f), pradoSeco: color(0x8f9450),
    pradoOscuro: color(0x55753a), bosque: color(0x3c5a2c), roca: color(0x777068), rocaOscura: color(0x5a5552), nieve: color(0xeef2f6),
  };

  // Colores de un bioma, pasados a tonos naturales: algo menos saturados y más oscuros que los de la tabla.
  const cacheBioma = {};
  function coloresBioma(nombre) {
    if (cacheBioma[nombre]) return cacheBioma[nombre];
    const b = window.Destinos.BIOMAS[nombre], gris = new THREE.Color();
    const natural = (hex) => {
      const c = color(hex), l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
      gris.setRGB(l, l, l);
      return c.lerp(gris, 0.2).multiplyScalar(0.88);
    };
    return (cacheBioma[nombre] = { capas: b.colores.map(natural), nieve: color(b.nieve), roca: natural(0x7d746c) });
  }

  // Mezcla en "salida" el color del suelo en un vértice según altura, pendiente (0 llano, 1 vertical) y manchas de ruido.
  const tmp = new THREE.Color();
  function colorSuelo(h, pendiente, mancha, fino, salida) {
    const d = T.destino;
    const roca = suaveC(0.28, 0.5, pendiente + (fino - 0.5) * 0.12);
    if (d) {
      const b = coloresBioma(d.bioma), c = b.capas, rel = h - T.AEROPUERTOS[0].y;
      const t = Math.max(0, Math.min(2.999, (rel + 40) / 220 + (mancha - 0.5) * 1.2));
      const i = Math.floor(t);
      salida.copy(c[i]).lerp(c[i + 1], suaveC(0.2, 0.8, t - i));
      salida.lerp(b.roca, roca * 0.85);
      if (d.mar) salida.lerp(PALETA.arena, suaveC(14, 8, h)).lerp(PALETA.arenaHumeda, suaveC(4, 0, h));
      const nieve = suaveC(0, 400, h - Math.max(d.elev + 2200, 2600) + (mancha - 0.5) * 500) * (1 - roca * 0.6);
      salida.lerp(b.nieve, nieve);
    } else {
      salida.copy(PALETA.prado).lerp(PALETA.pradoSeco, suaveC(0.45, 0.75, mancha)).lerp(PALETA.pradoOscuro, suaveC(0.5, 0.25, mancha) * 0.8);
      salida.lerp(PALETA.bosque, suaveC(150, 320, h + (mancha - 0.5) * 160) * 0.85);
      salida.lerp(tmp.copy(PALETA.roca).lerp(PALETA.rocaOscura, fino), Math.max(roca, suaveC(480, 720, h + (mancha - 0.5) * 200)));
      salida.lerp(PALETA.nieve, suaveC(820, 980, h + (mancha - 0.5) * 220 - pendiente * 200));
      salida.lerp(PALETA.arena, suaveC(12, 6, h)).lerp(PALETA.arenaHumeda, suaveC(2, -4, h));
    }
    const brillo = 0.9 + fino * 0.2;
    salida.setRGB(salida.r * brillo, salida.g * brillo, salida.b * brillo);
  }
  function suaveC(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Textura de detalle en gris (tierra, hierba, piedrecitas) que se repite sobre el terreno y rompe el color plano.
  function texturaDetalle() {
    const n = 256, c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d'), img = x.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      // Ruido periódico (sin costuras) a varias escalas.
      let v = 0, amp = 0.5;
      for (const f of [4, 8, 16, 32, 64]) {
        const u = (i / n) * f, w = (j / n) * f;
        v += amp * ruidoPeriodico(u, w, f);
        amp *= 0.55;
      }
      const g = Math.max(0, Math.min(255, 150 + (v - 0.48) * 210 + (T.azar(i, j) - 0.5) * 26));
      const k = (j * n + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  function ruidoPeriodico(x, z, p) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const A = (a, b) => T.azar(((a % p) + p) % p + p * 3.1, ((b % p) + p) % p + 17);
    const a = A(ix, iz), b = A(ix + 1, iz), c = A(ix, iz + 1), d = A(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  let detalle = null;

  // Malla indexada con normales suaves: misma triangulación que T.altura (la diagonal va de (i+1, j) a (i, j+1)).
  function crearTerreno() {
    const { N, CELDA, MITAD } = T;
    const lado = N + 1, total = lado * lado;
    const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const c = new THREE.Color();
    const v = (i, j) => T.vertice(Math.max(0, Math.min(N, i)), Math.max(0, Math.min(N, j)));
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * lado + i, h = T.vertice(i, j);
        const x = i * CELDA - MITAD, z = j * CELDA - MITAD;
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        uv[k * 2] = x / 90; uv[k * 2 + 1] = z / 90;
        const gx = (v(i + 1, j) - v(i - 1, j)) / (2 * CELDA), gz = (v(i, j + 1) - v(i, j - 1)) / (2 * CELDA);
        const pendiente = 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
        const mancha = T.fbm(x * 0.0006 + 40, z * 0.0006 + 7, 4);
        const fino = T.fbm(x * 0.004 + 3, z * 0.004 + 11, 2);
        colorSuelo(h, Math.min(1, pendiente * 2.2), mancha, fino, c);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }
    const indices = new Uint32Array(N * N * 6);
    let n = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * lado + i, b = a + 1, cc = a + lado, d = cc + 1;
        indices[n++] = a; indices[n++] = cc; indices[n++] = b;
        indices[n++] = b; indices[n++] = cc; indices[n++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    if (!detalle) detalle = texturaDetalle();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: detalle });
    // El detalle se mezcla a dos escalas (para que no se note la repetición) y se apaga con la distancia.
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        float detA = texture2D(map, vMapUv).r, detB = texture2D(map, vMapUv * 0.123 + 0.37).r;
        float det = (detA * 0.55 + detB * 0.45) / 0.59;
        det = mix(det, 1.0, smoothstep(900.0, 5000.0, length(vViewPosition)));
        diffuseColor.rgb *= det;`);
    };
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }

  // Cielo con degradado físico aproximado: bruma en el horizonte, azul profundo arriba, disco y halo del sol.
  function crearCielo() {
    const g = new THREE.SphereGeometry(20000, 32, 16);
    const m = new THREE.ShaderMaterial({
      uniforms: {
        sol: { value: SOL }, horizonte: { value: color(NIEBLA) }, cenit: { value: color(0x2f63a8) }, medio: { value: color(0x6b9fd0) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 sol, horizonte, cenit, medio; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float y = max(d.y, 0.0);
          vec3 c = mix(horizonte, medio, smoothstep(0.0, 0.18, pow(y, 0.8)));
          c = mix(c, cenit, smoothstep(0.12, 0.9, y));
          float s = max(dot(d, sol), 0.0);
          c += vec3(1.0, 0.86, 0.66) * (pow(s, 6.0) * 0.18 + pow(s, 60.0) * 0.35);
          c += vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9997, s) * 2.0;
          c = mix(c, horizonte * 0.92, smoothstep(0.0, -0.08, d.y));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    const cielo = new THREE.Mesh(g, m);
    cielo.renderOrder = -10;
    cielo.frustumCulled = false;
    return cielo;
  }

  // Geometría de un árbol con colores por vértice: tronco marrón y copa blanca (la copa la tiñe el color de cada instancia).
  function geometriaArbol(conifera) {
    const piezas = [];
    const tronco = new THREE.CylinderGeometry(0.06, 0.09, 0.35, 5);
    tronco.translate(0, 0.175, 0);
    piezas.push([tronco, 0x6a5440]);
    if (conifera) {
      for (const [r, alto, y] of [[0.42, 0.55, 0.3], [0.33, 0.45, 0.55], [0.22, 0.35, 0.78]]) {
        const cono = new THREE.ConeGeometry(r, alto, 7);
        cono.translate(0, y + alto / 2 - 0.08, 0);
        piezas.push([cono, 0xffffff]);
      }
    } else {
      const copa = new THREE.IcosahedronGeometry(0.42, 1);
      copa.scale(1, 0.85, 1);
      copa.translate(0, 0.62, 0);
      piezas.push([copa, 0xffffff]);
    }
    const geo = new THREE.BufferGeometry();
    const pos = [], nor = [], col = [], c = new THREE.Color();
    for (const [g0, hex] of piezas) {
      const g1 = g0.index ? g0.toNonIndexed() : g0;
      c.setHex(hex);
      pos.push(...g1.attributes.position.array);
      nor.push(...g1.attributes.normal.array);
      for (let i = 0; i < g1.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  function crearArboles() {
    const grupo = new THREE.Group();
    const d = T.destino, bioma = d ? window.Destinos.BIOMAS[d.bioma] : null;
    const densidad = d ? Math.min(1, bioma.arboles + (d.arbolesExtra || 0)) : 1;
    const lado = d ? T.MITAD * 0.9 : 10500;
    const colores = d ? bioma.colorArbol : [0x3f7a3a, 0x4d8a40, 0x5f9446, 0x386a36];
    if (densidad <= 0) return grupo;
    const listas = [[], []]; // 0 = frondosos, 1 = coníferas
    for (let i = 0; i < 40000 && listas[0].length + listas[1].length < 5200 * densidad; i++) {
      const x = T.azar(i, 11) * lado * 2 - lado, z = T.azar(i, 29) * lado * 2 - lado;
      const h = T.altura(x, z);
      if (d ? (h < 10 || h > d.elev + 900) : (h < 14 || h > 520)) continue;
      // Los árboles se agrupan en bosques: se descartan donde el ruido de "bosque" es bajo.
      if (T.fbm(x * 0.0009 + 13, z * 0.0009 + 2, 3) + T.azar(i, 47) * 0.25 < 0.52) continue;
      if (T.AEROPUERTOS.some((a) => Math.abs(x - a.x) < 450 && Math.abs(z - a.z) < a.mitadLargo + 700)) continue;
      if (T.enPasilloFinal(x, z)) continue; // sin árboles altos bajo la aproximación
      const conifera = d ? (d.bioma === 'patagonia' || h > d.elev + 350 || T.azar(i, 53) < 0.25) : h > 220 || T.azar(i, 53) < 0.3;
      listas[conifera ? 1 : 0].push([x, h - 0.6, z, 9 + T.azar(i, 5) * 9, 14 + T.azar(i, 8) * 20, T.azar(i, 13)]);
    }
    const o = new THREE.Object3D(), c = new THREE.Color();
    listas.forEach((lista, tipo) => {
      if (!lista.length) return;
      const malla = new THREE.InstancedMesh(geometriaArbol(tipo === 1), new THREE.MeshLambertMaterial({ vertexColors: true }), lista.length);
      lista.forEach(([x, y, z, r, a, t], i) => {
        const alto = tipo === 1 ? a * 1.25 : a;
        o.position.set(x, y, z); o.scale.set(r * (tipo === 1 ? 1.1 : 1.6), alto, r * (tipo === 1 ? 1.1 : 1.6)); o.rotation.y = t * 6; o.updateMatrix();
        malla.setMatrixAt(i, o.matrix);
        c.setHex(colores[Math.floor(t * colores.length) % colores.length]);
        const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
        c.lerp(new THREE.Color(l, l, l), 0.25).multiplyScalar(0.95 + T.azar(i, 61) * 0.3);
        malla.setColorAt(i, c);
      });
      malla.castShadow = false;
      malla.receiveShadow = true;
      grupo.add(malla);
    });
    return grupo;
  }

  // Ciudad low-poly: bloques junto al aeropuerto, fuera de la pista, de los pasillos y del agua.
  function crearCiudad() {
    const d = T.destino, urbe = d && d.urbe;
    if (!urbe || !urbe.tam) return new THREE.Group();
    const cuantos = [0, 160, 420, 900][urbe.tam], alto = [0, 22, 40, 90][urbe.tam];
    const centro = { este: [7000, 0], oeste: [-7000, 0], norte: [-2000, -7000], sur: [-2500, 6500] }[urbe.lado] || [6000, 0];
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial();
    // Ventanas en las fachadas y azoteas más oscuras, calculadas en el shader a partir de la posición real.
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying float vTecho;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMundo = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vTecho = step(0.5, normal.y);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying float vTecho;')
        .replace('#include <map_fragment>', `
          float piso = step(0.35, fract(vMundo.y / 3.4));
          float columna = step(0.4, fract((vMundo.x + vMundo.z) / 3.6));
          float ventana = piso * columna * (1.0 - vTecho);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.2, 0.26), ventana * 0.75);
          diffuseColor.rgb *= mix(1.0, 0.62, vTecho);`);
    };
    const malla = new THREE.InstancedMesh(g, mat, cuantos);
    malla.castShadow = false;
    const o = new THREE.Object3D(), c = new THREE.Color();
    const tonos = [0xd9d2c3, 0xc8c1b2, 0xb7bcc4, 0xe0d4bc, 0xa9b0b8, 0xcdb9a2, 0x9aa3ad];
    let n = 0;
    for (let i = 0; i < cuantos * 6 && n < cuantos; i++) {
      const r = Math.sqrt(T.azar(i, 71)) * (2500 + urbe.tam * 900), ang = T.azar(i, 73) * Math.PI * 2;
      const x = centro[0] + Math.cos(ang) * r, z = centro[1] + Math.sin(ang) * r;
      const h = T.altura(x, z);
      if (h < 4 || h > d.elev + 120 || Math.abs(x) < 900 || T.enPasilloFinal(x, z)) continue;
      const cerca = 1 - r / (2500 + urbe.tam * 900);
      const ancho = 25 + T.azar(i, 79) * 45;
      o.position.set(x, h - 1, z);
      o.scale.set(ancho, 8 + Math.pow(T.azar(i, 83), 2) * alto * (0.4 + cerca * 1.6), ancho * (0.6 + T.azar(i, 89) * 0.8));
      o.rotation.y = 0;
      o.updateMatrix();
      malla.setMatrixAt(n, o.matrix);
      malla.setColorAt(n, c.setHex(tonos[Math.floor(T.azar(i, 97) * tonos.length)]));
      n++;
    }
    malla.count = n;
    return malla;
  }

  // Textura de una bocanada de nube: varios círculos difusos superpuestos con bordes irregulares.
  function texturaNube() {
    const n = 128, c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const r = n * (0.12 + T.azar(i, 401) * 0.16);
      const ang = T.azar(i, 403) * Math.PI * 2, dist = T.azar(i, 405) * n * 0.24;
      const cx = n / 2 + Math.cos(ang) * dist, cy = n / 2 + Math.sin(ang) * dist * 0.8;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, n, n);
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // Cúmulos: cada nube son muchas bocanadas planas que siempre miran a la cámara (todo en una sola llamada de dibujo).
  // La base de cada bocanada es gris azulada y la cima, blanca y algo dorada del lado del sol.
  function crearNubes() {
    const cuantas = 520;
    const centro = new Float32Array(cuantas * 4 * 3), esquina = new Float32Array(cuantas * 4 * 2), datos = new Float32Array(cuantas * 4 * 3);
    const indices = new Uint16Array(cuantas * 6);
    for (let i = 0; i < cuantas; i++) {
      const grupo = i - (i % 13);
      const cx = T.azar(grupo, 3) * 40000 - 20000, cz = T.azar(grupo, 19) * 40000 - 20000, cy = 1300 + T.azar(grupo, 31) * 450;
      const ancho = 500 + T.azar(grupo, 37) * 700;
      const u = T.azar(i, 2) - 0.5, w = T.azar(i, 9) - 0.5;
      // Más altas en el centro: forma de coliflor con base plana.
      const alto = (1 - Math.min(1, Math.hypot(u, w) * 2)) * 260 * (0.5 + T.azar(grupo, 41));
      const px = cx + u * ancho, pz = cz + w * ancho * 0.7, py = cy + T.azar(i, 6) * alto;
      const tam = 110 + T.azar(i, 15) * 160 + alto * 0.4;
      for (let v = 0; v < 4; v++) {
        const k = i * 4 + v;
        centro.set([px, py, pz], k * 3);
        esquina.set([v & 1 ? 1 : -1, v & 2 ? 1 : -1], k * 2);
        datos.set([tam, T.azar(i, 21) * 6.28, (py - cy) / 400], k * 3);
      }
      indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(centro, 3));
    g.setAttribute('esquina', new THREE.BufferAttribute(esquina, 2));
    g.setAttribute('datos', new THREE.BufferAttribute(datos, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mapa: { value: null }, sol: { value: SOL } }]),
      vertexShader: `
        attribute vec2 esquina; attribute vec3 datos;
        varying vec2 vUv; varying float vAltura, vLuz, vCerca;
        uniform vec3 sol;
        #include <common>
        #include <fog_pars_vertex>
        #include <logdepthbuf_pars_vertex>
        void main(){
          float c = cos(datos.y), s = sin(datos.y);
          vec2 e = vec2(c * esquina.x - s * esquina.y, s * esquina.x + c * esquina.y);
          vUv = esquina * 0.5 + 0.5;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mvPosition.xyz);
          vCerca = smoothstep(datos.x * 0.6, datos.x * 2.2, dist);
          mvPosition.xy += e * datos.x;
          vAltura = clamp(datos.z + esquina.y * 0.25, 0.0, 1.0);
          vec3 haciaCam = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
          vLuz = 0.5 + 0.5 * dot(-haciaCam, sol);
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D mapa; varying vec2 vUv; varying float vAltura, vLuz, vCerca;
        #include <common>
        #include <fog_pars_fragment>
        #include <logdepthbuf_pars_fragment>
        void main(){
          #include <logdepthbuf_fragment>
          float a = texture2D(mapa, vUv).a * vCerca;
          if (a < 0.01) discard;
          vec3 base = vec3(0.62, 0.66, 0.74), cima = vec3(1.0, 0.99, 0.96);
          vec3 col = mix(base, cima, smoothstep(0.0, 0.85, vAltura));
          col += vec3(0.12, 0.08, 0.02) * vLuz * vAltura;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
    });
    m.uniforms.mapa.value = texturaNube();
    const malla = new THREE.Mesh(g, m);
    malla.frustumCulled = false;
    malla.renderOrder = 2;
    return malla;
  }

  // Textura de pista a escala: unos 2,9 píxeles por metro (menos en las pistas muy largas).
  // Asfalto con grano, juntas, marcas de rueda en las zonas de toma de contacto y la señalización OACI básica.
  function texturaPista(largo) {
    const alto = Math.min(8192, Math.round(largo * 2.93)), pm = alto / largo; // píxeles por metro a lo largo
    const c = document.createElement('canvas');
    c.width = 256; c.height = alto;
    const x = c.getContext('2d');
    x.fillStyle = '#3f4248'; x.fillRect(0, 0, 256, alto);
    // Grano del asfalto y parches de distinto tono.
    for (let i = 0; i < alto / 3; i++) {
      const g = 50 + Math.floor(T.azar(i, 501) * 30);
      x.fillStyle = `rgba(${g},${g + 2},${g + 6},0.5)`;
      x.fillRect(T.azar(i, 503) * 256, T.azar(i, 507) * alto, 2 + T.azar(i, 509) * 4, 2 + T.azar(i, 511) * 4);
    }
    for (let i = 0; i < largo / 60; i++) {
      x.fillStyle = T.azar(i, 513) > 0.5 ? 'rgba(20,22,26,0.18)' : 'rgba(120,122,126,0.10)';
      x.fillRect(T.azar(i, 515) * 200, T.azar(i, 517) * alto, 40 + T.azar(i, 519) * 120, 80 + T.azar(i, 521) * 300);
    }
    x.fillStyle = 'rgba(25,26,30,0.35)';
    for (let y = 0; y < alto; y += 7.5 * pm) x.fillRect(0, y, 256, 1);
    x.fillRect(127, 0, 2, alto);
    // Goma de los neumáticos en las dos zonas de toma de contacto.
    for (const [z0, sentido] of [[alto, -1], [0, 1]]) {
      for (let i = 0; i < 260; i++) {
        const d = Math.pow(T.azar(i, 531 + sentido), 1.6) * 650 * pm + 150 * pm;
        const lado = T.azar(i, 533) > 0.5 ? 1 : -1;
        x.fillStyle = `rgba(14,14,16,${0.05 + T.azar(i, 535) * 0.12})`;
        x.fillRect(128 + lado * (20 + T.azar(i, 537) * 50) - 6, z0 + sentido * d, 10 + T.azar(i, 539) * 14, sentido * (40 + T.azar(i, 541) * 160));
      }
    }
    x.fillStyle = '#ecebe6';
    x.fillRect(6, 0, 5, alto); x.fillRect(245, 0, 5, alto);
    // Umbral (piano), números, eje, zona de toma de contacto y punto de visada.
    const umbral = (y) => { for (let i = 0; i < 8; i++) x.fillRect(22 + i * 27 + (i > 3 ? 4 : 0), y, 12, 30 * pm); };
    umbral(6 * pm); umbral(alto - 36 * pm);
    x.font = 'bold 120px sans-serif'; x.textAlign = 'center';
    x.save(); x.translate(128, alto - 50 * pm); x.fillText('36', 0, 0); x.restore();
    x.save(); x.translate(128, 50 * pm); x.rotate(Math.PI); x.fillText('18', 0, 0); x.restore();
    const marcasTDZ = (y0, s) => {
      for (const [d, n] of [[150, 3], [300, 0], [450, 2], [600, 2], [750, 1], [900, 1]]) {
        if (d * 2 > largo - 400) break;
        const y = y0 + s * d * pm, alto2 = (d === 300 ? 45 : 22) * pm;
        const ancho = d === 300 ? 22 : 9;
        for (const lado of [-1, 1]) {
          if (d === 300) { x.fillRect(128 + lado * 52 - ancho / 2, s > 0 ? y : y - alto2, ancho, alto2); continue; }
          for (let k = 0; k < n; k++) x.fillRect(128 + lado * (36 + k * 14) - ancho / 2, s > 0 ? y : y - alto2, ancho, alto2);
        }
      }
    };
    marcasTDZ(alto, -1); marcasTDZ(0, 1);
    for (let y = 100 * pm; y < alto - 100 * pm; y += 50 * pm) x.fillRect(125, y, 6, 30 * pm);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const MAT_CAJA = {};
  function caja(a, b, c, col, x, y, z) {
    const mat = MAT_CAJA[col] || (MAT_CAJA[col] = new THREE.MeshLambertMaterial({ color: col }));
    const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // Losa plana de hormigón o asfalto apoyada en el suelo (plataforma, rodaje).
  function losaSuelo(ancho, largo, col, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, largo), new THREE.MeshLambertMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    return m;
  }

  function crearAeropuerto(ap, textura) {
    const g = new THREE.Group();
    const anchoPista = ap.mitadAncho * 2, largoPista = ap.mitadLargo * 2;
    // Franja de hierba cortada y arcén alrededor de la pista.
    // La hierba cortada toma el tono del terreno del lugar, algo más verde y oscura.
    const hierba = new THREE.Color();
    colorSuelo(ap.y, 0, 0.5, 0.5, hierba);
    hierba.lerp(color(0x60773c), 0.35).multiplyScalar(0.92);
    g.add(losaSuelo(anchoPista + 150, largoPista + 240, hierba, ap.x, ap.y + 0.04, ap.z));
    g.add(losaSuelo(anchoPista + 16, largoPista + 60, 0x55575b, ap.x, ap.y + 0.08, ap.z));
    const pista = new THREE.Mesh(new THREE.PlaneGeometry(anchoPista, largoPista), new THREE.MeshLambertMaterial({ map: textura }));
    pista.rotation.x = -Math.PI / 2;
    pista.position.set(ap.x, ap.y + 0.12, ap.z);
    pista.receiveShadow = true;
    g.add(pista);

    // Calle de rodaje paralela, conexiones y plataforma frente a la terminal.
    const xr = ap.x + ap.mitadAncho + 105, y0 = ap.y + 0.1;
    g.add(losaSuelo(20, largoPista - 120, 0x4a4c51, xr, y0, ap.z));
    g.add(losaSuelo(0.5, largoPista - 120, 0xd9b23a, xr, y0 + 0.02, ap.z));
    for (const dz of [-(ap.mitadLargo - 70), 0, ap.mitadLargo - 70]) {
      g.add(losaSuelo(105, 20, 0x4a4c51, ap.x + ap.mitadAncho + 52, y0, ap.z + dz));
      g.add(losaSuelo(105, 0.5, 0xd9b23a, ap.x + ap.mitadAncho + 52, y0 + 0.02, ap.z + dz));
    }
    const xp = xr + 75;
    g.add(losaSuelo(130, 260, 0x8e8f8c, xp, y0 - 0.02, ap.z - 80));

    // Terminal, hangar y torre de control.
    const xt = xp + 95, y = ap.y;
    g.add(caja(42, 14, 150, 0xd9d6cf, xt, y + 7, ap.z - 80));
    g.add(caja(44, 1, 152, 0x9aa0a6, xt, y + 14.5, ap.z - 80));
    g.add(caja(1, 5, 140, 0x2a3c50, xt - 21.2, y + 8, ap.z - 80)); // cristalera
    g.add(caja(40, 16, 46, 0xb8bcc0, xt - 10, y + 8, ap.z + 120)); // hangar
    g.add(caja(42, 3, 48, 0x8a9096, xt - 10, y + 17, ap.z + 120));
    g.add(caja(6, 30, 6, 0xe6e3dc, xt - 5, y + 15, ap.z + 30));
    g.add(caja(10, 5, 10, 0x2a3c50, xt - 5, y + 32.5, ap.z + 30));
    g.add(caja(11, 1, 11, 0xd9d6cf, xt - 5, y + 35.5, ap.z + 30));
    // Unas furgonetas de servicio en la plataforma dan escala.
    for (let i = 0; i < 6; i++) g.add(caja(2.2, 2.2, 5, [0xf2f2ee, 0xe0b040, 0xf2f2ee][i % 3], xp + 20 + (i % 3) * 14, y + 1.2, ap.z - 180 + Math.floor(i / 3) * 30));

    const manga = new THREE.Group();
    const cono = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xff7a2c, side: THREE.DoubleSide }));
    cono.rotation.x = Math.PI / 2;
    cono.position.z = 3.5;
    manga.add(cono);
    manga.position.set(ap.x - 45, y + 9, ap.z + ap.mitadLargo - 80);
    g.add(manga, caja(0.4, 9, 0.4, 0xf4f1e8, ap.x - 45, y + 4.5, ap.z + ap.mitadLargo - 80));

    // Luces de borde de pista cada 60 m: pequeñas, pero dan profundidad y se ven al aproximar.
    const luces = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), Math.ceil(largoPista / 60) * 2 + 2);
    const o = new THREE.Object3D();
    let n = 0;
    for (let z = -ap.mitadLargo; z <= ap.mitadLargo; z += 60) for (const lado of [-1, 1]) {
      o.position.set(ap.x + lado * (ap.mitadAncho + 2), y + 0.6, ap.z + z); o.updateMatrix(); luces.setMatrixAt(n++, o.matrix);
    }
    luces.count = n;
    g.add(luces);

    const papi = [];
    for (let i = 0; i < 4; i++) {
      g.add(caja(3, 1.2, 1.5, 0x3a3d42, ap.x - ap.mitadAncho - 13 - i * 10, y + 0.6, ap.z + ap.mitadLargo - 300));
      const luz = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030, fog: false }));
      luz.position.set(ap.x - ap.mitadAncho - 13 - i * 10, y + 1.8, ap.z + ap.mitadLargo - 300);
      g.add(luz);
      papi.push(luz);
    }
    return { grupo: g, papi, manga };
  }

  // Materiales de los aviones: pintura satinada; los cristales, oscuros y brillantes. Se comparten por color.
  const MATS_AVION = {};
  function matAvion(c, dobleCara) {
    const clave = c + (dobleCara ? 'd' : '');
    if (MATS_AVION[clave]) return MATS_AVION[clave];
    const cristal = c === 0x22344f || c === 0x2d5d8a;
    const goma = c === 0x2b2b33;
    return (MATS_AVION[clave] = new THREE.MeshStandardMaterial({
      color: cristal ? 0x3a5068 : c, roughness: cristal ? 0.15 : goma ? 0.85 : 0.42, metalness: cristal ? 0.35 : goma ? 0 : 0.18,
      side: dobleCara ? THREE.DoubleSide : THREE.FrontSide,
    }));
  }

  // Luces de navegación: roja en la punta izquierda, verde en la derecha y destello blanco en la cola.
  function lucesNavegacion(g, x, y, z, colaY, colaZ, techoY, techoZ) {
    const luz = (col, px, py, pz) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(px, py, pz);
      g.add(m);
      return m;
    };
    luz(0xff2a2a, -x, y, z); luz(0x2aff6a, x, y, z);
    const destellos = [luz(0xffffff, -x, y, z + 0.25), luz(0xffffff, x, y, z + 0.25), luz(0xffffff, 0, colaY, colaZ)];
    const baliza = luz(0xff3b2a, 0, techoY, techoZ); // baliza anticolisión roja sobre el fuselaje
    return { destellos, baliza };
  }

  function crearAvioneta() {
    const g = new THREE.Group();
    const mat = matAvion;
    const pieza = (geo, c, x, y, z) => {
      const m = new THREE.Mesh(geo, mat(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const cilindro = (r1, r2, largo, c, z, y) => {
      const geo = new THREE.CylinderGeometry(r1, r2, largo, 14);
      geo.rotateX(Math.PI / 2);
      return pieza(geo, c, 0, y, z);
    };
    cilindro(0.72, 0.62, 2.6, 0xfafaf2, -0.2, 0);
    cilindro(0.56, 0.72, 1.1, 0xee6c4d, -2.05, 0);
    cilindro(0.16, 0.62, 3.6, 0xfafaf2, 3, 0.18);
    const cono = new THREE.ConeGeometry(0.28, 0.6, 12);
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
      const geo = new THREE.CylinderGeometry(0.27, 0.27, 0.16, 12);
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

    g.userData = { alerones, elevador, timon, flaps, helices: [{ grupo: helice, palas: [pala], disco }], luces: lucesNavegacion(g, 5.55, -0.34, 0.05, 1.75, 5.1, 1.12, 0.6) };
    return g;
  }

  // Nombre de la aerolínea pintado sobre el fuselaje: una franja curva del mismo radio que el tubo,
  // con el texto en una textura. Se pone a los dos lados y se lee de morro a cola en ambos.
  function rotuloAerolinea(g, radio, largo, zCentro, alturaTexto, altoLetra) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 1024; lienzo.height = 128;
    const x = lienzo.getContext('2d');
    x.fillStyle = '#ee6c4d';
    x.font = 'bold 104px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('BENEDETTO', 512, 68, 1000);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    const arco = altoLetra / radio, centro = Math.acos(-alturaTexto / radio);
    for (const lado of [1, -1]) {
      const t = textura.clone();
      t.needsUpdate = true;
      // La textura va a lo largo del tubo: se gira 90° y, en el lado izquierdo, se invierte para no leerse al revés.
      t.center.set(0.5, 0.5);
      t.rotation = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      const inicio = lado > 0 ? centro - arco / 2 : 2 * Math.PI - centro - arco / 2;
      const geo = new THREE.CylinderGeometry(radio + 0.02, radio + 0.02, largo, 6, 1, true, inicio, arco);
      geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.position.z = zCentro;
      g.add(m);
    }
  }

  // Albatros 72: turbohélice regional de ala alta, 27 m de envergadura y 27 m de largo.
  function crearRegional() {
    const g = new THREE.Group();
    const BLANCO = 0xfafaf2, CORAL = 0xee6c4d, ORO = 0xf7c35f, OSCURO = 0x22344f, GRIS = 0xd9d9cf, NEGRO = 0x2b2b33;
    const mat = matAvion;
    const pieza = (geo, c, x, y, z, padre) => {
      const m = new THREE.Mesh(geo, mat(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      (padre || g).add(m);
      return m;
    };
    // Tubo a lo largo del eje Z: r1 delante, r2 detrás (al girarlo, la tapa superior queda detrás).
    const tubo = (r1, r2, largo, c, x, y, z, lados) => {
      const geo = new THREE.CylinderGeometry(r2, r1, largo, lados || 12);
      geo.rotateX(Math.PI / 2);
      return pieza(geo, c, x, y, z);
    };

    // Fuselaje: morro, cabina de pasajeros y cola levantada.
    tubo(1.4, 1.4, 18, BLANCO, 0, 0, -1);
    tubo(0.35, 1.05, 2.2, BLANCO, 0, -0.3, -12.1);
    tubo(1.05, 1.4, 1.8, BLANCO, 0, -0.1, -10.1);
    const cola = tubo(1.4, 0.35, 6.5, BLANCO, 0, 0.5, 11.1);
    cola.rotation.x = -0.12;
    // Parabrisas y franja de la aerolínea.
    pieza(new THREE.BoxGeometry(1.5, 0.42, 0.9), OSCURO, 0, 0.62, -10.9).rotation.x = -0.45;
    for (const lado of [-1, 1]) {
      pieza(new THREE.BoxGeometry(0.1, 0.32, 0.7), OSCURO, lado * 0.92, 0.55, -10.5);
      pieza(new THREE.BoxGeometry(0.06, 0.28, 19.5), CORAL, lado * 1.37, -0.38, -0.3);
      pieza(new THREE.BoxGeometry(0.06, 0.1, 19.5), ORO, lado * 1.35, -0.62, -0.3);
      // Ventanillas de los pasajeros.
      for (let z = -8; z <= 6.5; z += 0.95) pieza(new THREE.BoxGeometry(0.08, 0.3, 0.24), OSCURO, lado * 1.37, 0.28, z);
      pieza(new THREE.BoxGeometry(0.08, 1.3, 0.75), GRIS, lado * 1.36, -0.05, -8.9); // puerta delantera
    }
    pieza(new THREE.BoxGeometry(2.6, 0.5, 6), BLANCO, 0, 1.25, 0.6); // carenado del ala
    rotuloAerolinea(g, 1.4, 5.2, -6.0, 0.72, 0.5);

    // Ala alta.
    pieza(new THREE.BoxGeometry(27, 0.3, 2.6), BLANCO, 0, 1.6, 0.5);
    for (const lado of [-1, 1]) pieza(new THREE.BoxGeometry(0.6, 0.32, 2.6), CORAL, lado * 13.2, 1.6, 0.5);

    // Motores con hélices de cuatro palas.
    const helices = [];
    for (const lado of [-1, 1]) {
      const x = lado * 4.1;
      tubo(0.62, 0.5, 5.4, BLANCO, x, 1.05, -0.4);
      tubo(0.45, 0.62, 0.9, CORAL, x, 1.05, -3.4);
      const cono = new THREE.ConeGeometry(0.35, 0.8, 8);
      cono.rotateX(-Math.PI / 2);
      pieza(cono, ORO, x, 1.05, -4.2);
      const helice = new THREE.Group();
      helice.position.set(x, 1.05, -4.0);
      const palas = [];
      for (let i = 0; i < 4; i++) {
        const pala = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.95, 0.06), mat(NEGRO));
        pala.geometry.translate(0, 1, 0);
        pala.rotation.z = (i * Math.PI) / 2;
        helice.add(pala);
        palas.push(pala);
      }
      const disco = new THREE.Mesh(
        new THREE.CircleGeometry(2.0, 24),
        new THREE.MeshBasicMaterial({ color: 0x20242e, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
      );
      helice.add(disco);
      g.add(helice);
      helices.push({ grupo: helice, palas, disco });
    }

    // Cola en T con los colores de la aerolínea.
    const deriva = pieza(new THREE.BoxGeometry(0.28, 4.6, 3.0), CORAL, 0, 3.6, 11.4);
    deriva.rotation.x = 0.42;
    pieza(new THREE.BoxGeometry(0.3, 0.6, 2.2), ORO, 0, 2.2, 11.3).rotation.x = 0.42;
    pieza(new THREE.BoxGeometry(7.6, 0.2, 1.5), BLANCO, 0, 5.75, 12.6);

    const articulada = (a, b, c, col, x, y, z) => {
      const eje = new THREE.Group();
      eje.position.set(x, y, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), mat(col));
      m.position.z = c / 2;
      eje.add(m);
      g.add(eje);
      return eje;
    };
    const alerones = [articulada(4.2, 0.12, 0.6, ORO, -10.3, 1.55, 1.8), articulada(4.2, 0.12, 0.6, ORO, 10.3, 1.55, 1.8)];
    const flaps = [articulada(5.6, 0.12, 0.65, GRIS, -5.2, 1.5, 1.8), articulada(5.6, 0.12, 0.65, GRIS, 5.2, 1.5, 1.8)];
    const elevador = articulada(7.6, 0.12, 0.6, ORO, 0, 5.75, 13.35);
    const timon = articulada(0.16, 3.6, 0.9, ORO, 0, 3.7, 12.9);
    timon.rotation.x = 0.42;

    // Tren de aterrizaje: patas principales en carenados laterales y rueda de morro.
    const rueda = (x, y, z, r) => {
      const geo = new THREE.CylinderGeometry(r, r, 0.3, 10);
      geo.rotateZ(Math.PI / 2);
      pieza(geo, NEGRO, x, y, z);
    };
    for (const lado of [-1, 1]) {
      pieza(new THREE.BoxGeometry(0.9, 0.9, 4.2), BLANCO, lado * 1.55, -1.0, 0.8);
      pieza(new THREE.BoxGeometry(0.14, 0.7, 0.14), GRIS, lado * 2.1, -1.4, 0.8);
      rueda(lado * 2.1, -1.66, 0.45, 0.45);
      rueda(lado * 2.1, -1.66, 1.15, 0.45);
    }
    pieza(new THREE.BoxGeometry(0.14, 0.8, 0.14), GRIS, 0, -1.25, -9.5);
    rueda(0, -1.72, -9.5, 0.34);

    g.userData = { alerones, elevador, timon, flaps, helices, luces: lucesNavegacion(g, 13.55, 1.6, 0.5, 5.9, 13.3, 1.55, 4.5) };
    return g;
  }

  // Cóndor 300: bimotor de fuselaje ancho con alas en flecha (60 m de envergadura, 59 m de largo).
  function crearJet() {
    const g = new THREE.Group();
    const BLANCO = 0xfafaf2, CORAL = 0xee6c4d, ORO = 0xf7c35f, OSCURO = 0x22344f, GRIS = 0xd9d9cf, NEGRO = 0x2b2b33, PANZA = 0xc9ccd4;
    const mat = matAvion;
    const pieza = (geo, c, x, y, z) => {
      const m = new THREE.Mesh(geo, mat(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const tubo = (r1, r2, largo, c, x, y, z, lados) => {
      const geo = new THREE.CylinderGeometry(r2, r1, largo, lados || 14);
      geo.rotateX(Math.PI / 2);
      return pieza(geo, c, x, y, z);
    };
    // Losa con cuatro esquinas superiores [x, y, z] (en orden) y un grosor: alas y estabilizadores en flecha.
    const losa = (esq, grosor, c) => {
      const v = [];
      const arriba = esq, abajo = esq.map(([x, y, z]) => [x, y - grosor, z]);
      const cara = (a, b, cc) => v.push(...a, ...b, ...cc);
      const quad = (a, b, cc, d) => { cara(a, b, cc); cara(a, cc, d); };
      quad(arriba[0], arriba[3], arriba[2], arriba[1]);
      quad(abajo[0], abajo[1], abajo[2], abajo[3]);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(arriba[i], arriba[j], abajo[j], abajo[i]); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, matAvion(c, true));
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Fuselaje.
    tubo(2.9, 2.9, 44, BLANCO, 0, 0, -2);
    tubo(0.6, 2.4, 3.6, BLANCO, 0, -0.3, -27.8);
    tubo(2.4, 2.9, 2.6, BLANCO, 0, -0.1, -24.9);
    const cola = tubo(2.9, 0.7, 10.5, BLANCO, 0, 0.9, 25);
    cola.rotation.x = -0.12;
    pieza(new THREE.BoxGeometry(3.6, 2.2, 30), PANZA, 0, -2.2, -3);
    pieza(new THREE.BoxGeometry(2.4, 0.6, 1.4), OSCURO, 0, 1.15, -26.6).rotation.x = -0.5;
    for (const lado of [-1, 1]) {
      pieza(new THREE.BoxGeometry(0.1, 0.5, 44), CORAL, lado * 2.86, -0.35, -2);
      pieza(new THREE.BoxGeometry(0.1, 0.16, 44), ORO, lado * 2.84, -0.75, -2);
      pieza(new THREE.BoxGeometry(0.12, 2.0, 1.1), GRIS, lado * 2.85, 0.2, -21);
    }
    // Ventanillas: una fila por lado.
    const ventanas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.45, 0.32), mat(OSCURO), 72);
    const o = new THREE.Object3D();
    let n = 0;
    for (const lado of [-1, 1]) for (let i = 0; i < 36; i++) {
      o.position.set(lado * 2.86, 0.75, -19 + i * 1.05);
      o.updateMatrix();
      ventanas.setMatrixAt(n++, o.matrix);
    }
    g.add(ventanas);
    rotuloAerolinea(g, 2.9, 15, -10, 1.75, 0.95);

    // Alas bajas en flecha con diedro.
    for (const lado of [-1, 1]) {
      losa([[lado * 2.5, -1.4, -7], [lado * 30, 1.4, 9.5], [lado * 30, 1.4, 12.3], [lado * 2.5, -1.4, 6]], 0.5, BLANCO);
      losa([[lado * 28.5, 1.25, 8.6], [lado * 30.2, 1.42, 9.6], [lado * 30.2, 1.42, 12.3], [lado * 28.5, 1.25, 11.6]], 0.52, CORAL);
      // Motor colgado bajo el ala.
      const x = lado * 10;
      tubo(1.85, 1.45, 7, BLANCO, x, -2.7, -5.5, 16);
      tubo(1.95, 1.85, 1.1, CORAL, x, -2.7, -9.2, 16);
      const frente = new THREE.Mesh(new THREE.CircleGeometry(1.7, 16), mat(NEGRO));
      frente.position.set(x, -2.7, -9.76); frente.rotation.y = Math.PI;
      g.add(frente);
      const cono = new THREE.ConeGeometry(0.5, 1.1, 10);
      cono.rotateX(-Math.PI / 2);
      pieza(cono, ORO, x, -2.7, -10.2);
      pieza(new THREE.BoxGeometry(0.5, 1.6, 5), GRIS, x, -1.2, -3.5);
    }

    // Estabilizador horizontal y deriva.
    for (const lado of [-1, 1]) losa([[lado * 1.2, 1.2, 22], [lado * 11.5, 2.3, 28.5], [lado * 11.5, 2.3, 30.2], [lado * 1.2, 1.2, 27]], 0.3, BLANCO);
    // La deriva es vertical: se dibuja como dos caras finas, una a cada lado.
    for (const lado of [-1, 1]) losa([[lado * 0.22, 2.6, 19.5], [lado * 0.22, 14.5, 27.5], [lado * 0.22, 14.5, 31], [lado * 0.22, 2.6, 29.5]], 0.01, CORAL);
    for (const lado of [-1, 1]) losa([[lado * 0.25, 6.5, 22.8], [lado * 0.25, 8.2, 24.0], [lado * 0.25, 8.2, 30.4], [lado * 0.25, 6.5, 29.9]], 0.01, ORO);

    const articulada = (a, b, c, col, x, y, z, flecha) => {
      const eje = new THREE.Group();
      eje.rotation.order = 'YXZ';
      eje.position.set(x, y, z);
      eje.rotation.y = flecha || 0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), mat(col));
      m.position.z = c / 2;
      eje.add(m);
      g.add(eje);
      return eje;
    };
    const flecha = Math.atan2(15.5, 27.5);
    const alerones = [articulada(7, 0.2, 1.2, ORO, -23, 0.55, 10.7, -flecha), articulada(7, 0.2, 1.2, ORO, 23, 0.55, 10.7, flecha)];
    const flaps = [articulada(11, 0.2, 1.6, GRIS, -9.5, -0.8, 7.2, -flecha * 0.6), articulada(11, 0.2, 1.6, GRIS, 9.5, -0.8, 7.2, flecha * 0.6)];
    const elevador = articulada(18, 0.18, 1.2, ORO, 0, 1.75, 28.8);
    const timon = articulada(0.3, 10, 1.6, ORO, 0, 8.6, 28.6);

    // Tren: rueda de morro y dos boggies de cuatro ruedas.
    const rueda = (x, y, z, r) => {
      const geo = new THREE.CylinderGeometry(r, r, 0.5, 12);
      geo.rotateZ(Math.PI / 2);
      pieza(geo, NEGRO, x, y, z);
    };
    for (const lado of [-1, 1]) {
      pieza(new THREE.BoxGeometry(0.4, 2.6, 0.4), GRIS, lado * 5.5, -3.0, 1.5);
      for (const dz of [-0.75, 0.75]) for (const dx of [-0.35, 0.35]) rueda(lado * 5.5 + dx * 2, -4.3, 1.5 + dz, 0.6);
    }
    pieza(new THREE.BoxGeometry(0.3, 2.4, 0.3), GRIS, 0, -3.0, -23);
    rueda(-0.3, -4.4, -23, 0.45); rueda(0.3, -4.4, -23, 0.45);

    g.userData = { alerones, elevador, timon, flaps, helices: [], luces: lucesNavegacion(g, 30.3, 1.45, 10.8, 14.6, 31, 2.95, -4) };
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

  // Mapa de normales de olas (sin costuras) para que el agua refleje el sol con brillo irregular.
  function texturaOlas() {
    const n = 256, c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d'), img = x.createImageData(n, n);
    const alto = (i, j) => ruidoPeriodico((i / n) * 8, (j / n) * 8, 8) * 0.6 + ruidoPeriodico((i / n) * 24, (j / n) * 24, 24) * 0.4;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dx = alto((i + 1) % n, j) - alto((i + n - 1) % n, j), dz = alto(i, (j + 1) % n) - alto(i, (j + n - 1) % n);
      const nx = -dx * 6, nz = -dz * 6, l = Math.hypot(nx, nz, 1);
      const k = (j * n + i) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(900, 900);
    return t;
  }

  function crear(escena) {
    escena.background = color(NIEBLA);
    // Niebla exponencial: la perspectiva aérea funde el paisaje lejano con la bruma del horizonte.
    escena.fog = new THREE.FogExp2(NIEBLA, 0.00007);
    escena.add(new THREE.HemisphereLight(0xc4dcf2, 0x5a5644, 1.25));
    const sol = new THREE.DirectionalLight(0xfff0da, 3.1);
    sol.castShadow = true;
    const movil = navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
    sol.shadow.mapSize.setScalar(movil ? 1024 : 2048); // en el celular, sombras algo más bastas pero más fluidas
    Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 800 });
    sol.shadow.bias = -0.0008;
    sol.shadow.normalBias = 0.05;
    escena.add(sol, sol.target);

    const cielo = crearCielo();
    const olas = texturaOlas();
    const matMar = new THREE.MeshPhongMaterial({ color: 0x1d5878, specular: 0xbfd4e6, shininess: 90, normalMap: olas, normalScale: new THREE.Vector2(0.55, 0.55) });
    const matSuelo = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), matMar);
    agua.rotation.x = -Math.PI / 2;
    agua.receiveShadow = true;
    const nubes = crearNubes();
    escena.add(cielo, agua, nubes);

    // Todo lo que depende del lugar (terreno, árboles, ciudad, aeropuertos) se rehace al cambiar de escenario.
    let escenario = null, aeropuertos = [];
    function liberar(objeto) {
      objeto.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map && o.material.map !== detalle) o.material.map.dispose(); o.material.dispose(); }
      });
    }
    function reconstruir() {
      if (escenario) { escena.remove(escenario); liberar(escenario); }
      escenario = new THREE.Group();
      escenario.add(crearTerreno(), crearArboles(), crearCiudad());
      const texturas = {};
      aeropuertos = T.AEROPUERTOS.map((ap) => {
        const largo = ap.mitadLargo * 2;
        const a = crearAeropuerto(ap, texturas[largo] || (texturas[largo] = texturaPista(largo)));
        escenario.add(a.grupo);
        return { ap, ...a };
      });
      escena.add(escenario);
      // Sin mar, el "agua" hace de suelo lejano para que no se vea el borde del mapa.
      const d = T.destino;
      if (d && !d.mar) { agua.position.y = d.elev - 60; agua.material = matSuelo; matSuelo.color.copy(coloresBioma(d.bioma).capas[1]); }
      else { agua.position.y = 0; agua.material = matMar; }
      // Las nubes flotan siempre a la misma altura sobre el aeropuerto (también en Bogotá o Calama).
      nubes.position.y = d ? T.AEROPUERTOS[0].y : 0;
    }
    reconstruir();

    const modelos = { regional: crearRegional(), avioneta: crearAvioneta(), jet: crearJet() };
    const aro = crearAro();
    escena.add(modelos.regional, modelos.avioneta, modelos.jet, aro);

    const ROJO = new THREE.Color(0xff3030), BLANCO = new THREE.Color(0xffffff);
    const LIMITES = [3.5, 3.17, 2.83, 2.5];

    function actualizar(e, mando, camara, viento) {
      cielo.position.copy(camara.position);
      const AV = window.Fisica.AVIONES;
      const clave = e.modelo === AV.avioneta ? 'avioneta' : e.modelo === AV.jet ? 'jet' : 'regional';
      for (const k in modelos) modelos[k].visible = k === clave;
      const avion = modelos[clave];
      avion.position.set(e.p[0], e.p[1], e.p[2]);
      avion.quaternion.set(e.q[0], e.q[1], e.q[2], e.q[3]);
      const u = avion.userData;
      for (const h of u.helices) {
        h.grupo.rotation.z += e.motor * 1.4;
        for (const pala of h.palas) pala.visible = e.motor < 0.3;
        h.disco.visible = e.motor >= 0.3;
      }
      u.alerones[0].rotation.x = mando.alabeo * 0.35;
      u.alerones[1].rotation.x = -mando.alabeo * 0.35;
      u.elevador.rotation.x = -Math.max(-1, Math.min(1, mando.cabeceo + mando.trim)) * 0.4;
      u.timon.rotation.y = -mando.timon * 0.4;
      u.flaps[0].rotation.x = u.flaps[1].rotation.x = e.flaps * 0.6;

      sol.position.set(e.p[0] + SOL.x * 400, e.p[1] + SOL.y * 400, e.p[2] + SOL.z * 400);
      const ahora = performance.now();
      olas.offset.set((ahora * 0.000004) % 1, (ahora * 0.0000025) % 1);
      const destello = ahora % 1300 < 60, baliza = ahora % 1000 < 110;
      for (const l of u.luces.destellos) l.visible = destello;
      u.luces.baliza.visible = baliza;
      sol.target.position.set(e.p[0], e.p[1], e.p[2]);

      for (const a of aeropuertos) {
        const dist = e.p[2] - (a.ap.z + a.ap.mitadLargo - 300);
        const angulo = dist > 0 ? (Math.atan2(e.p[1] - a.ap.y, dist) * 180) / Math.PI : 0;
        const distancia = Math.hypot(e.p[0] - a.ap.x, e.p[2] - (a.ap.z + a.ap.mitadLargo - 300));
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

    return { actualizar, colocarAro, modelos, reconstruir };
  }

  window.Mundo = { crear };
})();
