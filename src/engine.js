// Biome, la forêt de papier : mini moteur 3D « papier plié » (Canvas 2D, facettes à plat).
// Repris du prototype v1 (Paper3D), avec au sprint 4 :
// - les papiers rares (journal, washi) : motif collé à chaque face, qui suit la face quand le modèle bouge ;
// - une teinte d'ambiance (jour, crépuscule, nuit, orage) appliquée à toutes les couleurs ;
// - des faces sans éclairage (lumières, gouttes, flocons) et un tri par profondeur réutilisable.
// Aucune dépendance. Les maillages se construisent aussi sous Node (tests), le rendu demande un canvas.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.BiomeEngine = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hex(c) {
    if (Array.isArray(c)) return c;
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Liste de couleurs (une par face) ou couleur unique ('#rrggbb' ou [r, g, b]).
  function liste(color) { return Array.isArray(color) && (typeof color[0] === 'string' || Array.isArray(color[0])) ? color : null; }
  function melange(a, b, t) { a = hex(a); b = hex(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // ---------- Construction de maillages ----------
  // Une face : { i: indices, c: [r,g,b], ds: double face, ne: non éclairée }
  function Builder() { this.v = []; this.f = []; }
  Builder.prototype.vert = function (x, y, z) { this.v.push([x, y, z]); return this.v.length - 1; };
  Builder.prototype.face = function (ids, color, ds, ne) { this.f.push({ i: ids, c: hex(color), ds: !!ds, ne: !!ne }); };
  Builder.prototype.tri = function (a, b, c, color, ds) {
    const i = this.vert(a[0], a[1], a[2]), j = this.vert(b[0], b[1], b[2]), k = this.vert(c[0], c[1], c[2]);
    this.face([i, j, k], color, ds);
  };
  Builder.prototype.quad = function (a, b, c, d, color, ds) {
    const i = this.vert(a[0], a[1], a[2]), j = this.vert(b[0], b[1], b[2]), k = this.vert(c[0], c[1], c[2]), l = this.vert(d[0], d[1], d[2]);
    this.face([i, j, k, l], color, ds);
  };
  // Prisme (tronc, bûche) : n côtés, rayons r0 (bas) et r1 (haut).
  Builder.prototype.prism = function (cx, cz, n, r0, r1, y0, y1, color, rot, base) {
    rot = rot || 0;
    const lo = [], hi = [], cols = liste(color);
    for (let k = 0; k < n; k++) {
      const a = rot + k / n * Math.PI * 2;
      lo.push(this.vert(cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0));
      hi.push(this.vert(cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1));
    }
    for (let q = 0; q < n; q++) {
      const p = (q + 1) % n;
      this.face([lo[q], hi[q], hi[p], lo[p]], cols ? cols[q % cols.length] : color);
    }
    this.face(hi.slice(), cols ? cols[0] : color);
    if (base) this.face(lo.slice().reverse(), base);
  };
  // Prisme couché le long d'un segment (bûche, branche, corps de ver).
  Builder.prototype.baton = function (a, b, n, r, color, capColor) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
    const d = [dx / L, dy / L, dz / L];
    // Deux vecteurs perpendiculaires.
    let u = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let p = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const pl = Math.hypot(p[0], p[1], p[2]); p = [p[0] / pl, p[1] / pl, p[2] / pl];
    const q = [d[1] * p[2] - d[2] * p[1], d[2] * p[0] - d[0] * p[2], d[0] * p[1] - d[1] * p[0]];
    const A = [], B = [];
    for (let k = 0; k < n; k++) {
      const ang = k / n * Math.PI * 2 + 0.3, c = Math.cos(ang) * r, s = Math.sin(ang) * r;
      const o = [p[0] * c + q[0] * s, p[1] * c + q[1] * s, p[2] * c + q[2] * s];
      A.push(this.vert(a[0] + o[0], a[1] + o[1], a[2] + o[2]));
      B.push(this.vert(b[0] + o[0], b[1] + o[1], b[2] + o[2]));
    }
    const cols = liste(color);
    for (let k = 0; k < n; k++) { const m = (k + 1) % n; this.face([A[k], A[m], B[m], B[k]], cols ? cols[k % cols.length] : color); }
    if (capColor) { this.face(A.slice().reverse(), capColor); this.face(B.slice(), capColor); }
  };
  // Pyramide : base à n côtés en y0, sommet en y1.
  Builder.prototype.pyramid = function (cx, cz, n, r, y0, y1, color, rot, bottom) {
    rot = rot || 0;
    const base = [];
    for (let k = 0; k < n; k++) {
      const a = rot + k / n * Math.PI * 2;
      base.push(this.vert(cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r));
    }
    const top = this.vert(cx, y1, cz);
    const cols = liste(color);
    for (let q = 0; q < n; q++) {
      const p = (q + 1) % n;
      this.face([base[q], top, base[p]], cols ? cols[q % cols.length] : color);
    }
    if (bottom) this.face(base.slice().reverse(), bottom);
  };
  // Pointe orientée (piquant, bec, épine) : base triangulaire autour de a, sommet en b.
  Builder.prototype.pointe = function (a, b, r, color) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    let u = Math.abs(dy) < 0.9 * Math.hypot(dx, dy, dz) ? [0, 1, 0] : [1, 0, 0];
    let p = [dy * u[2] - dz * u[1], dz * u[0] - dx * u[2], dx * u[1] - dy * u[0]];
    const pl = Math.hypot(p[0], p[1], p[2]) || 1; p = [p[0] / pl, p[1] / pl, p[2] / pl];
    const L = Math.hypot(dx, dy, dz) || 1, d = [dx / L, dy / L, dz / L];
    const q = [d[1] * p[2] - d[2] * p[1], d[2] * p[0] - d[0] * p[2], d[0] * p[1] - d[1] * p[0]];
    const ids = [];
    for (let k = 0; k < 3; k++) {
      const ang = k / 3 * Math.PI * 2, c = Math.cos(ang) * r, s = Math.sin(ang) * r;
      ids.push(this.vert(a[0] + p[0] * c + q[0] * s, a[1] + p[1] * c + q[1] * s, a[2] + p[2] * c + q[2] * s));
    }
    const t = this.vert(b[0], b[1], b[2]);
    for (let k = 0; k < 3; k++) this.face([ids[k], ids[(k + 1) % 3], t], color);
  };
  // Octaèdre étiré (corps d'animal) : dessus et dessous de couleurs différentes.
  Builder.prototype.octa = function (cx, cy, cz, rx, ry, rz, color, colB, colAv) {
    const px = this.vert(cx + rx, cy, cz), nx = this.vert(cx - rx, cy, cz);
    const py = this.vert(cx, cy + ry, cz), ny = this.vert(cx, cy - ry, cz);
    const pz = this.vert(cx, cy, cz + rz), nz = this.vert(cx, cy, cz - rz);
    const b = colB || color, av = colAv || color;
    this.face([py, pz, px], av); this.face([py, px, nz], color);
    this.face([py, nz, nx], color); this.face([py, nx, pz], av);
    this.face([ny, px, pz], b); this.face([ny, nz, px], b);
    this.face([ny, nx, nz], b); this.face([ny, pz, nx], b);
  };
  // Boule à facettes (feuillage, buisson).
  Builder.prototype.blob = function (cx, cy, cz, r, sy, color, seed, seg) {
    const rings = 3; seg = seg || 6;
    const ids = [];
    const top = this.vert(cx, cy + r * sy, cz), bot = this.vert(cx, cy - r * sy * 0.7, cz);
    let h = seed || 1;
    function rnd() { h = (h * 9301 + 49297) % 233280; return h / 233280; }
    for (let i = 1; i <= rings; i++) {
      const phi = i / (rings + 1) * Math.PI, row = [];
      for (let j = 0; j < seg; j++) {
        const th = j / seg * Math.PI * 2 + (i % 2) * Math.PI / seg;
        const rr = r * (0.88 + rnd() * 0.24);
        row.push(this.vert(cx + Math.sin(phi) * Math.cos(th) * rr, cy + Math.cos(phi) * r * sy * (i === rings ? 0.75 : 1), cz + Math.sin(phi) * Math.sin(th) * rr));
      }
      ids.push(row);
    }
    const cols = liste(color) || [color];
    let ci = 0;
    const C = () => cols[(ci++) % cols.length];
    for (let j2 = 0; j2 < seg; j2++) {
      const n2 = (j2 + 1) % seg;
      this.face([top, ids[0][n2], ids[0][j2]], C());
      for (let i2 = 0; i2 < rings - 1; i2++) {
        const a = ids[i2][j2], b = ids[i2][n2], c = ids[i2 + 1][j2], d = ids[i2 + 1][n2];
        if (i2 % 2 === 0) { this.face([a, b, d], C()); this.face([a, d, c], C()); }
        else { this.face([a, b, c], C()); this.face([b, d, c], C()); }
      }
      this.face([bot, ids[rings - 1][j2], ids[rings - 1][n2]], C());
    }
  };
  // Ajoute un autre maillage, déplacé, tourné autour de y et mis à l'échelle.
  Builder.prototype.inclure = function (m, x, y, z, ry, s) {
    const c = Math.cos(ry || 0), sn = Math.sin(ry || 0), k = s || 1, base = this.v.length;
    for (const v of m.v) this.v.push([x + (v[0] * c + v[2] * sn) * k, y + v[1] * k, z + (-v[0] * sn + v[2] * c) * k]);
    for (const f of m.f) this.f.push({ i: f.i.map(i => i + base), c: f.c, ds: f.ds, ne: f.ne });
  };
  Builder.prototype.build = function () { return { v: this.v, f: this.f }; };

  // ---------- Caméra ----------
  function Camera() {
    this.yaw = 0.6; this.pitch = 0.78; this.dist = 26; this.fov = 0.72;
    this.tx = 0; this.ty = 0; this.tz = 0;
    this.w = 1; this.h = 1;
  }
  Camera.prototype.update = function (w, h) {
    this.w = w; this.h = h;
    const cp = Math.cos(this.pitch);
    this.px = this.tx + Math.sin(this.yaw) * cp * this.dist;
    this.py = this.ty + Math.sin(this.pitch) * this.dist;
    this.pz = this.tz + Math.cos(this.yaw) * cp * this.dist;
    let fx = this.tx - this.px, fy = this.ty - this.py, fz = this.tz - this.pz;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    this.f = [fx, fy, fz]; this.r = [rx, 0, rz]; this.u = [ux, uy, uz];
    this.focal = Math.min(w, h * 1.25) / (2 * Math.tan(this.fov / 2));
    this.cx = w / 2; this.cy = h / 2 + h * 0.03;
  };
  // Monde → écran ; la profondeur est rendue dans out[2].
  Camera.prototype.project = function (x, y, z, out) {
    const dx = x - this.px, dy = y - this.py, dz = z - this.pz;
    let zc = dx * this.f[0] + dy * this.f[1] + dz * this.f[2];
    const xc = dx * this.r[0] + dz * this.r[2];
    const yc = dx * this.u[0] + dy * this.u[1] + dz * this.u[2];
    if (zc < 0.1) zc = 0.1;
    out[0] = this.cx + xc / zc * this.focal;
    out[1] = this.cy - yc / zc * this.focal;
    out[2] = zc;
    return out;
  };
  // Écran → sol (plan y = h).
  Camera.prototype.groundAt = function (sx, sy, h) {
    if (!this.f) return null;
    h = h || 0;
    const nx = (sx - this.cx) / this.focal, ny = -(sy - this.cy) / this.focal;
    const dx = this.f[0] + this.r[0] * nx + this.u[0] * ny;
    const dy = this.f[1] + this.u[1] * ny;
    const dz = this.f[2] + this.r[2] * nx + this.u[2] * ny;
    if (dy >= -1e-4) return null;
    const t = (h - this.py) / dy;
    return { x: this.px + dx * t, z: this.pz + dz * t };
  };

  // ---------- Lumière et couleur papier ----------
  const L = (function () { const x = -0.45, y = 0.85, z = 0.35, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  const BLANC = [1, 1, 1];
  const CHAINES = new Map();
  // teinte : multiplicateurs [r, g, b] d'ambiance (nuit bleutée, orage gris...).
  function shade(c, nx, ny, nz, alpha, teinte, nonEclaire) {
    const t = teinte || BLANC;
    let r, g, b;
    if (nonEclaire) { r = c[0]; g = c[1]; b = c[2]; }
    else {
      const d = nx * L[0] + ny * L[1] + nz * L[2];
      const k = 0.58 + 0.52 * Math.max(0, d);
      // Ombres un peu bleutées, lumière un peu chaude : effet papier.
      r = c[0] * k + (k > 1 ? 6 : -4);
      g = c[1] * k + (k > 1 ? 3 : -1);
      b = c[2] * k + (k > 1 ? -4 : 8);
      r *= t[0]; g *= t[1]; b *= t[2];
    }
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    if (alpha !== undefined && alpha < 1) return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(2) + ')';
    // Cache des chaînes de couleur : beaucoup de faces partagent la même teinte d'une image à l'autre.
    const cle = (r << 16) | (g << 8) | b;
    let s = CHAINES.get(cle);
    if (!s) { s = '#' + (0x1000000 + cle).toString(16).slice(1); CHAINES.set(cle, s); }
    return s;
  }

  // ---------- Papiers rares (GDD 5.3) ----------
  // Couleur de fond du papier : la couleur de l'espèce, passée dans le papier spécial.
  const PAPIERS = {
    journal: { fond: [222, 217, 204], part: 0.72, echelle: 110 },  // papier journal gris, lignes imprimées
    washi: { fond: [252, 240, 238], part: 0.42, echelle: 55 },    // papier japonais : pastel, fibres, motifs
  };
  function couleurPapier(c, papier) {
    const p = PAPIERS[papier];
    if (!p) return c;
    const m = melange(c, p.fond, p.part);
    if (papier === 'washi') {
      // Un peu plus de couleur que le simple mélange : le washi est teint, pas délavé.
      const moy = (m[0] + m[1] + m[2]) / 3;
      return [moy + (m[0] - moy) * 1.35, moy + (m[1] - moy) * 1.35, moy + (m[2] - moy) * 1.35];
    }
    return m;
  }
  // Motifs dessinés une fois sur de petits canvas (128 px), répétés sur les faces.
  function creerMotifs(doc) {
    const fabriquer = (dessin) => {
      const c = doc.createElement('canvas'); c.width = c.height = 128;
      dessin(c.getContext('2d'));
      return c;
    };
    let h = 7;
    const rnd = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
    const journal = fabriquer(g => {
      // Colonnes de texte imprimé : lignes de « mots » gris foncé, un titre gras, un filet.
      g.fillStyle = 'rgba(36,34,30,0.62)';
      for (let col = 0; col < 2; col++) {
        const x0 = 6 + col * 64;
        for (let y = 6; y < 124; y += 7) {
          if (y > 36 && y < 50 && col === 0) continue;
          let x = x0;
          while (x < x0 + 54) {
            const w = 3 + rnd() * 9;
            if (x + w > x0 + 56) break;
            g.fillRect(x, y, w, 2.2);
            x += w + 2;
          }
        }
      }
      g.fillStyle = 'rgba(28,26,23,0.8)';
      g.fillRect(6, 38, 50, 9);
      g.fillStyle = 'rgba(40,38,34,0.35)';
      g.fillRect(63, 4, 1, 120);
    });
    const washi = fabriquer(g => {
      // Fibres claires et longues, quelques fibres colorées, petites fleurs de cerisier.
      for (let k = 0; k < 80; k++) {
        const x = rnd() * 128, y = rnd() * 128, a = rnd() * Math.PI, L2 = 6 + rnd() * 22;
        g.strokeStyle = k % 7 === 0 ? 'rgba(214,110,135,0.7)' : k % 11 === 0 ? 'rgba(201,163,77,0.8)' : 'rgba(255,255,255,0.8)';
        g.lineWidth = k % 7 === 0 ? 1.4 : 1;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a + 0.6) * L2 * 0.5, y + Math.sin(a + 0.6) * L2 * 0.5, x + Math.cos(a) * L2, y + Math.sin(a) * L2);
        g.stroke();
      }
      const fleur = (x, y, r, coul) => {
        g.fillStyle = coul;
        for (let p = 0; p < 5; p++) {
          const a = p / 5 * Math.PI * 2;
          g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, r * 0.5, a, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(201,150,60,0.9)'; g.beginPath(); g.arc(x, y, r * 0.35, 0, Math.PI * 2); g.fill();
      };
      fleur(30, 34, 9, 'rgba(236,140,165,0.8)');
      fleur(92, 88, 8, 'rgba(255,255,255,0.9)');
      fleur(100, 26, 5, 'rgba(236,140,165,0.7)');
      fleur(24, 98, 6, 'rgba(140,175,215,0.75)');
      fleur(64, 62, 4, 'rgba(255,255,255,0.85)');
      // Points de feuille d'or.
      g.fillStyle = 'rgba(214,172,70,0.65)';
      for (let k = 0; k < 14; k++) g.fillRect(rnd() * 128, rnd() * 128, 1.5 + rnd() * 2, 1.5 + rnd() * 2);
    });
    return { journal, washi };
  }

  // ---------- Rendu ----------
  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = new Camera();
    this.polys = [];
    this.np = 0;
    this.tmp = [0, 0, 0];
    this.wv = [];
    this.teinte = null;
    this.motifs = {};
    this.motifsSources = canvas.ownerDocument ? creerMotifs(canvas.ownerDocument) : null;
    if (this.motifsSources) for (const id in this.motifsSources) this.motifs[id] = this.ctx.createPattern(this.motifsSources[id], 'repeat');
  }
  Renderer.prototype.begin = function () { this.np = 0; };
  Renderer.prototype._poly = function () {
    let p = this.polys[this.np];
    if (!p) { p = { pts: new Float32Array(16), n: 0, z: 0, col: '', papier: '', l1: 1, l2: 1, k: 1 }; this.polys[this.np] = p; }
    this.np++;
    return p;
  };
  // Ajoute une instance de maillage aux polygones à trier.
  // o (facultatif) : { alpha, tilt (bascule avant/arrière), roll (roulis), papier, biais (décalage de profondeur) }
  Renderer.prototype.add = function (mesh, x, y, z, ry, s, sy, o) {
    o = o || {};
    const alpha = o.alpha, tilt = o.tilt || 0, roll = o.roll || 0, papier = o.papier || '', biais = o.biais || 0;
    const cam = this.cam, cy = Math.cos(ry), sn = Math.sin(ry);
    const sY = sy || s, V = mesh.v, wv = this.wv, tmp = this.tmp;
    const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
    for (let k = 0; k < V.length; k++) {
      let vx = V[k][0] * s, vy = V[k][1] * sY, vz = V[k][2] * s;
      if (tilt) { const ty = vy * ct - vz * st, tz = vy * st + vz * ct; vy = ty; vz = tz; }
      if (roll) { const tx = vx * cr - vy * sr, ty = vx * sr + vy * cr; vx = tx; vy = ty; }
      const w = wv[k] || (wv[k] = [0, 0, 0, 0, 0, 0]);
      w[0] = x + vx * cy + vz * sn; w[1] = y + vy; w[2] = z - vx * sn + vz * cy;
      cam.project(w[0], w[1], w[2], tmp);
      w[3] = tmp[0]; w[4] = tmp[1]; w[5] = tmp[2];
    }
    const F = mesh.f;
    for (let q = 0; q < F.length; q++) {
      const f = F[q], ids = f.i;
      const a = wv[ids[0]], b = wv[ids[1]], c = wv[ids[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx2 = c[0] - a[0], vy2 = c[1] - a[1], vz2 = c[2] - a[2];
      let nx = uy * vz2 - uz * vy2, ny = uz * vx2 - ux * vz2, nz = ux * vy2 - uy * vx2;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const facing = nx * (cam.px - a[0]) + ny * (cam.py - a[1]) + nz * (cam.pz - a[2]);
      if (facing < 0) { if (!f.ds) continue; nx = -nx; ny = -ny; nz = -nz; }
      const p = this._poly();
      let zs = 0;
      p.n = ids.length;
      for (let m = 0; m < ids.length; m++) { const w2 = wv[ids[m]]; p.pts[m * 2] = w2[3]; p.pts[m * 2 + 1] = w2[4]; zs += w2[5]; }
      p.z = zs / ids.length + biais;
      p.papier = papier && this.motifs[papier] && !f.ne ? papier : '';
      p.col = shade(p.papier ? couleurPapier(f.c, papier) : f.c, nx, ny, nz, alpha, this.teinte, f.ne);
      if (p.papier) {
        p.l1 = Math.hypot(ux, uy, uz) || 1; p.l2 = Math.hypot(vx2, vy2, vz2) || 1;
        p.k = Math.max(0.35, Math.min(1, 0.55 + 0.5 * (nx * L[0] + ny * L[1] + nz * L[2])));
      }
    }
  };
  // Polygone au sol (ombre, anneau, décor plat) dessiné tout de suite. y : hauteur du sol.
  Renderer.prototype.groundPoly = function (pts, fill, stroke, lw, y) {
    const ctx = this.ctx, cam = this.cam, t = this.tmp;
    ctx.beginPath();
    for (let k = 0; k < pts.length; k += 2) {
      cam.project(pts[k], y === undefined ? 0.02 : y, pts[k + 1], t);
      if (k === 0) ctx.moveTo(t[0], t[1]); else ctx.lineTo(t[0], t[1]);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  };
  Renderer.prototype.ellipse = function (x, z, rx, rz, fill, stroke, lw, n, y) {
    n = n || 14;
    const pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; pts.push(x + Math.cos(a) * rx, z + Math.sin(a) * rz); }
    this.groundPoly(pts, fill, stroke, lw, y);
  };
  Renderer.prototype.flush = function () {
    const P = this.polys, n = this.np, ctx = this.ctx;
    const list = P.slice(0, n);
    list.sort((a, b) => b.z - a.z);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8;
    for (let k = 0; k < n; k++) {
      const p = list[k], pts = p.pts;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let m = 1; m < p.n; m++) ctx.lineTo(pts[m * 2], pts[m * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = p.col; ctx.fill();
      ctx.strokeStyle = p.col; ctx.stroke();
      if (p.papier) {
        // Le motif suit la face : repère formé par ses deux premières arêtes.
        const mot = this.motifs[p.papier], e = PAPIERS[p.papier].echelle;
        const a1 = (pts[2] - pts[0]) / (e * p.l1), b1 = (pts[3] - pts[1]) / (e * p.l1);
        const c1 = (pts[4] - pts[0]) / (e * p.l2), d1 = (pts[5] - pts[1]) / (e * p.l2);
        if (mot.setTransform && typeof DOMMatrix !== 'undefined') mot.setTransform(new DOMMatrix([a1, b1, c1, d1, pts[0], pts[1]]));
        ctx.globalAlpha = p.k;
        ctx.fillStyle = mot; ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    return n;
  };

  return { Builder, Camera, Renderer, shade, hex, melange, couleurPapier, creerMotifs, PAPIERS };
});
