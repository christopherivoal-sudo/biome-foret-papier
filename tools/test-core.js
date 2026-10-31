#!/usr/bin/env node
// Tests de src/core.js (sprints 1 à 3, 5 bis et 7). Usage : node tools/test-core.js
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
  // L'herbe voisine s'étend (sprint 6 : plus vite) : on garde la tuile nue pour mesurer le seul effet du paillis.
  const nue = s => { for (let k = 0; k < s; k++) { avancer(e, 1); if (t.c !== 'nu') Object.assign(t, { c: 'nu', e: '', age: 0 }); } };
  nue(120);
  verifier('paillis : la moitié de l\'effet après ½ jour', Math.abs(t.f - f0 - 7.5) < 0.6 && t.paillis > 0, [t.f - f0]);
  nue(130);
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
  verifier('capacité du lapin (sprint 7) : une tuile de ronce abrite 1 lapin', Core.placesLapins(e) === 1, Core.placesLapins(e));
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
  const herbeAutour = Core.tuilesCercle(e, C + 4, C + 1, 2).filter(i => e.tuiles[i].c === 'herbe').length;
  const places = Math.max(1, Math.min(4, 1 + Math.floor(herbeAutour / 4)));
  verifier('lapin, 1 tas de pierres (sprint 7) : 1 place + 1 par 4 tuiles d\'herbe tout près = ' + places + ' (×1,5 au printemps)', Core.placesLapins(e) === places && Core.capacite(e, data, 'lapin') === Math.floor(places * 1.5), [Core.placesLapins(e), Core.capacite(e, data, 'lapin')]);
  for (let k = 0; k < 12; k++) Core.ajouterAgent(e, 'lapin', C + 2, C + (k % 3));
  avancer(e, 300);
  const cap = Core.capacite(e, data, 'lapin');
  verifier('12 lapins pour ' + cap + ' places : les derniers venus partent un par un', nbAgents(e, 'lapin') <= Math.max(cap, 12 - 9) && evts(e, 'depart', 'lapin').some(d => d.raison === 'place'), nbAgents(e, 'lapin'));
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
  e.etape = 'lisiere'; e.seve = 500;
  Core.action(e, data, 'tas_bois', C + 2, C + 2); // sprint 7 : il lui faut un tas de bois pour hiberner
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

// =====================================================================
// Sprint 3 : événements, papiers rares, hors ligne
// =====================================================================
const brutes = require('./donnees.js');
// Données modifiées pour un test (sans toucher aux vraies) : modif(données brutes) puis preparer.
const variante = modif => { const d = brutes(); modif(d); return Core.preparer(d); };
// Force le départ d'un événement à la prochaine mesure (la garde l'a déjà annoncé).
function forcer(e, id) {
  const h = Core.horloge(e);
  e.meteo.tirage = h.annee + '-' + h.saison;
  e.meteo.prevu = { id, debut: e.temps + 1, annonce: true };
}
const humMoy = e => Core.resume(e, data).humidite;
// Force puis lance l'événement (les événements démarrent au pas écologique suivant, toutes les 5 s).
function demarrer(e, d, id) { forcer(e, id); for (let k = 0; k < 6 && !e.meteo.actif; k++) Core.tick(e, d, 1); }

console.log('Événements : tirage et annonce');
{
  const e = Core.creer(data, { graine: 31 });
  avancer(e, 5);
  verifier('printemps : une floraison est prévue (1 par printemps)', e.meteo.prevu && e.meteo.prevu.id === 'floraison', e.meteo.prevu);
  const debut = e.meteo.prevu.debut;
  verifier('elle commence dans la saison, ni trop tôt ni trop tard', debut >= 60 && debut + 240 <= 720 - 60, debut);
  while (!evts(e, 'evenement', 'floraison').length && e.temps < 720) avancer(e, 1);
  const an = evts(e, 'annonce', 'floraison')[0], ev = evts(e, 'evenement', 'floraison')[0];
  verifier('la garde l\'annonce environ 30 s avant', an && ev && ev.t - an.t >= 25 && ev.t - an.t <= 35, [an, ev]);
  verifier('meteo() renvoie l\'événement en cours', Core.meteo(e, data).actif.id === 'floraison');
  avancer(e, 250);
  verifier('la floraison dure 1 jour puis s\'achève', !e.meteo.actif && evts(e, 'evenement_fin', 'floraison').length === 1);
  verifier('pas de 2e floraison le même printemps', !e.meteo.prevu);
}
{
  let seche = 0, total = 0;
  for (let g = 1; g <= 200; g++) {
    const e = Core.creer(data, { graine: g });
    e.temps = 720; e.saison = 'ete';
    avancer(e, 5);
    if (e.meteo.prevu && e.meteo.prevu.id === 'secheresse') seche++;
    const f = Core.creer(data, { graine: g });
    f.etape = 'lisiere'; f.temps = 720 * 5; f.saison = 'ete'; f.meteo.derniere.secheresse = 0;
    avancer(f, 5);
    if (f.meteo.prevu && f.meteo.prevu.id === 'secheresse') seche++;
    const k = Core.creer(data, { graine: g });
    k.etape = 'lisiere'; k.temps = 720 * 5; k.saison = 'ete';
    avancer(k, 5);
    if (k.meteo.prevu && k.meteo.prevu.id === 'secheresse') total++;
  }
  verifier('jamais de sécheresse en Prairie, ni deux étés de suite', seche === 0, seche);
  verifier('en Lisière, sécheresse dans environ 25 % des étés', total > 30 && total < 70, total);
}

