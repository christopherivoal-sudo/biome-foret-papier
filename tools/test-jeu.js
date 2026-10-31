#!/usr/bin/env node
// Test de l'interface du jeu dans un vrai navigateur (Chromium, Playwright) : on joue avec la souris comme un joueur
// (semer, photographier, ouvrir le carnet, réclamer une mission, passer à la Lisière, revenir après une absence,
// changer de langue, recharger la sauvegarde), sur ordinateur et sur téléphone. Aucune erreur ne doit apparaître.
// Écrit des captures dans dist/captures/jeu-*.png.
// Usage : node tools/test-jeu.js   (construire d'abord : node tools/construire.js)
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const Core = require('../src/core.js');
const data = Core.preparer(require('./donnees.js')());
const { joueur } = require('./sim-headless.js');
const scenes = require('./scenes.js');

const R = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(R, 'dist', 'jeu.html');
const DOS = path.join(R, 'dist', 'captures');
fs.mkdirSync(DOS, { recursive: true });

let echecs = 0, reussites = 0;
function verifier(ok, quoi) {
  if (ok) { reussites++; console.log('  ✓ ' + quoi); } else { echecs++; console.log('  ✗ ' + quoi); }
}

// Partie du joueur automatique arrêtée juste quand la Prairie peut passer à la Lisière.
function prairiePrete() {
  for (let g = 1; g <= 6; g++) {
    const e = Core.creer(data, { graine: g });
    let attente = 0;
    for (let t = 1; t <= 40 * 60; t++) {
      Core.tick(e, data, 1);
      const s = Core.etapeSuivante(e, data);
      if (e.etape === 'prairie' && s && s.ok) { e.journal = e.journal.slice(-10); return e; }
      if (--attente <= 0) { joueur(e); attente = 4; }
      if (e.etape !== 'prairie') break;
    }
  }
  return null;
}

