#!/usr/bin/env node
// Test du rendu dans un vrai navigateur (Chromium, Playwright) : la vitrine s'ouvre sans erreur dans toutes
// les combinaisons saison / moment / météo, et tient la cadence. Écrit des captures dans dist/captures/.
// Usage : node tools/test-rendu.js [--perf]   (construire d'abord : node tools/construire.js --vitrine)
// --perf : mesure le temps par image sur un « téléphone moyen » (processeur ralenti ×4, écran 390×844, 30 animaux).
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const R = path.resolve(__dirname, '..');
const page0 = 'file://' + path.join(R, 'dist', 'vitrine.html');
const DOS = path.join(R, 'dist', 'captures');
fs.mkdirSync(DOS, { recursive: true });
const PERF = process.argv.includes('--perf');

const CAS = [
  ['galerie', 'mode=galerie'], ['galerie-journal', 'mode=galerie&papier=journal'], ['galerie-washi', 'mode=galerie&papier=washi'],
  ['prairie', 'scene=0&saison=printemps&moment=jour&meteo=aucun'],
  ['lisiere-ete', 'scene=2&saison=ete&moment=jour&meteo=aucun'],
  ['lisiere-automne', 'scene=2&saison=automne&moment=jour&meteo=aucun'],
  ['lisiere-hiver', 'scene=1&saison=hiver&moment=jour&meteo=aucun'],
  ['lisiere-printemps-floraison', 'scene=2&saison=printemps&moment=jour&meteo=floraison'],
  ['orage', 'scene=2&saison=ete&moment=jour&meteo=orage'],
  ['secheresse', 'scene=2&saison=ete&moment=jour&meteo=secheresse'],
  ['crepuscule', 'scene=2&saison=ete&moment=crepuscule&meteo=aucun'],
  ['nuit', 'scene=2&saison=ete&moment=nuit&meteo=aucun'],
];

(async () => {
  const nav = await chromium.launch();
  let erreurs = 0;
  if (!PERF) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 } });
    for (const [nom, q] of CAS) {
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto(page0 + '?' + q);
      await p.waitForTimeout(2500);
      await p.screenshot({ path: path.join(DOS, nom + '.png') });
      const info = await p.evaluate(() => document.getElementById('info').innerText.split('\n')[0]);
      console.log(`${errs.length ? 'ÉCHEC' : 'ok   '} ${nom.padEnd(28)} ${info}`);
      for (const e of errs) console.log('      ' + e);
      erreurs += errs.length;
      await p.close();
    }
  } else {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const [nom, q] of [['lisiere-ete', 'scene=2&saison=ete&moment=jour&meteo=aucun'], ['orage', 'scene=2&saison=ete&meteo=orage'], ['hiver-neige', 'scene=2&saison=hiver&meteo=aucun']]) {
      const p = await ctx.newPage();
      p.on('pageerror', e => { console.log('ERREUR ' + e.message); erreurs++; });
      await p.goto(page0 + '?' + q);
      // 30 animaux (plafond du GDD) : on complète la partie avec des agents posés près de leur foyer.
      await p.evaluate(() => {
        const V = window.BIOME_VITRINE, e = V.etat, C = window.BiomeCore;
        const esp = ['lapin', 'merle', 'alouette', 'herisson', 'renard'];
        let k = 0;
        while (e.agents.length < 30) { const a = C.ajouterAgent(e, esp[k % 5], C.CENTRE + (k % 7) - 3, C.CENTRE + ((k / 7) | 0) - 2); if (!a) break; k++; }
        V.reglages.vitesse = 0;
      });
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await p.waitForTimeout(1500);
      const mesure = await p.evaluate(() => new Promise(res => {
        const t = []; let avant = performance.now();
        function f(now) { t.push(now - avant); avant = now; if (t.length < 120) requestAnimationFrame(f); else res(t); }
        requestAnimationFrame(f);
      }));
      mesure.sort((a, b) => a - b);
      const med = mesure[60], p90 = mesure[108];
      const n = await p.evaluate(() => window.BIOME_VITRINE.etat.agents.length);
      console.log(`${nom.padEnd(14)} ${n} animaux, processeur ×4 : image médiane ${med.toFixed(1)} ms (${(1000 / med).toFixed(0)} images/s), 90e centile ${p90.toFixed(1)} ms`);
      await p.screenshot({ path: path.join(DOS, 'telephone-' + nom + '.png') });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await p.close();
    }
  }
  await nav.close();
  if (erreurs) { console.log(`\n${erreurs} erreur(s).`); process.exit(1); }
  console.log('\nAucune erreur.');
})();
