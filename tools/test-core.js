#!/usr/bin/env node
// Tests de src/core.js (sprint 1). Usage : node tools/test-core.js
'use strict';
const Core = require('../src/core.js');
const data = Core.preparer(require('./donnees.js')());
const C = Core.CENTRE;

let echecs = 0, total = 0;
function verifier(nom, cond, info) {
  total++;
  if (cond) console.log('  ✓ ' + nom);
  else { echecs++; console.log('  ✗ ' + nom + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); }
}
const avancer = (etat, s) => { for (let k = 0; k < s; k++) Core.tick(etat, data, 1); };
const tuile = (etat, x, y) => etat.tuiles[Core.idx(x, y)];

console.log('Création de l\'île');
{
  const e = Core.creer(data, { graine: 7 });
  const r = Core.resume(e, data);
  verifier('île de rayon 9', e.rayon === 9);
  verifier('environ 25 % d\'herbe', r.couverts.herbe / r.tuiles > 0.18 && r.couverts.herbe / r.tuiles < 0.32, r.couverts.herbe / r.tuiles);
  verifier('fertilité de départ entre 10 et 25', r.fertilite >= 10 && r.fertilite <= 25, r.fertilite);
  verifier('humidité de départ 20', Math.abs(r.humidite - 20) < 0.01);
  verifier('quelques roches', (r.couverts.roche || 0) > 0 && r.couverts.roche < 15, r.couverts.roche);
  verifier('sève 40, graines 3', e.seve === 40 && e.graines === 3);
  verifier('printemps, jour 0, en plein jour', r.horloge.saison === 'printemps' && r.horloge.moment === 'jour');
}

console.log('Déterminisme et sauvegarde');
{
  const a = Core.creer(data, { graine: 99 }), b = Core.creer(data, { graine: 99 });
  avancer(a, 300); avancer(b, 300);
  verifier('même graine → même état après 5 min', JSON.stringify(a) === JSON.stringify(b));
  const copie = JSON.parse(JSON.stringify(a));
  avancer(a, 120); avancer(copie, 120);
  verifier('l\'état sauvegardé en JSON reprend à l\'identique', JSON.stringify(a) === JSON.stringify(copie));
}

console.log('Temps');
{
  const e = Core.creer(data);
  e.temps = 175; verifier('crépuscule avant la nuit', Core.horloge(e).moment === 'crepuscule');
  e.temps = 200; verifier('nuit', Core.horloge(e).moment === 'nuit');
  e.temps = 235; verifier('aube (crépuscule)', Core.horloge(e).moment === 'crepuscule');
  e.temps = 240 * 3; verifier('jour 3 = été', Core.horloge(e).saison === 'ete');
  e.temps = 240 * 9; verifier('jour 9 = hiver', Core.horloge(e).saison === 'hiver');
  e.temps = 240 * 12; verifier('jour 12 = printemps de l\'année 1', Core.horloge(e).saison === 'printemps' && Core.horloge(e).annee === 1);
}

console.log('Actions');
{
  const e = Core.creer(data, { graine: 3 });
  e.seve = 1000; e.graines = 20;
  let r = Core.action(e, data, 'semer_ronce', C + 5, C);
  verifier('ronce verrouillée en Prairie', !r.ok && r.raison === 'verrouille', r);
  Object.assign(tuile(e, C + 6, C), { c: 'nu', f: 12 });
  r = Core.action(e, data, 'semer_fleurs', C + 6, C);
  verifier('fleurs refusées sur sol trop pauvre, avec le détail', !r.ok && r.raison === 'besoins' && r.details.besoins.some(b => !b.ok), r.raison);
  tuile(e, C + 6, C).f = 30;
  const avant = e.seve;
  r = Core.action(e, data, 'semer_fleurs', C + 6, C);
  verifier('fleurs semées sur sol fertile (10 sève, 1 graine)', r.ok && e.seve === avant - 10 && e.graines === 19, r);
  r = Core.action(e, data, 'mare', C - 6, C - 1);
  verifier('mare 2×2 posée', r.ok && tuile(e, C - 6, C - 1).c === 'eau' && tuile(e, C - 5, C).c === 'eau', r);
  r = Core.action(e, data, 'tas_pierres', C - 6, C - 1);
  verifier('impossible de poser sur la mare', !r.ok && r.raison === 'tuile_occupee');
  r = Core.action(e, data, 'mare', 0, 0);
  verifier('hors de l\'île refusé', !r.ok && r.raison === 'hors_ile');
  e.seve = 5; r = Core.action(e, data, 'hotel_insectes', C + 3, C + 6);
  verifier('pas assez de sève', !r.ok && r.raison === 'seve', r);
  e.seve = 1000;
  r = Core.action(e, data, 'retirer', C - 5, C);
  verifier('retirer la mare rend 50 % et libère les 4 tuiles', r.ok && r.rendu === 40 && tuile(e, C - 6, C - 1).c === 'nu', r);
  r = Core.action(e, data, 'agrandir');
  verifier('pas d\'agrandissement en Prairie', !r.ok && r.raison === 'rayon_max');
}

