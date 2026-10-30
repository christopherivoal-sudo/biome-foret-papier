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

const argsVal = ['tools/validate.js', '--especes', 'chatgpt/especes-prairie-lisiere.json', '--fr', 'chatgpt/textes-fr.json'];
if (fs.existsSync(enSrc)) argsVal.push('--en', 'chatgpt/textes-en.json');
try { process.stdout.write(execFileSync('node', argsVal, { cwd: R, encoding: 'utf8' })); }
catch (e) { process.stdout.write(e.stdout || ''); console.error('Intégration annulée : corriger les erreurs ci-dessus.'); process.exit(1); }

const ecrire = (f, obj) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n'); };
const especes = JSON.parse(fs.readFileSync(especesSrc, 'utf8'));
for (const e of especes) {
  e.palette = e.palette.map(c => c.toLowerCase());
  ecrire(path.join(R, 'data/especes', e.id + '.json'), e);
}
ecrire(path.join(R, 'data/textes/fr.json'), JSON.parse(fs.readFileSync(frSrc, 'utf8')));
if (fs.existsSync(enSrc)) ecrire(path.join(R, 'data/textes/en.json'), JSON.parse(fs.readFileSync(enSrc, 'utf8')));
console.log(`Intégré : ${especes.length} fiches dans data/especes/, textes dans data/textes/.`);
