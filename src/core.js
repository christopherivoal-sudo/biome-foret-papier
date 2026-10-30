// Biome, la forêt de papier : simulation pure (GDD v2). Aucun accès au DOM.
// L'état est un objet JSON pur (sauvegarde = JSON.stringify), le hasard est déterministe.
// Sprint 1 : grille de tuiles, statistiques (fertilité, humidité, ombre), temps,
// système de conditions, actions du joueur, pousse et extension des plantes.
// Sprint 2 (à venir) : arrivées, départs, capacités, chaîne alimentaire, harmonie.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.BiomeCore = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Paramètres (seront ajustés par simulation) ----------
  const P = {
    rayonMax: 15,               // rayon final de l'île (Forêt ancienne)
    dureeJour: 240,             // s : 1 jour = 4 min
    dureeNuit: 60,              // s : la dernière minute du jour est la nuit
    dureeCrepuscule: 20,        // s : avant la nuit, et 10 s à l'aube
    joursParSaison: 3,
    pas: 1,                     // s : pas de mise à jour des tuiles
    seveDepart: 40, grainesDepart: 3,
    humiditeBase: 20,
    relaxHumidite: 60,          // s : temps pour que l'humidité rejoigne sa valeur d'équilibre
    humusVegetal: 0.5,          // fertilité gagnée par jour sur une tuile d'herbe ou de fleurs
    remboursement: 0.5,
    croissanceSaison: { printemps: 1.5, ete: 1, automne: 1, hiver: 0 },
    // graines produites par jour par une plante adulte (stock plafonné par tuile)
    graines: { fleurs: { parJour: 1, saisons: ['printemps', 'ete', 'automne'] },
               ronce: { parJour: 0.5, saisons: ['ete', 'automne'] },
               bouleau: { parJour: 1, saisons: ['automne'] } },
    grainesMaxTuile: 3,
    maxAgents: 30,
    tailleZone: 5,              // zones de population : 5×5 tuiles
    harmonieEchantillon: 5,     // s entre deux mesures d'harmonie
    harmonieMemoire: 150,       // mesures gardées (≈ 12 min, une saison)
  };
  const SAISONS = ['printemps', 'ete', 'automne', 'hiver'];
  const ETAPES = ['prairie', 'lisiere', 'jeune_foret', 'foret_ancienne', 'zone_humide'];
  // Couvert produit par une plante semée (les autres plantes sont des arbres).
  const COUVERT_PLANTE = { herbe: 'herbe', fleurs: 'fleurs', ronce: 'ronce' };

  // ---------- Hasard déterministe (mulberry32) ----------
  function alea(etat) {
    let t = (etat.rng = (etat.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- Données ----------
  // data = { especes: {id: fiche} ou [fiches], amenagements: [...], etapes: [...] }
  function preparer(data) {
    if (data._pret) return data;
    const especes = Array.isArray(data.especes) ? Object.fromEntries(data.especes.map(e => [e.id, e])) : data.especes;
    const actions = Object.fromEntries(data.amenagements.map(a => [a.id, a]));
    const etapes = data.etapes.slice().sort((a, b) => a.ordre - b.ordre);
    const plantesOmbre = Object.values(especes).filter(e => e.croissance && e.croissance.ombre_projetee > 0).map(e => e.id);
    return { _pret: true, especes, actions, etapes, plantesOmbre, textes: data.textes };
  }

  // ---------- Grille ----------
  const N = 2 * P.rayonMax + 1, C = P.rayonMax;
  const idx = (x, y) => y * N + x;
  const dans = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const dansIle = (etat, x, y) => dans(x, y) && (x - C) ** 2 + (y - C) ** 2 <= etat.rayon * etat.rayon + etat.rayon;
  function tuilesIle(etat) {
    const l = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dansIle(etat, x, y)) l.push(idx(x, y));
    return l;
  }
  // Tuiles de l'île dans un cercle (rayon 0 = la tuile elle-même).
  function tuilesCercle(etat, x, y, r) {
    const l = [], rr = Math.ceil(r);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (dansIle(etat, x + dx, y + dy)) l.push(idx(x + dx, y + dy));
    }
    return l;
  }
  function tuileVide(fert) {
    // c : couvert ; e : espèce végétale ; age : jours ; a : aménagement ; ancre : tuile d'origine (mare 2×2)
    return { c: 'nu', e: '', age: 0, a: '', ancre: -1, f: fert, h: P.humiditeBase, hb: P.humiditeBase, o: 0, op: 0, champi: '', paillis: 0, nichoir: false, graines: 0, mal: 0 };
  }

  // ---------- Création ----------
  function creer(dataBrute, options = {}) {
    const data = preparer(dataBrute);
    const etat = {
      version: 2, rng: (options.graine >>> 0) || 12345,
      temps: 0, accu: 0, rayon: data.etapes[0].rayon_ile, etape: data.etapes[0].id,
      seve: P.seveDepart, graines: P.grainesDepart, pages: 0,
      harmonie: 0.5, harmonieHist: [], harmonieAccu: 0,
      tuiles: [], agents: [], populations: {}, journal: [], prochainId: 1,
    };
    for (let i = 0; i < N * N; i++) etat.tuiles.push(null);
    for (const i of tuilesIle(etat)) etat.tuiles[i] = tuileVide(10 + Math.floor(alea(etat) * 16));
    // Herbe au centre (environ 25 % des tuiles), quelques roches au bord.
    const rHerbe = etat.rayon * 0.5;
    for (const i of tuilesIle(etat)) {
      const x = i % N, y = (i / N) | 0, d = Math.hypot(x - C, y - C);
      const t = etat.tuiles[i];
      if (d <= rHerbe) { t.c = 'herbe'; t.e = 'herbe'; t.age = 1; t.f = Math.max(t.f, 15); }
      else if (d > etat.rayon - 2.5 && alea(etat) < 0.06) t.c = 'roche';
    }
    calculerOmbre(etat, data);
    return etat;
  }

  // ---------- Temps ----------
  function horloge(etat) {
    const jourTotal = Math.floor(etat.temps / P.dureeJour);
    const t = etat.temps % P.dureeJour;
    const debutNuit = P.dureeJour - P.dureeNuit;
    let moment = 'jour';
    if (t >= debutNuit - P.dureeCrepuscule && t < debutNuit) moment = 'crepuscule';
    else if (t >= debutNuit) moment = t >= P.dureeJour - 10 ? 'crepuscule' : 'nuit';
    const saisonIdx = Math.floor(jourTotal / P.joursParSaison) % 4;
    return { jour: jourTotal, saison: SAISONS[saisonIdx], annee: Math.floor(jourTotal / (P.joursParSaison * 4)), moment, dansJour: t / P.dureeJour };
  }

  // ---------- Statistiques de tuile ----------
  function maturite(t, fiche) {
    const j = fiche.croissance ? fiche.croissance.jours_adulte : 1;
    return Math.min(1, 0.3 + 0.7 * t.age / Math.max(j, 0.01));
  }
  function estAdulte(t, fiche) { return !!fiche && (!fiche.croissance || t.age >= fiche.croissance.jours_adulte); }

  function calculerOmbre(etat, data) {
    for (const t of etat.tuiles) if (t) { t.o = 0; t.op = 0; }
    for (let i = 0; i < etat.tuiles.length; i++) {
      const t = etat.tuiles[i];
      if (!t || !t.e) continue;
      const fiche = data.especes[t.e];
      if (!fiche || !fiche.croissance || !fiche.croissance.ombre_projetee) continue;
      const { ombre_projetee: om, rayon_ombre: r } = fiche.croissance;
      const m = maturite(t, fiche), x = i % N, y = (i / N) | 0;
      for (const j of tuilesCercle(etat, x, y, r)) {
        const d = Math.hypot((j % N) - x, ((j / N) | 0) - y);
        const v = om * m * (d === 0 ? 1 : 1 - d / (r + 1));
        etat.tuiles[j].o += v;
        if (j === i) etat.tuiles[j].op = v;
      }
    }
    for (const t of etat.tuiles) if (t) t.o = Math.min(100, t.o);
  }

  // Bonus d'humidité dû à l'eau voisine (mare, plus tard ruisseau).
  function bonusEau(etat, data) {
    const mare = data.actions.mare.effets, b = new Array(etat.tuiles.length).fill(0);
    const eaux = [];
    etat.tuiles.forEach((t, i) => { if (t && t.c === 'eau') eaux.push(i); });
    for (const i of eaux) {
      const x = i % N, y = (i / N) | 0;
      for (const j of tuilesCercle(etat, x, y, mare.rayon)) {
        const d = Math.hypot((j % N) - x, ((j / N) | 0) - y);
        b[j] = Math.max(b[j], mare.humidite * Math.max(0, 1 - d / (mare.rayon + 1)));
      }
    }
    return b;
  }

  // ---------- Couverts ----------
  function aCouvert(t, couvert) {
    switch (couvert) {
      case 'ouvert': return t.c !== 'arbre' && t.c !== 'ronce';
      case 'vegetal': return t.c === 'herbe' || t.c === 'fleurs';
      case 'bois_mort': return t.c === 'bois_mort';
      default: return t.c === couvert;
    }
  }

  // ---------- Présence des espèces ----------
  // Agents : individus avec position. Populations : effectif par zone 5×5. Tuiles : plantes et champignons.
  function presence(etat, data, id, x, y, r) {
    const fiche = data.especes[id];
    if (!fiche) return 0;
    const proche = (px, py) => r === undefined || Math.hypot(px - x, py - y) <= r;
    if (fiche.mode === 'agent') return etat.agents.filter(a => a.esp === id && proche(a.x, a.y)).length;
    if (fiche.mode === 'population') {
      const zones = etat.populations[id] || {};
      let n = 0;
      for (const [z, eff] of Object.entries(zones)) {
        if (eff <= 0) continue;
        const zi = +z, nz = Math.ceil(N / P.tailleZone);
        const zx = (zi % nz) * P.tailleZone + P.tailleZone / 2 - 0.5, zy = Math.floor(zi / nz) * P.tailleZone + P.tailleZone / 2 - 0.5;
        // une zone compte si elle touche le cercle
        if (r === undefined || Math.hypot(zx - x, zy - y) <= r + P.tailleZone * 0.71) n++;
      }
      return n;
    }
    let n = 0;
    const liste = r === undefined ? tuilesIle(etat) : tuilesCercle(etat, x, y, r);
    for (const i of liste) { const t = etat.tuiles[i]; if (t.e === id || t.champi === id) n++; }
    return n;
  }
  function especesPresentes(etat, data) {
    return Object.keys(data.especes).filter(id => presence(etat, data, id) > 0);
  }
  const zoneDe = (x, y) => Math.floor(y / P.tailleZone) * Math.ceil(N / P.tailleZone) + Math.floor(x / P.tailleZone);

  // ---------- Aménagements ----------
  function compterAmenagement(etat, id, liste) {
    const ancres = new Set();
    for (const i of liste) {
      const t = etat.tuiles[i];
      if (id === 'nichoir') { if (t.nichoir) ancres.add(i); }
      else if (id === 'paillis') { if (t.paillis > 0) ancres.add(i); }
      else if (t.a === id) ancres.add(t.ancre >= 0 ? t.ancre : i);
    }
    return ancres.size;
  }

  // ---------- Conditions (GDD 8.2) ----------
  // Renvoie { ok, valeur, cible } ; valeur sert à la jauge du carnet et de la succession.
  // ctx = { x, y } : tuile candidate pour les portées « zone ».
  function evaluer(etat, dataBrute, c, ctx = {}) {
    const data = preparer(dataBrute);
    const zone = c.portee === 'zone';
    if (zone && ctx.x === undefined) return { ok: false, valeur: 0, cible: c.min, erreur: 'portée zone sans tuile' };
    const liste = () => zone ? tuilesCercle(etat, ctx.x, ctx.y, c.rayon) : tuilesIle(etat);
    const h = horloge(etat);
    switch (c.type) {
      case 'couvert': {
        const l = liste(); if (!l.length) return { ok: false, valeur: 0, cible: c.min };
        const v = l.filter(i => aCouvert(etat.tuiles[i], c.couvert)).length / l.length;
        return { ok: v >= c.min, valeur: v, cible: c.min };
      }
      case 'couvert_nb': {
        const v = liste().filter(i => aCouvert(etat.tuiles[i], c.couvert)).length;
        return { ok: v >= c.min, valeur: v, cible: c.min };
      }
      case 'stat': {
        const l = liste(); if (!l.length) return { ok: false, valeur: 0, cible: c.valeur };
        const champ = { fertilite: 'f', humidite: 'h', ombre: 'o' }[c.stat];
        // Une plante ne se fait pas d'ombre à elle-même.
        const val = i => { const t = etat.tuiles[i]; return c.stat === 'ombre' && ctx.soi === i ? t.o - t.op : t[champ]; };
        const v = l.reduce((s, i) => s + val(i), 0) / l.length;
        return { ok: c.op === '>=' ? v >= c.valeur : v <= c.valeur, valeur: v, cible: c.valeur };
      }
      case 'amenagement': {
        // Pour un aménagement de plusieurs tuiles, il suffit qu'une de ses tuiles soit dans le cercle.
        const v = compterAmenagement(etat, c.id, liste());
        return { ok: v >= c.min, valeur: v, cible: c.min };
      }
      case 'espece': {
        const v = zone ? presence(etat, data, c.id, ctx.x, ctx.y, c.rayon) : presence(etat, data, c.id);
        return { ok: v >= c.min, valeur: v, cible: c.min };
      }
      case 'arbre_adulte': {
        const fiche = data.especes[c.id];
        const v = tuilesIle(etat).filter(i => { const t = etat.tuiles[i]; return t.e === c.id && estAdulte(t, fiche) && t.age >= (c.age_min_jours || 0); }).length;
        return { ok: v >= c.min, valeur: v, cible: c.min };
      }
      case 'saison': return { ok: c.dans.includes(h.saison), valeur: h.saison, cible: c.dans };
      case 'moment': return { ok: c.dans.includes(h.moment), valeur: h.moment, cible: c.dans };
      case 'etape': { const v = ETAPES.indexOf(etat.etape); return { ok: v >= ETAPES.indexOf(c.min), valeur: etat.etape, cible: c.min }; }
      case 'rayon_ile': return { ok: etat.rayon >= c.min, valeur: etat.rayon, cible: c.min };
      case 'harmonie': {
        if (!c.duree_jours) return { ok: etat.harmonie >= c.min, valeur: etat.harmonie, cible: c.min };
        // Durée tenue : nombre de mesures consécutives récentes au-dessus du seuil.
        let n = 0;
        for (let k = etat.harmonieHist.length - 1; k >= 0 && etat.harmonieHist[k] >= c.min; k--) n++;
        const jours = n * P.harmonieEchantillon / P.dureeJour;
        return { ok: etat.harmonie >= c.min && jours >= c.duree_jours, valeur: etat.harmonie, cible: c.min, tenu_jours: jours, duree_jours: c.duree_jours };
      }
      case 'nb_especes': {
        const filtre = c.etapes ? [].concat(c.etapes) : null;
        const v = especesPresentes(etat, data).filter(id => !filtre || filtre.includes(data.especes[id].etape)).length;
        return { ok: v >= c.min, valeur: v, cible: c.min };
      }
    }
    return { ok: false, valeur: 0, cible: 0, erreur: 'type inconnu : ' + c.type };
  }
  function toutesVraies(etat, data, conds, ctx) { return conds.every(c => evaluer(etat, data, c, ctx).ok); }
  function detail(etat, data, conds, ctx) { return conds.map(c => Object.assign({ type: c.type }, evaluer(etat, data, c, ctx))); }

  // Besoins d'une espèce sur une tuile (carnet, arrivées, survie des plantes).
  function besoinsEspece(etat, dataBrute, id, x, y) {
    const data = preparer(dataBrute);
    return detail(etat, data, data.especes[id].besoins, { x, y, soi: dans(x, y) ? idx(x, y) : -1 });
  }

  // Conditions de passage à l'étape suivante (jauge de succession).
  function etapeSuivante(etat, dataBrute) {
    const data = preparer(dataBrute);
    const k = data.etapes.findIndex(e => e.id === etat.etape);
    const suiv = data.etapes[k + 1];
    if (!suiv) return null;
    const conds = detail(etat, data, suiv.conditions_entree, {});
    return { id: suiv.id, conditions: conds, ok: conds.every(c => c.ok) };
  }
  function etapeAtteinte(etat, data, id) { return data.etapes.findIndex(e => e.id === etat.etape) >= data.etapes.findIndex(e => e.id === id); }

  // ---------- Actions du joueur ----------
  function refus(raison, details) { return { ok: false, raison, details }; }
  function payer(etat, seve, graines) {
    if (etat.seve < seve) return refus('seve', { manque: seve - etat.seve });
    if (etat.graines < graines) return refus('graines', { manque: graines - etat.graines });
    etat.seve -= seve; etat.graines -= graines;
    return { ok: true };
  }
  const liberable = t => t && !t.a && t.c !== 'eau' && t.c !== 'roche';

  function action(etat, dataBrute, id, x, y) {
    const data = preparer(dataBrute);
    if (id === 'retirer') return retirer(etat, data, x, y);
    if (id === 'agrandir') return agrandir(etat, data);
    if (id === 'recolter') return recolter(etat, x, y);
    const a = data.actions[id];
    if (!a) return refus('action_inconnue');
    if (!etapeAtteinte(etat, data, a.etape)) return refus('verrouille', { etape: a.etape });
    if (!dansIle(etat, x, y)) return refus('hors_ile');
    const i = idx(x, y), t = etat.tuiles[i];

    if (a.type === 'semis') {
      const fiche = data.especes[a.espece];
      if (!liberable(t) || t.e === a.espece) return refus('tuile_occupee');
      if (fiche.id !== 'herbe' && t.c !== 'nu' && t.c !== 'herbe') return refus('tuile_occupee');
      // On vérifie le sol avant de faire payer : le joueur sait pourquoi ça ne pousserait pas.
      const besoins = besoinsEspece(etat, data, fiche.id, x, y);
      if (!besoins.every(b => b.ok)) return refus('besoins', { besoins });
      const p = payer(etat, fiche.croissance.cout_seve, fiche.croissance.cout_graines);
      if (!p.ok) return p;
      planter(etat, data, i, fiche.id);
      return { ok: true };
    }

    // Aménagements
    if (a.pose === 'arbre_adulte') {
      const fiche = data.especes[t.e];
      if (t.c !== 'arbre' || !estAdulte(t, fiche) || t.nichoir) return refus('arbre_adulte_requis');
      const p = payer(etat, a.cout_seve, 0); if (!p.ok) return p;
      t.nichoir = true;
      return { ok: true };
    }
    if (a.pose === 'surcouche') {
      if (!t || t.c === 'eau' || t.c === 'roche' || t.a || t.paillis > 0) return refus('tuile_occupee');
      const p = payer(etat, a.cout_seve, 0); if (!p.ok) return p;
      t.paillis = a.effets.duree_jours;
      return { ok: true };
    }
    const cases = [];
    for (let dy = 0; dy < a.taille; dy++) for (let dx = 0; dx < a.taille; dx++) {
      if (!dansIle(etat, x + dx, y + dy)) return refus('hors_ile');
      const tt = etat.tuiles[idx(x + dx, y + dy)];
      if (!liberable(tt) || tt.c === 'arbre') return refus('tuile_occupee');
      cases.push(idx(x + dx, y + dy));
    }
    const p = payer(etat, a.cout_seve, 0); if (!p.ok) return p;
    for (const j of cases) {
      const tt = etat.tuiles[j];
      Object.assign(tt, { c: a.couvert, e: '', age: 0, a: id, ancre: i, champi: '', graines: 0, mal: 0, paillis: 0 });
      if (a.couvert === 'eau') tt.h = 100;
    }
    calculerOmbre(etat, data);
    return { ok: true };
  }

  function planter(etat, data, i, id) {
    const t = etat.tuiles[i];
    Object.assign(t, { c: COUVERT_PLANTE[id] || 'arbre', e: id, age: 0, graines: 0, mal: 0, nichoir: false });
    if (data.especes[id].croissance.ombre_projetee) calculerOmbre(etat, data);
  }

  function retirer(etat, data, x, y) {
    if (!dansIle(etat, x, y)) return refus('hors_ile');
    const t = etat.tuiles[idx(x, y)];
    let rendu = 0;
    if (t.a) {
      const a = data.actions[t.a], ancre = t.ancre;
      rendu = a.cout_seve;
      etat.tuiles.forEach(tt => { if (tt && tt.a === a.id && tt.ancre === ancre) Object.assign(tt, { c: 'nu', a: '', ancre: -1, hb: P.humiditeBase }); });
    } else if (t.e) {
      const fiche = data.especes[t.e];
      rendu = fiche.croissance ? fiche.croissance.cout_seve : 0;
      if (t.nichoir) rendu += data.actions.nichoir.cout_seve;
      Object.assign(t, { c: 'nu', e: '', age: 0, nichoir: false, graines: 0, mal: 0 });
    } else if (t.c === 'roche') t.c = 'nu';
    else return refus('rien_a_retirer');
    etat.seve += Math.floor(rendu * P.remboursement);
    calculerOmbre(etat, data);
    return { ok: true, rendu: Math.floor(rendu * P.remboursement) };
  }

  function agrandir(etat, data) {
    const et = data.etapes.find(e => e.id === etat.etape);
    if (etat.rayon >= et.rayon_ile) return refus('rayon_max');
    const p = payer(etat, et.debloque.agrandissement_cout, 0); if (!p.ok) return p;
    etat.rayon = Math.min(et.rayon_ile, etat.rayon + 2);
    for (const i of tuilesIle(etat)) if (!etat.tuiles[i]) etat.tuiles[i] = tuileVide(10 + Math.floor(alea(etat) * 11));
    return { ok: true, rayon: etat.rayon };
  }

  function recolter(etat, x, y) {
    if (!dansIle(etat, x, y)) return refus('hors_ile');
    const t = etat.tuiles[idx(x, y)];
    const n = Math.floor(t.graines);
    if (n < 1) return refus('rien_a_recolter');
    t.graines -= n; etat.graines += n;
    return { ok: true, graines: n };
  }

  // Passage d'étape : appelé par le jeu quand la jauge est pleine (le joueur voit la cinématique).
  function passerEtape(etat, dataBrute) {
    const data = preparer(dataBrute);
    const s = etapeSuivante(etat, data);
    if (!s || !s.ok) return refus('conditions', s);
    etat.etape = s.id;
    etat.journal.push({ t: etat.temps, type: 'etape', id: s.id });
    return { ok: true, etape: s.id };
  }

  // ---------- Pas de simulation ----------
  function pasTuiles(etat, data, dt) {
    const h = horloge(etat);
    const croiss = P.croissanceSaison[h.saison];
    const eau = bonusEau(etat, data);
    const jour = dt / P.dureeJour;
    const paillis = data.actions.paillis.effets;
    const ile = tuilesIle(etat);
    let seve = 0;
    const naissances = [];

    for (const i of ile) {
      const t = etat.tuiles[i];
      // Paillis : fertilité et humidité gagnées lentement, sur sa durée.
      if (t.paillis > 0) {
        const part = Math.min(t.paillis, jour) / paillis.duree_jours;
        t.f = Math.min(100, t.f + paillis.fertilite * part);
        t.hb = Math.min(100, t.hb + paillis.humidite * part);
        t.paillis = Math.max(0, t.paillis - jour);
      }
      // Humidité : rejoint l'équilibre (sol + eau voisine).
      if (t.c === 'eau') t.h = 100;
      else {
        const cible = Math.min(100, t.hb + eau[i] + (etat.meteoHumidite || 0));
        t.h += (cible - t.h) * Math.min(1, dt / P.relaxHumidite);
        t.h = Math.max(0, Math.min(100, t.h));
      }
      if (aCouvert(t, 'vegetal')) t.f = Math.min(100, t.f + P.humusVegetal * jour);

      // Plantes : pousse, survie, graines, extension, sève.
      if (!t.e) continue;
      const fiche = data.especes[t.e];
      if (!fiche) continue;
      const x = i % N, y = (i / N) | 0;
      // Un arbre adulte a sa cime au soleil : la contrainte d'ombre ne vaut que pour les jeunes plants.
      const arbreAdulte = t.c === 'arbre' && estAdulte(t, fiche);
      const conds = arbreAdulte ? fiche.besoins.filter(c => !(c.type === 'stat' && c.stat === 'ombre')) : fiche.besoins;
      const ok = conds.every(c => evaluer(etat, data, c, { x, y, soi: i }).ok);
      if (ok) { t.mal = 0; t.age += jour * croiss; }
      else {
        // Hors ligne : jamais de départ (géré par le jeu). Ici, la plante dépérit après depart_apres_jours.
        t.mal += jour;
        if (t.mal >= fiche.depart_apres_jours) {
          etat.journal.push({ t: etat.temps, type: 'recul', id: t.e, i, manque: fiche.besoins.indexOf(conds.find(c => !evaluer(etat, data, c, { x, y, soi: i }).ok)) });
          Object.assign(t, { c: 'nu', e: '', age: 0, nichoir: false, graines: 0, mal: 0 });
          continue;
        }
      }
      const adulte = estAdulte(t, fiche);
      seve += fiche.production.seve_par_s * dt * (adulte ? 1 : 0.5);
      const g = P.graines[t.e];
      if (adulte && g && g.saisons.includes(h.saison)) t.graines = Math.min(P.grainesMaxTuile, t.graines + g.parJour * jour);
      const ext = fiche.croissance && fiche.croissance.extension_par_jour;
      if (adulte && ext && croiss > 0 && alea(etat) < ext * jour * croiss) naissances.push([i, t.e]);
    }
    // Extension vers une tuile voisine nue où l'espèce a ce qu'il lui faut.
    for (const [i, id] of naissances) {
      const x = i % N, y = (i / N) | 0;
      const voisins = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
        .filter(([vx, vy]) => dansIle(etat, vx, vy) && etat.tuiles[idx(vx, vy)].c === 'nu' && !etat.tuiles[idx(vx, vy)].a);
      if (!voisins.length) continue;
      const [vx, vy] = voisins[Math.floor(alea(etat) * voisins.length)];
      if (data.especes[id].besoins.every(c => evaluer(etat, data, c, { x: vx, y: vy, soi: idx(vx, vy) }).ok)) planter(etat, data, idx(vx, vy), id);
    }
    // Production de sève : × 0,5 à 1,5 selon l'harmonie (GDD 1.4).
    etat.seve += seve * (0.5 + etat.harmonie);
    calculerOmbre(etat, data);
  }

  function tick(etat, dataBrute, dt) {
    const data = preparer(dataBrute);
    etat.accu += dt;
    while (etat.accu >= P.pas) {
      etat.accu -= P.pas;
      etat.temps += P.pas;
      pasTuiles(etat, data, P.pas);
      etat.harmonieAccu += P.pas;
      if (etat.harmonieAccu >= P.harmonieEchantillon) {
        etat.harmonieAccu -= P.harmonieEchantillon;
        etat.harmonieHist.push(etat.harmonie);
        if (etat.harmonieHist.length > P.harmonieMemoire) etat.harmonieHist.shift();
      }
    }
    if (etat.journal.length > 200) etat.journal.splice(0, etat.journal.length - 200);
    return etat;
  }

  // ---------- Résumé de l'île (interface, tests, équilibrage) ----------
  function resume(etat, dataBrute) {
    const data = preparer(dataBrute);
    const l = tuilesIle(etat), n = l.length, compte = {};
    let f = 0, h = 0, o = 0;
    for (const i of l) { const t = etat.tuiles[i]; compte[t.c] = (compte[t.c] || 0) + 1; f += t.f; h += t.h; o += t.o; }
    return { tuiles: n, couverts: compte, fertilite: f / n, humidite: h / n, ombre: o / n, seve: etat.seve, graines: etat.graines, horloge: horloge(etat), etape: etat.etape, rayon: etat.rayon, especes: especesPresentes(etat, data) };
  }

  // Outils pour les sprints suivants et les tests : ajout direct d'agents et de populations.
  function ajouterAgent(etat, esp, x, y) {
    if (etat.agents.length >= P.maxAgents) return null;
    const a = { id: etat.prochainId++, esp, x, y };
    etat.agents.push(a);
    return a;
  }
  function fixerPopulation(etat, esp, x, y, effectif) {
    const z = zoneDe(x, y);
    (etat.populations[esp] = etat.populations[esp] || {})[z] = effectif;
  }

  return {
    P, N, CENTRE: C, SAISONS, ETAPES,
    preparer, creer, tick, action, passerEtape,
    evaluer, detail, toutesVraies, besoinsEspece, etapeSuivante,
    horloge, resume, presence, especesPresentes, tuilesIle, tuilesCercle, dansIle, idx,
    ajouterAgent, fixerPopulation, alea,
  };
});
