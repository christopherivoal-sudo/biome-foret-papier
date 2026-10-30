#!/usr/bin/env node
// Tests de src/core.js (sprints 1 et 2). Usage : node tools/test-core.js
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
  // L'humus retient l'eau (sprint 2) : on retire sa part pour isoler l'effet de la mare.
  const sansHumus = t => t.h - Core.P.humusEau * Math.max(0, t.f - 10);
  const pres = sansHumus(tuile(e, C + 1, C)), loin = sansHumus(tuile(e, C + 4, C)), horsPortee = sansHumus(tuile(e, C + 7, C));
  verifier('humidité forte près de la mare', pres > 45, pres);
  verifier('humidité qui décroît avec la distance', pres > loin && loin >= horsPortee - 0.5, [pres, loin, horsPortee]);
  verifier('humidité normale hors de portée (hors humus)', Math.abs(horsPortee - 20) < 1, horsPortee);
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

// ===================== Sprint 2 : écologie =====================
const evts = (e, type, id) => e.journal.filter(j => j.type === type && (!id || j.id === id));
const nbAgents = (e, id) => e.agents.filter(a => a.esp === id && a.m !== 'part').length;

console.log('Arrivées');
{
  const e = Core.creer(data, { graine: 11 });
  avancer(e, 30);
  verifier('les sauterelles arrivent seules en 30 s au plus', Core.presence(e, data, 'sauterelle') > 0);
  const a = evts(e, 'arrivee', 'sauterelle')[0];
  verifier('arrivée notée au journal comme première venue, carnet à jour', a && a.premiere && e.carnet.sauterelle.venu, a);
  avancer(e, 150);
  verifier('pas de lapin sans abri', nbAgents(e, 'lapin') === 0);
  e.seve = 1000;
  Core.action(e, data, 'tas_pierres', C + 5, C);
  let entree = null;
  for (let k = 0; k < 60 && !entree; k++) { avancer(e, 1); const l = e.agents.find(x => x.esp === 'lapin'); if (l) entree = Math.hypot(l.x - C, l.y - C); }
  verifier('avec un tas de pierres, un lapin arrive en moins d\'une minute', entree !== null);
  verifier('il entre par le bord de l\'île', entree !== null && Math.abs(entree - (e.rayon + 0.5)) < 2, entree);
  avancer(e, 30);
  const l = e.agents.find(x => x.esp === 'lapin');
  verifier('puis il rejoint son foyer, à moins de 4 tuiles de l\'abri', l.m === 'vit' && Math.hypot(l.hx - (C + 5), l.hy - C) <= 4, l);

  console.log('Départs');
  Core.action(e, data, 'retirer', C + 5, C);
  avancer(e, 200);
  verifier('l\'abri retiré : les lapins restent encore un moment (moins d\'un jour)', nbAgents(e, 'lapin') > 0);
  avancer(e, 240);
  const d = evts(e, 'depart', 'lapin');
  verifier('puis ils partent par le bord, avec le besoin manquant (abri = besoin n° 2)', d.length > 0 && d.every(x => x.manque === 1), d);
  avancer(e, 60);
  verifier('l\'espèce a quitté l\'île : « parti » au journal et dans le carnet', Core.presence(e, data, 'lapin') === 0 && evts(e, 'parti', 'lapin').length === 1 && e.carnet.lapin.departs === 1);
}