console.log('Statistiques des tuiles');
{
  const e = Core.creer(data, { graine: 5 });
  e.seve = 1000;
  Core.action(e, data, 'mare', C - 1, C - 1);
  avancer(e, 240);
  const pres = tuile(e, C + 1, C).h, loin = tuile(e, C + 4, C).h, horsPortee = tuile(e, C + 7, C).h;
  verifier('humidité forte près de la mare', pres > 45, pres);
  verifier('humidité qui décroît avec la distance', pres > loin && loin >= horsPortee, [pres, loin, horsPortee]);
  verifier('humidité normale hors de portée', Math.abs(horsPortee - 20) < 1, horsPortee);
  const t = tuile(e, C + 5, C + 2), f0 = t.f, h0 = t.hb;
  Core.action(e, data, 'paillis', C + 5, C + 2);
  avancer(e, 120);
  verifier('paillis : la moitié de l\'effet après ½ jour', Math.abs(t.f - f0 - 7.5) < 0.6 && t.paillis > 0, [t.f - f0]);
  avancer(e, 130);
  verifier('paillis : +15 fertilité, +10 humidité après 1 jour, puis disparaît', Math.abs(t.f - f0 - 15) < 0.6 && Math.abs(t.hb - h0 - 10) < 0.01 && t.paillis === 0, [t.f - f0, t.hb - h0]);
}

console.log('Ombre, pousse et extension');
{
  const e = Core.creer(data, { graine: 11 });
  e.etape = 'lisiere'; e.seve = 5000; e.graines = 50;
  const x = C + 6, y = C;
  for (const i of Core.tuilesCercle(e, x, y, 3)) Object.assign(e.tuiles[i], { c: 'nu', f: 40 });
  let r = Core.action(e, data, 'planter_bouleau', x, y);
  verifier('bouleau planté en Lisière', r.ok, r);
  verifier('le jeune bouleau fait un peu d\'ombre', tuile(e, x, y).o > 5 && tuile(e, x + 1, y).o > 0 && tuile(e, x + 3, y).o === 0, [tuile(e, x, y).o, tuile(e, x + 1, y).o]);
  r = Core.action(e, data, 'planter_bouleau', x + 1, y);
  verifier('on peut planter un bouleau à côté (ombre faible)', r.ok, r.details);
  tuile(e, x, y).age = 12; tuile(e, x + 1, y).age = 12;
  Object.assign(tuile(e, x - 1, y), { c: 'arbre', e: 'bouleau', age: 12 });
  Core.tick(e, data, 1);
  r = Core.action(e, data, 'planter_bouleau', x, y + 1);
  verifier('pas de bouleau sous trois bouleaux adultes (ombre > 30)', !r.ok && r.raison === 'besoins', r.details && r.details.besoins.map(b => Math.round(b.valeur)));
  const bouleaux = Core.besoinsEspece(e, data, 'bouleau', x, y);
  verifier('un bouleau adulte ne se fait pas d\'ombre à lui-même', bouleaux.every(b => b.ok), bouleaux);
  r = Core.action(e, data, 'nichoir', x, y);
  verifier('nichoir sur bouleau adulte', r.ok && Core.evaluer(e, data, { type: 'amenagement', id: 'nichoir', min: 1, portee: 'ile' }).ok);
  r = Core.action(e, data, 'nichoir', C, C);
  verifier('pas de nichoir sur l\'herbe', !r.ok);

  // L'herbe s'étend sur le sol nu en quelques jours de printemps.
  const e2 = Core.creer(data, { graine: 21 });
  const h0 = Core.resume(e2, data).couverts.herbe;
  avancer(e2, 240 * 2);
  const h1 = Core.resume(e2, data).couverts.herbe;
  verifier('l\'herbe s\'étend seule (2 jours)', h1 > h0 + 3, [h0, h1]);
  verifier('de la sève est produite', e2.seve > 40, e2.seve);

  // L'herbe recule sous une ombre dense (bouleaux serrés autour d'elle).
  const e4 = Core.creer(data, { graine: 4 });
  e4.etape = 'lisiere';
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const tt = tuile(e4, C + dx, C + dy); Object.assign(tt, { c: 'arbre', e: 'bouleau', age: 20, f: 40 });
  }
  avancer(e4, 260);
  verifier('l\'herbe recule sous des bouleaux serrés (après 1 jour)', tuile(e4, C, C).e === '' && e4.journal.some(j => j.type === 'recul' && j.id === 'herbe'), [tuile(e4, C, C).o]);
  verifier('les bouleaux adultes serrés survivent', tuile(e4, C + 1, C).e === 'bouleau' && tuile(e4, C - 1, C - 1).e === 'bouleau');
}