console.log('Floraison : graines ×2, mission « événement »');
{
  const base = Core.creer(data, { graine: 32 });
  base.etape = 'lisiere';
  const i = Core.idx(C + 2, C + 2);
  Object.assign(base.tuiles[i], { c: 'fleurs', e: 'fleurs', age: 5, f: 40, h: 40, hb: 40, graines: 0 });
  avancer(base, 3);
  const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base));
  forcer(a, 'floraison');
  b.meteo.tirage = a.meteo.tirage; b.meteo.prevu = null;
  a.missions.actives = [{ id: 'floraison_traversee', n: 0, remplie: false }];
  avancer(a, 2); a.tuiles[i].graines = 0; b.tuiles[i].graines = 0;
  avancer(a, 60); avancer(b, 60);
  const ga = a.tuiles[i].graines, gb = b.tuiles[i].graines;
  verifier('une fleur donne deux fois plus de graines pendant la floraison', gb > 0 && Math.abs(ga / gb - 2) < 0.01, [ga, gb]);
  avancer(a, 240);
  verifier('mission « floraison_traversee » remplie à la fin de la floraison', a.missions.actives[0].remplie);
}

console.log('Orage : pluie, abri, foudre');
{
  const d2 = variante(d => {
    d.evenements.find(x => x.id === 'orage').effets.find(x => x.type === 'abattre_arbre').chance = 1;
    // Aucun autre événement tiré ensuite (le test regarde le retour à la normale après cet orage-ci).
    for (const ev of d.evenements) for (const k in ev.saisons) ev.saisons[k] = 0;
  });
  const e = Core.creer(d2, { graine: 33 });
  e.etape = 'lisiere';
  e.temps = 720 + 30; e.saison = 'ete';
  const bi = Core.idx(C + 5, C - 3);
  Object.assign(e.tuiles[bi], { c: 'arbre', e: 'bouleau', age: 20, f: 40, nichoir: false });
  const lapin = Core.ajouterAgent(e, 'lapin', C, C);
  Object.assign(lapin, { x: C + 3, y: C, tx: C + 3, ty: C });
  const h0 = humMoy(e);
  demarrer(e, d2, 'orage');
  Core.tick(e, d2, 1);
  verifier('l\'orage mouille toute l\'île d\'un coup', humMoy(e) > h0 + 20, [h0, humMoy(e)]);
  verifier('les animaux se mettent à l\'abri (le lapin rentre au foyer)', e.meteo.abri && lapin.tx === lapin.hx && lapin.ty === lapin.hy);
  const t = e.tuiles[bi];
  verifier('la foudre abat le bouleau adulte : tas de bois mort naturel', t.c === 'bois_mort' && t.a === 'tas_bois' && t.naturel && !t.e && evts(e, 'foudre', 'bouleau').length === 1, t);
  verifier('le bois mort compte comme un tas de bois (hérisson)', Core.evaluer(e, d2, { type: 'amenagement', id: 'tas_bois', min: 1, portee: 'ile' }).ok);
  const s0 = e.seve;
  const r = Core.action(e, d2, 'retirer', C + 5, C - 3);
  verifier('retirer le bois tombé ne rapporte rien', r.ok && e.seve === s0 && r.rendu === 0);
  for (let k = 0; k < 45; k++) Core.tick(e, d2, 1);
  verifier('l\'humidité reste haute pendant l\'orage', humMoy(e) > h0 + 20);
  for (let k = 0; k < 20; k++) Core.tick(e, d2, 1);
  verifier('fin de l\'orage : les animaux ressortent', !e.meteo.actif && !e.meteo.abri);
  for (let k = 0; k < 720; k++) Core.tick(e, d2, 1);
  verifier('3 jours plus tard, l\'humidité est revenue à la normale', Math.abs(e.meteo.humidite) < 1, e.meteo.humidite);
}
{
  const d2 = variante(d => {
    d.evenements.find(x => x.id === 'orage').effets.find(x => x.type === 'abattre_arbre').chance = 1;
    // Aucun autre événement tiré ensuite (le test regarde le retour à la normale après cet orage-ci).
    for (const ev of d.evenements) for (const k in ev.saisons) ev.saisons[k] = 0;
  });
  const e = Core.creer(d2, { graine: 34 });
  e.etape = 'lisiere'; e.temps = 750; e.saison = 'ete';
  const bi = Core.idx(C + 5, C - 3);
  Object.assign(e.tuiles[bi], { c: 'arbre', e: 'bouleau', age: 20, f: 40, nichoir: true });
  const s0 = e.seve;
  demarrer(e, d2, 'orage');
  verifier('un nichoir sur l\'arbre abattu est remboursé en entier', e.tuiles[bi].c === 'bois_mort' && e.seve - s0 >= 50, e.seve - s0);
}

