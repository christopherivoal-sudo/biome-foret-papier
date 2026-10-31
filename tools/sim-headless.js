#!/usr/bin/env node
// Simulation accélérée avec un joueur automatique « moyen » (GDD 10.4 et 10.6).
// Usage : node tools/sim-headless.js [--parties 20] [--minutes 60] [--graine 1] [--detail]
// Mesure : première arrivée, passage à la Lisière, venue des 14 espèces, départs, rythme des événements,
// sève, fertilité et humidité. Le joueur agit au plus une fois toutes les 4 secondes.
// Sprint 3 : événements (nombre, effet sur l'humidité, récompense de la sécheresse), papiers rares
// (spécimens apparus, cartes de collection), retour après 8 h hors ligne (mesuré sur une copie à 30 min).
'use strict';
const Core = require('../src/core.js');
const data = Core.preparer(require('./donnees.js')());
const { N, CENTRE: C } = Core;

const args = process.argv.slice(2);
const opt = (nom, def) => { const k = args.indexOf('--' + nom); return k >= 0 ? Number(args[k + 1]) : def; };
const PARTIES = opt('parties', 20), MINUTES = opt('minutes', 60), GRAINE = opt('graine', 1), DETAIL = args.includes('--detail');
const DELAI_JOUEUR = 4;

const coord = i => [i % N, (i / N) | 0];
const dist = (i, x, y) => Math.hypot((i % N) - x, ((i / N) | 0) - y);

