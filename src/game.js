// Biome, la forêt de papier : interface du jeu (sprint 5). Remplace la vitrine du sprint 4.
// Lit et modifie l'état de core.js uniquement par son API (action, photographier, reclamerMission, passerEtape,
// horsLigne, doublerRetour). Ce qui ne concerne que l'interface est rangé dans etat.ui (sauvegardé avec l'île) :
// indices révélés, comportements observés, étapes du tutoriel, bonus publicitaires, fil du journal.
(function () {
  'use strict';
  const Core = window.BiomeCore, E = window.BiomeEngine, Modeles = window.BiomeModels, Ads = window.BiomeAds;
  const DATA = window.BIOME_DATA, data = Core.preparer(DATA);
  const N = Core.N;
  const CLE_SAUVEGARDE = 'biome-foret-papier-v2', CLE_LANGUE = 'biome-langue';
  const ETAPES_PROTO = data.etapes.map(e => e.id);
  const ORDRE_ESPECES = data.etapes.flatMap(e => e.debloque.especes).filter(id => data.especes[id]);
  const ACTIONS = ['semer_herbe', 'semer_fleurs', 'tas_pierres', 'mare', 'hotel_insectes', 'paillis', 'semer_ronce', 'planter_bouleau', 'tas_bois', 'nichoir'];
  const sessionDebut = Date.now();

  // =====================================================================
  // Textes : interface (data/textes/interface-*.json) et jeu (data/textes/*.json), anglais avec repli français
  // =====================================================================
  let langue = lireLangue();
  function lireLangue() {
    const q = new URLSearchParams(location.search).get('langue');
    if (q === 'fr' || q === 'en') return q;
    try { const l = localStorage.getItem(CLE_LANGUE); if (l === 'fr' || l === 'en') return l; } catch (e) { /* stockage indisponible */ }
    return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }
  const chemin = (o, c) => c.split('.').reduce((x, k) => (x && typeof x === 'object' ? x[k] : undefined), o);
  const remplir = (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)) : s;
  function T(cle, vars) {
    const I = DATA.interface || {};
    let s = chemin(I[langue], cle);
    if (typeof s !== 'string') s = chemin(I.fr, cle);
    return typeof s === 'string' ? remplir(s, vars) : cle;
  }
  function TX(cle, vars) {
    let s = chemin(DATA.textes[langue], cle);
    if (s === undefined) s = chemin(DATA.textes.fr, cle);
    return typeof s === 'string' ? remplir(s, vars) : s;
  }
  const nomEsp = id => TX('especes.' + id + '.nom') || id;
  const nomEtape = id => TX('etapes.' + id + '.nom') || id;
  const nomEv = id => TX('evenements.' + id + '.nom') || id;
  const nombre = n => Math.floor(n).toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-US');
  const echapper = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function duree(s) {
    const m = Math.round(s / 60);
    return m < 60 ? T('duree.minutes', { n: Math.max(1, m) }) : T('duree.heures', { h: Math.floor(m / 60), m: m % 60 });
  }

  // =====================================================================
  // DOM
  // =====================================================================
  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  // N'écrit dans la page que si le contenu a changé (le navigateur ne refait pas la mise en page pour rien).
  function html(e, h) { if (e._h !== h) { e._h = h; e.innerHTML = h; } }
  function texte(e, t) { if (e._t !== t) { e._t = t; e.textContent = t; } }
  const canvas = document.getElementById('scene');
  const racine = document.getElementById('jeu');
  const rendu = window.BiomeRendu.creer(canvas, DATA, Core);
  const cam = rendu.camera;

  // =====================================================================
  // Vignettes des modèles origami (carnet, barre d'actions, portrait d'Odile)
  // =====================================================================
  const GALERIE = Object.fromEntries(Modeles.galerie(rendu.modeles).map(g => [g.id, g]));
  const cvV = document.createElement('canvas'); cvV.width = cvV.height = 128;
  const RV = new E.Renderer(cvV), cacheV = {};
  // mode : '' (normal), 'silhouette', 'journal', 'washi'
  function vignette(id, mode) {
    const cle = id + ':' + (mode || '');
    if (cacheV[cle]) return cacheV[cle];
    const g = GALERIE[id];
    if (!g) return '';
    const mesh = g.variantes[0][1];
    let r = 0, y0 = 1e9, y1 = -1e9;
    for (const v of mesh.v) { r = Math.max(r, Math.hypot(v[0], v[2])); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    const taille = Math.max(2 * r, y1 - y0, 0.01);
    const ctx = RV.ctx, c = RV.cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 128, 128);
    c.yaw = 0.7; c.pitch = 0.42; c.tx = 0; c.tz = 0; c.ty = (y0 + y1) / 2; c.dist = taille * 1.9;
    c.update(128, 128);
    RV.teinte = null;
    RV.begin(); RV.add(mesh, 0, 0, 0, 0.4, 1, 1, mode === 'journal' || mode === 'washi' ? { papier: mode } : undefined); RV.flush();
    if (mode === 'silhouette') {
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#6e5d4a'; ctx.fillRect(0, 0, 128, 128);
      ctx.globalCompositeOperation = 'source-over';
    }
    return (cacheV[cle] = cvV.toDataURL());
  }
  const ICONES = {
    observer: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M14.5 14.5l6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    mare: '<svg viewBox="0 0 24 24"><path d="M3 14c2.5-5 15.5-5 18 0c-2.5 5-15.5 5-18 0z" fill="#68a0c4" stroke="#3f6f8f" stroke-width="1.2"/><path d="M8 13.5c1.5-1 3-1 4.5 0" stroke="#d8ecf5" stroke-width="1.2" fill="none"/></svg>',
    paillis: '<svg viewBox="0 0 24 24"><path d="M3 17h18" stroke="#8a6a48" stroke-width="3"/><path d="M5 15l4-3M9 16l5-4M13 15l4-4M16 16l4-2M7 13l3 1M12 12l3 2" stroke="#d9b867" stroke-width="1.6" stroke-linecap="round"/></svg>',
    retirer: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    agrandir: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#9cc27a" stroke="#5b7a3f" stroke-width="1.2"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.4"/></svg>',
    seve: '<svg viewBox="0 0 24 24"><path d="M12 3c3 5 6 8 6 11.5a6 6 0 0 1-12 0C6 11 9 8 12 3z" fill="#e0a43c" stroke="#9a6a1c" stroke-width="1.2"/></svg>',
    graines: '<svg viewBox="0 0 24 24"><ellipse cx="9" cy="13" rx="3.4" ry="5" transform="rotate(-25 9 13)" fill="#b88b53" stroke="#7a5630" stroke-width="1"/><ellipse cx="15.5" cy="11" rx="3" ry="4.4" transform="rotate(20 15.5 11)" fill="#cfa36a" stroke="#7a5630" stroke-width="1"/></svg>',
    pages: '<svg viewBox="0 0 24 24"><path d="M5 4h10l4 4v12H5z" fill="#fbf6ea" stroke="#8a7354" stroke-width="1.3"/><path d="M8 11h8M8 14h8M8 17h5" stroke="#b6a07e" stroke-width="1.2"/></svg>',
    carnet: '<svg viewBox="0 0 24 24"><path d="M5 3h12a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2z" fill="#7a9a58" stroke="#4f6a37" stroke-width="1.2"/><path d="M7 18h12" stroke="#f3ead7" stroke-width="1.4"/><path d="M10 8c2-2 4-2 5 0c-1 2-3 3-5 0z" fill="#f3ead7"/></svg>',
    bonus: '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 5.6 6 .6-4.6 4 1.4 5.9L12 16l-5.2 3.1 1.4-5.9-4.6-4 6-.6z" fill="#f1c75b" stroke="#a37a1d" stroke-width="1.1"/></svg>',
    reglages: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    soleil: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="#f1c75b"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#d9a23a" stroke-width="1.8" stroke-linecap="round"/></svg>',
    lune: '<svg viewBox="0 0 24 24"><path d="M15 3a8 8 0 1 0 6 12A7 7 0 0 1 15 3z" fill="#c9cfe6" stroke="#7f88ad" stroke-width="1.1"/></svg>',
    crepuscule: '<svg viewBox="0 0 24 24"><path d="M5 16a7 7 0 0 1 14 0z" fill="#efa45f"/><path d="M2 17h20" stroke="#a5653a" stroke-width="2"/></svg>',
    cadenas: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="#a8977c"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#a8977c" stroke-width="2.2"/></svg>',
    etoile: '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 5.6 6 .6-4.6 4 1.4 5.9L12 16l-5.2 3.1 1.4-5.9-4.6-4 6-.6z" fill="#f1c75b"/></svg>',
  };
  const ICONE_ACTION = { semer_herbe: 'herbe', semer_fleurs: 'fleurs', tas_pierres: 'tas_pierres', hotel_insectes: 'hotel_insectes', semer_ronce: 'ronce', planter_bouleau: 'bouleau', tas_bois: 'tas_bois', nichoir: 'nichoir' };
  function iconeAction(id) {
    if (ICONE_ACTION[id]) return `<img alt="" src="${vignette(ICONE_ACTION[id])}">`;
    return ICONES[id] || '';
  }

  // =====================================================================
  // État : création, sauvegarde, chargement
  // =====================================================================
  let etat = null, pause = false, rapportRetour = null;
  function uiDefaut() {
    return { indices: {}, comportements: {}, tuto: {}, nouvelleT: 0, fil: [], pubs: { jour: '', indices: 0, pluie: 0, seveDoubleFin: 0, prolonge: '', coupure: 0 } };
  }
  function nouvellePartie(graine) {
    etat = Core.creer(data, { graine: graine || ((Math.random() * 4294967296) >>> 0) });
    etat.ui = uiDefaut();
    marquerVu();
    reconnaitrePlantes(true);
    // L'herbe du départ est déjà là : ses comportements sont connus sans fêter quoi que ce soit.
    etat.ui.comportements.herbe = { arrivee: true, adulte: true };
  }
  function marquerVu() { for (const j of etat.journal) j.vu = 1; }
  function sauver() {
    if (!etat) return;
    etat.ui.sauveLe = Date.now();
    try { localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify({ v: 2, horodatage: Date.now(), etat })); } catch (e) { /* stockage plein ou interdit : on continue sans sauvegarde */ }
  }
  function charger() {
    try {
      const brut = localStorage.getItem(CLE_SAUVEGARDE);
      if (!brut) return false;
      const s = JSON.parse(brut);
      if (!s || s.v !== 2 || !s.etat || !s.etat.tuiles) return false;
      etat = Core.completer(s.etat);
      etat.ui = Object.assign(uiDefaut(), etat.ui || {});
      etat.ui.pubs = Object.assign(uiDefaut().pubs, etat.ui.pubs || {});
      marquerVu();
      const absence = (Date.now() - s.horodatage) / 1000;
      if (absence > 60) retourHorsLigne(absence);
      return true;
    } catch (e) { return false; }
  }

  // =====================================================================
  // Écologie lue pour l'interface : besoins, indices, comportements
  // =====================================================================
  const carnetDe = id => etat.carnet[id] || (etat.carnet[id] = { venu: false, photo: false, departs: 0, manque: -1 });
  const venu = id => !!(etat.carnet[id] && etat.carnet[id].venu);
  const debloquees = () => Core.especesDebloquees(etat, data).filter(id => data.especes[id]);
  // Les plantes semées ne passent pas par une « arrivée » : elles sont venues dès qu'elles poussent sur l'île.
  function reconnaitrePlantes(silence) {
    for (const id of ORDRE_ESPECES) {
      if (venu(id) || !Core.presence(etat, data, id)) continue;
      carnetDe(id).venu = true;
      etat.ui.nouvelleT = etat.temps;
      if (!silence) {
        observer(id, 'arrivee');
        ajouterFil(T('journal.premiere', { espece: nomEsp(id) }), true);
        const r = TX('garde.reactions.' + id);
        if (r) ajouterFil(r);
      }
    }
  }
  // Comportements des plantes et du champignon : « adulte » quand une tuile atteint l'âge adulte, « fructification » en automne.
  function observerPlantes() {
    const h = Core.horloge(etat);
    for (const i of Core.tuilesIle(etat)) {
      const t = etat.tuiles[i];
      const f = t.e && data.especes[t.e];
      if (f && f.croissance && t.age >= f.croissance.jours_adulte) observer(t.e, 'adulte');
      if (t.champi && h.saison === 'automne') observer(t.champi, 'fructification');
    }
  }
  // Évalue les besoins d'une espèce sur un échantillon de tuiles : on garde la tuile où le plus de besoins sont réunis.
  const cacheBesoins = {};
  function besoinsMeilleurs(id) {
    const c = cacheBesoins[id];
    if (c && c.t === etat.temps && c.n === etat.journal.length) return c.res;
    const l = Core.tuilesIle(etat), pas = Math.max(1, Math.ceil(l.length / 70));
    let best = null, bn = -1;
    for (let k = Math.floor(pas / 2); k < l.length; k += pas) {
      const i = l[k];
      const res = Core.besoinsEspece(etat, data, id, i % N, (i / N) | 0);
      const n = res.filter(r => r.ok).length;
      if (n > bn) { bn = n; best = res; if (n === res.length) break; }
    }
    cacheBesoins[id] = { t: etat.temps, n: etat.journal.length, res: best };
    return best;
  }
  function indicesDe(id) {
    const f = data.especes[id], u = etat.ui.indices;
    if (!u[id] || u[id].length !== f.besoins.length) u[id] = f.besoins.map(() => false);
    return u[id];
  }
  // Un besoin est révélé quand l'espèce est venue, quand il a été réuni une fois, ou par un indice.
  function majIndices() {
    for (const id of debloquees()) {
      const ind = indicesDe(id);
      if (venu(id)) { ind.fill(true); continue; }
      if (ind.every(Boolean)) continue;
      const res = besoinsMeilleurs(id);
      if (res) res.forEach((r, k) => { if (r.ok) ind[k] = true; });
    }
  }
  function revelerIndice(id) {
    const ind = indicesDe(id), k = ind.indexOf(false);
    if (k < 0) return -1;
    ind[k] = true;
    return k;
  }
  // Espèce débloquée, pas encore venue, dont le plus de besoins sont réunis (pour les indices de la garde).
  function especeLaPlusProche(avecCache) {
    let best = null, bs = -1;
    for (const id of debloquees()) {
      if (venu(id) || data.especes[id].venue !== 'spontanee') continue;
      if (avecCache && indicesDe(id).every(Boolean)) continue;
      const res = besoinsMeilleurs(id);
      const s = res ? res.filter(r => r.ok).length / res.length : 0;
      if (s > bs) { bs = s; best = id; }
    }
    return best;
  }
  // Comportements observés (GDD 1.6) : la première observation donne une page et peut révéler un indice
  // d'une espèce qui dépend de celle-ci (le hérisson a besoin de vers…).
  let dernierToastComportement = 0;
  function observer(id, cle) {
    const textes = TX('especes.' + id + '.comportements');
    if (!textes || !textes[cle]) return false;
    const c = etat.ui.comportements[id] || (etat.ui.comportements[id] = {});
    if (c[cle]) return false;
    c[cle] = true;
    if (cle === 'arrivee') return true;
    etat.pages += 1;
    // Plusieurs observations à la fois (au chargement d'une île) : une seule bulle, le reste va au journal.
    ajouterFil(T('reussites.comportement', { texte: textes[cle] }));
    for (const autre of debloquees()) {
      if (venu(autre)) continue;
      const f = data.especes[autre], ind = indicesDe(autre);
      const k = f.besoins.findIndex((b, j) => !ind[j] && (b.id === id || b.couvert === id));
      if (k >= 0) { ind[k] = true; break; }
    }
    return true;
  }

  // =====================================================================
  // Libellés des conditions (besoins, jauge de succession)
  // =====================================================================
  function pct(v) { return Math.round(v * 100); }
  function nomCouvert(c) { return data.especes[c] ? nomEsp(c).toLowerCase() : T('couverts.' + c); }
  function libelleCondition(c) {
    const z = c.portee === 'zone' ? '_zone' : '';
    switch (c.type) {
      case 'couvert': return T('conditions.couvert' + z, { couvert: nomCouvert(c.couvert), min: pct(c.min), rayon: c.rayon });
      case 'couvert_nb': return T('conditions.couvert_nb' + z, { couvert: nomCouvert(c.couvert), min: c.min, rayon: c.rayon });
      case 'stat': return T('conditions.stat_' + (c.op === '<=' ? 'max' : 'min') + z, { stat: T('stats.' + c.stat), valeur: c.valeur });
      case 'amenagement': return T('conditions.amenagement' + z, { amenagement: T('amenagements.' + c.id), min: c.min, rayon: c.rayon });
      case 'espece': return c.duree_jours ? T('conditions.espece_duree', { espece: nomEsp(c.id), jours: c.duree_jours }) : T('conditions.espece' + z, { espece: nomEsp(c.id), min: c.min, rayon: c.rayon });
      case 'arbre_adulte': return T('conditions.arbre_adulte', { espece: nomEsp(c.id).toLowerCase(), min: c.min });
      case 'nb_especes': return T('conditions.nb_especes', { min: c.min, etape: (c.etapes || []).map(nomEtape).join(', ') });
      case 'harmonie': return c.duree_jours ? T('conditions.harmonie_duree', { min: pct(c.min), jours: c.duree_jours }) : T('conditions.harmonie', { min: pct(c.min) });
      case 'rayon_ile': return T('conditions.rayon_ile', { min: c.min });
      case 'saison': return T('conditions.saison', { liste: c.dans.map(s => T('saisons.' + s)).join(', ') });
      case 'moment': return T('conditions.moment', { liste: c.dans.map(s => T('moments.' + s)).join(', ') });
      default: return c.type;
    }
  }
  function valeurCondition(c, r) {
    if (!r || typeof r.valeur !== 'number') return '';
    if (c.type !== 'harmonie' && r.duree_jours) return T('conditions.tenu', { tenu: (r.tenu_jours || 0).toFixed(1), duree: r.duree_jours });
    if (c.type === 'harmonie' && r.duree_jours) return T('conditions.valeur_pct', { valeur: pct(r.valeur) }) + ' · ' + T('conditions.tenu', { tenu: (r.tenu_jours || 0).toFixed(1), duree: r.duree_jours });
    if (c.type === 'couvert' || c.type === 'harmonie') return T('conditions.valeur_pct', { valeur: pct(r.valeur) });
    return T('conditions.valeur', { valeur: Math.round(r.valeur * 10) / 10 });
  }

  // =====================================================================
  // Boîtes de message : toasts, fil du journal, bulles d'Odile
  // =====================================================================
  const zoneToasts = el('div', 'toasts', racine);
  function toast(texte, o) {
    o = o || {};
    const t = el('div', 'toast' + (o.classe ? ' ' + o.classe : ''), zoneToasts);
    if (o.icone) el('img', '', t).src = o.icone;
    el('span', '', t).textContent = texte;
    while (zoneToasts.children.length > 2) zoneToasts.firstChild.remove();
    setTimeout(() => t.classList.add('sort'), o.duree || 2800);
    setTimeout(() => t.remove(), (o.duree || 2800) + 500);
  }
  function ajouterFil(texte, important) {
    const f = etat.ui.fil;
    f.push({ t: etat.temps, x: texte, i: important ? 1 : 0 });
    if (f.length > 80) f.splice(0, f.length - 80);
    majFil();
  }
  const fil = el('div', 'fil', racine);
  function majFil() {
    const l = etat.ui.fil.slice(-3);
    fil.innerHTML = l.map(e => `<div class="${e.i ? 'important' : ''}">${echapper(e.x)}</div>`).join('');
    fil.classList.remove('frais'); void fil.offsetWidth; fil.classList.add('frais');
  }
  // Bulle d'Odile : jamais plus de 2 lignes, toujours fermable (GDD 1.9).
  const bulleOdile = el('div', 'odile', racine);
  bulleOdile.innerHTML = '<img alt=""><div><b></b><p></p><div class="odile-boutons"></div></div><button type="button" class="fermer" aria-label="×">×</button>';
  let fileOdile = [], odileFin = 0;
  function odile(texte, o) {
    o = o || {};
    if (!texte) return;
    if (fileOdile.some(b => b.texte === texte)) return;
    // Sprint 6 : une seule bulle à la fois en bas de l'écran. Pendant le guide, Odile parle en petit bandeau.
    if (guideVisible()) { if (o.priorite === 1 && !o.boutons) toast(texte, { icone: vignette('odile'), duree: 4200 }); return; }
    if (o.priorite === 0 && fileOdile.length >= 2) return; // le superflu ne s'accumule pas
    fileOdile.push({ texte, boutons: o.boutons || [], duree: o.duree || (o.boutons ? 20000 : 7000) });
    if (!bulleOdile.classList.contains('ouverte')) suivanteOdile();
  }
  function suivanteOdile() {
    const b = fileOdile.shift();
    if (!b) { bulleOdile.classList.remove('ouverte'); racine.classList.remove('odile-ouverte'); return; }
    bulleOdile.querySelector('img').src = vignette('odile');
    bulleOdile.querySelector('b').textContent = TX('garde.nom') || 'Odile';
    bulleOdile.querySelector('p').textContent = b.texte;
    const zb = bulleOdile.querySelector('.odile-boutons');
    zb.innerHTML = '';
    for (const [txt, f] of b.boutons) { const bt = el('button', 'petit', zb); bt.type = 'button'; bt.textContent = txt; bt.onclick = () => { f(); fermerOdile(); }; }
    bulleOdile.classList.add('ouverte'); racine.classList.add('odile-ouverte');
    odileFin = Date.now() + b.duree;
  }
  function fermerOdile() { bulleOdile.classList.remove('ouverte'); racine.classList.remove('odile-ouverte'); odileFin = 0; setTimeout(suivanteOdile, 350); }
  bulleOdile.querySelector('.fermer').onclick = fermerOdile;

  // =====================================================================
  // Lecture du journal de core.js
  // =====================================================================
  const COMPORTEMENT = { repas: 'repas', pollinisation: 'pollinisation', dispersion: 'dispersion', hibernation: 'hiver', migration: 'hiver', predation: 'repas' };
  function lireJournal() {
    for (const j of etat.journal) {
      if (j.vu) continue;
      j.vu = 1;
      const nom = j.id && data.especes[j.id] ? nomEsp(j.id) : '';
      if (COMPORTEMENT[j.type]) observer(j.id, COMPORTEMENT[j.type]);
      switch (j.type) {
        case 'chene':
          ajouterFil(T('succession.chene'), true);
          toast(T('succession.chene'), { classe: 'or', duree: 6000 });
          odile(T('succession.chene_odile'), { priorite: 1 });
          break;
        case 'arrivee':
          observer(j.id, 'arrivee');
          if (j.premiere) {
            etat.ui.nouvelleT = etat.temps;
            ajouterFil(T('journal.premiere', { espece: nom }), true);
            const reaction = TX('garde.reactions.' + j.id);
            if (reaction) ajouterFil(reaction);
            // Sprint 6 : l'arrivée se montre sur l'île (étiquette au-dessus de l'animal), et le guide explique pourquoi.
            premiereArrivee(j);
          } else ajouterFil(T('journal.arrivee', { espece: nom }));
          break;
        case 'renfort': break;
        case 'naissance': ajouterFil(T('journal.naissance', { espece: nom })); break;
        case 'depart': ajouterFil(T('journal.depart', { espece: nom })); break;
        case 'parti': {
          const f = data.especes[j.id], b = f && f.besoins[j.manque];
          const manque = b ? libelleCondition(b) : '?';
          ajouterFil(T('journal.parti', { espece: nom }), true);
          odile(TX('garde.alertes.depart_espece', { manque }), { priorite: 1 });
          break;
        }
        case 'predation': ajouterFil(T('journal.predation', { espece: nom, proie: nomEsp(j.proie).toLowerCase() })); break;
        case 'dispersion': ajouterFil(T('journal.dispersion')); break;
        case 'surpaturage': ajouterFil(T('journal.surpaturage')); break;
        case 'foudre': ajouterFil(T('journal.foudre'), true); break;
        case 'hibernation': case 'migration': case 'reveil': ajouterFil(T('journal.' + j.type, { espece: nom })); break;
        case 'annonce': odile(TX('evenements.' + j.id + '.annonce') || TX('garde.alertes.' + j.id), { priorite: 1 }); break;
        case 'evenement': ajouterFil(T('journal.evenement', { evenement: nomEv(j.id) }), true); break;
        case 'evenement_fin':
          ajouterFil(T('journal.evenement_fin', { evenement: nomEv(j.id) }));
          ajouterFil(TX('evenements.' + j.id + '.fin') || TX('garde.alertes.fin_evenement'));
          if (j.reussi) toast(T('journal.evenement_reussi', { pages: j.pages, seve: j.seve }), { classe: 'or' });
          break;
        case 'rare':
          ajouterFil(T('journal.rare', { espece: nom, papier: T('papiers.' + j.papier) }), true);
          toast(T('journal.rare', { espece: nom, papier: T('papiers.' + j.papier) }), { icone: vignette(j.id, j.papier), classe: 'or', duree: 5000 });
          break;
        case 'collection': ajouterFil(T('journal.collection', { espece: nom, papier: T('papiers.' + j.papier) }), true); break;
        case 'mission': {
          const titre = TX('missions.' + j.id + '.titre') || j.id;
          ajouterFil(T('journal.mission', { titre }), true);
          toast(T('reussites.mission', { titre }), { classe: 'or', icone: vignette('odile') });
          break;
        }
        case 'etape': ajouterFil(T('journal.etape', { etape: nomEtape(j.id) }), true); break;
      }
    }
  }

  // =====================================================================
  // Tutoriel et alertes de la garde (GDD 4.4)
  // =====================================================================
  let saisonVue = null, momentVu = null;
  function tutoriel() {
    const u = etat.ui.tuto, h = Core.horloge(etat);
    const montrer = cle => { u[cle] = 1; odile(TX('garde.tutoriel.' + cle), { priorite: 1 }); };
    if (etat.etape === 'prairie' && !u.harmonie && !guideVisible()) {
      const s = Core.etapeSuivante(etat, data);
      if (s && !s.ok && s.conditions.filter(c => !c.ok).every(c => c.type === 'harmonie')) montrer('harmonie');
    }
    if (!u.premiere_nuit && h.moment === 'nuit' && !guideVisible()) montrer('premiere_nuit');
    // Alertes de saison.
    if (saisonVue && saisonVue !== h.saison) {
      if (h.saison === 'hiver') odile(TX('garde.alertes.hiver'), { priorite: 0 });
      coupurePub();
    }
    saisonVue = h.saison;
    momentVu = h.moment;
    // Blocage : aucune nouvelle espèce depuis 5 minutes → indice gratuit (GDD 1.9).
    if (etat.temps - etat.ui.nouvelleT > 300 && !guideVisible()) {
      const id = especeLaPlusProche(true);
      etat.ui.nouvelleT = etat.temps;
      if (id) odile(TX('garde.indices.blocage'), {
        boutons: [[T('boutons.voir_indice'), () => {
          const k = revelerIndice(id);
          if (k >= 0) odile(nomEsp(id) + ' : ' + TX('especes.' + id + '.indices')[k], { priorite: 1, duree: 14000 });
          ouvrirCarnet(id);
        }], [T('boutons.plus_tard'), () => {}]],
      });
    }
  }


  // =====================================================================
  // Guide des premières minutes (sprint 6) : remplace les bulles du tutoriel de la Prairie.
  // Chaque étape montre le bouton à toucher (main qui tape), puis les tuiles où la pose marche (contour doré),
  // et quand l'espèce attendue arrive, la caméra va la montrer avec une étiquette qui explique pourquoi elle est venue.
  // Les étapes se valident d'après l'état de l'île : un joueur qui fait les choses dans un autre ordre avance quand même.
  // =====================================================================
  const nbTuiles = f => Core.tuilesIle(etat).filter(i => f(etat.tuiles[i])).length;
  const aAmenagement = id => Core.tuilesIle(etat).some(i => etat.tuiles[i].a === id);
  const centreDe = f => {
    const l = Core.tuilesIle(etat).filter(i => f(etat.tuiles[i]));
    if (!l.length) return null;
    let x = 0, y = 0; for (const i of l) { x += i % N; y += (i / N) | 0; }
    return { x: x / l.length, y: y / l.length };
  };
  // Tuiles où l'action marcherait (sans compter le coût), les plus proches d'un point d'intérêt.
  function suggestions(id, pres, max) {
    const l = [];
    for (const i of Core.tuilesIle(etat)) {
      const x = i % N, y = (i / N) | 0;
      if (!apercu(id, x, y, true)) continue;
      const d = pres ? Math.hypot(x - pres.x, y - pres.y) : Math.hypot(x - Core.CENTRE, y - Core.CENTRE);
      l.push([d + ((i * 7919) % 13) * 0.01, i]);
    }
    l.sort((a, b) => a[0] - b[0]);
    return l.slice(0, max || 8).map(e => e[1]);
  }
  const herbeOuFleurs = t => t.c === 'herbe' || t.c === 'fleurs';
  function etapePose(cle, action, opts) {
    // Étape « choisis le bouton, puis pose » ; attend la sève si besoin.
    return {
      id: cle, action, attendu: opts.attendu,
      fini: opts.fini,
      texte() {
        const c = coutAction(action);
        if (etat.seve < c.seve && opts.attendre !== false) return T('guide.' + cle + '_attendre', { cout: c.seve, seve: Math.floor(etat.seve) });
        const p = opts.progres ? opts.progres() : null;
        return actionChoisie === action ? T('guide.' + cle + '_poser', p || {}) : T('guide.' + cle + '_choisir', p || {});
      },
      pret() { const c = coutAction(action); return etat.seve >= c.seve && etat.graines >= c.graines; },
      tuiles() { return suggestions(action, opts.pres ? opts.pres() : null, opts.max || 6); },
      glisse: ['semer_herbe', 'semer_fleurs', 'paillis', 'semer_ronce'].includes(action),
    };
  }
  const ETAPES_GUIDE = [
    { id: 'bienvenue', texte: () => T('guide.bienvenue'), fini: () => (venu('sauterelle') && etat.temps - (etat.ui.guide.vuT || 0) > 6) || etat.temps > 50, attendu: 'sauterelle' },
    etapePose('fleurs', 'semer_fleurs', {
      fini: () => nbTuiles(t => t.e === 'fleurs') >= 3 || (nbTuiles(t => t.e === 'fleurs') >= 1 && etat.graines < 1),
      progres: () => ({ n: nbTuiles(t => t.e === 'fleurs'), total: 3 }), attendre: false, max: 8,
      pres: () => centreDe(herbeOuFleurs),
    }),
    etapePose('hotel', 'hotel_insectes', { fini: () => aAmenagement('hotel_insectes'), attendu: 'abeille', pres: () => centreDe(t => t.e === 'fleurs'), max: 4 }),
    etapePose('pierres', 'tas_pierres', { fini: () => aAmenagement('tas_pierres'), attendu: 'lapin', pres: () => centreDe(t => t.c === 'herbe'), max: 4 }),
    etapePose('mare', 'mare', { fini: () => aAmenagement('mare'), max: 3 }),
    etapePose('paillis', 'paillis', {
      fini: () => nbTuiles(t => t.paillis > 0) >= 3, attendu: 'ver',
      progres: () => ({ n: nbTuiles(t => t.paillis > 0), total: 3 }), pres: () => centreDe(t => t.c === 'eau'), max: 6,
    }),
    { id: 'jauge', texte: () => T('guide.jauge'), fini: () => !!etat.ui.guide.jaugeVue, cible: () => jauge },
  ];
  function etatGuide() { return etat.ui.guide || (etat.ui.guide = { k: 0, ferme: etat.etape !== 'prairie', attendus: {} }); }
  function etapeGuide() {
    const g = etatGuide();
    if (g.ferme) return null;
    while (g.k < ETAPES_GUIDE.length && ETAPES_GUIDE[g.k].fini()) {
      const e = ETAPES_GUIDE[g.k];
      if (e.attendu && !venu(e.attendu)) g.attendus[e.attendu] = 1;
      g.k++;
    }
    if (g.k >= ETAPES_GUIDE.length) { g.ferme = true; odile(T('guide.fin'), { priorite: 1, duree: 9000 }); return null; }
    return ETAPES_GUIDE[g.k];
  }
  const guideVisible = () => !!(etat && etat.ui && etat.ui.guide && !etat.ui.guide.ferme);
  const bulleGuide = el('div', 'guide', racine);
  bulleGuide.innerHTML = '<img alt=""><div><small></small><p></p></div><button type="button" class="fermer" aria-label="×">×</button>';
  bulleGuide.querySelector('.fermer').onclick = () => { etatGuide().ferme = true; majGuide(); };
  const main = el('div', 'main', racine);
  main.innerHTML = '<svg viewBox="0 0 40 40"><path d="M15 37c-3-3-8-9-9-12-1-2 1-4 3-3l4 3V8a2.5 2.5 0 0 1 5 0v10l1-.2V6a2.5 2.5 0 0 1 5 0v12l1 .1V8.5a2.5 2.5 0 0 1 5 0V20l.8.2v-6a2.5 2.5 0 0 1 5 0V28c0 4-3 9-6 9z" fill="#fffaf0" stroke="#5a4a38" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  let guideTuiles = [], guideCible = null, guideRecolte = -1;
  function majGuide() {
    const e = etat ? etapeGuide() : null;
    for (const b of Object.values(boutonsActions)) b.classList.remove('conseil');
    jauge.classList.remove('conseil');
    guideTuiles = []; guideCible = null;
    // Astuce de récolte, une fois : quand une capsule de graines est mûre.
    guideRecolte = -1;
    if (!etat.ui.tuto.recolte) {
      const i = Core.tuilesIle(etat).find(k => etat.tuiles[k].graines >= 1);
      if (i !== undefined) guideRecolte = i;
    }
    if (!e && guideRecolte < 0) { bulleGuide.classList.remove('ouverte'); racine.classList.remove('guide-ouvert'); main.className = 'main'; return; }
    let txt, etape = '';
    if (e) {
      const g = etatGuide();
      etape = T('guide.etape', { n: g.k + 1, total: ETAPES_GUIDE.length });
      txt = e.texte();
      if (e.action) {
        if (actionChoisie !== e.action) guideCible = { bouton: boutonsActions[e.action] };
        else if (!e.pret || e.pret()) { guideTuiles = e.tuiles(); if (guideTuiles.length) guideCible = { tuile: guideTuiles[0], glisse: e.glisse }; }
      } else if (e.cible) guideCible = { bouton: e.cible() };
      if (guideCible && guideCible.bouton) guideCible.bouton.classList.add('conseil');
    }
    if (guideRecolte >= 0 && (!e || actionChoisie === 'observer')) {
      txt = T('guide.recolte'); guideTuiles = [guideRecolte];
      guideCible = actionChoisie === 'observer' ? { tuile: guideRecolte, haut: 0.6 } : { bouton: boutonsActions.observer };
      if (guideCible.bouton) guideCible.bouton.classList.add('conseil');
    }
    bulleGuide.querySelector('img').src = vignette('odile');
    texte(bulleGuide.querySelector('small'), etape);
    texte(bulleGuide.querySelector('p'), txt);
    bulleGuide.querySelector('.fermer').hidden = !e;
    bulleGuide.querySelector('.fermer').title = T('guide.passer');
    if (!bulleGuide.classList.contains('ouverte')) { bulleGuide.classList.add('ouverte'); racine.classList.add('guide-ouvert'); fermerOdileVite(); }
  }
  function fermerOdileVite() { if (bulleOdile.classList.contains('ouverte')) { bulleOdile.classList.remove('ouverte'); racine.classList.remove('odile-ouverte'); odileFin = 0; } }
  // La main suit sa cible à chaque image (la caméra bouge).
  function placerMain() {
    if (!guideCible || panneau.classList.contains('ouvert')) { if (main.className !== 'main') main.className = 'main'; return; }
    let x, y, cls = 'main visible';
    if (guideCible.bouton) {
      const r = guideCible.bouton.getBoundingClientRect();
      if (!r.width) { main.className = 'main'; return; }
      x = r.left + r.width / 2; y = r.top + r.height * 0.55; cls += ' tape';
    } else {
      const i = guideCible.tuile, o = rendu.ecran(i % N, (i / N) | 0, guideCible.haut || 0);
      x = o.x; y = o.y; cls += guideCible.glisse ? ' glisse' : ' tape';
    }
    main.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (main.className !== cls) main.className = cls;
  }
  function evenementTuto(quoi) {
    if (quoi === 'recolte') etat.ui.tuto.recolte = 1;
    if (etat.ui.guide) majGuide();
  }
  // Première venue d'une espèce : étiquette sur l'île ; pendant le guide, la caméra va la montrer.
  const etiquettes = [];
  function premiereArrivee(j) {
    const g = etat.ui.guide, explication = T('guide.vu_' + j.id);
    const aExpliquer = explication !== 'guide.vu_' + j.id;
    if (j.x === undefined) { toast(T('arrivee.nouvelle', { espece: nomEsp(j.id) }), { icone: vignette(j.id), classe: 'or' }); return; }
    const e = el('div', 'etiquette-ile', racine);
    e.innerHTML = `<img alt="" src="${vignette(j.id)}"><div><b></b>${aExpliquer ? '<small></small>' : ''}</div>`;
    e.querySelector('b').textContent = T('arrivee.nouvelle', { espece: nomEsp(j.id) });
    if (aExpliquer) e.querySelector('small').textContent = explication;
    etiquettes.push({ el: e, x: j.x, y: j.y, agent: j.agent, fin: Date.now() + (aExpliquer ? 7000 : 4500) });
    if (g && (!g.ferme || g.attendus[j.id] || j.id === 'sauterelle') && etat.etape === 'prairie') {
      if (j.id === 'sauterelle') g.vuT = etat.temps;
      delete g.attendus[j.id];
      animerCamera({ tx: j.x - Core.CENTRE, tz: j.y - Core.CENTRE, dist: Math.min(cam.dist, 15) }, 1.3);
    }
  }
  function majEtiquettes() {
    const now = Date.now();
    for (let k = etiquettes.length - 1; k >= 0; k--) {
      const t = etiquettes[k];
      if (now > t.fin) { t.el.classList.add('sort'); if (now > t.fin + 500) { t.el.remove(); etiquettes.splice(k, 1); } continue; }
      let x = t.x, y = t.y;
      if (t.agent !== undefined) { const a = etat.agents.find(a2 => a2.id === t.agent); if (a) { x = a.x; y = a.y; } }
      const o = rendu.ecran(x, y, 1.1);
      t.el.style.transform = `translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -100%)`;
    }
  }

  // =====================================================================
  // Barre du haut : ressources, horloge, météo, harmonie, succession
  // =====================================================================
  const haut = el('div', 'haut', racine);
  const ressources = el('div', 'ressources', haut);
  const chips = {};
  for (const r of ['seve', 'graines', 'pages']) {
    const c = el('div', 'chip', ressources);
    c.title = T('ressources.' + r);
    c.innerHTML = ICONES[r] + '<span></span>';
    chips[r] = c.querySelector('span');
  }
  const debitSeve = el('small', 'debit', chips.seve.parentNode);
  const blocTemps = el('button', 'chip temps', haut); blocTemps.type = 'button';
  const blocMeteo = el('button', 'chip meteo', haut); blocMeteo.type = 'button';
  blocMeteo.onclick = () => ouvrirBonus();
  blocTemps.onclick = () => { vitesse = vitesse === 1 ? 3 : 1; majHaut(); };
  const blocHarmonie = el('button', 'chip harmonie', haut); blocHarmonie.type = 'button';
  blocHarmonie.innerHTML = '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="#e3d8c2" stroke-width="5"/><circle class="anneau" cx="18" cy="18" r="15" fill="none" stroke="#6f8f4e" stroke-width="5" stroke-dasharray="0 100" transform="rotate(-90 18 18)" pathLength="100"/></svg><span></span>';
  blocHarmonie.onclick = () => ouvrirSuccession();
  const menu = el('div', 'menu', haut);
  const boutonsMenu = {};
  for (const [id, f] of [['carnet', () => ouvrirCarnet()], ['odile', () => ouvrirMissions()], ['bonus', () => ouvrirBonus()], ['reglages', () => ouvrirReglages()]]) {
    const b = el('button', 'rond', menu); b.type = 'button';
    b.innerHTML = (id === 'odile' ? `<img alt="" src="${vignette('odile')}">` : ICONES[id]) + `<span class="etiquette">${T('boutons.' + id)}</span><span class="pastille" hidden></span>`;
    b.onclick = f; b.title = T('boutons.' + id);
    boutonsMenu[id] = b;
  }
  const jauge = el('button', 'jauge', racine); jauge.type = 'button';
  jauge.onclick = () => ouvrirSuccession();
  let vitesse = 1;

  function majHaut() {
    texte(chips.seve, nombre(etat.seve));
    // Sprint 6 : le débit de sève est affiché, pour savoir combien de temps attendre.
    const debit = etat.seve >= Core.reserveMax(etat) ? 0 : Core.rendement(Core.productionSeve(etat, data)) * (0.5 + etat.harmonie) * (seveDoubleActive() ? 2 : 1);
    texte(debitSeve, '+' + debit.toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '/s');
    // Réserve de sève plafonnée par étape (sprint 5 bis) : chip doré quand elle est pleine.
    const max = Core.reserveMax(etat), pleine = etat.seve >= max;
    const cs = chips.seve.parentNode, titre = T('ressources.reserve', { nombre: nombre(Math.floor(etat.seve)), max: nombre(max) });
    if (cs.title !== titre) cs.title = titre;
    if (cs.classList.contains('pleine') !== pleine) cs.classList.toggle('pleine', pleine);
    if (pleine && !etat.ui.tuto['plein_' + etat.etape] && etat.temps > 120) { etat.ui.tuto['plein_' + etat.etape] = 1; odile(T('odile.reserve_pleine'), { priorite: 0 }); }
    texte(chips.graines, nombre(etat.graines));
    texte(chips.pages, nombre(etat.pages));
    const h = Core.horloge(etat);
    html(blocTemps, ICONES[h.moment === 'nuit' ? 'lune' : h.moment === 'crepuscule' ? 'crepuscule' : 'soleil']
      + `<span>${T(innerWidth < 700 ? 'horloge_court' : 'horloge', { saison: T('saisons.' + h.saison), jour: h.jour % 3 + 1, annee: h.annee + 1 })}</span><b class="vitesse">×${vitesse}</b>`);
    const m = Core.meteo(etat, data);
    let txt = T('meteo.calme'), cls = '';
    if (m.actif) { txt = T('meteo.actif', { nom: nomEv(m.actif.id), secondes: Math.ceil(m.actif.reste) }); cls = m.actif.id; }
    else if (m.annonce) { txt = T('meteo.annonce', { nom: nomEv(m.annonce.id), secondes: Math.max(0, Math.ceil(m.annonce.dans)) }); cls = 'annonce'; }
    if (blocMeteo.className !== 'chip meteo ' + cls) blocMeteo.className = 'chip meteo ' + cls;
    texte(blocMeteo, txt + (seveDoubleActive() ? ' · ' + T('bonus.seve_double') : ''));
    const hp = pct(etat.harmonie);
    if (blocHarmonie._hp !== hp) {
      blocHarmonie._hp = hp;
      blocHarmonie.querySelector('.anneau').setAttribute('stroke-dasharray', hp + ' 100');
      blocHarmonie.querySelector('.anneau').setAttribute('stroke', hp >= 60 ? '#6f8f4e' : hp >= 40 ? '#c9a24a' : '#c0704a');
      blocHarmonie.querySelector('span').textContent = hp + ' %';
      blocHarmonie.title = T('ressources.harmonie');
    }
    // Missions remplies à réclamer.
    const n = etat.missions.actives.filter(a => a.remplie).length;
    const p = boutonsMenu.odile.querySelector('.pastille'); if (p.hidden !== !n) p.hidden = !n; texte(p, String(n));
    // Jauge de succession.
    const s = Core.etapeSuivante(etat, data);
    const tz = !s && Core.teaser(etat, data);
    if (tz && tz.chene < 0) {
      // Teaser de la Jeune forêt (sprint 5 bis) : mêmes jauge et panneau, sans passage d'étape.
      const ok = tz.conditions.filter(c => c.ok).length;
      html(jauge, `<span>${T('succession.teaser_vers')}</span><i><b style="width:${ok / tz.conditions.length * 100}%"></b></i><em>${T('succession.conditions', { ok, total: tz.conditions.length })}</em>`);
      jauge.classList.remove('prete');
    }
    else if (!s) { html(jauge, `<span>${T('succession.fin')}</span>`); jauge.classList.remove('prete'); }
    else {
      const ok = s.conditions.filter(c => c.ok).length;
      html(jauge, `<span>${s.ok ? T('succession.pret', { etape: nomEtape(s.id) }) : T('succession.vers', { etape: nomEtape(s.id) })}</span><i><b style="width:${ok / s.conditions.length * 100}%"></b></i><em>${T('succession.conditions', { ok, total: s.conditions.length })}</em>`);
      if (jauge.classList.contains('prete') !== s.ok) jauge.classList.toggle('prete', s.ok);
    }
    majBarre();
  }

  // =====================================================================
  // Barre d'actions
  // =====================================================================
  const barre = el('div', 'barre', racine);
  const aideAction = el('div', 'aide-action', racine);
  let actionChoisie = 'observer';
  const boutonsActions = {};
  function coutAction(id) {
    const a = data.actions[id];
    if (!a) return { seve: 0, graines: 0 };
    if (a.type === 'semis') { const c = data.especes[a.espece].croissance; return { seve: c.cout_seve, graines: c.cout_graines }; }
    return { seve: a.cout_seve, graines: 0 };
  }
  function construireBarre() {
    barre.innerHTML = '';
    const liste = ['observer', ...ACTIONS, 'retirer', 'agrandir'];
    for (const id of liste) {
      const b = el('button', 'action', barre); b.type = 'button'; b.dataset.id = id;
      const c = coutAction(id);
      let cout = '';
      if (id === 'agrandir') cout = `<small class="cout">${ICONES.seve}<span class="cs"></span></small>`;
      else if (c.seve) cout = `<small class="cout">${ICONES.seve}${c.seve}${c.graines ? ' ' + ICONES.graines + c.graines : ''}</small>`;
      b.innerHTML = `<span class="ic">${iconeAction(id)}</span><span class="nom">${T('actions.' + id)}</span>${cout}<span class="verrou">${ICONES.cadenas}</span>`;
      b.onclick = () => choisirAction(id);
      boutonsActions[id] = b;
    }
    // Sprint 6 : les aménagements encore verrouillés sont rangés derrière un seul bouton (barre plus courte).
    const bientot = el('button', 'action bientot', barre); bientot.type = 'button';
    bientot.innerHTML = `<span class="ic">${ICONES.cadenas}</span><span class="nom">${T('barre.bientot')}</span><small class="cout"><span class="nb"></span></small>`;
    bientot.onclick = () => { const n = ACTIONS.filter(a => !actionDebloquee(a)).length; toast(T('barre.bientot_aide', { nombre: n }), { duree: 3200 }); };
    boutonsActions._bientot = bientot;
    majBarre();
  }
  function actionDebloquee(id) {
    const a = data.actions[id];
    return !a || ETAPES_PROTO.indexOf(etat.etape) >= ETAPES_PROTO.indexOf(a.etape);
  }
  function majBarre() {
    const et = data.etapes.find(e => e.id === etat.etape);
    const verrouillees = ACTIONS.filter(a => !actionDebloquee(a)).length, bt = boutonsActions._bientot;
    if (bt) { if (bt.hidden !== !verrouillees) bt.hidden = !verrouillees; texte(bt.querySelector('.nb'), '+' + verrouillees); }
    for (const [id, b] of Object.entries(boutonsActions)) {
      if (id === '_bientot') continue;
      const ok = actionDebloquee(id), c = coutAction(id);
      if (b.classList.contains('verrouille') === ok) b.classList.toggle('verrouille', !ok);
      if (id !== 'agrandir' && b.hidden !== !ok) b.hidden = !ok;
      if (b.classList.contains('choisie') !== (id === actionChoisie)) b.classList.toggle('choisie', id === actionChoisie);
      if (id === 'agrandir') {
        const possible = etat.rayon < et.rayon_ile;
        if (b.hidden !== !possible) b.hidden = !possible;
        texte(b.querySelector('.cs'), String(et.debloque.agrandissement_cout));
        const cher = etat.seve < et.debloque.agrandissement_cout;
        if (b.classList.contains('cher') !== cher) b.classList.toggle('cher', cher);
      } else { const cher = ok && (etat.seve < c.seve || etat.graines < c.graines); if (b.classList.contains('cher') !== cher) b.classList.toggle('cher', cher); }
      const titre = !ok ? T('actions.verrouille', { etape: nomEtape(data.actions[id].etape) }) : T('aides.' + id) !== 'aides.' + id ? T('aides.' + id) : T('actions.' + id + '_aide');
      if (b.title !== titre) b.title = titre;
    }
  }
  function choisirAction(id) {
    fermerPanneauTuile();
    if (id === 'agrandir') return agrandir();
    if (!actionDebloquee(id)) { toast(T('refus.verrouille', { etape: nomEtape(data.actions[id].etape) })); return; }
    actionChoisie = actionChoisie === id ? 'observer' : id;
    majBarre();
    if (actionChoisie === 'observer') { aideAction.classList.remove('visible'); majGuide(); return; }
    aideAction.innerHTML = `<b>${T('actions.' + id)}</b> · ${T('aides.' + id) !== 'aides.' + id ? T('aides.' + id) : T('actions.' + id + '_aide')}${PEINTURE.has(id) ? ' ' + T('peinture.aide') : ''}`;
    // Sprint 6 : l'aide s'efface seule (et ne s'affiche pas pendant le guide, qui explique déjà).
    clearTimeout(aideAction._t);
    if (!guideVisible()) { aideAction.classList.add('visible'); aideAction._t = setTimeout(() => aideAction.classList.remove('visible'), 3500); }
    majGuide();
  }
  function agrandir() {
    const r = Core.action(etat, data, 'agrandir');
    if (!r.ok) return refus(r);
    rendu.cadrer(etat);
    toast(T('reussites.agrandi'), { classe: 'or' });
    majHaut();
  }
  function refus(r) {
    let t;
    if (r.raison === 'seve' || r.raison === 'graines') t = T('refus.' + r.raison, { nombre: Math.ceil(r.details.manque) });
    else if (r.raison === 'verrouille') t = T('refus.verrouille', { etape: nomEtape(r.details.etape) });
    else if (r.raison === 'besoins') {
      const k = r.details.besoins.findIndex(b => !b.ok), fiche = r.fiche;
      const c = fiche && fiche.besoins[k];
      t = T('refus.besoins', { manque: c ? libelleCondition(c) + ' (' + valeurCondition(c, r.details.besoins[k]) + ')' : '?' });
    } else t = T('refus.' + r.raison) !== 'refus.' + r.raison ? T('refus.' + r.raison) : T('refus.autre');
    toast(t, { classe: 'refus' });
  }
  // Aperçu au survol : la pose marcherait-elle ici ? (sans rien modifier)
  const liberable = t => t && !t.a && t.c !== 'eau' && t.c !== 'roche';
  function apercu(id, x, y, sansCout) {
    if (!Core.dansIle(etat, x, y)) return false;
    const t = etat.tuiles[Core.idx(x, y)], a = data.actions[id];
    if (id === 'retirer') return !!(t.a || t.e || t.c === 'roche');
    if (!a) return true;
    const c = coutAction(id);
    if (!sansCout && (etat.seve < c.seve || etat.graines < c.graines)) return false;
    if (a.type === 'semis') {
      if (!liberable(t) || t.e === a.espece) return false;
      if (a.espece !== 'herbe' && t.c !== 'nu' && t.c !== 'herbe') return false;
      return Core.besoinsEspece(etat, data, a.espece, x, y).every(b => b.ok);
    }
    if (a.pose === 'arbre_adulte') { const f = data.especes[t.e]; return t.c === 'arbre' && !t.nichoir && f && (!f.croissance || t.age >= f.croissance.jours_adulte); }
    if (a.pose === 'surcouche') return !(t.c === 'eau' || t.c === 'roche' || t.a || t.paillis > 0);
    for (let dy = 0; dy < a.taille; dy++) for (let dx = 0; dx < a.taille; dx++) {
      if (!Core.dansIle(etat, x + dx, y + dy)) return false;
      const tt = etat.tuiles[Core.idx(x + dx, y + dy)];
      if (!liberable(tt) || tt.c === 'arbre') return false;
    }
    return true;
  }
  function poser(id, x, y, silence) {
    const r = Core.action(etat, data, id, x, y);
    if (!r.ok) {
      if (silence) return r;
      if (r.raison === 'besoins') r.fiche = data.especes[data.actions[id].espece];
      refus(r);
      return r;
    }
    if (id === 'retirer') { if (!silence) toast(T('reussites.retire', { nombre: r.rendu }), { duree: 1600 }); }
    else {
      const a = data.actions[id];
      if (a.type === 'semis') { observer(a.espece, 'pousse'); reconnaitrePlantes(false); }
    }
    evenementTuto('pose', id, x, y);
    if (!silence) majHaut();
    return r;
  }

  // =====================================================================
  // Clics sur l'île : caméra, photos, récolte, tuiles
  // =====================================================================
  // Sprint 6 : glisser déplace la caméra ; avec une action de semis choisie, maintenir et glisser sème à la chaîne.
  // Souris : clic droit + glisser pour tourner, molette pour zoomer. Doigts : deux doigts pour zoomer, tourner, déplacer.
  const PEINTURE = new Set(['semer_herbe', 'semer_fleurs', 'paillis', 'semer_ronce', 'retirer']);
  const pointeurs = {};
  let geste = null, survol = null, appui = null;
  const posEcran = ev => { const r = canvas.getBoundingClientRect(); return { sx: ev.clientX - r.left, sy: ev.clientY - r.top }; };
  function infoPince() {
    const ids = Object.keys(pointeurs), a = pointeurs[ids[0]], b = pointeurs[ids[1]];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
  function debutPeinture() {
    if (!geste || geste.mode !== 'peint' || geste.actif) return;
    geste.actif = true;
    peindre(geste.x, geste.y);
  }
  function peindre(cx, cy) {
    const r = canvas.getBoundingClientRect(), t = rendu.tuileSous(cx - r.left, cy - r.top);
    if (!t || !Core.dansIle(etat, t.x, t.y)) return;
    const cle = t.x + ',' + t.y;
    if (geste.faites.has(cle)) return;
    geste.faites.add(cle);
    if (!geste.premiere) geste.premiere = t;
    // Retirer à la chaîne : seulement ce qui ressemble à la première tuile touchée (on ne rase pas un hôtel par mégarde).
    if (actionChoisie === 'retirer') {
      const tu = etat.tuiles[Core.idx(t.x, t.y)], sig = tu.a || tu.e || tu.c;
      if (geste.sig === undefined) geste.sig = sig;
      if (sig !== geste.sig) return;
    }
    if (!apercu(actionChoisie, t.x, t.y)) return;
    const res = poser(actionChoisie, t.x, t.y, true);
    if (res && res.ok) { geste.poses++; dernierTap = { x: t.x, y: t.y, fin: Date.now() + 400 }; }
  }
  function finPeinture() {
    const g = geste;
    if (!g.actif) {
      // Simple toucher : une pose, avec l'explication en cas de refus.
      const r = canvas.getBoundingClientRect();
      return clic(g.x - r.left, g.y - r.top);
    }
    if (!g.poses && g.premiere) poser(actionChoisie, g.premiere.x, g.premiere.y); // rien n'a marché : on dit pourquoi, une fois
    else if (g.poses > 1) evenementTuto('peinture', g.poses);
  }
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  canvas.addEventListener('pointerdown', ev => {
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* pointeur synthétique */ }
    pointeurs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    const n = Object.keys(pointeurs).length;
    if (n === 2) {
      if (geste && geste.mode === 'peint') { clearTimeout(geste.minuteur); if (geste.actif && geste.poses) majHaut(); }
      geste = Object.assign({ mode: 'pince', dist: cam.dist, yaw: cam.yaw }, infoPince());
      geste.d0 = geste.d; geste.ang0 = geste.ang;
      appui = null; return;
    }
    if (n > 2) return;
    appui = { x: ev.clientX, y: ev.clientY, t: Date.now() };
    if (ev.button === 2 || (ev.pointerType === 'mouse' && ev.shiftKey)) geste = { mode: 'rot', x: ev.clientX, y: ev.clientY, yaw: cam.yaw, pitch: cam.pitch };
    else if (ev.button === 1) geste = { mode: 'pan', x: ev.clientX, y: ev.clientY };
    else if (actionChoisie !== 'observer' && PEINTURE.has(actionChoisie)) {
      geste = { mode: 'peint', x: ev.clientX, y: ev.clientY, faites: new Set(), poses: 0, actif: false };
      // Petit délai au doigt : laisse le temps de poser un second doigt pour zoomer sans semer.
      geste.minuteur = setTimeout(debutPeinture, ev.pointerType === 'mouse' ? 0 : 110);
    }
    else geste = { mode: 'pan', x: ev.clientX, y: ev.clientY };
  });
  canvas.addEventListener('pointermove', ev => {
    if (ev.pointerType === 'mouse') survol = posEcran(ev);
    const p = pointeurs[ev.pointerId];
    if (!p || !geste) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    p.x = ev.clientX; p.y = ev.clientY;
    if (appui && Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) > 8) appui = null;
    if (geste.mode === 'pince') {
      if (Object.keys(pointeurs).length < 2) return;
      const i = infoPince();
      cam.dist = Math.max(6, Math.min(45, geste.dist * geste.d0 / Math.max(10, i.d)));
      cam.yaw = geste.yaw - (i.ang - geste.ang0);
      rendu.deplacer(i.mx - geste.mx, i.my - geste.my, etat);
      geste.mx = i.mx; geste.my = i.my;
    } else if (geste.mode === 'rot') {
      cam.yaw = geste.yaw - (ev.clientX - geste.x) * 0.008;
      cam.pitch = Math.max(0.4, Math.min(1.35, geste.pitch + (ev.clientY - geste.y) * 0.006));
    } else if (geste.mode === 'pan') {
      if (!appui) rendu.deplacer(dx, dy, etat);
    } else if (geste.mode === 'peint') {
      if (!geste.actif && !appui) { clearTimeout(geste.minuteur); debutPeinture(); }
      if (geste.actif) peindre(ev.clientX, ev.clientY);
    }
  });
  const finPointeur = ev => {
    if (!pointeurs[ev.pointerId]) return;
    const n = Object.keys(pointeurs).length;
    if (geste && n === 1 && ev.type === 'pointerup') {
      if (geste.mode === 'peint') { clearTimeout(geste.minuteur); finPeinture(); }
      else if (geste.mode === 'pan' && appui) { const r = canvas.getBoundingClientRect(); clic(ev.clientX - r.left, ev.clientY - r.top); }
    }
    delete pointeurs[ev.pointerId];
    if (geste && geste.mode === 'pince' && n === 2) {
      // Il reste un doigt : il continue à déplacer la caméra, sans semer.
      const id = Object.keys(pointeurs)[0];
      geste = id ? { mode: 'pan', x: pointeurs[id].x, y: pointeurs[id].y } : null;
    }
    if (!Object.keys(pointeurs).length) { geste = null; appui = null; majHaut(); }
  };
  canvas.addEventListener('pointerup', finPointeur); canvas.addEventListener('pointercancel', finPointeur);
  canvas.addEventListener('pointerleave', () => { survol = null; });
  canvas.addEventListener('wheel', ev => { ev.preventDefault(); cam.dist = Math.max(6, Math.min(45, cam.dist * (ev.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { if (panneau.classList.contains('ouvert')) fermerPanneau(); else if (actionChoisie !== 'observer') choisirAction(actionChoisie); fermerPanneauTuile(); }
    if (panneau.classList.contains('ouvert')) return;
    const pas = 40, k = ev.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a' || k === 'q') rendu.deplacer(pas, 0, etat);
    else if (k === 'arrowright' || k === 'd') rendu.deplacer(-pas, 0, etat);
    else if (k === 'arrowup' || k === 'w' || k === 'z') rendu.deplacer(0, pas, etat);
    else if (k === 'arrowdown' || k === 's') rendu.deplacer(0, -pas, etat);
  });
  // Petits boutons de caméra : tourner à gauche, à droite, recentrer.
  const boutonsCamera = el('div', 'camera-boutons', racine);
  for (const [id, svg, f] of [
    ['gauche', '<svg viewBox="0 0 24 24"><path d="M7 8a7 7 0 1 1-1 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 4v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>', () => tourner(-Math.PI / 4)],
    ['droite', '<svg viewBox="0 0 24 24"><path d="M17 8a7 7 0 1 0 1 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M21 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>', () => tourner(Math.PI / 4)],
    ['centrer', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>', () => { rendu.cadrer(etat); }],
  ]) { const b = el('button', 'rond petit-rond', boutonsCamera); b.type = 'button'; b.innerHTML = svg; b.title = T('camera.' + id); b.onclick = f; }
  // Mouvements de caméra animés (boutons, tutoriel qui montre un résultat).
  let anim = null;
  function tourner(da) { animerCamera({ yaw: cam.yaw + da }, 0.45); }
  function animerCamera(cible, duree) {
    anim = { de: { yaw: cam.yaw, tx: cam.tx, tz: cam.tz, dist: cam.dist }, vers: Object.assign({ yaw: cam.yaw, tx: cam.tx, tz: cam.tz, dist: cam.dist }, cible), t: 0, duree: duree || 1 };
  }
  function avancerCamera(dt) {
    if (!anim) return;
    if (geste) { anim = null; return; } // le joueur reprend la main
    anim.t += dt / anim.duree;
    const k = anim.t >= 1 ? 1 : anim.t * anim.t * (3 - 2 * anim.t);
    for (const c of ['yaw', 'tx', 'tz', 'dist']) cam[c] = anim.de[c] + (anim.vers[c] - anim.de[c]) * k;
    if (anim.t >= 1) anim = null;
  }

  let dernierTap = null;
  function clic(sx, sy) {
    const t = rendu.tuileSous(sx, sy);
    if (actionChoisie !== 'observer') {
      if (t) { poser(actionChoisie, t.x, t.y); dernierTap = { x: t.x, y: t.y, fin: Date.now() + 600 }; }
      return;
    }
    const c = rendu.cibleSous(sx, sy);
    if (c && c.k === 'garde') return ouvrirMissions();
    if (c) return photographier(c.esp, c.papier, sx, sy);
    if (!t || !Core.dansIle(etat, t.x, t.y)) { fermerPanneauTuile(); return; }
    const tu = etat.tuiles[Core.idx(t.x, t.y)];
    if (tu.graines >= 1) {
      const r = Core.action(etat, data, 'recolter', t.x, t.y);
      if (r.ok) { envol(sx, sy, '+' + r.graines, chips.graines); evenementTuto('recolte'); majHaut(); return; }
    }
    ouvrirPanneauTuile(t.x, t.y, sx, sy);
  }
  function photographier(id, papier, sx, sy) {
    let r = Core.photographier(etat, data, id, papier || undefined);
    if (!r.ok && papier) r = Core.photographier(etat, data, id);
    if (!r.ok) return refus(r);
    flash();
    if (r.carte) toast(T('reussites.carte', { espece: nomEsp(id), papier: T('papiers.' + papier) }), { icone: vignette(id, papier), classe: 'or', duree: 5000 });
    else if (r.premiere) toast(T('reussites.photo_premiere', { espece: nomEsp(id) }), { icone: vignette(id), classe: 'or' });
    if (sx !== undefined && r.premiere) envol(sx, sy, '+1', chips.pages);
    majHaut();
  }
  const voileFlash = el('div', 'flash', racine);
  function flash() { voileFlash.classList.remove('on'); void voileFlash.offsetWidth; voileFlash.classList.add('on'); }
  // Petite bulle de papier qui s'envole vers un compteur (GDD 1.6).
  function envol(sx, sy, texte, cible) {
    const b = el('div', 'envol', racine); b.textContent = texte;
    b.style.left = sx + 'px'; b.style.top = sy + 'px';
    const r = cible.getBoundingClientRect();
    requestAnimationFrame(() => { b.style.transform = `translate(${r.left - sx}px, ${r.top - sy}px) scale(0.6)`; b.style.opacity = '0.2'; });
    setTimeout(() => b.remove(), 900);
  }

  // Panneau d'une tuile (observer) : ce qu'elle porte, ses statistiques, les gestes possibles.
  const panneauTuile = el('div', 'panneau-tuile', racine);
  let tuileOuverte = null;
  function fermerPanneauTuile() { panneauTuile.classList.remove('ouvert'); tuileOuverte = null; }
  function ouvrirPanneauTuile(x, y, sx, sy) {
    tuileOuverte = { x, y, sx, sy };
    majPanneauTuile();
    panneauTuile.classList.add('ouvert');
    const w = racine.clientWidth, h = racine.clientHeight, pw = panneauTuile.offsetWidth, ph = panneauTuile.offsetHeight;
    panneauTuile.style.left = Math.max(8, Math.min(w - pw - 8, sx + 14)) + 'px';
    panneauTuile.style.top = Math.max(60, Math.min(h - ph - 110, sy - ph / 2)) + 'px';
  }
  function majPanneauTuile() {
    if (!tuileOuverte) return;
    const { x, y } = tuileOuverte, t = etat.tuiles[Core.idx(x, y)];
    let nom;
    if (t.naturel) nom = T('tuile.foudroye');
    else if (t.a) nom = T('amenagements.' + t.a);
    else if (t.e) nom = nomEsp(t.e);
    else nom = T('couverts.' + t.c);
    const f = t.e && data.especes[t.e];
    const extra = [];
    if (f && f.croissance && f.croissance.jours_adulte > 1) extra.push(t.age >= f.croissance.jours_adulte ? T('tuile.adulte') : T('tuile.jeune'));
    if (t.nichoir) extra.push(T('tuile.nichoir'));
    if (t.paillis > 0) extra.push(T('tuile.paillis'));
    if (t.champi) extra.push(nomEsp(t.champi));
    if (t.graines >= 1) extra.push(T('tuile.graines', { nombre: Math.floor(t.graines) }));
    const stat = (k, v) => `<div class="stat"><span>${T('stats.' + k)}</span><i><b style="width:${Math.round(v)}%"></b></i><em>${Math.round(v)}</em></div>`;
    panneauTuile.innerHTML = `<button type="button" class="fermer">×</button><b>${echapper(nom.charAt(0).toUpperCase() + nom.slice(1))}</b>${extra.length ? '<small>' + extra.join(' · ') + '</small>' : ''}`
      + stat('fertilite', t.f) + stat('humidite', t.h) + stat('ombre', t.o) + '<div class="gestes"></div>';
    panneauTuile.querySelector('.fermer').onclick = fermerPanneauTuile;
    const g = panneauTuile.querySelector('.gestes');
    const geste = (txt, f2) => { const b = el('button', 'petit', g); b.type = 'button'; b.textContent = txt; b.onclick = f2; };
    for (const id of [t.e, t.champi].filter(Boolean)) {
      const rare = etat.rares.find(r => r.id === id && r.tuile === Core.idx(x, y));
      geste(T('boutons.photographier') + ' · ' + nomEsp(id), () => { photographier(id, rare && rare.papier, tuileOuverte.sx, tuileOuverte.sy); majPanneauTuile(); });
    }
    if (t.graines >= 1) geste(T('boutons.recolter'), () => { const r = Core.action(etat, data, 'recolter', x, y); if (r.ok) toast(T('reussites.recolte', { nombre: r.graines })); majHaut(); majPanneauTuile(); });
    if (t.c === 'arbre' && !t.nichoir && actionDebloquee('nichoir') && apercu('nichoir', x, y)) geste(T('boutons.nichoir') + ' (' + coutAction('nichoir').seve + ')', () => { poser('nichoir', x, y); majPanneauTuile(); });
    if (t.a || t.e || t.c === 'roche') geste(T('boutons.retirer'), () => { poser('retirer', x, y); majPanneauTuile(); });
  }

  // =====================================================================
  // Grand panneau (carnet, missions, succession, bonus, réglages, retour)
  // =====================================================================
  const panneau = el('div', 'panneau', racine);
  panneau.innerHTML = '<div class="feuille"><button type="button" class="fermer" aria-label="×">×</button><div class="contenu"></div></div>';
  const contenu = panneau.querySelector('.contenu');
  let panneauMaj = null;
  panneau.querySelector('.fermer').onclick = () => fermerPanneau();
  panneau.addEventListener('pointerdown', ev => { if (ev.target === panneau) fermerPanneau(); });
  function ouvrirPanneau(maj, classe) {
    panneauMaj = maj;
    panneau.className = 'panneau ouvert ' + (classe || '');
    maj();
    contenu.scrollTop = 0;
  }
  function fermerPanneau() { panneau.classList.remove('ouvert'); panneauMaj = null; }

  // ---------- Carnet ----------
  let ongletCarnet = 'especes', especeOuverte = null;
  function ouvrirCarnet(id) {
    if (id) { ongletCarnet = 'especes'; especeOuverte = id; }
    majIndices();
    ouvrirPanneau(dessinerCarnet, 'carnet');
  }
  function dessinerCarnet() {
    const onglets = ['especes', 'collection', 'journal'].map(o => `<button type="button" class="onglet${o === ongletCarnet ? ' actif' : ''}" data-o="${o}">${T('carnet.onglet_' + o)}</button>`).join('');
    let corps = '';
    if (ongletCarnet === 'especes') corps = especeOuverte ? pageEspece(especeOuverte) : grilleEspeces();
    else if (ongletCarnet === 'collection') corps = pageCollection();
    else corps = pageJournal();
    contenu.innerHTML = `<h2>${T('carnet.titre')}</h2><div class="onglets">${onglets}</div>${corps}`;
    contenu.querySelectorAll('.onglet').forEach(b => { b.onclick = () => { ongletCarnet = b.dataset.o; especeOuverte = null; dessinerCarnet(); }; });
    contenu.querySelectorAll('[data-esp]').forEach(b => { b.onclick = () => { especeOuverte = b.dataset.esp; dessinerCarnet(); contenu.scrollTop = 0; }; });
    const ret = contenu.querySelector('.retour'); if (ret) ret.onclick = () => { especeOuverte = null; dessinerCarnet(); };
    const pub = contenu.querySelector('.pub-indice'); if (pub) pub.onclick = () => indicePub(especeOuverte);
  }
  function grilleEspeces() {
    const deb = debloquees();
    const venues = ORDRE_ESPECES.filter(venu).length, photos = ORDRE_ESPECES.filter(id => etat.carnet[id] && etat.carnet[id].photo).length;
    let h = `<p class="sous">${T('carnet.progression', { venues, total: ORDRE_ESPECES.length, photos })}</p><div class="grille">`;
    for (const id of ORDRE_ESPECES) {
      const ok = deb.includes(id), v = venu(id), present = Core.presence(etat, data, id) > 0;
      const ind = ok ? indicesDe(id) : [];
      const etat2 = !ok ? T('carnet.verrouillee', { etape: nomEtape(data.especes[id].etape) }) : v ? (present ? T('carnet.presente') : T('carnet.venue')) : ind.filter(Boolean).length + ' / ' + ind.length;
      h += `<button type="button" class="carte-esp${v ? ' venue' : ''}${ok ? '' : ' verrouillee'}${present ? ' presente' : ''}" ${ok ? `data-esp="${id}"` : 'disabled'}>`
        + `<img alt="" src="${vignette(id, v ? '' : 'silhouette')}"><b>${v ? echapper(nomEsp(id)) : '?'}</b><small>${etat2}</small>`
        + `${etat.carnet[id] && etat.carnet[id].photo ? '<i class="photo-ok">●</i>' : ''}</button>`;
    }
    return h + '</div>';
  }
  function pageEspece(id) {
    const f = data.especes[id], tx = TX('especes.' + id) || {}, v = venu(id), ca = carnetDe(id);
    const present = Core.presence(etat, data, id) > 0, ind = indicesDe(id), res = besoinsMeilleurs(id) || [];
    let h = `<button type="button" class="retour">‹ ${T('carnet.onglet_especes')}</button><div class="fiche"><img alt="" src="${vignette(id, v ? '' : 'silhouette')}"><div>`
      + `<h3>${v ? echapper(tx.nom) : T('carnet.inconnue')}</h3>${v ? `<i>${echapper(tx.nom_latin)}</i>` : ''}`
      + `<p>${v ? echapper(tx.description) : ''}</p>${ca.photo ? `<p class="anecdote">${echapper(tx.anecdote)}</p>` : v ? `<p class="sous">${T('carnet.photo_a_faire')}</p>` : ''}</div></div>`;
    if (v && !present && ca.departs > 0 && ca.manque >= 0) h += `<p class="parti">${T('carnet.partie', { manque: libelleCondition(f.besoins[ca.manque]) })}</p>`;
    h += `<h4>${T('carnet.besoins')}</h4><ul class="besoins">`;
    f.besoins.forEach((c, k) => {
      if (!ind[k]) { h += `<li class="cache">${T('carnet.besoin_cache')}</li>`; return; }
      const r = res[k] || {};
      h += `<li class="${r.ok ? 'ok' : 'non'}"><span>${r.ok ? '✓' : '✗'}</span><div>${echapper(tx.indices[k])}${v || r.ok ? `<small>${libelleCondition(c)}${!r.ok ? ' · ' + valeurCondition(c, r) : ''}</small>` : ''}</div></li>`;
    });
    h += '</ul>';
    if (ind.includes(false)) {
      const reste = Math.max(0, 3 - pubsIndicesAujourdhui());
      h += `<button type="button" class="petit pub-indice"${reste ? '' : ' disabled'}>${ICONES.bonus}${T('carnet.indice_pub')}</button><small class="sous">${T('carnet.indice_pub_aide', { nombre: reste })}</small>`;
    }
    const comps = tx.comportements || {}, obs = etat.ui.comportements[id] || {};
    h += `<h4>${T('carnet.comportements')}</h4><ul class="comportements">`;
    for (const k of Object.keys(comps)) h += obs[k] ? `<li>${echapper(comps[k])}</li>` : `<li class="cache">${T('carnet.comportement_cache')}</li>`;
    h += `</ul><h4>${T('carnet.cartes')}</h4><div class="cartes">`;
    for (const r of data.rares) {
      const a = etat.collection[id + ':' + r.id];
      h += `<div class="carte-rare${a ? ' acquise' : ''}"><img alt="" src="${vignette(id, a ? r.id : 'silhouette')}"><small>${T('papiers.' + r.id)}</small></div>`;
    }
    return h + '</div>';
  }
  function pageCollection() {
    const total = ORDRE_ESPECES.length * data.rares.length, cartes = Object.keys(etat.collection).length;
    let h = `<p class="sous">${T('carnet.collection_titre', { cartes, total })}</p><div class="chances">`;
    for (const c of Core.chancesRares(etat, data)) {
      h += `<div><b>${T('papiers.' + c.id)}</b> · ${T('carnet.chance', { sur: Math.round(1 / c.chance) })}${c.evenement && c.garantieDans ? '<br><em>' + T('carnet.chance_evenement', { essais: c.garantieDans }) + '</em>' : ''}</div>`;
    }
    if (etat.harmonie > Core.P.seuilHarmonieRare) h += `<div><em>${T('carnet.chance_harmonie')}</em></div>`;
    h += '</div><div class="grille collection">';
    for (const id of ORDRE_ESPECES) for (const r of data.rares) {
      const a = etat.collection[id + ':' + r.id];
      h += `<div class="carte-rare${a ? ' acquise' : ''}"><img alt="" src="${vignette(id, a ? r.id : 'silhouette')}"><small>${a ? echapper(nomEsp(id)) + ' · ' : ''}${T('papiers.' + r.id)}</small></div>`;
    }
    return h + '</div>';
  }
  function pageJournal() {
    const l = etat.ui.fil.slice().reverse();
    if (!l.length) return `<p class="sous">${T('carnet.journal_vide')}</p>`;
    return '<ul class="journal">' + l.map(e => {
      const h = Core.horloge({ temps: e.t });
      return `<li class="${e.i ? 'important' : ''}"><small>${T('saisons.' + h.saison)} ${h.jour % 3 + 1}</small>${echapper(e.x)}</li>`;
    }).join('') + '</ul>';
  }

  // ---------- Missions ----------
  function ouvrirMissions() { ouvrirPanneau(dessinerMissions, 'missions'); }
  function dessinerMissions() {
    let h = `<div class="odile-tete"><img alt="" src="${vignette('odile')}"><h2>${T('missions.titre')}</h2></div>`;
    if (!etat.missions.actives.length) h += `<p class="sous">${T('missions.aucune')}</p>`;
    for (const a of etat.missions.actives) {
      const mi = data.missions.find(m => m.id === a.id), o = mi.objectif, r = mi.recompense;
      const rec = [r.seve ? r.seve + ' ' + T('ressources.seve').toLowerCase() : '', r.graines ? r.graines + ' ' + T('ressources.graines').toLowerCase() : '', r.pages ? r.pages + ' ' + T('ressources.pages').toLowerCase() : ''].filter(Boolean).join(', ');
      h += `<div class="mission${a.remplie ? ' remplie' : ''}"><b>${echapper(TX('missions.' + a.id + '.titre') || a.id)}</b><p>${echapper(TX('missions.' + a.id + '.texte') || '')}</p>`
        + `<div class="prog"><i><b style="width:${Math.min(100, a.n / o.nombre * 100)}%"></b></i><em>${T('missions.progression', { n: a.n, total: o.nombre })}</em></div>`
        + `<small>${T('missions.recompense', { liste: rec })}</small>${a.remplie ? `<button type="button" class="grand" data-m="${a.id}">${T('boutons.recevoir')}</button>` : ''}</div>`;
    }
    contenu.innerHTML = h;
    contenu.querySelectorAll('[data-m]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.m, r = Core.reclamerMission(etat, data, id);
        if (!r.ok) return;
        const reussite = TX('missions.' + id + '.reussite');
        if (reussite) odile(reussite, { priorite: 1 });
        envol(b.getBoundingClientRect().left, b.getBoundingClientRect().top, '+' + r.recompense.seve, chips.seve);
        majHaut(); dessinerMissions();
      };
    });
  }

  // ---------- Succession ----------
  function ouvrirSuccession() { if (etat.ui.guide) etat.ui.guide.jaugeVue = true; ouvrirPanneau(dessinerSuccession, 'succession'); majGuide(); }
  function dessinerSuccession() {
    const s = Core.etapeSuivante(etat, data), hd = etat.harmonieDetail;
    let h = '';
    const tz = !s && Core.teaser(etat, data);
    if (tz && tz.chene < 0) {
      h = `<h2>${T('succession.teaser_vers')}</h2><p class="sous">${T('succession.teaser_texte')}</p><ul class="besoins">`;
      tz.conditions.forEach((r, k) => {
        const c = tz.definitions[k];
        h += `<li class="${r.ok ? 'ok' : 'non'}"><span>${r.ok ? '✓' : '✗'}</span><div>${libelleCondition(c)}<small>${valeurCondition(c, r)}</small></div></li>`;
      });
      h += '</ul>';
    }
    else if (tz) h = `<h2>${T('succession.chene')}</h2><p>${T('succession.chene_texte')}</p>`;
    else if (!s) h = `<h2>${T('succession.fin')}</h2><p>${T('succession.fin_texte')}</p>`;
    else {
      const et = data.etapes.find(e => e.id === s.id);
      h = `<h2>${T('succession.vers', { etape: nomEtape(s.id) })}</h2><ul class="besoins">`;
      s.conditions.forEach((r, k) => {
        const c = et.conditions_entree[k];
        h += `<li class="${r.ok ? 'ok' : 'non'}"><span>${r.ok ? '✓' : '✗'}</span><div>${libelleCondition(c)}<small>${valeurCondition(c, r)}</small></div></li>`;
      });
      h += '</ul>';
      if (s.ok) h += `<button type="button" class="grand passer">${T('boutons.passer_etape', { etape: nomEtape(s.id) })}</button>`;
    }
    if (hd) {
      h += `<h4>${T('ressources.harmonie')} : ${pct(etat.harmonie)} %</h4><div class="harmo">`;
      for (const k of ['equilibre', 'chaine', 'diversite', 'mosaique']) h += `<div class="stat"><span>${T('harmonie.' + k) !== 'harmonie.' + k ? T('harmonie.' + k) : k}</span><i><b style="width:${pct(hd[k])}%"></b></i><em>${pct(hd[k])}</em></div>`;
      h += '</div>';
    }
    contenu.innerHTML = h;
    const p = contenu.querySelector('.passer'); if (p) p.onclick = passerEtape;
  }
  function passerEtape() {
    const r = Core.passerEtape(etat, data);
    if (!r.ok) return;
    fermerPanneau();
    lireJournal();
    construireBarre();
    cinematique(r.etape).then(() => {
      if (!etat.ui.tuto.lisiere && r.etape === 'lisiere') { etat.ui.tuto.lisiere = 1; odile(TX('garde.tutoriel.lisiere'), { priorite: 1 }); }
      odile(TX('garde.alertes.nouvelle_mission'), { priorite: 0, boutons: [[T('boutons.odile'), ouvrirMissions]] });
      coupurePub();
    });
    sauver();
  }
  // Le papier de l'île se replie et se redéplie (GDD 2).
  function cinematique(id) {
    return new Promise(resolve => {
      const v = el('div', 'cinematique', racine);
      v.innerHTML = `<div class="pli haut-pli"></div><div class="pli bas-pli"></div><div class="titre-etape"><small>${echapper(nomEtape(id))}</small><h2>${echapper(TX('etapes.' + id + '.titre_passage') || '')}</h2><p>${echapper(TX('etapes.' + id + '.texte_passage') || '')}</p><button type="button" class="grand">${T('boutons.continuer')}</button></div>`;
      requestAnimationFrame(() => v.classList.add('pliee'));
      setTimeout(() => rendu.cadrer(etat), 900);
      v.querySelector('button').onclick = () => { v.classList.add('depliee'); setTimeout(() => { v.remove(); resolve(); }, 700); };
    });
  }

  // =====================================================================
  // Publicités (GDD 6.3) : récompensées au choix, coupures aux pauses naturelles
  // =====================================================================
  Ads.surDebut = () => { pause = true; };
  Ads.surFin = () => { pause = false; };
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  function pubsIndicesAujourdhui() { const p = etat.ui.pubs; if (p.jour !== aujourdhui()) { p.jour = aujourdhui(); p.indices = 0; } return p.indices; }
  const seveDoubleActive = () => etat.ui.pubs.seveDoubleFin > etat.temps;
  function coupurePub() {
    const p = etat.ui.pubs, now = Date.now();
    if (Ads.enCours || now - sessionDebut < 120000 || now - (p.coupure || 0) < 180000) return;
    if (actionChoisie !== 'observer' || panneau.classList.contains('ouvert')) return;
    p.coupure = now;
    Ads.coupure(T('bonus.pub_interstitielle'));
  }
  function indicePub(id) {
    if (pubsIndicesAujourdhui() >= 3) return;
    Ads.recompense(T('bonus.pub_simulee')).then(ok => {
      if (!ok) return;
      etat.ui.pubs.indices++;
      revelerIndice(id);
      toast(T('bonus.pub_fin'));
      if (panneauMaj) panneauMaj();
    });
  }
  function ouvrirBonus() { ouvrirPanneau(dessinerBonus, 'bonus'); }
  function dessinerBonus() {
    const p = etat.ui.pubs, now = Date.now(), m = Core.meteo(etat, data);
    const items = [];
    const attentePluie = 600000 - (now - (p.pluie || 0));
    items.push({ id: 'pluie', titre: T('bonus.pluie'), aide: T('bonus.pluie_aide'), dispo: attentePluie <= 0, etat: attentePluie > 0 ? T('bonus.attente', { minutes: Math.ceil(attentePluie / 60000) }) : '' });
    const pleine = etat.seve >= Core.reserveMax(etat) * 0.9;
    items.push({ id: 'seve_double', titre: T('bonus.seve_double'), aide: T('bonus.seve_double_aide'), dispo: !seveDoubleActive() && !pleine, etat: seveDoubleActive() ? T('bonus.actif', { minutes: Math.ceil((p.seveDoubleFin - etat.temps) / 60) }) : pleine ? T('bonus.reserve_pleine') : '' });
    const prolongeable = m.actif && (m.actif.id === 'floraison' || m.actif.id === 'orage');
    const cleEv = m.actif ? m.actif.id + ':' + etat.meteo.actif.debut : '';
    items.push({ id: 'prolonger', titre: T('bonus.prolonger'), aide: T('bonus.prolonger_aide', { evenement: m.actif ? nomEv(m.actif.id) : '…' }), dispo: prolongeable && p.prolonge !== cleEv, etat: prolongeable ? (p.prolonge === cleEv ? T('bonus.indisponible') : '') : T('bonus.indisponible') });
    let h = `<h2>${T('bonus.titre')}</h2><p class="sous">${T('bonus.explication')}</p>`;
    for (const it of items) h += `<div class="bonus-item"><div><b>${it.titre}</b><p>${it.aide}</p>${it.etat ? `<small>${it.etat}</small>` : ''}</div><button type="button" class="petit" data-b="${it.id}"${it.dispo ? '' : ' disabled'}>${ICONES.bonus}${T('bonus.regarder')}</button></div>`;
    contenu.innerHTML = h;
    contenu.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => bonus(b.dataset.b); });
  }
  function bonus(id) {
    Ads.recompense(T('bonus.pub_simulee')).then(ok => {
      if (!ok) return;
      const p = etat.ui.pubs;
      if (id === 'pluie') {
        p.pluie = Date.now();
        for (const i of Core.tuilesIle(etat)) { const t = etat.tuiles[i]; if (t.c !== 'eau') t.h = Math.min(100, t.h + 30); }
        etat.meteo.humidite = Math.min(30, (etat.meteo.humidite || 0) + 30); // l'air reste humide, puis revient à la normale en un jour
      } else if (id === 'seve_double') p.seveDoubleFin = etat.temps + 600;
      else if (id === 'prolonger' && etat.meteo.actif) {
        const a = etat.meteo.actif, finSaison = (Math.floor(etat.temps / (Core.P.joursParSaison * Core.P.dureeJour)) + 1) * Core.P.joursParSaison * Core.P.dureeJour;
        a.fin = Math.max(a.fin, Math.min(a.fin + Core.P.dureeJour, finSaison - 5));
        p.prolonge = a.id + ':' + a.debut;
      }
      toast(T('bonus.pub_fin'), { classe: 'or' });
      if (panneauMaj) panneauMaj();
      majHaut();
    });
  }

  // ---------- Retour après une absence (GDD 6.2) ----------
  function retourHorsLigne(secondes) {
    const avant = etat.journal.length;
    rapportRetour = Core.horsLigne(etat, data, secondes);
    for (const j of etat.journal.slice(avant)) j.vu = 1;
    for (const id of rapportRetour.nouvelles) { observer(id, 'arrivee'); etat.ui.nouvelleT = etat.temps; }
    reconnaitrePlantes(true);
    ouvrirPanneau(dessinerRetour, 'retour');
  }
  function dessinerRetour() {
    const r = rapportRetour;
    if (!r) return fermerPanneau();
    const noms = r.nouvelles.map(nomEsp);
    let h = `<div class="odile-tete"><img alt="" src="${vignette('odile')}"><h2>${T('retour.titre')}</h2></div><p>${T('retour.duree', { duree: duree(r.duree) })}${r.plafonne ? ' ' + T('retour.plafond') : ''}</p>`
      + `<p class="gros">${ICONES.seve} ${T('retour.seve', { nombre: nombre(r.seve * (r.double ? 2 : 1)) })}</p>`
      + (r.plein ? `<p class="sous">${T('retour.plein', { max: nombre(Core.reserveMax(etat)) })}</p>` : '')
      + `<p>${noms.length ? T('retour.especes', { liste: noms.join(', ') }) : T('retour.aucune_espece')}</p>`;
    if (r.nouvelles.length) h += '<div class="grille petite">' + r.nouvelles.map(id => `<div class="carte-esp venue"><img alt="" src="${vignette(id)}"><b>${echapper(nomEsp(id))}</b></div>`).join('') + '</div>';
    if (noms.length) h += `<p class="sous">${echapper(TX('garde.alertes.retour_hors_ligne', { nombre: noms.length }))}</p>`;
    h += '<div class="boutons">';
    if (!r.double && r.seve > 0) h += `<button type="button" class="petit doubler">${ICONES.bonus}${T('retour.doubler')}</button>`;
    h += `<button type="button" class="grand continuer">${T('boutons.continuer')}</button></div>`;
    contenu.innerHTML = h;
    const d = contenu.querySelector('.doubler');
    if (d) d.onclick = () => Ads.recompense(T('bonus.pub_simulee')).then(ok => { if (ok) { Core.doublerRetour(etat, r); majHaut(); dessinerRetour(); } });
    contenu.querySelector('.continuer').onclick = () => { rapportRetour = null; fermerPanneau(); };
  }

  // ---------- Réglages ----------
  function ouvrirReglages() { ouvrirPanneau(dessinerReglages, 'reglages'); }
  function dessinerReglages() {
    contenu.innerHTML = `<h2>${T('boutons.reglages')}</h2>`
      + `<div class="ligne"><span>${T('boutons.langue')}</span><button type="button" class="petit${langue === 'fr' ? ' actif' : ''}" data-l="fr">Français</button><button type="button" class="petit${langue === 'en' ? ' actif' : ''}" data-l="en">English</button></div>`
      + `<div class="ligne"><span>${T('boutons.vitesse')}</span><button type="button" class="petit${vitesse === 1 ? ' actif' : ''}" data-v="1">×1</button><button type="button" class="petit${vitesse === 3 ? ' actif' : ''}" data-v="3">×3</button></div>`
      + `<div class="ligne mesure"><span>${T('mesure.titre')}</span><b class="fps"></b><small class="sous">${T('mesure.aide')}</small></div>`
      + `<div class="ligne"><button type="button" class="petit nouvelle">${T('boutons.nouvelle_partie')}</button></div>`;
    majFps();
    contenu.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => changerLangue(b.dataset.l); });
    contenu.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => { vitesse = +b.dataset.v; majHaut(); dessinerReglages(); }; });
    contenu.querySelector('.nouvelle').onclick = () => {
      const l = contenu.querySelector('.nouvelle').parentNode;
      l.innerHTML = `<span>${T('boutons.confirmer_nouvelle')}</span><button type="button" class="petit oui">${T('boutons.oui')}</button><button type="button" class="petit non">${T('boutons.non')}</button>`;
      l.querySelector('.oui').onclick = () => { nouvellePartie(); rendu.cadrer(etat); construireBarre(); fermerPanneau(); fileOdile = []; fermerOdile(); majFil(); majHaut(); sauver(); };
      l.querySelector('.non').onclick = dessinerReglages;
    };
  }
  // Mesure des images par seconde (sprint 5 bis) : moyenne lissée, et la pire seconde des 30 dernières.
  const fpsSecondes = []; let fpsCompte = 0, fpsDebut = 0;
  function compterImage(now) {
    if (!fpsDebut) fpsDebut = now;
    fpsCompte++;
    if (now - fpsDebut >= 1000) { fpsSecondes.push(fpsCompte * 1000 / (now - fpsDebut)); if (fpsSecondes.length > 30) fpsSecondes.shift(); fpsCompte = 0; fpsDebut = now; majFps(); }
  }
  function majFps() {
    const b = contenu.querySelector('.fps');
    if (!b) return;
    const moy = fpsSecondes.length ? fpsSecondes.reduce((a, v) => a + v, 0) / fpsSecondes.length : fps;
    const min = fpsSecondes.length ? Math.min(...fpsSecondes) : fps;
    b.textContent = T('mesure.detail', { fps: Math.round(moy), min: Math.round(min), dpr: (Math.min(window.devicePixelRatio || 1, rendu.dprMax || 2)).toFixed(1) });
  }
  window.biomeFps = () => ({ moyenne: fpsSecondes.length ? fpsSecondes.reduce((a, v) => a + v, 0) / fpsSecondes.length : fps, secondes: fpsSecondes.slice() });
  function changerLangue(l) {
    langue = l;
    try { localStorage.setItem(CLE_LANGUE, l); } catch (e) { /* rien */ }
    document.documentElement.lang = l;
    for (const [id, b] of Object.entries(boutonsMenu)) { b.querySelector('.etiquette').textContent = T('boutons.' + id); b.title = T('boutons.' + id); }
    for (const r of Object.keys(chips)) chips[r].parentNode.title = T('ressources.' + r);
    chips.seve.parentNode.title = '';
    construireBarre(); majHaut();
    if (panneauMaj) panneauMaj();
  }

  // =====================================================================
  // Boucle
  // =====================================================================
  let lents = 0;
  let avant = performance.now(), dernierLent = 0, dernierSauve = Date.now(), derniereImage = Date.now(), fps = 60, dernierReglage = 0;
  let survolTuile = null, survolCle = '', survolOk = true;
  function boucle(now) {
    const dt = Math.max(0, Math.min(0.1, (now - avant) / 1000)); avant = now;
    // Onglet caché puis revenu : l'absence compte comme du temps hors ligne (pas de départ, pas d'événement).
    const reel = Date.now();
    if (reel - derniereImage > 60000 && !rapportRetour) retourHorsLigne((reel - derniereImage) / 1000);
    derniereImage = reel;
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    compterImage(now);
    if (now > 4000 && now - dernierReglage > 3000 && fps < 45 && rendu.dprMax > 1) { rendu.dprMax = Math.max(1, rendu.dprMax - 0.5); dernierReglage = now; }
    if (!pause && !rapportRetour) {
      const s0 = etat.seve;
      Core.tick(etat, data, dt * vitesse);
      if (seveDoubleActive() && etat.seve > s0) Core.ajouterProduction(etat, etat.seve - s0);
      lireJournal();
    }
    // Survol : tuile visée et aperçu de la pose (contour rouge si elle ne marcherait pas).
    let sv = null;
    if (survol) sv = rendu.tuileSous(survol.sx, survol.sy);
    else if (dernierTap && Date.now() < dernierTap.fin) sv = dernierTap;
    else if (tuileOuverte) sv = tuileOuverte;
    if (sv) {
      const cle = sv.x + ',' + sv.y + ',' + actionChoisie + ',' + Math.floor(etat.temps);
      if (cle !== survolCle) { survolCle = cle; survolOk = actionChoisie === 'observer' || apercu(actionChoisie, sv.x, sv.y); }
      const a = data.actions[actionChoisie];
      survolTuile = { x: sv.x, y: sv.y, taille: a && a.taille > 1 ? a.taille : 1, refus: !survolOk };
    } else survolTuile = null;
    avancerCamera(dt);
    rendu.dessiner(etat, dt, { survol: survolTuile, guides: guideTuiles });
    placerMain();
    majEtiquettes();
    if (survol) canvas.style.cursor = actionChoisie !== 'observer' ? 'crosshair' : rendu.cibleSous(survol.sx, survol.sy) ? 'pointer' : 'grab';
    if (now - dernierLent > 500) {
      dernierLent = now;
      lents++;
      if (lents % 2 === 0) { reconnaitrePlantes(false); tutoriel(); majGuide(); }
      if (lents % 10 === 0) observerPlantes();
      majHaut();
      majPanneauTuile();
      if (panneauMaj && panneau.classList.contains('ouvert') && !panneau.classList.contains('retour') && !panneau.classList.contains('reglages')) {
        // Rafraîchit le panneau ouvert sans perdre le défilement.
        const sc = contenu.scrollTop;
        if (panneau.classList.contains('carnet')) majIndices();
        panneauMaj(); contenu.scrollTop = sc;
      }
      if (odileFin && Date.now() > odileFin) fermerOdile();
    }
    if (reel - dernierSauve > 10000) { dernierSauve = reel; sauver(); }
    requestAnimationFrame(boucle);
  }
  window.addEventListener('pagehide', sauver);
  document.addEventListener('visibilitychange', () => { if (document.hidden) sauver(); });

  // ---------- Démarrage ----------
  const q = new URLSearchParams(location.search);
  document.documentElement.lang = langue;
  if (q.has('nouvelle') || !charger()) nouvellePartie(q.has('graine') ? +q.get('graine') : 0);
  rendu.cadrer(etat);
  construireBarre();
  majFil();
  majHaut();
  majGuide();
  saisonVue = Core.horloge(etat).saison;
  // Accès pour les tests automatiques (tools/test-jeu.js).
  window.BIOME_JEU = {
    get etat() { return etat; }, set etat(e) { etat = Core.completer(e); etat.ui = Object.assign(uiDefaut(), etat.ui || {}); marquerVu(); rendu.cadrer(etat); construireBarre(); majHaut(); },
    rendu, clic, choisirAction, poser, photographier, ouvrirCarnet, ouvrirMissions, ouvrirSuccession, ouvrirBonus, ouvrirReglages, fermerPanneau,
    passerEtape, retourHorsLigne, changerLangue, sauver, vignette, majIndices, majGuide, get guide() { return etat.ui.guide; },
    get vitesse() { return vitesse; }, set vitesse(v) { vitesse = v; },
  };
  requestAnimationFrame(boucle);
})();