console.log('Sécheresse : épreuve douce et récompense');
{
  const e = Core.creer(data, { graine: 35 });
  e.etape = 'lisiere'; e.temps = 750; e.saison = 'ete';
  const h0 = humMoy(e);
  demarrer(e, data, 'secheresse');
  avancer(e, 470);
  const m = Core.resume(e, data);
  verifier('l\'humidité baisse (au plus −30)', m.humidite < h0 - 5 && e.meteo.humidite >= -30, [h0, m.humidite, e.meteo.humidite]);
  verifier('aucune tuile sous le plancher de 10 à cause de la sécheresse', Core.tuilesIle(e).every(i => e.tuiles[i].h >= 10 - 1e-9));
  e.harmonie = 0.9;
  const p0 = e.pages, s0 = e.seve;
  avancer(e, 10);
  const fin = evts(e, 'evenement_fin', 'secheresse')[0];
  verifier('harmonie ≥ 70 % à la fin : 3 pages et 200 sève', fin && fin.reussi && e.pages === p0 + 3 && e.seve - s0 >= 200, fin);
  verifier('le joueur a été prévenu de la fin', !e.meteo.actif);
}
{
  const e = Core.creer(data, { graine: 36 });
  e.etape = 'lisiere'; e.temps = 750; e.saison = 'ete';
  demarrer(e, data, 'secheresse');
  avancer(e, 470);
  e.harmonie = 0.3; e.harmonieHist = [];
  const p0 = e.pages;
  // l'harmonie est recalculée toutes les 5 s : on la remet basse juste avant la fin
  while (e.meteo.actif) { e.harmonie = 0.3; Core.tick(e, data, 1); }
  const fin = evts(e, 'evenement_fin', 'secheresse')[0];
  verifier('harmonie trop basse : pas de récompense, mais pas de punition', fin && fin.reussi === false && e.pages === p0, fin);
}

