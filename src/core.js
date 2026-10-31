// Biome, la forêt de papier : simulation pure (GDD v2). Aucun accès au DOM.
// L'état est un objet JSON pur (sauvegarde = JSON.stringify), le hasard est déterministe.
// Sprint 1 : grille de tuiles, statistiques (fertilité, humidité, ombre), temps,
// système de conditions, actions du joueur, pousse et extension des plantes.
// Sprint 2 : arrivées, départs, capacités, chaîne alimentaire, pollinisation, fertilisation,
// harmonie, règles hors schéma (notes de ChatGPT), carnet, photos et missions de la garde.
// Sprint 3 : événements (floraison, orage, sécheresse), papiers rares journal et washi,
// progression hors ligne plafonnée à 8 h.
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
    chancePollinisation: 0.15,  // idem pour une nuée de pollinisateurs sur une fleur
    nbMissions: 3,
    // --- Événements, papiers rares, hors ligne (sprint 3) ---
    annonceEvenement: 30,       // s : la garde annonce l'événement avant qu'il commence
    margeEvenement: 0.25,       // jours : un événement ne commence ni ne finit au ras d'un changement de saison
    retourHumidite: 0.5,        // jours : temps caractéristique du retour à la normale après un orage ou une sécheresse
    seuilHarmonieRare: 0.8, bonusHarmonieRare: 1.2,
    dureeRare: 1,               // jours : un spécimen rare garde son papier jusqu'à la fin de l'événement + 1 jour
    pagesCarte: 3,              // pages pour une nouvelle carte de collection
    horsLigneMax: 8 * 3600,     // s : progression hors ligne plafonnée à 8 h
    renfortsHorsLigne: 2,       // individus de plus au plus par espèce (agents) au retour
    // --- Économie de la sève (sprint 5 bis) ---
    // Réserve plafonnée par étape : seule la production des plantes s'arrête au plafond ; photos, missions,
    // récompenses et remboursements peuvent le dépasser (un cadeau n'est jamais perdu).
    reserveMax: { prairie: 1000, lisiere: 3000, jeune_foret: 8000, foret_ancienne: 20000, zone_humide: 40000 },
    // Rendement décroissant : au-delà du seuil (sève brute par seconde, avant l'harmonie), la production ne compte
    // plus qu'à ce taux. La Prairie n'y arrive pas ; c'est l'herbe qui s'étend seule en Lisière qui est freinée.
    rendementSeuil: 2, rendementAuDela: 0.4,
    // Hors ligne : 50 % du taux pendant la première heure, puis 15 % jusqu'au plafond de 8 h
    // (8 h d'absence ≈ 1 h 30 de jeu actif, avant le plafond de réserve).
    horsLignePaliers: [[3600, 0.5], [8 * 3600, 0.15]],
    // Rôles attendus par étape (part « chaîne » de l'harmonie) et habitats de la mosaïque.
    rolesAttendus: {
      prairie: ['producteur', 'herbivore', 'insectivore', 'decomposeur', 'pollinisateur'],
      lisiere: ['producteur', 'herbivore', 'insectivore', 'decomposeur', 'pollinisateur', 'predateur'],
    },
    habitatsAttendus: { prairie: ['prairie', 'eau'], lisiere: ['prairie', 'lisiere', 'eau'] },
    seuilHabitat: { prairie: 0.1, lisiere: 0.1, sous_bois: 0.1, eau: 0.01 },
    // --- Sprint 7 : l'île vit, se dérègle, et le joueur répond (pistes 1 à 5 de docs/idees-gameplay-agir.md) ---
    vie: {
      // Voisinages qui comptent (piste 2)
      rayonVoisinage: 3,          // rayon où l'on regarde autour d'un aménagement
      herbeParPlace: 4,           // tas de pierres : 1 place de lapin + 1 par 4 tuiles d'herbe tout près (rayon 2)
      placesAbriMax: 4,
      placesRonce: 1,             // une tuile de ronce abrite 1 lapin
      printempsLapins: 1.5,       // au printemps les portées dépassent la capacité ordinaire
      hotelBonus: [0.2, 0.6],     // hôtel à insectes : +20 % de pollinisateurs, jusqu'à +80 % avec 6 fleurs autour
      fleursHotel: 6,
      verQualite: { base: 0.7, eau: 0.4, paillis: 0.3, miOmbre: 0.2 }, // « coin à vers »
      alouetteParTuiles: 25,      // 1 alouette par 25 tuiles de la plus grande prairie d'un seul tenant
      // Surpâturage (piste 1)
      herbeParLapin: 5,           // en dessous, autour du terrier, l'herbe s'use
      usure: 2,                   // usure par jour à pression maximale (1 = l'herbe disparaît)
      repousse: 0.5,              // l'herbe se remet de l'usure, par jour, quand la pression cesse
      seuilJauni: 0.35,
      // Coups de pouce (piste 4)
      gestes: {
        arroser: { etape: 'prairie', cout_seve: 8, rayon: 1.5, humidite: 30, bonus: 25, duree_jours: 1 },
        mangeoire: { etape: 'prairie', cout_graines: 2, duree_jours: 1, rayon: 7 },
        tailler: { etape: 'lisiere', cout_seve: 2 },
        effaroucher: { etape: 'lisiere', cout_seve: 20, rayon: 5, duree_jours: 1, recharge_jours: 1 },
      },
      // Problèmes (piste 1)
      dureeRecompense: 20,        // s : un problème doit avoir duré pour que sa résolution rapporte
      recompenseProbleme: { pages: 1, seve: 15 },
      // Demandes des habitants (piste 3)
      debutDemandes: 360,         // s : pas de demande pendant les premières minutes (le guide)
      intervalleDemandes: 60,     // s entre deux occasions de nouvelle demande
      chanceDemande: 0.5,
      maxDemandes: 2,
      reposDemande: 2,            // jours avant qu'une même demande puisse revenir
      recompenseDemande: { pages: 2, seve: 25 },
      chanceRareDemande: 0.34,    // une demande satisfaite : un spécimen rare devient plus probable
    },
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
    const evenements = data.evenements || [], rares = (data.rares || []).filter(r => r.statut === 'proto');
    return { _pret: true, especes, actions, etapes, plantesOmbre, missions: data.missions || [], textes: data.textes, evenements, rares };
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
    return { c: 'nu', e: '', age: 0, a: '', ancre: -1, f: fert, h: P.humiditeBase, hb: P.humiditeBase, o: 0, op: 0, champi: '', paillis: 0, nichoir: false, graines: 0, mal: 0, cm: 0, use: 0, ar: 0, mg: 0 };
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
    completer(etat);
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

  // Champs ajoutés au sprint 3 : une ancienne sauvegarde les reçoit à la reprise.
  function completer(etat) {
    if (!etat.meteo) etat.meteo = { actif: null, prevu: null, tirage: '', humidite: 0, derniere: {}, garantie: {} };
    if (!etat.rares) etat.rares = [];
    if (!etat.collection) etat.collection = {};
    if (!etat.vie) etat.vie = { pb: {}, demandes: [], repos: {}, recompenses: {}, effroi: null, tailles: 0, visites: {}, dernierGeste: -1, prochaineDemande: 0 };
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
      case 'ombrage': return t.o >= 20; // tuile à l'ombre des arbres, mi-ombre comprise (teaser de la Jeune forêt)
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
    if (P.vie.gestes[id]) { const r = geste(etat, data, id, x, y); if (r.ok) completer(etat).vie.dernierGeste = etat.temps; return r; }
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
      completer(etat).vie.dernierGeste = etat.temps;
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
      completer(etat).vie.dernierGeste = etat.temps;
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
    completer(etat).vie.dernierGeste = etat.temps;
    return { ok: true };
  }

  function planter(etat, data, i, id) {
    const t = etat.tuiles[i];
    Object.assign(t, { c: COUVERT_PLANTE[id] || 'arbre', e: id, age: 0, graines: 0, mal: 0, nichoir: false, use: 0 });
    if (data.especes[id].croissance.ombre_projetee) calculerOmbre(etat, data);
    nouveauSpecimen(etat, data, id, { tuile: i });
  }

  function retirer(etat, data, x, y) {
    if (!dansIle(etat, x, y)) return refus('hors_ile');
    const t = etat.tuiles[idx(x, y)];
    let rendu = 0;
    if (t.a) {
      const a = data.actions[t.a], ancre = t.ancre;
      rendu = t.naturel ? 0 : a.cout_seve; // un arbre abattu par la foudre ne rapporte rien
      etat.tuiles.forEach(tt => { if (tt && tt.a === a.id && tt.ancre === ancre) Object.assign(tt, { c: 'nu', a: '', ancre: -1, hb: P.humiditeBase, naturel: false }); });
    } else if (t.e) {
      const fiche = data.especes[t.e];
      rendu = fiche.croissance ? fiche.croissance.cout_seve : 0;
      if (t.nichoir) rendu += data.actions.nichoir.cout_seve;
      Object.assign(t, { c: 'nu', e: '', age: 0, nichoir: false, graines: 0, mal: 0 });
    } else if (t.c === 'roche') t.c = 'nu';
    else return refus('rien_a_retirer');
    etat.seve += Math.floor(rendu * P.remboursement);
    completer(etat).vie.dernierGeste = etat.temps;
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
    // Sprint 7 : l'hôtel compte d'autant plus qu'il y a de fleurs autour de lui (voisinage).
    if (f.roles.includes('pollinisateur')) {
      const hotel = data.actions.hotel_insectes.effets, ci = zoneCentre(etat, z);
      if (ci >= 0) {
        let best = -1;
        for (const j of tuilesCercle(etat, ci % N, (ci / N) | 0, hotel.rayon)) if (etat.tuiles[j].a === 'hotel_insectes') best = Math.max(best, qualiteHotel(etat, j));
        if (best >= 0) k *= 1 + best;
      }
    }
    if (id === 'ver') k *= qualiteVer(etat, z);
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
    // Sprint 7 (voisinages qui comptent) : un tas de pierres abrite d'autant plus de lapins qu'il y a d'herbe autour ;
    // l'herbe elle-même n'est plus un plafond global : trop de lapins usent l'herbe autour du terrier (surpâturage).
    if (id === 'lapin') { v = placesLapins(etat); if (horloge(etat).saison === 'printemps') v = Math.floor(v * P.vie.printempsLapins); }
    if (id === 'alouette') v = Math.min(v, Math.floor(plusGrandePrairie(etat) / P.vie.alouetteParTuiles));
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
      nouveauSpecimen(etat, data, id, { agent: a.id });
    } else if (f.mode === 'population') {
      const z = zoneDe(x, y);
      (etat.populations[id] = etat.populations[id] || {})[z] = Math.min(P.effectifInitial, Math.max(1, capaciteZone(etat, data, id, z)));
      (etat.popAncre[id] = etat.popAncre[id] || {})[z] = i;
      nouveauSpecimen(etat, data, id, { zone: z });
    } else { etat.tuiles[i].champi = id; nouveauSpecimen(etat, data, id, { tuile: i }); }
    ca.venu = true;
    journal(etat, o);
    if (!renfort) noter(etat, data, 'arrivee', id, 1, { nouvelle: premiere });
  }
  function controleArrivees(etat, data, h) {
    for (const id of especesDebloquees(etat, data)) {
      const f = data.especes[id];
      if (!f || f.venue !== 'spontanee' || !actifEnSaison(f, h.saison) || !momentOk(f, h.moment)) continue;
      if (f.mode === 'agent' && etat.meteo.abri) continue; // pendant l'orage, les animaux restent à l'abri
      const st = etatEspece(etat, id), n = presence(etat, data, id);
      if (n === 0) {
        const i = chercherFoyer(etat, data, id);
        if (i < 0) continue;
        st.ctl++;
        const garanti = !carnet(etat, id).venu && st.ctl >= P.garantieControles;
        if (garanti || alea(etat) < P.chanceArrivee * multiplicateur(etat, data, 'multiplicateur_arrivee', id)) { arriver(etat, data, id, i, false); st.ctl = 0; st.repro = etat.temps; }
      } else if (f.mode === 'agent' && n < capacite(etat, data, id) && etat.agents.length < P.maxAgents && alea(etat) < P.chanceRenfort) {
        const i = chercherFoyer(etat, data, id);
        if (i >= 0) arriver(etat, data, id, i, true);
      }
    }
  }

  // ---------- Agents : déplacements (chaque seconde) ----------
  function pasAgents(etat, data, dt) {
    const mg = mangeoires(etat);
    for (const a of etat.agents) {
      if (a.m === 'dort') continue;
      const v = (P.vitesse[a.esp] || P.vitesse.defaut) * dt;
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > v) { a.x += dx / d * v; a.y += dy / d * v; continue; }
      a.x = a.tx; a.y = a.ty;
      if (a.m === 'arrive') { a.m = 'vit'; a.attente = 2; }
      else if (a.m === 'part') a.sorti = true;
      else if (etat.meteo.abri) { a.tx = a.hx; a.ty = a.hy; } // à l'abri : retour au foyer, on ne flâne pas
      else if ((a.attente -= dt) <= 0) {
        // Sprint 7 : des graines au sol attirent les oiseaux des environs (coup de pouce « Graines au sol »).
        const m = OISEAUX.includes(a.esp) && mg.find(i => Math.hypot(i % N - a.hx, ((i / N) | 0) - a.hy) <= P.vie.gestes.mangeoire.rayon);
        if (m !== undefined && m !== false && alea(etat) < 0.6) {
          a.tx = m % N + (alea(etat) - 0.5); a.ty = ((m / N) | 0) + (alea(etat) - 0.5);
          a.attente = 3 + alea(etat) * 4; a.mange = m;
          continue;
        }
        if (a.mange !== undefined) {
          // Il a picoré les graines : visite notée (demande « les merles ont faim »), comportement visible.
          const vie = completer(etat).vie;
          vie.visites[a.esp] = etat.temps;
          if (alea(etat) < 0.5) journal(etat, { type: 'repas', id: a.esp, agent: a.id, proie: 'graines', x: a.mange % N, y: (a.mange / N) | 0 });
          delete a.mange;
        }
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
    pasEvenements(etat, data, h);
    nettoyerRares(etat, data);
    pasPopulations(etat, data, h, jour);
    pasVieAgents(etat, data, h, jour, dt);
    pasChampignons(etat, data, h, jour);
    pasFertilisation(etat, data, h, jour);
    calculerPollinisation(etat, data, h);
    pasVie(etat, data, h);
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
    // Sprint 7 : un hérisson ne passe l'hiver que s'il trouve un tas de bois libre (problème annoncé à l'automne).
    let places = placesHibernation(etat);
    for (const a of etat.agents) {
      const f = data.especes[a.esp];
      if (actifEnSaison(f, saison)) { if (a.m === 'dort') { a.m = 'vit'; journal(etat, { type: 'reveil', id: a.esp, agent: a.id }); } continue; }
      if (a.m === 'part') continue;
      if (f.hiver === 'migre') { const b = pointBord(etat, a.x, a.y); Object.assign(a, { m: 'part', tx: b.x, ty: b.y }); journal(etat, { type: 'migration', id: a.esp, agent: a.id }); }
      else if (f.hiver === 'hiberne') {
        if (a.esp === 'herisson' && places <= 0) {
          const k = f.besoins.findIndex(b => b.type === 'amenagement' && b.id === 'tas_bois');
          carnet(etat, a.esp).manque = k;
          fairePartir(etat, a, 'hiver', k);
          continue;
        }
        if (a.esp === 'herisson') places--;
        Object.assign(a, { m: 'dort', x: a.hx, y: a.hy, tx: a.hx, ty: a.hy }); journal(etat, { type: 'hibernation', id: a.esp, agent: a.id });
      }
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
      const g = f.reproduction.portee_moyenne / f.reproduction.intervalle_jours * multiplicateur(etat, data, 'multiplicateur_croissance', id);
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
          if (c >= 0) { zones[v] = Math.min(P.effectifInitial / 2, capaciteZone(etat, data, id, v)); ancres[v] = c; nouveauSpecimen(etat, data, id, { zone: v }); }
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
          nouveauSpecimen(etat, data, id, { agent: b.id });
        }
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
    if (h.moment === 'jour' || etat.meteo.abri) return;
    const proies = etat.agents.filter(b => b.esp === it.cible && b.m === 'vit');
    if (proies.length <= P.plancherProies) return;
    // Sprint 7 : le renard éloigné d'un coin n'y chasse plus (coup de pouce « Éloigner le renard »).
    const ef = etat.vie && etat.vie.effroi;
    const chassables = ef && etat.temps < ef.fin ? proies.filter(b => Math.hypot(b.x - ef.x, b.y - ef.y) > P.vie.gestes.effaroucher.rayon) : proies;
    if (!chassables.length) return;
    // Taux journalier concentré sur le tiers de journée où il chasse.
    if (alea(etat) >= it.intensite * proies.length * jour * 3) return;
    const p = chassables[Math.floor(alea(etat) * chassables.length)];
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
        if (besoinsOk(etat, data, id, j).ok) { etat.tuiles[j].champi = id; n++; nouveauSpecimen(etat, data, id, { tuile: j }); }
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
  // papier (facultatif) : le joueur a cliqué sur un spécimen rare de ce papier ; il entre dans la collection.
  function photographier(etat, dataBrute, id, papier) {
    const data = preparer(dataBrute), f = data.especes[id];
    completer(etat);
    if (!f) return refus('espece_inconnue');
    if (presence(etat, data, id) === 0) return refus('absente');
    let carte = false;
    if (papier) {
      if (!etat.rares.some(r => r.id === id && r.papier === papier)) return refus('pas_de_specimen', { papier });
      const cle = id + ':' + papier;
      if (!etat.collection[cle]) {
        etat.collection[cle] = { t: etat.temps };
        etat.pages += P.pagesCarte;
        carte = true;
        journal(etat, { type: 'collection', id, papier });
      }
    }
    const ca = carnet(etat, id), premiere = !ca.photo;
    if (premiere) { ca.photo = true; etat.pages += f.production.pages_photo; etat.seve += P.sevePhoto; }
    noter(etat, data, 'photo', id, 1, { nouvelle: premiere });
    return { ok: true, premiere, carte };
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

  // =====================================================================
  // ---------- Événements (sprint 3, GDD 5.1 et 8.5) ----------
  // =====================================================================
  // Un tirage par saison, en jeu actif seulement (hors ligne, la saison est figée) :
  // les événements possibles sont tirés du plus rare au plus fréquent, le premier qui sort est retenu.
  function debutSaison(etat) { const d = P.joursParSaison * P.dureeJour; return Math.floor(etat.temps / d) * d; }
  function pasEvenements(etat, data, h) {
    const m = etat.meteo, cle = h.annee + '-' + h.saison;
    if (m.tirage !== cle && !m.actif) {
      m.tirage = cle;
      m.prevu = null;
      const candidats = data.evenements
        .filter(ev => ev.statut === 'proto' && (ev.saisons[h.saison] || 0) > 0)
        .filter(ev => !ev.repos_annees || m.derniere[ev.id] === undefined || h.annee - m.derniere[ev.id] > ev.repos_annees)
        .filter(ev => toutesVraies(etat, data, ev.conditions, {}))
        .sort((a, b) => a.saisons[h.saison] - b.saisons[h.saison]);
      for (const ev of candidats) {
        if (alea(etat) >= ev.saisons[h.saison]) continue;
        // Début au hasard dans la saison, en laissant l'événement finir avant la saison suivante.
        const jMax = Math.max(P.margeEvenement, P.joursParSaison - ev.duree_jours - P.margeEvenement);
        const debut = debutSaison(etat) + (P.margeEvenement + alea(etat) * (jMax - P.margeEvenement)) * P.dureeJour;
        m.prevu = { id: ev.id, debut: Math.max(Math.round(debut), etat.temps + P.annonceEvenement), annonce: false };
        break;
      }
    }
    const pr = m.prevu;
    if (pr && !m.actif) {
      const ev = data.evenements.find(e => e.id === pr.id);
      if (!pr.annonce && etat.temps >= pr.debut - P.annonceEvenement) { pr.annonce = true; journal(etat, { type: 'annonce', id: pr.id, debut: pr.debut }); }
      if (etat.temps >= pr.debut) {
        m.prevu = null;
        // Conditions vérifiées au tirage puis de nouveau au départ (sécheresse : jamais avant la Lisière).
        if (toutesVraies(etat, data, ev.conditions, {})) commencerEvenement(etat, data, ev);
      }
    }
    if (m.actif && etat.temps >= m.actif.fin) finirEvenement(etat, data);
  }
  function commencerEvenement(etat, data, ev) {
    const m = etat.meteo, h = horloge(etat);
    m.actif = { id: ev.id, debut: etat.temps, fin: etat.temps + Math.round(ev.duree_jours * P.dureeJour) };
    m.derniere[ev.id] = h.annee;
    if (ev.papier) m.garantie[ev.papier.id] = 0;
    journal(etat, { type: 'evenement', id: ev.id, fin: m.actif.fin });
    for (const ef of ev.effets) {
      if (ef.type === 'stat_tuile' && ef.stat === 'humidite') {
        for (const i of tuilesIle(etat)) { const t = etat.tuiles[i]; if (t.c !== 'eau') t.h = Math.max(0, Math.min(100, t.h + ef.delta)); }
      } else if (ef.type === 'stat_tuile') {
        const champ = { fertilite: 'f', ombre: 'o' }[ef.stat];
        for (const i of tuilesIle(etat)) { const t = etat.tuiles[i]; if (t.c !== 'eau' && t.c !== 'roche') t[champ] = Math.max(0, Math.min(100, t[champ] + ef.delta)); }
      } else if (ef.type === 'abattre_arbre') {
        for (let k = 0; k < ef.nombre; k++) if (alea(etat) < ef.chance) abattreArbre(etat, data);
      } else if (ef.type === 'abri_animaux') m.abri = true;
    }
  }
  // La foudre abat un arbre adulte : il devient un tas de bois mort naturel (utile au hérisson et à la coulemelle),
  // et une petite clairière s'ouvre. Un nichoir posé dessus est remboursé en entier.
  function abattreArbre(etat, data) {
    const adultes = tuilesIle(etat).filter(i => { const t = etat.tuiles[i]; return t.c === 'arbre' && estAdulte(t, data.especes[t.e]); });
    if (!adultes.length) return;
    const sansNichoir = adultes.filter(i => !etat.tuiles[i].nichoir);
    const l = sansNichoir.length ? sansNichoir : adultes;
    const i = l[Math.floor(alea(etat) * l.length)], t = etat.tuiles[i], espece = t.e;
    if (t.nichoir) etat.seve += data.actions.nichoir.cout_seve;
    Object.assign(t, { c: 'bois_mort', e: '', age: 0, a: 'tas_bois', ancre: i, naturel: true, nichoir: false, graines: 0, mal: 0, champi: t.champi });
    calculerOmbre(etat, data);
    journal(etat, { type: 'foudre', id: espece, x: i % N, y: (i / N) | 0 });
  }
  function finirEvenement(etat, data) {
    const m = etat.meteo, ev = data.evenements.find(e => e.id === m.actif.id);
    m.actif = null; m.abri = false;
    const o = { type: 'evenement_fin', id: ev.id };
    if (ev.recompense) {
      o.reussi = toutesVraies(etat, data, ev.recompense.condition, {});
      if (o.reussi) { etat.pages += ev.recompense.pages || 0; etat.seve += ev.recompense.seve || 0; o.pages = ev.recompense.pages || 0; o.seve = ev.recompense.seve || 0; }
    }
    journal(etat, o);
    noter(etat, data, 'evenement', ev.id); // mission « traverser un événement »
  }
  // Humidité de l'air (décalage de l'équilibre des tuiles) : tenue par l'orage, creusée par la sécheresse,
  // puis retour progressif à la normale. Renvoie le plancher d'humidité en vigueur, ou null.
  function pasHumiditeMeteo(etat, data, dt) {
    const m = etat.meteo, ev = m.actif && data.evenements.find(e => e.id === m.actif.id);
    let tenu = false, plancher = null;
    if (ev) for (const ef of ev.effets) {
      if (ef.stat !== 'humidite') continue;
      if (ef.type === 'stat_tuile') { m.humidite = Math.max(m.humidite, ef.delta); tenu = true; }
      else if (ef.type === 'stat_tuile_par_s') {
        const lim = ef.cumul_max === undefined ? 100 : ef.cumul_max;
        m.humidite = Math.max(-lim, Math.min(lim, m.humidite + ef.delta * dt));
        tenu = true;
        if (ef.plancher !== undefined) plancher = ef.plancher;
      }
    }
    if (!tenu && m.humidite) {
      m.humidite *= 1 - Math.min(1, dt / (P.retourHumidite * P.dureeJour));
      if (Math.abs(m.humidite) < 0.05) m.humidite = 0;
    }
    return plancher;
  }
  // Produit des facteurs des effets actifs d'un type qui visent cette espèce (par id ou par rôle).
  function multiplicateur(etat, data, type, id) {
    const m = etat.meteo, ev = m.actif && data.evenements.find(e => e.id === m.actif.id);
    if (!ev) return 1;
    const f = data.especes[id];
    let k = 1;
    for (const ef of ev.effets) if (ef.type === type && (!ef.cible || ef.cible === id || (f && f.roles.includes(ef.cible)))) k *= ef.facteur;
    return k;
  }
  // État de la météo pour l'interface : événement en cours (et sa progression), événement annoncé.
  function meteo(etat, dataBrute) {
    const m = completer(etat).meteo;
    const actif = m.actif && { id: m.actif.id, reste: m.actif.fin - etat.temps, progression: (etat.temps - m.actif.debut) / (m.actif.fin - m.actif.debut) };
    const annonce = m.prevu && m.prevu.annonce ? { id: m.prevu.id, dans: m.prevu.debut - etat.temps } : null;
    return { actif, annonce, humidite: m.humidite, abri: !!m.abri };
  }

  // =====================================================================
  // ---------- Papiers rares (sprint 3, GDD 5.3 et 8.6) ----------
  // =====================================================================
  // Chance actuelle d'un papier : base × événement × bonus d'harmonie.
  function chancePapier(etat, data, r) {
    const ev = etat.meteo.actif && data.evenements.find(e => e.id === etat.meteo.actif.id);
    const boost = ev && ev.papier && ev.papier.id === r.id ? ev.papier.multiplicateur : 1;
    return { chance: r.chance_base * boost * (etat.harmonie > P.seuilHarmonieRare ? P.bonusHarmonieRare : 1), boost: boost > 1 };
  }
  // Tirage à l'arrivée d'un individu ou à l'apparition d'une touffe ou d'une nuée.
  // Pendant l'événement qui le favorise, un papier est garanti au bout de garantie_apres essais sans succès.
  function tirerPapier(etat, data, id) {
    const f = data.especes[id];
    if (!f) return '';
    // Le papier favorisé par l'événement en cours est tiré en premier : chaque essai compte pour sa garantie.
    const ev = etat.meteo.actif && data.evenements.find(e => e.id === etat.meteo.actif.id);
    const favori = ev && ev.papier ? ev.papier.id : '';
    for (const r of data.rares.slice().sort((a, b) => (b.id === favori) - (a.id === favori))) {
      if (!f.papiers_rares.includes(r.id)) continue;
      const { chance, boost } = chancePapier(etat, data, r);
      let ok = alea(etat) < chance;
      if (boost && r.garantie_apres) {
        const g = etat.meteo.garantie;
        g[r.id] = (g[r.id] || 0) + 1;
        if (g[r.id] >= r.garantie_apres) ok = true;
        if (ok) g[r.id] = 0;
      }
      if (ok) return r.id;
    }
    return '';
  }
  // ou = { agent: id } | { zone: z } | { tuile: i }
  function nouveauSpecimen(etat, data, id, ou) {
    if (!data.rares.length) return;
    completer(etat);
    const papier = tirerPapier(etat, data, id);
    if (!papier) return;
    const m = etat.meteo, fin = Math.max(etat.temps, m.actif ? m.actif.fin : 0) + P.dureeRare * P.dureeJour;
    const r = Object.assign({ id, papier, fin }, ou);
    etat.rares.push(r);
    const p = positionSpecimen(etat, r);
    journal(etat, Object.assign({ type: 'rare', id, papier }, p || {}));
  }
  function positionSpecimen(etat, r) {
    if (r.agent !== undefined) { const a = etat.agents.find(b => b.id === r.agent); return a ? { x: Math.round(a.x), y: Math.round(a.y) } : null; }
    if (r.zone !== undefined) { const c = zoneCentre(etat, r.zone); return c >= 0 ? { x: c % N, y: (c / N) | 0 } : null; }
    return { x: r.tuile % N, y: (r.tuile / N) | 0 };
  }
  // Un spécimen rare reprend un papier normal à la fin de sa durée, ou disparaît avec son porteur.
  function nettoyerRares(etat, data) {
    etat.rares = etat.rares.filter(r => {
      if (etat.temps >= r.fin) return false;
      if (r.agent !== undefined) return etat.agents.some(a => a.id === r.agent);
      if (r.zone !== undefined) return !!(etat.populations[r.id] && etat.populations[r.id][r.zone] !== undefined);
      const t = etat.tuiles[r.tuile];
      return !!t && (t.e === r.id || t.champi === r.id);
    });
  }
  // Pour le carnet : chances affichées et spécimens rares présents (avec leur position).
  function chancesRares(etat, dataBrute) {
    const data = preparer(dataBrute);
    completer(etat);
    return data.rares.map(r => {
      const c = chancePapier(etat, data, r);
      return { id: r.id, chance: c.chance, evenement: c.boost, garantieDans: c.boost && r.garantie_apres ? r.garantie_apres - (etat.meteo.garantie[r.id] || 0) : null };
    });
  }
  function raresPresents(etat, dataBrute) {
    const data = preparer(dataBrute);
    completer(etat);
    nettoyerRares(etat, data);
    return etat.rares.map(r => Object.assign({}, r, positionSpecimen(etat, r), { reste: r.fin - etat.temps }));
  }

  // =====================================================================
  // ---------- Teaser de la Jeune forêt (sprint 5 bis, GDD 10.2) ----------
  // =====================================================================
  // À la dernière étape du prototype, la jauge montre les conditions de la Jeune forêt (GDD 2). Quand elles
  // sont toutes réunies, un premier chêne germe sous un bouleau adulte : « La suite pousse… ». On ne passe pas
  // l'étape (pas de contenu) ; le chêne reste, même si l'île change ensuite. Condition avec duree_jours :
  // vraie sans interruption pendant cette durée (le renard présent depuis une saison).
  const TEASER = {
    id: 'jeune_foret', apres: 'lisiere',
    conditions: [
      { type: 'arbre_adulte', id: 'bouleau', min: 8 },
      { type: 'couvert', couvert: 'ombrage', min: 0.1, portee: 'ile' },
      { type: 'espece', id: 'renard', min: 1, portee: 'ile', duree_jours: 3 },
      { type: 'nb_especes', min: 12, etapes: ['prairie', 'lisiere'] },
      { type: 'couvert', couvert: 'ouvert', min: 0.25, portee: 'ile' },
    ],
  };
  function teaser(etat, dataBrute) {
    const data = preparer(dataBrute);
    if (etat.etape !== TEASER.apres) return null;
    const tz = etat.teaser || {}, dep = tz.depuis || {};
    const conditions = TEASER.conditions.map((c, k) => {
      const r = Object.assign({ type: c.type }, evaluer(etat, data, c));
      if (c.duree_jours && c.type !== 'harmonie') {
        const tenu = r.ok && dep[k] !== undefined ? (etat.temps - dep[k]) / P.dureeJour : 0;
        Object.assign(r, { duree_jours: c.duree_jours, tenu_jours: Math.min(c.duree_jours, tenu), ok: r.ok && tenu >= c.duree_jours });
      }
      return r;
    });
    return { id: TEASER.id, conditions, definitions: TEASER.conditions, ok: conditions.every(c => c.ok), chene: tz.chene === undefined ? -1 : tz.chene };
  }
  function pasTeaser(etat, data) {
    if (etat.etape !== TEASER.apres) return;
    const tz = etat.teaser || (etat.teaser = { depuis: {} });
    if (tz.chene !== undefined) return;
    TEASER.conditions.forEach((c, k) => {
      if (!c.duree_jours || c.type === 'harmonie') return;
      if (evaluer(etat, data, c).ok) { if (tz.depuis[k] === undefined) tz.depuis[k] = etat.temps; }
      else delete tz.depuis[k];
    });
    const r = teaser(etat, data);
    if (!r.ok) return;
    // Une tuile libre (herbe ou sol nu, sans aménagement) à côté d'un bouleau adulte, la plus ombragée.
    let meilleur = -1, ombre = -1;
    for (const i of tuilesIle(etat)) {
      const t = etat.tuiles[i];
      if ((t.c !== 'herbe' && t.c !== 'nu') || t.a || t.paillis > 0) continue;
      const x = i % N, y = (i / N) | 0;
      const sousBouleau = tuilesCercle(etat, x, y, 1.5).some(j => { const b = etat.tuiles[j]; return b.e === 'bouleau' && estAdulte(b, data.especes.bouleau); });
      if (sousBouleau && t.o > ombre) { meilleur = i; ombre = t.o; }
    }
    if (meilleur < 0) return;
    tz.chene = meilleur; tz.t = etat.temps;
    journal(etat, { type: 'chene', i: meilleur, x: meilleur % N, y: (meilleur / N) | 0 });
  }

  // =====================================================================
  // ---------- Hors ligne (sprint 3, GDD 1.3, 1.5 et 6.2) ----------
  // =====================================================================
  // Appelé par le jeu au retour du joueur, avec le temps écoulé depuis la dernière sauvegarde.
  // Plafond 8 h. Sève à 50 % du taux, les plantes poussent et donnent des graines, les arrivées possibles
  // sont résolues. Aucun départ, aucun événement, saison et heure figées (etat.temps n'avance pas).
  function horsLigne(etat, dataBrute, secondes) {
    const data = preparer(dataBrute);
    completer(etat);
    const s = Math.max(0, Math.min(secondes || 0, P.horsLigneMax));
    const rapport = { duree: s, plafonne: secondes > P.horsLigneMax, seve: 0, graines: 0, nouvelles: [], arrivees: [], double: false };
    if (s < P.pas) return rapport;
    const h = horloge(etat), jours = s / P.dureeJour, croiss = P.croissanceSaison[h.saison];
    // Sève : production actuelle × harmonie × taux par palier, sans dépasser le plafond de la réserve.
    const brute = Math.floor(rendement(productionSeve(etat, data)) * (0.5 + etat.harmonie) * secondesHorsLigne(s));
    const seve = Math.max(0, Math.min(brute, Math.floor(reserveMax(etat) - etat.seve)));
    etat.seve += seve; rapport.seve = seve; rapport.plein = seve < brute;
    const paillis = data.actions.paillis.effets;
    for (const i of tuilesIle(etat)) {
      const t = etat.tuiles[i];
      t.mal = 0; t.cm = 0;
      if (t.paillis > 0) {
        const part = Math.min(t.paillis, jours) / paillis.duree_jours;
        t.f = Math.min(100, t.f + paillis.fertilite * part); t.hb = Math.min(100, t.hb + paillis.humidite * part);
        t.paillis = Math.max(0, t.paillis - jours);
      }
      if (!t.e) continue;
      const fiche = data.especes[t.e];
      t.age += jours * croiss;
      const g = P.graines[t.e];
      if (g && estAdulte(t, fiche) && g.saisons.includes(h.saison)) t.graines = Math.min(P.grainesMaxTuile, t.graines + g.parJour * jours);
    }
    calculerOmbre(etat, data);
    // Personne ne part pendant l'absence : les compteurs de manque repartent de zéro au retour.
    for (const a of etat.agents) a.mal = 0;
    etat.popMal = {};
    for (const st of Object.values(etat.esp)) st.surcap = 0;
    // Arrivées : chaque espèce absente dont les besoins sont réunis vient (sans attendre le bon moment de la journée).
    for (const id of especesDebloquees(etat, data)) {
      const f = data.especes[id];
      if (!f || f.venue !== 'spontanee' || !actifEnSaison(f, h.saison)) continue;
      const n = presence(etat, data, id);
      let venus = 0;
      if (n === 0) {
        const i = chercherFoyer(etat, data, id);
        if (i < 0) continue;
        const premiere = !carnet(etat, id).venu;
        arriver(etat, data, id, i, false);
        if (f.mode === 'agent') poserAuFoyer(etat);
        rapport.arrivees.push(id); if (premiere) rapport.nouvelles.push(id);
        venus = 1;
      }
      if (f.mode === 'agent') {
        const cap = capacite(etat, data, id);
        for (let k = 0; k < P.renfortsHorsLigne && n + venus < cap && etat.agents.length < P.maxAgents; k++) {
          const i = chercherFoyer(etat, data, id);
          if (i < 0) break;
          arriver(etat, data, id, i, true); poserAuFoyer(etat); venus++;
        }
      }
    }
    journal(etat, { type: 'retour', duree: s, seve, nouvelles: rapport.nouvelles.slice() });
    return rapport;
  }
  // Le dernier agent arrivé est déjà chez lui (il n'a pas besoin de traverser l'île sous les yeux du joueur).
  function poserAuFoyer(etat) {
    const a = etat.agents[etat.agents.length - 1];
    if (a && a.m === 'arrive') Object.assign(a, { x: a.hx, y: a.hy, m: 'vit', attente: 2 });
  }
  // Pub récompensée « Retour doublé » : une fois par retour.
  function doublerRetour(etat, rapport) {
    if (!rapport || rapport.double) return refus('deja_double');
    rapport.double = true; etat.seve += rapport.seve;
    return { ok: true, seve: rapport.seve };
  }
  // Secondes de production « actives » équivalentes à une absence de s secondes (paliers hors ligne).
  function secondesHorsLigne(s) {
    let v = 0, debut = 0;
    for (const [fin, taux] of P.horsLignePaliers) { if (s > debut) v += (Math.min(s, fin) - debut) * taux; debut = fin; }
    return v;
  }
  function reserveMax(etat) { return P.reserveMax[etat.etape] || P.reserveMax.prairie; }
  function rendement(brute) { return brute <= P.rendementSeuil ? brute : P.rendementSeuil + (brute - P.rendementSeuil) * P.rendementAuDela; }
  // Ajoute de la sève produite par les plantes (ou un bonus de production) sans dépasser la réserve ;
  // si la réserve dépasse déjà le plafond (cadeaux), elle n'est pas réduite.
  function ajouterProduction(etat, v) {
    if (v <= 0) return 0;
    const avant = etat.seve;
    etat.seve = Math.max(avant, Math.min(reserveMax(etat), avant + v));
    return etat.seve - avant;
  }
  // Sève produite par seconde avant le facteur d'harmonie (même règle que pasTuiles).
  function productionSeve(etat, data) {
    let v = 0;
    for (const i of tuilesIle(etat)) {
      const t = etat.tuiles[i];
      if (t.e && data.especes[t.e]) v += data.especes[t.e].production.seve_par_s * (estAdulte(t, data.especes[t.e]) ? 1 : 0.5);
      if (t.champi) v += data.especes[t.champi].production.seve_par_s;
    }
    return v;
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
    const plancher = pasHumiditeMeteo(etat, data, dt);

    for (const i of ile) {
      const t = etat.tuiles[i];
      // Paillis : fertilité et humidité gagnées lentement, sur sa durée.
      if (t.paillis > 0) {
        const part = Math.min(t.paillis, jour) / paillis.duree_jours;
        t.f = Math.min(100, t.f + paillis.fertilite * part);
        t.hb = Math.min(100, t.hb + paillis.humidite * part);
        t.paillis = Math.max(0, t.paillis - jour);
      }
      // Sprint 7 : arrosage (humidité tenue un moment) et graines au sol, qui s'épuisent.
      if (t.ar > 0) t.ar = Math.max(0, t.ar - jour);
      if (t.mg > 0) t.mg = Math.max(0, t.mg - jour);
      // Humidité : rejoint l'équilibre (sol + eau voisine).
      if (t.c === 'eau') t.h = 100;
      else {
        let cible = Math.min(100, t.hb + eau[i] + etat.meteo.humidite + P.humusEau * Math.max(0, t.f - 10) + (t.ar > 0 ? P.vie.gestes.arroser.bonus : 0));
        if (plancher !== null) cible = Math.max(cible, Math.min(plancher, t.h)); // la sécheresse ne descend pas sous le plancher
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
      if (ok) { t.mal = 0; t.age += jour * croiss * multiplicateur(etat, data, 'multiplicateur_croissance', t.e); }
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
        t.graines = Math.min(P.grainesMaxTuile, t.graines + g.parJour * pol * multiplicateur(etat, data, 'multiplicateur_graines', t.e) * jour);
        if (Math.floor(t.graines) > avant) etat.journal.push({ t: etat.temps, type: 'graines', id: t.e, x, y });
      }
      const ext = fiche.croissance && fiche.croissance.extension_par_jour;
      if (adulte && ext && croiss > 0 && alea(etat) < ext * pol * jour * croiss) naissances.push([i, t.e]);
    }
    // Extension vers une tuile voisine nue où l'espèce a ce qu'il lui faut.
    for (const [i, id] of naissances) {
      const x = i % N, y = (i / N) | 0;
      const voisins = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
        .filter(([vx, vy]) => { if (!dansIle(etat, vx, vy)) return false; const v = etat.tuiles[idx(vx, vy)]; return !v.a && (v.c === 'nu' || (id === 'ronce' && v.c === 'herbe')); });
      if (!voisins.length) continue;
      const [vx, vy] = voisins[Math.floor(alea(etat) * voisins.length)];
      if (data.especes[id].besoins.every(c => evaluer(etat, data, c, { x: vx, y: vy, soi: idx(vx, vy) }).ok)) planter(etat, data, idx(vx, vy), id);
    }
    for (const i of ile) { const t = etat.tuiles[i]; if (t.champi) seve += data.especes[t.champi].production.seve_par_s * dt; }
    // Production de sève : rendement décroissant, × 0,5 à 1,5 selon l'harmonie (GDD 1.4), plafond de réserve.
    ajouterProduction(etat, rendement(seve / dt) * dt * (0.5 + etat.harmonie));
    calculerOmbre(etat, data);
  }

  function tick(etat, dataBrute, dt) {
    const data = preparer(dataBrute);
    completer(etat);
    etat.accu += dt;
    while (etat.accu >= P.pas) {
      etat.accu -= P.pas;
      etat.temps += P.pas;
      pasTuiles(etat, data, P.pas);
      pasAgents(etat, data, P.pas);
      if (etat.temps % P.pasEcologie === 0) { pasEcologie(etat, data, P.pasEcologie); pasTeaser(etat, data); }
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

  // =====================================================================
  // ---------- Sprint 7 : l'île vit, se dérègle, et le joueur répond ----------
  // Pistes de docs/idees-gameplay-agir.md validées par Christophe le 31/10 :
  // 1. des problèmes visibles à régler (surpâturage, ronces envahissantes, sol sec, hérisson sans abri d'hiver,
  //    renard qui vide le terrier), 2. les voisinages comptent (capacités selon ce qui entoure un aménagement),
  // 3. les habitants demandent (avec délai, récompense ou départ expliqué), 4. coups de pouce (arroser, tailler,
  // éloigner le renard, graines au sol), 5. voir l'effet de chaque geste (qualité d'une pose, ce qui limite une espèce).
  // =====================================================================
  const OISEAUX = ['merle', 'alouette'];
  const autour = (etat, i, r) => tuilesCercle(etat, i % N, (i / N) | 0, r);
  const compterAutour = (etat, i, r, f) => autour(etat, i, r).filter(j => f(etat.tuiles[j])).length;
  const ancres = (etat, id) => { const s = new Set(); for (const i of tuilesIle(etat)) { const t = etat.tuiles[i]; if (t.a === id) s.add(t.ancre >= 0 ? t.ancre : i); } return [...s]; };

  // ---------- Voisinages qui comptent (piste 2) ----------
  // Places de lapins d'un tas de pierres : 1, plus 1 par 6 tuiles d'herbe dans un rayon de 3 (5 au plus).
  // Places de lapins d'un tas de pierres : 1, plus 1 par 4 tuiles d'herbe tout près (rayon 2), 4 au plus.
  // Les lapins broutent plus loin (rayon 3) : semer de l'herbe autour du terrier les nourrit sans en attirer davantage.
  function placesAbri(etat, i) {
    const h = compterAutour(etat, i, 2, t => t.c === 'herbe');
    return Math.max(1, Math.min(P.vie.placesAbriMax, 1 + Math.floor(h / P.vie.herbeParPlace)));
  }
  function placesLapins(etat) {
    return ancres(etat, 'tas_pierres').reduce((s, i) => s + placesAbri(etat, i), 0) + P.vie.placesRonce * compterCouvert(etat, 'ronce');
  }
  // Hôtel à insectes : bonus de capacité des pollinisateurs selon les fleurs autour (0,2 à 0,8).
  function qualiteHotel(etat, i) {
    const f = compterAutour(etat, i, P.vie.rayonVoisinage, t => t.c === 'fleurs');
    return P.vie.hotelBonus[0] + P.vie.hotelBonus[1] * Math.min(1, f / P.vie.fleursHotel);
  }
  // « Coin à vers » : une zone près de l'eau, paillée, à mi-ombre accueille plus de vers (× 0,7 à 1,6).
  function qualiteVer(etat, z) {
    const q = P.vie.verQualite, tz = zoneTuiles(etat, z);
    let k = q.base;
    if (tz.some(i => compterAutour(etat, i, 2, t => t.c === 'eau') > 0)) k += q.eau;
    if (tz.filter(i => etat.tuiles[i].paillis > 0).length >= 2) k += q.paillis;
    if (tz.filter(i => { const o = etat.tuiles[i].o; return o >= 20 && o <= 60; }).length >= 2) k += q.miOmbre;
    return k;
  }
  // Plus grande prairie d'un seul tenant (herbe et fleurs reliées par un côté) : les alouettes en ont besoin.
  function plusGrandePrairie(etat) {
    const vu = new Set(); let best = 0;
    const ok = i => { const t = etat.tuiles[i]; return t && (t.c === 'herbe' || t.c === 'fleurs'); };
    for (const i of tuilesIle(etat)) {
      if (vu.has(i) || !ok(i)) continue;
      let n = 0; const pile = [i]; vu.add(i);
      while (pile.length) {
        const k = pile.pop(); n++;
        const x = k % N, y = (k / N) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!dansIle(etat, x + dx, y + dy)) continue;
          const j = idx(x + dx, y + dy);
          if (!vu.has(j) && ok(j)) { vu.add(j); pile.push(j); }
        }
      }
      best = Math.max(best, n);
    }
    return best;
  }
  // Places d'hibernation : un hérisson par tas de bois, deux si des ronces l'entourent (rayon 2).
  function placesHibernation(etat) {
    return ancres(etat, 'tas_bois').reduce((s, i) => s + 1 + (compterAutour(etat, i, 2, t => t.c === 'ronce') >= 2 ? 1 : 0), 0);
  }
  function mangeoires(etat) { const l = []; for (const i of tuilesIle(etat)) if (etat.tuiles[i].mg > 0) l.push(i); return l; }

  // ---------- Surpâturage (piste 1) ----------
  // Autour de chaque terrier (rayon 3), l'herbe est partagée entre les lapins qui y vivent. En dessous de
  // 5 tuiles par lapin, elle s'use : elle jaunit (use > 0,35) puis disparaît (use = 1). Sans pression, elle se remet.
  function paturage(etat, data, liste, h, jour) {
    const R = P.vie.rayonVoisinage, presse = new Map();
    const vivants = liste.filter(a => a.m === 'vit' || a.m === 'arrive');
    for (const a of vivants) {
      const i = idx(Math.round(a.hx), Math.round(a.hy));
      if (!etat.tuiles[i]) continue;
      const herbe = autour(etat, i, R).filter(j => etat.tuiles[j].c === 'herbe');
      const voisins = vivants.filter(b => Math.hypot(b.hx - a.hx, b.hy - a.hy) <= R).length;
      const part = herbe.length / Math.max(1, voisins);
      const p = Math.max(0, 1 - part / P.vie.herbeParLapin);
      if (p > 0) for (const j of herbe) presse.set(j, Math.max(presse.get(j) || 0, p));
    }
    const hiver = h.saison === 'hiver' ? 0.5 : 1;
    for (const i of tuilesIle(etat)) {
      const t = etat.tuiles[i];
      if (t.c !== 'herbe') { if (t.use) t.use = 0; continue; }
      const p = presse.get(i) || 0;
      if (p > 0) t.use = (t.use || 0) + p * P.vie.usure * hiver * jour;
      else if (t.use) t.use = Math.max(0, t.use - P.vie.repousse * jour);
      if (t.use >= 1) {
        Object.assign(t, { c: 'nu', e: '', age: 0, graines: 0, mal: 0, use: 0 });
        journal(etat, { type: 'surpaturage', id: 'lapin', x: i % N, y: (i / N) | 0 });
      }
    }
  }

  // ---------- Coups de pouce (piste 4) ----------
  function geste(etat, data, id, x, y) {
    const g = P.vie.gestes[id], vie = completer(etat).vie;
    if (!etapeAtteinte(etat, data, g.etape)) return refus('verrouille', { etape: g.etape });
    if (!dansIle(etat, x, y)) return refus('hors_ile');
    const i = idx(x, y), t = etat.tuiles[i];
    if (id === 'arroser') {
      const l = autour(etat, i, g.rayon).filter(j => { const c = etat.tuiles[j].c; return c !== 'eau' && c !== 'roche'; });
      if (!l.length) return refus('rien_a_arroser');
      const p = payer(etat, g.cout_seve, 0); if (!p.ok) return p;
      let gain = 0;
      for (const j of l) { const u = etat.tuiles[j], avant = u.h; u.h = Math.min(100, u.h + g.humidite); u.ar = g.duree_jours; gain += u.h - avant; }
      journal(etat, { type: 'arrosage', x, y });
      return { ok: true, tuiles: l.length, humidite: Math.round(gain / l.length) };
    }
    if (id === 'tailler') {
      if (t.c !== 'ronce') return refus('pas_de_ronce');
      const p = payer(etat, g.cout_seve, 0); if (!p.ok) return p;
      // La ronce taillée laisse place à l'herbe : la prairie se rouvre aussitôt (une graine toutes les 2 tailles).
      if (t.nichoir) etat.seve += data.actions.nichoir.cout_seve;
      Object.assign(t, { c: 'herbe', e: 'herbe', age: 1, graines: 0, mal: 0, nichoir: false, use: 0 });
      vie.tailles = (vie.tailles || 0) + 1;
      let graines = 0;
      if (vie.tailles % 2 === 0) { etat.graines += 1; graines = 1; }
      calculerOmbre(etat, data);
      journal(etat, { type: 'taille', x, y });
      return { ok: true, graines };
    }
    if (id === 'effaroucher') {
      const renards = etat.agents.filter(a => a.esp === 'renard' && a.m !== 'part');
      if (!renards.length) return refus('pas_de_renard');
      if (vie.effroi && etat.temps < vie.effroi.recharge) return refus('recharge', { secondes: Math.ceil(vie.effroi.recharge - etat.temps) });
      const p = payer(etat, g.cout_seve, 0); if (!p.ok) return p;
      vie.effroi = { x, y, fin: etat.temps + g.duree_jours * P.dureeJour, recharge: etat.temps + g.recharge_jours * P.dureeJour };
      // Les renards qui vivaient dans le coin vont s'installer plus loin (si un autre foyer leur convient).
      for (const a of renards) {
        if (Math.hypot(a.hx - x, a.hy - y) > g.rayon + 1) continue;
        for (let k = 0; k < 6; k++) {
          const j = chercherFoyer(etat, data, 'renard');
          if (j >= 0 && Math.hypot(j % N - x, ((j / N) | 0) - y) > g.rayon + 1) { Object.assign(a, { hx: j % N, hy: (j / N) | 0, tx: j % N, ty: (j / N) | 0 }); break; }
        }
      }
      journal(etat, { type: 'effroi', x, y });
      return { ok: true };
    }
    if (id === 'mangeoire') {
      if (!t || t.a || t.c === 'eau' || t.c === 'roche' || t.c === 'arbre' || t.mg > 0) return refus('tuile_occupee');
      const p = payer(etat, 0, g.cout_graines); if (!p.ok) return p;
      t.mg = g.duree_jours;
      journal(etat, { type: 'mangeoire', x, y });
      return { ok: true };
    }
    return refus('action_inconnue');
  }

  // ---------- Problèmes (piste 1) ----------
  // Chaque problème : { id, x, y, gravite (1 ou 2), especes, valeurs, solutions (actions conseillées), delai? }.
  function problemes(etat, dataBrute) {
    const data = preparer(dataBrute), l = [], ile = tuilesIle(etat), h = horloge(etat);
    const centre = liste => {
      let x = 0, y = 0; for (const i of liste) { x += i % N; y += (i / N) | 0; }
      x /= liste.length; y /= liste.length;
      let best = liste[0], bd = Infinity;
      for (const i of liste) { const d = Math.hypot(i % N - x, ((i / N) | 0) - y); if (d < bd) { bd = d; best = i; } }
      return { x: best % N, y: (best / N) | 0 };
    };
    // Surpâturage : de l'herbe qui jaunit autour des terriers.
    const jaunes = ile.filter(i => etat.tuiles[i].c === 'herbe' && (etat.tuiles[i].use || 0) >= P.vie.seuilJauni);
    if (jaunes.length >= 3) l.push(Object.assign({ id: 'surpaturage', gravite: jaunes.length >= 8 ? 2 : 1, especes: ['lapin'], valeurs: { n: jaunes.length, lapins: presence(etat, data, 'lapin') }, solutions: ['semer_herbe', 'retirer'] }, centre(jaunes)));
    // Ronces envahissantes : elles mangent la prairie ouverte de l'alouette.
    if (etapeAtteinte(etat, data, 'lisiere')) {
      const ronces = ile.filter(i => etat.tuiles[i].c === 'ronce');
      const ouvert = ile.filter(i => aCouvert(etat.tuiles[i], 'ouvert')).length / ile.length;
      const besoinOuvert = (data.especes.alouette.besoins.find(b => b.couvert === 'ouvert') || { min: 0.4 }).min;
      // Les ronces s'étendent dans l'herbe et le merle en sème : passé 8 % de l'île, elles mangent la prairie de l'alouette.
      const part = ronces.length / ile.length;
      if (part >= 0.08 || (ronces.length && ouvert < besoinOuvert + 0.1)) {
        // La ronce qui avance le plus dans la prairie (le plus de voisines en herbe ou en fleurs).
        let best = ronces[0], bv = -1;
        for (const i of ronces) { const v = compterAutour(etat, i, 1.5, t => t.c === 'herbe' || t.c === 'fleurs'); if (v > bv) { bv = v; best = i; } }
        l.push({ id: 'ronces', x: best % N, y: (best / N) | 0, gravite: part >= 0.15 || ouvert < besoinOuvert + 0.05 ? 2 : 1, especes: ['alouette'], valeurs: { part: Math.round(part * 100), ouvert: Math.round(ouvert * 100), min: Math.round(besoinOuvert * 100), ronces: ronces.length }, solutions: ['tailler'] });
      }
    }
    // Sol qui sèche : des fleurs ou des vers près de leur limite d'humidité.
    const fl = data.especes.fleurs.besoins.find(b => b.stat === 'humidite'), ve = data.especes.ver.besoins.find(b => b.stat === 'humidite');
    const secs = [];
    for (const i of ile) { const t = etat.tuiles[i]; if (t.e === 'fleurs' && t.h < fl.valeur + 3) secs.push([i, t.mal > 0 ? 2 : 1]); }
    for (const [z, a] of Object.entries(etat.popAncre.ver || {})) {
      if (!(etat.populations.ver && etat.populations.ver[z] >= 1) || !etat.tuiles[a]) continue;
      const hm = autour(etat, a, 1).reduce((s, j) => s + etat.tuiles[j].h, 0) / autour(etat, a, 1).length;
      if (hm < ve.valeur + 3) secs.push([a, (etat.popMal.ver && etat.popMal.ver[z] > 0) ? 2 : 1]);
    }
    if (secs.length >= 3 || secs.some(s => s[1] === 2)) {
      const pire = secs.slice().sort((a, b) => etat.tuiles[a[0]].h - etat.tuiles[b[0]].h)[0][0];
      l.push({ id: 'sec', x: pire % N, y: (pire / N) | 0, gravite: secs.some(s => s[1] === 2) ? 2 : 1, especes: ['fleurs', 'ver'], valeurs: { n: secs.length, h: Math.round(etat.tuiles[pire].h) }, solutions: ['arroser', 'paillis', 'mare'] });
    }
    // Hérisson sans abri d'hiver : à l'automne, plus de hérissons que de places dans les tas de bois.
    if (h.saison === 'automne') {
      const her = etat.agents.filter(a => a.esp === 'herisson' && a.m === 'vit');
      const places = placesHibernation(etat);
      if (her.length > places) {
        const a = her[places] || her[0];
        const finSaison = (Math.floor(etat.temps / (P.joursParSaison * P.dureeJour)) + 1) * P.joursParSaison * P.dureeJour;
        l.push({ id: 'hiver_herisson', x: Math.round(a.hx), y: Math.round(a.hy), gravite: finSaison - etat.temps < P.dureeJour ? 2 : 1, especes: ['herisson'], valeurs: { manque: her.length - places, places, herissons: her.length }, delai: finSaison - etat.temps, solutions: ['tas_bois'] });
      }
    }
    // Le renard vide le terrier : les lapins sont au plus bas, le renard risque de partir à son tour.
    const renards = etat.agents.filter(a => a.esp === 'renard' && a.m === 'vit'), lapins = etat.agents.filter(a => a.esp === 'lapin' && a.m === 'vit');
    if (renards.length && lapins.length <= P.plancherProies + 1 && h.saison !== 'hiver') {
      const ref = lapins.length ? lapins : renards;
      const c = centre(ref.map(a => idx(Math.round(a.hx), Math.round(a.hy))));
      l.push(Object.assign({ id: 'renard', gravite: lapins.length <= P.plancherProies ? 2 : 1, especes: ['lapin', 'renard'], valeurs: { lapins: lapins.length }, solutions: ['effaroucher', 'tas_pierres', 'semer_herbe'] }, c));
    }
    return l;
  }

  // ---------- Demandes des habitants (piste 3) ----------
  // Une demande : un besoin ponctuel d'une espèce présente, avec un délai. Satisfaite à temps : pages, sève,
  // naissances et un spécimen rare plus probable. Sinon : un départ (ou une nuée qui s'amenuise), expliqué.
  const nbVivants = (etat, id) => etat.agents.filter(a => a.esp === id && a.m === 'vit').length;
  const DEMANDES = {
    merle_nid: {
      esp: 'merle', saisons: ['printemps'], delai: 2, solutions: ['nichoir'],
      eligible(etat, data) {
        const n = nbVivants(etat, 'merle'), ni = compterAmenagement(etat, 'nichoir', tuilesIle(etat));
        const bouleaux = tuilesIle(etat).some(i => { const t = etat.tuiles[i]; return t.e === 'bouleau' && estAdulte(t, data.especes.bouleau) && !t.nichoir; });
        return n >= 2 && ni < Math.ceil(n / 2) && bouleaux;
      },
      base: etat => compterAmenagement(etat, 'nichoir', tuilesIle(etat)),
      ok: (etat, d) => compterAmenagement(etat, 'nichoir', tuilesIle(etat)) > d.base,
      naissances: 2,
    },
    abeille_fleurs: {
      esp: 'abeille', saisons: ['printemps', 'ete'], delai: 1.5, solutions: ['semer_fleurs'],
      lieu(etat) { const h = ancres(etat, 'hotel_insectes'); return h.length ? h.reduce((a, i) => qualiteHotel(etat, i) < qualiteHotel(etat, a) ? i : a) : -1; },
      eligible(etat) { const i = this.lieu(etat); return Object.keys(etat.populations.abeille || {}).length > 0 && i >= 0 && compterAutour(etat, i, P.vie.rayonVoisinage, t => t.c === 'fleurs') < P.vie.fleursHotel; },
      base: (etat, d) => compterAutour(etat, d.i, P.vie.rayonVoisinage, t => t.c === 'fleurs'),
      ok: (etat, d) => compterAutour(etat, d.i, P.vie.rayonVoisinage, t => t.c === 'fleurs') >= Math.min(d.base + 3, P.vie.fleursHotel + 2),
      population: 3,
    },
    lapin_abri: {
      esp: 'lapin', saisons: ['printemps', 'ete'], delai: 2, solutions: ['tas_pierres'],
      eligible(etat, data) { const n = nbVivants(etat, 'lapin'); return n >= 2 && n >= capacite(etat, data, 'lapin') && placesLapins(etat) < 12 && !(etat.vie.pb.surpaturage); },
      base: etat => placesLapins(etat),
      ok: (etat, d) => placesLapins(etat) > d.base,
      naissances: 2,
    },
    merle_faim: {
      esp: 'merle', saisons: ['hiver'], delai: 1.5, solutions: ['mangeoire'],
      eligible: etat => nbVivants(etat, 'merle') >= 1,
      base: () => 0,
      ok: (etat, d) => (etat.vie.visites.merle || -1) >= d.debut,
    },
    ver_sec: {
      esp: 'ver', saisons: ['ete'], delai: 1, solutions: ['arroser', 'paillis'],
      lieu(etat, data) {
        const ve = data.especes.ver.besoins.find(b => b.stat === 'humidite').valeur;
        let best = -1, bh = Infinity;
        for (const [z, a] of Object.entries(etat.popAncre.ver || {})) {
          if (!(etat.populations.ver && etat.populations.ver[z] >= 1) || !etat.tuiles[a]) continue;
          const hm = humiditeAutour(etat, a);
          if (hm < ve + 8 && hm < bh) { bh = hm; best = a; }
        }
        return best;
      },
      eligible(etat, data) { return this.lieu(etat, data) >= 0; },
      base: (etat, d) => Math.round(humiditeAutour(etat, d.i)),
      ok: (etat, d) => humiditeAutour(etat, d.i) >= d.base + 12,
      population: 3,
    },
  };
  function humiditeAutour(etat, i) { const l = autour(etat, i, 1); return l.reduce((s, j) => s + etat.tuiles[j].h, 0) / l.length; }
  // Lieu d'une demande (pour l'icône sur l'île) : celui de la règle, sinon le foyer d'un individu ou d'une nuée.
  function lieuDemande(etat, data, r, esp) {
    if (r.lieu) { const i = r.lieu(etat, data); if (i >= 0) return i; }
    const a = etat.agents.find(b => b.esp === esp && b.m === 'vit');
    if (a) return idx(Math.round(a.hx), Math.round(a.hy));
    const z = Object.keys(etat.popAncre[esp] || {})[0];
    return z !== undefined ? etat.popAncre[esp][z] : -1;
  }
  function pasDemandes(etat, data, h) {
    const vie = etat.vie;
    for (const d of vie.demandes.slice()) {
      const r = DEMANDES[d.id];
      const fin = k => { vie.demandes.splice(vie.demandes.indexOf(d), 1); vie.repos[d.id] = etat.temps + P.vie.reposDemande * P.dureeJour; journal(etat, Object.assign({ type: k, id: d.esp, demande: d.id, x: d.x, y: d.y }, d.res || {})); };
      if (presence(etat, data, d.esp) === 0) { fin('demande_annulee'); continue; }
      if (r.ok(etat, d)) { d.res = recompenserDemande(etat, data, d, r); fin('demande_ok'); continue; }
      if (etat.temps >= d.fin) { echouerDemande(etat, data, d); fin('demande_echec'); }
    }
    if (etat.temps < P.vie.debutDemandes || etat.temps < vie.prochaineDemande || vie.demandes.length >= P.vie.maxDemandes) return;
    vie.prochaineDemande = etat.temps + P.vie.intervalleDemandes;
    if (etat.meteo.actif || alea(etat) >= P.vie.chanceDemande) return;
    const candidates = Object.entries(DEMANDES).filter(([id, r]) => r.saisons.includes(h.saison) && !(vie.repos[id] > etat.temps)
      && !vie.demandes.some(d => d.id === id || d.esp === r.esp) && presence(etat, data, r.esp) > 0 && r.eligible(etat, data));
    if (!candidates.length) return;
    const [id, r] = candidates[Math.floor(alea(etat) * candidates.length)];
    const i = lieuDemande(etat, data, r, r.esp);
    if (i < 0) return;
    const d = { id, esp: r.esp, debut: etat.temps, fin: etat.temps + Math.round(r.delai * P.dureeJour), i, x: i % N, y: (i / N) | 0 };
    // La fin ne déborde pas sur la saison suivante (sinon la demande n'aurait plus de sens).
    const finSaison = (Math.floor(etat.temps / (P.joursParSaison * P.dureeJour)) + 1) * P.joursParSaison * P.dureeJour;
    d.fin = Math.min(d.fin, finSaison - 5);
    if (d.fin - etat.temps < 90) return;
    d.base = r.base(etat, d);
    vie.demandes.push(d);
    journal(etat, { type: 'demande', id: r.esp, demande: id, x: d.x, y: d.y, fin: d.fin });
  }
  function recompenserDemande(etat, data, d, r) {
    const rc = P.vie.recompenseDemande, f = data.especes[d.esp], res = { pages: rc.pages, seve: rc.seve, naissances: 0, rare: '' };
    etat.pages += rc.pages; etat.seve += rc.seve;
    if (r.naissances && f.mode === 'agent') {
      const parent = etat.agents.find(a => a.esp === d.esp && a.m === 'vit');
      for (let k = 0; parent && k < r.naissances && etat.agents.length < P.maxAgents; k++) {
        const b = ajouterAgent(etat, d.esp, parent.hx, parent.hy);
        journal(etat, { type: 'naissance', id: d.esp, agent: b.id, x: parent.hx, y: parent.hy });
        res.naissances++;
        nouveauSpecimen(etat, data, d.esp, { agent: b.id });
      }
    }
    if (r.population && etat.populations[d.esp]) {
      const z = zoneDe(d.x, d.y), zones = etat.populations[d.esp];
      const cle = zones[z] !== undefined ? z : Object.keys(zones)[0];
      zones[cle] += r.population;
    }
    // Un spécimen rare plus probable : une chance sur trois qu'un individu prenne un papier rare (journal ou washi).
    if (data.rares.length && alea(etat) < P.vie.chanceRareDemande) {
      const papiers = data.rares.filter(p => f.papiers_rares.includes(p.id));
      const papier = papiers[Math.floor(alea(etat) * papiers.length)].id;
      const fin = etat.temps + P.dureeRare * P.dureeJour;
      let ou = null;
      if (f.mode === 'agent') { const a = etat.agents.find(b => b.esp === d.esp && b.m === 'vit' && !etat.rares.some(x => x.agent === b.id)); if (a) ou = { agent: a.id }; }
      else if (f.mode === 'population') { const z = Object.keys(etat.populations[d.esp] || {})[0]; if (z !== undefined) ou = { zone: +z }; }
      if (ou) { etat.rares.push(Object.assign({ id: d.esp, papier, fin }, ou)); res.rare = papier; journal(etat, Object.assign({ type: 'rare', id: d.esp, papier }, positionSpecimen(etat, Object.assign({ id: d.esp }, ou)) || {})); }
    }
    return res;
  }
  function echouerDemande(etat, data, d) {
    const f = data.especes[d.esp];
    if (f.mode === 'agent') {
      const a = etat.agents.filter(b => b.esp === d.esp && b.m === 'vit').pop();
      if (a) fairePartir(etat, a, 'demande', -1);
    } else if (f.mode === 'population' && etat.populations[d.esp]) {
      for (const z of Object.keys(etat.populations[d.esp])) etat.populations[d.esp][z] = Math.max(1, etat.populations[d.esp][z] * 0.5);
    }
  }

  // ---------- Pas de la vie de l'île (toutes les 5 s) ----------
  function pasVie(etat, data, h) {
    const vie = completer(etat).vie;
    // Trop de lapins autour d'un terrier usent l'herbe (elle jaunit puis disparaît par plaques) ; sans eux, elle se remet.
    paturage(etat, data, etat.agents.filter(a => a.esp === 'lapin'), h, P.pasEcologie / P.dureeJour);
    // Hystérésis : un problème est annoncé après 2 constats de suite (10 s) et réglé après 3 absences de suite (15 s),
    // pour qu'une valeur qui hésite autour d'un seuil ne fasse pas clignoter l'icône.
    const actuels = problemes(etat, data), avant = vie.pb;
    vie.pb = {};
    for (const p of actuels) {
      const a = avant[p.id];
      const n = a ? (a.n || 0) + 1 : 1;
      vie.pb[p.id] = { depuis: a ? a.depuis : etat.temps, x: p.x, y: p.y, gravite: p.gravite, n, absent: 0, annonce: !!(a && a.annonce) };
      if (!vie.pb[p.id].annonce && n >= 2) { vie.pb[p.id].annonce = true; vie.pb[p.id].depuis = etat.temps; journal(etat, { type: 'probleme', id: p.id, x: p.x, y: p.y, gravite: p.gravite }); }
    }
    for (const [id, a] of Object.entries(avant)) {
      if (vie.pb[id]) continue;
      if (!a.annonce) continue;
      if ((a.absent || 0) < 2) { vie.pb[id] = Object.assign({}, a, { absent: (a.absent || 0) + 1 }); continue; }
      // Réglé : une petite récompense si le joueur y est pour quelque chose (un geste depuis le début du problème).
      const duree = etat.temps - a.depuis, merite = vie.dernierGeste >= a.depuis && duree >= P.vie.dureeRecompense && !(vie.recompenses[id] > etat.temps - P.dureeJour);
      const o = { type: 'probleme_regle', id, x: a.x, y: a.y, duree };
      if (merite) { const r = P.vie.recompenseProbleme; etat.pages += r.pages; etat.seve += r.seve; o.pages = r.pages; o.seve = r.seve; vie.recompenses[id] = etat.temps; }
      journal(etat, o);
    }
    pasDemandes(etat, data, h);
  }

  // Problèmes annoncés (ceux que le jeu montre) : la liste de problemes() filtrée par l'hystérésis.
  function problemesActifs(etat, dataBrute) {
    const vie = completer(etat).vie;
    return problemes(etat, dataBrute).filter(p => vie.pb[p.id] && vie.pb[p.id].annonce).map(p => Object.assign(p, { depuis: vie.pb[p.id].depuis }));
  }

  // ---------- Effet d'une pose (pistes 2 et 5) ----------
  // Qualité d'une pose de 0 à 1 sur une tuile (carte des habitats) et la valeur qui l'explique.
  function qualitePose(etat, dataBrute, id, i) {
    const data = preparer(dataBrute), t = etat.tuiles[i];
    if (!t) return null;
    const R = P.vie.rayonVoisinage, borne = v => Math.max(0, Math.min(1, v));
    const nb = (r, f) => compterAutour(etat, i, r, f);
    switch (id) {
      case 'tas_pierres': { const p = placesAbri(etat, i); return { q: (p - 1) / (P.vie.placesAbriMax - 1), v: { places: p }, especes: ['lapin'] }; }
      case 'hotel_insectes': { const f = nb(R, u => u.c === 'fleurs'); return { q: borne(f / P.vie.fleursHotel), v: { fleurs: f, bonus: Math.round(qualiteHotel(etat, i) * 100) }, especes: ['abeille', 'tircis'] }; }
      case 'mare': { const n = autour(etat, i, data.actions.mare.effets.rayon).filter(j => { const u = etat.tuiles[j]; return u.c !== 'eau' && u.c !== 'roche' && u.h < 35; }).length; return { q: borne(n / 12), v: { n }, especes: ['ver', 'fleurs'] }; }
      case 'paillis': return { q: borne((t.h + data.actions.paillis.effets.humidite - 25) / 20), v: { h: Math.round(t.h) }, especes: ['ver'] };
      case 'semer_herbe': { const v = nb(1, u => u.c === 'herbe' || u.c === 'fleurs') - (t.c === 'herbe' ? 1 : 0); return { q: borne(v / 4), v: { voisines: v }, especes: ['alouette', 'lapin', 'sauterelle'] }; }
      case 'semer_fleurs': { const h = ancres(etat, 'hotel_insectes').some(j => Math.hypot(j % N - i % N, ((j / N) | 0) - ((i / N) | 0)) <= data.actions.hotel_insectes.effets.rayon); return { q: h ? 1 : 0.4, v: { hotel: h ? 1 : 0 }, especes: ['abeille', 'tircis'] }; }
      case 'semer_ronce': { const pr = nb(2, u => u.c === 'herbe' || u.c === 'fleurs') / Math.max(1, autour(etat, i, 2).length); return { q: borne(1.2 - pr), v: { prairie: Math.round(pr * 100) }, especes: ['herisson', 'merle', 'renard'] }; }
      case 'planter_bouleau': { const r = nb(2, u => u.c === 'ronce'); return { q: r > 0 ? 1 : 0.5, v: { ronce: r }, especes: ['merle', 'coulemelle', 'tircis'] }; }
      case 'tas_bois': { const r = nb(R, u => u.c === 'ronce'); return { q: borne(r / 3), v: { ronce: r }, especes: ['herisson', 'coulemelle'] }; }
      case 'nichoir': { const r = nb(R, u => u.c === 'ronce'); return { q: r >= 2 ? 1 : 0.4, v: { ronce: r }, especes: ['merle'] }; }
      case 'arroser': { const l = autour(etat, i, P.vie.gestes.arroser.rayon).filter(j => etat.tuiles[j].e || etat.tuiles[j].champi); const hm = l.length ? l.reduce((s, j) => s + etat.tuiles[j].h, 0) / l.length : 100; return { q: borne((45 - hm) / 25), v: { h: Math.round(hm) }, especes: ['fleurs', 'ver'] }; }
      case 'tailler': { const pr = nb(2, u => u.c === 'herbe' || u.c === 'fleurs') / Math.max(1, autour(etat, i, 2).length); return { q: borne(pr * 1.4), v: { prairie: Math.round(pr * 100) }, especes: ['alouette'] }; }
      case 'effaroucher': { const n = etat.agents.filter(a => a.esp === 'lapin' && a.m === 'vit' && Math.hypot(a.hx - i % N, a.hy - ((i / N) | 0)) <= P.vie.gestes.effaroucher.rayon).length; return { q: borne(n / 4), v: { lapins: n }, especes: ['lapin'] }; }
      case 'mangeoire': { const n = etat.agents.filter(a => OISEAUX.includes(a.esp) && a.m === 'vit' && Math.hypot(a.hx - i % N, a.hy - ((i / N) | 0)) <= P.vie.gestes.mangeoire.rayon).length; return { q: borne(n / 2), v: { oiseaux: n }, especes: OISEAUX.slice() }; }
    }
    return null;
  }
  // Carte des habitats : qualité de la pose sur chaque tuile de l'île (le jeu ne garde que les tuiles où elle est possible).
  function carteHabitat(etat, dataBrute, id) {
    const data = preparer(dataBrute), l = [];
    for (const i of tuilesIle(etat)) { const r = qualitePose(etat, data, id, i); if (r) l.push([i, r.q]); }
    return l;
  }
  // Ce qui limite une espèce (piste 5) : effectif, capacité, et la raison du plafond.
  function limite(etat, dataBrute, id) {
    const data = preparer(dataBrute), f = data.especes[id];
    if (!f || f.mode === 'tuile') return null;
    const n = Math.round(effectif(etat, data, id)), cap = Math.round(capacite(etat, data, id));
    let raison = f.capacite.par === 'tuiles' ? 'couvert_' + f.capacite.couvert : f.capacite.par === 'amenagement' ? 'amenagement_' + f.capacite.id : 'espece_' + f.capacite.id;
    if (id === 'lapin') raison = problemes(etat, data).some(p => p.id === 'surpaturage') ? 'herbe_usee' : 'abris';
    if (id === 'alouette') raison = Math.floor(plusGrandePrairie(etat) / P.vie.alouetteParTuiles) < Math.floor(presence(etat, data, 'sauterelle') / f.capacite.nombre) ? 'prairie' : 'espece_sauterelle';
    if (id === 'merle') raison = 'ronce_nichoir';
    if (f.capacite.max && cap >= f.capacite.max) raison = 'max';
    return { n, cap, raison };
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
    meteo, chancesRares, raresPresents, horsLigne, doublerRetour, productionSeve, completer,
    reserveMax, rendement, secondesHorsLigne, ajouterProduction, teaser, TEASER,
    tirerPapier: (etat, dataBrute, id) => tirerPapier(etat, preparer(dataBrute), id), // pour les tests
    // Sprint 7
    problemes, problemesActifs, qualitePose, carteHabitat, limite, placesLapins, placesHibernation, plusGrandePrairie, DEMANDES,
  };
});
