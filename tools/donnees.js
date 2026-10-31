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
    missions: lire('missions.json'),
    evenements: fs.existsSync(path.join(D, 'evenements.json')) ? lire('evenements.json') : [],
    rares: fs.existsSync(path.join(D, 'rares.json')) ? lire('rares.json') : [],
    equilibrage: fs.existsSync(path.join(D, 'equilibrage.json')) ? lire('equilibrage.json') : undefined,
    textes: Object.assign({ fr: lire('textes/fr.json') }, fs.existsSync(path.join(D, 'textes/en.json')) ? { en: lire('textes/en.json') } : {}),
    // Textes de l'interface (sprint 5) : écrits par Claude en français, traduits par ChatGPT.
    interface: Object.assign({ fr: lire('textes/interface-fr.json') }, fs.existsSync(path.join(D, 'textes/interface-en.json')) ? { en: lire('textes/interface-en.json') } : {}),
  };
};