console.log('Règles hors schéma (notes de ChatGPT)');
{
  const e = Core.creer(data, { graine: 4 });
  Object.assign(tuile(e, C + 3, C + 1), { c: 'ronce', e: 'ronce', age: 5 });
  const b = Core.besoinsEspece(e, data, 'lapin', C, C);
  verifier('lapin : une ronce compte comme abri (« tas de pierres OU ronce »)', b[1].ok && b[1].alternative, b[1]);
  verifier('capacité du lapin : 4 par abri (ronce comprise)', Core.capacite(e, data, 'lapin') === 4, Core.capacite(e, data, 'lapin'));
  const e2 = Core.creer(data, { graine: 4 });
  for (const i of Core.tuilesCercle(e2, C, C, 2)) e2.tuiles[i].o = 12;
  let t = Core.besoinsEspece(e2, data, 'tircis', C, C);
  verifier('tircis : moyenne d\'ombre correcte mais aucune tuile de mi-ombre → besoin non réuni', !t[1].ok && t[1].regle === 'stat_nb', t[1]);
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0]]) tuile(e2, C + dx, C + dy).o = 30;
  t = Core.besoinsEspece(e2, data, 'tircis', C, C);
  verifier('tircis : 3 tuiles d\'ombre entre 20 et 50 → besoin réuni', t[1].ok && t[2].ok);
  verifier('équilibrage : la moyenne d\'ombre du tircis abaissée à 10 sans toucher la fiche', data.especes.tircis.besoins[1].valeur === 10 && require('../data/especes/tircis.json').besoins[1].valeur === 20);
  const e3 = Core.creer(data, { graine: 4 });
  for (const i of Core.tuilesCercle(e3, C, C, 1)) Object.assign(e3.tuiles[i], { f: 50, hb: 60, h: 60 });
  Object.assign(tuile(e3, C + 2, C), { c: 'arbre', e: 'bouleau', age: 20 });
  verifier('coulemelle : un bouleau suffit comme litière (« bouleau OU tas de bois »)', Core.besoinsEspece(e3, data, 'coulemelle', C, C).every(x => x.ok));
  verifier('coulemelle : capacité calculée aussi avec le seul bouleau', Core.capacite(e3, data, 'coulemelle') === 3);
}

console.log('Capacités');
{
  const e = Core.creer(data, { graine: 6 });
  verifier('lapin sans abri : capacité 0', Core.capacite(e, data, 'lapin') === 0);
  e.seve = 1000;
  Core.action(e, data, 'tas_pierres', C + 4, C + 1);
  verifier('lapin, 1 tas de pierres : capacité min(herbe/5, 4 par abri, 12) = 4', Core.capacite(e, data, 'lapin') === 4);
  for (let k = 0; k < 8; k++) Core.ajouterAgent(e, 'lapin', C + 2, C + (k % 3));
  avancer(e, 300);
  verifier('8 lapins pour 4 places : les derniers venus partent un par un', nbAgents(e, 'lapin') <= 4 && evts(e, 'depart', 'lapin').some(d => d.raison === 'place'), nbAgents(e, 'lapin'));
  verifier('30 agents au plus sur l\'île', (() => { for (let k = 0; k < 40; k++) Core.ajouterAgent(e, 'merle', C, C); return e.agents.length === Core.P.maxAgents; })());
}

