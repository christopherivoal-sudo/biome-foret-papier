// Charge data/ pour les outils Node (tests, simulation). Le jeu web recevra les mêmes données assemblées dans le fichier HTML.
'use strict';
const fs = require('fs');
const path = require('path');
const D = path.resolve(__dirname, '..', 'data');
const lire = f => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));

module.exports = function chargerDonnees() {
  const especes = fs.readdirSync(path.join(D, 'especes')).filter(f => f.endsWith('.json')).sort().map(f => lire('especes/' + f));
  return {
    especes,
    amenagements: lire('amenagements.json'),
    etapes: lire('etapes.json'),
    textes: { fr: lire('textes/fr.json') },
  };
};
