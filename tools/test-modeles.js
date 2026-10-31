#!/usr/bin/env node
// Tests des modèles origami (src/models.js) sous Node, sans navigateur :
// géométrie valide, budget de faces (performances sur téléphone), couleurs tirées des fiches espèces,
// un modèle pour chaque espèce et chaque aménagement du prototype.
// Usage : node tools/test-modeles.js
'use strict';
const Modeles = require('../src/models.js');
const E = require('../src/engine.js');
const data = require('./donnees.js')();
const M = Modeles.creer(data);

let ok = 0, ko = 0;
const verif = (cond, msg) => { if (cond) ok++; else { ko++; console.log('ÉCHEC : ' + msg); } };

// Tous les maillages, avec leur chemin (ex. « bouleau.ete.0 »).
const maillages = [];
(function parcourir(o, chemin) {
  if (o && o.v && o.f) { maillages.push([chemin, o]); return; }
  if (o && typeof o === 'object') for (const k in o) if (k !== 'palettes') parcourir(o[k], chemin ? chemin + '.' + k : k);
})(M, '');

// 1. Géométrie : sommets finis, faces d'au moins 3 sommets existants, couleurs valides, pas de face dégénérée.
for (const [nom, m] of maillages) {
  verif(m.v.every(v => v.length === 3 && v.every(Number.isFinite)), `${nom} : sommet non fini`);
  verif(m.f.every(f => f.i.length >= 3 && f.i.every(i => Number.isInteger(i) && i >= 0 && i < m.v.length)), `${nom} : face mal formée`);
  verif(m.f.every(f => f.c.length === 3 && f.c.every(c => Number.isFinite(c) && c >= 0 && c <= 255)), `${nom} : couleur invalide`);
  const degen = m.f.filter(f => {
    const [a, b, c] = f.i.slice(0, 3).map(i => m.v[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) < 1e-9;
  }).length;
  verif(degen === 0, `${nom} : ${degen} face(s) dégénérée(s)`);
  // Les modèles sont posés au sol (y ≥ un peu sous 0) et tiennent dans une tuile ou deux.
  const ymin = Math.min(...m.v.map(v => v[1])), r = Math.max(...m.v.map(v => Math.hypot(v[0], v[2])));
  if (!nom.startsWith('nuage') && !nom.startsWith('nichoir') && !nom.startsWith('graine')) verif(ymin > -0.06, `${nom} : passe sous le sol (y min ${ymin.toFixed(2)})`);
  if (!nom.startsWith('nuage')) verif(r < 1.3, `${nom} : trop large (${r.toFixed(2)})`);
}

// 2. Budget de faces : les objets nombreux doivent rester légers (GDD 10.6 : 60 images/s sur téléphone).
const budget = { herbe: 4, fleurs: 14, ronce: 75, bouleau: 140, sauterelle: 30, abeille: 40, tircis: 20, ver: 25, turricule: 6,
  lapin: 40, renard: 40, herisson: 80, merle: 40, alouette: 40, coulemelle: 40, odile: 60, tas_pierres: 60, hotel_insectes: 60, tas_bois: 60 };
for (const [nom, m] of maillages) {
  const racine = nom.split('.')[0].replace(/Bouton|Jumelles/, '');
  if (budget[racine] !== undefined) verif(m.f.length <= budget[racine], `${nom} : ${m.f.length} faces (budget ${budget[racine]})`);
}

// 3. Couleurs : chaque espèce prend la palette de sa fiche.
for (const f of data.especes) {
  verif(JSON.stringify(M.palettes[f.id]) === JSON.stringify(f.palette), `${f.id} : palette différente de la fiche`);
  verif(!!M[f.id] || f.id === 'herbe' || f.id === 'fleurs', `${f.id} : aucun modèle`);
}
// La couleur principale de la fiche apparaît bien dans le modèle (pour les animaux).
for (const id of ['lapin', 'renard', 'herisson', 'sauterelle', 'abeille', 'tircis', 'alouette', 'merle', 'ver']) {
  const m = M[id].pose || M[id].haut || (Array.isArray(M[id]) ? M[id][0] : M[id]);
  const c = E.hex(data.especes.find(f => f.id === id).palette[0]);
  verif(m.f.some(f => f.c[0] === c[0] && f.c[1] === c[1] && f.c[2] === c[2]), `${id} : la couleur principale de la fiche n'est pas utilisée`);
}

// 4. Galerie : les 14 espèces, les 5 aménagements posés, la cabane et la garde.
const ids = Modeles.galerie(M).map(g => g.id);
for (const f of data.especes) verif(ids.includes(f.id), `galerie : ${f.id} absent`);
for (const a of data.amenagements.filter(a => a.type === 'amenagement' && a.id !== 'mare' && a.id !== 'paillis')) verif(ids.includes(a.id), `galerie : ${a.id} absent`);
verif(ids.includes('cabane') && ids.includes('odile'), 'galerie : cabane ou garde absente');

// 5. Papiers rares : couleur du papier calculable pour chaque papier du prototype.
for (const r of data.rares.filter(r => r.statut === 'proto')) {
  verif(!!E.PAPIERS[r.id], `papier ${r.id} : pas de rendu`);
  const c = E.couleurPapier([120, 60, 30], r.id);
  verif(c.every(Number.isFinite), `papier ${r.id} : couleur invalide`);
}

const total = maillages.reduce((s, [, m]) => s + m.f.length, 0);
console.log(`${maillages.length} modèles, ${total} faces au total.`);
console.log(`${ok} vérifications réussies, ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
