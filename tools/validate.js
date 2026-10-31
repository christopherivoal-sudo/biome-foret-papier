#!/usr/bin/env node
// Biome, la forêt de papier : vérification des données (GDD v2, section 8.8).
// Usage :
//   node tools/validate.js                       vérifie data/
//   node tools/validate.js --especes chatgpt/especes-prairie-lisiere.json --fr chatgpt/textes-fr.json [--en chatgpt/textes-en.json]
//     [--garde-en chatgpt/garde-en.json] [--interface-en chatgpt/interface-en.json]
// Sortie : une ligne par problème, en français. Code de sortie 1 s'il y a au moins une erreur bloquante.
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');

// ---------- Valeurs autorisées (GDD 8.2 et 8.3) ----------
const ETAPES = ['prairie', 'lisiere', 'jeune_foret', 'foret_ancienne', 'zone_humide'];
const CATEGORIES = ['plante', 'animal', 'champignon', 'insecte'];
const MODES = ['tuile', 'population', 'agent'];
const VENUES = ['semee', 'spontanee'];
const ROLES = ['producteur', 'herbivore', 'insectivore', 'omnivore', 'predateur', 'decomposeur', 'pollinisateur', 'disperseur', 'ingenieur', 'abri'];
const ACTIVITES = ['jour', 'nuit', 'crepuscule', 'toujours'];
const SAISONS = ['printemps', 'ete', 'automne', 'hiver'];
const HIVERS = ['actif', 'hiberne', 'migre', 'dormant'];
const MOMENTS = ['jour', 'nuit', 'crepuscule'];
const PAPIERS = ['journal', 'washi', 'calque', 'dore'];
const COUVERTS = ['nu', 'herbe', 'fleurs', 'ronce', 'arbre', 'eau', 'roche', 'bois_mort', 'amenagement', 'ouvert', 'vegetal', 'cendres'];
const STATS = ['fertilite', 'humidite', 'ombre'];
const INTERACTIONS = ['mange', 'pollinise', 'disperse', 'abrite', 'fertilise', 'evite', 'transforme'];
const CAPACITE_PAR = ['tuiles', 'amenagement', 'espece'];
const AMENAGEMENTS_DEFAUT = ['tas_pierres', 'mare', 'hotel_insectes', 'paillis', 'tas_bois', 'nichoir'];
const VARIABLES = ['manque', 'nombre', 'joueur'];

// Exceptions validées par Christophe (voir chatgpt/especes-prairie-lisiere-notes.md).
const MAX_BESOINS = 3;
const EXCEPTIONS_BESOINS = { tircis: 4 };

// Longueurs maximales des textes (GDD 8.7).
const LONG = { description: 140, anecdote: 160, indice: 90, message: 80, titre_passage: 50, texte_passage: 140 };

// ---------- Rapport ----------
const problemes = [];
const erreur = (lieu, msg) => problemes.push({ niv: 'ERREUR', lieu, msg });
const avert = (lieu, msg) => problemes.push({ niv: 'avertissement', lieu, msg });

// ---------- Lecture ----------
function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  return o;
}
function lireJSON(fichier, obligatoire = true) {
  if (!fs.existsSync(fichier)) { if (obligatoire) erreur(rel(fichier), 'fichier introuvable'); return undefined; }
  try { return JSON.parse(fs.readFileSync(fichier, 'utf8')); }
  catch (e) { erreur(rel(fichier), 'JSON invalide : ' + e.message); return undefined; }
}
const rel = f => path.relative(RACINE, path.resolve(f)) || f;

function chargerEspeces(source) {
  const p = path.resolve(RACINE, source);
  if (!fs.existsSync(p)) { erreur(source, 'introuvable'); return []; }
  if (fs.statSync(p).isDirectory()) {
    return fs.readdirSync(p).filter(f => f.endsWith('.json')).sort().map(f => {
      const e = lireJSON(path.join(p, f));
      if (e && e.id && e.id + '.json' !== f) erreur(rel(path.join(p, f)), `le nom du fichier doit être ${e.id}.json`);
      return e;
    }).filter(Boolean);
  }
  const t = lireJSON(p);
  if (t === undefined) return [];
  if (!Array.isArray(t)) { erreur(source, 'doit être un tableau de fiches'); return []; }
  return t;
}

// ---------- Outils de contrôle ----------
const estObjet = v => v && typeof v === 'object' && !Array.isArray(v);
const estNombre = v => typeof v === 'number' && Number.isFinite(v);
const ID_RE = /^[a-z][a-z0-9_]*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const longueur = s => [...s].length;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function chercherNull(v, lieu, chemin = '') {
  if (v === null) { erreur(lieu, `valeur null interdite (${chemin || 'racine'}) : omettre le champ`); return; }
  if (Array.isArray(v)) v.forEach((x, i) => chercherNull(x, lieu, `${chemin}[${i}]`));
  else if (estObjet(v)) for (const k of Object.keys(v)) chercherNull(v[k], lieu, chemin ? `${chemin}.${k}` : k);
}
function enumVal(v, liste, lieu, champ) {
  if (!liste.includes(v)) erreur(lieu, `${champ} = ${JSON.stringify(v)} inconnu (attendu : ${liste.join(', ')})`);
}
function borne(v, min, max, lieu, champ) {
  if (!estNombre(v)) { erreur(lieu, `${champ} doit être un nombre`); return; }
  if (v < min || v > max) erreur(lieu, `${champ} = ${v} hors bornes [${min}, ${max}]`);
}
function positif(v, lieu, champ, entier = false) {
  if (!estNombre(v) || v < 0) erreur(lieu, `${champ} doit être un nombre ≥ 0`);
  else if (entier && !Number.isInteger(v)) erreur(lieu, `${champ} doit être un entier`);
}

