#!/usr/bin/env node
// Scènes de démonstration pour la vitrine du rendu : parties jouées par le joueur automatique
// de sim-headless.js, arrêtées à quelques moments choisis. Renvoie des états de core.js (JSON pur).
// Usage en module : require('./scenes.js')() → [{ id, nom, etat }]. En ligne de commande : résumé des scènes.
'use strict';
const Core = require('../src/core.js');
const data = Core.preparer(require('./donnees.js')());
const { joueur } = require('./sim-headless.js');

const MOMENTS = [
  { id: 'prairie', nom: 'Prairie, 8 min', minutes: 8 },
  { id: 'lisiere', nom: 'Lisière, 45 min', minutes: 45 },
  { id: 'mure', nom: 'Lisière, 2 h', minutes: 120 },
];

function jouer(graine, minutes) {
  const e = Core.creer(data, { graine });
  let attente = 0;
  for (let t = 1; t <= minutes * 60; t++) {
    Core.tick(e, data, 1);
    if (--attente <= 0) { joueur(e); attente = 4; }
  }
  return e;
}

// La graine est choisie pour que la Lisière à 45 min montre le plus d'espèces (et au moins un nichoir).
function choisirGraine() {
  let best = 1, score = -1;
  for (let g = 1; g <= 8; g++) {
    const e = jouer(g, 45);
    const s = Core.especesPresentes(e, data).length + (e.tuiles.some(t => t && t.nichoir) ? 0.5 : 0);
    if (s > score) { score = s; best = g; }
  }
  return best;
}

module.exports = function scenes(graine) {
  graine = graine || choisirGraine();
  return MOMENTS.map(m => {
    const etat = jouer(graine, m.minutes);
    etat.journal = etat.journal.slice(-20);
    return { id: m.id, nom: m.nom, graine, etat };
  });
};

if (require.main === module) {
  for (const s of module.exports()) {
    const r = Core.resume(s.etat, data);
    console.log(`${s.nom} (graine ${s.graine}) : ${r.horloge.saison}, ${r.especes.length} espèces, ${r.agents} agents, rayon ${r.rayon}, ${JSON.stringify(r.couverts)}`);
  }
}
