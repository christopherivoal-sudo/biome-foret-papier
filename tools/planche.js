#!/usr/bin/env node
// Planche de contrôle des modèles : chaque modèle seul, de près, dans une grille (relecture visuelle).
// Usage : node tools/planche.js [papier] [ids séparés par des virgules]
//   ex. node tools/planche.js washi merle,lapin   → dist/captures/planche-washi.png
// Construire d'abord la vitrine : node tools/construire.js
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const R = path.resolve(__dirname, '..');
const papier = process.argv[2] && process.argv[2] !== 'normal' ? process.argv[2] : '';
const ids = (process.argv[3] || '').split(',').filter(Boolean);
const sortie = path.join(R, 'dist', 'captures', 'planche' + (papier ? '-' + papier : '') + '.png');
fs.mkdirSync(path.dirname(sortie), { recursive: true });

(async () => {
  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto('file://' + path.join(R, 'dist', 'vitrine.html') + '?mode=galerie&vitesse=0');
  await p.waitForTimeout(500);
  const taille = await p.evaluate(([papier, ids]) => {
    document.body.innerHTML = '';
    const E = window.BiomeEngine;
    const G = window.BiomeModels.galerie(window.BIOME_VITRINE.rendu.modeles).filter(g => !ids.length || ids.includes(g.id));
    const items = [];
    for (const g of G) for (const [nom, m] of g.variantes) items.push([g, nom, m]);
    const cols = 6, W = 200, H = 170;
    const cv = document.createElement('canvas');
    cv.width = cols * W; cv.height = Math.ceil(items.length / cols) * H;
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    document.body.style.margin = '0';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#efe7d6'; ctx.fillRect(0, 0, cv.width, cv.height);
    const sous = document.createElement('canvas');
    sous.width = W; sous.height = H; sous.style.width = W + 'px'; sous.style.height = H + 'px';
    document.body.appendChild(sous);
    const R3 = new E.Renderer(sous);
    items.forEach(([g, nom, m], k) => {
      let ymin = 1e9, ymax = -1e9, r = 0;
      for (const v of m.v) { ymin = Math.min(ymin, v[1]); ymax = Math.max(ymax, v[1]); r = Math.max(r, Math.hypot(v[0], v[2])); }
      R3.ctx.setTransform(1, 0, 0, 1, 0, 0);
      R3.ctx.fillStyle = '#efe7d6'; R3.ctx.fillRect(0, 0, W, H);
      const c = R3.cam;
      c.tx = 0; c.ty = (ymin + ymax) / 2; c.tz = 0; c.dist = Math.max(ymax - ymin, 2 * r) * 2.3; c.pitch = 0.35; c.yaw = 0.9;
      c.update(W, H);
      R3.begin(); R3.add(m, 0, 0, 0, 0, 1, 1, papier ? { papier } : undefined); R3.flush();
      ctx.drawImage(sous, (k % cols) * W, Math.floor(k / cols) * H);
      ctx.fillStyle = '#4d3f30'; ctx.font = '12px Georgia';
      ctx.fillText(g.nom + (nom ? ' : ' + nom : ''), (k % cols) * W + 6, Math.floor(k / cols) * H + 14);
    });
    sous.remove();
    return [cv.width, cv.height];
  }, [papier, ids]);
  await p.setViewportSize({ width: taille[0], height: taille[1] });
  await p.screenshot({ path: sortie });
  await nav.close();
  console.log(path.relative(R, sortie));
})();