// ---------- Conditions (GDD 8.2) ----------
const CHAMPS_COND = {
  couvert: ['couvert', 'min', 'portee'],
  couvert_nb: ['couvert', 'min', 'portee'],
  stat: ['stat', 'op', 'valeur', 'portee'],
  amenagement: ['id', 'min', 'portee'],
  espece: ['id', 'min', 'portee'],
  arbre_adulte: ['id', 'min'],
  saison: ['dans'],
  moment: ['dans'],
  etape: ['min'],
  rayon_ile: ['min'],
  harmonie: ['min'],
  nb_especes: ['min'],
};
const FACULTATIFS_COND = { rayon: 1, age_min_jours: 1, duree_jours: 1, etapes: 1 };

function verifierCondition(c, lieu, ctx) {
  if (!estObjet(c)) { erreur(lieu, 'condition : objet attendu'); return; }
  const champs = CHAMPS_COND[c.type];
  if (!champs) { erreur(lieu, `type de condition inconnu : ${JSON.stringify(c.type)}`); return; }
  for (const ch of champs) if (!(ch in c)) erreur(lieu, `condition ${c.type} : champ « ${ch} » manquant`);
  for (const k of Object.keys(c)) if (k !== 'type' && !champs.includes(k) && !FACULTATIFS_COND[k]) erreur(lieu, `condition ${c.type} : champ « ${k} » inconnu`);
  if ('portee' in c) {
    enumVal(c.portee, ['ile', 'zone'], lieu, 'portee');
    if (c.portee === 'zone') { if (!('rayon' in c)) erreur(lieu, `condition ${c.type} : « rayon » obligatoire en portée zone`); else positif(c.rayon, lieu, 'rayon'); }
    if (c.portee === 'ile' && 'rayon' in c) avert(lieu, `condition ${c.type} : « rayon » ignoré en portée île`);
  }
  switch (c.type) {
    case 'couvert': enumVal(c.couvert, COUVERTS, lieu, 'couvert'); borne(c.min, 0, 1, lieu, 'couvert.min (fraction)'); break;
    case 'couvert_nb': enumVal(c.couvert, COUVERTS, lieu, 'couvert'); positif(c.min, lieu, 'couvert_nb.min', true); break;
    case 'stat': enumVal(c.stat, STATS, lieu, 'stat'); enumVal(c.op, ['>=', '<='], lieu, 'op'); borne(c.valeur, 0, 100, lieu, 'stat.valeur'); break;
    case 'amenagement': enumVal(c.id, ctx.amenagements, lieu, 'aménagement'); positif(c.min, lieu, 'amenagement.min', true); break;
    case 'espece':
      positif(c.min, lieu, 'espece.min', true);
      if (!ctx.ids.has(c.id)) erreur(lieu, `espèce « ${c.id} » inexistante`);
      else ctx.dependances.push([ctx.idCourant, c.id, lieu]);
      break;
    case 'arbre_adulte':
      positif(c.min, lieu, 'arbre_adulte.min', true);
      if (!ctx.ids.has(c.id)) erreur(lieu, `arbre « ${c.id} » inexistant`);
      if ('age_min_jours' in c) positif(c.age_min_jours, lieu, 'age_min_jours');
      break;
    case 'saison':
      if (!Array.isArray(c.dans) || !c.dans.length) erreur(lieu, 'saison.dans : liste non vide attendue');
      else c.dans.forEach(s => enumVal(s, SAISONS, lieu, 'saison'));
      break;
    case 'moment':
      if (!Array.isArray(c.dans) || !c.dans.length) erreur(lieu, 'moment.dans : liste non vide attendue');
      else c.dans.forEach(s => enumVal(s, MOMENTS, lieu, 'moment'));
      break;
    case 'etape': enumVal(c.min, ETAPES, lieu, 'etape.min'); break;
    case 'rayon_ile': positif(c.min, lieu, 'rayon_ile.min', true); break;
    case 'harmonie': borne(c.min, 0, 1, lieu, 'harmonie.min'); if ('duree_jours' in c) positif(c.duree_jours, lieu, 'duree_jours'); break;
    case 'nb_especes':
      positif(c.min, lieu, 'nb_especes.min', true);
      if ('etapes' in c) (Array.isArray(c.etapes) ? c.etapes : [c.etapes]).forEach(e => enumVal(e, ETAPES, lieu, 'nb_especes.etapes'));
      break;
  }
}

// ---------- Fiche espèce (GDD 8.3) ----------
const OBLIGATOIRES = ['id', 'etape', 'categorie', 'mode', 'venue', 'roles', 'activite', 'saisons_actives', 'hiver', 'besoins', 'capacite', 'reproduction', 'interactions', 'production', 'depart_apres_jours', 'modele', 'palette', 'papiers_rares'];
const FACULTATIFS = ['croissance'];

