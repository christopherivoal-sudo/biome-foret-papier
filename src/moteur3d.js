// Biome, la forêt de papier : moteur WebGL (sprint 8a), avec Three.js (r160, inclus dans le fichier du jeu).
// Il remplace le moteur Canvas 2D (engine.js) pour dessiner l'île, avec la même façon de travailler :
// à chaque image, rendu.js appelle begin(), add(maillage, x, y, z, ...), groundPoly(...), puis flush().
// - Les maillages origami (engine.js : Builder) sont convertis une fois en géométries ; chaque appel à add()
//   devient une instance (une seule commande de dessin par modèle, même avec 1 500 touffes d'herbe).
// - Lumière : soleil (avec ombres portées) et lumière d'ambiance, réglées pour retrouver les couleurs du
//   moteur Canvas 2D (0,58 à l'ombre, 1,10 en plein soleil ; faces « douces » jamais grises).
// - Décalques au sol (carte des habitats, survol, anneaux, paille...) : polygones colorés posés sur le sol.
// - Deux calques 2D restent autour : le ciel derrière, et devant les étoiles des spécimens rares,
//   les « z » du hérisson, l'éclair et la brume de chaleur.
// La caméra reste celle d'engine.js (project, groundAt) : clics, bulles et repères ne changent pas.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./engine.js'));
  else racine.BiomeMoteur3D = fabrique(racine.BiomeEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function disponible() {
    try {
      if (typeof document === 'undefined' || !self.THREE) return false;
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  // Lumière d'engine.js : direction du soleil, ambiance et soleil.
  const AMBIANCE = 0.58, SOLEIL = 0.52, PART_OMBRE = 0.68;
  const L0 = (function () { const x = -0.45, y = 0.85, z = 0.35, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();

  // Couleur CSS ('#rrggbb', 'rgb(...)', 'rgba(...)') → [r, g, b, a] de 0 à 1. Mise en cache.
  const COULEURS = new Map();
  function couleurCSS(s) {
    let c = COULEURS.get(s);
    if (c) return c;
    if (s[0] === '#') { const n = parseInt(s.slice(1), 16); c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; }
    else { const m = s.match(/[\d.]+/g).map(Number); c = [m[0] / 255, m[1] / 255, m[2] / 255, m.length > 3 ? m[3] : 1]; }
    if (COULEURS.size > 4000) COULEURS.clear();
    COULEURS.set(s, c);
    return c;
  }

  // Calque 2D posé sous ou sur le canvas WebGL, de même taille, qui ne capte pas les clics.
  function calque(canvas, devant) {
    const c = canvas.ownerDocument.createElement('canvas');
    c.className = devant ? 'calque-devant' : 'calque-fond';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    canvas.parentNode.insertBefore(c, devant ? canvas.nextSibling : canvas);
    return c;
  }

  function Renderer3D(canvas, opts) {
    opts = opts || {};
    const T = self.THREE;
    this.T = T;
    T.ColorManagement.enabled = false; // les couleurs des fiches sont prises telles quelles, comme en Canvas 2D
    const gl = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    gl.outputColorSpace = T.LinearSRGBColorSpace;
    gl.setClearColor(0x000000, 0);
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = T.PCFSoftShadowMap;
    this.gl = gl;
    this.canvas = canvas;
    this.nom = 'WebGL';
    this.webgl = true;
    this.ombresReelles = true;
    this.cam = new E.Camera();
    this.teinte = null;
    this.aretes = false;
    this.fond = calque(canvas, false);
    this.dessus = calque(canvas, true);
    this.fondCtx = this.fond.getContext('2d');
    this.dessusCtx = this.dessus.getContext('2d');
    this.ctx = this.dessusCtx;

    const scene = this.scene = new T.Scene();
    const camera = this.camera = new T.PerspectiveCamera(40, 1, 0.1, 300);
    camera.matrixAutoUpdate = true;
    // Lumière d'ambiance : un peu chaude vers le haut, un peu bleutée vers le bas (effet papier d'engine.js).
    this.ciel = new T.HemisphereLight(0xffffff, 0xffffff, Math.PI);
    scene.add(this.ciel);
    const soleil = this.soleil = new T.DirectionalLight(0xffffff, Math.PI);
    soleil.castShadow = true;
    const fort = !opts.mobile;
    soleil.shadow.mapSize.set(fort ? 2048 : 1024, fort ? 2048 : 1024);
    soleil.shadow.bias = -0.0004;
    soleil.shadow.normalBias = 0.025;
    soleil.shadow.radius = 2;
    // Une part du soleil ne projette pas d'ombre : les ombres restent douces, comme sur une maquette en papier.
    const reflet = this.reflet = new T.DirectionalLight(0xffffff, Math.PI);
    reflet.target = soleil.target;
    scene.add(soleil, reflet, soleil.target);
    this.directionSoleil = L0.slice();
    this.rayonOmbres = 12;

    // Matériaux : faces éclairées, faces « douces » (brins, feuilles, tranche de l'île), faces non éclairées (lumières, gouttes).
    const motifs = typeof document !== 'undefined' ? E.creerMotifs(document) : null;
    const textures = {};
    if (motifs) for (const id in motifs) {
      // Le motif est posé sur un papier blanc : multiplié par la couleur de la face, il garde la couleur de l'espèce.
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.drawImage(motifs[id], 0, 0);
      const t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
      textures[id] = t;
    }
    const douce = m => {
      m.onBeforeCompile = sh => {
        // Comme engine.js : k = 0,84 + 0,26 × éclairement, au lieu de 0,58 + 0,52 × éclairement.
        sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>',
          '#include <lights_fragment_end>\n\treflectedLight.directDiffuse *= 0.5;\n\treflectedLight.indirectDiffuse *= 1.45;');
      };
      m.customProgramCacheKey = () => 'douce';
      return m;
    };
    const fabriquer = (papier, alpha) => {
      const base = { vertexColors: true, side: T.DoubleSide };
      if (papier) base.map = textures[papier];
      if (alpha) { base.transparent = true; base.depthWrite = false; }
      const ms = [new T.MeshLambertMaterial(base), douce(new T.MeshLambertMaterial(base)), new T.MeshBasicMaterial(Object.assign({}, base, { map: null }))];
      return ms;
    };
    this.materiaux = {};
    this._mat = (papier, alpha) => {
      const cle = (papier || '') + '|' + (alpha || 0);
      let m = this.materiaux[cle];
      if (!m) { m = this.materiaux[cle] = fabriquer(papier, alpha); if (alpha) for (const x of m) x.opacity = alpha; }
      return m;
    };

    this.geos = new WeakMap();
    this.ids = new WeakMap();
    this.nbIds = 0;
    this.lots = new Map();
    this.textures = textures;

    // Décalques au sol.
    this.dec = { pos: new Float32Array(3 * 3 * 4000), col: new Float32Array(4 * 3 * 4000), n: 0 };
    const dg = new T.BufferGeometry();
    dg.setAttribute('position', new T.BufferAttribute(this.dec.pos, 3).setUsage(T.DynamicDrawUsage));
    dg.setAttribute('color', new T.BufferAttribute(this.dec.col, 4).setUsage(T.DynamicDrawUsage));
    this.decMesh = new T.Mesh(dg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
    this.decMesh.frustumCulled = false;
    this.decMesh.renderOrder = 2;
    scene.add(this.decMesh);

    this.sol = null;
    this.sansOmbre = false;
    this.np = 0;
    this.taille = [0, 0, 0];
  }

  // ---------- Géométries (une fois par maillage et par papier) ----------
  Renderer3D.prototype._geo = function (mesh, papier) {
    let g = this.geos.get(mesh);
    if (!g) { g = {}; this.geos.set(mesh, g); }
    const cle = papier || '_';
    if (g[cle]) return g[cle];
    const T = this.T, V = mesh.v;
    // Trois groupes : éclairé, doux, non éclairé.
    const gr = [[], [], []];
    const ech = papier ? 128 / E.PAPIERS[papier].echelle : 1;
    for (const f of mesh.f) {
      const ids = f.i, a = V[ids[0]], b = V[ids[1]], c = V[ids[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      let col = f.c;
      if (papier && !f.ne) col = E.couleurPapier(col, papier);
      const r = col[0] / 255, gg = col[1] / 255, bb = col[2] / 255;
      // Repère de la face pour le motif du papier : première arête et sa perpendiculaire dans le plan.
      const ul = Math.hypot(ux, uy, uz) || 1, e1 = [ux / ul, uy / ul, uz / ul];
      const e2 = [ny * e1[2] - nz * e1[1], nz * e1[0] - nx * e1[2], nx * e1[1] - ny * e1[0]];
      const l = gr[f.ne ? 2 : f.doux ? 1 : 0];
      for (let k = 1; k < ids.length - 1; k++) {
        for (const id of [ids[0], ids[k], ids[k + 1]]) {
          const p = V[id];
          const dx = p[0] - a[0], dy = p[1] - a[1], dz = p[2] - a[2];
          l.push(p[0], p[1], p[2], nx, ny, nz, r, gg, bb, (dx * e1[0] + dy * e1[1] + dz * e1[2]) / ech, (dx * e2[0] + dy * e2[1] + dz * e2[2]) / ech);
        }
      }
    }
    const n = (gr[0].length + gr[1].length + gr[2].length) / 11;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const geo = new T.BufferGeometry();
    let o = 0;
    for (let q = 0; q < 3; q++) {
      const l = gr[q], m = l.length / 11;
      for (let k = 0; k < m; k++) {
        const s = k * 11, d = o + k;
        pos[d * 3] = l[s]; pos[d * 3 + 1] = l[s + 1]; pos[d * 3 + 2] = l[s + 2];
        nor[d * 3] = l[s + 3]; nor[d * 3 + 1] = l[s + 4]; nor[d * 3 + 2] = l[s + 5];
        col[d * 3] = l[s + 6]; col[d * 3 + 1] = l[s + 7]; col[d * 3 + 2] = l[s + 8];
        uv[d * 2] = l[s + 9]; uv[d * 2 + 1] = l[s + 10];
      }
      if (m) geo.addGroup(o, m, q);
      o += m;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    if (papier) geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    g[cle] = geo;
    return geo;
  };

  // ---------- Instances ----------
  Renderer3D.prototype.begin = function () {
    for (const l of this.lots.values()) l.n = 0;
    this.dec.n = 0;
    this.np = 0;
  };
  Renderer3D.prototype._lot = function (mesh, papier, alpha, ombre) {
    let id = this.ids.get(mesh);
    if (id === undefined) { id = this.nbIds++; this.ids.set(mesh, id); }
    const cle = id + '|' + papier + '|' + alpha + '|' + (ombre ? 1 : 0);
    let l = this.lots.get(cle);
    if (!l) { l = { cle, mesh, papier, alpha, ombre, im: null, cap: 0, n: 0 }; this.lots.set(cle, l); }
    if (l.n >= l.cap) this._agrandir(l);
    return l;
  };
  Renderer3D.prototype._agrandir = function (l) {
    const T = this.T, cap = Math.max(8, l.cap * 2);
    const im = new T.InstancedMesh(this._geo(l.mesh, l.papier), this._mat(l.papier, l.alpha), cap);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    im.instanceColor.setUsage(T.DynamicDrawUsage);
    if (l.im) {
      im.instanceMatrix.array.set(l.im.instanceMatrix.array);
      im.instanceColor.array.set(l.im.instanceColor.array);
      this.scene.remove(l.im);
      l.im.dispose();
    }
    im.frustumCulled = false;
    im.castShadow = l.ombre;
    im.receiveShadow = true;
    if (l.alpha) im.renderOrder = 3;
    this.scene.add(im);
    l.im = im; l.cap = cap;
  };
  // Même signature qu'engine.js. o : { alpha, tilt, roll, papier, ombre (false : ne projette pas d'ombre), couleur ([r,g,b] 0-255, multiplie) }
  Renderer3D.prototype.add = function (mesh, x, y, z, ry, s, sy, o) {
    o = o || {};
    const papier = o.papier && this.textures[o.papier] ? o.papier : '';
    const alpha = o.alpha !== undefined && o.alpha < 0.99 ? Math.max(0.1, Math.round(o.alpha * 10) / 10) : 0;
    const l = this._lot(mesh, papier, alpha, o.ombre !== false && !alpha && !this.sansOmbre);
    const sY = sy || s, tilt = o.tilt || 0, roll = o.roll || 0;
    // M = Translation · Ry · Rz(roulis) · Rx(bascule) · Échelle, comme engine.js.
    const cy = Math.cos(ry || 0), sn = Math.sin(ry || 0), ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
    // Rz · Rx
    const a00 = cr, a01 = -sr * ct, a02 = sr * st;
    const a10 = sr, a11 = cr * ct, a12 = -cr * st;
    const a20 = 0, a21 = st, a22 = ct;
    // Ry · (Rz · Rx)
    const m00 = cy * a00 + sn * a20, m01 = cy * a01 + sn * a21, m02 = cy * a02 + sn * a22;
    const m10 = a10, m11 = a11, m12 = a12;
    const m20 = -sn * a00 + cy * a20, m21 = -sn * a01 + cy * a21, m22 = -sn * a02 + cy * a22;
    const e = l.im.instanceMatrix.array, b = l.n * 16;
    e[b] = m00 * s; e[b + 1] = m10 * s; e[b + 2] = m20 * s; e[b + 3] = 0;
    e[b + 4] = m01 * sY; e[b + 5] = m11 * sY; e[b + 6] = m21 * sY; e[b + 7] = 0;
    e[b + 8] = m02 * s; e[b + 9] = m12 * s; e[b + 10] = m22 * s; e[b + 11] = 0;
    e[b + 12] = x; e[b + 13] = y; e[b + 14] = z; e[b + 15] = 1;
    const c = l.im.instanceColor.array, q = l.n * 3, k = o.couleur;
    if (k) { c[q] = k[0] / 255; c[q + 1] = k[1] / 255; c[q + 2] = k[2] / 255; } else { c[q] = c[q + 1] = c[q + 2] = 1; }
    l.n++;
    this.np++;
  };

  // ---------- Décalques au sol ----------
  Renderer3D.prototype._decTri = function (ax, ay, az, bx, by, bz, cx, cy, cz, c) {
    const D = this.dec;
    if (D.n >= D.pos.length / 9) return;
    const p = D.pos, q = D.col, i = D.n * 9, j = D.n * 12;
    p[i] = ax; p[i + 1] = ay; p[i + 2] = az; p[i + 3] = bx; p[i + 4] = by; p[i + 5] = bz; p[i + 6] = cx; p[i + 7] = cy; p[i + 8] = cz;
    for (let k = 0; k < 3; k++) { q[j + k * 4] = c[0]; q[j + k * 4 + 1] = c[1]; q[j + k * 4 + 2] = c[2]; q[j + k * 4 + 3] = c[3]; }
    D.n++;
  };
  // pts : [x0, z0, x1, z1, ...] ; fill et stroke : couleurs CSS ; lw : épaisseur du trait en pixels ; y : hauteur.
  Renderer3D.prototype.groundPoly = function (pts, fill, stroke, lw, y) {
    // Un peu au-dessus du sol plié (ses sommets montent jusqu'à 0,025).
    const h = (y === undefined ? 0.02 : y) + 0.03, n = pts.length / 2;
    if (fill) {
      const c = couleurCSS(fill);
      for (let k = 1; k < n - 1; k++) this._decTri(pts[0], h, pts[1], pts[k * 2], h, pts[k * 2 + 1], pts[k * 2 + 2], h, pts[k * 2 + 3], c);
    }
    if (stroke) {
      const c = couleurCSS(stroke), cam = this.cam, t = this.taille;
      for (let k = 0; k < n; k++) {
        const x0 = pts[k * 2], z0 = pts[k * 2 + 1], m = (k + 1) % n, x1 = pts[m * 2], z1 = pts[m * 2 + 1];
        cam.project((x0 + x1) / 2, h, (z0 + z1) / 2, t);
        // Épaisseur en pixels convertie en unités du monde à cette distance.
        const w = (lw || 2) * t[2] / cam.focal / 2;
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, ex = -dz / L * w, ez = dx / L * w;
        const ax = dx / L * w, az = dz / L * w; // petit prolongement : les coins se rejoignent
        this._decTri(x0 - ax + ex, h, z0 - az + ez, x1 + ax + ex, h, z1 + az + ez, x1 + ax - ex, h, z1 + az - ez, c);
        this._decTri(x0 - ax + ex, h, z0 - az + ez, x1 + ax - ex, h, z1 + az - ez, x0 - ax - ex, h, z0 - az - ez, c);
      }
    }
  };
  Renderer3D.prototype.ellipse = function (x, z, rx, rz, fill, stroke, lw, n, y) {
    n = n || 14;
    const pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; pts.push(x + Math.cos(a) * rx, z + Math.sin(a) * rz); }
    this.groundPoly(pts, fill, stroke, lw, y);
  };

  // ---------- Sol plié ----------
  // V : sommets [x, y, z] ; tris : [{ v: [a, b, c], n: [nx, ny, nz] }]. Reconstruit quand l'île change de forme.
  Renderer3D.prototype.definirSol = function (V, tris) {
    const T = this.T;
    if (this.sol) { this.scene.remove(this.sol); this.sol.geometry.dispose(); }
    const n = tris.length * 3, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    tris.forEach((t, k) => {
      for (let m = 0; m < 3; m++) {
        const p = V[t.v[m]], d = (k * 3 + m) * 3;
        pos[d] = p[0]; pos[d + 1] = p[1]; pos[d + 2] = p[2];
        nor[d] = t.n[0]; nor[d + 1] = t.n[1]; nor[d + 2] = t.n[2];
      }
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3).setUsage(T.DynamicDrawUsage));
    g.computeBoundingSphere();
    this.sol = new T.Mesh(g, this._mat('', 0)[0]);
    this.sol.receiveShadow = true;
    this.scene.add(this.sol);
  };
  // couleur(k) : [r, g, b] (0-255) du triangle k.
  Renderer3D.prototype.colorerSol = function (couleur) {
    if (!this.sol) return;
    const a = this.sol.geometry.attributes.color, c = a.array, n = c.length / 9;
    for (let k = 0; k < n; k++) {
      const v = couleur(k), r = v[0] / 255, g = v[1] / 255, b = v[2] / 255, d = k * 9;
      c[d] = c[d + 3] = c[d + 6] = r; c[d + 1] = c[d + 4] = c[d + 7] = g; c[d + 2] = c[d + 5] = c[d + 8] = b;
    }
    a.needsUpdate = true;
  };

  // ---------- Soleil ----------
  // t : moment de la journée (0 à 1, la nuit commence vers 0,7). Le soleil traverse le ciel d'est en ouest ;
  // la nuit, la lune revient lentement à son point de départ.
  Renderer3D.prototype.reglerSoleil = function (t, rayon) {
    // Continu sur la journée : de -0,75 (matin) à +0,75 (soir), puis retour pendant la nuit.
    let az = 0;
    if (t !== undefined) az = t < 0.72 ? (t / 0.72 - 0.5) * 1.5 : 0.75 - (t - 0.72) / 0.28 * 1.5;
    const c = Math.cos(az), s = Math.sin(az);
    this.directionSoleil = [L0[0] * c + L0[2] * s, L0[1], -L0[0] * s + L0[2] * c];
    if (rayon) this.rayonOmbres = rayon;
  };

  // ---------- Image ----------
  Renderer3D.prototype.redimensionner = function (w, h, dpr) {
    const t = this.taille;
    if (t[0] === w && t[1] === h && t[2] === dpr) return;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    for (const c of [this.fond, this.dessus]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.taille = [w, h, dpr];
  };
  Renderer3D.prototype.preparerCalques = function () {
    const dpr = this.taille[2] || 1;
    for (const g of [this.fondCtx, this.dessusCtx]) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dessusCtx.clearRect(0, 0, this.taille[0], this.taille[1]);
  };
  Renderer3D.prototype._synchroniserCamera = function () {
    const cam = this.cam, camera = this.camera, w = cam.w, h = cam.h;
    camera.position.set(cam.px, cam.py, cam.pz);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.updateMatrixWorld(true);
    // Projection d'engine.js (focale et centre décalé) : un point projeté par cam.project tombe au même pixel.
    const near = 0.1, far = 300, f = cam.focal;
    camera.projectionMatrix.set(
      2 * f / w, 0, 1 - 2 * cam.cx / w, 0,
      0, 2 * f / h, 2 * cam.cy / h - 1, 0,
      0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
      0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  };
  Renderer3D.prototype.flush = function () {
    const T = this.T;
    for (const l of this.lots.values()) {
      if (!l.im) continue;
      l.im.count = l.n;
      l.im.visible = l.n > 0;
      if (l.n) { l.im.instanceMatrix.needsUpdate = true; l.im.instanceColor.needsUpdate = true; }
    }
    const D = this.dec, dg = this.decMesh.geometry;
    dg.setDrawRange(0, D.n * 3);
    dg.attributes.position.needsUpdate = true;
    dg.attributes.color.needsUpdate = true;
    // Lumières teintées par l'ambiance (nuit bleutée, orage gris...).
    const te = this.teinte || [1, 1, 1];
    const k = Math.PI; // Three.js (r155+) divise l'éclairement diffus par π
    this.ciel.color.setRGB(te[0] * AMBIANCE * 1.02 * k, te[1] * AMBIANCE * 1.0 * k, te[2] * AMBIANCE * 0.97 * k);
    this.ciel.groundColor.setRGB(te[0] * AMBIANCE * 0.95 * k, te[1] * AMBIANCE * 0.98 * k, te[2] * AMBIANCE * 1.06 * k);
    this.ciel.intensity = 1;
    const so = SOLEIL * PART_OMBRE * k, re = SOLEIL * (1 - PART_OMBRE) * k;
    this.soleil.color.setRGB(te[0] * so * 1.04, te[1] * so * 1.01, te[2] * so * 0.96);
    this.reflet.color.setRGB(te[0] * re * 1.04, te[1] * re * 1.01, te[2] * re * 0.96);
    this.soleil.intensity = this.reflet.intensity = 1;
    const d = this.directionSoleil, R = this.rayonOmbres, cam = this.cam;
    this.soleil.target.position.set(0, 0, 0);
    this.soleil.position.set(d[0] * 40, d[1] * 40, d[2] * 40);
    this.reflet.position.copy(this.soleil.position);
    const sc = this.soleil.shadow.camera;
    if (sc.right !== R) { sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 5; sc.far = 80; sc.updateProjectionMatrix(); }
    this.soleil.target.updateMatrixWorld();
    this._synchroniserCamera();
    this.gl.render(this.scene, this.camera);
    void T; void cam;
    return this.np;
  };
  Renderer3D.prototype.triangles = function () { return this.gl.info.render.triangles; };

  return { disponible, Renderer3D, couleurCSS };
});