console.log('Chaîne alimentaire');
{
  const e = Core.creer(data, { graine: 8 });
  e.etape = 'lisiere'; e.seve = 5000;
  Core.action(e, data, 'agrandir');
  for (const [dx, dy] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) Core.action(e, data, 'tas_pierres', C + dx, C + dy);
  for (const [dx, dy] of [[6, 0], [6, 1], [7, 0], [7, 1]]) Object.assign(tuile(e, C + dx, C + dy), { c: 'ronce', e: 'ronce', age: 5, f: 40 });
  for (let k = 0; k < 10; k++) Core.ajouterAgent(e, 'lapin', C + 3, C + (k % 4));
  Core.ajouterAgent(e, 'renard', C + 6, C); Core.ajouterAgent(e, 'renard', C + 7, C);
  let pred = 0, plancherOk = true;
  for (let k = 0; k < 240 * 4; k++) {
    avancer(e, 1);
    const p = e.journal.filter(j => j.t === e.temps && j.type === 'predation');
    if (p.length) { pred += p.length; if (nbAgents(e, 'lapin') < Core.P.plancherProies) plancherOk = false; }
  }
  verifier('le renard chasse des lapins (froissement de papier au journal)', pred > 0, pred);
  verifier('jamais d\'extinction par la prédation : au moins ' + Core.P.plancherProies + ' lapins', plancherOk);

  // Pollinisation : graines × (1 + p) là où butinent les abeilles.
  const f = Core.creer(data, { graine: 9 });
  for (const x of [C - 7, C + 7]) Object.assign(tuile(f, x, C + 1), { c: 'fleurs', e: 'fleurs', age: 5, f: 40, hb: 40, h: 40, graines: 0 });
  Core.fixerPopulation(f, 'abeille', C - 7, C + 1, 5);
  avancer(f, 200);
  const gA = tuile(f, C - 7, C + 1).graines, gB = tuile(f, C + 7, C + 1).graines;
  verifier('fleurs pollinisées : nettement plus de graines', gA > gB * 1.5, [gA, gB]);
  verifier('nuée qui butine : comportement visible au journal', evts(f, 'pollinisation', 'abeille').length > 0);

  // Vers de terre : ils enrichissent le sol de leur zone, même nu.
  const v = Core.creer(data, { graine: 10 });
  for (const x of [C - 7, C + 7]) Object.assign(tuile(v, x, C + 1), { c: 'nu', e: '', f: 10 });
  Core.fixerPopulation(v, 'ver', C - 7, C + 1, 6);
  avancer(v, 240);
  const dA = tuile(v, C - 7, C + 1).f - 10, dB = tuile(v, C + 7, C + 1).f - 10;
  verifier('vers : +fertilité sur le sol nu de leur zone', dA >= 2 && dB < 0.5, [dA, dB]);

  // Merle disperseur : il sème des ronces en été.
  const m = Core.creer(data, { graine: 12 });
  m.etape = 'lisiere'; m.temps = 240 * 3; m.saison = 'ete';
  for (const i of Core.tuilesCercle(m, C + 4, C, 4)) Object.assign(m.tuiles[i], { f: 40, hb: 60, h: 60 });
  for (const [dx, dy] of [[0, 0], [1, 0]]) Object.assign(tuile(m, C + 4 + dx, C + dy), { c: 'ronce', e: 'ronce', age: 5 });
  Core.fixerPopulation(m, 'ver', C + 4, C, 8);
  Core.ajouterAgent(m, 'merle', C + 4, C);
  const facteur = Core.P.dispersionFacteur;
  Core.P.dispersionFacteur = 60;
  avancer(m, 120);
  Core.P.dispersionFacteur = facteur;
  verifier('le merle sème des ronces gratuitement là où il se pose', evts(m, 'dispersion', 'merle').length > 0 && Core.presence(m, data, 'ronce') > 2);
}

console.log('Saisons : dormance, hibernation, migration');
{
  const e = Core.creer(data, { graine: 13 });
  e.etape = 'lisiere';
  Core.ajouterAgent(e, 'herisson', C, C);
  Core.ajouterAgent(e, 'alouette', C + 1, C);
  Core.fixerPopulation(e, 'sauterelle', C, C, 10);
  e.temps = 240 * 9 - 6;
  avancer(e, 10);
  verifier('hiver : le hérisson hiberne', e.agents.find(a => a.esp === 'herisson').m === 'dort' && evts(e, 'hibernation').length === 1);
  verifier('hiver : l\'alouette migre', evts(e, 'migration', 'alouette').length === 1);
  for (const i of Core.tuilesIle(e)) if (e.tuiles[i].e === 'herbe') Object.assign(e.tuiles[i], { c: 'nu', e: '' });
  const avant = JSON.stringify(e.populations.sauterelle);
  avancer(e, 480);
  verifier('le hérisson endormi ne part pas, même sans ronces ni vers', nbAgents(e, 'herisson') === 1 && evts(e, 'depart', 'herisson').length === 0);
  verifier('la migration n\'est pas un départ (« parti » absent du journal)', evts(e, 'parti', 'alouette').length === 0 && nbAgents(e, 'alouette') === 0);
  verifier('œufs de sauterelle : la population dort sans bouger l\'hiver, même sans herbe', JSON.stringify(e.populations.sauterelle) === avant);
}