function verifierEspece(e, ctx) {
  const lieu = `espèce ${e && e.id ? e.id : '?'}`;
  if (!estObjet(e)) { erreur('espèces', 'chaque fiche doit être un objet'); return; }
  chercherNull(e, lieu);
  for (const ch of OBLIGATOIRES) if (!(ch in e)) erreur(lieu, `champ obligatoire « ${ch} » manquant`);
  for (const k of Object.keys(e)) if (!OBLIGATOIRES.includes(k) && !FACULTATIFS.includes(k)) erreur(lieu, `champ inconnu « ${k} »`);
  ctx.idCourant = e.id;

  if (typeof e.id !== 'string' || !ID_RE.test(e.id)) erreur(lieu, 'id : minuscules ASCII, chiffres et _ seulement');
  enumVal(e.etape, ETAPES, lieu, 'etape');
  enumVal(e.categorie, CATEGORIES, lieu, 'categorie');
  enumVal(e.mode, MODES, lieu, 'mode');
  enumVal(e.venue, VENUES, lieu, 'venue');
  if (!Array.isArray(e.roles) || !e.roles.length) erreur(lieu, 'roles : liste non vide attendue'); else e.roles.forEach(r => enumVal(r, ROLES, lieu, 'role'));
  enumVal(e.activite, ACTIVITES, lieu, 'activite');
  if (!Array.isArray(e.saisons_actives) || !e.saisons_actives.length) erreur(lieu, 'saisons_actives : liste non vide attendue'); else e.saisons_actives.forEach(s => enumVal(s, SAISONS, lieu, 'saison active'));
  enumVal(e.hiver, HIVERS, lieu, 'hiver');
  if (e.hiver === 'actif' && Array.isArray(e.saisons_actives) && !e.saisons_actives.includes('hiver')) avert(lieu, 'hiver = actif mais « hiver » absent de saisons_actives');
  if (e.hiver !== 'actif' && Array.isArray(e.saisons_actives) && e.saisons_actives.includes('hiver')) avert(lieu, `hiver = ${e.hiver} mais « hiver » présent dans saisons_actives`);

  // Cohérences de catégorie
  if (e.categorie === 'plante' && e.mode !== 'tuile') erreur(lieu, 'une plante doit être en mode tuile');
  if (e.categorie === 'animal' && e.mode !== 'agent') avert(lieu, 'un animal est normalement en mode agent');
  if (e.categorie === 'insecte' && e.mode !== 'population') avert(lieu, 'un insecte est normalement en mode population');
  if (e.venue === 'semee' && e.categorie !== 'plante') erreur(lieu, 'seules les plantes peuvent être semées (on n\'achète jamais d\'animal)');

  // Besoins
  if (!Array.isArray(e.besoins) || !e.besoins.length) erreur(lieu, 'besoins : liste non vide attendue');
  else {
    const max = EXCEPTIONS_BESOINS[e.id] || MAX_BESOINS;
    if (e.besoins.length > max) erreur(lieu, `${e.besoins.length} besoins (maximum ${max})`);
    e.besoins.forEach((c, i) => verifierCondition(c, `${lieu}, besoin ${i + 1}`, ctx));
  }

  // Capacité
  const cap = e.capacite;
  if (estObjet(cap)) {
    enumVal(cap.par, CAPACITE_PAR, lieu, 'capacite.par');
    positif(cap.nombre, lieu, 'capacite.nombre');
    if (cap.nombre === 0) erreur(lieu, 'capacite.nombre ne peut pas valoir 0');
    if ('max' in cap) positif(cap.max, lieu, 'capacite.max', true);
    if (cap.par === 'tuiles') { if (!cap.couvert) erreur(lieu, 'capacite par tuiles : « couvert » manquant'); else enumVal(cap.couvert, COUVERTS, lieu, 'capacite.couvert'); }
    if (cap.par === 'amenagement') enumVal(cap.id, ctx.amenagements, lieu, 'capacite.id (aménagement)');
    if (cap.par === 'espece' && !ctx.ids.has(cap.id)) erreur(lieu, `capacite.id : espèce « ${cap.id} » inexistante`);
    if (e.mode === 'agent' && !('max' in cap)) avert(lieu, 'agent sans capacite.max (limite de 30 agents par île)');
  } else if ('capacite' in e) erreur(lieu, 'capacite : objet attendu');

  // Reproduction
  const rep = e.reproduction;
  if (estObjet(rep)) {
    if (!Array.isArray(rep.saisons)) erreur(lieu, 'reproduction.saisons : liste attendue'); else rep.saisons.forEach(s => enumVal(s, SAISONS, lieu, 'reproduction.saison'));
    positif(rep.portee_moyenne, lieu, 'reproduction.portee_moyenne');
    positif(rep.intervalle_jours, lieu, 'reproduction.intervalle_jours');
  } else if ('reproduction' in e) erreur(lieu, 'reproduction : objet attendu');

  // Interactions
  if (Array.isArray(e.interactions)) e.interactions.forEach((it, i) => {
    const l = `${lieu}, interaction ${i + 1}`;
    if (!estObjet(it)) { erreur(l, 'objet attendu'); return; }
    enumVal(it.type, INTERACTIONS, l, 'type');
    if (!ctx.ids.has(it.cible)) erreur(l, `cible « ${it.cible} » inexistante`);
    if (it.cible === e.id && it.type !== 'fertilise') erreur(l, 'une espèce ne peut pas interagir avec elle-même');
    if ('intensite' in it) borne(it.intensite, 0, 1, l, 'intensite');
    if (it.type === 'disperse') { if (!it.plante) erreur(l, 'disperse : champ « plante » manquant'); else if (!ctx.ids.has(it.plante)) erreur(l, `plante « ${it.plante} » inexistante`); }
    if (it.type === 'transforme' && !it.effet) erreur(l, 'transforme : champ « effet » manquant');
    for (const k of Object.keys(it)) if (!['type', 'cible', 'intensite', 'plante', 'effet'].includes(k)) erreur(l, `champ inconnu « ${k} »`);
  }); else if ('interactions' in e) erreur(lieu, 'interactions : liste attendue');

  // Production
  if (estObjet(e.production)) { positif(e.production.seve_par_s, lieu, 'production.seve_par_s'); positif(e.production.pages_photo, lieu, 'production.pages_photo', true); }
  positif(e.depart_apres_jours, lieu, 'depart_apres_jours');

  // Croissance (plantes)
  if (e.categorie === 'plante') {
    const c = e.croissance;
    if (!estObjet(c)) erreur(lieu, 'plante : champ « croissance » obligatoire');
    else {
      for (const k of ['jours_adulte', 'extension_par_jour', 'ombre_projetee', 'rayon_ombre', 'cout_seve', 'cout_graines']) if (!(k in c)) erreur(lieu, `croissance.${k} manquant`);
      positif(c.jours_adulte, lieu, 'croissance.jours_adulte');
      borne(c.extension_par_jour, 0, 1, lieu, 'croissance.extension_par_jour');
      borne(c.ombre_projetee, 0, 100, lieu, 'croissance.ombre_projetee');
      positif(c.rayon_ombre, lieu, 'croissance.rayon_ombre');
      positif(c.cout_seve, lieu, 'croissance.cout_seve', true);
      positif(c.cout_graines, lieu, 'croissance.cout_graines', true);
    }
  } else if ('croissance' in e) erreur(lieu, '« croissance » réservé aux plantes');

  if (e.modele !== e.id) avert(lieu, `modele (${e.modele}) différent de l'id`);
  if (!Array.isArray(e.palette) || e.palette.length !== 3 || !e.palette.every(c => HEX_RE.test(c))) erreur(lieu, 'palette : 3 couleurs hexadécimales #rrggbb attendues');
  if (!Array.isArray(e.papiers_rares)) erreur(lieu, 'papiers_rares : liste attendue'); else e.papiers_rares.forEach(p => enumVal(p, PAPIERS, lieu, 'papier'));
}

