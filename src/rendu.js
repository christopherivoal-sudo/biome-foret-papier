// Biome, la forêt de papier : rendu de l'île v2 à partir de l'état de core.js (sprint 4).
// Ne modifie jamais l'état : il le lit et le dessine.
// - Sol en papier plié, une tuile = deux triangles : couleur selon couvert, fertilité, humidité, ombre, saison.
// - Tuiles : herbe, fleurs, ronce, bouleau, eau (mare creusée), roche, bois mort (tas ou arbre foudroyé),
//   tas de pierres, hôtel à insectes, paillis, nichoir, mycélium et coulemelles, jeune chêne du teaser (sprint 5 bis).
// - Saisons (feuillage, mûres, neige, feuilles qui tombent), jour, crépuscule, nuit.
// - Météo : orage (nuages, pluie, éclairs, foudre), sécheresse (herbe jaunie, sol craquelé, brume chaude),
//   floraison (pétales, fleurs plus grandes).
// - Agents animés, nuées des populations, spécimens rares en papier journal ou washi, effets du journal.
// - Cabane et garde forestière au bord de l'île.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./engine.js'), require('./models.js'));
  else racine.BiomeRendu = fabrique(racine.BiomeEngine, racine.BiomeModels);
})(typeof self !== 'undefined' ? self : this, function (E, Modeles) {
  'use strict';
  const mel = E.melange;
  const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
  const borne = (v, a, b) => v < a ? a : v > b ? b : v;
  const lisse = (a, b, x) => { const t = borne((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Couleurs du sol (papier).
  const SOL_PAUVRE = [222, 196, 148], SOL_RICHE = [150, 108, 70];
  const HERBE = { printemps: [136, 190, 96], ete: [116, 172, 84], automne: [146, 162, 88], hiver: [150, 160, 112] };
  const HERBE_SECHE = [204, 188, 118], NEIGE = [243, 241, 235], EAU = [104, 160, 196], GLACE = [190, 216, 228];

  // options.webgl (sprint 8a) : dessine avec le moteur WebGL (moteur3d.js, Three.js) ; repli Canvas 2D s'il échoue.
  function creer(canvas, dataBrute, Core, options) {
    const data = Core.preparer(dataBrute);
    let GL = null;
    if (options && options.webgl && typeof self !== 'undefined' && self.BiomeMoteur3D) {
      try { GL = new self.BiomeMoteur3D.Renderer3D(canvas, options); } catch (e) { GL = null; if (typeof console !== 'undefined') console.warn('WebGL indisponible, repli Canvas 2D', e); }
    }
    const R3 = GL || new E.Renderer(canvas), cam = R3.cam, ctxPrincipal = R3.ctx;
    let ctx = ctxPrincipal;
    const M = Modeles.creer(dataBrute);
    const N = Core.N, C = Core.CENTRE;
    let terrain = null, temps = 0, image = 0;
    const lisses = {}, effets = [], particules = [];
    let dernierJournal = -1, eclair = 0, eclairCible = null, prochainEclair = 4;
    const odile = { a: 0, x: 0, z: 0, dir: 0, pause: 0, jumelles: false };
    // Cibles cliquables de l'image en cours (sprint 5) : animaux, nuées, garde et cabane.
    let cibles = [];

    // ---------- Terrain ----------
    function rayonBord(etat) { return Math.sqrt(etat.rayon * etat.rayon + etat.rayon) + 0.35; }
    function signatureEau(etat) { let s = etat.rayon + ':'; etat.tuiles.forEach((t, i) => { if (t && t.c === 'eau') s += i + ','; }); return s; }
    function construireTerrain(etat) {
      const Re = rayonBord(etat), V = [], M1 = N + 1;
      const eau = (x, y) => x >= 0 && y >= 0 && x < N && y < N && etat.tuiles[y * N + x] && etat.tuiles[y * N + x].c === 'eau';
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        let x = i - C - 0.5, z = j - C - 0.5;
        const d = Math.hypot(x, z);
        if (d > Re) { x *= Re / d; z *= Re / d; }
        const bord = Math.max(0, 1 - Math.abs(Math.hypot(x, z) - Re) / 0.8);
        let y = (hash(i, j) - 0.5) * 0.05 * (1 - bord);
        // Mare : un sommet entouré d'eau est creusé, un sommet de berge descend un peu.
        const n = eau(i - 1, j - 1) + eau(i, j - 1) + eau(i - 1, j) + eau(i, j);
        if (n === 4) y = -0.22; else if (n > 0) y = -0.04;
        V.push([x, y, z]);
      }
      const tris = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const cell = j * N + i;
        if (!etat.tuiles[cell]) continue;
        const a = j * M1 + i, b = a + 1, c = a + M1, d = c + 1;
        const paire = (i + j) % 2 === 0 ? [[a, c, b], [b, c, d]] : [[a, c, d], [a, d, b]];
        for (const t of paire) {
          const A = V[t[0]], Bv = V[t[1]], Cv = V[t[2]];
          const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2];
          const vx = Cv[0] - A[0], vy = Cv[1] - A[1], vz = Cv[2] - A[2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, ny, nz);
          if (nl < 1e-6) continue;
          if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
          tris.push({ v: t, cell, n: [nx / nl, ny / nl, nz / nl], k: tris.length });
        }
      }
      // Tranche de l'îlot (sprint 6) : une carte de papier épaisse, crème puis kraft, sans cône sombre en dessous.
      const sk = new E.Builder(), S = 72;
      for (let k = 0; k < S; k++) {
        const a0 = k / S * Math.PI * 2, a1 = (k + 1) / S * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p0 = sk.vert(c0 * Re, 0, s0 * Re), p1 = sk.vert(c1 * Re, 0, s1 * Re);
        const q0 = sk.vert(c0 * Re, -0.16, s0 * Re), q1 = sk.vert(c1 * Re, -0.16, s1 * Re);
        const r0 = sk.vert(c0 * Re * 0.995, -0.42, s0 * Re * 0.995), r1 = sk.vert(c1 * Re * 0.995, -0.42, s1 * Re * 0.995);
        sk.face([p0, p1, q1, q0], k % 2 ? '#f4ecda' : '#efe6d2', false, false, true);
        sk.face([q0, q1, r1, r0], k % 2 ? '#c9a878' : '#c2a070', false, false, true);
      }
      const ang = 2.88, cxp = Math.cos(ang) * (Re + 0.75), czp = Math.sin(ang) * (Re + 0.75);
      const pr = new E.Builder();
      pr.prism(0, 0, 9, 1.05, 1.15, -0.16, -0.01, ['#f4ecda', '#efe6d2'], 0.2);
      pr.prism(0, 0, 9, 1.04, 1.05, -0.42, -0.16, ['#c9a878', '#c2a070'], 0.2);
      for (const f of pr.f) f.doux = true;
      terrain = { sig: signatureEau(etat), Re, V, P: V.map(() => [0, 0, 0]), tris, jupe: sk.build(), promontoire: pr.build(), cabane: { x: cxp, z: czp, dir: -ang - Math.PI / 2 } };
      if (GL) { GL.definirSol(V, tris); GL.reglerSoleil(undefined, Re + 2.5); }
      odile.x = cxp + 0.6; odile.z = czp;
    }

    // ---------- Contexte visuel (saison, moment, météo) ----------
    function ambiance(etat, opts) {
      const h = Core.horloge(etat), m = Core.meteo(etat, data);
      const saison = opts.saison && opts.saison !== 'auto' ? opts.saison : h.saison;
      let t = h.dansJour;
      if (opts.moment === 'jour') t = 0.35; else if (opts.moment === 'crepuscule') t = 0.72; else if (opts.moment === 'nuit') t = 0.85;
      const nuit = t < 0.958 ? lisse(0.68, 0.75, t) : 1 - lisse(0.958, 1, t);
      const crep = Math.max(0, 1 - Math.abs(t - 0.72) / 0.06) + Math.max(0, 1 - Math.abs(t - 0.985) / 0.03) * 0.7;
      let meteo = m.actif ? m.actif.id : '', annonce = m.annonce ? m.annonce.id : '';
      if (opts.meteo && opts.meteo !== 'auto') { meteo = opts.meteo === 'aucun' ? '' : opts.meteo; annonce = ''; }
      // Décalage d'humidité « vu » quand la météo est forcée dans la vitrine (la simulation n'est pas touchée).
      const forcee = opts.meteo && opts.meteo !== 'auto';
      const decalH = forcee ? (meteo === 'secheresse' ? -28 : meteo === 'orage' ? 25 : 0) : 0;
      const orage = meteo === 'orage' ? 1 : annonce === 'orage' ? 0.45 : 0;
      const tierce = Math.floor(((h.jour % 3) + h.dansJour) / 3 * 3); // 0, 1, 2 : début, milieu, fin de saison
      const finSaison = ((h.jour % 3) + h.dansJour) / 3;
      return { t, h, saison, nuit, crep, meteo, annonce, orage, decalH, finSaison, tierce, abri: m.abri };
    }
    function teinte(A) {
      let r = 1, g = 1, b = 1;
      r *= 1 - A.nuit * 0.46; g *= 1 - A.nuit * 0.4; b *= 1 - A.nuit * 0.12;
      r *= 1 + A.crep * 0.06; g *= 1 - A.crep * 0.1; b *= 1 - A.crep * 0.2;
      r *= 1 - A.orage * 0.26; g *= 1 - A.orage * 0.22; b *= 1 - A.orage * 0.12;
      if (A.meteo === 'secheresse') { r *= 1.05; b *= 0.9; }
      return [r, g, b];
    }

    // ---------- Couleur d'une tuile ----------
    function couleurTuile(t, A, cell) {
      const hv = borne(t.h + A.decalH, 0, 100);
      const f = borne(t.f / 70, 0, 1);
      let c = mel(SOL_PAUVRE, SOL_RICHE, f);
      // Sol humide : plus sombre et plus froid ; sec : plus clair.
      const hum = hv / 100;
      c = [c[0] * (1.06 - 0.24 * hum), c[1] * (1.05 - 0.2 * hum), c[2] * (1.0 - 0.1 * hum)];
      let vert = HERBE[A.saison];
      if (A.saison === 'printemps' && A.meteo === 'floraison') vert = [160, 204, 110];
      vert = mel(vert, HERBE_SECHE, A.meteo === 'secheresse' ? lisse(34, 12, hv) : lisse(16, 6, hv));
      // Sprint 7 : herbe usée par les lapins (surpâturage), qui jaunit avant de disparaître.
      if (t.use > 0.1) vert = mel(vert, HERBE_SECHE, Math.min(1, t.use * 1.3));
      const neige = A.saison === 'hiver' ? lisse(0.05, 0.4, A.finSaison) * 0.9 + 0.1 : 0;
      switch (t.c) {
        case 'herbe': c = mel(c, vert, 0.55 + 0.4 * Math.min(1, t.age + 0.3)); break;
        case 'fleurs': c = mel(c, mel(vert, [190, 200, 120], 0.15), 0.85); break;
        case 'ronce': c = mel(c, mel(vert, [70, 92, 60], 0.55), 0.75); break;
        case 'arbre': c = mel(c, A.saison === 'automne' ? [198, 150, 72] : mel(vert, [120, 112, 70], 0.35), 0.7); break;
        case 'eau': {
          const w = 0.06 * Math.sin(temps * 1.3 + cell * 0.7);
          c = A.saison === 'hiver' && neige > 0.5 ? GLACE : [EAU[0] * (1 + w), EAU[1] * (1 + w), EAU[2] * (1 + w * 0.5)];
          return c;
        }
        case 'roche': c = mel(c, [168, 160, 146], 0.4); break;
        default: break;
      }
      if (t.paillis > 0) c = mel(c, [178, 140, 88], 0.35);
      if (t.o > 0) { const k = 1 - 0.32 * t.o / 100; c = [c[0] * k, c[1] * k, c[2] * k * 1.04]; }
      if (neige) c = mel(c, NEIGE, neige * (t.c === 'arbre' ? 0.6 : 0.9));
      return c;
    }

    // Sprint 6 : couleurs du sol adoucies. Chaque sommet prend la moyenne des tuiles qui le touchent (hors eau) ;
    // chaque triangle mélange la couleur de sa tuile et celle de ses sommets : moins de damier, transitions douces.
    const couleursTuiles = [], couleursSommets = [];
    function preparerCouleurs(etat, A) {
      const M1 = N + 1;
      for (let i = 0; i < N * N; i++) couleursTuiles[i] = etat.tuiles[i] ? couleurTuile(etat.tuiles[i], A, i) : null;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const x = i + dx, y = j + dy;
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const c = couleursTuiles[y * N + x];
          if (!c || etat.tuiles[y * N + x].c === 'eau') continue;
          r += c[0]; g += c[1]; b += c[2]; n++;
        }
        couleursSommets[j * M1 + i] = n ? [r / n, g / n, b / n] : null;
      }
    }
    function couleurTri(etat, t) {
      const cell = t.cell, col = couleursTuiles[cell];
      if (etat.tuiles[cell].c === 'eau') { const w = 1 + 0.07 * Math.sin(temps * 2 + t.k * 1.7); return [col[0] * w, col[1] * w, col[2] * w]; }
      let r = 0, g = 0, b = 0, n = 0;
      for (const v of t.v) { const cv = couleursSommets[v]; if (cv) { r += cv[0]; g += cv[1]; b += cv[2]; n++; } }
      return n ? [col[0] * 0.45 + r / n * 0.55, col[1] * 0.45 + g / n * 0.55, col[2] * 0.45 + b / n * 0.55] : col;
    }
    function colorerSolGL(etat, A) {
      preparerCouleurs(etat, A);
      const tris = terrain.tris;
      GL.colorerSol(k => couleurTri(etat, tris[k]));
    }
    function dessinerTerrain(etat, A) {
      const T = terrain, P = T.P, V = T.V, te = R3.teinte;
      for (let k = 0; k < V.length; k++) cam.project(V[k][0], V[k][1], V[k][2], P[k]);
      preparerCouleurs(etat, A);
      ctx.lineJoin = 'round'; ctx.lineWidth = 0.8;
      for (const t of T.tris) {
        const c = couleurTri(etat, t);
        const a = P[t.v[0]], b = P[t.v[1]], d = P[t.v[2]];
        const s = E.shade(c, t.n[0], t.n[1], t.n[2], undefined, te);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
        ctx.fillStyle = s; ctx.fill(); ctx.strokeStyle = s; ctx.stroke();
      }
    }

    // ---------- Décors plats (dessinés sur le sol, avant les objets) ----------
    const OMBRE = 'rgba(34, 44, 26, 0.16)';
    // En WebGL, les ombres sont de vraies ombres portées : plus besoin des taches au sol.
    function ombre(x, z, r, h) { if (GL) return; R3.ellipse(x + 0.18 * h, z - 0.14 * h, r, r * 0.8, OMBRE, null, 0, 10); }
    function decors(etat, A, liste) {
      for (const i of liste) {
        const t = etat.tuiles[i], x = (i % N) - C, z = ((i / N) | 0) - C, hv = t.h + A.decalH;
        if (t.paillis > 0) {
          // Paille : brins posés en travers.
          for (let k = 0; k < 7; k++) {
            const px = x + (hash(i, 20 + k) - 0.5) * 0.8, pz = z + (hash(i, 40 + k) - 0.5) * 0.8, a = hash(i, 60 + k) * Math.PI;
            const dx = Math.cos(a) * 0.17, dz = Math.sin(a) * 0.17, ex = -dz * 0.12, ez = dx * 0.12;
            R3.groundPoly([px - dx - ex, pz - dz - ez, px + dx - ex, pz + dz - ez, px + dx + ex, pz + dz + ez, px - dx + ex, pz - dz + ez], k % 2 ? 'rgba(214,180,110,0.9)' : 'rgba(186,146,88,0.9)', null, 0, 0.03);
          }
        }
        if (t.c === 'nu' && !t.a && A.saison !== 'hiver' && (hv < 10 || (A.meteo === 'secheresse' && hv < 30))) {
          // Sol craquelé par la sécheresse.
          const al = (0.3 + 0.45 * lisse(30, 8, hv)).toFixed(2);
          for (let k = 0; k < 3; k++) {
            const px = x + (hash(i, 80 + k) - 0.5) * 0.6, pz = z + (hash(i, 90 + k) - 0.5) * 0.6, a = hash(i, 100 + k) * Math.PI * 2;
            const pts = [px, pz, px + Math.cos(a) * 0.22, pz + Math.sin(a) * 0.22, px + Math.cos(a + 0.6) * 0.38, pz + Math.sin(a + 0.6) * 0.38];
            R3.groundPoly(pts, null, 'rgba(92,66,44,' + al + ')', 1.1, 0.025);
          }
        }
        if (t.champi && !fructifie(A)) {
          // Mycélium : filaments blancs dans la litière.
          for (let k = 0; k < 3; k++) {
            const a = hash(i, 120 + k) * Math.PI * 2, px = x + Math.cos(a) * 0.1, pz = z + Math.sin(a) * 0.1;
            R3.groundPoly([px, pz, px + Math.cos(a) * 0.3, pz + Math.sin(a) * 0.3, px + Math.cos(a + 0.5) * 0.42, pz + Math.sin(a + 0.5) * 0.42], null, 'rgba(250,246,236,0.75)', 1, 0.03);
          }
        }
        if (t.c === 'arbre') { const m = maturite(t); ombre(x, z, 0.65 * m + 0.15, 2.2 * m); }
        else if (t.c === 'ronce') ombre(x, z, 0.4, 0.4);
        else if (t.a === 'tas_pierres' || t.a === 'hotel_insectes' || t.c === 'bois_mort' || t.c === 'roche') ombre(x, z, 0.38, 0.4);
      }
    }
    const fructifie = A => A.saison === 'automne';
    function maturite(t) {
      const f = data.especes[t.e];
      const j = f && f.croissance ? f.croissance.jours_adulte : 1;
      return Math.min(1, 0.25 + 0.75 * t.age / Math.max(j, 0.01));
    }

    // ---------- Objets des tuiles ----------
    // couche 'bas' : herbe et fleurs (dessinées dans le fond mis en cache) ; 'haut' : tout le reste (trié chaque image).
    function objetsTuiles(etat, A, liste, rares, couche) {
      const sais = A.saison;
      const varRonce = sais === 'hiver' ? 'hiver' : sais === 'automne' ? 'mures' : sais === 'ete' ? (A.finSaison < 0.45 ? 'fleurs' : 'mures') : (A.finSaison > 0.75 ? 'fleurs' : 'normale');
      const floraison = A.meteo === 'floraison';
      for (const i of liste) {
        const t = etat.tuiles[i], x = (i % N) - C, z = ((i / N) | 0) - C, hv = t.h + A.decalH;
        const h1 = hash(i, 1), h2 = hash(i, 2), papier = rares.tuile[i] || '';
        const seche = hv < 14 || (A.meteo === 'secheresse' && hv < 26), basse = t.c === 'herbe' || t.c === 'fleurs';
        if (couche === 'bas' && !basse) continue;
        if (basse && couche === 'bas') {
          const jeu = sais === 'hiver' ? 'hiver' : seche ? 'sec' : sais;
          const touffes = M.herbe[jeu];
          const ht = (0.22 + 0.24 * Math.min(1, t.age + 0.2)) * (seche ? 0.75 : 1) * (sais === 'hiver' ? 0.7 : 1);
          if (sais === 'hiver' && hash(i, 8) < 0.7) continue;
          // De loin, une seule touffe par tuile, puis plus du tout : le sol vert suffit et l'île reste lisible.
          if (cam.dist > 34 && t.c === 'herbe' && !papier) continue;
          R3.add(touffes[h1 < 0.5 ? 0 : 1], x + (h1 - 0.5) * 0.5, 0, z + (h2 - 0.5) * 0.5, h2 * 6.28, 1.0, ht, t.c === 'herbe' && papier ? { papier } : undefined);
          // Sprint 6 : herbe plus dense (3 touffes par tuile), pour une prairie qui se lit de loin.
          if (sais !== 'hiver' && t.c === 'herbe' && cam.dist < 26) {
            R3.add(touffes[h2 < 0.5 ? 1 : 0], x - 0.28 + hash(i, 7) * 0.12, 0, z + 0.22 - hash(i, 9) * 0.1, h1 * 6.28, 0.85, ht * 0.85);
            R3.add(touffes[h1 < 0.5 ? 1 : 0], x + 0.26 - hash(i, 11) * 0.1, 0, z - 0.26 + hash(i, 12) * 0.12, h2 * 3.1 + 1, 0.8, ht * 0.8);
          }
          if (t.c === 'fleurs' && sais !== 'hiver') {
            // Sprint 6 : fleurs plus grandes et plus nombreuses (on les voit au-dessus de l'herbe).
            const n = floraison ? 5 : 3 + (hash(i, 3) < 0.5), sc = 1.55 * (floraison ? 1.25 : 1) * (seche ? 0.8 : 1) * (0.6 + 0.4 * Math.min(1, t.age + 0.3));
            for (let k = 0; k < n; k++) {
              const fx = x + (hash(i, 10 + k) - 0.5) * 0.75, fz = z + (hash(i, 14 + k) - 0.5) * 0.75;
              R3.add(M.fleurs[(((hash(i, 4) * 4) | 0) + k) % 4], fx, 0, fz, hash(i, 5 + k) * 6, sc, sc * (seche ? 0.85 : 1), papier ? { papier } : undefined);
            }
          }
          continue;
        } else if (t.c === 'ronce') {
          const m = maturite(t);
          R3.add(M.ronce[varRonce][h1 < 0.5 ? 0 : 1], x, 0, z, h2 * 6.28, 0.55 + 0.6 * m, (0.55 + 0.6 * m) * (seche ? 0.9 : 1), papier ? { papier } : undefined);
        } else if (t.c === 'arbre') {
          const m = maturite(t), jeu = M.bouleau[sais] || M.bouleau.ete;
          const s = 0.3 + 0.75 * m, rot = h2 * 6.28;
          R3.add(jeu[h1 < 0.5 ? 0 : 1], x, 0, z, rot, s, s, papier ? { papier } : undefined);
          if (t.nichoir) R3.add(M.nichoir, x + Math.sin(rot) * 0.08 * s, 0.95 * s, z + Math.cos(rot) * 0.08 * s, rot, 1.1);
        } else if (t.c === 'roche') {
          R3.add(M.roche[(h1 * 3) | 0], x, 0, z, h2 * 6.28, 0.9 + h1 * 0.3, 0.9, sais === 'hiver' ? undefined : undefined);
        } else if (t.c === 'bois_mort' && t.ancre === i) {
          R3.add(t.naturel ? M.bois_mort_naturel : M.tas_bois, x, 0, z, t.naturel ? h2 * 6.28 : (h2 < 0.5 ? 0 : Math.PI / 2), 1);
        } else if (t.a === 'tas_pierres') R3.add(M.tas_pierres, x, 0, z, h2 * 6.28, 1.05);
        else if (t.a === 'hotel_insectes') R3.add(M.hotel_insectes, x, 0, z, versCamera(x, z), 1);
        if (t.champi && fructifie(A)) {
          const n = 1 + (hash(i, 30) < 0.5);
          for (let k = 0; k < n; k++) R3.add(k ? M.coulemelleBouton : M.coulemelle, x + (hash(i, 31 + k) - 0.5) * 0.6, 0, z + (hash(i, 33 + k) - 0.5) * 0.6, hash(i, 35) * 6, k ? 1.1 : 1.15, undefined, papier ? { papier } : undefined);
        }
        if (etat.teaser && etat.teaser.chene === i && (t.c === 'herbe' || t.c === 'nu' || t.c === 'fleurs') && !t.a) {
          // Teaser de la Jeune forêt : le jeune chêne sort de terre en une minute, puis se balance doucement.
          const pousse = lisse(0, 60, etat.temps - (etat.teaser.t || 0)), s = (0.35 + 0.85 * pousse) * 1.15;
          R3.add(M.jeune_chene[sais] || M.jeune_chene.ete, x + 0.12, 0, z - 0.1, 0.6 + Math.sin(temps * 0.7) * 0.06, s, s);
        }
        if (t.graines >= 1 && (t.c === 'fleurs' || t.c === 'ronce' || t.c === 'arbre')) {
          // Graines mûres à récolter : petite capsule qui flotte au-dessus de la plante.
          const hy = t.c === 'arbre' ? 2.3 * (0.3 + 0.75 * maturite(t)) : t.c === 'ronce' ? 0.95 : 0.6;
          R3.add(M.graine, x + 0.15, hy + Math.sin(temps * 2 + i) * 0.05, z, temps * 0.8 + i, 1.5);
          cibles.push({ k: 'graine', tuile: i, x: x + 0.15, y: hy, z, r: 1.2 });
        }
      }
    }
    // Orientation vers la caméra (aménagements à façade).
    function versCamera(x, z) { return Math.atan2(cam.px - x, cam.pz - z); }

    // ---------- Agents ----------
    function suivre(a, dt) {
      let r = lisses[a.id];
      const wx = a.x - C, wz = a.y - C;
      if (!r) r = lisses[a.id] = { x: wx, z: wz, dir: Math.random() * 6, ph: Math.random() * 6, vit: 0, vu: 0, haut: 0 };
      const k = Math.min(1, dt * 3.2);
      const nx = r.x + (wx - r.x) * k, nz = r.z + (wz - r.z) * k;
      const v = Math.hypot(nx - r.x, nz - r.z) / Math.max(dt, 1e-3);
      if (v > 0.05) r.dir = lerpAngle(r.dir, Math.atan2(nx - r.x, nz - r.z), Math.min(1, dt * 8));
      r.vit += (v - r.vit) * Math.min(1, dt * 6);
      r.x = nx; r.z = nz; r.vu = image;
      return r;
    }
    function dessinerAgents(etat, A, dt, rares) {
      const zzz = [];
      for (const a of etat.agents) {
        const p = suivre(a, dt), papier = rares.agent[a.id] || '', o = papier ? { papier } : {};
        if (a.m === 'dort') { zzz.push(p); continue; }
        cibles.push({ k: 'agent', agent: a.id, esp: a.esp, papier, x: p.x, y: (p.haut || 0) + 0.3, z: p.z });
        const bouge = p.vit > 0.15, G = api.grossir;
        if (bouge) p.ph += dt * (a.esp === 'lapin' ? 11 : 9);
        switch (a.esp) {
          case 'lapin': {
            const saut = bouge ? Math.abs(Math.sin(p.ph)) * 0.15 : 0;
            ombre(p.x, p.z, 0.2 * G, 0.2);
            o.tilt = bouge ? -0.12 : 0;
            R3.add(M.lapin, p.x, saut, p.z, p.dir, 1.0 * G, 1.0 * G, o); break;
          }
          case 'renard': {
            ombre(p.x, p.z, 0.3 * G, 0.3);
            R3.add(M.renard, p.x, bouge ? Math.abs(Math.sin(p.ph)) * 0.05 : 0, p.z, p.dir, 1.15 * G, 1.15 * G, o); break;
          }
          case 'herisson': {
            ombre(p.x, p.z, 0.22 * G, 0.15);
            o.roll = bouge ? Math.sin(p.ph * 1.6) * 0.08 : 0;
            R3.add(M.herisson, p.x, 0, p.z, p.dir, 1.15 * G, 1.15 * G, o); break;
          }
          case 'merle': case 'alouette': {
            const jeu = M[a.esp];
            // Vol quand il se déplace vite ; l'alouette monte aussi chanter au-dessus de son territoire.
            const chante = a.esp === 'alouette' && !bouge && a.m === 'vit' && ((temps + a.id * 7.3) % 24) < 7;
            const vole = p.vit > 0.9 || chante || a.m === 'arrive' || a.m === 'part';
            const cible = chante ? 2.6 + Math.sin(temps * 1.5) * 0.25 : vole ? (a.esp === 'alouette' ? 1.4 : 0.9) : 0;
            p.haut += (cible - p.haut) * Math.min(1, dt * 2.5);
            const bat = Math.floor(temps * (chante ? 14 : 9) + a.id) % 2;
            const mesh = p.haut > 0.15 ? (bat ? jeu.haut : jeu.bas) : jeu.pose;
            ombre(p.x, p.z, 0.16, 0.1 + p.haut * 0.3);
            const sautille = !vole && bouge ? Math.abs(Math.sin(p.ph * 1.4)) * 0.06 : 0;
            R3.add(mesh, p.x, p.haut + sautille, p.z, p.dir, 1.25 * G, 1.25 * G, o); break;
          }
          default: R3.add(M.froisse, p.x, 0, p.z, 0, 1, 1, o);
        }
      }
      if (image % 120 === 0) for (const id in lisses) if (lisses[id].vu < image - 60) delete lisses[id];
      return zzz;
    }

    // ---------- Populations (nuées, petites bêtes) ----------
    const NZ = Math.ceil(N / Core.P.tailleZone), TZ = Core.P.tailleZone;
    const cachePlaces = {};
    function places(etat, id, z, couverts) {
      const cle = id + ':' + z + ':' + Math.floor(etat.temps / 10);
      if (cachePlaces[cle]) return cachePlaces[cle];
      const zx = (z % NZ) * TZ, zy = Math.floor(z / NZ) * TZ, l = [], toutes = [];
      for (let y = zy; y < zy + TZ; y++) for (let x = zx; x < zx + TZ; x++) {
        if (!Core.dansIle(etat, x, y)) continue;
        const t = etat.tuiles[y * N + x];
        if (t.c === 'eau') continue;
        toutes.push([x - C, y - C]);
        if (couverts.includes(t.c)) l.push([x - C, y - C]);
      }
      return (cachePlaces[cle] = l.length ? l : toutes);
    }
    function dessinerPopulations(etat, A, rares) {
      const jour = A.nuit < 0.5, hiver = A.saison === 'hiver';
      for (const id in etat.populations) {
        const f = data.especes[id];
        if (!f) continue;
        const zones = etat.populations[id];
        for (const zs in zones) {
          const n = zones[zs], z = +zs;
          if (!(n > 0)) continue;
          const papierZone = rares.zone[id + ':' + z] || '';
          if (id === 'ver') {
            const pl = places(etat, id, z, ['herbe', 'fleurs']);
            const k = Math.min(4, 1 + Math.floor(n / 8));
            for (let s = 0; s < k; s++) {
              const q = pl[Math.floor(hash(z * 13 + s, 3) * pl.length) % pl.length];
              const px = q[0] + (hash(z, s + 5) - 0.5) * 0.7, pz = q[1] + (hash(z, s + 9) - 0.5) * 0.7;
              R3.add(M.turricule, px + 0.15, 0, pz - 0.1, s, 1.2);
              // Le ver sort de terre puis rentre (on le voit moins quand le sol est sec ou gelé).
              const ph = (temps * 0.18 + hash(z, s)) % 1, dehors = hiver || A.meteo === 'secheresse' ? 0.15 : 0.4;
              if (ph < dehors) {
                const hy = Math.sin(Math.PI * ph / dehors);
                R3.add(M.ver[Math.floor(temps * 2 + s) % 2], px, 0, pz, hash(z, s + 2) * 6, 1.4 * api.grossir, 1.4 * hy * api.grossir, s === 0 && papierZone ? { papier: papierZone } : undefined);
                cibles.push({ k: 'pop', esp: id, zone: z, papier: s === 0 ? papierZone : '', x: px, y: 0.15, z: pz });
              }
            }
            continue;
          }
          const dort = (f.hiver !== 'actif' && hiver) || (f.activite === 'jour' && !jour) || (id !== 'sauterelle' && A.orage > 0.9);
          if (dort) continue;
          if (id === 'sauterelle') {
            const pl = places(etat, id, z, ['herbe']), k = Math.min(2, 1 + Math.floor(n / 12));
            for (let s = 0; s < k; s++) {
              // Bonds d'une touffe à l'autre.
              const per = 2.2 + hash(z, s) * 1.6, tt = temps / per + hash(z * 7, s), cyc = Math.floor(tt), ph = tt - cyc;
              const P0 = pl[Math.floor(hash(cyc, z * 5 + s) * pl.length)], P1 = pl[Math.floor(hash(cyc + 1, z * 5 + s) * pl.length)];
              const a0 = [P0[0] + (hash(cyc, s) - 0.5) * 0.8, P0[1] + (hash(cyc, s + 3) - 0.5) * 0.8], a1 = [P1[0] + (hash(cyc + 1, s) - 0.5) * 0.8, P1[1] + (hash(cyc + 1, s + 3) - 0.5) * 0.8];
              const sautT = ph > 0.8 ? (ph - 0.8) / 0.2 : 0;
              const px = a0[0] + (a1[0] - a0[0]) * sautT, pz = a0[1] + (a1[1] - a0[1]) * sautT;
              const dir = Math.atan2(a1[0] - a0[0], a1[1] - a0[1]);
              R3.add(sautT > 0 ? M.sauterelle.saut : M.sauterelle.pose, px, Math.sin(Math.PI * sautT) * 0.45, pz, dir, 1.1 * api.grossir, 1.1 * api.grossir, s === 0 && papierZone ? { papier: papierZone } : undefined);
              cibles.push({ k: 'pop', esp: id, zone: z, papier: s === 0 ? papierZone : '', x: px, y: Math.sin(Math.PI * sautT) * 0.45 + 0.1, z: pz });
            }
          } else if (id === 'abeille' || id === 'tircis') {
            const pl = places(etat, id, z, ['fleurs']), k = Math.min(id === 'abeille' ? 5 : 3, 1 + Math.floor(n / (id === 'abeille' ? 6 : 5)));
            for (let s = 0; s < k; s++) {
              // Va d'une fleur à l'autre en boucles ; plane un instant sur chaque fleur.
              const per = id === 'abeille' ? 3 : 5, tt = temps / per + hash(z * 3, s + 1), cyc = Math.floor(tt), ph = tt - cyc;
              const P0 = pl[Math.floor(hash(cyc, z * 11 + s) * pl.length)], P1 = pl[Math.floor(hash(cyc + 1, z * 11 + s) * pl.length)];
              const vol = lisse(0.35, 1, ph);
              const bx = P0[0] + (P1[0] - P0[0]) * vol, bz = P0[1] + (P1[1] - P0[1]) * vol;
              const boucle = Math.sin(ph * Math.PI) * 0.5;
              const px = bx + Math.cos(temps * 3 + s) * boucle * 0.6, pz = bz + Math.sin(temps * 2.3 + s) * boucle * 0.6;
              const py = (id === 'abeille' ? 0.45 : 0.6) + Math.sin(ph * Math.PI) * (id === 'abeille' ? 0.35 : 0.7) + Math.sin(temps * 5 + s) * 0.03;
              const dir = Math.atan2(P1[0] - P0[0], P1[1] - P0[1]) + Math.sin(temps * 2 + s) * 0.6;
              const o = s === 0 && papierZone ? { papier: papierZone } : undefined;
              if (id === 'abeille') R3.add(Math.floor(temps * 30 + s) % 2 ? M.abeille.haut : M.abeille.bas, px, py, pz, dir, 1.5 * api.grossir, 1.5 * api.grossir, o);
              else R3.add(M.tircis[Math.floor(temps * (ph < 0.35 ? 4 : 9) + s) % 3], px, py, pz, dir, 1.6 * api.grossir, 1.6 * api.grossir, o);
              cibles.push({ k: 'pop', esp: id, zone: z, papier: s === 0 ? papierZone : '', x: px, y: py, z: pz });
            }
          }
        }
      }
    }

    // ---------- Garde forestière ----------
    function dessinerGarde(etat, A, dt) {
      const T = terrain, cb = T.cabane;
      R3.add(T.promontoire, cb.x, 0, cb.z, 0, 1);
      R3.add(M.cabane, cb.x, 0, cb.z, cb.dir + Math.PI, 1);
      // Odile fait le tour de sa cabane, s'arrête et observe l'animal le plus proche aux jumelles.
      odile.pause -= dt;
      if (odile.pause <= 0) {
        if (odile.jumelles || Math.random() < 0.5) { odile.jumelles = false; odile.a += 0.9 + Math.random() * 1.2; odile.pause = 3 + Math.random() * 3; }
        else { odile.jumelles = true; odile.pause = 3 + Math.random() * 2; }
      }
      const cx = cb.x + Math.cos(odile.a) * 0.75, cz = cb.z + Math.sin(odile.a) * 0.75;
      const vx = cx - odile.x, vz = cz - odile.z, d = Math.hypot(vx, vz);
      let bouge = false;
      if (!odile.jumelles && d > 0.03) { const v = Math.min(d, dt * 0.35); odile.x += vx / d * v; odile.z += vz / d * v; odile.dir = lerpAngle(odile.dir, Math.atan2(vx, vz), Math.min(1, dt * 5)); bouge = true; }
      if (odile.jumelles) {
        let best = null, bd = 1e9;
        for (const a of etat.agents) { const p = lisses[a.id]; if (!p) continue; const dd = Math.hypot(p.x - odile.x, p.z - odile.z); if (dd < bd) { bd = dd; best = p; } }
        const vise = best ? Math.atan2(best.x - odile.x, best.z - odile.z) : Math.atan2(-odile.x, -odile.z);
        odile.dir = lerpAngle(odile.dir, vise, Math.min(1, dt * 4));
      }
      ombre(odile.x, odile.z, 0.14, 0.2);
      R3.add(odile.jumelles ? M.odileJumelles : M.odile, odile.x, bouge ? Math.abs(Math.sin(temps * 8)) * 0.025 : 0, odile.z, odile.dir, 1.2);
      cibles.push({ k: 'garde', x: cb.x, y: 0.6, z: cb.z, r: 1.3 }, { k: 'garde', x: odile.x, y: 0.4, z: odile.z });
    }

    // ---------- Météo et particules ----------
    function ciel(w, h, A) {
      const jour = [[202, 222, 224], [240, 232, 214]], nuitC = [[38, 48, 82], [76, 78, 108]], orageC = [[120, 128, 140], [168, 166, 160]], crepC = [[236, 186, 160], [246, 218, 188]];
      const m = (a, b, t) => [mel(a[0], b[0], t), mel(a[1], b[1], t)];
      let c = m(jour, crepC, Math.min(1, A.crep));
      c = m(c, nuitC, A.nuit);
      c = m(c, orageC, A.orage * 0.75);
      if (A.meteo === 'secheresse') c = m(c, [[236, 214, 170], [246, 228, 190]], 0.5);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const s = v => 'rgb(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ')';
      g.addColorStop(0, s(c[0])); g.addColorStop(1, s(c[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // Sprint 6 : grain de papier et halo doux au centre (le plateau ressort du fond).
      const v = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.2, w / 2, h * 0.55, Math.max(w, h) * 0.75);
      v.addColorStop(0, 'rgba(255,252,242,0.35)'); v.addColorStop(1, 'rgba(90,70,45,0.12)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
      if (typeof document !== 'undefined') {
        if (!grain) {
          const gc = document.createElement('canvas'); gc.width = gc.height = 96;
          const gx = gc.getContext('2d');
          for (let k = 0; k < 900; k++) { gx.fillStyle = k % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(80,60,40,0.05)'; gx.fillRect(hash(k, 1) * 96, hash(k, 2) * 96, 1 + hash(k, 3) * 1.5, 1); }
          grain = ctx.createPattern(gc, 'repeat');
        }
        ctx.fillStyle = grain; ctx.fillRect(0, 0, w, h);
      }
    }
    let grain = null;
    function emettre(etat, A, dt) {
      const Re = terrain.Re;
      const ajouter = (n, f) => { for (let k = 0; k < n; k++) particules.push(f()); };
      const auHasard = r => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; return [Math.cos(a) * d, Math.sin(a) * d]; };
      if (A.meteo === 'orage') ajouter(Math.round(dt * 260), () => { const p = auHasard(Re + 1); return { t: 'pluie', x: p[0], y: 7, z: p[1], vy: -14, vie: 1 }; });
      if (A.saison === 'hiver' && A.meteo !== 'orage') ajouter(Math.random() < dt * 22 ? 1 : 0, () => { const p = auHasard(Re + 1); return { t: 'neige', x: p[0], y: 6, z: p[1], vy: -0.7, vie: 12, ph: Math.random() * 6 }; });
      if (A.meteo === 'floraison') ajouter(Math.random() < dt * 6 ? 1 : 0, () => { const p = auHasard(Re); return { t: 'petale', x: p[0], y: 2.5, z: p[1], vy: -0.35, vie: 9, ph: Math.random() * 6, c: Math.random() < 0.5 ? '#f3c6d3' : '#fbf6ee' }; });
      if (A.saison === 'automne' && Math.random() < dt * 3) {
        const arbres = [];
        for (const i of Core.tuilesIle(etat)) if (etat.tuiles[i].c === 'arbre' && etat.tuiles[i].age > 3) arbres.push(i);
        if (arbres.length) { const i = arbres[(Math.random() * arbres.length) | 0]; particules.push({ t: 'feuille', x: (i % N) - C + (Math.random() - 0.5), y: 1.8, z: ((i / N) | 0) - C + (Math.random() - 0.5), vy: -0.3, vie: 7, ph: Math.random() * 6, c: Math.random() < 0.5 ? '#e0b53a' : '#cf8f2f' }); }
      }
      if (particules.length > 900) particules.splice(0, particules.length - 900);
    }
    function dessinerParticules(dt) {
      const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
      ctx.lineCap = 'round';
      for (let k = particules.length - 1; k >= 0; k--) {
        const p = particules[k];
        p.vie -= dt; p.y += p.vy * dt;
        if (p.t !== 'pluie') { p.x += Math.sin(temps * 1.3 + p.ph) * dt * 0.3; p.z += Math.cos(temps + p.ph) * dt * 0.2; }
        if (p.vie <= 0 || p.y < 0) {
          if (p.t === 'pluie' && Math.random() < 0.15) effets.push({ t: 'goutte', x: p.x, z: p.z, age: 0 });
          particules.splice(k, 1); continue;
        }
        cam.project(p.x, p.y, p.z, tmp);
        if (p.t === 'pluie') {
          cam.project(p.x + 0.05, p.y + 0.35, p.z, tmp2);
          ctx.strokeStyle = 'rgba(214,224,238,0.55)'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(tmp[0], tmp[1]); ctx.lineTo(tmp2[0], tmp2[1]); ctx.stroke();
        } else {
          const s = (p.t === 'neige' ? 3.2 : 4.2) * 26 / tmp[2];
          ctx.save(); ctx.translate(tmp[0], tmp[1]); ctx.rotate(temps * 2 + p.ph);
          ctx.fillStyle = p.t === 'neige' ? 'rgba(255,255,255,0.9)' : p.c;
          ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(0, -s * 0.6); ctx.lineTo(s, 0); ctx.lineTo(0, s * 0.6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }
    // Sprint 8a : en WebGL, pluie, neige, pétales et feuilles sont de petites cartes de papier dans la scène 3D
    // (cachées par les arbres et la cabane), tournées vers la caméra.
    const PART = (function () {
      const lo = new E.Builder();
      lo.face([lo.vert(-1, 0, 0), lo.vert(0, 0.6, 0), lo.vert(1, 0, 0), lo.vert(0, -0.6, 0)], [255, 255, 255], true, true);
      const tr = new E.Builder();
      tr.face([tr.vert(-0.012, 0, 0), tr.vert(0.012, 0, 0), tr.vert(0.062, 0.35, 0), tr.vert(0.038, 0.35, 0)], [255, 255, 255], true, true);
      return { losange: lo.build(), trait: tr.build() };
    })();
    const PLUIE = [214, 224, 238], BLANC = [255, 255, 255], COUL = {};
    function particulesGL(dt) {
      for (let k = particules.length - 1; k >= 0; k--) {
        const p = particules[k];
        p.vie -= dt; p.y += p.vy * dt;
        if (p.t !== 'pluie') { p.x += Math.sin(temps * 1.3 + p.ph) * dt * 0.3; p.z += Math.cos(temps + p.ph) * dt * 0.2; }
        if (p.vie <= 0 || p.y < 0) {
          if (p.t === 'pluie' && Math.random() < 0.15) effets.push({ t: 'goutte', x: p.x, z: p.z, age: 0 });
          particules.splice(k, 1); continue;
        }
        if (p.t === 'pluie') R3.add(PART.trait, p.x, p.y, p.z, cam.yaw, 1, 1, { couleur: PLUIE, alpha: 0.6, ombre: false });
        else {
          const c = p.t === 'neige' ? BLANC : (COUL[p.c] || (COUL[p.c] = E.hex(p.c)));
          const s = p.t === 'neige' ? 0.07 : 0.095;
          R3.add(PART.losange, p.x, p.y, p.z, cam.yaw, s, s, { couleur: c, roll: temps * 2 + p.ph, ombre: false });
        }
      }
    }
    function nuages(A) {
      if (A.orage <= 0) return;
      // Nuages au fond de la scène (côté opposé à la caméra), pour ne pas cacher l'île.
      const Re = terrain.Re, n = A.meteo === 'orage' ? 5 : 3, fondA = Math.atan2(-Math.cos(cam.yaw), -Math.sin(cam.yaw));
      for (let k = 0; k < n; k++) {
        const a = fondA + (k - (n - 1) / 2) * 0.42 + Math.sin(temps * 0.05 + k) * 0.08, r = Re + 1.5 + (k % 2) * 1.5;
        R3.add((A.meteo === 'orage' ? M.nuageOrage : M.nuage)[k % 2], Math.cos(a) * r, 4.2 + (k % 3) * 0.7, Math.sin(a) * r, a, 1.5 + (k % 3) * 0.25, 1.4, { biais: 1000, ombre: false });
      }
    }

    // ---------- Effets venus du journal ----------
    function lireJournal(etat) {
      const J = etat.journal;
      if (dernierJournal < 0) { dernierJournal = etat.temps; return; }
      for (const j of J) {
        if (j.t <= dernierJournal) continue;
        const x = j.x !== undefined ? j.x - C : null, z = j.y !== undefined ? j.y - C : null;
        if (j.type === 'foudre') { eclair = 0.5; eclairCible = [x, z]; effets.push({ t: 'anneau', x, z, age: 0, r: 1.4, c: '255,236,170' }); }
        else if (j.type === 'predation' && x !== null) effets.push({ t: 'froisse', x, z, age: 0 });
        else if ((j.type === 'arrivee' || j.type === 'renfort') && x !== null) effets.push({ t: 'anneau', x, z, age: 0, r: 0.8, c: '255,248,221' });
        else if (j.type === 'naissance' && x !== null) effets.push({ t: 'anneau', x, z, age: 0, r: 0.5, c: '255,224,236' });
        else if (j.type === 'rare' && x !== null) effets.push({ t: 'anneau', x, z, age: 0, r: 1.1, c: '255,214,120' });
      }
      dernierJournal = etat.temps;
    }
    function dessinerEffetsSol(dt) {
      for (let k = effets.length - 1; k >= 0; k--) {
        const e = effets[k]; e.age += dt;
        if (e.t === 'anneau') {
          if (e.age > 0.9) { effets.splice(k, 1); continue; }
          const q = e.age / 0.9;
          R3.ellipse(e.x, e.z, e.r * (0.5 + q), e.r * (0.5 + q), null, 'rgba(' + e.c + ',' + (1 - q).toFixed(2) + ')', 3, 24);
        } else if (e.t === 'goutte') {
          if (e.age > 0.35) { effets.splice(k, 1); continue; }
          const q = e.age / 0.35;
          R3.ellipse(e.x, e.z, 0.05 + q * 0.12, 0.05 + q * 0.12, null, 'rgba(225,235,245,' + (0.8 - q * 0.8).toFixed(2) + ')', 1, 8);
        }
      }
    }
    function dessinerEffetsObjets() {
      for (const e of effets) if (e.t === 'froisse') {
        // Prédation stylisée : la proie devient une boule de papier froissé qui rétrécit et s'envole (GDD 1.1).
        if (e.age > 1.6) { e.fini = true; continue; }
        const q = e.age / 1.6, s = (1 - q) * 1.3;
        R3.add(M.froisse, e.x, q * 0.6, e.z, e.age * 6, s, s, { alpha: 1 - q * 0.6 });
      }
      for (let k = effets.length - 1; k >= 0; k--) if (effets[k].fini) effets.splice(k, 1);
    }
    function etincelles(liste) {
      // Petite étoile dorée au-dessus d'un spécimen rare : récompense l'œil attentif.
      const tmp = [0, 0, 0];
      for (const p of liste) {
        cam.project(p.x, p.y, p.z, tmp);
        const s = (5 + Math.sin(temps * 4 + p.x) * 1.5) * 22 / tmp[2] * 1.2;
        ctx.save(); ctx.translate(tmp[0], tmp[1]); ctx.rotate(temps);
        ctx.fillStyle = p.papier === 'washi' ? 'rgba(244,170,190,0.95)' : 'rgba(255,226,140,0.95)';
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.35 : s, a = k / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    function dessinerZzz(liste) {
      const tmp = [0, 0, 0];
      ctx.textAlign = 'center';
      for (const p of liste) {
        for (let k = 0; k < 3; k++) {
          const q = ((temps * 0.5 + k / 3) % 1);
          cam.project(p.x + q * 0.3, 0.6 + q * 0.7, p.z, tmp);
          ctx.font = '600 ' + Math.round((10 + q * 8) * 26 / tmp[2]) + 'px Georgia, serif';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(250,246,236,' + (0.9 * (1 - q)).toFixed(2) + ')';
          ctx.strokeText('z', tmp[0], tmp[1]);
          ctx.fillStyle = 'rgba(74,60,48,' + (1 - q).toFixed(2) + ')';
          ctx.fillText('z', tmp[0], tmp[1]);
        }
      }
    }
    function dessinerEclair(w, h, A, dt) {
      if (A.meteo === 'orage' && A.decalH) {
        // Météo forcée dans la vitrine : éclairs de temps en temps, sans foudre sur les arbres.
        prochainEclair -= dt;
        if (prochainEclair <= 0) { eclair = 0.35; eclairCible = [(Math.random() - 0.5) * terrain.Re, (Math.random() - 0.5) * terrain.Re]; prochainEclair = 5 + Math.random() * 7; }
      }
      if (eclair <= 0) return;
      eclair -= dt;
      ctx.fillStyle = 'rgba(255,252,240,' + Math.max(0, eclair * 0.9).toFixed(2) + ')';
      ctx.fillRect(0, 0, w, h);
      if (eclairCible && eclair > 0.15) {
        const tmp = [0, 0, 0];
        cam.project(eclairCible[0], 0.8, eclairCible[1], tmp);
        let x = tmp[0] + 40, y = 0;
        ctx.strokeStyle = 'rgba(255,250,220,0.95)'; ctx.lineWidth = 3; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(x, y);
        const n = 7;
        for (let k = 1; k <= n; k++) { x = tmp[0] + 40 * (1 - k / n) + (k < n ? (hash(k, Math.floor(eclair * 10)) - 0.5) * 50 : 0); y = tmp[1] * k / n; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    function brumeChaude(w, h) {
      const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
      g.addColorStop(0, 'rgba(255,214,150,0)'); g.addColorStop(1, 'rgba(255,200,130,0.18)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }

    // ---------- Spécimens rares ----------
    function indexRares(etat) {
      const r = { agent: {}, zone: {}, tuile: {}, liste: [] };
      for (const s of Core.raresPresents(etat, data)) {
        if (s.agent !== undefined) r.agent[s.agent] = s.papier;
        else if (s.zone !== undefined) r.zone[s.id + ':' + s.zone] = s.papier;
        else r.tuile[s.tuile] = s.papier;
        r.liste.push(s);
      }
      return r;
    }
    function positionsRares(etat, rares) {
      const l = [];
      for (const s of rares.liste) {
        if (s.agent !== undefined) { const p = lisses[s.agent]; if (p) l.push({ x: p.x, y: 1.0 + (p.haut || 0), z: p.z, papier: s.papier }); }
        else if (s.x !== undefined) l.push({ x: s.x - C, y: s.zone !== undefined ? 1.4 : (etat.tuiles[s.tuile] && etat.tuiles[s.tuile].c === 'arbre' ? 2.6 : 1.0), z: s.y - C, papier: s.papier });
      }
      return l;
    }

    // ---------- Fond (ciel, tranche, sol, décors plats) ----------
    let fond = null, fondCle = '', fondAge = 0;
    function dessinerFond(etat, A, liste, w, h) {
      ciel(w, h, A);
      R3.begin(); R3.add(terrain.jupe, 0, 0, 0, 0, 1); R3.flush();
      dessinerTerrain(etat, A);
      decors(etat, A, liste);
      // Herbe et fleurs : basses, immobiles, très nombreuses ; dessinées une fois dans le fond.
      R3.begin(); objetsTuiles(etat, A, liste, indexRares(etat), 'bas'); R3.flush();
    }

    // Décalques posés sur le sol : effets, graines au sol, carte des habitats, renard éloigné, guide, survol.
    function decalques(etat, opts, liste, dt) {
      dessinerEffetsSol(dt);
      // Sprint 7 : graines laissées au sol pour les oiseaux (petits grains dorés).
      for (const i of liste) {
        const t = etat.tuiles[i];
        if (!(t.mg > 0)) continue;
        const x = (i % N) - C, z = ((i / N) | 0) - C;
        for (let k = 0; k < 7; k++) { const a = k * 2.4, r = 0.12 + (k % 3) * 0.1, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; R3.groundPoly([px - 0.05, pz, px, pz - 0.035, px + 0.05, pz, px, pz + 0.035], k % 2 ? '#d9b867' : '#b88b53', null, 0, 0.04); }
      }
      // Sprint 7 : carte des habitats quand un aménagement est choisi (vert : la pose y sert beaucoup, jaune : un peu, gris : peu).
      if (opts.carte && opts.carte.length) {
        for (const [i, q] of opts.carte) {
          const x = (i % N) - C, z = ((i / N) | 0) - C;
          const col = q >= 0.66 ? 'rgba(92,168,74,0.38)' : q >= 0.33 ? 'rgba(236,188,60,0.34)' : 'rgba(120,108,96,0.2)';
          R3.groundPoly([x - 0.47, z - 0.47, x + 0.47, z - 0.47, x + 0.47, z + 0.47, x - 0.47, z + 0.47], col, null, 0, 0.035);
        }
      }
      // Sprint 7 : coin où le renard a été éloigné (cercle pointillé tant que dure l'effet).
      if (opts.effroi) {
        const pts = [], r = opts.effroi.r;
        for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; pts.push(opts.effroi.x - C + Math.cos(a) * r, opts.effroi.y - C + Math.sin(a) * r); }
        R3.groundPoly(pts, 'rgba(240,160,80,0.08)', 'rgba(200,110,50,0.55)', 1.5, 0.05);
      }
      if (opts.guides && opts.guides.length) {
        // Tuiles conseillées par le tutoriel (sprint 6) : contour doré qui respire.
        const al = 0.7 + 0.3 * Math.sin(temps * 4);
        for (const i of opts.guides) {
          const x = (i % N) - C, z = ((i / N) | 0) - C;
          R3.groundPoly([x - 0.44, z - 0.44, x + 0.44, z - 0.44, x + 0.44, z + 0.44, x - 0.44, z + 0.44], 'rgba(255,226,120,' + (al * 0.5).toFixed(2) + ')', 'rgba(232,166,30,' + al.toFixed(2) + ')', 3, 0.06);
        }
      }
      if (opts.survol && Core.dansIle(etat, opts.survol.x, opts.survol.y)) {
        // taille : 2 pour la mare (2×2) ; refus : contour rouge (la pose ne marcherait pas ici).
        const x = opts.survol.x - C, z = opts.survol.y - C, k = (opts.survol.taille || 1) - 0.5;
        const ok = !opts.survol.refus, c1 = ok ? 'rgba(255,248,221,0.18)' : 'rgba(200,70,50,0.16)', c2 = ok ? 'rgba(255,248,221,0.95)' : 'rgba(205,80,60,0.95)';
        R3.groundPoly([x - 0.5, z - 0.5, x + k, z - 0.5, x + k, z + k, x - 0.5, z + k], c1, c2, 2, 0.04);
      }
    }

    // ---------- Image (WebGL, sprint 8a) ----------
    // Tout est redessiné à chaque image par la carte graphique : plus de fond mis en cache.
    function dessinerGL(etat, dt, opts) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, api.dprMax);
      GL.redimensionner(w, h, dpr);
      cam.update(w, h);
      if (!terrain || terrain.sig !== signatureEau(etat)) construireTerrain(etat);
      const A = ambiance(etat, opts);
      R3.teinte = teinte(A);
      GL.reglerSoleil(A.t);
      lireJournal(etat);
      cibles = [];
      const liste = Core.tuilesIle(etat), rares = indexRares(etat);
      GL.preparerCalques();
      ctx = GL.fondCtx; ciel(w, h, A); ctx = ctxPrincipal;
      R3.begin();
      R3.add(terrain.jupe, 0, 0, 0, 0, 1, 1, { ombre: false });
      colorerSolGL(etat, A);
      decors(etat, A, liste);
      // Herbe et fleurs : reçoivent les ombres sans en projeter (trop petites, et 1 500 touffes).
      GL.sansOmbre = true; objetsTuiles(etat, A, liste, rares, 'bas'); GL.sansOmbre = false;
      decalques(etat, opts, liste, dt);
      objetsTuiles(etat, A, liste, rares, 'haut');
      const zzz = dessinerAgents(etat, A, dt, rares);
      dessinerPopulations(etat, A, rares);
      if (!opts.sansGarde) dessinerGarde(etat, A, dt);
      dessinerEffetsObjets();
      nuages(A);
      emettre(etat, A, dt);
      particulesGL(dt);
      R3.flush();
      // Par-dessus (calque 2D) : étincelles des rares, ronflements, brume, éclair.
      etincelles(positionsRares(etat, rares));
      dessinerZzz(zzz);
      if (A.meteo === 'secheresse') brumeChaude(w, h);
      dessinerEclair(w, h, A, dt);
      return { polygones: GL.triangles(), ambiance: { saison: A.saison, meteo: A.meteo, nuit: A.nuit } };
    }

    // ---------- Image ----------
    // opts : { saison, moment, meteo ('auto' ou forcé), survol: {x, y} tuile survolée, sansGarde }
    function dessiner(etat, dt, opts) {
      opts = opts || {};
      dt = Math.max(0, Math.min(0.1, dt || 0));
      image++; temps += dt;
      if (GL) return dessinerGL(etat, dt, opts);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, api.dprMax);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cam.update(w, h);
      if (!terrain || terrain.sig !== signatureEau(etat)) construireTerrain(etat);
      const A = ambiance(etat, opts);
      R3.teinte = teinte(A);
      R3.aretes = cam.dist < 22;
      lireJournal(etat);
      cibles = [];
      const liste = Core.tuilesIle(etat), rares = indexRares(etat);

      // 1. Ciel, tranche de l'îlot, sol plié, décors plats et ombres fixes : « fond » mis en cache
      // tant que la caméra ne bouge pas (rafraîchi toutes les 1,5 s pour l'eau, la lumière, l'humidité).
      fondAge += dt;
      const cle = [cam.yaw, cam.pitch, cam.dist, cam.tx, cam.tz, canvas.width, canvas.height, terrain.sig].join(',');
      if (opts.sansCache || typeof document === 'undefined') dessinerFond(etat, A, liste, w, h);
      else {
        if (!fond) fond = document.createElement('canvas');
        if (cle !== fondCle || fondAge >= 1.5) {
          if (fond.width !== canvas.width || fond.height !== canvas.height) { fond.width = canvas.width; fond.height = canvas.height; }
          const fc = fond.getContext('2d');
          fc.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx = R3.ctx = fc;
          dessinerFond(etat, A, liste, w, h);
          ctx = R3.ctx = ctxPrincipal;
          fondCle = cle; fondAge = 0;
        }
        ctx.drawImage(fond, 0, 0, w, h);
      }
      decalques(etat, opts, liste, dt);
      // 4. Objets triés par profondeur.
      R3.begin();
      objetsTuiles(etat, A, liste, rares, 'haut');
      const zzz = dessinerAgents(etat, A, dt, rares);
      dessinerPopulations(etat, A, rares);
      if (!opts.sansGarde) dessinerGarde(etat, A, dt);
      dessinerEffetsObjets();
      nuages(A);
      const n = R3.flush();
      // 5. Par-dessus : particules, étincelles des rares, ronflements, éclairs, brume.
      emettre(etat, A, dt);
      dessinerParticules(dt);
      etincelles(positionsRares(etat, rares));
      dessinerZzz(zzz);
      if (A.meteo === 'secheresse') brumeChaude(w, h);
      dessinerEclair(w, h, A, dt);
      return { polygones: n + terrain.tris.length, ambiance: { saison: A.saison, meteo: A.meteo, nuit: A.nuit } };
    }

    // Tuile sous un point de l'écran (pour le survol et, au sprint 5, les actions).
    function tuileSous(sx, sy) {
      const p = cam.groundAt(sx, sy, 0);
      if (!p) return null;
      return { x: Math.round(p.x + C), y: Math.round(p.z + C) };
    }
    // Sprint 6 : caméra plus proche (on voit les animaux) ; le joueur se déplace en glissant.
    function cadrer(etat) {
      const Re = Math.sqrt(etat.rayon * etat.rayon + etat.rayon), asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      const portrait = asp < 0.8;
      // Retours 4 : l'île est centrée dans l'espace libre entre la barre du haut et celle du bas (plus derrière le menu).
      cam.dist = Math.max(9, Math.min(40, Re * (portrait ? 1.9 : 1.7)));
      cam.pitch = penteAuto(cam.dist) + (portrait ? 0.12 : 0);
      cam.tx = 0; cam.tz = 0;
      cam.decalY = portrait ? -0.07 : -0.04;
    }
    // Inclinaison qui suit le zoom : de près, vue rasante (on voit les animaux de face) ; de loin, vue plus plongeante (l'île tient à l'écran, moins fouillis).
    function penteAuto(d) { const t = Math.max(0, Math.min(1, (d - 7) / 30)); return 0.6 + t * 0.38; }
    // Zoom vers un point de l'écran (molette sur le curseur, pince entre les doigts) : le point du sol visé reste sous le curseur.
    function zoomer(facteur, sx, sy, etat) {
      cam.update(canvas.clientWidth, canvas.clientHeight);
      const avant = sx !== undefined ? cam.groundAt(sx, sy, 0) : null;
      const ancien = cam.dist;
      cam.dist = Math.max(5, Math.min(45, cam.dist * facteur));
      cam.pitch += penteAuto(cam.dist) - penteAuto(ancien);
      cam.pitch = Math.max(0.4, Math.min(1.35, cam.pitch));
      if (!avant) return;
      cam.update(canvas.clientWidth, canvas.clientHeight);
      const apres = cam.groundAt(sx, sy, 0);
      if (!apres) return;
      cam.tx += avant.x - apres.x; cam.tz += avant.z - apres.z;
      // En reculant au-delà de la vue d'ensemble, l'île revient doucement au centre.
      const Re = etat ? Math.sqrt(etat.rayon * etat.rayon + etat.rayon) : 10;
      if (facteur > 1 && cam.dist > Re * 2) { const k = Math.min(0.5, (cam.dist - Re * 2) / (Re * 2.5)); cam.tx *= 1 - k; cam.tz *= 1 - k; }
      borner(etat);
    }
    function borner(etat) {
      const lim = etat ? Math.sqrt(etat.rayon * etat.rayon + etat.rayon) + 1.5 : 10, d = Math.hypot(cam.tx, cam.tz);
      if (d > lim) { cam.tx *= lim / d; cam.tz *= lim / d; }
    }
    // Déplacement de la caméra en pixels d'écran ; la cible reste au-dessus de l'île.
    function deplacer(dx, dy, etat) {
      if (!cam.focal) return;
      const k = cam.dist / cam.focal, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), sp = Math.max(0.5, Math.sin(cam.pitch));
      cam.tx += -cam.r[0] * dx * k + fx * dy * k / sp;
      cam.tz += -cam.r[2] * dx * k + fz * dy * k / sp;
      borner(etat);
    }

    // Cible cliquable la plus proche d'un point de l'écran (à moins de rayon pixels), ou null.
    function cibleSous(sx, sy, rayon, filtre) {
      rayon = rayon || 26;
      const tmp = [0, 0, 0];
      let best = null, bd = 1e9;
      for (const c of cibles) {
        if (filtre && !filtre(c)) continue;
        cam.project(c.x, c.y, c.z, tmp);
        // Le rayon grandit quand on zoome (objet plus gros à l'écran) ; la cabane a une zone plus large.
        const lim = rayon * (c.r || 1) * Math.max(0.7, Math.min(2, 20 / tmp[2]));
        const d = Math.hypot(tmp[0] - sx, tmp[1] - sy) / lim;
        if (d < 1 && d < bd) { bd = d; best = Object.assign({ sx: tmp[0], sy: tmp[1] }, c); }
      }
      return best;
    }
    // Position à l'écran d'un point du monde exprimé en tuiles (pour les bulles et les effets de l'interface).
    function ecran(tx, ty, hauteur) { const o = cam.project(tx - C, hauteur || 0, ty - C, [0, 0, 0]); return { x: o[0], y: o[1] }; }
    function ecranCabane() { if (!terrain) return null; const o = cam.project(terrain.cabane.x, 1.6, terrain.cabane.z, [0, 0, 0]); return { x: o[0], y: o[1] }; }
    const api = { nom: GL ? 'WebGL' : 'Canvas 2D', webgl: !!GL, dessiner, tuileSous, cadrer, deplacer, zoomer, penteAuto, grossir: 1.35, cibleSous, ecran, ecranCabane, get cibles() { return cibles; }, camera: cam, moteur: R3, modeles: M, dprMax: 2 };
    return api;
  }

  return { creer };
});