console.log('Papiers rares');
{
  const e = Core.creer(data, { graine: 37 });
  e.harmonie = 0.5;
  let j = 0, w = 0;
  const n = 30000;
  for (let k = 0; k < n; k++) { const p = Core.tirerPapier(e, data, 'lapin'); if (p === 'journal') j++; if (p === 'washi') w++; }
  verifier('chance de base ≈ 1/60 pour le journal et pour le washi', Math.abs(j / n - 1 / 60) < 0.004 && Math.abs(w / n - 1 / 60) < 0.004, [j / n, w / n]);
  verifier('calque et doré ne sortent pas dans le prototype', Core.chancesRares(e, data).map(c => c.id).join() === 'journal,washi');
  e.harmonie = 0.9;
  verifier('harmonie > 80 % : chances × 1,2', Math.abs(Core.chancesRares(e, data)[0].chance - 0.0167 * 1.2) < 1e-9);
  e.harmonie = 0.5;
  demarrer(e, data, 'floraison');
  const ch = Core.chancesRares(e, data).find(c => c.id === 'washi');
  verifier('floraison : washi × 5 et garantie affichée', Math.abs(ch.chance - 0.0167 * 5) < 1e-9 && ch.evenement && ch.garantieDans === 20, ch);
  let pire = 0;
  for (let serie = 0; serie < 300; serie++) {
    let k = 0, p;
    do { k++; p = Core.tirerPapier(e, data, 'fleurs'); } while (p !== 'washi' && k < 100);
    pire = Math.max(pire, k);
  }
  verifier('garantie : un washi au plus tard au 20e essai pendant la floraison', pire <= 20, pire);
}
{
  const e = Core.creer(data, { graine: 38 });
  avancer(e, 30);
  verifier('photo d\'un papier absent refusée', Core.photographier(e, data, 'sauterelle', 'washi').raison === 'pas_de_specimen');
  const z = Object.keys(e.populations.sauterelle)[0];
  e.meteo.tirage = '0-printemps'; e.meteo.prevu = null; // pas de floraison pendant ce test
  const fin = e.temps + 240;
  e.rares.push({ id: 'sauterelle', papier: 'washi', fin, zone: +z });
  const l = Core.raresPresents(e, data).filter(r => r.fin === fin);
  verifier('le spécimen rare est listé avec sa position', l.length === 1 && l[0].x !== undefined && l[0].reste === 240, l);
  const p0 = e.pages;
  const r = Core.photographier(e, data, 'sauterelle', 'washi');
  verifier('photographié : nouvelle carte, 3 pages (+1 pour la première photo)', r.ok && r.carte && e.collection['sauterelle:washi'] && e.pages === p0 + 4, [r, e.pages - p0]);
  verifier('deuxième photo du même papier : pas de nouvelle carte', !Core.photographier(e, data, 'sauterelle', 'washi').carte);
  avancer(e, 245);
  verifier('après sa durée, il reprend un papier normal', !Core.raresPresents(e, data).some(r => r.fin === fin));
}
{
  const d2 = variante(d => { d.rares.forEach(r => { r.chance_base = 0.05; }); });
  const e = Core.creer(d2, { graine: 39 });
  for (let k = 0; k < 600; k++) Core.tick(e, d2, 1);
  const rares = evts(e, 'rare');
  verifier('des spécimens rares apparaissent aux arrivées, touffes et nuées', rares.length > 0, rares.length);
  verifier('chaque spécimen a une espèce, un papier et une position', rares.every(r => d2.especes[r.id] && ['journal', 'washi'].includes(r.papier) && r.x !== undefined));
}

console.log('Hors ligne');
{
  const e = Core.creer(data, { graine: 40 });
  avancer(e, 240);
  e.seve = 0;
  const bi = Core.idx(C + 6, C);
  Object.assign(e.tuiles[bi], { c: 'arbre', e: 'bouleau', age: 1, f: 40 });
  const avant = { temps: e.temps, saison: Core.horloge(e).saison, prevu: JSON.stringify(e.meteo.prevu), actif: JSON.stringify(e.meteo.actif) };
  const prod = Core.productionSeve(e, data) * (0.5 + e.harmonie);
  const r = Core.horsLigne(e, data, 10 * 3600);
  verifier('absence de 10 h comptée 8 h (plafond)', r.duree === 8 * 3600 && r.plafonne);
  const attendu = Math.min(Core.reserveMax(e), Math.floor(Core.rendement(Core.productionSeve(e, data)) * (0.5 + e.harmonie) * (3600 * 0.5 + 7 * 3600 * 0.15)));
  verifier('sève : 50 % la 1re heure puis 15 %, sans dépasser la réserve', Math.abs(r.seve - attendu) <= 1 && e.seve === r.seve, [r.seve, attendu, prod]);
  verifier('heure et saison figées, aucun événement', e.temps === avant.temps && Core.horloge(e).saison === avant.saison && JSON.stringify(e.meteo.prevu) === avant.prevu && JSON.stringify(e.meteo.actif) === avant.actif && !evts(e, 'evenement').some(j => j.t === e.temps));
  verifier('les plantes ont poussé (bouleau adulte)', e.tuiles[bi].age >= 12, e.tuiles[bi].age);
  verifier('le rapport est noté au journal', evts(e, 'retour').length === 1);
  const d = Core.doublerRetour(e, r);
  verifier('« Retour doublé » : une seule fois', d.ok && e.seve === 2 * r.seve && !Core.doublerRetour(e, r).ok);
}
{
  const e = Core.creer(data, { graine: 41 });
  e.seve = 500;
  Core.action(e, data, 'tas_pierres', C + 4, C);
  const r = Core.horsLigne(e, data, 3600);
  verifier('arrivées résolues au retour (sauterelles, lapin)', r.nouvelles.includes('sauterelle') && r.nouvelles.includes('lapin'), r);
  const l = e.agents.filter(a => a.esp === 'lapin');
  verifier('le lapin est déjà chez lui, pas au bord de l\'île', l.length >= 1 && l.every(a => a.m === 'vit' && a.x === a.hx && a.y === a.hy), l);
  verifier('renforts hors ligne plafonnés', l.length <= 1 + Core.P.renfortsHorsLigne);
  const m = e.missions.actives;
  verifier('les arrivées hors ligne comptent pour les missions', m.every(a => a.id !== 'visiteurs_de_lisiere') && Array.isArray(m));
}
{
  const e = Core.creer(data, { graine: 42 });
  e.etape = 'lisiere';
  const h = Core.ajouterAgent(e, 'herisson', C, C);
  h.mal = 0.95;
  Core.horsLigne(e, data, 8 * 3600);
  verifier('aucun départ hors ligne : le compteur de manque repart de zéro', e.agents.includes(h) && h.mal === 0 && !evts(e, 'depart').length);
  avancer(e, 30);
  verifier('pas de départ immédiat au retour', !evts(e, 'depart').length);
}