// ---------- Joueur automatique ----------
function joueur(e) {
  const T = Core.tuilesIle(e).map(i => ({ i, t: e.tuiles[i] }));
  const essayer = (action, i) => { const [x, y] = coord(i); return Core.action(e, data, action, x, y).ok; };
  const nb = c => T.filter(o => o.t.c === c).length;
  const nbAm = id => new Set(T.filter(o => o.t.a === id).map(o => o.t.ancre)).size;
  const lisiere = e.etape !== 'prairie';

  // 1. Missions remplies, photos, récolte : gestes gratuits du joueur attentif.
  const m = e.missions.actives.find(a => a.remplie);
  if (m) return Core.reclamerMission(e, data, m.id);
  const aPhotographier = Core.especesPresentes(e, data).find(id => !(e.carnet[id] && e.carnet[id].photo));
  if (aPhotographier) return Core.photographier(e, data, aPhotographier);
  const rare = Core.raresPresents(e, data).find(r => !e.collection[r.id + ':' + r.papier]);
  if (rare) return Core.photographier(e, data, rare.id, rare.papier);
  const mure = T.find(o => o.t.graines >= 1);
  if (mure) return essayer('recolter', mure.i);

  // 2. Passage d'étape et agrandissement.
  const s = Core.etapeSuivante(e, data);
  if (s && s.ok) return Core.passerEtape(e, data);
  if (lisiere && e.rayon < 11) { if (e.seve >= 400) return Core.action(e, data, 'agrandir'); return; }

  const nus = T.filter(o => o.t.c === 'nu' && !o.t.a);
  const parFertilite = l => l.slice().sort((a, b) => b.t.f - a.t.f);
  const fleurs = nb('fleurs');
  const semerFleurs = () => { for (const o of parFertilite(T.filter(o => (o.t.c === 'nu' || o.t.c === 'herbe') && !o.t.a)).slice(0, 15)) if (essayer('semer_fleurs', o.i)) return true; };
  const poser = (action, filtre, cle) => { const l = nus.filter(filtre).sort((a, b) => cle(a) - cle(b)); for (const o of l.slice(0, 10)) if (essayer(action, o.i)) return true; };

  // 3. Prairie : fleurs, hôtel, abri, mares, paillis, herbe.
  if (fleurs < 4 && e.graines >= 1 && semerFleurs()) return;
  if (!nbAm('hotel_insectes') && fleurs >= 4) {
    const fl = T.filter(o => o.t.c === 'fleurs'), cx = fl.reduce((s, o) => s + o.i % N, 0) / fl.length, cy = fl.reduce((s, o) => s + ((o.i / N) | 0), 0) / fl.length;
    if (poser('hotel_insectes', () => true, o => dist(o.i, cx, cy))) return;
    return;
  }
  if (!nbAm('tas_pierres')) { if (poser('tas_pierres', o => dist(o.i, C, C) > 4, o => dist(o.i, C, C))) return; return; }
  const maresVoulues = lisiere ? 4 : 3;
  if (nbAm('mare') < maresVoulues) {
    // Mares réparties autour du centre, à mi-rayon.
    const ang = nbAm('mare') * 2.2, mx = C + 0.55 * e.rayon * Math.cos(ang), my = C + 0.55 * e.rayon * Math.sin(ang);
    if (poser('mare', o => true, o => dist(o.i, mx, my))) return;
    if (e.seve < 80) return;
  }
  if (fleurs < 10 && e.graines >= 1 && semerFleurs()) return;

  // 4. Lisière : ronces, tas de bois, bouleaux, nichoir.
  if (lisiere) {
    const pierres = T.find(o => o.t.a === 'tas_pierres');
    const [px, py] = pierres ? coord(pierres.i) : [C, C];
    if (nb('ronce') < 6 && e.graines >= 2) {
      for (const o of parFertilite(T.filter(o => (o.t.c === 'nu' || o.t.c === 'herbe') && !o.t.a && dist(o.i, px, py) < 6)).slice(0, 10)) if (essayer('semer_ronce', o.i)) return;
    }
    if (nb('ronce') >= 3 && nbAm('tas_bois') < 2) {
      const r = T.filter(o => o.t.c === 'ronce');
      const [rx, ry] = coord(r[0].i);
      if (poser('tas_bois', () => true, o => dist(o.i, rx, ry))) return;
    }
    const bouleaux = T.filter(o => o.t.e === 'bouleau').length;
    if (bouleaux < 10 && e.graines >= 3) {
      // Un bosquet de bouleaux en bord d'île, à côté des ronces : une vraie lisière (mi-ombre pour le tircis).
      const ang = Math.atan2(py - C, px - C), bx = C + (e.rayon - 3) * Math.cos(ang), by = C + (e.rayon - 3) * Math.sin(ang);
      const l = T.filter(o => (o.t.c === 'nu' || o.t.c === 'herbe') && !o.t.a && T.every(b => b.t.e !== 'bouleau' || dist(o.i, b.i % N, (b.i / N) | 0) >= 2))
        .sort((a, b) => dist(a.i, bx, by) - dist(b.i, bx, by));
      for (const o of l.slice(0, 10)) if (essayer('planter_bouleau', o.i)) return;
    }
    const adulte = T.find(o => o.t.e === 'bouleau' && o.t.age >= data.especes.bouleau.croissance.jours_adulte && !o.t.nichoir);
    if (adulte && nbAm('nichoir') === 0 && T.filter(o => o.t.nichoir).length < 2) { if (essayer('nichoir', adulte.i)) return; }
  }

  // 5. Paillis sur les tuiles pauvres près des fleurs, puis herbe sur le sol nu.
  const vegetal = (nb('herbe') + nb('fleurs')) / T.length;
  if (vegetal < 0.7 && e.seve >= 5) {
    const l = nus.filter(o => o.t.f >= 5 && o.t.o <= 60).sort((a, b) => dist(a.i, C, C) - dist(b.i, C, C));
    for (const o of l.slice(0, 5)) if (essayer('semer_herbe', o.i)) return;
  }
  if (e.seve >= 60) {
    const l = T.filter(o => !o.t.a && !o.t.paillis && o.t.c !== 'eau' && o.t.c !== 'roche' && o.t.f < 30).sort((a, b) => a.t.f - b.t.f);
    if (l.length && essayer('paillis', l[0].i)) return;
  }
}