function verifierDependances(especes, ctx) {
  const parId = Object.fromEntries(especes.map(e => [e.id, e]));
  for (const [de, vers, lieu] of ctx.dependances) {
    if (de === vers) { erreur(lieu, 'une espèce ne peut pas avoir besoin d\'elle-même'); continue; }
    const a = parId[de], b = parId[vers];
    if (a && b && ETAPES.indexOf(b.etape) > ETAPES.indexOf(a.etape)) erreur(lieu, `dépend de « ${vers} », débloquée à une étape plus tardive (${b.etape})`);
  }
  // Cycles de dépendance
  const graphe = {};
  for (const [de, vers] of ctx.dependances) (graphe[de] = graphe[de] || []).push(vers);
  const etat = {};
  const visiter = (n, pile) => {
    if (etat[n] === 2) return;
    if (etat[n] === 1) { erreur(`espèce ${n}`, `cycle de dépendance impossible : ${[...pile, n].join(' → ')}`); return; }
    etat[n] = 1; (graphe[n] || []).forEach(m => visiter(m, [...pile, n])); etat[n] = 2;
  };
  Object.keys(graphe).forEach(n => visiter(n, []));
}

// ---------- Textes (GDD 8.7) ----------
function variablesDe(s) { return (s.match(/\{[^}]*\}/g) || []).map(v => v.slice(1, -1)).sort(); }

function verifierChaine(s, max, lieu, champ) {
  if (typeof s !== 'string' || !s.trim()) { erreur(lieu, `${champ} : texte non vide attendu`); return; }
  if (max && longueur(s) > max) erreur(lieu, `${champ} : ${longueur(s)} caractères (maximum ${max})`);
  if (EMOJI_RE.test(s)) erreur(lieu, `${champ} : emoji interdit`);
  for (const v of variablesDe(s)) if (!VARIABLES.includes(v)) erreur(lieu, `${champ} : variable {${v}} non autorisée`);
  if (/\s{2,}/.test(s) || s !== s.trim()) avert(lieu, `${champ} : espaces en trop`);
}

function comportementsAttendus(e) {
  const att = ['arrivee'];
  const types = (e.interactions || []).map(i => i.type);
  if (types.includes('mange')) att.push('repas');
  if (types.includes('pollinise')) att.push('pollinisation');
  if (types.includes('disperse')) att.push('dispersion');
  if (e.hiver === 'hiberne' || e.hiver === 'migre') att.push('hiver');
  if (e.categorie === 'plante') att.push('pousse', 'adulte');
  if (e.categorie === 'champignon') att.push('fructification');
  return att;
}

function verifierTextes(t, nomFichier, especes, ctx) {
  if (!estObjet(t)) { erreur(nomFichier, 'objet JSON attendu'); return; }
  chercherNull(t, nomFichier);
  for (const k of ['especes', 'evenements', 'etapes']) if (!estObjet(t[k])) erreur(nomFichier, `rubrique « ${k} » manquante`);
  const parId = Object.fromEntries(especes.map(e => [e.id, e]));

  for (const id of Object.keys(t.especes || {})) if (!parId[id]) erreur(`${nomFichier}, ${id}`, 'texte pour une espèce sans fiche');
  for (const e of especes) {
    const lieu = `${nomFichier}, espèce ${e.id}`;
    const x = (t.especes || {})[e.id];
    if (!estObjet(x)) { erreur(lieu, 'textes manquants'); continue; }
    verifierChaine(x.nom, 40, lieu, 'nom');
    verifierChaine(x.nom_latin, 60, lieu, 'nom_latin');
    verifierChaine(x.description, LONG.description, lieu, 'description');
    verifierChaine(x.anecdote, LONG.anecdote, lieu, 'anecdote');
    if (!Array.isArray(x.indices)) erreur(lieu, 'indices : liste attendue');
    else {
      if (Array.isArray(e.besoins) && x.indices.length !== e.besoins.length) erreur(lieu, `${x.indices.length} indices pour ${e.besoins.length} besoins (il en faut autant, dans le même ordre)`);
      x.indices.forEach((s, i) => verifierChaine(s, LONG.indice, lieu, `indice ${i + 1}`));
    }
    if (!estObjet(x.comportements)) erreur(lieu, 'comportements : objet attendu');
    else {
      for (const k of comportementsAttendus(e)) if (!(k in x.comportements)) erreur(lieu, `comportement « ${k} » manquant`);
      for (const [k, s] of Object.entries(x.comportements)) verifierChaine(s, LONG.message, lieu, `comportement ${k}`);
    }
    verifierChaine(x.depart, LONG.message, lieu, 'depart');
    if (typeof x.depart === 'string' && !x.depart.includes('{manque}')) erreur(lieu, 'depart doit contenir {manque}');
    for (const k of Object.keys(x)) if (!['nom', 'nom_latin', 'description', 'anecdote', 'indices', 'comportements', 'depart'].includes(k)) avert(lieu, `champ inattendu « ${k} »`);
  }
  for (const [id, x] of Object.entries(t.evenements || {})) {
    const lieu = `${nomFichier}, événement ${id}`;
    if (ctx.evenements && !ctx.evenements.includes(id)) erreur(lieu, 'événement inconnu');
    verifierChaine(x.nom, 40, lieu, 'nom'); verifierChaine(x.annonce, LONG.message, lieu, 'annonce'); verifierChaine(x.fin, LONG.message, lieu, 'fin');
  }
  if (ctx.evenements) for (const id of ctx.evenements) if (!(t.evenements || {})[id]) erreur(`${nomFichier}`, `textes de l'événement « ${id} » manquants`);
  for (const [id, x] of Object.entries(t.etapes || {})) {
    const lieu = `${nomFichier}, étape ${id}`;
    enumVal(id, ETAPES, lieu, 'étape');
    verifierChaine(x.nom, 40, lieu, 'nom'); verifierChaine(x.titre_passage, LONG.titre_passage, lieu, 'titre_passage'); verifierChaine(x.texte_passage, LONG.texte_passage, lieu, 'texte_passage');
  }
  const etapesUtilisees = [...new Set(especes.map(e => e.etape))];
  for (const id of etapesUtilisees) if (!(t.etapes || {})[id]) erreur(nomFichier, `textes de l'étape « ${id} » manquants`);
}