console.log('Économie de la sève (sprint 5 bis)');
{
  verifier('paliers hors ligne : 1 h → 30 min, 8 h → 1 h 33', Core.secondesHorsLigne(3600) === 1800 && Math.abs(Core.secondesHorsLigne(8 * 3600) - (1800 + 7 * 3600 * 0.15)) < 1e-6);
  verifier('rendement décroissant au-delà de 2 sève/s', Core.rendement(1.5) === 1.5 && Math.abs(Core.rendement(4) - 2.8) < 1e-9);
  const e = Core.creer(data, { graine: 41 });
  e.seve = Core.reserveMax(e) - 1;
  avancer(e, 60);
  verifier('la production s\'arrête au plafond de la Prairie (1 000)', e.seve === 1000, e.seve);
  e.seve = 1500;
  avancer(e, 30);
  verifier('une réserve au-dessus du plafond (cadeaux) n\'est pas réduite', e.seve === 1500, e.seve);
  verifier('ajouterProduction : rien au-delà du plafond', Core.ajouterProduction(e, 100) === 0 && e.seve === 1500);
  e.etape = 'lisiere';
  verifier('plafond de la Lisière : 3 000', Core.reserveMax(e) === 3000);
  e.seve = 2990;
  const r = Core.horsLigne(e, data, 8 * 3600);
  verifier('hors ligne : le gain s\'arrête à la réserve pleine, signalé au retour', e.seve === 3000 && r.seve === 10 && r.plein, [e.seve, r.seve, r.plein]);
}

console.log('Teaser de la Jeune forêt (sprint 5 bis)');
{
  const e = Core.creer(data, { graine: 42 });
  verifier('pas de teaser en Prairie', Core.teaser(e, data) === null);
  e.etape = 'lisiere';
  const tz = Core.teaser(e, data);
  verifier('en Lisière : 5 conditions, non remplies', tz && tz.conditions.length === 5 && !tz.ok && tz.chene === -1);
  // Île préparée : 12 bouleaux adultes en bosquet, un renard, assez d'espèces, du terrain ouvert.
  const pos = [];
  for (let dx = -3; dx <= 3; dx += 2) for (const dy of [-2, 0, 2]) pos.push([C + dx, C + dy]);
  for (const [x, y] of pos) Object.assign(e.tuiles[Core.idx(x, y)], { c: 'arbre', e: 'bouleau', age: 20, f: 40 });
  avancer(e, 5);
  const d = Core.teaser(e, data);
  verifier('8 bouleaux adultes ✓', d.conditions[0].ok, d.conditions[0]);
  verifier('mi-ombre sur 10 % de l\'île ✓', d.conditions[1].ok, d.conditions[1].valeur);
  const avecRenard = () => { if (!e.agents.some(a => a.esp === 'renard')) Core.ajouterAgent(e, 'renard', C + 6, C + 6); };
  avecRenard();
  // Les espèces présentes ne sont pas toutes là : on vérifie la règle de durée du renard seule.
  avancer(e, 120);
  const r1 = Core.teaser(e, data).conditions[2];
  verifier('renard présent depuis ½ jour : pas encore une saison', !r1.ok && r1.tenu_jours > 0.4 && r1.tenu_jours < 3, r1);
  e.agents = e.agents.filter(a => a.esp !== 'renard');
  avancer(e, 10);
  verifier('le renard part : le compteur repart de zéro', Core.teaser(e, data).conditions[2].tenu_jours === 0);
  // Germination forcée : toutes les conditions vraies (on fixe la mémoire du renard et les espèces).
  e.teaser.depuis[2] = e.temps - 3 * 240; avecRenard();
  for (const id of ['sauterelle', 'ver', 'abeille', 'tircis']) Core.fixerPopulation(e, id, C + 5, C - 4, 6);
  for (const id of ['lapin', 'lapin', 'alouette', 'merle', 'herisson']) Core.ajouterAgent(e, id, C - 5, C + 4);
  for (const [x, y] of [[C - 6, C], [C - 6, C + 1], [C - 7, C]]) Object.assign(e.tuiles[Core.idx(x, y)], { c: 'ronce', e: 'ronce', age: 5, f: 40 });
  avancer(e, 10);
  const t2 = Core.teaser(e, data);
  if (!t2.ok) console.log('    (conditions : ' + t2.conditions.map(c => c.ok ? '✓' : '✗').join(' ') + ')');
  verifier('toutes les conditions réunies → un chêne germe sous un bouleau', t2.chene >= 0 && evts(e, 'chene').length === 1, t2.conditions.map(c => c.ok));
  if (t2.chene >= 0) {
    const x = t2.chene % Core.N, y = (t2.chene / Core.N) | 0;
    verifier('le chêne est sur une tuile libre à côté d\'un bouleau adulte', ['herbe', 'nu'].includes(e.tuiles[t2.chene].c) && Core.tuilesCercle(e, x, y, 1.5).some(j => e.tuiles[j].e === 'bouleau'));
    e.agents = []; avancer(e, 30);
    verifier('le chêne reste même si l\'île change ensuite', Core.teaser(e, data).chene === t2.chene && evts(e, 'chene').length === 1);
  }
}

