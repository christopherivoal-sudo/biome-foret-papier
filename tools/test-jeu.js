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
    // Attend que la caméra soit immobile (le guide peut la faire glisser vers une espèce qui arrive).
    for (let k = 0; k < 30; k++) {
      const a1 = await p.evaluate(() => { const c = window.BIOME_JEU.rendu.camera; return c.tx + ',' + c.tz + ',' + c.dist; });
      await p.waitForTimeout(80);
      const a2 = await p.evaluate(() => { const c = window.BIOME_JEU.rendu.camera; return c.tx + ',' + c.tz + ',' + c.dist; });
      if (a1 === a2) break;
    }
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
  verifier(await p.locator('.guide.ouverte').count() === 1, 'le guide accueille le joueur (sprint 6)');
  verifier(await p.locator('.odile.ouverte').count() === 0, 'une seule bulle à la fois : pas de bulle d\'Odile en même temps');
  verifier(await p.locator('.barre .action:visible').count() === 11, 'barre : 11 boutons visibles (observer, 6 aménagements, arroser, graines au sol, retirer, « à débloquer »)');
  verifier(await p.locator('.action.verrouille').count() === 6 && await p.locator('.action.verrouille:visible').count() === 0, '6 actions de la Lisière (dont tailler et éloigner le renard) rangées derrière « à débloquer »');
  const hBarre = await p.evaluate(() => document.querySelector('.barre').getBoundingClientRect().height);
  verifier(hBarre < 72, `barre du bas basse (${Math.round(hBarre)} px)`);
  await capture(p, '1-debut');

  // Semer des fleurs à la souris, sur une tuile où elles pousseraient.
  const cible = await p.evaluate(() => {
    const J = window.BIOME_JEU, e = J.etat, C = window.BiomeCore, d = C.preparer(window.BIOME_DATA);
    for (const i of C.tuilesIle(e)) {
      const x = i % C.N, y = (i / C.N) | 0, t = e.tuiles[i];
      const o = J.rendu.ecran(x, y, 0), vu = o.x > 150 && o.x < 1100 && o.y > 140 && o.y < 560; // bien à l'écran, hors des bulles
      if (vu && t.c === 'herbe' && C.besoinsEspece(e, d, 'fleurs', x, y).every(b => b.ok)) return { x, y };
    }
    return null;
  });
  verifier(!!cible, 'une tuile accepte des fleurs');
  if (cible) {
    await p.click('.action[data-id="semer_fleurs"]');
    verifier(await p.locator('.aide-action.visible').count() === 0, "pendant le guide, pas de bulle d'aide en plus");
    const avant = await p.evaluate(() => window.BIOME_JEU.etat.seve);
    await clicTuile(p, cible.x, cible.y);
    const apres = await p.evaluate(([x, y]) => { const e = window.BIOME_JEU.etat; return { seve: e.seve, c: e.tuiles[y * window.BiomeCore.N + x].c }; }, [cible.x, cible.y]);
    verifier(apres.c === 'fleurs' && apres.seve <= avant - 10 + 4, 'clic sur la tuile : fleurs semées, 10 sève payées');
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

  // ---------- 1 bis. Sprint 6 : guide, semis en glissant, déplacement de la caméra ----------
  console.log('Guide et semis en glissant (ordinateur)');
  p = await ctx.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&graine=3&langue=fr');
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.BIOME_JEU.vitesse = 20; });
  await p.waitForFunction(() => window.BIOME_JEU.guide && window.BIOME_JEU.guide.k >= 1, null, { timeout: 20000 });
  await p.evaluate(() => { window.BIOME_JEU.vitesse = 1; });
  verifier(await p.locator('.etiquette-ile').count() >= 1, 'la première espèce est annoncée sur l\'île');
  verifier(await p.locator('.action.conseil[data-id="semer_fleurs"]').count() === 1, 'guide : le bouton « Fleurs » est montré');
  await p.click('.action[data-id="semer_fleurs"]');
  await p.waitForTimeout(600);
  verifier(await p.locator('.main.visible.glisse').count() === 1, 'guide : la main montre où glisser sur l\'île');
  await capture(p, '1b-guide');
  // Glisser sur une rangée de tuiles d'herbe avec l'herbe choisie : plusieurs tuiles d'un coup.
  await p.evaluate(() => { const e = window.BIOME_JEU.etat; e.seve = 500; e.graines = 30; });
  await p.click('.action[data-id="semer_herbe"]');
  await p.evaluate(() => window.BIOME_JEU.rendu.cadrer(window.BIOME_JEU.etat));
  await p.waitForTimeout(200);
  // Une suite d'au moins 3 tuiles nues voisines, bien visible à l'écran (hors des bulles et de la barre).
  const ligne = await p.evaluate(() => { const C = window.BiomeCore, e = window.BIOME_JEU.etat, R = window.BIOME_JEU.rendu;
    const vis = (x, y) => { const o = R.ecran(x, y, 0); return o.x > 120 && o.x < 1000 && o.y > 160 && o.y < 560; };
    for (let y = C.CENTRE - 6; y <= C.CENTRE + 6; y++) { let xs = [];
      for (let x = C.CENTRE - 8; x <= C.CENTRE + 8; x++) { const t = e.tuiles[y * C.N + x]; if (t && t.c === 'nu' && !t.a && vis(x, y)) { xs.push(x); if (xs.length >= 4) return [R.ecran(xs[0], y, 0), R.ecran(xs[3], y, 0)]; } else xs = []; } }
    return null; });
  if (ligne) {
    const avant = await p.evaluate(() => window.BIOME_JEU.etat.tuiles.filter(t => t && t.c === 'herbe').length);
    await p.mouse.move(ligne[0].x, ligne[0].y); await p.mouse.down();
    for (let k = 1; k <= 24; k++) await p.mouse.move(ligne[0].x + (ligne[1].x - ligne[0].x) * k / 24, ligne[0].y + (ligne[1].y - ligne[0].y) * k / 24);
    await p.mouse.up();
    const apres = await p.evaluate(() => window.BIOME_JEU.etat.tuiles.filter(t => t && t.c === 'herbe').length);
    verifier(apres - avant >= 3, `maintenir et glisser sème à la chaîne (${apres - avant} tuiles d'herbe d'un geste)`);
  } else verifier(false, 'rangée de tuiles nues trouvée');
  // En observation, glisser déplace la caméra.
  await p.click('.action[data-id="observer"]');
  const c0 = await p.evaluate(() => [window.BIOME_JEU.rendu.camera.tx, window.BIOME_JEU.rendu.camera.tz]);
  await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(560, 360, { steps: 6 }); await p.mouse.up();
  const c1 = await p.evaluate(() => [window.BIOME_JEU.rendu.camera.tx, window.BIOME_JEU.rendu.camera.tz]);
  verifier(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 0.5, 'glisser en observation déplace la caméra');
  // Le guide avance quand on pose ce qu'il demande, et se ferme quand on le passe.
  await p.evaluate(() => { const C = window.BiomeCore, e = window.BIOME_JEU.etat; let n = 0;
    for (const i of C.tuilesIle(e)) { if (n >= 3) break; const x = i % C.N, y = (i / C.N) | 0; if (window.BIOME_JEU.poser('semer_fleurs', x, y, true).ok) n++; } window.BIOME_JEU.majGuide(); });
  verifier(await p.evaluate(() => window.BIOME_JEU.guide.k) >= 2, 'guide : 3 fleurs semées → étape suivante (hôtel à insectes)');
  await p.click('.guide .fermer');
  verifier(await p.locator('.guide.ouverte').count() === 0, 'le guide peut être passé');
  await p.close();

  // ---------- 2. Île de la Lisière (partie de 2 h) : photo, carnet, missions, bonus ----------
  console.log('Lisière (ordinateur)');
  p = await ctx.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&langue=fr');
  await p.waitForTimeout(600);
  await charger(p, S[2].etat);
  await p.waitForTimeout(1800);
  await capture(p, '3-lisiere');
  // Sprint 6 (retours 3) : récolte groupée en un geste, et les bulles laissent passer les clics.
  await p.evaluate(() => { const e = window.BIOME_JEU.etat, C = window.BiomeCore; let n = 0; for (const i of C.tuilesIle(e)) if (e.tuiles[i].c === 'fleurs' && n < 5) { e.tuiles[i].graines = 2; n++; } });
  await p.waitForTimeout(700);
  const g0 = await p.evaluate(() => window.BIOME_JEU.etat.graines);
  await p.click('.recolte-tout');
  const g1 = await p.evaluate(() => window.BIOME_JEU.etat.graines);
  verifier(g1 - g0 >= 10, `bouton « Récolter » : toutes les capsules d'un coup (+${g1 - g0} graines)`);
  verifier(await p.evaluate(() => getComputedStyle(document.querySelector('.guide')).pointerEvents) === 'none', 'les bulles ne bloquent pas les clics sur l\'île');
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

  // ---------- 3 bis. Sprint 5 bis : teaser de la Jeune forêt, réserve pleine, images par seconde ----------
  console.log('Teaser de la Jeune forêt, réserve, images par seconde');
  p = await ctx.newPage(); suivre(p);
  await p.goto(URL + '?nouvelle=1&langue=fr');
  await p.waitForTimeout(600);
  await charger(p, S[1].etat);
  await p.waitForTimeout(700);
  verifier((await p.locator('.jauge').innerText()).includes('Jeune forêt'), 'en Lisière, la jauge montre le chemin vers la Jeune forêt');
  await p.click('.jauge');
  await p.waitForTimeout(300);
  verifier(await p.locator('.panneau.ouvert .besoins li').count() === 5, 'le panneau liste les 5 conditions de la Jeune forêt');
  await capture(p, '9b-teaser');
  await p.keyboard.press('Escape');
  // Germination : on simule la fin du teaser (le chemin dans core.js est vérifié par test-core.js).
  const ou = await p.evaluate(() => {
    const e = window.BIOME_JEU.etat, Core = window.BiomeCore;
    const i = Core.tuilesIle(e).find(k => e.tuiles[k].c === 'herbe' && !e.tuiles[k].a);
    e.teaser = { depuis: {}, chene: i, t: e.temps - 60 };
    e.journal.push({ t: e.temps, type: 'chene', i, x: i % Core.N, y: (i / Core.N) | 0 });
    return i;
  });
  await p.waitForTimeout(600);
  verifier(ou >= 0 && (await p.locator('.toast').allInnerTexts()).some(t => t.includes('chêne')), 'le chêne germe : message « La suite pousse… »');
  verifier((await p.locator('.jauge').innerText()).includes('La suite pousse'), 'la jauge affiche « La suite pousse… »');
  await capture(p, '9c-chene');
  // Réserve pleine : chip doré, « Sève double » indisponible.
  await p.evaluate(() => { const e = window.BIOME_JEU.etat; e.seve = window.BiomeCore.reserveMax(e); });
  await p.waitForTimeout(400);
  verifier(await p.locator('.chip.pleine').count() === 1, 'réserve de sève pleine signalée');
  await p.click('.rond >> nth=2');
  await p.waitForTimeout(300);
  verifier(await p.locator('[data-b="seve_double"][disabled]').count() === 1, '« Sève double » indisponible quand la réserve est pleine');
  await p.keyboard.press('Escape');
  await p.click('.rond >> nth=3');
  await p.waitForTimeout(2300);
  verifier(/\d+ en moyenne/.test(await p.locator('.fps').innerText()), 'les images par seconde s\'affichent dans les réglages');
  await capture(p, '9d-reglages');
  await p.keyboard.press('Escape');
  await p.close();

  // ---------- 4. Retour après une absence, sauvegarde ----------
  // ---------- Sprint 7 : l'île se dérègle, le joueur répond ----------
  console.log('Sprint 7 : problèmes, demandes, carte des habitats, coups de pouce');
  {
    // Île en Lisière : 12 lapins sur un terrier (surpâturage) et une demande des abeilles.
    const e = Core.creer(data, { graine: 7 });
    e.etape = 'lisiere'; e.seve = 2000; e.graines = 40;
    for (const i of Core.tuilesCercle(e, Core.CENTRE, Core.CENTRE, 8)) Object.assign(e.tuiles[i], { f: 40, hb: 45, h: 45 });
    for (const i of Core.tuilesCercle(e, Core.CENTRE - 3, Core.CENTRE, 3)) Object.assign(e.tuiles[i], { c: 'herbe', e: 'herbe', age: 2 });
    Core.action(e, data, 'tas_pierres', Core.CENTRE - 3, Core.CENTRE);
    for (let k = 0; k < 12; k++) Core.ajouterAgent(e, 'lapin', Core.CENTRE - 3 + (k % 3) - 1, Core.CENTRE + ((k / 3) | 0) - 1);
    Core.action(e, data, 'hotel_insectes', Core.CENTRE + 4, Core.CENTRE);
    for (const [dx, dy] of [[2, 3], [3, 3], [2, 4], [6, 4], [6, 3], [5, 4], [6, 5]]) Object.assign(e.tuiles[Core.idx(Core.CENTRE + dx, Core.CENTRE + dy)], { c: 'fleurs', e: 'fleurs', age: 3 });
    Core.fixerPopulation(e, 'abeille', Core.CENTRE + 4, Core.CENTRE, 5);
    for (const [dx, dy] of [[5, -3], [6, -3], [5, -4]]) Object.assign(e.tuiles[Core.idx(Core.CENTRE + dx, Core.CENTRE + dy)], { c: 'ronce', e: 'ronce', age: 4 });
    for (let k = 0; k < 200 && !(e.vie.pb.surpaturage && e.vie.pb.surpaturage.annonce); k++) Core.tick(e, data, 1);
    e.vie.demandes.push({ id: 'abeille_fleurs', esp: 'abeille', debut: e.temps, fin: e.temps + 360, i: Core.idx(Core.CENTRE + 4, Core.CENTRE), x: Core.CENTRE + 4, y: Core.CENTRE, base: 1 });
    e.ui = { guide: { k: 7, ferme: true, attendus: {} }, tuto: { pb_surpaturage: 1, demande: 1 } };
    for (const j of e.journal) j.vu = 1;
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    p = await ctx.newPage(); suivre(p);
    await p.goto(URL + '?nouvelle=1&langue=fr');
    await p.waitForTimeout(500);
    await charger(p, e);
    await p.evaluate(() => { window.BIOME_JEU.vitesse = 0; window.BIOME_JEU.majReperes(); });
    await p.waitForTimeout(700);
    verifier(await p.locator('.repere.pb').count() === 1 && await p.locator('.repere.dem').count() === 1, 'un repère « ! » (surpâturage) et un repère « ? » (demande des abeilles) sur l\'île');
    verifier(await p.locator('.chip.alertes:visible').count() === 1 && (await p.locator('.chip.alertes').innerText()).includes('2'), 'le bouton « À faire » compte 2 choses à faire');
    await capture(p, '14-sprint7-reperes');
    await p.click('.repere.pb', { force: true });
    await p.waitForTimeout(300);
    verifier(await p.locator('.carte-repere.ouvert [data-sol="semer_herbe"]').count() === 1, 'toucher le repère : explication et solutions (semer de l\'herbe, retirer un abri)');
    await capture(p, '15-sprint7-probleme');
    await p.click('.carte-repere.ouvert [data-sol="semer_herbe"]');
    await p.waitForTimeout(1200);
    verifier(await p.evaluate(() => window.BIOME_JEU.etat && document.querySelector('.action.choisie').dataset.id) === 'semer_herbe', 'la solution choisit l\'action correspondante');
    await p.click('.action[data-id="tas_pierres"]');
    await p.waitForTimeout(4200);
    const carte = await p.evaluate(() => window.BIOME_JEU.carteActuelle());
    verifier(carte && carte.length > 20 && carte.some(c => c[1] >= 0.66) && carte.some(c => c[1] < 0.33), `carte des habitats du tas de pierres : ${carte ? carte.length : 0} tuiles en vert, jaune ou gris`);
    verifier(await p.locator('.legende-carte.visible').count() === 1, 'légende de la carte affichée (pour qui, et ce qui compte)');
    await capture(p, '16-sprint7-carte');
    await p.click('.action[data-id="arroser"]');
    const nu = await p.evaluate(() => { const E = window.BIOME_JEU.etat, C = 15; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const t = E.tuiles[(C + dy) * 31 + C + dx]; if (t && t.c === 'nu' && Math.hypot(dx, dy) > 4 && Math.hypot(dx, dy) < 7) return [C + dx, C + dy, t.h]; } return null; });
    if (nu) {
      await clicTuile(p, nu[0], nu[1]);
      await p.waitForTimeout(300);
      const h = await p.evaluate(([x, y]) => window.BIOME_JEU.etat.tuiles[y * 31 + x].h, nu);
      verifier(h >= nu[2] + 25 && await p.locator('.flotte').count() >= 1, `arroser : humidité ${Math.round(nu[2])} → ${Math.round(h)}, effet affiché sur l'île`);
    } else verifier(false, 'une tuile nue à arroser');
    verifier(await p.locator('.action[data-id="tailler"]:visible').count() === 1 && await p.locator('.action[data-id="effaroucher"]:visible').count() === 1, 'en Lisière : « Tailler » et « Éloigner le renard » dans la barre');
    await p.click('.action[data-id="arroser"]');
    await p.click('.chip.alertes', { force: true });
    await p.waitForTimeout(300);
    verifier(await p.locator('.panneau.ouvert .vie-item').count() === 2, 'panneau « À faire » : le problème et la demande, avec leurs solutions');
    await capture(p, '17-sprint7-a-faire');
    await p.close(); await ctx.close();
  }

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