// Comparaison FR / EN : mêmes clés, mêmes variables.
function comparerLangues(fr, en, chemin = '') {
  if (typeof fr === 'string') {
    if (typeof en !== 'string') { erreur('FR/EN', `${chemin} : texte attendu en anglais`); return; }
    if (variablesDe(fr).join() !== variablesDe(en).join()) erreur('FR/EN', `${chemin} : variables différentes (${variablesDe(fr)} / ${variablesDe(en)})`);
    if (chemin.endsWith('nom_latin') && fr !== en) erreur('FR/EN', `${chemin} : le nom latin ne se traduit pas`);
    return;
  }
  if (Array.isArray(fr)) {
    if (!Array.isArray(en) || en.length !== fr.length) { erreur('FR/EN', `${chemin} : même nombre d'éléments attendu`); return; }
    fr.forEach((x, i) => comparerLangues(x, en[i], `${chemin}[${i}]`)); return;
  }
  if (estObjet(fr)) {
    if (!estObjet(en)) { erreur('FR/EN', `${chemin} : objet attendu`); return; }
    for (const k of Object.keys(fr)) if (!(k in en)) erreur('FR/EN', `${chemin}.${k} : clé absente en anglais`); else comparerLangues(fr[k], en[k], chemin ? `${chemin}.${k}` : k);
    for (const k of Object.keys(en)) if (!(k in fr)) erreur('FR/EN', `${chemin}.${k} : clé absente en français`);
  }
}

// ---------- Aménagements et étapes (facultatifs tant qu'ils n'existent pas) ----------
function verifierAmenagements(liste, ctx) {
  if (!Array.isArray(liste)) { erreur('amenagements.json', 'tableau attendu'); return []; }
  const vus = new Set();
  liste.forEach(a => {
    const lieu = `action ${a && a.id}`;
    if (!estObjet(a)) { erreur('amenagements.json', 'objet attendu'); return; }
    chercherNull(a, lieu);
    if (!ID_RE.test(a.id || '')) erreur(lieu, 'id invalide');
    if (vus.has(a.id)) erreur(lieu, 'id en double'); vus.add(a.id);
    enumVal(a.etape, ETAPES, lieu, 'etape');
    enumVal(a.type, ['semis', 'amenagement'], lieu, 'type');
    if (a.type === 'semis') {
      const e = ctx.parId[a.espece];
      if (!e) erreur(lieu, `espèce semée « ${a.espece} » inexistante`);
      else {
        if (e.venue !== 'semee') erreur(lieu, `« ${a.espece} » n'est pas une espèce semée`);
        if (e.etape !== a.etape) avert(lieu, `étape différente de celle de l'espèce (${e.etape})`);
      }
    } else if (a.type === 'amenagement') {
      positif(a.cout_seve, lieu, 'cout_seve', true);
      if (!Number.isInteger(a.taille) || a.taille < 1) erreur(lieu, 'taille : entier ≥ 1 attendu');
      enumVal(a.pose, ['tuile', 'surcouche', 'arbre_adulte'], lieu, 'pose');
      enumVal(a.couvert, COUVERTS, lieu, 'couvert');
      if (!estObjet(a.effets)) erreur(lieu, 'effets : objet attendu');
    }
  });
  return liste.map(a => a.id);
}
function verifierEtapes(liste, ctx) {
  if (!Array.isArray(liste)) { erreur('etapes.json', 'tableau attendu'); return; }
  liste.forEach(et => {
    const lieu = `étape ${et.id}`;
    chercherNull(et, lieu);
    enumVal(et.id, ETAPES, lieu, 'id');
    positif(et.rayon_ile, lieu, 'rayon_ile', true);
    (et.conditions_entree || []).forEach((c, i) => verifierCondition(c, `${lieu}, condition ${i + 1}`, ctx));
    const d = et.debloque || {};
    (d.especes || []).forEach(id => { if (!ctx.ids.has(id)) erreur(lieu, `débloque une espèce inexistante : ${id}`); });
    (d.amenagements || []).forEach(id => { if (!ctx.actions.includes(id)) erreur(lieu, `débloque une action inconnue : ${id}`); });
  });
  const debloquees = new Set(liste.flatMap(et => (et.debloque || {}).especes || []));
  for (const id of ctx.ids) if (!debloquees.has(id)) avert('etapes.json', `l'espèce « ${id} » n'est débloquée par aucune étape`);
}

