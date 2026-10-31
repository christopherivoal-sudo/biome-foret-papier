// Biome, la forêt de papier : vitrine du rendu (sprint 4). Page de démonstration, remplacée par game.js au sprint 5.
// Mode « Île » : une partie réelle de core.js (scènes jouées par le joueur automatique) qui continue de vivre ;
// saison, moment et météo peuvent être forcés pour le regard seulement (la simulation n'est pas modifiée).
// Mode « Galerie » : tous les modèles origami, dans leurs variantes, en papier normal, journal ou washi.
(function () {
  'use strict';
  const Core = window.BiomeCore, E = window.BiomeEngine, Modeles = window.BiomeModels;
  const DATA = window.BIOME_DATA, SCENES = window.BIOME_SCENES;
  const data = Core.preparer(DATA);
  const canvas = document.getElementById('scene');
  const rendu = window.BiomeRendu.creer(canvas, DATA, Core);
  const cam = rendu.camera;
  const NOMS = {}; for (const id in DATA.textes.fr.especes) NOMS[id] = DATA.textes.fr.especes[id].nom;

  const reglages = { mode: 'ile', scene: 2, saison: 'auto', moment: 'auto', meteo: 'auto', vitesse: 1, papier: '' };
  let etat = null;
  function chargerScene(k) {
    reglages.scene = k;
    etat = JSON.parse(JSON.stringify(SCENES[k].etat));
    rendu.cadrer(etat);
    majBoutons();
  }

  // ---------- Barre de réglages ----------
  const barre = document.getElementById('reglages');
  const GROUPES = [
    { cle: 'mode', titre: 'Vue', choix: [['ile', 'Île'], ['galerie', 'Galerie']] },
    { cle: 'scene', titre: 'Partie', choix: SCENES.map((s, k) => [k, s.nom]), ile: true },
    { cle: 'saison', titre: 'Saison', choix: [['auto', 'Auto'], ['printemps', 'Printemps'], ['ete', 'Été'], ['automne', 'Automne'], ['hiver', 'Hiver']], ile: true },
    { cle: 'moment', titre: 'Moment', choix: [['auto', 'Auto'], ['jour', 'Jour'], ['crepuscule', 'Crépuscule'], ['nuit', 'Nuit']], ile: true },
    { cle: 'meteo', titre: 'Météo', choix: [['auto', 'Auto'], ['aucun', 'Aucune'], ['floraison', 'Floraison'], ['orage', 'Orage'], ['secheresse', 'Sécheresse']], ile: true },
    { cle: 'vitesse', titre: 'Vitesse', choix: [[0, 'Pause'], [1, '×1'], [3, '×3'], [10, '×10']], ile: true },
    { cle: 'papier', titre: 'Papier', choix: [['', 'Normal'], ['journal', 'Journal'], ['washi', 'Washi']], galerie: true },
  ];
  const boutons = [];
  for (const g of GROUPES) {
    const d = document.createElement('div'); d.className = 'groupe'; d.dataset.ile = g.ile ? 1 : ''; d.dataset.galerie = g.galerie ? 1 : '';
    const t = document.createElement('span'); t.textContent = g.titre; d.appendChild(t);
    for (const [v, nom] of g.choix) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = nom;
      b.addEventListener('click', () => {
        if (g.cle === 'scene') chargerScene(v); else reglages[g.cle] = v;
        if (g.cle === 'mode') { if (v === 'galerie') cadrerGalerie(); else rendu.cadrer(etat); }
        majBoutons();
      });
      boutons.push({ g, v, b }); d.appendChild(b);
    }
    barre.appendChild(d);
  }
  function majBoutons() {
    for (const o of boutons) o.b.classList.toggle('actif', reglages[o.g.cle] === o.v);
    for (const d of barre.children) d.style.display = (d.dataset.ile && reglages.mode !== 'ile') || (d.dataset.galerie && reglages.mode !== 'galerie') ? 'none' : '';
  }

  // ---------- Caméra : glisser pour tourner, molette ou pincement pour zoomer ----------
  const pointeurs = {};
  let glisse = null, pince = null, survol = null;
  canvas.addEventListener('pointerdown', ev => {
    canvas.setPointerCapture(ev.pointerId);
    pointeurs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    const ids = Object.keys(pointeurs);
    if (ids.length === 2) { const a = pointeurs[ids[0]], b = pointeurs[ids[1]]; pince = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist }; glisse = null; }
    else glisse = { x: ev.clientX, y: ev.clientY, yaw: cam.yaw, pitch: cam.pitch };
  });
  canvas.addEventListener('pointermove', ev => {
    const r = canvas.getBoundingClientRect();
    survol = { sx: ev.clientX - r.left, sy: ev.clientY - r.top };
    if (!pointeurs[ev.pointerId]) return;
    pointeurs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    const ids = Object.keys(pointeurs);
    if (pince && ids.length === 2) { const a = pointeurs[ids[0]], b = pointeurs[ids[1]]; cam.dist = Math.max(6, Math.min(70, pince.dist * pince.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)))); return; }
    if (glisse) {
      cam.yaw = glisse.yaw - (ev.clientX - glisse.x) * 0.008;
      cam.pitch = Math.max(0.35, Math.min(1.35, glisse.pitch + (ev.clientY - glisse.y) * 0.006));
    }
  });
  const fin = ev => { delete pointeurs[ev.pointerId]; if (Object.keys(pointeurs).length < 2) pince = null; if (!Object.keys(pointeurs).length) glisse = null; };
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  canvas.addEventListener('pointerleave', () => { survol = null; });
  canvas.addEventListener('wheel', ev => { ev.preventDefault(); cam.dist = Math.max(6, Math.min(70, cam.dist * (ev.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });

  // ---------- Galerie ----------
  const M = rendu.modeles, G = Modeles.galerie(M), R3 = rendu.moteur;
  const COLS = 5, LARGEUR = 4.4, PROF = 3.2;
  function cadrerGalerie() { const asp = canvas.clientWidth / Math.max(1, canvas.clientHeight); cam.dist = asp < 1 ? 46 : 27; cam.pitch = 0.98; cam.yaw = 0; cam.tx = 0; cam.tz = 1.2; }
  let tg = 0;
  function dessinerGalerie(dt) {
    tg += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight, ctx = R3.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#efe7d6'; ctx.fillRect(0, 0, w, h);
    cam.update(w, h);
    R3.teinte = null;
    const lignes = Math.ceil(G.length / COLS), x0 = -(COLS - 1) * LARGEUR / 2, z0 = -(lignes - 1) * PROF / 2;
    const etiquettes = [];
    // Cartons sous chaque modèle.
    G.forEach((g, k) => {
      const cx = x0 + (k % COLS) * LARGEUR, cz = z0 + Math.floor(k / COLS) * PROF;
      R3.groundPoly([cx - 2.1, cz - 1.45, cx + 2.1, cz - 1.45, cx + 2.1, cz + 1.45, cx - 2.1, cz + 1.45], k % 2 ? '#e4d9c3' : '#e9dfcb', 'rgba(150,130,100,0.35)', 1, 0);
    });
    R3.begin();
    G.forEach((g, k) => {
      const cx = x0 + (k % COLS) * LARGEUR, cz = z0 + Math.floor(k / COLS) * PROF, n = g.variantes.length;
      const pas = Math.min(1.3, 3.8 / n);
      g.variantes.forEach(([nom, mesh], j) => {
        const x = cx + (j - (n - 1) / 2) * pas;
        R3.add(mesh, x, g.id === 'nichoir' ? 0.25 : 0, cz, tg * 0.6 + j, g.taille * (n > 3 ? 1.05 : 1.3), undefined, reglages.papier ? { papier: reglages.papier } : undefined);
      });
      etiquettes.push({ x: cx, z: cz + 1.25, t: g.nom });
    });
    const n = R3.flush();
    const tmp = [0, 0, 0];
    ctx.textAlign = 'center'; ctx.font = '600 13px Georgia, serif'; ctx.fillStyle = '#4d3f30';
    for (const e of etiquettes) { cam.project(e.x, 0, e.z, tmp); ctx.fillText(e.t, tmp[0], tmp[1]); }
    return n;
  }

  // ---------- Infos ----------
  const info = document.getElementById('info'), bulle = document.getElementById('bulle');
  const SAISONS = { printemps: 'printemps', ete: 'été', automne: 'automne', hiver: 'hiver' };
  const COUVERTS = { nu: 'sol nu', herbe: 'herbe', fleurs: 'fleurs', ronce: 'ronce', arbre: 'bouleau', eau: 'mare', roche: 'roche', bois_mort: 'bois mort', amenagement: 'aménagement' };
  const AMENAGEMENTS = { tas_pierres: 'tas de pierres', hotel_insectes: 'hôtel à insectes', tas_bois: 'tas de bois', mare: 'mare' };
  let fps = 60, dernierInfo = 0;
  function majInfo(res, now) {
    if (now - dernierInfo < 400) return;
    dernierInfo = now;
    if (reglages.mode === 'galerie') { info.textContent = `${G.length} modèles · ${res} faces affichées · ${fps.toFixed(0)} images/s`; bulle.style.display = 'none'; return; }
    const h = Core.horloge(etat), m = Core.meteo(etat, data), r = Core.raresPresents(etat, data);
    const esp = Core.especesPresentes(etat, data).map(id => NOMS[id] || id);
    info.innerHTML = `<b>Année ${h.annee + 1}, ${SAISONS[h.saison]}, jour ${h.jour % 3 + 1}</b> · ${m.actif ? 'événement : ' + m.actif.id : m.annonce ? 'annonce : ' + m.annonce.id : 'temps calme'}`
      + ` · ${esp.length} espèces · ${etat.agents.length} animaux · ${r.length} spécimen${r.length > 1 ? 's' : ''} rare${r.length > 1 ? 's' : ''}`
      + ` · ${res.polygones} faces · ${fps.toFixed(0)} images/s${rendu.dprMax < 2 ? ' (définition ' + rendu.dprMax + ')' : ''}<br><span>${esp.join(', ')}</span>`;
    if (survol) {
      const t = rendu.tuileSous(survol.sx, survol.sy);
      const tu = t && Core.dansIle(etat, t.x, t.y) ? etat.tuiles[t.y * Core.N + t.x] : null;
      if (tu) {
        let nom = tu.a ? AMENAGEMENTS[tu.a] || tu.a : COUVERTS[tu.c] || tu.c;
        if (tu.naturel) nom = 'bouleau foudroyé (bois mort)';
        const extra = [tu.paillis > 0 ? 'paillis' : '', tu.nichoir ? 'nichoir' : '', tu.champi ? 'coulemelle' : '', tu.graines >= 1 ? Math.floor(tu.graines) + ' graine(s) à récolter' : ''].filter(Boolean).join(', ');
        bulle.innerHTML = `<b>${nom}</b>${extra ? ' · ' + extra : ''}<br>Fertilité ${Math.round(tu.f)} · Humidité ${Math.round(tu.h)} · Ombre ${Math.round(tu.o)}`;
        bulle.style.display = 'block'; bulle.style.left = (survol.sx + 14) + 'px'; bulle.style.top = (survol.sy + 14) + 'px';
      } else bulle.style.display = 'none';
    } else bulle.style.display = 'none';
  }

  // ---------- Boucle ----------
  let avant = performance.now(), dernierReglage = 0;
  function boucle(now) {
    const dt = Math.max(0, Math.min(0.1, (now - avant) / 1000)); avant = now;
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    // Qualité automatique : si l'appareil peine, on dessine moins de pixels (jamais sous 1 pixel par point).
    if (now > 4000 && now - dernierReglage > 3000 && fps < 45 && rendu.dprMax > 1) { rendu.dprMax = Math.max(1, rendu.dprMax - 0.5); dernierReglage = now; }
    let res;
    if (reglages.mode === 'galerie') res = dessinerGalerie(dt);
    else {
      if (reglages.vitesse) Core.tick(etat, data, dt * reglages.vitesse);
      const t = survol && rendu.tuileSous(survol.sx, survol.sy);
      res = rendu.dessiner(etat, dt, { saison: reglages.saison, moment: reglages.moment, meteo: reglages.meteo, survol: t });
    }
    majInfo(res, now);
    requestAnimationFrame(boucle);
  }
  // Paramètres d'adresse (captures automatiques) : ?mode=galerie&scene=2&saison=hiver&moment=nuit&meteo=orage&papier=washi
  const q = new URLSearchParams(location.search);
  chargerScene(q.has('scene') ? +q.get('scene') : 2);
  for (const k of ['mode', 'saison', 'moment', 'meteo', 'papier']) if (q.has(k)) reglages[k] = q.get(k);
  if (q.has('vitesse')) reglages.vitesse = +q.get('vitesse');
  if (reglages.mode === 'galerie') cadrerGalerie();
  window.BIOME_VITRINE = { reglages, get etat() { return etat; }, rendu, chargerScene };
  majBoutons();
  requestAnimationFrame(boucle);
})();
