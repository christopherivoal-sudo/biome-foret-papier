# Biome, la forêt de papier

Jeu de gestion d'écosystème en papier plié (web puis Roblox). Dépôt commun à Claude (architecte, code) et ChatGPT (contenu).

## Organisation
- `docs/` : document de conception (GDD). Référence pour tout le monde.
- `consignes/` : tâches pour ChatGPT, écrites par Claude. Une consigne = un fichier.
- `chatgpt/` : réponses de ChatGPT. **ChatGPT n'écrit que dans ce dossier.**
- `data/` : données validées (espèces, textes, aménagements, étapes, missions, événements, papiers rares). Claude uniquement.
- `src/` : code du jeu. Claude uniquement. `core.js` : simulation pure ; `engine.js` : moteur 3D « papier plié » (Canvas 2D) ; `models.js` : modèles origami générés par le code ; `rendu.js` : dessin de l'île à partir de l'état ; `vitrine.js` : page de démonstration du rendu (remplacée par l'interface au sprint 5).
- `tools/` : `validate.js` (vérification des données), `integrer.js` (copie chatgpt/ → data/ après validation), `test-core.js` (tests de la simulation), `sim-headless.js` (parties simulées avec un joueur automatique, pour l'équilibrage), `construire.js` (assemble la page en un seul fichier HTML), `test-modeles.js`, `test-rendu.js` et `planche.js` (contrôle des modèles et du rendu).
- `dist/` : fichiers construits (non suivis par git).
- `data/equilibrage.json` : réglages d'équilibrage de Claude, appliqués par-dessus les fiches (une nouvelle intégration ne les efface pas).

## Commandes (Node 18+)
```
node tools/validate.js          # vérifie data/
node tools/integrer.js          # valide puis intègre les fichiers de chatgpt/
node tools/test-core.js         # tests de src/core.js
node tools/sim-headless.js      # 20 parties d'1 h simulées : rythme, venues, départs, événements, papiers rares, retour hors ligne
node tools/sim-headless.js --minutes 120   # 2 h : sécheresse et foudre (elles n'arrivent qu'à partir de l'année 1)
node tools/test-modeles.js      # modèles origami : géométrie, budget de faces, couleurs des fiches
node tools/construire.js        # dist/jeu.html (le jeu) ; --vitrine : dist/vitrine.html (île jouée par le joueur automatique + galerie)
node tools/test-rendu.js        # ouvre la vitrine dans Chromium (Playwright requis) : erreurs, captures dans dist/captures/
node tools/test-rendu.js --perf # temps par image sur un téléphone simulé (processeur ×4, 30 animaux)
node tools/planche.js [journal|washi] [ids]   # planche des modèles, de près
```

La vitrine accepte des paramètres d'adresse : `?mode=galerie&papier=washi`, `?scene=2&saison=hiver&moment=nuit&meteo=orage&vitesse=3`.

## Règles pour ChatGPT
1. Lire la consigne demandée dans `consignes/`, puis le GDD si besoin.
2. Écrire le résultat complet dans le fichier indiqué par la consigne, dans `chatgpt/`.
3. Dans la conversation, répondre en une ligne (« Fait : chemin du fichier »), sans afficher le contenu.
4. Ne jamais modifier les autres dossiers.