// ---------- Missions de la garde forestière (consigne 04) ----------
const QUOI = ['photo', 'arrivee', 'semis', 'construction', 'recolte', 'evenement'];
const EVENEMENTS_PROTO = ['floraison', 'orage', 'secheresse'];
const CONDS_MISSION = ['couvert', 'couvert_nb', 'stat', 'amenagement', 'espece', 'arbre_adulte', 'nb_especes', 'harmonie'];
function verifierMissions(liste, ctx) {
  if (!Array.isArray(liste)) { erreur('missions', 'tableau attendu'); return []; }
  const vus = new Set();
  liste.forEach(m => {
    const lieu = `mission ${m && m.id}`;
    if (!estObjet(m)) { erreur('missions', 'objet attendu'); return; }
    chercherNull(m, lieu);
    if (!ID_RE.test(m.id || '')) erreur(lieu, 'id invalide');
    if (vus.has(m.id)) erreur(lieu, 'id en double'); vus.add(m.id);
    enumVal(m.etape, ETAPES, lieu, 'etape');
    for (const k of Object.keys(m)) if (!['id', 'etape', 'objectif', 'recompense'].includes(k)) erreur(lieu, `champ inconnu « ${k} »`);
    const r = m.recompense;
    if (!estObjet(r)) erreur(lieu, 'recompense : objet attendu');
    else { borne(r.seve, 20, 150, lieu, 'recompense.seve'); borne(r.graines, 0, 5, lieu, 'recompense.graines'); borne(r.pages, 0, 2, lieu, 'recompense.pages'); }
    const o = m.objectif;
    if (!estObjet(o)) { erreur(lieu, 'objectif : objet attendu'); return; }
    const rangMission = ETAPES.indexOf(m.etape);
    const tropTard = (etapeId, quoi) => { if (ETAPES.indexOf(etapeId) > rangMission) erreur(lieu, `${quoi} n'est disponible qu'à l'étape ${etapeId}`); };
    if (o.type === 'etat') {
      if (!Array.isArray(o.conditions) || !o.conditions.length) erreur(lieu, 'objectif état : conditions manquantes');
      else o.conditions.forEach((c, i) => {
        if (!CONDS_MISSION.includes(c.type)) erreur(lieu, `condition ${c.type} non autorisée dans une mission`);
        if (c.portee === 'zone') erreur(lieu, 'portée zone interdite dans une mission');
        verifierCondition(c, `${lieu}, condition ${i + 1}`, Object.assign({}, ctx, { dependances: [] }));
        if ((c.type === 'espece' || c.type === 'arbre_adulte') && ctx.parId[c.id]) tropTard(ctx.parId[c.id].etape, c.id);
      });
    } else if (o.type === 'compteur') {
      enumVal(o.quoi, QUOI, lieu, 'quoi');
      positif(o.nombre, lieu, 'nombre', true);
      if (o.nombre < 1) erreur(lieu, 'nombre ≥ 1 attendu');
      if ('moment' in o) (Array.isArray(o.moment) ? o.moment : [o.moment]).forEach(x => enumVal(x, MOMENTS, lieu, 'moment'));
      if ('nouvelle' in o && o.nouvelle !== true) erreur(lieu, 'nouvelle : seulement true (ou champ omis)');
      for (const k of Object.keys(o)) if (!['type', 'quoi', 'id', 'nombre', 'moment', 'nouvelle'].includes(k)) erreur(lieu, `objectif : champ inconnu « ${k} »`);
      if ('id' in o) {
        if (['photo', 'arrivee', 'semis'].includes(o.quoi)) {
          const e = ctx.parId[o.id];
          if (!e) erreur(lieu, `espèce « ${o.id} » inexistante`);
          else { tropTard(e.etape, o.id); if (o.quoi === 'semis' && e.venue !== 'semee') erreur(lieu, `« ${o.id} » ne se sème pas`); }
        } else if (o.quoi === 'construction') {
          if (!ctx.amenagements.includes(o.id)) erreur(lieu, `aménagement « ${o.id} » inconnu`);
          else if (ctx.actionsData[o.id]) tropTard(ctx.actionsData[o.id].etape, o.id);
        } else if (o.quoi === 'evenement') enumVal(o.id, ctx.evenements || EVENEMENTS_PROTO, lieu, 'événement');
        else erreur(lieu, `« id » sans objet pour ${o.quoi}`);
      } else if (o.quoi === 'construction' || o.quoi === 'evenement') erreur(lieu, `« id » obligatoire pour ${o.quoi}`);
    } else erreur(lieu, `objectif : type ${JSON.stringify(o.type)} inconnu (etat ou compteur)`);
  });
  return [...vus];
}

