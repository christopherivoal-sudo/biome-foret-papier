#!/usr/bin/env node
// Copie les réponses de ChatGPT (dossier chatgpt/) dans data/ après validation.
// Usage : node tools/integrer.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const R = path.resolve(__dirname, '..');
const src = f => path.join(R, 'chatgpt', f);
const especesSrc = src('especes-prairie-lisiere.json');
const frSrc = src('textes-fr.json');
const enSrc = src('textes-en.json');
const missionsSrc = src('missions.json');
const gardeSrc = src('garde-fr.json');

const argsVal = ['tools/validate.js', '--especes', 'chatgpt/especes-prairie-lisiere.json', '--fr', 'chatgpt/textes-fr.json'];
if (fs.existsSync(enSrc)) argsVal.push('--en', 'chatgpt/textes-en.json');
if (fs.existsSync(missionsSrc)) argsVal.push('--missions', 'chatgpt/missions.json', '--garde', 'chatgpt/garde-fr.json');
// Consigne 05 : garde, missions et interface en anglais.
const gardeEnSrc = src('garde-en.json'), interfaceEnSrc = src('interface-en.json');
if (fs.existsSync(gardeEnSrc)) argsVal.push('--garde-en', 'chatgpt/garde-en.json');
if (fs.existsSync(interfaceEnSrc)) argsVal.push('--interface-en', 'chatgpt/interface-en.json');
try { process.stdout.write(execFileSync('node', argsVal, { cwd: R, encoding: 'utf8' })); }
catch (e) { process.stdout.write(e.stdout || ''); console.error('Intégration annulée : corriger les erreurs ci-dessus.'); process.exit(1); }

const ecrire = (f, obj) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n'); };
const especes = JSON.parse(fs.readFileSync(especesSrc, 'utf8'));
for (const e of especes) {
  e.palette = e.palette.map(c => c.toLowerCase());
  ecrire(path.join(R, 'data/especes', e.id + '.json'), e);
}
const fr = JSON.parse(fs.readFileSync(frSrc, 'utf8'));
if (fs.existsSync(missionsSrc)) {
  ecrire(path.join(R, 'data/missions.json'), JSON.parse(fs.readFileSync(missionsSrc, 'utf8')));
  const g = JSON.parse(fs.readFileSync(gardeSrc, 'utf8'));
  fr.garde = g.garde; fr.missions = g.missions;
}
ecrire(path.join(R, 'data/textes/fr.json'), fr);
if (fs.existsSync(enSrc)) {
  const en = JSON.parse(fs.readFileSync(enSrc, 'utf8'));
  if (fs.existsSync(gardeEnSrc)) { const g = JSON.parse(fs.readFileSync(gardeEnSrc, 'utf8')); en.garde = g.garde; en.missions = g.missions; }
  ecrire(path.join(R, 'data/textes/en.json'), en);
}
if (fs.existsSync(interfaceEnSrc)) ecrire(path.join(R, 'data/textes/interface-en.json'), JSON.parse(fs.readFileSync(interfaceEnSrc, 'utf8')));
console.log(`Intégré : ${especes.length} fiches dans data/especes/, textes dans data/textes/.`);
