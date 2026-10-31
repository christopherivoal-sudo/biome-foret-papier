#!/usr/bin/env node
// Test du rendu WebGL (sprint 8a) dans Chromium : le jeu choisit WebGL, la caméra Three.js tombe exactement
// sur la caméra d'engine.js (clics, bulles et repères restent justes), un clic sur l'île sème bien,
// le repli Canvas 2D marche (sans Three.js, ou avec ?canvas2d), et le travail du processeur par image baisse.
// Sprint 8b : matériaux papier, effet maquette, lampe de la cabane la nuit, qualité qui baisse seule.
// Écrit des captures dans dist/captures/webgl-*.png.
// Usage : node tools/test-webgl.js   (construire d'abord : node tools/construire.js)
// Le navigateur de test n'a pas de carte graphique : il dessine 3 images par seconde, c'est normal ici.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const R = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(R, 'dist', 'jeu.html');
const DOS = path.join(R, 'dist', 'captures');
fs.mkdirSync(DOS, { recursive: true });
const scenes = require('./scenes.js')(1);
const Core = require('../src/core.js');

let ok = 0, ko = 0;
function verifier(c, m) { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m); } }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 820 } });
  const erreurs = [];
  const ouvrir = async (q, init) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
    if (init) await p.addInitScript(init);
    await p.goto(URL + '?langue=fr&qualite=2&' + q);
    await p.waitForTimeout(1200);
    return p;
  };
  const charger = (p, e) => p.evaluate(e => { window.BIOME_JEU.etat = e; window.BIOME_JEU.vitesse = 0; document.querySelectorAll('.guide, .odile').forEach(x => { x.style.display = 'none'; }); }, e);

  console.log('Démarrage en WebGL');
  let p = await ouvrir('nouvelle=1&graine=7');
  verifier(await p.evaluate(() => window.BIOME_JEU.rendu.nom) === 'WebGL', 'le jeu dessine en WebGL');
  verifier(await p.locator('canvas.calque-fond').count() === 1 && await p.locator('canvas.calque-devant').count() === 1, 'calques 2D : ciel derrière, étoiles et éclairs devant');
  verifier(await p.evaluate(() => getComputedStyle(document.querySelector('canvas.calque-devant')).pointerEvents) === 'none', 'le calque de devant laisse passer les clics');

  // La projection de Three.js et celle d'engine.js tombent au même pixel (sinon clics et bulles seraient décalés).
  const ecart = await p.evaluate(() => {
    const R3 = window.BIOME_JEU.rendu.moteur, cam = R3.cam, T = window.THREE;
    R3._synchroniserCamera();
    let max = 0;
    for (const [x, y, z] of [[0, 0, 0], [5, 0, -3], [-6, 1.5, 4], [8, 0.2, 8], [-9, 3, -2]]) {
      const a = cam.project(x, y, z, [0, 0, 0]);
      const v = new T.Vector3(x, y, z).project(R3.camera);
      const sx = (v.x + 1) / 2 * cam.w, sy = (1 - v.y) / 2 * cam.h;
      max = Math.max(max, Math.hypot(sx - a[0], sy - a[1]));
    }
    return max;
  });
  verifier(ecart < 0.5, `caméra Three.js = caméra d'engine.js (écart maximal ${ecart.toFixed(3)} px)`);

  // Un clic sur une tuile nue avec l'action Herbe sème bien (la tuile visée est calculée comme avant).
  await p.evaluate(() => { window.BIOME_JEU.etat.ui.guide = { k: 7, ferme: true, attendus: {} }; window.BIOME_JEU.majGuide(); window.BIOME_JEU.choisirAction('semer_herbe'); });
  await p.waitForTimeout(1500);
  const cible = await p.evaluate(() => {
    const e = window.BIOME_JEU.etat, N = window.BiomeCore.N, C = window.BiomeCore.CENTRE;
    for (let d = 2; d < 8; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      const x = C + dx, y = C + dy, t = e.tuiles[y * N + x];
      if (t && t.c === 'nu' && !t.a) return { x, y, s: window.BIOME_JEU.rendu.ecran(x, y, 0) };
    }
    return null;
  });
  if (cible) {
    await p.mouse.click(cible.s.x, cible.s.y);
    await p.waitForTimeout(800);
    const c = await p.evaluate(([x, y]) => window.BIOME_JEU.etat.tuiles[y * window.BiomeCore.N + x].c, [cible.x, cible.y]);
    verifier(c === 'herbe', 'un clic sur l\'île sème de l\'herbe sur la tuile visée');
  } else verifier(false, 'tuile nue trouvée pour le clic');
  await p.screenshot({ path: path.join(DOS, 'webgl-1-debut.png'), timeout: 120000 });
  await p.close();

  console.log('Scènes (captures)');
  p = await ouvrir('');
  const data = Core.preparer(require('./donnees.js')());
  const avecMoment = (e, dansJour) => { const c = JSON.parse(JSON.stringify(e)); const j = 240; c.temps = Math.floor(c.temps / j) * j + dansJour * j; return c; };
  const CAS = [['prairie', scenes[0].etat], ['lisiere', scenes[1].etat], ['mure', scenes[2].etat], ['crepuscule', avecMoment(scenes[2].etat, 0.72)], ['nuit', avecMoment(scenes[2].etat, 0.86)], ['pres', scenes[2].etat, 'window.BIOME_JEU.rendu.zoomer(0.42, 640, 380)']];
  for (const [nom, e, js] of CAS) {
    await charger(p, e);
    if (js) await p.evaluate(js);
    await p.waitForTimeout(2500);
    const info = await p.evaluate(() => { const g = window.BIOME_JEU.rendu.moteur; return { lots: g.lots.size, ombres: g.gl.shadowMap.enabled && g.soleil.castShadow, tris: g.triangles() }; });
    verifier(info.ombres && info.tris > 2000, `${nom} : ${info.tris} triangles, ${info.lots} modèles, ombres portées`);
    if (nom === 'nuit') verifier(await p.evaluate(() => window.BIOME_JEU.rendu.moteur.lampe.intensity) > 0, 'la nuit, la lampe de la cabane est allumée');
    await p.screenshot({ path: path.join(DOS, 'webgl-' + nom + '.png'), timeout: 120000 });
  }
  void data;

  // Sprint 8b : rendu papier (grain, arêtes, eau, lampe), effet maquette, qualité qui baisse seule.
  const b = await p.evaluate(() => {
    const g = window.BIOME_JEU.rendu.moteur, prog = g.gl.info.programs.map(x => x.name + ' ' + x.cacheKey).join(' ');
    return { qualite: g.qualite, flou: !!g.flou, papier: /papierAC/.test(prog) && /papierDC/.test(prog) && /papierS/.test(prog) };
  });
  verifier(b.papier, 'matériaux papier compilés : faces (grain, arêtes, contact), faces douces, sol avec l\'eau');
  verifier(b.qualite === 2 && b.flou, 'ordinateur : effet maquette actif (qualité 2)');
  const q = await p.evaluate(() => { const g = window.BIOME_JEU.rendu.moteur; const r = [g.baisserQualite(), g.qualite, g.baisserQualite(), g.qualite, g.gl.shadowMap.enabled, g.baisserQualite()]; return r; });
  verifier(q[0] && q[1] === 1 && q[2] && q[3] === 0 && !q[4] && q[5] === false, 'qualité qui baisse : sans flou, puis sans ombres, puis plus rien à baisser');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(DOS, 'webgl-qualite0.png'), timeout: 120000 });

  // Travail du processeur par image (la carte graphique fait le reste).
  const mesure = () => p.evaluate(() => { const R = window.BIOME_JEU.rendu, e = window.BIOME_JEU.etat; R.dessiner(e, 0.016, {}); const t0 = performance.now(); for (let k = 0; k < 10; k++) R.dessiner(e, 0.016, {}); return (performance.now() - t0) / 10; });
  await charger(p, scenes[2].etat);
  const tGL = await mesure();
  await p.close();
  p = await ouvrir('canvas2d');
  verifier(await p.evaluate(() => window.BIOME_JEU.rendu.nom) === 'Canvas 2D', '?canvas2d : l\'ancien moteur Canvas 2D');
  await charger(p, scenes[2].etat);
  await p.waitForTimeout(500);
  const t2D = await p.evaluate(() => { const R = window.BIOME_JEU.rendu, e = window.BIOME_JEU.etat; const t0 = performance.now(); for (let k = 0; k < 10; k++) R.dessiner(e, 0.016, { sansCache: true }); return (performance.now() - t0) / 10; });
  verifier(tGL < t2D, `processeur par image : ${tGL.toFixed(1)} ms en WebGL contre ${t2D.toFixed(1)} ms en Canvas 2D (île de 2 h)`);
  await p.close();

  console.log('Repli sans Three.js');
  p = await ouvrir('nouvelle=1', () => { Object.defineProperty(window, 'THREE', { get() { return undefined; }, set() {}, configurable: false }); });
  verifier(await p.evaluate(() => window.BIOME_JEU.rendu.nom) === 'Canvas 2D', 'sans WebGL ni Three.js, le jeu se rabat sur Canvas 2D');
  await p.close();

  verifier(erreurs.length === 0, 'aucune erreur dans la console' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
  await nav.close();
  console.log(`${ok} vérifications réussies, ${ko} échec(s). Captures dans dist/captures/.`);
  process.exit(ko ? 1 : 0);
})();