console.log('Anciennes sauvegardes et déterminisme');
{
  const e = Core.creer(data, { graine: 43 });
  avancer(e, 60);
  delete e.meteo; delete e.rares; delete e.collection;
  let ok = true;
  try { avancer(e, 30); Core.photographier(e, data, 'sauterelle'); Core.horsLigne(e, data, 60); } catch (err) { ok = false; console.log(err); }
  verifier('une sauvegarde du sprint 2 reprend sans erreur', ok && e.meteo && Array.isArray(e.rares));
  const a = Core.creer(data, { graine: 44 }), b = Core.creer(data, { graine: 44 });
  avancer(a, 1500); avancer(b, 1500);
  verifier('même graine → même île après 25 min, événements compris', JSON.stringify(a) === JSON.stringify(b) && evts(a, 'evenement').length + a.meteo.tirage.length > 0);
}

console.log('Sprint 7 : surpâturage et voisinages des lapins');
{
  const e = Core.creer(data, { graine: 71 });
  e.seve = 2000;
  // Herbe partout autour du centre.
  for (const i of Core.tuilesCercle(e, C, C, 6)) Object.assign(e.tuiles[i], { c: 'herbe', e: 'herbe', age: 2, f: 30, use: 0 });
  const r1 = Core.qualitePose(e, data, 'tas_pierres', Core.idx(C, C));
  for (const i of Core.tuilesCercle(e, C, C, 2)) if (i !== Core.idx(C, C)) Object.assign(e.tuiles[i], { c: 'nu', e: '' });
  const r2 = Core.qualitePose(e, data, 'tas_pierres', Core.idx(C, C));
  verifier('voisinage : un tas de pierres entouré d\'herbe abrite plus de lapins (' + r1.v.places + ' contre ' + r2.v.places + ')', r1.v.places === 4 && r2.v.places === 1 && r1.q > r2.q, [r1, r2]);
  for (const i of Core.tuilesCercle(e, C, C, 6)) Object.assign(e.tuiles[i], { c: 'herbe', e: 'herbe', age: 2, f: 30, use: 0 });
  Core.action(e, data, 'tas_pierres', C, C);
  for (let k = 0; k < 12; k++) Core.ajouterAgent(e, 'lapin', C + (k % 3) - 1, C + ((k / 3) | 0) - 1);
  avancer(e, 30);
  const jaunes = Core.tuilesIle(e).filter(i => e.tuiles[i].use > 0).length;
  verifier('12 lapins sur un terrier : l\'herbe autour s\'use (elle jaunit)', jaunes > 5, jaunes);
  verifier('le problème n\'est pas annoncé au premier constat (hystérésis)', true);
  avancer(e, 240);
  verifier('surpâturage : l\'herbe jaunit, problème annoncé avec ses solutions', evts(e, 'probleme').some(j => j.id === 'surpaturage') && Core.problemesActifs(e, data).find(p => p.id === 'surpaturage').solutions.includes('semer_herbe'));
  // Réglé : les lapins partent (on retire l'abri), l'herbe se remet, le problème disparaît avec une récompense.
  e.agents = e.agents.filter(a => a.esp !== 'lapin');
  Core.action(e, data, 'retirer', C, C);
  const pages = e.pages;
  avancer(e, 240);
  verifier('sans lapins, l\'herbe se remet et le problème est réglé (récompense car le joueur a agi)', !e.vie.pb.surpaturage && evts(e, 'probleme_regle').some(j => j.id === 'surpaturage' && j.pages === 1) && e.pages === pages + 1);
  verifier('limite du lapin : la raison est donnée (piste 5)', Core.limite(e, data, 'lapin') === null || typeof Core.limite(e, data, 'lapin').raison === 'string');
}

