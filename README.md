# Biome, la forêt de papier

Jeu de gestion d'écosystème en papier plié (web puis Roblox). Dépôt commun à Claude (architecte, code) et ChatGPT (contenu).

## Organisation
- `docs/` : document de conception (GDD). Référence pour tout le monde.
- `consignes/` : tâches pour ChatGPT, écrites par Claude. Une consigne = un fichier.
- `chatgpt/` : réponses de ChatGPT. **ChatGPT n'écrit que dans ce dossier.**
- `data/` : données validées (espèces, textes, aménagements, étapes, missions, événements, papiers rares). Claude uniquement.
- `src/` : code du jeu (`core.js` : simulation pure). Claude uniquement.
- `tools/` : `validate.js` (vérification des données), `integrer.js` (copie chatgpt/ → data/ après validation), `test-core.js` (tests de la simulation), `sim-headless.js` (parties simulées avec un joueur automatique, pour l'équilibrage).
- `data/equilibrage.json` : réglages d'équilibrage de Claude, appliqués par-dessus les fiches (une nouvelle intégration ne les efface pas).

## Commandes (Node 18+)
```
node tools/validate.js          # vérifie data/
node tools/integrer.js          # valide puis intègre les fichiers de chatgpt/
node tools/test-core.js         # tests de src/core.js
node tools/sim-headless.js      # 20 parties d'1 h simulées : rythme, venues, départs, événements, papiers rares, retour hors ligne
node tools/sim-headless.js --minutes 120   # 2 h : sécheresse et foudre (elles n'arrivent qu'à partir de l'année 1)
```

## Règles pour ChatGPT
1. Lire la consigne demandée dans `consignes/`, puis le GDD si besoin.
2. Écrire le résultat complet dans le fichier indiqué par la consigne, dans `chatgpt/`.
3. Dans la conversation, répondre en une ligne (« Fait : chemin du fichier »), sans afficher le contenu.
4. Ne jamais modifier les autres dossiers.