// ---------- Une partie ----------
function partie(graine) {
  const e = Core.creer(data, { graine });
  const r = { graine, premiereArrivee: null, lisiere: null, venues: {}, partis: {}, departsIndiv: {}, evenements: [], seve: {}, a15: null, maxTrou: 0,
    meteo: [], rares: 0, raresManques: 0, humMin: 100, retour: null };
  let attente = 0, dernierEvt = 0, lu = 0;
  const VISIBLES = new Set(['arrivee', 'renfort', 'naissance', 'predation', 'dispersion', 'repas', 'mission', 'depart', 'migration', 'hibernation', 'reveil', 'etape', 'pollinisation', 'graines', 'surpaturage',
    'annonce', 'evenement', 'evenement_fin', 'foudre', 'rare', 'collection']);
  let ev = null;
  for (let t = 1; t <= MINUTES * 60; t++) {
    Core.tick(e, data, 1);
    for (const j of e.journal.filter(j => j.t === e.temps)) {
      if (VISIBLES.has(j.type)) { if (e.temps - dernierEvt > r.maxTrou) { r.maxTrou = e.temps - dernierEvt; r.trouA = dernierEvt; } dernierEvt = e.temps; }
      if (j.type === 'arrivee') {
        if (r.premiereArrivee === null) r.premiereArrivee = e.temps;
        if (r.venues[j.id] === undefined) r.venues[j.id] = e.temps;
      }
      if (j.type === 'parti') r.partis[j.id] = (r.partis[j.id] || 0) + 1;
      if (j.type === 'depart') r.departsIndiv[j.id] = (r.departsIndiv[j.id] || 0) + 1;
      if (j.type === 'evenement') { ev = { id: j.id, debut: e.temps, humAvant: Core.resume(e, data).humidite, humMin: 100, especesAvant: Core.especesPresentes(e, data).length }; r.meteo.push(ev); }
      if (j.type === 'evenement_fin' && ev) { Object.assign(ev, { reussi: j.reussi, especesApres: Core.especesPresentes(e, data).length, flAvant: ev.flAvant }); ev = null; }
      if (j.type === 'foudre') r.meteo[r.meteo.length - 1].foudre = true;
      if (j.type === 'rare') r.rares++;
      if (j.type === 'chene') r.chene = e.temps;
      r.evenements.push(j.type);
    }
    // Plantes semées : « venue » au premier semis.
    for (const id of ['herbe', 'fleurs', 'ronce', 'bouleau']) if (r.venues[id] === undefined && Core.presence(e, data, id) > 0) r.venues[id] = e.temps;
    if (ev && t % 10 === 0) { const h = Core.resume(e, data).humidite; ev.humMin = Math.min(ev.humMin, h); }
    if (--attente <= 0) { joueur(e); attente = DELAI_JOUEUR; }
    if (t === 1800) {
      // Retour après 8 h d'absence, sur une copie (la partie continue normalement).
      const copie = JSON.parse(JSON.stringify(e));
      const avant = Core.especesPresentes(copie, data).length;
      const rap = Core.horsLigne(copie, data, 10 * 3600);
      r.retour = { seve: rap.seve, plafonne: rap.plafonne, nouvelles: rap.nouvelles.length, arrivees: rap.arrivees.length, especesAvant: avant, especesApres: Core.especesPresentes(copie, data).length, seveAvant: Math.round(e.seve) };
      // Une minute de jeu après le retour : aucun départ immédiat attendu.
      for (let k = 0; k < 60; k++) Core.tick(copie, data, 1);
      r.retour.departs1min = copie.journal.filter(j => j.type === 'depart' && j.t > copie.temps - 60).length;
    }
    if (r.lisiere === null && e.etape === 'lisiere') r.lisiere = e.temps;
    if (t % 300 === 0) r.seve[t / 60] = Math.round(e.seve);
    if (t === 900) {
      const s = Core.etapeSuivante(e, data);
      r.a15 = { res: Core.resume(e, data), conditions: s ? s.conditions.map(c => ({ type: c.type, ok: c.ok, valeur: typeof c.valeur === 'number' ? +c.valeur.toFixed(2) : c.valeur })) : null };
    }
  }
  r.fin = Core.resume(e, data);
  const tz = Core.teaser(e, data); if (tz) r.teaserFin = tz.conditions;
  r.cartes = Object.keys(e.collection).length;
  r.pages = e.pages;
  return r;
}

