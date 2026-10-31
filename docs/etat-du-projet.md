# Biome, la forêt de papier : état du projet

Une copie de cette note est dans le dépôt GitHub (`docs/etat-du-projet.md`, avec `docs/idees-gameplay-agir.md`), pour les sessions Claude qui n'ont pas accès au projet claude.ai. Toute session met à jour les deux quand elle le peut ; une session sans accès au projet met à jour la copie du dépôt et le signale à Christophe.

Dernière mise à jour : 31 octobre 2026 (21 h 30, travail arrêté par Christophe)

## Décisions prises
- Jeu de gestion d'écosystème de forêt, style origami (3D à facettes, couleurs de papier unies).
- Cibles : web d'abord (portails Poki / CrazyGames, revenus pub), puis Roblox (îlots multijoueurs, achats en jeu).
- Christophe : direction créative, tests, décisions. Ne fait pas de commercial.
- **Document de conception v2** (référence, version 2.0) : `docs/gdd-biome-v2.md` dans ce dépôt (document entier, le plus à jour). Dans le projet claude.ai, il est coupé en deux (`claude/gdd-biome-v2.md` et `claude/gdd-biome-v2-prototype.md`).
- Décisions de design du 30/10 : grille de tuiles ; hors ligne plafonné à 8 h ; pas de mort ni d'extinction (une espèce part et peut revenir) ; Lisière en ~15 min, Forêt ancienne en 3 à 5 h ; incendie gardé (GDD 5.2, désactivable) ; prédation visible et stylisée (froissement de papier) ; monnaie « sève » ; missions données par la garde forestière (GDD 1.9) ; Roblox : 6 joueurs par serveur, maximiser les achats sans tirage opaque (GDD 7.4).
- Exceptions validées par Christophe (30/10) : le tircis a 4 besoins au lieu de 3 ; règles hors schéma notées par ChatGPT dans `chatgpt/especes-prairie-lisiere-notes.md` (codées au sprint 2).
- **Décisions du 31/10 (sprint 7)** : pistes de gameplay validées dans l'ordre : 1) l'île se dérègle et on répare, avec les coups de pouce actifs ; 2) l'endroit où l'on pose compte (carte des habitats, voisinages) ; 3) les habitants demandent ; piste 5 (voir l'effet de chaque geste) au fil de l'eau. Choix de Claude du sprint 6 validés (textes du guide écrits par Claude en FR et EN, réactions d'Odile dans le journal). Graphismes : passage à WebGL (Three.js) juste après le sprint 7, aucune retouche graphique d'ici là. Voir GDD section 11.
- **Décisions du 31/10 au soir (sprint 8)** : choix de Claude du sprint 7 validés (GDD 12.7). Chantier WebGL découpé en 3 sprints : 8a moteur à l'identique avec ombres, 8b rendu papier, 8c vie et mouvement (GDD 10.5) ; les trois sont faits.
- **Action suivante toujours fournie (décision de Christophe, 31/10)** : à la fin de chaque étape, Claude donne à Christophe l'action à faire et le texte exact à coller pour l'étape suivante (dans une nouvelle conversation Claude, ou dans ChatGPT). La rubrique « Action suivante pour Christophe », en fin de note, est tenue à jour.
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

**Méthode** : sprints courts, une nouvelle conversation par étape ; chaque conversation commence par lire cette note et se termine par sa mise à jour, puis par l'action suivante et le texte à coller, donnés à Christophe. Les étapes s'enchaînent l'une après l'autre.

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

## Sprint 8c : vie et mouvement (31/10)
- **Le jeu jouable est maintenant ici : https://claude.ai/artifact/URgRFoWRdTCcS2hCEBTGJ2** (version 8.2 ; identifiant interne `de18e2f9-d09c-483a-98af-25617c844487`, à utiliser pour republier : `publish_files` avec ce slug et la version en ligne comme `base_version`). Nouvelle adresse pour la même raison qu'aux sprints 7 et 8a (une session ne peut modifier que les artefacts qu'elle a créés) : **la partie sauvegardée à l'adresse du 8b ne suit pas**. L'adresse du 8b (https://claude.ai/artifact/BSxyYaND5SGKFJDjbDVikL) garde la version 8.1.
- Détail : **GDD 10.4, « Précisions du sprint 8c »**. En bref : vent calculé par la carte graphique (herbe qui ondule par vagues, fleurs, ronces et bouleaux qui se balancent, ombres comprises ; vent fort à l'orage, air immobile par sécheresse) ; prairie plus dense de près ; aménagements et plantes qui se déplient à la pose comme un livre animé ; passage d'étape en 3D (l'île se replie, le sol redevient une page crème, la caméra tourne, puis tout se redéplie du centre vers le bord) ; qualité automatique en 7 paliers qui baisse et remonte seule (téléphones au palier 3), affichée dans les Réglages ; fichier de 827 Ko au lieu de 1 164 Ko (Three.js réduit aux pièces utilisées, scripts compactés).
- Tests : 194 (`core.js`), 542 (modèles), 52 (interface, Canvas 2D), 28 pour le rendu WebGL, sans erreur. Fluidité réelle non mesurable ici : à vérifier par Christophe, surtout sur téléphone (Réglages : images par seconde et palier).

## Sprint 8b : rendu papier (31/10, commit de999f4)
- Version 8.1 publiée à https://claude.ai/artifact/BSxyYaND5SGKFJDjbDVikL (remplacée par l'adresse du sprint 8c ci-dessus).
- Détail : **GDD 10.4, « Précisions du sprint 8b »**. En bref : grain et fibres du papier sur toutes les faces et le sol ; arêtes de pli (s'effacent de loin) ; ombre de contact au pied des modèles ; eau qui reflète le ciel, avec ondes et étincelles de soleil ; la nuit, lampe de la cabane et étoiles ; effet maquette (haut et bas de l'image légèrement flous) ; qualité qui baisse seule si l'appareil peine (téléphones en qualité 1, sans effet maquette), affichée dans les Réglages, `?qualite=0/1/2` pour la fixer.
- Correction : depuis le 8a, un contour au sol (survol, guide, carte) faisait redimensionner le rendu à chaque image.
- Tests : 194 (`core.js`), 52 (interface, Canvas 2D), 19 pour le rendu WebGL, sans erreur. Fluidité réelle non mesurable ici (pas de carte graphique) : à vérifier par Christophe, surtout sur téléphone.

## Sprint 8a : moteur WebGL (31/10, commit d38a1c1)
- Adresse du jeu aux sprints 8a et 8b : https://claude.ai/artifact/BSxyYaND5SGKFJDjbDVikL (version 8.0, puis 8.1 au sprint 8b ; identifiant interne `549b7a03-19b0-4871-8ca4-89dcfc42ce75`, à utiliser pour republier au même endroit : `publish_files` avec ce slug et la version en ligne comme `base_version`). Nouvelle adresse pour la même raison qu'au sprint 7 : une session ne peut modifier que les artefacts qu'elle a créés ; si une prochaine session rencontre le même refus, elle publie un nouvel artefact et note sa nouvelle adresse ici ; la partie sauvegardée à l'ancienne adresse ne suit pas (sauvegarde du navigateur, propre à chaque adresse). L'adresse du sprint 7 (https://claude.ai/artifact/VARxWAEZVdQc3DgbiLqa2s) garde la version 7.0.
- Détail complet : **GDD 10.4, « Précisions du sprint 8a »**. En bref : Three.js r160 inclus dans le fichier du jeu (`vendor/three/`, `tools/three-global.js`) ; nouveau `src/moteur3d.js` avec la même façon de dessiner que `engine.js` (toute la logique de `rendu.js` est gardée) ; vraies ombres portées douces, soleil qui tourne dans la journée ; pluie, neige et pétales dans la scène ; repli automatique sur le Canvas 2D sans WebGL (`?canvas2d` pour le forcer). Pas encore d'arêtes de pli (sprint 8b).
- Mesures : 3 ms de processeur par image contre 67 ms en Canvas 2D (île de 2 h) ; fichier de 1,1 Mo.
- Tests : 194 (`core.js`), 542 (modèles), 52 vérifications dans le navigateur (interface, en Canvas 2D), 14 pour le rendu WebGL (`tools/test-webgl.js`), sans erreur. Le navigateur de test n'a pas de carte graphique, d'où l'interface testée en Canvas 2D.

## Sprint 7 : gameplay actif (31/10, commits 5722b98, aec73b8 et suivants)
- Version 7.0 publiée à https://claude.ai/artifact/VARxWAEZVdQc3DgbiLqa2s (remplacée par l'adresse du sprint 8a ci-dessus).
- Détail complet : **GDD section 12**. En bref :
  - **L'île se dérègle** : 5 problèmes signalés par un repère « ! » sur l'île (trop de lapins et herbe qui jaunit, ronces qui envahissent la prairie, sol qui sèche, hérisson sans abri d'hiver, renard qui vide le terrier), expliqués par Odile la première fois, avec leurs solutions ; un problème réglé par le joueur rapporte 1 page et 15 sève.
  - **Coups de pouce** dans la barre : Arroser et Graines au sol (Prairie), Tailler et Éloigner le renard (Lisière).
  - **L'endroit compte** : carte des habitats colorée (vert, jaune, gris) quand on choisit un aménagement ; voisinages qui changent les populations (herbe autour du tas de pierres, fleurs autour de l'hôtel, coin à vers, prairie d'un seul tenant pour l'alouette, tas de bois entouré de ronces).
  - **Les habitants demandent** : 5 demandes avec délai (repère « ? » vert et cercle qui se vide) ; à temps : pages, sève, des petits, spécimen rare plus probable ; sinon un départ expliqué.
  - **Effet de chaque geste** : chiffre qui s'envole à la pose, population et ce qui la limite au survol d'un animal et dans le carnet, bouton « À faire » qui liste tout.
- Équilibre : Lisière toujours en 16:49 (médiane, joueur automatique). Les ronces deviennent un problème vers 60 à 70 min.
- Choix de Claude du GDD 12.7 validés le 31/10.
- Tests : 194 (`core.js`), 542 (modèles), 52 vérifications dans le navigateur, sans erreur. `tools/sim-headless.js` compare un joueur attentif et un joueur passif (`--passif`).

## Sprint 6 : retours de Christophe (31/10, commits 6882013, 903773c, 8c1609f, b4bfe1d, 5c88999)
- Version 6.4 publiée à https://claude.ai/artifact/UXJUMd5SPczSYnJtdT3uhS (remplacée par l'adresse du sprint 7 ci-dessus).
- Version affichée dans les Réglages (constante `VERSION` dans `src/game.js`, 8.2 aujourd'hui ; l'augmenter à chaque publication) ; « Nouvelle version chargée » au lancement après une mise à jour. La partie en cours est gardée (sauvegarde du navigateur) ; « Nouvelle partie » dans les Réglages pour recommencer.
- Retours 1 : barre du bas compacte ; cône sombre sous l'île retiré ; pose en glissant ; une seule bulle à la fois ; guide en 7 étapes avec main, tuiles dorées et caméra qui montre l'espèce venue ; caméra plus proche, glisser déplace la vue ; graphismes (herbe verte, animaux +35 %).
- Retours 2 : herbe à 3 sève, plus productive (0,015 sève/s) et qui s'étend plus vite ; 60 % d'herbe en 3 min au lieu de 7 ; débit de sève affiché.
- Retours 3 : bouton « Récolter (n) » ; bouleaux adultes en 20 min (au lieu de 48), croissance et blocage affichés ; bug des bulles invisibles qui captaient les clics corrigé ; sol adouci, île lisible de loin.
- Retours 4 (navigation) : molette qui zoome vers le curseur, pince qui zoome vers les doigts, double-clic ou double toucher pour plonger vers un point, glissé avec inertie, inclinaison qui suit le zoom, île centrée dans l'espace libre entre les barres.
- **Choix de Claude** (validés le 31/10) : textes du guide et des nouvelles aides écrits directement en français et en anglais par Claude ; réactions d'Odile aux espèces dans le journal du carnet plutôt qu'en bulle.
- **Limite connue des graphismes** : le moteur dessine des facettes plates en Canvas 2D. Pour un vrai saut de qualité, il faudrait passer le rendu en WebGL (Three.js) : chantier d'environ 3 sprints.
- Tests : 167 (`core.js`), 542 (modèles), 43 vérifications dans le navigateur, sans erreur.

## En cours
**Arrêt décidé par Christophe le 31/10 à 21 h 30** : « on a perdu trop de temps pour rien ». Constat : le chantier WebGL (8a, 8b, 8c) ne donne pas d'amélioration graphique visible par rapport au sprint 7, parce que le rendu a été calé pour reproduire l'ancien moteur (mêmes modèles, mêmes couleurs) et que les ajouts sont trop discrets. Dernière version publiée : 8.3 (vent renforcé), https://claude.ai/artifact/URgRFoWRdTCcS2hCEBTGJ2. Aucune étape suivante n'est lancée ; ne rien reprendre sans demande de Christophe.

## Si Christophe veut reprendre un jour
- Piste proposée et non validée : un sprint « direction artistique » qui commence par 2 ou 3 images de styles différents de la même île, à choisir avant de coder (lumière franche, ambiance colorée, vraie herbe en brins fins, modèles plus détaillés).
- Le jeu reste jouable tel quel ; tout le code est dans le dépôt (dernier commit d2a9916).