console.log('Graines');
{
  const e = Core.creer(data, { graine: 8 });
  const t = tuile(e, C + 6, C); Object.assign(t, { c: 'nu', f: 30 });
  e.seve = 100; Core.action(e, data, 'semer_fleurs', C + 6, C);
  avancer(e, 240 * 3);
  const r = Core.action(e, data, 'recolter', C + 6, C);
  verifier('des fleurs adultes donnent des graines à récolter', r.ok && r.graines >= 1, [r, t.age]);
}

console.log('Conditions (langage commun)');
{
  const e = Core.creer(data, { graine: 2 });
  const ev = c => Core.evaluer(e, data, c, { x: C, y: C });
  verifier('couvert herbe ≥ 20 % de l\'île', ev({ type: 'couvert', couvert: 'herbe', min: 0.2, portee: 'ile' }).ok);
  verifier('couvert ouvert = 100 % sans arbre ni ronce', ev({ type: 'couvert', couvert: 'ouvert', min: 1, portee: 'ile' }).ok);
  verifier('couvert_nb fleurs ≥ 6 : faux au départ', !ev({ type: 'couvert_nb', couvert: 'fleurs', min: 6, portee: 'ile' }).ok);
  verifier('stat en zone de rayon 0 = la tuile', ev({ type: 'stat', stat: 'fertilite', op: '>=', valeur: 15, portee: 'zone', rayon: 0 }).ok === tuile(e, C, C).f >= 15);
  verifier('rayon_ile ≥ 11 : faux en Prairie', !ev({ type: 'rayon_ile', min: 11 }).ok);
  verifier('saison printemps', ev({ type: 'saison', dans: ['printemps'] }).ok);
  verifier('étape ≥ prairie', ev({ type: 'etape', min: 'prairie' }).ok && !ev({ type: 'etape', min: 'lisiere' }).ok);
  Core.fixerPopulation(e, 'sauterelle', C, C, 10);
  Core.fixerPopulation(e, 'sauterelle', C + 5, C, 10);
  verifier('espèce en population : zones peuplées comptées', ev({ type: 'espece', id: 'sauterelle', min: 2, portee: 'ile' }).ok);
  Core.ajouterAgent(e, 'lapin', C + 2, C);
  verifier('espèce en agent dans un rayon', ev({ type: 'espece', id: 'lapin', min: 1, portee: 'zone', rayon: 3 }).ok && !Core.evaluer(e, data, { type: 'espece', id: 'lapin', min: 1, portee: 'zone', rayon: 3 }, { x: C - 6, y: C }).ok);
  verifier('nb_especes Prairie = 3 (herbe, sauterelle, lapin)', ev({ type: 'nb_especes', min: 3, etapes: ['prairie'] }).valeur === 3, ev({ type: 'nb_especes', min: 3, etapes: ['prairie'] }));
  e.harmonie = 0.7; e.harmonieHist = new Array(48).fill(0.7);
  verifier('harmonie ≥ 60 % tenue 1 jour', ev({ type: 'harmonie', min: 0.6, duree_jours: 1 }).ok);
  e.harmonieHist[40] = 0.5;
  verifier('harmonie interrompue : pas tenue 1 jour', !ev({ type: 'harmonie', min: 0.6, duree_jours: 1 }).ok);
  verifier('portée zone sans tuile signalée', Core.evaluer(e, data, { type: 'couvert', couvert: 'herbe', min: 0.1, portee: 'zone', rayon: 2 }).erreur !== undefined);

  // Besoins réels des fiches de ChatGPT
  const b = Core.besoinsEspece(e, data, 'lapin', C, C);
  verifier('lapin : herbe ✓, tas de pierres ✗', b[0].ok && !b[1].ok, b);
  e.seve = 100; Core.action(e, data, 'tas_pierres', C + 3, C + 1);
  verifier('lapin : tous ses besoins réunis après le tas de pierres', Core.besoinsEspece(e, data, 'lapin', C, C).every(x => x.ok));
  const s = Core.etapeSuivante(e, data);
  verifier('jauge de succession vers la Lisière : 5 conditions, non remplies', s.id === 'lisiere' && s.conditions.length === 5 && !s.ok);
}

console.log(`\n${total - echecs}/${total} tests réussis.`);
process.exit(echecs ? 1 : 0);