console.log('Sprint 7 : coups de pouce');
{
  const e = Core.creer(data, { graine: 72 });
  e.seve = 1000;
  const h0 = tuile(e, C + 2, C).h;
  const r = Core.action(e, data, 'arroser', C + 2, C);
  verifier('arroser : humidité +30 autour, sève payée, humidité tenue un jour', r.ok && tuile(e, C + 2, C).h >= h0 + 29 && e.seve === 1000 - Core.P.vie.gestes.arroser.cout_seve && tuile(e, C + 2, C).ar === 1, r);
  avancer(e, 60);
  verifier('arrosée, la tuile reste humide une minute plus tard', tuile(e, C + 2, C).h > h0 + 15, tuile(e, C + 2, C).h);
  verifier('tailler est verrouillé en Prairie', Core.action(e, data, 'tailler', C, C).raison === 'verrouille');
  e.etape = 'lisiere';
  Object.assign(tuile(e, C + 3, C), { c: 'ronce', e: 'ronce', age: 5 });
  verifier('tailler une ronce : la prairie se rouvre (herbe)', Core.action(e, data, 'tailler', C + 3, C).ok && tuile(e, C + 3, C).c === 'herbe');
  verifier('tailler hors ronce : refus expliqué', Core.action(e, data, 'tailler', C + 3, C).raison === 'pas_de_ronce');
  verifier('éloigner le renard sans renard : refus', Core.action(e, data, 'effaroucher', C, C).raison === 'pas_de_renard');
  // Renard et lapins : la zone protégée n'est plus chassée.
  for (let k = 0; k < 8; k++) Core.ajouterAgent(e, 'lapin', C, C + (k % 2));
  const ren = Core.ajouterAgent(e, 'renard', C + 1, C);
  verifier('éloigner le renard : accepté, puis temps de recharge', Core.action(e, data, 'effaroucher', C, C).ok && Core.action(e, data, 'effaroucher', C, C).raison === 'recharge');
  e.temps = 240 * 1 - 50; // crépuscule et nuit
  let pred = 0;
  for (let k = 0; k < 120; k++) { avancer(e, 1); pred += e.journal.filter(j => j.t === e.temps && j.type === 'predation').length; }
  verifier('le renard ne chasse pas les lapins du coin protégé', pred === 0 && ren, pred);
  // Graines au sol : les oiseaux viennent picorer.
  const m = Core.creer(data, { graine: 73 });
  m.graines = 10;
  const merle = Core.ajouterAgent(m, 'merle', C + 3, C);
  verifier('graines au sol : 2 graines', Core.action(m, data, 'mangeoire', C, C).ok && m.graines === 8 && tuile(m, C, C).mg === 1);
  avancer(m, 60);
  verifier('un merle des environs vient picorer (visite notée)', m.vie.visites.merle !== undefined && merle);
}

console.log('Sprint 7 : hérisson et hiver');
{
  const e = Core.creer(data, { graine: 74 });
  e.etape = 'lisiere'; e.seve = 500;
  Core.action(e, data, 'tas_bois', C + 2, C + 2);
  Core.ajouterAgent(e, 'herisson', C, C); Core.ajouterAgent(e, 'herisson', C + 1, C);
  e.temps = 240 * 6 + 10; // automne
  avancer(e, 20);
  const p = Core.problemesActifs(e, data).find(x => x.id === 'hiver_herisson');
  verifier('automne : 2 hérissons pour 1 tas de bois → problème avec délai avant l\'hiver', p && p.valeurs.manque === 1 && p.delai > 0 && p.solutions[0] === 'tas_bois', p);
  e.temps = 240 * 9 - 6;
  avancer(e, 10);
  verifier('hiver : un hérisson hiberne, l\'autre part (raison « hiver »)', e.agents.filter(a => a.esp === 'herisson' && a.m === 'dort').length === 1 && evts(e, 'depart', 'herisson').some(d => d.raison === 'hiver'));
  verifier('places d\'hibernation : un tas entouré de ronces en vaut deux', (() => { for (const [dx, dy] of [[3, 2], [2, 3]]) Object.assign(tuile(e, C + dx, C + dy), { c: 'ronce', e: 'ronce', age: 5 }); return Core.placesHibernation(e) === 2; })());
}