// ---------- Événements et papiers rares (sprint 3, GDD 8.5 et 8.6) ----------
const EFFETS = {
  stat_tuile: ['stat', 'delta'],
  stat_tuile_par_s: ['stat', 'delta'],
  multiplicateur_croissance: ['cible', 'facteur'],
  multiplicateur_arrivee: ['facteur'],
  multiplicateur_graines: ['cible', 'facteur'],
  abattre_arbre: ['nombre', 'chance'],
  abri_animaux: [],
  visiteurs: ['especes'],
  zone_feu: [],
};
const FACULTATIFS_EFFET = { portee: 1, cible: 1, plancher: 1, cumul_max: 1 };
const STATUTS = ['proto', 'plus_tard'];
function verifierRares(liste) {
  if (!Array.isArray(liste)) { erreur('rares.json', 'tableau attendu'); return []; }
  liste.forEach(r => {
    const lieu = `papier ${r && r.id}`;
    if (!estObjet(r)) { erreur('rares.json', 'objet attendu'); return; }
    chercherNull(r, lieu);
    enumVal(r.id, PAPIERS, lieu, 'id');
    borne(r.chance_base, 0, 0.05, lieu, 'chance_base');
    positif(r.garantie_apres, lieu, 'garantie_apres', true);
    enumVal(r.statut, STATUTS, lieu, 'statut');
  });
  return liste.map(r => r.id);
}
function verifierEvenements(liste, ctx, papiers) {
  if (!Array.isArray(liste)) { erreur('evenements.json', 'tableau attendu'); return; }
  const vus = new Set();
  liste.forEach(ev => {
    const lieu = `événement ${ev && ev.id}`;
    if (!estObjet(ev)) { erreur('evenements.json', 'objet attendu'); return; }
    chercherNull(ev, lieu);
    if (!ID_RE.test(ev.id || '')) erreur(lieu, 'id invalide');
    if (vus.has(ev.id)) erreur(lieu, 'id en double'); vus.add(ev.id);
    for (const k of Object.keys(ev)) if (!['id', 'saisons', 'conditions', 'duree_jours', 'effets', 'papier', 'recompense', 'roblox', 'statut', 'repos_annees'].includes(k)) erreur(lieu, `champ inconnu « ${k} »`);
    if (!estObjet(ev.saisons) || !Object.keys(ev.saisons).length) erreur(lieu, 'saisons : objet { saison: chance } attendu');
    else for (const [s, p] of Object.entries(ev.saisons)) { enumVal(s, SAISONS, lieu, 'saison'); borne(p, 0, 1, lieu, `chance en ${s}`); }
    if (!Array.isArray(ev.conditions)) erreur(lieu, 'conditions : liste attendue');
    else ev.conditions.forEach((c, i) => verifierCondition(c, `${lieu}, condition ${i + 1}`, Object.assign({}, ctx, { dependances: [] })));
    borne(ev.duree_jours, 0.05, 3, lieu, 'duree_jours');
    if (estNombre(ev.duree_jours) && ev.duree_jours > 2.5) erreur(lieu, 'un événement doit tenir dans une saison (3 jours), marge comprise');
    if ('repos_annees' in ev) positif(ev.repos_annees, lieu, 'repos_annees', true);
    enumVal(ev.statut, STATUTS, lieu, 'statut');
    if (!Array.isArray(ev.effets) || !ev.effets.length) erreur(lieu, 'effets : liste non vide attendue');
    else ev.effets.forEach((ef, i) => {
      const l = `${lieu}, effet ${i + 1}`;
      const champs = EFFETS[ef && ef.type];
      if (!champs) { erreur(l, `type d'effet inconnu : ${JSON.stringify(ef && ef.type)}`); return; }
      for (const ch of champs) if (!(ch in ef)) erreur(l, `champ « ${ch} » manquant`);
      for (const k of Object.keys(ef)) if (k !== 'type' && !champs.includes(k) && !FACULTATIFS_EFFET[k]) erreur(l, `champ « ${k} » inconnu`);
      if ('stat' in ef) enumVal(ef.stat, STATS, l, 'stat');
      if ('delta' in ef) borne(ef.delta, -100, 100, l, 'delta');
      if ('facteur' in ef) borne(ef.facteur, 0, 10, l, 'facteur');
      if ('chance' in ef) borne(ef.chance, 0, 1, l, 'chance');
      if ('plancher' in ef) borne(ef.plancher, 0, 100, l, 'plancher');
      if ('cumul_max' in ef) borne(ef.cumul_max, 0, 100, l, 'cumul_max');
      if ('portee' in ef && ef.portee !== 'ile') erreur(l, 'portee : seulement « ile » pour un effet');
      if ('cible' in ef && !ctx.ids.has(ef.cible) && !ROLES.includes(ef.cible)) erreur(l, `cible « ${ef.cible} » : ni une espèce ni un rôle`);
      if (ef.type === 'zone_feu' && ev.statut === 'proto') erreur(l, 'le feu est prévu plus tard (GDD 5.2)');
    });
    if ('papier' in ev) {
      if (!estObjet(ev.papier)) erreur(lieu, 'papier : objet attendu');
      else { enumVal(ev.papier.id, papiers, lieu, 'papier.id'); borne(ev.papier.multiplicateur, 1, 10, lieu, 'papier.multiplicateur'); }
    }
    if ('recompense' in ev) {
      const r = ev.recompense;
      if (!estObjet(r)) erreur(lieu, 'recompense : objet attendu');
      else {
        if (!Array.isArray(r.condition)) erreur(lieu, 'recompense.condition : liste attendue');
        else r.condition.forEach((c, i) => verifierCondition(c, `${lieu}, récompense, condition ${i + 1}`, Object.assign({}, ctx, { dependances: [] })));
        positif(r.pages || 0, lieu, 'recompense.pages', true); positif(r.seve || 0, lieu, 'recompense.seve', true);
      }
    }
    if ('roblox' in ev && !estObjet(ev.roblox)) erreur(lieu, 'roblox : objet attendu');
  });
}

const TUTORIEL = ['accueil', 'carnet', 'sauterelles', 'semer_fleurs', 'besoin_partiel', 'hotel', 'alouette', 'abri_lapin', 'premiere_nuit', 'mare_paillis', 'harmonie', 'lisiere'];
const ALERTES = ['floraison', 'orage', 'secheresse', 'fin_evenement', 'nouvelle_mission', 'mission_reussie', 'depart_espece', 'nuit', 'hiver', 'retour_hors_ligne'];
function verifierGarde(t, nomFichier, especes, idsMissions) {
  const g = t.garde, m = t.missions;
  if (!estObjet(g)) { erreur(nomFichier, 'rubrique « garde » manquante'); return; }
  const lieu = `${nomFichier}, garde`;
  verifierChaine(g.nom, 30, lieu, 'nom');
  const bloc = (obj, cles, max, nom, exacte = true) => {
    if (!estObjet(obj)) { erreur(lieu, `${nom} : objet attendu`); return; }
    for (const k of cles) if (!(k in obj)) erreur(lieu, `${nom}.${k} manquant`);
    for (const [k, s] of Object.entries(obj)) { if (exacte && !cles.includes(k)) erreur(lieu, `${nom}.${k} : clé inattendue`); verifierChaine(s, max, lieu, `${nom}.${k}`); }
  };
  bloc(g.tutoriel, TUTORIEL, 90, 'tutoriel');
  bloc(g.reactions, especes.map(e => e.id), 80, 'reactions');
  bloc(g.alertes, ALERTES, 80, 'alertes');
  bloc(g.indices, ['blocage', 'pub_naturaliste'], 90, 'indices');
  if (estObjet(g.alertes)) {
    if (typeof g.alertes.depart_espece === 'string' && !g.alertes.depart_espece.includes('{manque}')) erreur(lieu, 'alertes.depart_espece doit contenir {manque}');
    if (typeof g.alertes.retour_hors_ligne === 'string' && !g.alertes.retour_hors_ligne.includes('{nombre}')) erreur(lieu, 'alertes.retour_hors_ligne doit contenir {nombre}');
  }
  if (!estObjet(m)) { erreur(nomFichier, 'rubrique « missions » manquante'); return; }
  for (const id of idsMissions) if (!estObjet(m[id])) erreur(`${nomFichier}, missions`, `textes de la mission « ${id} » manquants`);
  for (const [id, x] of Object.entries(m)) {
    const l = `${nomFichier}, mission ${id}`;
    if (!idsMissions.includes(id)) { erreur(l, 'mission sans mécanique dans missions.json'); continue; }
    verifierChaine(x.titre, 40, l, 'titre'); verifierChaine(x.texte, 90, l, 'texte'); verifierChaine(x.reussite, 80, l, 'reussite');
  }
}

