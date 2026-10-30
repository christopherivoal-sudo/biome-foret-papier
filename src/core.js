// Biome, la forêt de papier : simulation pure (GDD v2). Aucun accès au DOM.
// L'état est un objet JSON pur (sauvegarde = JSON.stringify), le hasard est déterministe.
// Sprint 1 : grille de tuiles, statistiques (fertilité, humidité, ombre), temps,
// système de conditions, actions du joueur, pousse et extension des plantes.
// Sprint 2 : arrivées, départs, capacités, chaîne alimentaire, pollinisation, fertilisation,
// harmonie, règles hors schéma (notes de ChatGPT), carnet, photos et missions de la garde.
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
    humusVegetal: 9,            // fertilité gagnée par jour sur une tuile d'herbe ou de fleurs (racines, litière)
    humusMax: 60,               // l'humus des plantes basses sature : gain × (1 − fertilité / humusMax)
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
    harmonieLissage: 0.25,      // part de l'écart rattrapée à chaque mesure
    // --- Écologie (sprint 2) ---
    pasEcologie: 5,             // s entre deux mises à jour des espèces
    controleArrivee: 15,        // s entre deux contrôles d'arrivée (GDD 1.3)
    chanceArrivee: 0.35,
    garantieControles: 2,       // première venue garantie au 2e contrôle (≤ 30 s, critère GDD 10.6)
    chanceRenfort: 0.25,        // un individu de plus arrive si la capacité le permet
    echantillonFoyer: 50,       // tuiles testées pour trouver un foyer
    effectifInitial: 4,         // effectif d'une nouvelle zone de population
    colonisation: 3,            // chance par jour qu'une zone pleine essaime vers une voisine
    declinSurcap: 2,            // part de l'excédent qui disparaît par jour
    declinDepart: 3,            // part de l'effectif qui part par jour quand l'habitat manque
    delaiSurcapacite: 30,       // s au-dessus de la capacité avant qu'un agent parte
    vitesse: { defaut: 1, alouette: 3, merle: 2.5, renard: 1.5 }, // tuiles par seconde
    plancherProies: 3,          // le renard ne chasse plus en dessous de ce nombre de lapins
    lapinsParAbri: 4,
    broutage: 2,                // tuiles d'herbe broutées à ras par jour et par lapin en trop
    dispersionFacteur: 5,       // graines de ronce semées par jour par merle = intensité × facteur
    fertilisation: 30,          // fertilité gagnée par jour pour une intensité de 1 (sol pauvre)
    fertiliteMaxBio: 85,        // plafond doux de la fertilité apportée par les vers, champignons et feuilles
    humusEau: 0.3,              // humidité retenue par point de fertilité au-dessus de 10
    sevePhoto: 10,
    chanceComportement: 0.08,   // chance par pas écologique qu'un agent montre un comportement (repas)
    chancePollinisation: 0.15,  // idem pour une nuée de pollinisateurs sur une fleur              // sève de la première photo d'une espèce
    nbMissions: 3,
    // Rôles attendus par étape (part « chaîne » de l'harmonie) et habitats de la mosaïque.
    rolesAttendus: {
      prairie: ['producteur', 'herbivore', 'insectivore', 'decomposeur', 'pollinisateur'],
      lisiere: ['producteur', 'herbivore', 'insectivore', 'decomposeur', 'pollinisateur', 'predateur'],
    },
    habitatsAttendus: { prairie: ['prairie', 'eau'], lisiere: ['prairie', 'lisiere', 'eau'] },
    seuilHabitat: { prairie: 0.1, lisiere: 0.1, sous_bois: 0.1, eau: 0.01 },
  };
  // Foyer préféré des agents (sinon : n'importe quelle tuile où les besoins sont réunis).
  const FOYER = { alouette: ['herbe', 'fleurs'], merle: ['ronce', 'arbre'], renard: ['ronce'], herisson: ['ronce', 'bois_mort'] };
  // Règles hors schéma (chatgpt/especes-prairie-lisiere-notes.md, validées par Christophe).
  // alternatives[espece][k] : autres façons de satisfaire besoins[k] (« OU »).
  // supplementaires : conditions en plus, rattachées à l'indice du besoin qu'elles précisent.
  const REGLES = {
    alternatives: {
      lapin: { 1: [{ type: 'couvert_nb', couvert: 'ronce', min: 1, portee: 'zone', rayon: 4 }] },
      coulemelle: { 2: [{ type: 'espece', id: 'bouleau', min: 1, portee: 'zone', rayon: 2 }] },
    },
    supplementaires: {
      tircis: [{ indice: 1, type: 'stat_nb', stat: 'ombre', entre: [20, 50], min: 3, portee: 'zone', rayon: 2 }],
    },
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
    let especes = Array.isArray(data.especes) ? Object.fromEntries(data.especes.map(e => [e.id, e])) : data.especes;
    // Réglages d'équilibrage (data/equilibrage.json) : ils surchargent les fiches sans les modifier,
    // pour qu'une nouvelle intégration des fiches de ChatGPT ne les efface pas.
    const eq = (data.equilibrage && data.equilibrage.especes) || {};
    especes = Object.fromEntries(Object.entries(especes).map(([id, f]) => [id, eq[id] ? fusionner(JSON.parse(JSON.stringify(f)), eq[id]) : f]));
    const actions = Object.fromEntries(data.amenagements.map(a => [a.id, a]));
    const etapes = data.etapes.slice().sort((a, b) => a.ordre - b.ordre);
    const plantesOmbre = Object.values(especes).filter(e => e.croissance && e.croissance.ombre_projetee > 0).map(e => e.id);
    return { _pret: true, especes, actions, etapes, plantesOmbre, missions: data.missions || [], textes: data.textes };
  }
  function fusionner(cible, src) {
    for (const [k, v] of Object.entries(src)) {
      if (k.startsWith('_')) continue; // commentaires
      if (v && typeof v === 'object' && !Array.isArray(v) && cible[k] && typeof cible[k] === 'object') fusionner(cible[k], v);
      else cible[k] = v;
    }
    return cible;
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
    return { c: 'nu', e: '', age: 0, a: '', ancre: -1, f: fert, h: P.humiditeBase, hb: P.humiditeBase, o: 0, op: 0, champi: '', paillis: 0, nichoir: false, graines: 0, mal: 0, cm: 0 };
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
      // Sprint 2
      harmonieDetail: null, saison: 'printemps', popMal: {}, popAncre: {}, esp: {}, carnet: {}, pollinisation: {},
      missions: { actives: [], faites: [] },
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
    remplirMissions(etat, data);
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
    if (fiche.mode === 'agent') return etat.agents.filter(a => a.esp === id && a.m !== 'part' && proche(a.x, a.y)).length;
    if (fiche.mode === 'population') {
      const zones = etat.populations[id] || {};
      let n = 0;
      for (const [z, eff] of Object.entries(zones)) {
        if (eff < 1) continue;
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
      case 'stat_nb': {
        // Règle interne (hors schéma) : nombre de tuiles dont la statistique est dans l'intervalle.
        const champ = { fertilite: 'f', humidite: 'h', ombre: 'o' }[c.stat];
        const v = liste().filter(i => { const x = etat.tuiles[i][champ]; return x >= c.entre[0] && x <= c.entre[1]; }).length;
        return { ok: v >= c.min, valeur: v, cible: c.min };
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
  // Tient compte des règles hors schéma : une alternative satisfaite rend le besoin vrai,
  // une condition supplémentaire fausse rend faux le besoin qu'elle précise.
  function besoinsEspece(etat, dataBrute, id, x, y) {
    const data = preparer(dataBrute);
    const ctx = { x, y, soi: dans(x, y) ? idx(x, y) : -1 };
    const alt = REGLES.alternatives[id] || {}, sup = REGLES.supplementaires[id] || [];
    const res = detail(etat, data, data.especes[id].besoins, ctx);
    res.forEach((r, k) => {
      if (!r.ok && alt[k] && alt[k].some(c => evaluer(etat, data, c, ctx).ok)) { r.ok = true; r.alternative = true; }
    });
    for (const c of sup) if (res[c.indice].ok && !evaluer(etat, data, c, ctx).ok) { res[c.indice].ok = false; res[c.indice].regle = c.type; }
    return res;
  }
  // Version rapide pour la simulation : { ok, manque } (manque = indice du premier besoin non réuni).
  function besoinsOk(etat, data, id, i) {
    const ctx = { x: i % N, y: (i / N) | 0, soi: i };
    const f = data.especes[id], alt = REGLES.alternatives[id] || {}, sup = REGLES.supplementaires[id] || [];
    for (let k = 0; k < f.besoins.length; k++) {
      if (evaluer(etat, data, f.besoins[k], ctx).ok) continue;
      if (alt[k] && alt[k].some(c => evaluer(etat, data, c, ctx).ok)) continue;
      return { ok: false, manque: k };
    }
    for (const c of sup) if (!evaluer(etat, data, c, ctx).ok) return { ok: false, manque: c.indice };
    return { ok: true, manque: -1 };
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
    if (id === 'recolter') { const r = recolter(etat, x, y); if (r.ok) noter(etat, data, 'recolte', '', r.graines); return r; }
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
      noter(etat, data, 'semis', fiche.id);
      return { ok: true };
    }

    // Aménagements
    if (a.pose === 'arbre_adulte') {
      const fiche = data.especes[t.e];
      if (t.c !== 'arbre' || !estAdulte(t, fiche) || t.nichoir) return refus('arbre_adulte_requis');
      const p = payer(etat, a.cout_seve, 0); if (!p.ok) return p;
      t.nichoir = true;
      noter(etat, data, 'construction', id);
      return { ok: true };
    }
    if (a.pose === 'surcouche') {
      if (!t || t.c === 'eau' || t.c === 'roche' || t.a || t.paillis > 0) return refus('tuile_occupee');
      const p = payer(etat, a.cout_seve, 0); if (!p.ok) return p;
      t.paillis = a.effets.duree_jours;
      noter(etat, data, 'construction', id);
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
    noter(etat, data, 'construction', id);
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
    remplirMissions(etat, data);
    return { ok: true, etape: s.id };
  }

  // =====================================================================
  // ---------- Écologie (sprint 2) ----------
  // =====================================================================
  const NZ = Math.ceil(N / P.tailleZone);
  function zoneTuiles(etat, z) {
    const zx = (z % NZ) * P.tailleZone, zy = Math.floor(z / NZ) * P.tailleZone, l = [];
    for (let y = zy; y < zy + P.tailleZone; y++) for (let x = zx; x < zx + P.tailleZone; x++) if (dansIle(etat, x, y)) l.push(idx(x, y));
    return l;
  }
  // Tuile de l'île la plus proche du centre de la zone (sert à évaluer les besoins de la zone).
  function zoneCentre(etat, z) {
    const cx = (z % NZ) * P.tailleZone + (P.tailleZone - 1) / 2, cy = Math.floor(z / NZ) * P.tailleZone + (P.tailleZone - 1) / 2;
    let best = -1, bd = Infinity;
    for (const i of zoneTuiles(etat, z)) {
      const t = etat.tuiles[i];
      if (t.c === 'eau' || t.c === 'roche') continue;
      const d = Math.hypot((i % N) - cx, ((i / N) | 0) - cy);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // Tuile d'une zone où les besoins d'une espèce sont réunis (on essaie d'abord la tuile d'ancrage), ou -1.
  function foyerZone(etat, data, id, z, ancre) {
    if (ancre >= 0 && etat.tuiles[ancre] && besoinsOk(etat, data, id, ancre).ok) return ancre;
    for (const i of zoneTuiles(etat, z)) {
      const t = etat.tuiles[i];
      if (i !== ancre && t.c !== 'eau' && t.c !== 'roche' && besoinsOk(etat, data, id, i).ok) return i;
    }
    return -1;
  }
  function zonesIle(etat) { const l = []; for (let z = 0; z < NZ * NZ; z++) if (zoneTuiles(etat, z).length) l.push(z); return l; }
  function voisinesZone(z) {
    const x = z % NZ, y = Math.floor(z / NZ), l = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx >= 0 && x + dx < NZ && y + dy >= 0 && y + dy < NZ) l.push((y + dy) * NZ + x + dx);
    return l;
  }
  const compterCouvert = (etat, couvert, liste) => (liste || tuilesIle(etat)).filter(i => aCouvert(etat.tuiles[i], couvert)).length;
  const actifEnSaison = (fiche, saison) => fiche.saisons_actives.includes(saison);
  // Moment où une espèce peut arriver : les diurnes pas en pleine nuit, les nocturnes pas en plein jour.
  function momentOk(fiche, m) {
    if (fiche.activite === 'jour') return m !== 'nuit';
    if (fiche.activite === 'nuit') return m !== 'jour';
    return true;
  }
  function etatEspece(etat, id) { return etat.esp[id] || (etat.esp[id] = { ctl: 0, repro: etat.temps, surcap: 0, broute: 0 }); }
  function carnet(etat, id) { return etat.carnet[id] || (etat.carnet[id] = { venu: false, photo: false, departs: 0, manque: -1 }); }
  function especesDebloquees(etat, dataBrute) {
    const data = preparer(dataBrute), l = [];
    for (const e of data.etapes) { if (!etapeAtteinte(etat, data, e.id)) break; l.push(...e.debloque.especes); }
    return l;
  }
  function journal(etat, o) { o.t = etat.temps; etat.journal.push(o); }

  // ---------- Capacités ----------
  // Capacité d'une zone pour une espèce en population (individus).
  function capaciteZone(etat, dataBrute, id, z) {
    const data = preparer(dataBrute), f = data.especes[id], c = f.capacite;
    const tz = zoneTuiles(etat, z);
    let k = c.par === 'tuiles' ? compterCouvert(etat, c.couvert, tz) / c.nombre : c.nombre;
    // Hôtel à insectes : capacité des pollinisateurs +50 % dans son rayon.
    if (f.roles.includes('pollinisateur')) {
      const hotel = data.actions.hotel_insectes.effets, ci = zoneCentre(etat, z);
      if (ci >= 0 && compterAmenagement(etat, 'hotel_insectes', tuilesCercle(etat, ci % N, (ci / N) | 0, hotel.rayon)) > 0) k *= 1 + hotel.capacite_pollinisateurs;
    }
    return k;
  }
  // Capacité totale d'une espèce sur l'île (agents : individus ; tuiles : nombre de tuiles).
  function capacite(etat, dataBrute, id) {
    const data = preparer(dataBrute), f = data.especes[id], c = f.capacite;
    let v;
    if (f.mode === 'population') {
      v = zonesIle(etat).reduce((s, z) => s + capaciteZone(etat, data, id, z), 0);
      return c.max ? Math.min(v, c.max) : v;
    }
    if (c.par === 'tuiles') v = Math.floor(compterCouvert(etat, c.couvert) / c.nombre);
    else if (c.par === 'amenagement') v = compterAmenagement(etat, c.id, tuilesIle(etat)) * c.nombre;
    else v = Math.floor(presence(etat, data, c.id) / c.nombre);
    // Règles hors schéma (notes de ChatGPT).
    if (id === 'lapin') v = Math.min(v, P.lapinsParAbri * (compterAmenagement(etat, 'tas_pierres', tuilesIle(etat)) + compterCouvert(etat, 'ronce')));
    if (id === 'merle') v += data.actions.nichoir.effets.capacite_merle * compterAmenagement(etat, 'nichoir', tuilesIle(etat));
    if (id === 'coulemelle') v = c.nombre * (compterAmenagement(etat, 'tas_bois', tuilesIle(etat)) + presence(etat, data, 'bouleau'));
    if (c.max) v = Math.min(v, c.max);
    return Math.max(0, v);
  }
  // Effectif : individus (agents), somme des zones (populations), tuiles (plantes, champignons).
  function effectif(etat, dataBrute, id) {
    const data = preparer(dataBrute), f = data.especes[id];
    if (f.mode === 'population') return Object.values(etat.populations[id] || {}).reduce((s, v) => s + v, 0);
    return presence(etat, data, id);
  }

  // ---------- Foyer (où une espèce peut s'installer) ----------
  function melanger(etat, l) {
    for (let k = l.length - 1; k > 0; k--) { const j = Math.floor(alea(etat) * (k + 1)); [l[k], l[j]] = [l[j], l[k]]; }
    return l;
  }
  // Renvoie l'indice d'une tuile (zone : sa tuile centrale) où les besoins sont réunis, ou -1.
  function chercherFoyer(etat, dataBrute, id) {
    const data = preparer(dataBrute), f = data.especes[id];
    if (f.mode === 'population') {
      const pop = etat.populations[id] || {};
      for (const z of melanger(etat, zonesIle(etat))) {
        if (pop[z] !== undefined || capaciteZone(etat, data, id, z) < 1) continue;
        const i = foyerZone(etat, data, id, z, zoneCentre(etat, z));
        if (i >= 0) return i;
      }
      return -1;
    }
    let l = tuilesIle(etat).filter(i => { const t = etat.tuiles[i]; return t.c !== 'eau' && t.c !== 'roche'; });
    if (f.mode === 'tuile') l = l.filter(i => !etat.tuiles[i].champi && !etat.tuiles[i].a);
    const pref = FOYER[id] && l.filter(i => FOYER[id].includes(etat.tuiles[i].c));
    if (pref && pref.length) l = pref;
    melanger(etat, l);
    for (let k = 0; k < Math.min(l.length, P.echantillonFoyer); k++) if (besoinsOk(etat, data, id, l[k]).ok) return l[k];
    return -1;
  }

  // ---------- Arrivées ----------
  function pointBord(etat, x, y) {
    // Point du bord de l'île dans la direction (x, y) depuis le centre (ou au hasard).
    let a = x === undefined ? alea(etat) * 2 * Math.PI : Math.atan2(y - C, x - C);
    return { x: C + (etat.rayon + 0.5) * Math.cos(a), y: C + (etat.rayon + 0.5) * Math.sin(a) };
  }
  function arriver(etat, data, id, i, renfort) {
    const f = data.especes[id], x = i % N, y = (i / N) | 0, ca = carnet(etat, id);
    const premiere = !ca.venu;
    let o = { type: renfort ? 'renfort' : 'arrivee', id, premiere, x, y };
    if (f.mode === 'agent') {
      const b = pointBord(etat);
      const a = ajouterAgent(etat, id, b.x, b.y);
      if (!a) return;
      Object.assign(a, { hx: x, hy: y, tx: x, ty: y, m: 'arrive' });
      o.agent = a.id;
    } else if (f.mode === 'population') {
      const z = zoneDe(x, y);
      (etat.populations[id] = etat.populations[id] || {})[z] = Math.min(P.effectifInitial, Math.max(1, capaciteZone(etat, data, id, z)));
      (etat.popAncre[id] = etat.popAncre[id] || {})[z] = i;
    } else etat.tuiles[i].champi = id;
    ca.venu = true;
    journal(etat, o);
    if (!renfort) noter(etat, data, 'arrivee', id, 1, { nouvelle: premiere });
  }
  function controleArrivees(etat, data, h) {
    for (const id of especesDebloquees(etat, data)) {
      const f = data.especes[id];
      if (!f || f.venue !== 'spontanee' || !actifEnSaison(f, h.saison) || !momentOk(f, h.moment)) continue;
      const st = etatEspece(etat, id), n = presence(etat, data, id);
      if (n === 0) {
        const i = chercherFoyer(etat, data, id);
        if (i < 0) continue;
        st.ctl++;
        const garanti = !carnet(etat, id).venu && st.ctl >= P.garantieControles;
        if (garanti || alea(etat) < P.chanceArrivee) { arriver(etat, data, id, i, false); st.ctl = 0; st.repro = etat.temps; }
      } else if (f.mode === 'agent' && n < capacite(etat, data, id) && etat.agents.length < P.maxAgents && alea(etat) < P.chanceRenfort) {
        const i = chercherFoyer(etat, data, id);
        if (i >= 0) arriver(etat, data, id, i, true);
      }
    }
  }

  // ---------- Agents : déplacements (chaque seconde) ----------
  function pasAgents(etat, data, dt) {
    for (const a of etat.agents) {
      if (a.m === 'dort') continue;
      const v = (P.vitesse[a.esp] || P.vitesse.defaut) * dt;
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > v) { a.x += dx / d * v; a.y += dy / d * v; continue; }
      a.x = a.tx; a.y = a.ty;
      if (a.m === 'arrive') { a.m = 'vit'; a.attente = 2; }
      else if (a.m === 'part') a.sorti = true;
      else if ((a.attente -= dt) <= 0) {
        // Flâne autour de son foyer.
        const ang = alea(etat) * 2 * Math.PI, r = alea(etat) * 2;
        const nx = Math.round(a.hx + r * Math.cos(ang)), ny = Math.round(a.hy + r * Math.sin(ang));
        if (dansIle(etat, nx, ny)) { a.tx = nx; a.ty = ny; }
        a.attente = 2 + alea(etat) * 6;
      }
    }
    if (etat.agents.some(a => a.sorti)) etat.agents = etat.agents.filter(a => !a.sorti);
  }
  function fairePartir(etat, a, raison, manque) {
    const b = pointBord(etat, a.x, a.y);
    Object.assign(a, { m: 'part', tx: b.x, ty: b.y });
    journal(etat, { type: 'depart', id: a.esp, agent: a.id, raison, manque, x: Math.round(a.x), y: Math.round(a.y) });
  }

  // ---------- Pas écologique (toutes les 5 s) ----------
  function pasEcologie(etat, data, dt) {
    const h = horloge(etat), jour = dt / P.dureeJour;
    const presentsAvant = especesPresentes(etat, data);
    if (h.saison !== etat.saison) changerSaison(etat, data, h.saison);
    pasPopulations(etat, data, h, jour);
    pasVieAgents(etat, data, h, jour, dt);
    pasChampignons(etat, data, h, jour);
    pasFertilisation(etat, data, h, jour);
    calculerPollinisation(etat, data, h);
    if (etat.temps % P.controleArrivee === 0) controleArrivees(etat, data, h);
    // Une espèce a quitté l'île : le carnet note ce qui manquait.
    const apres = new Set(especesPresentes(etat, data));
    for (const id of presentsAvant) if (!apres.has(id) && data.especes[id].venue === 'spontanee' && actifEnSaison(data.especes[id], h.saison)) {
      const ca = carnet(etat, id);
      ca.departs++;
      journal(etat, { type: 'parti', id, manque: ca.manque });
    }
  }

  // Saisons : migration, hibernation, réveil.
  function changerSaison(etat, data, saison) {
    etat.saison = saison;
    for (const a of etat.agents) {
      const f = data.especes[a.esp];
      if (actifEnSaison(f, saison)) { if (a.m === 'dort') { a.m = 'vit'; journal(etat, { type: 'reveil', id: a.esp, agent: a.id }); } continue; }
      if (a.m === 'part') continue;
      if (f.hiver === 'migre') { const b = pointBord(etat, a.x, a.y); Object.assign(a, { m: 'part', tx: b.x, ty: b.y }); journal(etat, { type: 'migration', id: a.esp, agent: a.id }); }
      else if (f.hiver === 'hiberne') { Object.assign(a, { m: 'dort', x: a.hx, y: a.hy, tx: a.hx, ty: a.hy }); journal(etat, { type: 'hibernation', id: a.esp, agent: a.id }); }
    }
  }

  function pasPopulations(etat, data, h, jour) {
    for (const id of Object.keys(etat.populations)) {
      const f = data.especes[id], zones = etat.populations[id];
      // Hors saison active : dormance (œufs, hibernation). Rien ne bouge, personne ne part.
      if (!actifEnSaison(f, h.saison)) continue;
      const mal = etat.popMal[id] = etat.popMal[id] || {};
      const ancres = etat.popAncre[id] = etat.popAncre[id] || {};
      const repro = f.reproduction.saisons.includes(h.saison);
      const g = f.reproduction.portee_moyenne / f.reproduction.intervalle_jours;
      const K = {}, ok = {};
      for (const z of Object.keys(zones)) {
        K[z] = capaciteZone(etat, data, id, +z);
        // Besoins à la tuile d'ancrage de la zone ; sinon une autre tuile de la zone peut convenir.
        const a0 = ancres[z] !== undefined ? ancres[z] : zoneCentre(etat, +z);
        let r = a0 >= 0 ? besoinsOk(etat, data, id, a0) : { ok: false, manque: -1 };
        if (!r.ok) { const a1 = foyerZone(etat, data, id, +z, -1); if (a1 >= 0) { ancres[z] = a1; r = { ok: true, manque: -1 }; } }
        else ancres[z] = a0;
        ok[z] = r.ok;
        let eff = zones[z];
        if (r.ok) {
          mal[z] = 0;
          if (repro && K[z] > 0 && eff < K[z]) eff += g * eff * (1 - eff / K[z]) * jour;
          if (eff > K[z]) eff -= (eff - K[z]) * Math.min(1, P.declinSurcap * jour);
        } else {
          mal[z] = (mal[z] || 0) + jour;
          carnet(etat, id).manque = r.manque;
          if (mal[z] >= f.depart_apres_jours) eff *= 1 - Math.min(1, P.declinDepart * jour);
        }
        if (eff < 0.5) { delete zones[z]; delete mal[z]; delete ancres[z]; } else zones[z] = eff;
      }
      // Plafond global de la fiche.
      const tot = Object.values(zones).reduce((s, v) => s + v, 0);
      if (f.capacite.max && tot > f.capacite.max) for (const z of Object.keys(zones)) zones[z] *= f.capacite.max / tot;
      // Essaimage vers une zone voisine quand une zone est à moitié pleine.
      for (const z of Object.keys(zones)) {
        if (!ok[z] || !(zones[z] >= 0.5 * K[z])) continue;
        for (const v of voisinesZone(+z)) {
          if (zones[v] !== undefined || alea(etat) >= P.colonisation * jour) continue;
          if (capaciteZone(etat, data, id, v) < 1) continue;
          const c = foyerZone(etat, data, id, v, zoneCentre(etat, v));
          if (c >= 0) { zones[v] = Math.min(P.effectifInitial / 2, capaciteZone(etat, data, id, v)); ancres[v] = c; }
        }
      }
      if (!Object.keys(zones).length) delete etat.populations[id];
    }
  }

  function pasVieAgents(etat, data, h, jour, dt) {
    const parEspece = {};
    for (const a of etat.agents) if (a.m === 'vit' || a.m === 'arrive' || a.m === 'dort') (parEspece[a.esp] = parEspece[a.esp] || []).push(a);
    for (const id of Object.keys(parEspece)) {
      const f = data.especes[id], liste = parEspece[id], st = etatEspece(etat, id);
      if (!actifEnSaison(f, h.saison)) continue;
      // Besoins au foyer ; sinon on cherche un autre foyer avant de partir.
      for (const a of liste) {
        if (a.m !== 'vit') continue;
        const r = besoinsOk(etat, data, id, idx(Math.round(a.hx), Math.round(a.hy)));
        if (r.ok) { a.mal = 0; continue; }
        const i = chercherFoyer(etat, data, id);
        if (i >= 0) { Object.assign(a, { hx: i % N, hy: (i / N) | 0, tx: i % N, ty: (i / N) | 0, mal: 0 }); continue; }
        a.mal += jour; a.manque = r.manque;
        carnet(etat, id).manque = r.manque;
      }
      // Départs un par un (un seul par pas).
      const malade = liste.find(a => a.m === 'vit' && a.mal >= f.depart_apres_jours);
      if (malade) { fairePartir(etat, malade, 'besoins', malade.manque); continue; }
      // Au-dessus de la capacité : le dernier venu qui ne manque de rien s'en va après un délai
      // (si des besoins manquent, c'est le départ ci-dessus qui s'applique, avec sa vraie raison).
      const cap = Math.max(1, capacite(etat, data, id)), n = liste.length;
      const enTrop = liste.filter(a => a.m === 'vit' && a.mal === 0);
      if (n > cap && enTrop.length) {
        st.surcap += dt;
        if (st.surcap >= P.delaiSurcapacite) { st.surcap = 0; fairePartir(etat, enTrop[enTrop.length - 1], 'place', -1); continue; }
      } else st.surcap = 0;
      // Reproduction : un couple, en saison, sous la capacité.
      const rep = f.reproduction;
      if (rep.saisons.includes(h.saison) && n >= 2 && n < cap && etat.temps - st.repro >= rep.intervalle_jours * P.dureeJour) {
        st.repro = etat.temps;
        const parent = liste[Math.floor(alea(etat) * n)];
        const nb = Math.min(Math.round(rep.portee_moyenne), cap - n, P.maxAgents - etat.agents.length);
        for (let k = 0; k < nb; k++) {
          const b = ajouterAgent(etat, id, parent.hx, parent.hy);
          Object.assign(b, { hx: parent.hx, hy: parent.hy });
          journal(etat, { type: 'naissance', id, agent: b.id, x: parent.hx, y: parent.hy });
        }
      }
      // Lapins trop nombreux pour l'herbe : surpâturage, des tuiles deviennent nues.
      if (id === 'lapin') {
        const exces = n - Math.floor(compterCouvert(etat, 'herbe') / f.capacite.nombre);
        if (exces > 0) {
          st.broute += exces * P.broutage * jour;
          while (st.broute >= 1) {
            st.broute -= 1;
            const a = liste[Math.floor(alea(etat) * n)];
            const l = tuilesCercle(etat, Math.round(a.hx), Math.round(a.hy), 3).filter(i => etat.tuiles[i].e === 'herbe');
            if (!l.length) break;
            const i = l[Math.floor(alea(etat) * l.length)];
            Object.assign(etat.tuiles[i], { c: 'nu', e: '', age: 0, graines: 0, mal: 0 });
            journal(etat, { type: 'surpaturage', id: 'lapin', x: i % N, y: (i / N) | 0 });
          }
        } else st.broute = 0;
      }
    }
    // Chaîne alimentaire.
    for (const a of etat.agents.slice()) {
      if (a.m !== 'vit') continue;
      const f = data.especes[a.esp];
      for (const it of f.interactions) {
        const cible = data.especes[it.cible];
        if (!cible) continue;
        if (it.type === 'mange' && cible.mode === 'tuile') brouter(etat, data, a, it, h);
        else if (it.type === 'mange' && cible.mode === 'population') mangerPopulation(etat, data, a, it, jour);
        else if (it.type === 'mange' && cible.mode === 'agent') chasser(etat, data, a, it, h, jour);
        else if (it.type === 'disperse' && ['ete', 'automne'].includes(h.saison)) disperser(etat, data, a, it, jour);
      }
    }
  }
  // Comportement visible (observation pour le carnet) : brouter l'herbe, picorer des mûres.
  // Pas d'effet sur la tuile : le surpâturage est géré à part (lapins trop nombreux).
  function brouter(etat, data, a, it, h) {
    if (it.cible === 'ronce' && !['ete', 'automne'].includes(h.saison)) return; // mûres
    if (alea(etat) >= P.chanceComportement) return;
    const l = tuilesCercle(etat, Math.round(a.x), Math.round(a.y), 2).filter(i => etat.tuiles[i].e === it.cible);
    if (l.length) journal(etat, { type: 'repas', id: a.esp, agent: a.id, proie: it.cible, x: l[0] % N, y: (l[0] / N) | 0 });
  }
  // Un prédateur prélève une part des populations proches ; une zone ne descend jamais sous 1 (pas d'extinction).
  function mangerPopulation(etat, data, a, it, jour) {
    const zones = etat.populations[it.cible];
    if (!zones) return;
    let mange = false;
    for (const z of Object.keys(zones)) {
      const c = zoneCentre(etat, +z);
      if (c < 0 || Math.hypot((c % N) - a.hx, ((c / N) | 0) - a.hy) > 6 || zones[z] <= 1) continue;
      zones[z] = Math.max(1, zones[z] * (1 - it.intensite * jour));
      mange = true;
    }
    if (mange && alea(etat) < P.chanceComportement) journal(etat, { type: 'repas', id: a.esp, agent: a.id, proie: it.cible });
  }
  // Chasse d'un agent (renard → lapin) : seulement au crépuscule et la nuit.
  function chasser(etat, data, a, it, h, jour) {
    if (h.moment === 'jour') return;
    const proies = etat.agents.filter(b => b.esp === it.cible && b.m === 'vit');
    if (proies.length <= P.plancherProies) return;
    // Taux journalier concentré sur le tiers de journée où il chasse.
    if (alea(etat) >= it.intensite * proies.length * jour * 3) return;
    const p = proies[Math.floor(alea(etat) * proies.length)];
    p.sorti = true;
    journal(etat, { type: 'predation', id: a.esp, agent: a.id, proie: p.esp, proieAgent: p.id, x: Math.round(p.x), y: Math.round(p.y) });
    etat.agents = etat.agents.filter(b => !b.sorti);
  }
  // Le merle sème des ronces gratuitement là où il se pose (été, automne).
  function disperser(etat, data, a, it, jour) {
    if (alea(etat) >= it.intensite * P.dispersionFacteur * jour) return;
    const l = tuilesCercle(etat, Math.round(a.hx), Math.round(a.hy), 4)
      .filter(i => { const t = etat.tuiles[i]; return (t.c === 'nu' || t.c === 'herbe') && !t.a; });
    if (!l.length) return;
    const i = l[Math.floor(alea(etat) * l.length)];
    if (!besoinsOk(etat, data, it.plante, i).ok) return;
    planter(etat, data, i, it.plante);
    journal(etat, { type: 'dispersion', id: a.esp, agent: a.id, plante: it.plante, x: i % N, y: (i / N) | 0 });
  }

  // Champignons (mode tuile, posés sur une tuile) : survie, extension en saison, dans la limite de la capacité.
  function pasChampignons(etat, data, h, jour) {
    const ile = tuilesIle(etat);
    const parEsp = {};
    for (const i of ile) { const t = etat.tuiles[i]; if (t.champi) (parEsp[t.champi] = parEsp[t.champi] || []).push(i); }
    for (const id of Object.keys(parEsp)) {
      const f = data.especes[id];
      for (const i of parEsp[id]) {
        const t = etat.tuiles[i], r = besoinsOk(etat, data, id, i);
        if (r.ok) { t.cm = 0; continue; }
        t.cm = (t.cm || 0) + jour; carnet(etat, id).manque = r.manque;
        if (t.cm >= f.depart_apres_jours) { t.champi = ''; t.cm = 0; }
      }
      const rep = f.reproduction;
      if (!rep.saisons.includes(h.saison)) continue;
      const cap = capacite(etat, data, id);
      let n = parEsp[id].filter(i => etat.tuiles[i].champi === id).length;
      for (const i of parEsp[id]) {
        if (n >= cap || etat.tuiles[i].champi !== id || alea(etat) >= rep.portee_moyenne / rep.intervalle_jours * jour) continue;
        const x = i % N, y = (i / N) | 0;
        const l = tuilesCercle(etat, x, y, 1.5).filter(j => { const t = etat.tuiles[j]; return !t.champi && !t.a && t.c !== 'eau' && t.c !== 'roche'; });
        if (!l.length) continue;
        const j = l[Math.floor(alea(etat) * l.length)];
        if (besoinsOk(etat, data, id, j).ok) { etat.tuiles[j].champi = id; n++; }
      }
    }
  }

  // Fertilisation : vers (selon leur densité), champignons, feuilles de bouleau en automne.
  // Une seule fois par source, même si la fiche liste plusieurs plantes cibles (notes de ChatGPT).
  function intensiteFertilise(f) { return Math.max(0, ...f.interactions.filter(i => i.type === 'fertilise').map(i => i.intensite || 0)); }
  function pasFertilisation(etat, data, h, jour) {
    // Le gain ralentit à l'approche de fertiliteMaxBio (le sol ne s'enrichit pas sans fin).
    const ajouter = (i, v) => { const t = etat.tuiles[i]; if (t.c !== 'eau' && t.c !== 'roche') t.f = Math.min(100, t.f + v * Math.max(0, 1 - t.f / P.fertiliteMaxBio)); };
    for (const id of Object.keys(etat.populations)) {
      const f = data.especes[id], k = intensiteFertilise(f);
      if (!k || !actifEnSaison(f, h.saison)) continue;
      for (const [z, eff] of Object.entries(etat.populations[id])) {
        const K = capaciteZone(etat, data, id, +z);
        const dens = K > 0 ? Math.min(1, eff / K) : 1;
        for (const i of zoneTuiles(etat, +z)) ajouter(i, k * P.fertilisation * dens * jour);
      }
    }
    for (const i of tuilesIle(etat)) {
      const t = etat.tuiles[i];
      const sources = [];
      if (t.champi) sources.push([data.especes[t.champi], 1]);
      if (t.e && h.saison === 'automne' && t.c === 'arbre' && estAdulte(t, data.especes[t.e])) sources.push([data.especes[t.e], data.especes[t.e].croissance.rayon_ombre]);
      for (const [f, r] of sources) {
        const k = intensiteFertilise(f);
        if (k) for (const j of tuilesCercle(etat, i % N, (i / N) | 0, r)) ajouter(j, k * P.fertilisation * jour);
      }
    }
  }

  // Pollinisation par zone : somme des intensités des pollinisateurs actifs présents, plafonnée à 1.
  function calculerPollinisation(etat, data, h) {
    const p = {};
    for (const id of Object.keys(etat.populations)) {
      const f = data.especes[id];
      if (!actifEnSaison(f, h.saison)) continue;
      for (const it of f.interactions) {
        if (it.type !== 'pollinise') continue;
        for (const [z, eff] of Object.entries(etat.populations[id])) if (eff >= 1) p[z] = Math.min(1, (p[z] || 0) + it.intensite);
      }
    }
    etat.pollinisation = p;
    // Comportement visible : une nuée butine une fleur.
    for (const id of Object.keys(etat.populations)) {
      const f = data.especes[id];
      if (!actifEnSaison(f, h.saison) || !f.interactions.some(i => i.type === 'pollinise') || !momentOk(f, h.moment) || alea(etat) >= P.chancePollinisation) continue;
      const fl = [];
      for (const z of Object.keys(etat.populations[id])) for (const i of zoneTuiles(etat, +z)) if (etat.tuiles[i].e === 'fleurs') fl.push(i);
      if (fl.length) { const i = fl[Math.floor(alea(etat) * fl.length)]; journal(etat, { type: 'pollinisation', id, x: i % N, y: (i / N) | 0 }); }
    }
  }

  // ---------- Harmonie (GDD 1.4) ----------
  function habitatDe(t) {
    if (t.c === 'eau') return 'eau';
    if (t.o >= 50) return 'sous_bois';
    if (t.c === 'ronce' || t.o >= 20) return 'lisiere';
    if (t.c === 'herbe' || t.c === 'fleurs') return 'prairie';
    return '';
  }
  function calculerHarmonie(etat, dataBrute) {
    const data = preparer(dataBrute);
    const debloq = especesDebloquees(etat, data).filter(id => data.especes[id]);
    const presentes = especesPresentes(etat, data).filter(id => debloq.includes(id));
    // Équilibre : animaux entre 30 % et 120 % de leur capacité (capacité des zones occupées pour les populations).
    const animaux = presentes.filter(id => data.especes[id].mode !== 'tuile');
    let bien = 0;
    for (const id of animaux) {
      let cap;
      if (data.especes[id].mode === 'population') cap = Object.keys(etat.populations[id] || {}).reduce((s, z) => s + capaciteZone(etat, data, id, +z), 0);
      else cap = Math.max(1, capacite(etat, data, id));
      const r = cap > 0 ? effectif(etat, data, id) / cap : 0;
      if (r >= 0.3 && r <= 1.2) bien++;
    }
    const equilibre = animaux.length ? bien / animaux.length : 0;
    const attendus = P.rolesAttendus[etat.etape] || P.rolesAttendus.lisiere;
    const roles = new Set(presentes.flatMap(id => data.especes[id].roles));
    const chaine = attendus.filter(r => roles.has(r)).length / attendus.length;
    const diversite = debloq.length ? presentes.length / debloq.length : 0;
    const ile = tuilesIle(etat), compte = {};
    for (const i of ile) { const hb = habitatDe(etat.tuiles[i]); if (hb) compte[hb] = (compte[hb] || 0) + 1; }
    const habAtt = P.habitatsAttendus[etat.etape] || P.habitatsAttendus.lisiere;
    const habitats = habAtt.filter(hb => (compte[hb] || 0) / ile.length >= P.seuilHabitat[hb]);
    const mosaique = habitats.length / habAtt.length;
    const total = 0.3 * equilibre + 0.3 * chaine + 0.2 * diversite + 0.2 * mosaique;
    return { total, equilibre, chaine, diversite, mosaique, habitats };
  }

  // ---------- Carnet et photos ----------
  function photographier(etat, dataBrute, id) {
    const data = preparer(dataBrute), f = data.especes[id];
    if (!f) return refus('espece_inconnue');
    if (presence(etat, data, id) === 0) return refus('absente');
    const ca = carnet(etat, id), premiere = !ca.photo;
    if (premiere) { ca.photo = true; etat.pages += f.production.pages_photo; etat.seve += P.sevePhoto; }
    noter(etat, data, 'photo', id, 1, { nouvelle: premiere });
    return { ok: true, premiere };
  }

  // ---------- Missions de la garde forestière (GDD 1.7, 1.9) ----------
  // Les missions sont proposées dans l'ordre de data/missions.json (le tutoriel suit cet ordre).
  function remplirMissions(etat, data) {
    const m = etat.missions;
    for (const mi of data.missions) {
      if (m.actives.length >= P.nbMissions) break;
      if (m.faites.includes(mi.id) || m.actives.some(a => a.id === mi.id) || !etapeAtteinte(etat, data, mi.etape)) continue;
      m.actives.push({ id: mi.id, n: 0, remplie: false });
    }
  }
  // Compteurs : semis, construction, recolte, photo, arrivee, evenement.
  function noter(etat, dataBrute, quoi, id, n = 1, extra = {}) {
    const data = preparer(dataBrute);
    for (const a of etat.missions.actives) {
      if (a.remplie) continue;
      const o = data.missions.find(mi => mi.id === a.id).objectif;
      if (o.quoi !== quoi || (o.id && o.id !== id)) continue;
      if (o.nouvelle && !extra.nouvelle) continue;
      // Une photo sans espèce précisée compte une fois par espèce (première photo).
      if (quoi === 'photo' && !o.id && !extra.nouvelle) continue;
      a.n = Math.min(o.nombre, a.n + n);
      if (a.n >= o.nombre) { a.remplie = true; journal(etat, { type: 'mission', id: a.id }); }
    }
  }
  function reclamerMission(etat, dataBrute, id) {
    const data = preparer(dataBrute), m = etat.missions;
    const k = m.actives.findIndex(a => a.id === id && a.remplie);
    if (k < 0) return refus('mission_non_remplie');
    const r = data.missions.find(mi => mi.id === id).recompense;
    etat.seve += r.seve || 0; etat.graines += r.graines || 0; etat.pages += r.pages || 0;
    m.actives.splice(k, 1); m.faites.push(id);
    remplirMissions(etat, data);
    return { ok: true, recompense: r };
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
        const cible = Math.min(100, t.hb + eau[i] + (etat.meteoHumidite || 0) + P.humusEau * Math.max(0, t.f - 10));
        t.h += (cible - t.h) * Math.min(1, dt / P.relaxHumidite);
        t.h = Math.max(0, Math.min(100, t.h));
      }
      if (aCouvert(t, 'vegetal')) t.f = Math.min(100, t.f + P.humusVegetal * Math.max(0, 1 - t.f / P.humusMax) * jour);

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
      // Pollinisation (fleurs) : graines et extension × (1 + p), p de 0 à 1 selon les pollinisateurs de la zone.
      const pol = t.e === 'fleurs' ? 1 + (etat.pollinisation[zoneDe(x, y)] || 0) : 1;
      if (adulte && g && g.saisons.includes(h.saison)) {
        const avant = Math.floor(t.graines);
        t.graines = Math.min(P.grainesMaxTuile, t.graines + g.parJour * pol * jour);
        if (Math.floor(t.graines) > avant) etat.journal.push({ t: etat.temps, type: 'graines', id: t.e, x, y });
      }
      const ext = fiche.croissance && fiche.croissance.extension_par_jour;
      if (adulte && ext && croiss > 0 && alea(etat) < ext * pol * jour * croiss) naissances.push([i, t.e]);
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
    for (const i of ile) { const t = etat.tuiles[i]; if (t.champi) seve += data.especes[t.champi].production.seve_par_s * dt; }
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
      pasAgents(etat, data, P.pas);
      if (etat.temps % P.pasEcologie === 0) pasEcologie(etat, data, P.pasEcologie);
      etat.harmonieAccu += P.pas;
      if (etat.harmonieAccu >= P.harmonieEchantillon) {
        etat.harmonieAccu -= P.harmonieEchantillon;
        const hd = calculerHarmonie(etat, data);
        etat.harmonieDetail = hd;
        etat.harmonie += (hd.total - etat.harmonie) * P.harmonieLissage;
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
    const effectifs = {};
    for (const id of especesPresentes(etat, data)) effectifs[id] = effectif(etat, data, id);
    return { tuiles: n, couverts: compte, fertilite: f / n, humidite: h / n, ombre: o / n, seve: etat.seve, graines: etat.graines, pages: etat.pages, horloge: horloge(etat), etape: etat.etape, rayon: etat.rayon, especes: especesPresentes(etat, data), effectifs, agents: etat.agents.length, harmonie: etat.harmonie, harmonieDetail: etat.harmonieDetail };
  }

  // Outils pour les sprints suivants et les tests : ajout direct d'agents et de populations.
  function ajouterAgent(etat, esp, x, y) {
    if (etat.agents.length >= P.maxAgents) return null;
    const a = { id: etat.prochainId++, esp, x, y, hx: x, hy: y, tx: x, ty: y, m: 'vit', mal: 0, attente: 0 };
    etat.agents.push(a);
    return a;
  }
  function fixerPopulation(etat, esp, x, y, effectif) {
    const z = zoneDe(x, y);
    (etat.populations[esp] = etat.populations[esp] || {})[z] = effectif;
    if (etat.popAncre) (etat.popAncre[esp] = etat.popAncre[esp] || {})[z] = idx(x, y);
  }

  return {
    P, N, CENTRE: C, SAISONS, ETAPES,
    preparer, creer, tick, action, passerEtape,
    evaluer, detail, toutesVraies, besoinsEspece, etapeSuivante,
    horloge, resume, presence, especesPresentes, tuilesIle, tuilesCercle, dansIle, idx,
    ajouterAgent, fixerPopulation, alea,
    besoinsOk, capacite, capaciteZone, effectif, calculerHarmonie, photographier, reclamerMission, noter,
    especesDebloquees, chercherFoyer, REGLES,
  };
});