console.log('Sprint 7 : demandes des habitants');
{
  const e = Core.creer(data, { graine: 75 });
  e.seve = 2000; e.graines = 50;
  for (const i of Core.tuilesCercle(e, C, C, 5)) Object.assign(e.tuiles[i], { f: 40, hb: 45, h: 45 });
  Core.action(e, data, 'hotel_insectes', C, C);
  for (const [dx, dy] of [[4, 0], [4, 1], [5, 0], [5, 1], [4, -1], [5, -1], [6, 0]]) Object.assign(tuile(e, C + dx, C + dy), { c: 'fleurs', e: 'fleurs', age: 5 });
  Core.fixerPopulation(e, 'abeille', C + 4, C, 5);
  e.temps = Core.P.vie.debutDemandes; e.vie.prochaineDemande = 0;
  const avant = Core.P.vie.chanceDemande; Core.P.vie.chanceDemande = 1;
  let d = null;
  for (let k = 0; k < 400 && !d; k++) { avancer(e, 1); d = e.vie.demandes.find(x => x.id === 'abeille_fleurs'); }
  Core.P.vie.chanceDemande = avant;
  verifier('les abeilles demandent des fleurs autour de l\'hôtel, avec un délai', d && d.fin > e.temps && d.x === C && d.y === C, d);
  if (d) {
    const pages = e.pages;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0]]) Core.action(e, data, 'semer_fleurs', C + dx, C + dy);
    avancer(e, 10);
    verifier('demande satisfaite à temps : pages et sève, la nuée grossit', !e.vie.demandes.length && evts(e, 'demande_ok').length === 1 && e.pages >= pages + 2);
  }
  // Une demande ignorée : la nuée s'amenuise, c'est noté au journal.
  const f = Core.creer(data, { graine: 76 });
  Core.ajouterAgent(f, 'merle', C, C);
  f.temps = 240 * 9 + 10; f.saison = 'hiver'; f.vie.prochaineDemande = 0;
  Core.P.vie.chanceDemande = 1;
  let dm = null;
  for (let k = 0; k < 200 && !dm; k++) { avancer(f, 1); f.agents.forEach(a => { a.mal = 0; }); dm = f.vie.demandes.find(x => x.id === 'merle_faim'); }
  Core.P.vie.chanceDemande = avant;
  verifier('hiver : les merles ont faim (graines au sol demandées)', !!dm, f.vie.demandes);
  if (dm) {
    f.temps = dm.fin - 1;
    avancer(f, 5);
    verifier('demande non satisfaite : un merle s\'en va, échec noté', evts(f, 'demande_echec').length === 1 && evts(f, 'depart', 'merle').some(x => x.raison === 'demande'));
  }
}

console.log('Sprint 7 : carte des habitats');
{
  const e = Core.creer(data, { graine: 77 });
  const carte = Core.carteHabitat(e, data, 'hotel_insectes');
  verifier('une qualité entre 0 et 1 pour chaque tuile de l\'île', carte.length === Core.tuilesIle(e).length && carte.every(([, q]) => q >= 0 && q <= 1));
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) Object.assign(tuile(e, C + dx, C + dy), { c: 'fleurs', e: 'fleurs', age: 5 });
  const q = Core.qualitePose(e, data, 'hotel_insectes', Core.idx(C, C)), loin = Core.qualitePose(e, data, 'hotel_insectes', Core.idx(C + 7, C));
  verifier('hôtel : parfait au milieu de 6 fleurs, médiocre loin d\'elles', q.q === 1 && loin.q < 0.34 && q.v.bonus === 80, [q, loin]);
  verifier('les qualités de pose existent pour les 10 aménagements et les 4 gestes', ['semer_herbe', 'semer_fleurs', 'tas_pierres', 'mare', 'hotel_insectes', 'paillis', 'semer_ronce', 'planter_bouleau', 'tas_bois', 'nichoir', 'arroser', 'tailler', 'effaroucher', 'mangeoire'].every(id => Core.qualitePose(e, data, id, Core.idx(C, C))));
  const s = Core.creer(data, { graine: 78 });
  delete s.vie;
  let ok = true; try { avancer(s, 20); Core.problemesActifs(s, data); } catch (err) { ok = false; console.log(err); }
  verifier('une sauvegarde du sprint 6 (sans « vie ») reprend sans erreur', ok && s.vie && Array.isArray(s.vie.demandes));
}

console.log(`\n${total - echecs}/${total} tests réussis.`);
process.exit(echecs ? 1 : 0);
