// Biome, la forêt de papier : modèles origami générés par le code (GDD 10.4).
// Sprint 4 : les 9 nouvelles espèces (sauterelle, abeille, ver, alouette, ronce, bouleau, hérisson, merle, tircis),
// les espèces reprises de la v1 aux couleurs des fiches (herbe, fleurs, lapin, renard, coulemelle),
// les aménagements (tas de pierres, mare, hôtel à insectes, tas de bois, nichoir), la roche,
// la garde forestière Odile et sa cabane, et quelques éléments d'effets (nuage, papier froissé, graine).
// Les couleurs viennent du champ « palette » des fiches espèces : données et rendu restent d'accord.
// Les modèles regardent vers +z, le sol est en y = 0, 1 unité = 1 tuile.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./engine.js'));
  else racine.BiomeModels = fabrique(racine.BiomeEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const B = E.Builder, mel = E.melange, hex = E.hex;
  const fonce = (c, k) => { c = hex(c); return [c[0] * k, c[1] * k, c[2] * k]; };

  // Palettes par défaut (les mêmes que les fiches ; utilisées si une fiche manque).
  const PALETTES = {
    herbe: ['#789b4a', '#a2b968', '#d3cc92'], fleurs: ['#f0db77', '#d8a6b6', '#719551'],
    sauterelle: ['#80a653', '#afba71', '#796b46'], abeille: ['#c9a34d', '#4a382a', '#e5d9b9'],
    ver: ['#a96f69', '#cf9b8f', '#73504a'], lapin: ['#a58b6a', '#d6c7a9', '#6c5948'],
    alouette: ['#a18a65', '#d4c5a5', '#66533d'], ronce: ['#527345', '#7d6a48', '#493b50'],
    bouleau: ['#e3dfd0', '#4a453b', '#8aa15a'], herisson: ['#8a6a4f', '#c9b49a', '#3b2e25'],
    merle: ['#34312d', '#c69a42', '#6e5a45'], renard: ['#b86632', '#e1d2af', '#463c32'],
    tircis: ['#69513b', '#d2bd7c', '#99815a'], coulemelle: ['#d8c8a7', '#8a6b4b', '#eee5d2'],
  };

  // ---------------------------------------------------------------- Plantes
  function touffe(c1, c2, variante) {
    const b = new B();
    // Éventail de trois brins de papier, larges à la base et penchés vers l'extérieur (sprint 6 : plus lisibles de loin).
    b.tri([-0.12, 0, 0.02], [0.08, 0, -0.02], [-0.42, 0.78, 0.1], c1, true);
    b.tri([-0.1, 0, 0], [0.1, 0, 0], [0.04, 1.05, -0.04], c2, true);
    b.tri([0, 0, -0.1], [0.02, 0, 0.1], variante ? [0.36, 0.82, -0.3] : [0.34, 0.7, 0.32], c1, true);
    return b.build();
  }
  function fleur(couleur, tige, coeur) {
    const b = new B();
    b.tri([0, 0, 0], [0.02, 0.32, 0], [-0.02, 0.32, 0], tige, true);
    b.tri([0, 0.12, 0], [0.1, 0.2, 0.02], [0.01, 0.16, 0], tige, true); // feuille
    b.pyramid(0, 0, 5, 0.1, 0.3, 0.38, couleur, 0, couleur);
    if (coeur) b.pyramid(0, 0, 4, 0.035, 0.37, 0.41, coeur, 0.4);
    return b.build();
  }

  // Ronce : buisson bas en monticule, tiges arquées qui retombent au sol, folioles ;
  // variantes fleurie (fleurs blanc rosé), mûres (rouges puis noires) et hiver (feuilles rougies).
  // Environ 70 faces : c'est la plante la plus nombreuse en Lisière, elle doit rester légère.
  function ronce(pal, variante, graine) {
    const b = new B();
    let h = graine || 3;
    const rnd = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
    const vert = variante === 'hiver' ? mel(pal[0], '#7a4a40', 0.45) : hex(pal[0]);
    const feuilles = [vert, fonce(vert, 0.84), mel(vert, '#a8c07a', 0.28)];
    b.blob(0, 0.15, 0, 0.4, 0.5, feuilles, graine, 5);
    // Tiges arquées : rubans de papier pliés (deux faces par arche), folioles au bout.
    const tige = mel(pal[1], vert, 0.6);
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2 + rnd() * 0.9, dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.025, pz = dx * 0.025;
      const d = [dx * 0.2, 0.34, dz * 0.2], m = [dx * 0.38, 0.38 + rnd() * 0.06, dz * 0.38], f = [dx * 0.5, 0.08, dz * 0.5];
      b.quad([d[0] - px, d[1], d[2] - pz], [d[0] + px, d[1], d[2] + pz], [m[0] + px, m[1], m[2] + pz], [m[0] - px, m[1], m[2] - pz], tige, true);
      b.tri([m[0] - px, m[1], m[2] - pz], [m[0] + px, m[1], m[2] + pz], f, tige, true);
      const aa = a + (k % 2 ? 0.5 : -0.5);
      b.tri([m[0], m[1] + 0.01, m[2]], [m[0] + Math.cos(aa) * 0.17, m[1] - 0.02, m[2] + Math.sin(aa) * 0.17], [m[0] + Math.cos(a) * 0.1, m[1] + 0.07, m[2] + Math.sin(a) * 0.1], feuilles[k % 3], true);
    }
    // Folioles posées sur le monticule, pour casser la boule.
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
      b.tri([x, 0.24, z], [x + Math.cos(a + 0.5) * 0.2, 0.2, z + Math.sin(a + 0.5) * 0.2], [x + Math.cos(a) * 0.14, 0.33, z + Math.sin(a) * 0.14], feuilles[(k + 2) % 3], true);
    }
    if (variante === 'fleurs' || variante === 'mures') {
      for (let k = 0; k < 6; k++) {
        const a = rnd() * Math.PI * 2, e = 0.25 + rnd() * 0.8;
        const x = Math.cos(a) * Math.cos(e) * 0.42, y = 0.15 + Math.sin(e) * 0.22, z = Math.sin(a) * Math.cos(e) * 0.42;
        if (variante === 'fleurs') {
          // Fleur plate à 5 pétales (une seule face), tournée vers l'extérieur du buisson.
          const ids = [], nx = Math.cos(a), nz = Math.sin(a);
          for (let p = 0; p < 10; p++) { const r = p % 2 ? 0.035 : 0.075, q = p / 10 * Math.PI * 2; ids.push(b.vert(x + nx * 0.02 - nz * Math.cos(q) * r, y + Math.sin(q) * r, z + nz * 0.02 + nx * Math.cos(q) * r)); }
          b.face(ids, '#f7e8ee', true);
        }
        else b.pointe([x * 0.9, y - 0.02, z * 0.9], [x * 1.12, y + 0.06, z * 1.12], 0.05, k % 3 === 2 ? '#c03c45' : pal[2]);
      }
    }
    return b.build();
  }

  // Bouleau : tronc blanc marqué de noir, port léger ; feuillage selon la saison (null = hiver).
  function bouleau(pal, feuillage, graine) {
    const b = new B();
    const blanc = mel(pal[0], '#ffffff', 0.45), noir = hex(pal[1]);
    const ecorce = [blanc, blanc, noir, blanc, mel(blanc, noir, 0.15)];
    // Tronc en 4 tronçons : une face sombre par tronçon, décalée, pour les marques de l'écorce.
    const H = [0, 0.45, 0.9, 1.35, 1.85], R = [0.1, 0.085, 0.07, 0.055, 0.035];
    for (let k = 0; k < 4; k++) b.prism(0, 0, 5, R[k], R[k + 1], H[k], H[k + 1], ecorce.slice(k % 5).concat(ecorce.slice(0, k % 5)), k * 0.15);
    // Branches fines vers le haut.
    const br = mel(noir, '#7a5a4a', 0.5);
    const branches = [[0.9, 0.42, 1.45, 0.2], [1.15, -0.38, 1.7, -0.1], [1.35, 0.1, 1.95, 0.32], [1.05, -0.05, 1.6, -0.36]];
    for (const [y0, x1, y1, z1] of branches) b.baton([0, y0, 0], [x1, y1, z1], 3, 0.02, br);
    if (feuillage) {
      // Couronne étroite, ovale et retombante, en plusieurs boules.
      b.blob(0, 1.62, 0, 0.5, 1.2, feuillage, graine, 6);
      b.blob(0.3, 1.32, 0.12, 0.3, 1.1, feuillage, graine + 3, 5);
      b.blob(-0.24, 1.95, -0.08, 0.3, 1.05, feuillage, graine + 9, 5);
    } else {
      // Hiver : brindilles sombres et chatons.
      for (const [y0, x1, y1, z1] of branches) {
        b.tri([x1, y1, z1], [x1 * 1.3, y1 + 0.25, z1 + 0.05], [x1 * 1.1, y1 + 0.05, z1 - 0.05], br, true);
        b.tri([x1, y1, z1], [x1 * 1.25, y1 - 0.2, z1 * 1.4], [x1 * 1.05, y1 - 0.05, z1 * 1.1], br, true);
      }
    }
    return b.build();
  }

  // Jeune chêne (teaser de la Jeune forêt, sprint 5 bis) : tige brune, bouquets de feuilles lobées, gland au pied.
  // En hiver, il garde ses feuilles sèches et brunes (marcescence, vraie chez les jeunes chênes). Environ 30 faces.
  function jeuneChene(saison) {
    const b = new B();
    const brun = '#7a5a3c', ecorce = mel('#7a5a3c', '#4a3a2a', 0.3);
    const vert = saison === 'hiver' ? hex('#9a6a3a') : saison === 'automne' ? hex('#c08a34') : saison === 'printemps' ? mel('#5f8a3c', '#b8d77a', 0.35) : hex('#4f7a34');
    const verts = [vert, fonce(vert, 0.82), mel(vert, saison === 'hiver' ? '#c49a6a' : '#a8c07a', 0.25)];
    b.baton([0, 0, 0], [0.02, 0.52, 0.01], 3, 0.022, [brun, ecorce]);
    b.baton([0.01, 0.26, 0], [0.15, 0.4, 0.05], 3, 0.012, ecorce);
    b.baton([0.015, 0.34, 0], [-0.13, 0.46, -0.06], 3, 0.012, ecorce);
    // Feuille lobée : contour en zigzag (lobes arrondis du chêne), à moitié dressée pour se voir de côté.
    const feuille = (o, ang, L, couleur, dresse) => {
      const d = [Math.cos(ang) * 0.8, 0.6, Math.sin(ang) * 0.8];
      const k = dresse === undefined ? 0.6 : dresse, pp = [-Math.sin(ang) * (1 - k * 0.5), k, Math.cos(ang) * (1 - k * 0.5)];
      const prof = [[0, 0], [0.16, 0.2], [0.3, 0.12], [0.45, 0.3], [0.6, 0.15], [0.76, 0.27], [0.9, 0.12], [1, 0]];
      const pt = (u, v) => b.vert(o[0] + d[0] * u * L + pp[0] * v * L, o[1] + d[1] * u * L + pp[1] * v * L, o[2] + d[2] * u * L + pp[2] * v * L);
      const ids = prof.map(([u, v]) => pt(u, v)).concat(prof.slice(1, -1).reverse().map(([u, v]) => pt(u, -v)));
      b.face(ids, couleur, true);
    };
    const haut = [0.02, 0.52, 0.01], g = [0.15, 0.4, 0.05], dr = [-0.13, 0.46, -0.06];
    feuille(g, 0.3, 0.26, verts[0]); feuille(g, -0.9, 0.22, verts[2], 0.3);
    feuille(dr, 3.4, 0.25, verts[1]); feuille(dr, 2.2, 0.21, verts[0], 0.3);
    feuille(haut, 1.6, 0.24, verts[2]); feuille(haut, -1.3, 0.24, verts[0]); feuille(haut, 0.2, 0.2, verts[1], 0.9);
    // Gland au pied : la cupule et le gland couché.
    b.pyramid(0.08, 0.04, 5, 0.035, 0.035, 0, '#8a6a3e', 0, '#6e5230');
    b.octa(0.06, 0.03, 0.08, 0.03, 0.025, 0.04, '#b88a4a', '#9a7038');
    return b.build();
  }

  // Coulemelle : grand chapeau plat écailleux sur un pied fin à anneau ; bouton : jeune « baguette de tambour ».
  function coulemelle(pal, bouton) {
    const b = new B();
    const creme = pal[2], chapeau = pal[0], brun = pal[1];
    if (bouton) {
      b.prism(0, 0, 5, 0.035, 0.03, 0, 0.18, creme, 0.2);
      b.octa(0, 0.24, 0, 0.08, 0.09, 0.08, brun, mel(brun, creme, 0.4));
      return b.build();
    }
    b.prism(0, 0, 6, 0.045, 0.035, 0, 0.52, [creme, mel(creme, brun, 0.25)], 0.2);
    b.prism(0, 0, 6, 0.08, 0.075, 0.38, 0.4, creme, 0.5); // anneau
    b.pyramid(0, 0, 8, 0.36, 0.5, 0.62, [chapeau, mel(chapeau, '#ffffff', 0.15)], 0.1, mel(creme, '#ffffff', 0.2));
    b.pyramid(0, 0, 5, 0.09, 0.59, 0.67, brun, 0.3);
    // Écailles brunes sur le chapeau.
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + 0.2, r = k % 2 ? 0.22 : 0.15, y = 0.62 - r * 0.33 + 0.006;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      b.tri([x - 0.03 * Math.sin(a), y, z + 0.03 * Math.cos(a)], [x + 0.03 * Math.sin(a), y, z - 0.03 * Math.cos(a)], [x + Math.cos(a) * 0.04, y - 0.012, z + Math.sin(a) * 0.04], brun, true);
    }
    return b.build();
  }

  // ---------------------------------------------------------------- Animaux (agents)
  function lapin(pal) {
    const b = new B();
    const fur = pal[0], ventre = pal[1], d = pal[2];
    b.octa(0, 0.24, -0.02, 0.19, 0.17, 0.27, fur, ventre);
    b.octa(0, 0.39, 0.22, 0.12, 0.12, 0.14, fur, ventre);
    // Oreilles (papier simple face, visibles des deux côtés).
    b.tri([-0.06, 0.47, 0.2], [-0.12, 0.7, 0.1], [-0.01, 0.49, 0.15], fur, true);
    b.tri([0.06, 0.47, 0.2], [0.12, 0.7, 0.1], [0.01, 0.49, 0.15], fur, true);
    b.tri([-0.062, 0.5, 0.19], [-0.11, 0.66, 0.115], [-0.035, 0.5, 0.168], '#e6c4b8', true);
    b.tri([0.062, 0.5, 0.19], [0.11, 0.66, 0.115], [0.035, 0.5, 0.168], '#e6c4b8', true);
    b.tri([-0.1, 0.42, 0.27], [-0.115, 0.4, 0.24], [-0.1, 0.38, 0.27], d, true);
    b.tri([0.1, 0.42, 0.27], [0.115, 0.4, 0.24], [0.1, 0.38, 0.27], d, true);
    // Queue blanche (le « scut » du lapin de garenne).
    b.pyramid(0, -0.31, 4, 0.065, 0.2, 0.34, '#f7f2ea', 0.3);
    return b.build();
  }

  function renard(pal) {
    const b = new B();
    const o = pal[0], oB = fonce(pal[0], 0.86), w = pal[1], d = pal[2];
    b.octa(0, 0.36, -0.02, 0.18, 0.17, 0.4, o, w);
    b.octa(0, 0.5, 0.42, 0.15, 0.13, 0.14, o, w);
    b.tri([-0.08, 0.5, 0.5], [0, 0.44, 0.78], [0, 0.56, 0.52], w, true);
    b.tri([0.08, 0.5, 0.5], [0, 0.56, 0.52], [0, 0.44, 0.78], w, true);
    b.tri([-0.08, 0.5, 0.5], [0.08, 0.5, 0.5], [0, 0.44, 0.78], w, true);
    b.tri([-0.02, 0.48, 0.77], [0.02, 0.48, 0.77], [0, 0.45, 0.8], d, true);
    b.tri([-0.13, 0.57, 0.4], [-0.12, 0.8, 0.38], [-0.02, 0.61, 0.42], oB, true);
    b.tri([0.13, 0.57, 0.4], [0.12, 0.8, 0.38], [0.02, 0.61, 0.42], oB, true);
    b.tri([-0.11, 0.54, 0.52], [-0.125, 0.52, 0.48], [-0.1, 0.5, 0.53], d, true);
    b.tri([0.11, 0.54, 0.52], [0.125, 0.52, 0.48], [0.1, 0.5, 0.53], d, true);
    for (const [x, z] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.22], [0.1, -0.22]]) b.tri([x - 0.04, 0.28, z], [x + 0.04, 0.28, z], [x, 0, z + 0.02], d, true);
    b.tri([-0.12, 0.4, -0.38], [0, 0.55, -0.4], [0, 0.5, -0.9], o, true);
    b.tri([0.12, 0.4, -0.38], [0, 0.5, -0.9], [0, 0.55, -0.4], oB, true);
    b.tri([-0.12, 0.4, -0.38], [0, 0.5, -0.9], [0.12, 0.4, -0.38], oB, true);
    b.tri([-0.06, 0.48, -0.78], [0.06, 0.48, -0.78], [0, 0.52, -1.02], w, true);
    return b.build();
  }

  // Hérisson : dôme de piquants, museau pointu clair, truffe noire.
  function herisson(pal) {
    const b = new B();
    const brun = pal[0], clair = pal[1], noir = pal[2];
    b.octa(0, 0.12, 0, 0.19, 0.12, 0.25, brun, clair);
    b.octa(0, 0.11, 0.2, 0.09, 0.075, 0.1, clair, clair);
    b.pointe([0, 0.1, 0.24], [0, 0.07, 0.4], 0.05, clair);
    b.octa(0, 0.075, 0.4, 0.022, 0.02, 0.02, noir);
    b.tri([-0.055, 0.15, 0.27], [-0.065, 0.13, 0.25], [-0.05, 0.12, 0.28], noir, true);
    b.tri([0.055, 0.15, 0.27], [0.065, 0.13, 0.25], [0.05, 0.12, 0.28], noir, true);
    // Piquants : rangées sur l'ellipsoïde du dos, pointés vers l'arrière.
    const cx = 0, cy = 0.1, cz = -0.03, rx = 0.2, ry = 0.17, rz = 0.26;
    const cols = [noir, brun, mel(brun, clair, 0.5)];
    let n = 0;
    for (const zz of [-0.75, -0.4, -0.05, 0.3, 0.6]) {
      const s = Math.sqrt(1 - zz * zz);
      const vs = zz > 0.5 ? [-0.5, 0, 0.5] : [-1.05, -0.5, 0, 0.5, 1.05];
      for (const v of vs) {
        const x = cx + rx * s * Math.sin(v), y = cy + ry * s * Math.cos(v), z = cz + rz * zz;
        let nx = (x - cx) / (rx * rx), ny = (y - cy) / (ry * ry), nz = (z - cz) / (rz * rz) - 6;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        // Piquant : un triangle de papier dressé (une face), orienté le long du dos.
        b.tri([x - 0.03, y - ny * 0.01, z + 0.02], [x + 0.03, y - ny * 0.01, z + 0.02], [x + nx * 0.14, y + ny * 0.14, z + nz * 0.14], cols[n++ % 3], true);
      }
    }
    for (const [x, z] of [[-0.1, 0.12], [0.1, 0.12], [-0.1, -0.14], [0.1, -0.14]]) b.tri([x - 0.025, 0.06, z], [x + 0.025, 0.06, z], [x, 0, z + 0.02], noir, true);
    return b.build();
  }

  // Oiseau générique (merle, alouette) : pose = 'pose' (ailes repliées), 'haut' ou 'bas' (vol).
  function oiseau(c, pose) {
    const b = new B();
    b.octa(0, 0.2, 0, 0.1, 0.095, 0.18, c.dos, c.ventre, c.dos);
    b.octa(0, 0.3, 0.14, 0.07, 0.07, 0.075, c.tete || c.dos, c.ventre);
    b.pointe([0, 0.3, 0.19], [0, 0.285, 0.3], 0.024, c.bec);
    if (c.cercle) { b.tri([-0.06, 0.32, 0.17], [-0.072, 0.305, 0.15], [-0.058, 0.295, 0.18], c.cercle, true); b.tri([0.06, 0.32, 0.17], [0.072, 0.305, 0.15], [0.058, 0.295, 0.18], c.cercle, true); }
    else { b.tri([-0.062, 0.32, 0.17], [-0.07, 0.305, 0.15], [-0.058, 0.3, 0.18], '#1f1b18', true); b.tri([0.062, 0.32, 0.17], [0.07, 0.305, 0.15], [0.058, 0.3, 0.18], '#1f1b18', true); }
    if (c.crete) b.pointe([0, 0.35, 0.12], [0, 0.42, 0.06], 0.025, c.dos);
    // Queue.
    const q = c.queue;
    b.quad([-0.035, 0.22, -0.14], [0.035, 0.22, -0.14], [0.07, 0.25 + q * 0.15, -0.14 - q], [-0.07, 0.25 + q * 0.15, -0.14 - q], c.aile, true);
    // Pattes (repliées en vol).
    if (pose === 'pose') for (const x of [-0.04, 0.04]) b.tri([x - 0.012, 0.12, 0.02], [x + 0.012, 0.12, 0.02], [x, 0, 0.04], c.pattes, true);
    // Stries du dos (alouette).
    if (c.stries) for (const [x, z] of [[-0.04, 0.02], [0.03, -0.04], [-0.02, -0.09], [0.05, 0.07]]) b.tri([x, 0.296, z + 0.03], [x + 0.015, 0.296, z - 0.03], [x - 0.012, 0.29, z - 0.02], c.stries, true);
    for (const sg of [-1, 1]) {
      if (pose === 'pose') {
        b.quad([sg * 0.095, 0.25, 0.08], [sg * 0.1, 0.17, 0.04], [sg * 0.09, 0.16, -0.12], [sg * 0.075, 0.25, -0.2], c.aile, true);
      } else {
        const a = pose === 'haut' ? 0.85 : -0.45, L1 = 0.17, L2 = 0.17;
        const ex = sg * (0.06 + L1 * Math.cos(a)), ey = 0.24 + L1 * Math.sin(a);
        const tx = sg * (0.06 + (L1 + L2) * Math.cos(a * 1.25)), ty = 0.24 + (L1 + L2) * Math.sin(a * 1.25);
        b.quad([sg * 0.06, 0.24, 0.09], [ex, ey, 0.07], [ex, ey, -0.1], [sg * 0.06, 0.24, -0.1], c.aile, true);
        b.tri([ex, ey, 0.07], [tx, ty, -0.02], [ex, ey, -0.1], c.bout || c.aile, true);
      }
    }
    return b.build();
  }
  function merle(pal, pose) {
    const noir = pal[0];
    return oiseau({ dos: noir, ventre: mel(noir, pal[2], 0.25), aile: fonce(noir, 0.85), bec: pal[1], cercle: pal[1], pattes: pal[2], queue: 0.2 }, pose);
  }
  function alouette(pal, pose) {
    return oiseau({ dos: pal[0], ventre: pal[1], tete: pal[0], aile: mel(pal[0], pal[2], 0.3), bout: mel(pal[0], pal[1], 0.35), bec: mel(pal[2], '#c9b49a', 0.4), pattes: '#c9a48a', queue: 0.13, crete: true, stries: pal[2] }, pose);
  }

  // ---------------------------------------------------------------- Petites bêtes (populations)
  // Sauterelle : corps allongé, grandes pattes arrière pliées, antennes ; « saut » = pattes tendues.
  function sauterelle(pal, saut) {
    const b = new B();
    const vert = pal[0], clair = pal[1], brun = pal[2];
    b.baton([0, 0.085, -0.15], [0, 0.095, 0.07], 4, 0.045, [vert, clair], vert);
    b.pointe([0, 0.095, 0.06], [0, 0.08, 0.14], 0.04, clair);
    // Ailes repliées sur le dos (élytres).
    b.tri([0, 0.125, 0.06], [-0.035, 0.105, -0.17], [0.035, 0.105, -0.17], fonce(vert, 0.85), true);
    for (const sg of [-1, 1]) {
      // Grande patte arrière : cuisse vers l'arrière et le haut, jambe vers le sol.
      const genou = saut ? [sg * 0.06, 0.06, -0.2] : [sg * 0.055, 0.17, -0.12];
      const pied = saut ? [sg * 0.06, 0.02, -0.3] : [sg * 0.06, 0, -0.17];
      b.tri([sg * 0.03, 0.08, 0.0], [sg * 0.035, 0.1, -0.04], genou, clair, true);
      b.tri([genou[0], genou[1], genou[2]], [genou[0], genou[1] - 0.02, genou[2] + 0.02], pied, brun, true);
      // Pattes avant.
      b.tri([sg * 0.025, 0.07, 0.07], [sg * 0.025, 0.07, 0.04], [sg * 0.07, 0, 0.09], brun, true);
      // Antenne.
      b.tri([sg * 0.012, 0.13, 0.13], [sg * 0.02, 0.13, 0.12], [sg * 0.06, 0.19, 0.24], brun, true);
    }
    return b.build();
  }
  // Abeille sauvage : abdomen rayé, thorax doré, ailes claires. ailes = 'haut' ou 'bas'.
  function abeille(pal, ailes) {
    const b = new B();
    const or = pal[0], noir = pal[1], aile = pal[2];
    b.baton([0, 0.06, -0.02], [0, 0.055, -0.06], 4, 0.045, or);
    b.baton([0, 0.055, -0.06], [0, 0.05, -0.1], 4, 0.042, noir);
    b.baton([0, 0.05, -0.1], [0, 0.045, -0.135], 4, 0.034, or);
    b.pointe([0, 0.045, -0.135], [0, 0.04, -0.17], 0.022, noir);
    b.octa(0, 0.065, 0.02, 0.04, 0.042, 0.04, mel(or, '#e8c06a', 0.3), noir);
    b.octa(0, 0.065, 0.065, 0.028, 0.03, 0.025, noir);
    const a = ailes === 'haut' ? 0.7 : -0.1;
    for (const sg of [-1, 1]) {
      const x = sg * (0.02 + 0.11 * Math.cos(a)), y = 0.09 + 0.11 * Math.sin(a);
      b.tri([sg * 0.02, 0.09, 0.03], [x, y, -0.02], [sg * 0.015, 0.09, -0.04], aile, true);
      b.tri([sg * 0.02, 0.088, -0.0], [x * 0.75, y - 0.01, -0.07], [sg * 0.015, 0.088, -0.05], mel(aile, '#ffffff', 0.3), true);
    }
    return b.build();
  }
  // Tircis : papillon brun tacheté de crème ; a = angle des ailes (0 = à plat).
  function tircis(pal, a) {
    const b = new B();
    const brun = pal[0], creme = pal[1], dessous = pal[2];
    b.baton([0, 0.05, -0.07], [0, 0.05, 0.05], 3, 0.014, fonce(brun, 0.7));
    b.tri([-0.006, 0.055, 0.05], [-0.01, 0.06, 0.06], [-0.04, 0.09, 0.11], fonce(brun, 0.6), true);
    b.tri([0.006, 0.055, 0.05], [0.01, 0.06, 0.06], [0.04, 0.09, 0.11], fonce(brun, 0.6), true);
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const sg of [-1, 1]) {
      const P = (x, z, dy) => [sg * x * ca - sg * (dy || 0) * sa, 0.05 + x * sa + (dy || 0) * ca, z];
      // Aile antérieure et postérieure.
      b.quad(P(0.01, 0.04), P(0.14, 0.1), P(0.17, 0.0), P(0.01, -0.01), brun, true);
      b.quad(P(0.01, -0.005), P(0.15, -0.02), P(0.11, -0.11), P(0.01, -0.06), mel(brun, dessous, 0.3), true);
      // Taches crème (et ocelle de l'aile antérieure).
      b.tri(P(0.08, 0.06, 0.003), P(0.11, 0.07, 0.003), P(0.1, 0.04, 0.003), creme, true);
      b.tri(P(0.05, 0.02, 0.003), P(0.08, 0.025, 0.003), P(0.06, 0.0, 0.003), creme, true);
      b.tri(P(0.12, 0.02, 0.004), P(0.14, 0.03, 0.004), P(0.135, 0.005, 0.004), '#2b221b', true);
      b.tri(P(0.07, -0.05, 0.003), P(0.1, -0.04, 0.003), P(0.09, -0.07, 0.003), creme, true);
    }
    return b.build();
  }
  // Ver de terre : arche qui sort du sol (h : hauteur de l'arche, pour l'ondulation).
  function ver(pal, h) {
    const b = new B();
    const pts = [];
    for (let k = 0; k <= 5; k++) { const a = Math.PI * k / 5; pts.push([-Math.cos(a) * 0.11, Math.sin(a) * h - 0.015, Math.sin(a * 2) * 0.02]); }
    for (let k = 0; k < 5; k++) b.baton(pts[k], pts[k + 1], 4, 0.021, k === 1 ? pal[2] : k % 2 ? pal[1] : pal[0]);
    return b.build();
  }
  // Turricule (déjection du ver en tortillon) : petit cône de terre.
  function turricule(pal) {
    const b = new B();
    b.pyramid(0, 0, 4, 0.06, 0, 0.06, [pal[2], fonce(pal[2], 0.85)], 0.3);
    return b.build();
  }

  // ---------------------------------------------------------------- Aménagements et décor
  const PIERRE = ['#a8a39a', '#8f8a82', '#bdb7ad', '#9a958c'];
  function roche(graine) {
    const b = new B();
    const g = graine || 1;
    b.octa(0, 0.15, 0, 0.3, 0.2, 0.24, PIERRE[g % 4], PIERRE[(g + 1) % 4], PIERRE[(g + 2) % 4]);
    b.octa(0.2, 0.07, 0.14, 0.15, 0.11, 0.13, PIERRE[(g + 2) % 4], PIERRE[(g + 3) % 4]);
    return b.build();
  }
  function tasPierres() {
    const b = new B();
    const P = [[-0.18, 0.1, -0.1, 0.17, 0.12, 0.15], [0.16, 0.09, -0.12, 0.16, 0.11, 0.15], [0.02, 0.09, 0.17, 0.17, 0.11, 0.14],
      [-0.02, 0.24, -0.04, 0.15, 0.1, 0.14], [0.14, 0.2, 0.1, 0.1, 0.08, 0.1], [-0.15, 0.18, 0.1, 0.11, 0.08, 0.1]];
    P.forEach((p, k) => b.octa(p[0], p[1], p[2], p[3], p[4], p[5], PIERRE[k % 4], PIERRE[(k + 1) % 4], PIERRE[(k + 2) % 4]));
    // Ouverture sombre du terrier sous les pierres.
    b.tri([-0.08, 0.005, 0.27], [0.08, 0.005, 0.27], [0, 0.09, 0.24], '#3a3128', true);
    return b.build();
  }
  const BOIS = '#8a6243', BOIS_C = '#d9bf8c', BOIS_F = '#6a4a33';
  function hotelInsectes() {
    const b = new B();
    // Pieds, caisse, toit à deux pans.
    b.prism(-0.2, 0, 4, 0.03, 0.03, 0, 0.18, BOIS_F, 0.78);
    b.prism(0.2, 0, 4, 0.03, 0.03, 0, 0.18, BOIS_F, 0.78);
    const x0 = -0.27, x1 = 0.27, y0 = 0.18, y1 = 0.72, z0 = -0.12, z1 = 0.12;
    b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], BOIS_C);          // façade (fond clair)
    b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], BOIS);            // dos
    b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], BOIS);            // côtés
    b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], BOIS);
    b.quad([x0 - 0.05, y1, z1 + 0.06], [0, y1 + 0.2, z1 + 0.06], [0, y1 + 0.2, z0 - 0.06], [x0 - 0.05, y1, z0 - 0.06], '#7d4f39', true);
    b.quad([0, y1 + 0.2, z1 + 0.06], [x1 + 0.05, y1, z1 + 0.06], [x1 + 0.05, y1, z0 - 0.06], [0, y1 + 0.2, z0 - 0.06], '#6e4433', true);
    b.tri([x0, y1, z1], [x1, y1, z1], [0, y1 + 0.18, z1], BOIS);
    // Cases : tiges creuses (trous sombres), pommes de pin, bûchette percée.
    const z = z1 + 0.004;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const cx = -0.18 + c * 0.12, cy = 0.27 + r * 0.15;
      if (r === 1 && c > 1) continue;
      b.quad([cx - 0.04, cy - 0.04, z], [cx + 0.04, cy - 0.04, z], [cx + 0.04, cy + 0.04, z], [cx - 0.04, cy + 0.04, z], (r + c) % 2 ? '#c8a76e' : '#b48f5b');
      b.quad([cx - 0.015, cy - 0.015, z + 0.002], [cx + 0.015, cy - 0.015, z + 0.002], [cx + 0.015, cy + 0.015, z + 0.002], [cx - 0.015, cy + 0.015, z + 0.002], '#3a2c22');
    }
    b.quad([0.03, 0.38, z], [0.24, 0.38, z], [0.24, 0.48, z], [0.03, 0.48, z], '#9b6b45');
    for (const cx of [0.07, 0.13, 0.19]) b.quad([cx - 0.012, 0.42, z + 0.002], [cx + 0.012, 0.42, z + 0.002], [cx + 0.012, 0.445, z + 0.002], [cx - 0.012, 0.445, z + 0.002], '#3a2c22');
    return b.build();
  }
  function tasBois() {
    const b = new B();
    const ecorce = [BOIS, BOIS_F, '#7a5638'];
    const buche = (x0, x1, y, z, r) => b.baton([x0, y, z], [x1, y, z], 6, r, ecorce, BOIS_C);
    buche(-0.36, 0.34, 0.08, -0.14, 0.08); buche(-0.32, 0.38, 0.08, 0.02, 0.08); buche(-0.35, 0.3, 0.08, 0.18, 0.075);
    buche(-0.3, 0.32, 0.22, -0.06, 0.075); buche(-0.28, 0.36, 0.22, 0.1, 0.07);
    buche(-0.22, 0.26, 0.35, 0.02, 0.065);
    // Quelques feuilles mortes.
    b.tri([-0.4, 0.01, 0.3], [-0.3, 0.01, 0.34], [-0.36, 0.01, 0.24], '#b5793d', true);
    b.tri([0.38, 0.01, -0.28], [0.44, 0.01, -0.18], [0.32, 0.01, -0.2], '#a7653a', true);
    return b.build();
  }
  // Bouleau abattu par la foudre (bois mort naturel) : tronc couché, cassure, moignons de branches.
  function boisMortNaturel(pal) {
    const b = new B();
    const blanc = hex(pal[0]), noir = hex(pal[1]);
    b.baton([-0.45, 0.1, 0.05], [0.4, 0.09, -0.05], 5, 0.1, [blanc, blanc, noir, blanc, mel(blanc, noir, 0.2)], BOIS_C);
    b.baton([0.4, 0.09, -0.05], [0.62, 0.07, -0.08], 5, 0.07, [mel(blanc, '#000', 0.25), blanc], null);
    b.pointe([0.62, 0.07, -0.08], [0.72, 0.12, -0.1], 0.05, '#5b4433');
    b.pointe([-0.45, 0.1, 0.05], [-0.52, 0.2, 0.06], 0.06, BOIS_C);
    b.baton([0.05, 0.16, 0], [0.2, 0.36, 0.14], 3, 0.02, '#5b4a3e');
    b.baton([-0.2, 0.16, 0.02], [-0.32, 0.3, -0.16], 3, 0.02, '#5b4a3e');
    // Trace noircie de la foudre.
    b.quad([-0.1, 0.205, -0.02], [0.18, 0.2, -0.05], [0.16, 0.2, 0.0], [-0.08, 0.205, 0.04], '#2c2521', true);
    return b.build();
  }
  // Nichoir : petite caisse à toit pentu, trou d'envol ; se fixe sur le tronc (face vers +z).
  function nichoir() {
    const b = new B();
    const x0 = -0.08, x1 = 0.08, y0 = -0.1, y1 = 0.1, z0 = 0, z1 = 0.14;
    b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], '#b08a5e');
    b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1 + 0.02, z1], [x0, y1 + 0.03, z0], '#94704a');
    b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1 + 0.03, z0], [x1, y1 + 0.02, z1], '#94704a');
    b.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], '#7d5f3e');
    b.quad([x0 - 0.03, y1 + 0.06, z0 - 0.02], [x1 + 0.03, y1 + 0.06, z0 - 0.02], [x1 + 0.03, y1 + 0.01, z1 + 0.05], [x0 - 0.03, y1 + 0.01, z1 + 0.05], '#6b8a5a', true);
    b.pyramid(0, z1 + 0.003, 6, 0.032, 0.02, 0.02, '#2b221c', 0);
    // Trou d'envol (disque sombre posé sur la façade).
    const ids = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ids.push(b.vert(Math.cos(a) * 0.03, 0.03 + Math.sin(a) * 0.03, z1 + 0.003)); }
    b.face(ids, '#2b221c', true);
    return b.build();
  }

  // Cabane de la garde (bord de l'île) et Odile, figurine en papier kraft (GDD 1.9).
  function cabane() {
    const b = new B();
    const kraft = '#b58a5d', kraftF = '#9a7148', toit = '#7f5a3d';
    const x0 = -0.42, x1 = 0.42, z0 = -0.32, z1 = 0.32, y1 = 0.62;
    b.quad([x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1], kraft);
    b.quad([x1, 0, z0], [x0, 0, z0], [x0, y1, z0], [x1, y1, z0], kraftF);
    b.quad([x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0], kraftF);
    b.quad([x1, 0, z1], [x1, 0, z0], [x1, y1, z0], [x1, y1, z1], kraftF);
    b.tri([x0, y1, z1], [x1, y1, z1], [0, y1 + 0.36, z1], kraft);
    b.tri([x1, y1, z0], [x0, y1, z0], [0, y1 + 0.36, z0], kraftF);
    b.quad([x0 - 0.08, y1 - 0.04, z1 + 0.1], [0, y1 + 0.4, z1 + 0.1], [0, y1 + 0.4, z0 - 0.1], [x0 - 0.08, y1 - 0.04, z0 - 0.1], toit, true);
    b.quad([0, y1 + 0.4, z1 + 0.1], [x1 + 0.08, y1 - 0.04, z1 + 0.1], [x1 + 0.08, y1 - 0.04, z0 - 0.1], [0, y1 + 0.4, z0 - 0.1], fonce(toit, 0.88), true);
    const z = z1 + 0.004;
    b.quad([-0.3, 0, z], [-0.08, 0, z], [-0.08, 0.44, z], [-0.3, 0.44, z], '#5e4330');      // porte
    b.quad([0.08, 0.24, z], [0.3, 0.24, z], [0.3, 0.44, z], [0.08, 0.44, z], '#f6dc8e');    // fenêtre éclairée
    b.f[b.f.length - 1].ne = true;
    b.quad([0.185, 0.24, z + 0.002], [0.195, 0.24, z + 0.002], [0.195, 0.44, z + 0.002], [0.185, 0.44, z + 0.002], '#5e4330');
    b.prism(0.22, -0.12, 4, 0.06, 0.06, y1 + 0.1, y1 + 0.42, '#8f5f45', 0.78);               // cheminée
    // Petit panneau « garde forestière ».
    b.prism(0.6, 0.35, 4, 0.02, 0.02, 0, 0.4, BOIS_F, 0.78);
    b.quad([0.47, 0.3, 0.375], [0.73, 0.3, 0.375], [0.73, 0.44, 0.375], [0.47, 0.44, 0.375], '#e4cf9f', true);
    return b.build();
  }
  function odile(jumellesLevees) {
    const b = new B();
    const kraft = '#c19566', veste = '#5f7a4e', peau = '#efcfb0', sombre = '#3b3029', chapeau = '#6b5236';
    for (const x of [-0.035, 0.035]) b.prism(x, 0, 4, 0.025, 0.022, 0, 0.18, sombre, 0.78);
    b.pyramid(0, 0, 6, 0.12, 0.16, 0.48, [veste, fonce(veste, 0.9)], 0.3, veste);
    b.octa(0, 0.53, 0, 0.07, 0.075, 0.07, peau, peau);
    b.prism(0, 0, 8, 0.17, 0.17, 0.585, 0.6, chapeau, 0.2, chapeau);                          // bord du chapeau
    b.prism(0, 0, 6, 0.075, 0.06, 0.6, 0.67, fonce(chapeau, 0.9), 0.2);
    b.tri([-0.12, 0.3, 0.02], [-0.03, 0.22, 0.11], [-0.11, 0.2, 0.07], '#f5efe0', true);         // carnet sous le bras
    // Bras et jumelles (levées vers les yeux ou pendues au cou).
    const yj = jumellesLevees ? 0.53 : 0.36, zj = jumellesLevees ? 0.1 : 0.09;
    for (const x of [-0.025, 0.025]) b.baton([x, yj, zj], [x, yj, zj + 0.07], 4, 0.018, sombre, '#9cb7c9');
    b.tri([0.1, 0.42, 0.0], [0.04, yj - 0.02, zj], [0.11, 0.38, 0.04], kraft, true);
    b.tri([-0.1, 0.42, 0.0], [-0.04, yj - 0.02, zj], [-0.11, 0.38, 0.04], kraft, true);
    return b.build();
  }

  // ---------------------------------------------------------------- Effets
  function froisse() { const b = new B(); b.blob(0, 0.12, 0, 0.14, 0.9, [[239, 231, 218], [222, 212, 196], [248, 243, 234]], 41, 5); return b.build(); }
  function nuage(sombre, graine) {
    const b = new B();
    const c = sombre ? [[128, 134, 146], [110, 116, 130], [146, 152, 162]] : [[246, 244, 238], [228, 226, 222], [255, 253, 248]];
    b.blob(0, 0, 0, 1.1, 0.55, c, graine, 7);
    b.blob(0.9, -0.1, 0.2, 0.75, 0.6, c, graine + 3, 6);
    b.blob(-0.85, -0.12, -0.1, 0.7, 0.6, c, graine + 7, 6);
    return b.build();
  }
  function graine() {
    const b = new B();
    b.octa(0, 0, 0, 0.07, 0.09, 0.07, '#f3e6c4', '#d8c39a');
    b.tri([0, 0.08, 0], [0.05, 0.16, 0.01], [0.01, 0.12, 0], '#8aa15a', true);
    return b.build();
  }

  // ---------------------------------------------------------------- Assemblage
  function creer(data) {
    const pal = {};
    for (const id in PALETTES) pal[id] = PALETTES[id];
    if (data && data.especes) for (const f of (Array.isArray(data.especes) ? data.especes : Object.values(data.especes))) if (f.palette && f.palette.length >= 3) pal[f.id] = f.palette;
    const ph = pal.herbe, pf = pal.fleurs, pb = pal.bouleau;
    const feuillesBouleau = {
      printemps: [mel(pb[2], '#d6e38f', 0.35), mel(pb[2], '#c4d77c', 0.2), mel(pb[2], '#e2ea9e', 0.45)],
      ete: [hex(pb[2]), fonce(pb[2], 0.86), mel(pb[2], '#c9d98a', 0.3)],
      automne: [hex('#e0b53a'), hex('#d39a2c'), hex('#ecca5a')],
    };
    const M = {
      palettes: pal,
      herbe: {
        // Sprint 6 : brins moins sombres, proches du vert du sol (moins de « bruit » quand on dézoome).
        printemps: [touffe(mel(ph[0], '#a9d27a', 0.6), mel(ph[1], '#cfe596', 0.35)), touffe(mel(ph[0], '#a9d27a', 0.5), mel(ph[1], '#cfe596', 0.2), true)],
        ete: [touffe(mel(ph[0], '#98c46a', 0.55), ph[1]), touffe(mel(ph[0], '#98c46a', 0.45), mel(ph[1], '#c4dc8a', 0.3), true)],
        sec: [touffe(mel(ph[0], ph[2], 0.75), ph[2]), touffe(mel(ph[1], ph[2], 0.7), mel(ph[2], '#e8dfae', 0.3), true)],
        automne: [touffe(mel(ph[0], '#b59b4e', 0.45), mel(ph[1], '#c9ad5c', 0.4)), touffe(mel(ph[0], '#a88a46', 0.5), ph[2], true)],
        hiver: [touffe(mel(ph[2], '#efeadb', 0.4), '#e8e1cb'), touffe('#d8cfae', mel(ph[2], '#ffffff', 0.5), true)],
      },
      fleurs: [fleur(pf[0], pf[2], '#d98f2b'), fleur(pf[1], pf[2], '#f3e3a0'), fleur('#f6f2ea', pf[2], pf[0]), fleur(mel(pf[1], '#9a86c9', 0.55), pf[2], '#f3e3a0')],
      ronce: { normale: [ronce(pal.ronce, '', 3), ronce(pal.ronce, '', 11)], fleurs: [ronce(pal.ronce, 'fleurs', 3), ronce(pal.ronce, 'fleurs', 11)],
        mures: [ronce(pal.ronce, 'mures', 3), ronce(pal.ronce, 'mures', 11)], hiver: [ronce(pal.ronce, 'hiver', 3), ronce(pal.ronce, 'hiver', 11)] },
      bouleau: { printemps: [bouleau(pb, feuillesBouleau.printemps, 5), bouleau(pb, feuillesBouleau.printemps, 13)],
        ete: [bouleau(pb, feuillesBouleau.ete, 5), bouleau(pb, feuillesBouleau.ete, 13)],
        automne: [bouleau(pb, feuillesBouleau.automne, 5), bouleau(pb, feuillesBouleau.automne, 13)],
        hiver: [bouleau(pb, null, 5), bouleau(pb, null, 13)] },
      jeune_chene: { printemps: jeuneChene('printemps'), ete: jeuneChene('ete'), automne: jeuneChene('automne'), hiver: jeuneChene('hiver') },
      coulemelle: coulemelle(pal.coulemelle, false), coulemelleBouton: coulemelle(pal.coulemelle, true),
      lapin: lapin(pal.lapin), renard: renard(pal.renard), herisson: herisson(pal.herisson),
      merle: { pose: merle(pal.merle, 'pose'), haut: merle(pal.merle, 'haut'), bas: merle(pal.merle, 'bas') },
      alouette: { pose: alouette(pal.alouette, 'pose'), haut: alouette(pal.alouette, 'haut'), bas: alouette(pal.alouette, 'bas') },
      sauterelle: { pose: sauterelle(pal.sauterelle, false), saut: sauterelle(pal.sauterelle, true) },
      abeille: { haut: abeille(pal.abeille, 'haut'), bas: abeille(pal.abeille, 'bas') },
      tircis: [tircis(pal.tircis, 0.15), tircis(pal.tircis, 0.75), tircis(pal.tircis, 1.3)],
      ver: [ver(pal.ver, 0.09), ver(pal.ver, 0.06)], turricule: turricule(pal.ver),
      roche: [roche(1), roche(2), roche(3)], tas_pierres: tasPierres(), hotel_insectes: hotelInsectes(), tas_bois: tasBois(),
      bois_mort_naturel: boisMortNaturel(pb), nichoir: nichoir(),
      cabane: cabane(), odile: odile(false), odileJumelles: odile(true),
      froisse: froisse(), nuage: [nuage(false, 3), nuage(false, 19)], nuageOrage: [nuage(true, 3), nuage(true, 19)], graine: graine(),
    };
    return M;
  }

  // Liste pour la galerie (vitrine) et les tests : un modèle représentatif par objet, avec ses variantes.
  function galerie(M) {
    return [
      { id: 'sauterelle', nom: 'Sauterelle', variantes: [['posée', M.sauterelle.pose], ['saut', M.sauterelle.saut]], taille: 3 },
      { id: 'abeille', nom: 'Abeille sauvage', variantes: [['ailes hautes', M.abeille.haut], ['ailes basses', M.abeille.bas]], taille: 4.5 },
      { id: 'ver', nom: 'Ver de terre', variantes: [['sorti', M.ver[0]], ['turricule', M.turricule]], taille: 4 },
      { id: 'alouette', nom: 'Alouette des champs', variantes: [['posée', M.alouette.pose], ['vol', M.alouette.haut], ['vol (bas)', M.alouette.bas]], taille: 2.4 },
      { id: 'ronce', nom: 'Ronce', variantes: [['été', M.ronce.normale[0]], ['fleurie', M.ronce.fleurs[0]], ['mûres', M.ronce.mures[0]], ['hiver', M.ronce.hiver[0]]], taille: 1.2 },
      { id: 'bouleau', nom: 'Bouleau', variantes: [['printemps', M.bouleau.printemps[0]], ['été', M.bouleau.ete[0]], ['automne', M.bouleau.automne[0]], ['hiver', M.bouleau.hiver[0]]], taille: 0.45 },
      { id: 'herisson', nom: 'Hérisson', variantes: [['', M.herisson]], taille: 2.4 },
      { id: 'merle', nom: 'Merle noir', variantes: [['posé', M.merle.pose], ['vol', M.merle.haut], ['vol (bas)', M.merle.bas]], taille: 2.4 },
      { id: 'tircis', nom: 'Tircis', variantes: [['ailes ouvertes', M.tircis[0]], ['mi-ouvertes', M.tircis[1]], ['fermées', M.tircis[2]]], taille: 4.5 },
      { id: 'lapin', nom: 'Lapin de garenne', variantes: [['', M.lapin]], taille: 1.6 },
      { id: 'renard', nom: 'Renard roux', variantes: [['', M.renard]], taille: 1 },
      { id: 'coulemelle', nom: 'Coulemelle', variantes: [['automne', M.coulemelle], ['bouton', M.coulemelleBouton]], taille: 1.6 },
      { id: 'herbe', nom: 'Herbe des prés', variantes: [['printemps', M.herbe.printemps[0]], ['été', M.herbe.ete[0]], ['sèche', M.herbe.sec[0]], ['hiver', M.herbe.hiver[0]]], taille: 1.3 },
      { id: 'fleurs', nom: 'Fleurs sauvages', variantes: M.fleurs.map((m, k) => [['jaune', 'rose', 'blanche', 'mauve'][k], m]), taille: 2.6 },
      { id: 'jeune_chene', nom: 'Jeune chêne (teaser)', variantes: [['printemps', M.jeune_chene.printemps], ['été', M.jeune_chene.ete], ['automne', M.jeune_chene.automne], ['hiver', M.jeune_chene.hiver]], taille: 2.2 },
      { id: 'tas_pierres', nom: 'Tas de pierres', variantes: [['', M.tas_pierres]], taille: 1.4 },
      { id: 'hotel_insectes', nom: 'Hôtel à insectes', variantes: [['', M.hotel_insectes]], taille: 1.1 },
      { id: 'tas_bois', nom: 'Tas de bois', variantes: [['', M.tas_bois], ['arbre foudroyé', M.bois_mort_naturel]], taille: 1.1 },
      { id: 'nichoir', nom: 'Nichoir', variantes: [['', M.nichoir]], taille: 2.6 },
      { id: 'cabane', nom: 'Cabane de la garde', variantes: [['', M.cabane]], taille: 0.75 },
      { id: 'odile', nom: 'Odile, la garde', variantes: [['', M.odile], ['jumelles', M.odileJumelles]], taille: 1.5 },
    ];
  }

  return { creer, galerie, PALETTES };
});