(async () => {
  const S = scenes();
  const pret = prairiePrete();
  const nav = await chromium.launch();
  const erreurs = [];
  const suivre = p => {
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
  };
  const capture = (p, nom) => p.screenshot({ path: path.join(DOS, 'jeu-' + nom + '.png') });
  const charger = (p, etat) => p.evaluate(e => { window.BIOME_JEU.etat = e; }, etat);
  // Clique sur l'écran au centre d'une tuile de l'île.
  const clicTuile = async (p, x, y) => {
    const s = await p.evaluate(([x, y]) => window.BIOME_JEU.rendu.ecran(x, y, 0), [x, y]);
    await p.mouse.click(s.x, s.y);
    await p.waitForTimeout(150);
  };

  // ---------- 1. Nouvelle partie sur ordinateur ----------
  console.log('Nouvelle partie (ordinateur)');
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 820 } });
  let p = await ctx.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&graine=7&langue=fr');
  await p.waitForTimeout(1500);
  verifier(await p.locator('.odile.ouverte').count() === 1, 'Odile accueille le joueur');
  verifier(await p.locator('.barre .action').count() === 13, 'barre de 13 actions (observer, 10 aménagements, retirer, agrandir)');
  verifier(await p.locator('.action.verrouille').count() === 4, '4 actions de la Lisière verrouillées');
  await capture(p, '1-debut');

  // Semer des fleurs à la souris, sur une tuile où elles pousseraient.
  const cible = await p.evaluate(() => {
    const J = window.BIOME_JEU, e = J.etat, C = window.BiomeCore, d = C.preparer(window.BIOME_DATA);
    for (const i of C.tuilesIle(e)) {
      const x = i % C.N, y = (i / C.N) | 0, t = e.tuiles[i];
      if (t.c === 'herbe' && C.besoinsEspece(e, d, 'fleurs', x, y).every(b => b.ok)) return { x, y };
    }
    return null;
  });
  verifier(!!cible, 'une tuile accepte des fleurs');
  if (cible) {
    await p.click('.action[data-id="semer_fleurs"]');
    verifier(await p.locator('.aide-action.visible').count() === 1, "l'aide de l'action s'affiche");
    const avant = await p.evaluate(() => window.BIOME_JEU.etat.seve);
    await clicTuile(p, cible.x, cible.y);
    const apres = await p.evaluate(([x, y]) => { const e = window.BIOME_JEU.etat; return { seve: e.seve, c: e.tuiles[y * window.BiomeCore.N + x].c }; }, [cible.x, cible.y]);
    verifier(apres.c === 'fleurs' && apres.seve <= avant - 10 + 1, 'clic sur la tuile : fleurs semées, 10 sève payées');
    // Deuxième clic au même endroit : refus expliqué.
    await clicTuile(p, cible.x, cible.y);
    verifier(await p.locator('.toast.refus').count() >= 1, 'un refus est expliqué au joueur');
    await p.click('.action[data-id="semer_fleurs"]');
  }
  // Clic sur une tuile en mode observation : panneau de la tuile.
  await clicTuile(p, Core.CENTRE + 3, Core.CENTRE - 1);
  verifier(await p.locator('.panneau-tuile.ouvert').count() === 1, 'observer une tuile ouvre son panneau (fertilité, humidité, ombre)');
  await capture(p, '2-tuile');
  await p.keyboard.press('Escape');
  await p.close();

  // ---------- 2. Île de la Lisière (partie de 2 h) : photo, carnet, missions, bonus ----------
  console.log('Lisière (ordinateur)');
  p = await ctx.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&langue=fr');
  await p.waitForTimeout(600);
  await charger(p, S[2].etat);
  await p.waitForTimeout(1800);
  await capture(p, '3-lisiere');
  // Photographier un animal : on clique là où le rendu l'a dessiné.
  const animal = await p.evaluate(() => {
    const c = window.BIOME_JEU.rendu.cibles.filter(c => c.k === 'agent');
    if (!c.length) return null;
    const t = [0, 0, 0], cam = window.BIOME_JEU.rendu.camera;
    const a = c[0]; cam.project(a.x, a.y, a.z, t);
    return { esp: a.esp, x: t[0], y: t[1] };
  });
  verifier(!!animal, 'au moins un animal est cliquable');
  if (animal) {
    await p.evaluate(() => { window.BIOME_JEU.vitesse = 0; });
    await p.waitForTimeout(300);
    const a2 = await p.evaluate(esp => {
      const c = window.BIOME_JEU.rendu.cibles.find(c => c.k === 'agent' && c.esp === esp);
      const t = [0, 0, 0]; window.BIOME_JEU.rendu.camera.project(c.x, c.y, c.z, t); return { x: t[0], y: t[1] };
    }, animal.esp);
    await p.mouse.click(a2.x, a2.y);
    await p.waitForTimeout(200);
    verifier(await p.evaluate(esp => window.BIOME_JEU.etat.carnet[esp].photo, animal.esp), `clic sur l'animal (${animal.esp}) : photographié`);
    await p.evaluate(() => { window.BIOME_JEU.vitesse = 1; });
  }
  await p.click('.rond >> nth=0');
  await p.waitForTimeout(400);
  verifier(await p.locator('.panneau.ouvert .carte-esp').count() === 14, 'le carnet montre les 14 espèces');
  await capture(p, '4-carnet');
  await p.click('.carte-esp[data-esp="herisson"]');
  await p.waitForTimeout(300);
  verifier(await p.locator('.panneau.ouvert .besoins li').count() === 3, 'page du hérisson : 3 besoins');
  await capture(p, '5-carnet-herisson');
  await p.click('.onglet[data-o="collection"]');
  await p.waitForTimeout(300);
  verifier(await p.locator('.grille.collection .carte-rare').count() === 28, 'collection : 28 cartes (14 espèces × journal, washi)');
  await p.click('.onglet[data-o="journal"]');
  await p.keyboard.press('Escape');
  // Missions (sur l'île de la Lisière à 45 min, où il en reste une) : on la remplit pour vérifier la réclamation.
  await charger(p, S[1].etat);
  await p.waitForTimeout(500);
  await p.evaluate(() => { const a = window.BIOME_JEU.etat.missions.actives[0]; if (a) { a.remplie = true; a.n = 99; } });
  await p.click('.rond >> nth=1');
  await p.waitForTimeout(300);
  const seveAvant = await p.evaluate(() => window.BIOME_JEU.etat.seve);
  await capture(p, '6-missions');
  const bouton = p.locator('.mission button');
  verifier(await bouton.count() >= 1, 'une mission remplie propose « Recevoir »');
  if (await bouton.count()) {
    await bouton.first().click();
    await p.waitForTimeout(200);
    verifier(await p.evaluate(() => window.BIOME_JEU.etat.seve) > seveAvant, 'la récompense est versée');
  }
  await p.keyboard.press('Escape');
  // Bonus : pub simulée « Pluie bienfaisante ».
  await p.click('.rond >> nth=2');
  await p.waitForTimeout(300);
  const humAvant = await p.evaluate(() => window.BIOME_JEU.etat.meteo.humidite);
  await p.click('[data-b="pluie"]');
  await p.waitForSelector('.pub-voile');
  await capture(p, '7-pub');
  await p.waitForSelector('.pub-passer:not([hidden])', { timeout: 6000 });
  await p.click('.pub-passer');
  await p.waitForTimeout(300);
  verifier(await p.evaluate(() => window.BIOME_JEU.etat.meteo.humidite) > humAvant, 'pluie bienfaisante accordée après la pub');
  await p.keyboard.press('Escape');
  // Langue anglaise (repli sur le français pour les textes pas encore traduits).
  await p.evaluate(() => window.BIOME_JEU.changerLangue('en'));
  await p.waitForTimeout(500);
  await capture(p, '8-anglais');
  await p.evaluate(() => window.BIOME_JEU.changerLangue('fr'));
  await p.close();

  // ---------- 3. Passage à la Lisière ----------
  console.log('Passage à la Lisière');
  verifier(!!pret, 'le joueur automatique remplit les conditions de la Lisière');
  if (pret) {
    p = await ctx.newPage(); suivre(p);
    await p.goto(URL + '?nouvelle=1&langue=fr');
    await p.waitForTimeout(600);
    await charger(p, pret);
    await p.waitForTimeout(800);
    verifier(await p.locator('.jauge.prete').count() === 1, 'la jauge de succession est prête');
    await p.click('.jauge');
    await p.waitForTimeout(300);
    await capture(p, '9-succession');
    await p.click('.passer');
    await p.waitForTimeout(1600);
    await capture(p, '10-cinematique');
    await p.click('.cinematique button');
    await p.waitForTimeout(900);
    verifier(await p.evaluate(() => window.BIOME_JEU.etat.etape) === 'lisiere', "l'île est passée à la Lisière");
    verifier(await p.locator('.action.verrouille').count() === 0, 'les actions de la Lisière sont débloquées');
    verifier(await p.locator('.action[data-id="agrandir"]:not([hidden])').count() === 1, "l'agrandissement est proposé");
    await p.close();
  }

  // ---------- 4. Retour après une absence, sauvegarde ----------
  console.log('Absence et sauvegarde');
  p = await ctx.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&langue=fr');
  await p.waitForTimeout(600);
  await charger(p, S[0].etat);
  await p.evaluate(() => window.BIOME_JEU.retourHorsLigne(2 * 3600));
  await p.waitForTimeout(400);
  verifier(await p.locator('.panneau.ouvert.retour').count() === 1, "l'écran de retour s'affiche");
  await capture(p, '11-retour');
  const seve1 = await p.evaluate(() => window.BIOME_JEU.etat.seve);
  await p.click('.doubler');
  await p.waitForSelector('.pub-passer:not([hidden])', { timeout: 6000 });
  await p.click('.pub-passer');
  await p.waitForTimeout(300);
  verifier(await p.evaluate(() => window.BIOME_JEU.etat.seve) > seve1, 'retour doublé après la pub');
  await p.click('.continuer');
  const temps = await p.evaluate(() => { window.BIOME_JEU.sauver(); return window.BIOME_JEU.etat.temps; });
  await p.goto(URL + '?langue=fr');
  await p.waitForTimeout(800);
  verifier(await p.evaluate(() => window.BIOME_JEU.etat.temps) >= temps, 'la partie est rechargée depuis la sauvegarde');
  await p.close();
  await ctx.close();

  // ---------- 5. Téléphone ----------
  console.log('Téléphone (390 × 844, tactile)');
  const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p = await tel.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&langue=fr');
  await p.waitForTimeout(600);
  await charger(p, S[1].etat);
  await p.waitForTimeout(1500);
  await capture(p, '12-telephone');
  await p.tap('.rond >> nth=0');
  await p.waitForTimeout(400);
  await capture(p, '13-telephone-carnet');
  await p.close();
  await tel.close();

  await nav.close();
  verifier(erreurs.length === 0, 'aucune erreur dans la page' + (erreurs.length ? ' : ' + [...new Set(erreurs)].slice(0, 5).join(' | ') : ''));
  console.log(`\n${reussites} vérifications réussies, ${echecs} échec(s). Captures dans dist/captures/.`);
  process.exit(echecs ? 1 : 0);
})();