// Utilisé comme module (tools/scenes.js) : on expose le joueur automatique sans lancer le rapport.
if (require.main !== module) { module.exports = { joueur }; return; }

// ---------- Rapport ----------
const t0 = Date.now();
const res = [];
for (let k = 0; k < PARTIES; k++) res.push(partie(GRAINE + k));
const ms = Date.now() - t0;
const med = l => { const s = l.filter(v => v !== null && v !== undefined).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mmss = s => s === null || s === undefined ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

console.log(`Simulation : ${PARTIES} parties de ${MINUTES} min (${(ms / 1000).toFixed(1)} s de calcul).\n`);
console.log(`Première arrivée : médiane ${mmss(med(res.map(r => r.premiereArrivee)))}, max ${mmss(Math.max(...res.map(r => r.premiereArrivee || 1e9)))}  (cible < 0:30)`);
const lis = res.map(r => r.lisiere);
console.log(`Lisière atteinte : ${lis.filter(v => v !== null).length}/${PARTIES} parties, médiane ${mmss(med(lis))}, min ${mmss(Math.min(...lis.filter(v => v !== null)))}, max ${mmss(Math.max(...lis.filter(v => v !== null)))}  (cible 12 à 20 min)`);
console.log(`Plus long moment sans événement visible : médiane ${med(res.map(r => r.maxTrou))} s  (cible ≤ 60 s)`);
const toutes = Object.keys(data.especes);
const completes = res.filter(r => toutes.every(id => r.venues[id] !== undefined)).length;
console.log(`Les 14 espèces venues au moins une fois : ${completes}/${PARTIES} parties  (cible 90 %)\n`);
console.log('Espèce        venue (méd.)  jamais venue   départs complets/h  départs individuels/h');
for (const id of toutes) {
  const v = res.map(r => r.venues[id]);
  const jamais = v.filter(x => x === undefined).length;
  const partis = res.reduce((s, r) => s + (r.partis[id] || 0), 0) / PARTIES / (MINUTES / 60);
  const indiv = res.reduce((s, r) => s + (r.departsIndiv[id] || 0), 0) / PARTIES / (MINUTES / 60);
  console.log(`${id.padEnd(13)} ${mmss(med(v)).padStart(8)}      ${String(jamais).padStart(4)}           ${partis.toFixed(1).padStart(5)}               ${indiv.toFixed(1).padStart(5)}`);
}
const moy = f => (res.reduce((s, r) => s + f(r), 0) / res.length);
console.log(`\nSève en réserve (médiane) : ${[5, 10, 15, 20, 30, 45, 60, 90, 120].filter(m => m <= MINUTES).map(m => `${m} min → ${med(res.map(r => r.seve[m]))}`).join(', ')}`);
if (res[0].a15) {
  console.log(`À 15 min : fertilité ${moy(r => r.a15.res.fertilite).toFixed(1)}, humidité ${moy(r => r.a15.res.humidite).toFixed(1)}, harmonie ${moy(r => r.a15.res.harmonie).toFixed(2)}, espèces ${moy(r => r.a15.res.especes.length).toFixed(1)}`);
  const conds = res.filter(r => r.a15.conditions && r.lisiere === null || r.lisiere > 900).map(r => r.a15.conditions).filter(Boolean);
  if (conds.length) {
    console.log(`Conditions de la Lisière non remplies à 15 min (sur ${conds.length} parties pas encore passées) :`);
    conds[0].forEach((c, k) => console.log(`  ${c.type.padEnd(11)} non remplie ${conds.filter(l => !l[k].ok).length} fois, valeur moyenne ${(conds.reduce((s, l) => s + (typeof l[k].valeur === 'number' ? l[k].valeur : 0), 0) / conds.length).toFixed(2)}`));
  }
}
console.log(`Fin : fertilité ${moy(r => r.fin.fertilite).toFixed(1)}, humidité ${moy(r => r.fin.humidite).toFixed(1)}, harmonie ${moy(r => r.fin.harmonie).toFixed(2)}, agents ${moy(r => r.fin.agents).toFixed(1)}, espèces ${moy(r => r.fin.especes.length).toFixed(1)}`);
// Sprint 3
const evts = res.flatMap(r => r.meteo);
console.log(`\nÉvénements (${(evts.length / PARTIES).toFixed(1)} par partie) :`);
for (const id of ['floraison', 'orage', 'secheresse']) {
  const l = evts.filter(x => x.id === id);
  if (!l.length) { console.log(`  ${id.padEnd(11)} jamais`); continue; }
  const pertes = l.filter(x => x.especesApres !== undefined).map(x => x.especesAvant - x.especesApres);
  let ligne = `  ${id.padEnd(11)} ${l.length} fois ; humidité moyenne ${(l.reduce((s, x) => s + x.humAvant, 0) / l.length).toFixed(0)} → min ${(l.reduce((s, x) => s + x.humMin, 0) / l.length).toFixed(0)} ; espèces perdues pendant l'événement : ${(pertes.reduce((s, v) => s + v, 0) / Math.max(1, pertes.length)).toFixed(1)} en moyenne`;
  if (id === 'orage') ligne += ` ; foudre ${l.filter(x => x.foudre).length} fois`;
  if (id === 'secheresse') ligne += ` ; récompense obtenue ${l.filter(x => x.reussi).length}/${l.filter(x => x.reussi !== undefined).length}`;
  console.log(ligne);
}
console.log(`Papiers rares : ${med(res.map(r => r.rares))} spécimens apparus par partie (médiane), ${med(res.map(r => r.cartes))} cartes collectées sur 28 (min ${Math.min(...res.map(r => r.cartes))}, max ${Math.max(...res.map(r => r.cartes))}) ; pages à la fin : ${med(res.map(r => r.pages))}`);
const ch = res.map(r => r.chene).filter(v => v !== undefined);
console.log(`Chêne de la Jeune forêt (teaser) : ${ch.length}/${PARTIES} parties, médiane ${mmss(med(ch))}  (cible ~1 h cumulée)`);
if (ch.length < PARTIES) {
  const e0 = res.find(r => r.chene === undefined);
  if (e0 && e0.teaserFin) console.log('  conditions à la fin d\'une partie sans chêne : ' + e0.teaserFin.map(c => `${c.type} ${c.ok ? '✓' : '✗'} ${typeof c.valeur === 'number' ? +c.valeur.toFixed(2) : ''}`).join(' ; '));
}
const ret = res.map(r => r.retour).filter(Boolean);
if (ret.length) console.log(`Retour après 10 h d'absence à 30 min (plafond 8 h ${ret.every(x => x.plafonne) ? 'appliqué' : 'NON appliqué'}) : +${med(ret.map(x => x.seve))} sève (réserve avant ${med(ret.map(x => x.seveAvant))}), ${med(ret.map(x => x.arrivees))} arrivées dont ${med(ret.map(x => x.nouvelles))} nouvelles espèces, espèces ${med(ret.map(x => x.especesAvant))} → ${med(ret.map(x => x.especesApres))}, départs dans la minute qui suit : ${ret.reduce((s, x) => s + x.departs1min, 0)}`);
if (DETAIL) for (const r of res) console.log(JSON.stringify({ graine: r.graine, trou: [r.trouA, r.maxTrou], lisiere: r.lisiere, venues: r.venues, partis: r.partis, effectifs: r.fin.effectifs, harmonie: r.fin.harmonieDetail }));