// ---------- Programme principal ----------
function main() {
  const a = args();
  const sourceEspeces = a.especes || 'data/especes';
  const especes = chargerEspeces(sourceEspeces);
  const ids = new Set(especes.map(e => e && e.id).filter(Boolean));
  if (ids.size !== especes.length) erreur('espèces', 'identifiants en double');

  const parId = Object.fromEntries(especes.filter(e => e && e.id).map(e => [e.id, e]));
  const amenData = lireJSON(path.join(RACINE, 'data/amenagements.json'), false);
  const amenagements = amenData ? verifierAmenagements(amenData, { parId }) : AMENAGEMENTS_DEFAUT;
  const amenIds = amenData ? amenData.filter(x => x.type === 'amenagement').map(x => x.id) : AMENAGEMENTS_DEFAUT;
  const fichierMissions = a.missions || 'data/missions.json';
  const missionsData = lireJSON(path.resolve(RACINE, fichierMissions), !!a.missions);
  const evData = lireJSON(path.join(RACINE, 'data/evenements.json'), false);

  const ctx = { ids, parId, amenagements: amenIds, actions: amenagements, actionsData: Object.fromEntries((amenData || []).map(x => [x.id, x])), dependances: [], evenements: evData ? evData.map(e => e.id) : null };
  especes.forEach(e => verifierEspece(e, ctx));
  verifierDependances(especes, ctx);

  const etData = lireJSON(path.join(RACINE, 'data/etapes.json'), false);
  if (etData) verifierEtapes(etData, ctx);

  const rarData = lireJSON(path.join(RACINE, 'data/rares.json'), false);
  const papiers = rarData ? verifierRares(rarData) : PAPIERS;
  if (evData) verifierEvenements(evData, ctx, papiers);

  const idsMissions = missionsData ? verifierMissions(missionsData, ctx) : [];
  const fichierFR = a.fr || 'data/textes/fr.json';
  const fr = lireJSON(path.resolve(RACINE, fichierFR));
  if (fr) verifierTextes(fr, rel(fichierFR), especes, ctx);
  // Textes de la garde : dans fr.json (rubriques garde et missions), ou dans un fichier à part (--garde).
  const garde = a.garde ? lireJSON(path.resolve(RACINE, a.garde)) : (fr && (fr.garde || fr.missions) ? fr : null);
  if (garde) verifierGarde(garde, rel(a.garde || fichierFR), especes, idsMissions);
  else if (missionsData) erreur('missions', 'textes de la garde et des missions introuvables');
  const fichierEN = a.en || 'data/textes/en.json';
  const en = lireJSON(path.resolve(RACINE, fichierEN), !!a.en);
  // Garde et missions en anglais livrées à part (consigne 05) : on les range dans en pour la comparaison.
  if (en && a['garde-en']) { const g = lireJSON(path.resolve(RACINE, a['garde-en'])); if (g) { en.garde = g.garde; en.missions = g.missions; } }
  if (en) {
    verifierTextes(en, rel(fichierEN), especes, ctx);
    if (fr) {
      // La garde et les missions peuvent attendre leur traduction : simple avertissement.
      const frComp = Object.assign({}, fr);
      if (a.garde && garde) { frComp.garde = garde.garde; frComp.missions = garde.missions; } // garde française livrée à part
      for (const k of ['garde', 'missions']) if (k in fr && !(k in en)) { avert('FR/EN', `rubrique « ${k} » pas encore traduite`); delete frComp[k]; }
      comparerLangues(frComp, en);
      if (en.garde) verifierGarde(en, rel(fichierEN), especes, idsMissions);
    }
  }

  // Textes de l'interface (sprint 5) : écrits par Claude en français, traduits par ChatGPT (consigne 05).
  const ifr = lireJSON(path.join(RACINE, 'data/textes/interface-fr.json'), false);
  const fichierIEN = a['interface-en'] || 'data/textes/interface-en.json';
  const ien = lireJSON(path.resolve(RACINE, fichierIEN), !!a['interface-en']);
  if (ifr && !ien) avert('interface', 'textes de l\'interface pas encore traduits en anglais');
  if (ifr && ien) {
    comparerLangues(ifr, ien, 'interface');
    // Longueurs : l'anglais tient sur un téléphone (au plus 1,3 fois le français, avec un peu de marge pour les mots courts).
    (function longueurs(f, e, ch) {
      if (typeof f === 'string' && typeof e === 'string') {
        if (e.length > Math.max(f.length * 1.3, f.length + 10)) avert(rel(fichierIEN), `${ch} : texte anglais trop long (${e.length} caractères pour ${f.length} en français)`);
        if (!e.trim()) erreur(rel(fichierIEN), `${ch} : texte vide`);
        return;
      }
      if (f && typeof f === 'object' && e && typeof e === 'object') for (const k of Object.keys(f)) longueurs(f[k], e[k], ch + '.' + k);
    })(ifr, ien, 'interface');
  }

  // Rapport
  const nbErr = problemes.filter(p => p.niv === 'ERREUR').length;
  const nbAv = problemes.length - nbErr;
  for (const p of problemes) console.log(`${p.niv === 'ERREUR' ? '✗' : '!'} [${p.niv}] ${p.lieu} : ${p.msg}`);
  console.log(`\n${especes.length} fiches espèces vérifiées. ${nbErr} erreur(s), ${nbAv} avertissement(s).`);
  console.log(nbErr ? 'Résultat : À CORRIGER.' : 'Résultat : OK.');
  process.exit(nbErr ? 1 : 0);
}

if (require.main === module) main();
module.exports = { verifierCondition, CHAMPS_COND };
