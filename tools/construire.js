#!/usr/bin/env node
// Construction en un seul fichier HTML, sans dépendance (GDD 10.4) : données + core.js + moteur + modèles + rendu.
// Sprint 4 : produit la vitrine du rendu, dist/vitrine.html (scènes jouées par le joueur automatique).
// Au sprint 5, la même construction produira le jeu (game.js à la place de vitrine.js).
// Usage : node tools/construire.js [--graine 1]
'use strict';
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..');
const lire = f => fs.readFileSync(path.join(R, f), 'utf8');
const args = process.argv.slice(2);
const k = args.indexOf('--graine');
const graine = k >= 0 ? Number(args[k + 1]) : 1;

const data = require('./donnees.js')();
const scenes = require('./scenes.js')(graine).map(s => ({ id: s.id, nom: s.nom, etat: s.etat }));
// Un </script> dans une chaîne casserait la page : on échappe le chevron.
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Biome, la forêt de papier : vitrine du rendu</title>
<style>
  html, body { margin: 0; height: 100%; background: #efe7d6; overflow: hidden; font-family: Georgia, 'Times New Roman', serif; color: #3d3226; }
  #scene { position: fixed; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: grab; }
  #reglages { position: fixed; left: 10px; right: 10px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 10px;
    background: rgba(250, 245, 234, 0.92); border: 1px solid #d6c7a9; border-radius: 10px; box-shadow: 0 2px 10px rgba(60, 45, 25, 0.15); }
  .groupe { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .groupe > span { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a7354; margin-right: 2px; }
  button { font: inherit; font-size: 13px; padding: 4px 9px; border: 1px solid #cdbb98; border-radius: 6px; background: #fbf7ee; color: #3d3226; cursor: pointer; }
  button.actif { background: #6f8f4e; border-color: #5b7a3f; color: #fff; }
  #info { position: fixed; left: 10px; top: 10px; right: 10px; font-size: 13px; line-height: 1.45; padding: 7px 10px; background: rgba(250, 245, 234, 0.85);
    border: 1px solid #d6c7a9; border-radius: 10px; pointer-events: none; }
  #info span { color: #6b5a45; }
  #bulle { position: fixed; display: none; font-size: 12px; padding: 5px 8px; background: #fffaf0; border: 1px solid #cdbb98; border-radius: 6px; pointer-events: none; }
  @media (max-width: 640px) { button { font-size: 12px; padding: 3px 7px; } #info { font-size: 11px; } }
</style>
</head>
<body>
<canvas id="scene"></canvas>
<div id="info"></div>
<div id="bulle"></div>
<div id="reglages"></div>
<script>window.BIOME_DATA = ${json(data)};</script>
<script>window.BIOME_SCENES = ${json(scenes)};</script>
<script>${lire('src/core.js')}</script>
<script>${lire('src/engine.js')}</script>
<script>${lire('src/models.js')}</script>
<script>${lire('src/rendu.js')}</script>
<script>${lire('src/vitrine.js')}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(R, 'dist'), { recursive: true });
fs.writeFileSync(path.join(R, 'dist', 'vitrine.html'), html);
console.log(`dist/vitrine.html : ${(html.length / 1024).toFixed(0)} Ko, ${scenes.length} scènes (graine ${graine}).`);