console.log('Harmonie');
{
  const e = Core.creer(data, { graine: 14 });
  const h0 = Core.calculerHarmonie(e, data);
  verifier('île vide : harmonie basse (pas d\'animaux, chaîne incomplète)', h0.total < 0.4 && h0.equilibre === 0, h0);
  avancer(e, 120);
  const h1 = Core.calculerHarmonie(e, data);
  verifier('les 4 parts de l\'harmonie restent entre 0 et 1', ['equilibre', 'chaine', 'diversite', 'mosaique'].every(k => h1[k] >= 0 && h1[k] <= 1) && h1.total > h0.total, h1);
  verifier('l\'harmonie de l\'état suit le calcul en douceur', e.harmonie > 0 && e.harmonie <= 1 && e.harmonieDetail);
}

console.log('Photos et missions');
{
  const e = Core.creer(data, { graine: 15 });
  verifier('3 missions de la garde, dans l\'ordre de la liste', e.missions.actives.map(a => a.id).join() === 'premiers_semis,abri_des_lapins,hotel_des_abeilles');
  verifier('photo refusée si l\'espèce est absente', !Core.photographier(e, data, 'lapin').ok);
  avancer(e, 30);
  const p0 = e.pages, s0 = e.seve;
  const ph = Core.photographier(e, data, 'sauterelle');
  verifier('première photo : 1 page et ' + Core.P.sevePhoto + ' sève', ph.ok && ph.premiere && e.pages === p0 + 1 && Math.abs(e.seve - s0 - Core.P.sevePhoto) < 1e-9);
  verifier('deuxième photo : rien de plus', !Core.photographier(e, data, 'sauterelle').premiere && e.pages === p0 + 1);
  e.seve = 500; e.graines = 10;
  const libres = Core.tuilesIle(e).filter(i => e.tuiles[i].c === 'nu').slice(0, 4);
  for (const i of libres) { Object.assign(e.tuiles[i], { f: 40, h: 30, hb: 30 }); Core.action(e, data, 'semer_fleurs', i % Core.N, (i / Core.N) | 0); }
  const m = e.missions.actives[0];
  verifier('4 fleurs semées : mission « premiers_semis » remplie', m.remplie && m.n === 4 && evts(e, 'mission', 'premiers_semis').length === 1, m);
  const s1 = e.seve, g1 = e.graines;
  const r = Core.reclamerMission(e, data, 'premiers_semis');
  verifier('récompense versée (50 sève, 2 graines) et nouvelle mission tirée', r.ok && e.seve === s1 + 50 && e.graines === g1 + 2 && e.missions.actives.length === 3 && e.missions.faites.includes('premiers_semis'));
  verifier('une mission non remplie ne se réclame pas', !Core.reclamerMission(e, data, 'abri_des_lapins').ok);
  Core.action(e, data, 'tas_pierres', C + 6, C + 2);
  verifier('construire un tas de pierres remplit « abri_des_lapins »', e.missions.actives.find(a => a.id === 'abri_des_lapins').remplie);
}

console.log('Déterminisme avec l\'écologie');
{
  const a = Core.creer(data, { graine: 21 }), b = Core.creer(data, { graine: 21 });
  avancer(a, 600); avancer(b, 600);
  verifier('même graine → même île après 10 min (agents et populations compris)', JSON.stringify(a) === JSON.stringify(b) && a.agents.length + Object.keys(a.populations).length > 0);
  const c = JSON.parse(JSON.stringify(a));
  avancer(a, 300); avancer(c, 300);
  verifier('reprise depuis une sauvegarde JSON identique', JSON.stringify(a) === JSON.stringify(c));
}

console.log(`\n${total - echecs}/${total} tests réussis.`);
process.exit(echecs ? 1 : 0);
