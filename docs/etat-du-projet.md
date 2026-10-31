# Biome, la forêt de papier : état du projet

Une copie de cette note est dans le dépôt GitHub (`docs/etat-du-projet.md`, avec `docs/idees-gameplay-agir.md`), pour les sessions Claude qui n'ont pas accès au projet claude.ai. Toute session met à jour les deux quand elle le peut ; une session sans accès au projet met à jour la copie du dépôt et le signale à Christophe.

Dernière mise à jour : 31 octobre 2026 (17 h, sprint 7 lancé)

## Décisions prises
- Jeu de gestion d'écosystème de forêt, style origami (3D à facettes, couleurs de papier unies).
- Cibles : web d'abord (portails Poki / CrazyGames, revenus pub), puis Roblox (îlots multijoueurs, achats en jeu).
- Christophe : direction créative, tests, décisions. Ne fait pas de commercial.
- **Document de conception v2** (référence, version 1.6) : `docs/gdd-biome-v2.md` dans ce dépôt (document entier, le plus à jour). Dans le projet claude.ai, il est coupé en deux (`claude/gdd-biome-v2.md` et `claude/gdd-biome-v2-prototype.md`).
- Décisions de design du 30/10 : grille de tuiles ; hors ligne plafonné à 8 h ; pas de mort ni d'extinction (une espèce part et peut revenir) ; Lisière en ~15 min, Forêt ancienne en 3 à 5 h ; incendie gardé (GDD 5.2, désactivable) ; prédation visible et stylisée (froissement de papier) ; monnaie « sève » ; missions données par la garde forestière (GDD 1.9) ; Roblox : 6 joueurs par serveur, maximiser les achats sans tirage opaque (GDD 7.4).
- Exceptions validées par Christophe (30/10) : le tircis a 4 besoins au lieu de 3 ; règles hors schéma notées par ChatGPT dans `chatgpt/especes-prairie-lisiere-notes.md` (codées au sprint 2).
- **Décisions du 31/10 (sprint 7)** : pistes de gameplay validées dans l'ordre : 1) l'île se dérègle et on répare, avec les coups de pouce actifs ; 2) l'endroit où l'on pose compte (carte des habitats, voisinages) ; 3) les habitants demandent ; piste 5 (voir l'effet de chaque geste) au fil de l'eau. Choix de Claude du sprint 6 validés (textes du guide écrits par Claude en FR et EN, réactions d'Odile dans le journal). Graphismes : passage à WebGL (Three.js) juste après le sprint 7, aucune retouche graphique d'ici là. Voir GDD section 11.
- **Une seule tâche à la fois (décision de Christophe, 30/10)** : jamais de travail en parallèle entre Claude et ChatGPT. Chaque étape est finie avant de lancer la suivante, et Christophe n'a jamais plus d'une action en attente.

## Dépôt commun GitHub (depuis le 30/10)
- **https://github.com/christopherivoal-sudo/biome-foret-papier** (public). Claude y lit et écrit ; ChatGPT y lit et écrit.
- `docs/` : GDD, cette note, idées de gameplay. `consignes/` : tâches pour ChatGPT. `chatgpt/` : réponses de ChatGPT (seul dossier où il écrit). `data/` : données validées. `src/` : code. `tools/` : outils Node. `dist/` : fichiers construits (non suivis).
- **Circuit** : Claude écrit une consigne dans `consignes/` et donne à Christophe une phrase courte à coller dans ChatGPT (« Lis et exécute la consigne consignes/XX.md du dépôt GitHub christopherivoal-sudo/biome-foret-papier. »). ChatGPT écrit dans `chatgpt/` et répond en une ligne. Christophe dit à Claude « c'est fait » ; Claude lance `node tools/integrer.js` (validation automatique puis copie dans `data/`).
- Christophe ne manipule aucun fichier.
- Note technique : dans une nouvelle session Claude, le dépôt doit être ajouté aux sources de la session pour pouvoir pousser (Claude le fait lui-même).

## Organisation du travail (Claude + ChatGPT)
Christophe a un abonnement Claude Pro (quota limité) et un abonnement ChatGPT. On répartit les tâches pour économiser le quota Claude.

**Règle d'or** : ChatGPT produit du contenu selon un format défini par Claude ; Claude intègre et vérifie automatiquement. ChatGPT n'écrit pas le code du jeu.

- **ChatGPT (contenu)** : fiches espèces JSON, textes, traduction anglaise, missions, premières tables d'équilibrage, idées d'événements, recherche marché.
- **Claude (architecte, intégrateur)** : GDD et formats de données, code, validation, tests et équilibrage par simulation, consignes.
- **Christophe (directeur)** : choix de design, tests de jeu, retours ; colle les phrases courtes dans ChatGPT.

**Méthode** : sprints courts, une nouvelle conversation par étape ; chaque conversation commence par lire cette note et se termine par sa mise à jour. Les étapes s'enchaînent l'une après l'autre.

## Prototype v1 (fait)
- Jeu publié : https://claude.ai/artifact/AhgzfuWSCGZssWjQuGrdx3. Son code n'est pas dans le dépôt ; son moteur 3D et ses modèles ont été repris au sprint 4.

## Sprints 1 à 5 bis (faits, 30 et 31/10)
- Sprint 1 : `tools/validate.js`, `tools/integrer.js`, `data/` complet ; `src/core.js` v2.
- Sprint 2 (commit 08de3f3) : écologie complète, `data/equilibrage.json`, `tools/sim-headless.js`.
- Sprint 3 (commit 3430e53) : événements, papiers journal et washi, hors ligne 8 h.
- Sprint 4 (commits ea56166 à 2c6bf75) : rendu origami. Vitrine : https://claude.ai/artifact/RW6C6Uf4TZtzdV8codzb88.
- Sprint 5 (commits 1c01a0a et c7c6b13) : interface jouable en français et en anglais.
- Sprint 5 bis (commit f268ffb) : économie de la sève, sécheresse durcie, chêne teaser, images/s.
- Choix de Claude encore à valider en jouant : 1 page par comportement observé ; passage d'étape par bouton ; coupures pub au changement de saison ; condition d'ombre du teaser remplacée par « mi-ombre sur 10 % ».

## Sprint 6 : retours de Christophe (31/10, commits 6882013, 903773c, 8c1609f, b4bfe1d, 5c88999)
- **Le jeu jouable est ici : https://claude.ai/artifact/UXJUMd5SPczSYnJtdT3uhS** (identifiant interne `dee1d2ff-197e-4fa7-a674-0fabc48be729`, à utiliser pour republier au même endroit avec l'outil de publication d'artefacts : `publish_files` avec ce slug et la version en ligne comme `base_version`). L'ancienne adresse (https://claude.ai/artifact/CuhXG5hRGfNBF9xoj618aM) garde la version du sprint 5 bis.
- Version affichée dans les Réglages (constante `VERSION` dans `src/game.js`, 6.4 aujourd'hui ; l'augmenter à chaque publication) ; « Nouvelle version chargée » au lancement après une mise à jour. La partie en cours est gardée (sauvegarde du navigateur) ; « Nouvelle partie » dans les Réglages pour recommencer.
- Retours 1 : barre du bas compacte ; cône sombre sous l'île retiré ; pose en glissant ; une seule bulle à la fois ; guide en 7 étapes avec main, tuiles dorées et caméra qui montre l'espèce venue ; caméra plus proche, glisser déplace la vue ; graphismes (herbe verte, animaux +35 %).
- Retours 2 : herbe à 3 sève, plus productive (0,015 sève/s) et qui s'étend plus vite ; 60 % d'herbe en 3 min au lieu de 7 ; débit de sève affiché.
- Retours 3 : bouton « Récolter (n) » ; bouleaux adultes en 20 min (au lieu de 48), croissance et blocage affichés ; bug des bulles invisibles qui captaient les clics corrigé ; sol adouci, île lisible de loin.
- Retours 4 (navigation) : molette qui zoome vers le curseur, pince qui zoome vers les doigts, double-clic ou double toucher pour plonger vers un point, glissé avec inertie, inclinaison qui suit le zoom, île centrée dans l'espace libre entre les barres.
- **Choix de Claude** (validés le 31/10) : textes du guide et des nouvelles aides écrits directement en français et en anglais par Claude ; réactions d'Odile aux espèces dans le journal du carnet plutôt qu'en bulle.
- **Limite connue des graphismes** : le moteur dessine des facettes plates en Canvas 2D. Pour un vrai saut de qualité, il faudrait passer le rendu en WebGL (Three.js) : chantier d'environ 3 sprints.
- Tests : 167 (`core.js`), 542 (modèles), 43 vérifications dans le navigateur, sans erreur.

## En cours
Sprint 7 (gameplay actif), par Claude.

## Questions ouvertes
- Aucune pour le moment (gameplay et graphismes tranchés le 31/10).

## Prochaines étapes, dans l'ordre
1. **Sprint 7 : gameplay actif** (en cours).
2. **Sprint 8 : rendu WebGL avec Three.js** (environ 3 sprints).
