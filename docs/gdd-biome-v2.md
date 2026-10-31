# Biome, la forêt de papier : document de conception v2

Version 2.0, 31 octobre 2026 (précisions du sprint 3 en 5.1 et 8.5, du sprint 4 en 1.9 et 10.4, du sprint 5 en 10.4, du sprint 5 bis en 4.3, 5.1, 6.2 et 10.4, du sprint 6 en 10.4 ; gameplay actif du sprint 7 en section 12 ; rendu WebGL des sprints 8a, 8b et 8c en 10.4 et 10.5). Rédigé par Claude, décisions de Christophe intégrées (section 11).

Repères de lecture :
- **[PROTO]** : construit dans le prototype v2.
- **[PLUS TARD]** : prévu, mais hors prototype.
- **[À DÉCIDER]** : choix qui revient à Christophe (liste complète en fin de document).

Décisions déjà validées par Christophe (30/10) :
- Terrain en **grille de tuiles** (on garde la grille 30×30 de la v1, île circulaire qui s'agrandit).
- **Progression hors ligne plafonnée** à 8 heures.
- **Pas de mort ni d'extinction** : une espèce dont les besoins ne sont plus réunis quitte l'île et peut revenir.
- **Rythme** : Lisière en ~15 min, Forêt ancienne en 3 à 5 heures cumulées.

---

## 1. Vision et boucle de jeu

### 1.1 Vision

> On n'achète pas un renard : on crée l'endroit où un renard a envie de vivre.

Biome est un jeu de gestion d'écosystème « cosy » dans un diorama de papier plié. Le joueur aménage une île : il sème, creuse une mare, empile du bois mort. Les espèces arrivent d'elles-mêmes quand leurs besoins sont réunis. Le **carnet de terrain** est le cœur du jeu : il montre les silhouettes des espèces pas encore venues et révèle peu à peu leurs besoins à mesure que le joueur observe. L'île passe par cinq étapes de succession écologique, de la prairie nue à la forêt ancienne puis à la zone humide.

Trois sensations à obtenir :
1. **La surprise méritée** : « Un hérisson ! Ah oui, j'ai fait un tas de bois près des ronces. »
2. **La chaîne visible** : le merle mange des mûres, et des ronces poussent là où il passe.
3. **Le temps qui fait son œuvre** : les bouleaux de la première heure font de l'ombre aux premiers chênes.

Ton : doux, contemplatif, sans punition dure. La prédation existe mais reste stylisée : la proie disparaît dans un froissement de papier, sans cadavre.

### 1.2 Modèle du terrain (tuiles)

Chaque tuile de la grille porte :
- un **couvert** : `nu`, `herbe`, `fleurs`, `ronce`, `arbre` (avec espèce et âge), `eau`, `roche`, `bois_mort`, `amenagement` ;
- trois valeurs de 0 à 100 : **Fertilité** (humus du sol), **Humidité** et **Ombre** (calculée chaque seconde à partir des arbres voisins).

Les espèces vivent à trois niveaux de simulation, pour que le prototype reste léger et portable sur Roblox :

| Mode | Pour qui | Comment | Affichage |
|---|---|---|---|
| `tuile` | plantes, champignons | état de la tuile (présence, croissance) | modèle origami posé sur la tuile |
| `population` | insectes, vers | effectif par zone de 5×5 tuiles, pas d'individus | nuée de particules de papier, quelques sprites |
| `agent` | vertébrés | individus qui se déplacent (comme en v1) | modèle origami animé |

Limite technique : **30 agents au maximum par île**. Au-delà, la capacité des espèces est plafonnée.

### 1.3 Les espèces viennent toutes seules

- **Contrôle d'arrivée** toutes les 15 secondes de jeu : pour chaque espèce débloquée et absente dont tous les besoins sont réunis, chance d'arrivée de 35 %. La **première arrivée** d'une espèce est garantie au plus tard au 3e contrôle (environ 45 s) pour éviter l'attente frustrante.
- Les agents **entrent par le bord de l'île** et marchent jusqu'à leur habitat : le joueur voit venir l'animal.
- **Croissance de population** : jusqu'à la capacité (voir les fiches). La capacité dépend de l'habitat, jamais d'un achat.
- **Départ** : si les besoins ne sont plus réunis pendant un jour de jeu entier (4 min), les individus partent un par un par le bord. Le carnet note : « Parti. Il manquait : un abri. »
- **Hors ligne** : jamais de départ. Les mauvaises nouvelles n'arrivent que sous les yeux du joueur.

### 1.4 Harmonie (0 à 100 %)

Reprise de la v1, avec une nouvelle formule :
- 30 % **équilibre** : part des espèces dont la population est entre 30 % et 120 % de leur capacité ;
- 30 % **chaîne** : présence de chaque rôle attendu à l'étape (producteur, herbivore, prédateur, décomposeur, pollinisateur) ;
- 20 % **diversité** : espèces présentes / espèces débloquées ;
- 20 % **mosaïque** : nombre d'habitats distincts couvrant chacun au moins 10 % de l'île (prairie ouverte, lisière, sous-bois, eau).

Effets : la production de sève est multipliée par 0,5 à 1,5 selon l'harmonie, et l'harmonie compte dans les conditions de passage d'étape.

### 1.5 Temps : jour, nuit et saisons

| Unité | Durée réelle | Remarques |
|---|---|---|
| Jour | 4 min | 3 min de jour, 1 min de nuit (lumière bleutée, papier sombre) |
| Saison | 3 jours = 12 min | Printemps, Été, Automne, Hiver |
| Année | 48 min | Forêt ancienne vers la 4e à 6e année |

- **Printemps** : croissance ×1,5, reproduction, floraison.
- **Été** : insectes au maximum, risque de sécheresse et d'orage.
- **Automne** : baies, glands, champignons ×2, feuilles qui tombent (+ fertilité), migrations.
- **Hiver** : croissance nulle, hibernation (hérisson), départ des migrateurs (alouette), neige en papier blanc. Saison calme, idéale pour réaménager.
- Le cycle des saisons n'avance **qu'en jeu actif**, sinon le joueur raterait les événements. Hors ligne, la saison est figée.

Bouton vitesse ×1 / ×3 conservé.

### 1.6 Boucle minute par minute

1. **Observer** : un animal arrive par le bord, une nuée d'abeilles apparaît. Cliquer dessus le **photographie** : la première photo d'une espèce donne une page de carnet et de la sève. Observer un comportement (chasse, pollinisation, nourrissage) révèle un **indice**.
2. **Récolter** : des graines mûrissent sur les fleurs et les ronces ; un clic les ramasse (bulle de papier qui s'envole vers le compteur).
3. **Lire les pistes** : le carnet affiche la silhouette de la prochaine espèce et ses besoins, avec un « ? » pour ceux qui ne sont pas encore découverts. Exemple : « Des traces de hérisson près des ronces… Il lui faut un endroit pour dormir. »
4. **Aménager** : poser une mare, un tas de pierres, semer des fleurs. Le joueur voit les tuiles changer (l'humidité gagne autour de la mare).

Objectif de rythme : au moins **un événement visible toutes les 30 à 60 secondes** (arrivée, éclosion, récolte, comportement).

### 1.7 Boucle de session (15 à 30 min, soit une à deux saisons)

- Trois **missions du garde forestier** par session, tirées dans une liste (« Fais venir 2 nouvelles espèces », « Traverse un orage avec une harmonie supérieure à 60 % », « Photographie un renard la nuit »). Récompense : sève, graines, pages. Le garde forestier est un personnage (voir 1.9).
- Un **événement** par saison environ (section 5).
- Un pas visible vers l'**étape suivante** : la jauge de succession affiche les conditions restantes.

### 1.8 Boucle long terme

- **Succession** : 5 étapes, chacune débloquant espèces, aménagements et agrandissements de l'île.
- **Carnet** : 34 espèces au total, chacune avec 3 indices et 3 observations de comportement.
- **Collection de spécimens rares** en papiers spéciaux (section 5).
- **Mosaïque** : la meilleure île n'est pas une forêt partout, mais un paysage varié (prairie, lisière, sous-bois, eau). Les conditions de passage l'exigent.
- [PLUS TARD] **Nouvelle île** : recommencer une île au climat différent (montagne, littoral) en gardant le carnet.

### 1.9 Le garde forestier (personnage)

Validé par Christophe le 30/10. **Odile, la garde forestière** (nom provisoire) : une figurine origami en papier kraft, chapeau à large bord, jumelles autour du cou, un carnet sous le bras. Elle vit dans une petite **cabane** posée au bord de l'île (non déplaçable ; voir « Rendu » ci-dessous).

Rôle :
- **Tutoriel** : c'est elle qui parle pendant les 15 premières minutes (bulles courtes, jamais plus de 2 lignes, toujours fermables).
- **Missions** : un clic sur la cabane ouvre ses 3 missions. Quand une mission est remplie, elle agite son chapeau et une enveloppe de papier apparaît au-dessus de la cabane.
- **Alertes** : elle annonce les événements (« Le ciel se fronce… ») et le risque d'incendie.
- **Indices** : quand le joueur bloque (aucune nouvelle espèce depuis 5 minutes), elle propose un indice gratuit sur l'espèce la plus proche de venir. C'est aussi elle qui propose la pub récompensée « Indice du naturaliste ».
- **Commentaires** : quand le joueur fait venir une espèce, elle réagit (une phrase par espèce, écrite par ChatGPT).

Rendu : modèle origami simple (environ 40 faces) qui se promène lentement autour de sa cabane et regarde avec ses jumelles l'animal le plus proche. Choix du sprint 4 : la cabane est posée sur un petit **promontoire de papier collé au bord de l'île**, hors de la grille ; elle ne prend donc aucune tuile au joueur (facile à changer si Christophe préfère une tuile de l'île). Sur Roblox, chaque île a la sienne. Une **tenue de garde** est un bon cosmétique (section 7.4).

Données : ajouter une rubrique `garde` dans `textes/fr.json` (bulles du tutoriel, missions, réactions par espèce, alertes) ; ses missions sont décrites dans `data/missions.json` avec le même langage de conditions (section 8.2).

---

## 2. Les 5 étapes de succession

L'étape est un **niveau de l'île entière**. Passer d'une étape à l'autre ne remplace rien : les espèces des étapes précédentes restent, à condition que leur habitat soit conservé. Chaque passage déclenche une courte cinématique (le papier de l'île se replie et se redéplie avec une nouvelle palette) et une coupure pub sur le web (section 6).

| # | Étape | Rayon de l'île | Débloque |
|---|---|---|---|
| 1 | **Prairie** | 9 | herbe, fleurs, tas de pierres, mare, hôtel à insectes, paillis |
| 2 | **Lisière** | 9 → 11 | ronce, bouleau, tas de bois, nichoir ; agrandissement 1 |
| 3 | **Jeune forêt** [PLUS TARD] | 11 → 13 | chêne, noisetier, souche ; agrandissement 2 |
| 4 | **Forêt ancienne** [PLUS TARD] | 13 → 15 | hêtre, fougère, ruisseau ; agrandissement 3 |
| 5 | **Zone humide** [PLUS TARD] | 15 | saule, roseau, berges ; transformée par le castor |

### Conditions de passage

Toutes les conditions doivent être vraies en même temps. La jauge les affiche une à une, cochées ou non.

**Prairie → Lisière** (cible : ~15 min)
- Couvert végétal (herbe + fleurs) ≥ 60 % des tuiles
- Humidité moyenne ≥ 35 (il faut une mare)
- Fertilité moyenne ≥ 30
- 6 espèces de la Prairie présentes sur 7
- Harmonie ≥ 60 % pendant 1 jour complet

**Lisière → Jeune forêt** (cible : ~1 h cumulée)
- 8 bouleaux adultes
- Ombre ≥ 30 sur au moins 20 % des tuiles
- Le renard présent depuis une saison complète (chaîne alimentaire bouclée)
- 12 espèces présentes sur les 14 débloquées
- **Mosaïque** : au moins 25 % de tuiles encore ouvertes (prairie)

**Jeune forêt → Forêt ancienne** (cible : ~3 h cumulées)
- 4 chênes adultes âgés d'au moins 1 an de jeu
- Bois mort sur au moins 6 tuiles
- Pic épeiche présent (il creuse les cavités dont la chouette aura besoin)
- 3 habitats distincts couvrant chacun au moins 10 % de l'île
- 18 espèces présentes ; harmonie ≥ 70 % pendant une saison entière

**Forêt ancienne → Zone humide** (cible : 4 à 5 h cumulées)
- Un ruisseau aménagé (débloqué en Forêt ancienne)
- 6 saules sur les berges
- Le castor arrive et construit son barrage : la zone en amont devient humide. Il faut au moins 15 % de tuiles inondées.
- 26 espèces présentes

La Zone humide est l'étape finale : le joueur ne la construit pas lui-même, il crée les conditions pour qu'un **ingénieur** (le castor) transforme son île. C'est le meilleur exemple d'effet indirect du jeu.

---

## 3. Les espèces

34 espèces au total, dont **14 dans le prototype** (Prairie et Lisière).

Légende de la colonne Venue : **S** = semée par le joueur (on aménage l'habitat végétal), **V** = vient seule. Les animaux, insectes et champignons ne s'achètent jamais.

### 3.1 Prairie [PROTO]

| Espèce | Type, mode | Venue | Besoins pour venir | Rôle | Interactions |
|---|---|---|---|---|---|
| **Herbe des prés** (`herbe`) | plante, tuile | S | fertilité ≥ 5, ombre < 60 | producteur, base de la sève | s'étend sur les tuiles voisines ; mangée par lapin et sauterelle ; recule sous l'ombre |
| **Fleurs sauvages** (`fleurs`) | plante, tuile | S | fertilité ≥ 20, humidité ≥ 20, ombre < 40 | producteur, nectar, graines | nourrit abeille et tircis ; graines ×2 et extension si pollinisées |
| **Sauterelle** (`sauterelle`) | insecte, population | V | herbe ≥ 20 % des tuiles ; printemps à automne | herbivore, proie | mange un peu d'herbe ; mangée par alouette et hérisson ; œufs en hiver (dormante) |
| **Abeille sauvage** (`abeille`) | insecte, population | V | fleurs ≥ 6 tuiles + hôtel à insectes dans un rayon de 6 ; jour, hors hiver | pollinisateur | double les graines des fleurs et les fait s'étendre ; hiverne dans l'hôtel |
| **Ver de terre** (`ver`) | petite bête du sol, population | V | humidité ≥ 35, fertilité ≥ 15 | décomposeur | +fertilité des tuiles ; mangé par hérisson et merle ; paillis et mare l'attirent |
| **Lapin de garenne** (`lapin`) | animal, agent | V | herbe ≥ 30 % dans un rayon de 5 + abri (tas de pierres ou ronce) dans un rayon de 4 | herbivore | broute l'herbe (surpâturage : tuile nue s'il y en a trop) ; terriers +fertilité ; chassé par le renard. Capacité : 1 lapin pour 5 tuiles d'herbe, 4 au plus par abri |
| **Alouette des champs** (`alouette`) | oiseau, agent | V | sauterelles ≥ 4 zones peuplées + ≥ 40 % de tuiles ouvertes (sans arbre ni ronce) | insectivore, régulateur | mange les sauterelles ; migre en hiver ; **part si l'île se referme**, ce qui donne de la valeur à la prairie |

### 3.2 Lisière [PROTO]

| Espèce | Type, mode | Venue | Besoins pour venir | Rôle | Interactions |
|---|---|---|---|---|---|
| **Ronce** (`ronce`) | arbuste, tuile | S, ou semée par le merle | fertilité ≥ 25, ombre < 70 | abri, baies | abrite lapin, hérisson, merle et renard ; mûres en fin d'été → merle ; s'étend lentement et peut envahir (le joueur peut la retirer) |
| **Bouleau** (`bouleau`) | arbre pionnier, tuile | S | fertilité ≥ 20, ombre < 30 (ne pousse pas sous les autres arbres) | producteur, ombre légère, litière | adulte en ~1 an ; ombre dans un rayon de 1,5 ; feuilles d'automne → +fertilité ; perchoir du merle ; prépare la Jeune forêt |
| **Hérisson** (`herisson`) | animal, agent, nocturne | V | ronce ≥ 3 tuiles + tas de bois dans un rayon de 5 + vers ou sauterelles présents | insectivore | mange vers et sauterelles ; hiberne dans le tas de bois (le tas « ronfle ») ; le renard l'évite |
| **Merle noir** (`merle`) | oiseau, agent, diurne | V | (ronce ≥ 2 tuiles ou 1 bouleau) + vers présents ; un nichoir augmente la capacité | omnivore, **disperseur** | mange vers et mûres ; **sème des ronces** sur les tuiles fertiles où il se pose (effet indirect à gérer) |
| **Renard roux** (`renard`) | animal, agent, crépuscule et nuit | V | lapins ≥ 6 + ronce ≥ 4 tuiles (tanière) + île de rayon ≥ 11 | prédateur | chasse les lapins et les régule ; 1 couple pour 8 lapins ; part si les lapins manquent pendant 1 jour |
| **Tircis** (`tircis`) | papillon, population | V | herbe ≥ 30 % + ≥ 3 tuiles de mi-ombre (ombre 20 à 50) + fleurs ≥ 4 tuiles ; printemps et été | pollinisateur secondaire | chenilles sur l'herbe ; pollinise les fleurs (moitié moins que l'abeille) ; mangé par le merle |
| **Coulemelle** (`coulemelle`) | champignon, tuile | V | fertilité ≥ 35, humidité ≥ 40, litière à proximité (bouleau ou tas de bois dans un rayon de 2) | décomposeur | litière → +fertilité et sève ; mycélium toute l'année, fructification visible en automne |

Choix réaliste : le tircis remplace le paon-du-jour, dont les chenilles ont besoin d'orties (ce qui aurait ajouté une espèce). Le tircis est un vrai papillon de lisière dont les chenilles mangent les graminées.

### 3.3 Jeune forêt [PLUS TARD]

| Espèce | Venue | Besoins (résumé) | Rôle et interactions clés |
|---|---|---|---|
| Chêne (`chene`) | S, ou planté par l'écureuil | fertilité ≥ 40, mi-ombre (pousse **sous** les bouleaux) | arbre de fond, glands en automne ; adulte en 2 ans |
| Noisetier (`noisetier`) | S | fertilité ≥ 30, lisière | noisettes → écureuil et mulot |
| Écureuil roux (`ecureuil`) | V | 3 chênes ou noisetiers adultes | enterre glands et noisettes : **plante des chênes** |
| Pic épeiche (`pic`) | V | 10 arbres adultes + bois mort | insectivore ; **creuse des cavités** utiles à la chouette |
| Chevreuil (`chevreuil`) | V | clairière ≥ 15 % + sous-bois ≥ 15 % | broute les jeunes pousses et ralentit la forêt (tension à gérer) |
| Lucane cerf-volant (`lucane`) | V | bois mort ≥ 4 tuiles + chênes | décomposeur du bois ; spécimen rare très recherché |
| Bolet (`bolet`) | V | chênes adultes + humidité ≥ 45 | champignon associé aux racines : croissance des chênes ×1,3 |

### 3.4 Forêt ancienne [PLUS TARD]

| Espèce | Venue | Besoins (résumé) | Rôle et interactions clés |
|---|---|---|---|
| Hêtre (`hetre`) | S | ombre ≥ 50, fertilité ≥ 55 | ombre dense ; fait reculer l'herbe |
| Fougère (`fougere`) | V (spores) | ombre ≥ 50, humidité ≥ 50 | sous-bois, abri du mulot |
| Mulot (`mulot`) | V | fougère + glands ou noisettes | granivore, proie de la chouette et du renard |
| Chouette hulotte (`chouette`) | V | cavités de pic + mulots ≥ 6 | prédatrice nocturne |
| Blaireau (`blaireau`) | V | sous-bois + vers abondants + talus | omnivore, terrier ; +fertilité |
| Cerf élaphe (`cerf`) | V | forêt ≥ 40 % + clairière | grand herbivore ; brame en automne (événement) |
| Amadouvier (`amadouvier`) | V | arbres âgés de plus de 3 ans | décomposeur des vieux troncs : crée du bois mort |

### 3.5 Zone humide [PLUS TARD]

| Espèce | Venue | Besoins (résumé) | Rôle et interactions clés |
|---|---|---|---|
| Saule (`saule`) | S | berge (tuile voisine d'un ruisseau ou de l'eau) | nourriture du castor |
| Roseau (`roseau`) | V | eau peu profonde | abri de la grenouille, filtre l'eau |
| Castor d'Europe (`castor`) | V | ruisseau + saules ≥ 6 | **ingénieur** : barrage → zone humide |
| Grenouille rousse (`grenouille`) | V | mare ou zone humide + roseaux | mange les insectes ; proie du héron |
| Libellule (`libellule`) | V | eau ≥ 6 tuiles + roseaux | prédatrice d'insectes ; larves aquatiques |
| Héron cendré (`heron`) | V | grenouilles ≥ 6 + eau | prédateur ; peut se percher dans les grands arbres |

---

## 4. Actions du joueur et économie

### 4.1 Ressources

| Ressource | Source | Usage |
|---|---|---|
| **Sève** | production passive des plantes (selon la biomasse) × harmonie ; premières photos ; missions | aménagements, semis, agrandissements |
| **Graines** | clic sur les plantes mûres (fleurs, ronces, bouleaux en automne) ; ×2 avec les pollinisateurs | semer des plantes |
| **Pages du carnet** | 1re photo d'une espèce, indices, comportements observés, spécimens rares | **niveau du carnet**, qui débloque des aménagements de confort et des cosmétiques |

La Fertilité, l'Humidité et l'Ombre ne sont pas des ressources : ce sont des propriétés des tuiles, que le joueur influence.

### 4.2 Actions [PROTO]

Le joueur **ne place jamais d'animal**. Il dispose de :

| Action | Coût | Effet | Débloquée |
|---|---|---|---|
| Semer de l'herbe | 3 sève (5 avant le sprint 6) | tuile → herbe | Prairie |
| Semer des fleurs | 10 sève + 1 graine | tuile → fleurs | Prairie |
| Tas de pierres | 30 sève | abri (lapin) ; 1 tuile | Prairie |
| Mare | 80 sève | 2×2 tuiles d'eau ; humidité +40 dans un rayon de 3, qui décroît avec la distance | Prairie |
| Hôtel à insectes | 60 sève | habitat de l'abeille ; capacité de pollinisateurs +50 % dans un rayon de 6 | Prairie |
| Paillis | 15 sève | tuile : fertilité +15 et humidité +10, lentement (sur 1 jour) | Prairie |
| Semer une ronce | 20 sève + 2 graines | tuile → ronce | Lisière |
| Planter un bouleau | 40 sève + 3 graines | jeune bouleau | Lisière |
| Tas de bois | 40 sève | abri et hibernation du hérisson ; litière | Lisière |
| Nichoir | 50 sève | se pose sur un bouleau adulte ; capacité du merle +2 | Lisière |
| Retirer | gratuit | remet la tuile à nu ; rend 50 % du coût | toujours |
| Agrandir l'île | 400 / 1 500 / 5 000 sève | rayon +2 (Lisière, Jeune forêt, Forêt ancienne) | à chaque étape |

[PLUS TARD] souche, ruisseau, coupe-feu, sentier d'observation (bonus de photos), affût (observation de nuit).

### 4.3 Valeurs de départ

- Sève : 40, graines : 3.
- Île de rayon 9 : herbe au centre (environ 25 % des tuiles), fertilité 10 à 25, humidité 20, quelques roches.
- Les sauterelles arrivent en moins de 30 secondes : première leçon, aucun achat.
- Production de sève indicative : 0,05 par tuile d'herbe ou de fleurs par seconde, 0,3 par bouleau adulte, × harmonie. Toutes les valeurs seront ajustées par simulation.
- **Économie de la sève (sprint 5 bis)** : sans frein, la réserve montait à 36 000 en 2 h et à 70 000 après 8 h d'absence, alors que tout le contenu de la Lisière coûte moins de 5 000. Trois freins :
  - **Réserve plafonnée par étape** : Prairie 1 000, Lisière 3 000 (puis 8 000, 20 000, 40 000 prévus). Seule la production des plantes s'arrête au plafond ; photos, missions, récompenses et remboursements peuvent le dépasser (un cadeau n'est jamais perdu). Le compteur s'entoure d'or quand la réserve est pleine et Odile le dit une fois par étape.
  - **Rendement décroissant** : au-delà de 2 sève/s (avant l'harmonie), la production ne compte plus qu'à 40 %. La Prairie n'y arrive pas ; c'est l'herbe qui s'étend seule en Lisière qui est freinée.
  - **Hors ligne par paliers** : voir 6.2.
  Résultat (20 parties) : réserve 657 à 15 min, 1 850 à 30 min, puis pleine (3 000) vers 45 min ; Lisière toujours à 16:41 en médiane.

### 4.4 Déroulé des 15 premières minutes (tutoriel intégré)

| Temps | Ce qui se passe | Ce que le joueur apprend |
|---|---|---|
| 0:00 | Île en herbe, carnet ouvert sur la silhouette de la sauterelle, son besoin coché | le carnet |
| 0:20 | Les sauterelles arrivent seules | « personne ne les a achetées » |
| 0:40 | Mission : semer 4 fleurs | semer, graines |
| 2:00 | Silhouette de l'abeille : « fleurs ✓, un abri ? » | les besoins partiels |
| 3:00 | Hôtel à insectes → les abeilles arrivent, les fleurs doublent leurs graines | la chaîne |
| 4:00 | L'alouette arrive (sauterelles assez nombreuses) | les effets en cascade |
| 5 à 8 min | Tas de pierres → lapins ; première nuit | les abris, le cycle jour/nuit |
| 8 à 12 min | Mare et paillis → vers de terre | humidité et fertilité |
| 12 à 15 min | Harmonie ≥ 60 % pendant un jour → **Lisière** | la succession |

---

## 5. Événements et spécimens rares

### 5.1 Événements

| Événement | Quand | Durée | Effets | Papier rare | Statut |
|---|---|---|---|---|---|
| **Floraison** | printemps, 1 fois par printemps | 1 jour | fleurs ×2 en graines, pollinisateurs ×1,5 | Washi ×5 | [PROTO] |
| **Orage** | été (60 %), automne (30 %) | 1 min | humidité +30 partout ; la foudre peut abattre 1 arbre adulte → bois mort + petite clairière (renouvellement) ; animaux à l'abri pendant l'orage | Journal ×5 | [PROTO] |
| **Sécheresse** | été (25 %), jamais 2 étés de suite, **jamais avant la Lisière** | 2 jours | l'humidité de l'air baisse de 0,1 par seconde jusqu'à −30 (plancher 10 par tuile ; durcie au sprint 5 bis, avant : 0,05 et −20) ; mares et paillis restent des refuges ; espèces humides en départ si ça dure. Récompense : harmonie ≥ 70 % à la fin (avant : 50 %) → 3 pages + bonus de sève | Calque ×2 (les mirages) | [PROTO] |
| **Migration** | printemps et automne | 1 jour | des visiteurs de passage (grues, cigognes) se posent s'il y a une prairie ou de l'eau ; on peut les photographier, ils ne restent pas | Doré ×3 sur les visiteurs | [PLUS TARD] |
| **Nuit des lucioles** | été, la nuit | 1 nuit | lucioles décoratives ; les animaux nocturnes se montrent davantage | Calque ×5 | [PLUS TARD] |
| **Brouillard** | automne | ½ jour | visibilité réduite ; champignons ×2 | Calque ×3 | [PLUS TARD] |
| **Premières neiges** | début d'hiver | 1 jour | traces dans la neige qui révèlent les espèces présentes : indices gratuits | — | [PLUS TARD] |
| **Incendie** | été, après une sécheresse, Jeune forêt et au-delà | 1 min | voir 5.2 | Doré ×2 sur la première espèce qui revient | [PLUS TARD] |
| **Aube dorée** | rare (3 % par jour), toute saison | 1 matin | lumière dorée | Doré ×6 | [PLUS TARD] |

Précisions du sprint 3 (règles codées dans `core.js`) :
- **Tirage** : une fois par saison, en jeu actif. Les événements possibles sont tirés du plus rare au plus fréquent ; le premier qui sort est retenu (au plus un par saison). Il commence au hasard dans la saison et finit avant la saison suivante. La garde l'annonce 30 s avant.
- **Orage** : l'humidité +30 tient pendant l'orage puis revient à la normale en environ un jour. L'arbre abattu devient un tas de bois mort naturel (compte comme un tas de bois, ne rapporte rien si on le retire) ; un nichoir posé dessus est remboursé en entier. Pendant l'orage, les animaux rentrent au foyer, aucun agent n'arrive et le renard ne chasse pas.
- **Sécheresse** : interdite en Prairie pour ne pas freiner le passage à la Lisière (première version : Lisière repoussée de 16 à 24 min).
- **Mission « événement »** : comptée à la fin de l'événement (« traverser »).
- **Papiers rares** : tirés à l'arrivée d'un agent, à une naissance, à l'apparition d'une nuée ou d'une touffe (semis, extension, dispersion par le merle, champignon). Le papier favorisé par l'événement est tiré en premier, pour que chaque essai compte pour sa garantie. Hors événement, un spécimen garde son papier 1 jour.

Règle d'or : les événements sont des **épreuves douces**. Au pire, une espèce part et pourra revenir ; la sève et les aménagements ne sont jamais détruits par un événement (sauf l'arbre abattu, qui devient du bois mort utile, et la zone brûlée par l'incendie, voir ci-dessous).

### 5.2 L'incendie en détail [PLUS TARD]

Validé par Christophe le 30/10. Dans la nature, le feu fait partie du cycle : il ouvre la forêt, la cendre fertilise le sol, et des espèces pionnières reviennent. Dans le jeu, c'est **l'événement de renouvellement** : il remet une petite partie de l'île à l'étape Prairie, ce qui relance la découverte et récompense les joueurs qui ont préparé leur île.

**Quand.** Seulement en été, juste après une sécheresse, et seulement à partir de la Jeune forêt (il faut des arbres pour brûler). Au plus 1 fois par année de jeu. Le joueur est **prévenu** : pendant la sécheresse, la garde forestière signale « Risque d'incendie élevé » avec une jauge.

**Ce que le joueur peut faire avant.** Les mares, le ruisseau et les tuiles d'herbe rase servent de **coupe-feu** : le feu ne les traverse pas. Un nouvel aménagement, le *coupe-feu* (bande de terre nue), se débloque en Jeune forêt. Une île bien préparée limite le feu à quelques tuiles.

**Déroulé (1 minute).**
1. La foudre frappe un arbre adulte choisi au hasard parmi les tuiles les plus sèches.
2. Le feu (flammes en papier rouge et orange qui se plient et se déplient) s'étend de tuile en tuile vers les voisines qui ont de la végétation et une humidité < 30, avec une **limite stricte de rayon 3** autour du départ.
3. Les animaux fuient vers le bord opposé (ce ne sont pas des morts : ils reviendront si l'habitat se reforme ailleurs ou plus tard).
4. Le joueur peut cliquer sur les tuiles en feu pour les **arroser** (chaque clic éteint une tuile, 1 clic par seconde) : c'est un petit moment d'action.

**Après.**
- Les tuiles brûlées deviennent `cendres` : couvert nu, **fertilité +30**.
- Elles redeviennent de la prairie en 1 à 2 jours (l'herbe repousse seule), puis des pionniers reviennent (bouleaux semés par le vent, ronces semées par le merle).
- Le carnet ouvre une page spéciale « Après le feu » : certaines espèces arrivent plus vite sur les cendres (multiplicateur d'arrivée ×2 pendant 2 jours), et la première espèce qui revient a 2 fois plus de chances d'être en papier doré.
- La sève, les aménagements en pierre (tas de pierres, mare) et le carnet ne sont jamais touchés. Les tas de bois et nichoirs dans la zone brûlent ; ils sont remboursés à 100 % en sève.

**Garde-fous.** Jamais plus de 10 % des tuiles de l'île. Jamais pendant les 10 premières minutes d'une session. Jamais hors ligne. **Option dans les réglages** : « Incendies naturels : activés / désactivés » (activés par défaut). Sur Roblox, l'incendie n'est **jamais achetable** (on ne déclenche pas un feu chez les autres).

### 5.3 Spécimens rares en papiers spéciaux

Chaque espèce peut apparaître dans 4 papiers spéciaux. Un spécimen rare est **un individu normal** (ou une touffe, une nuée) avec une texture particulière ; il vit sur l'île comme les autres.

| Papier | Rendu | Chance de base par arrivée | Hausse pendant | Garantie |
|---|---|---|---|---|
| **Journal** | gris, lignes imprimées | 1/60 | Orage (×5 → 1/12) | au 20e essai sans succès pendant l'événement |
| **Washi** | motifs fibreux, couleurs pastel | 1/60 | Floraison (×5 → 1/12) | idem |
| **Calque** | translucide | 1/80 | Nuit des lucioles, brouillard | idem |
| **Doré** | dégradé métallique et paillettes | 1/300 | Aube dorée (×6 → 1/50) | aucune |

Règles :
- Le tirage se fait **à l'arrivée** d'un individu, ou à l'apparition d'une nouvelle touffe ou nuée.
- Pour entrer dans la collection, le spécimen doit être **photographié** pendant sa présence : jusqu'à la fin de l'événement plus 1 jour, puis il reprend un papier normal. Cela récompense l'attention.
- Les chances sont **affichées dans le carnet**, et une harmonie au-dessus de 80 % les multiplie par 1,2 (affiché aussi).
- Récompenses : 3 pages, une carte de collection, et sur Roblox une **figurine échangeable** (section 7). Aucun avantage de jeu important : c'est de la collection pure.
- Collection complète : 34 espèces × 4 papiers = 136 cartes. Prototype : 14 × 2 (journal, washi) = 28.

Rendu : le moteur Canvas 2D remplit des faces planes ; on remplace la couleur unie par un motif (`createPattern`) ou un dégradé par face. C'est peu coûteux : confirmé au sprint 4 (motif collé à chaque face, voir 10.4).

---

## 6. Version web (Poki, CrazyGames)

### 6.1 Principes
- Solo, gratuit, sans compte. Chargement rapide : un seul fichier HTML/JS, sans dépendance (comme la v1), modèles générés par le code, polices système en repli.
- Jouable à la souris et au tactile, en mode portrait comme en mode paysage.
- Français et anglais dès la soumission.
- La **diffusion repose sur les portails** : pas de démarchage. Ce que le portail regarde : temps de jeu par session, rétention à J1 et J7, taux de conversion de la page de jeu (vignette et premières secondes). D'où un démarrage immédiat, sans écran-titre bloquant : l'île est là et les sauterelles arrivent.

### 6.2 Progression solo
- Sauvegarde automatique toutes les 10 s dans `localStorage`, plus la sauvegarde en ligne du portail si son kit de développement en propose une (à vérifier pour chaque portail lors de l'intégration).
- **Hors ligne** (plafonné à 8 h) : la sève s'accumule à 50 % du taux pendant la première heure, puis à 15 % (8 h d'absence ≈ 1 h 30 de jeu actif), sans dépasser le plafond de la réserve (4.3) ; l'écran de retour le signale si la réserve est pleine, les plantes poussent, les arrivées possibles sont résolues au retour. Aucun départ, aucun événement, saison figée. Écran de retour : « Pendant ton absence : +1 240 sève, 2 nouvelles espèces sont venues. »
- Le contenu est identique à celui de Roblox, sans les échanges.

### 6.3 Publicités
Une couche `ads.js` isole le kit de chaque portail (Poki, CrazyGames, ou rien en local).

**Pubs récompensées** (le joueur choisit toujours, et le bénéfice est annoncé avant) :

| Récompense | Effet | Limite |
|---|---|---|
| Pluie bienfaisante | humidité +30 sur toute l'île tout de suite | 1 toutes les 10 min |
| Sève double | production ×2 pendant 10 min | 1 active à la fois |
| Indice du naturaliste | révèle un besoin caché d'une espèce au choix | 3 par jour |
| Prolonger l'événement | +1 jour d'orage ou de floraison | 1 par événement |
| Retour doublé | double le gain hors ligne | 1 par retour |

**Coupures pub (interstitielles)** : seulement aux pauses naturelles (passage d'étape, fin de saison), au moins 3 minutes d'écart, jamais dans les 2 premières minutes de jeu. Jamais pendant une action. Les règles exactes de chaque portail sont à vérifier à la soumission.

Interdits : pas de pub pour augmenter la chance d'un papier rare en dehors des événements, pas de pub obligatoire pour progresser.

---

## 7. Version Roblox [PLUS TARD]

### 7.1 Structure
- Serveur de **6 joueurs** (validé le 30/10). Chaque joueur reçoit une **île** disposée autour d'une **clairière commune** (un grand arbre central, le tableau des échanges, l'annonce des événements). Pourquoi 6 : c'est la taille des jeux de jardin à îlots qui marchent sur Roblox ; assez de monde pour qu'un achat « pour tout le serveur » soit vu et remercié, assez peu pour que chaque île garde de bonnes performances sur téléphone. Le chiffre est un réglage qu'on pourra passer à 8 si les tests le permettent.
- Le cœur `core.js` est porté en TypeScript puis compilé en Luau (roblox-ts). La simulation tourne **côté serveur**, une instance par île ; les clients affichent le résultat. Le style origami (blocs à facettes et couleurs unies) correspond bien au rendu Roblox.
- Performance : tuiles mises à jour à 1 Hz, agents à 10 Hz, 30 agents au maximum par île.
- Persistance par DataStore : état de l'île compressé, carnet, collection.

### 7.2 Multijoueur
- **Météo commune** : saisons et événements sont synchronisés sur le serveur. Tout le monde vit l'orage en même temps : « Orage dans 2 minutes ! ». C'est le moment fort, comme les événements de Grow a Garden.
- **Visites** : on se promène sur l'île des autres et on y photographie des espèces, ce qui compte pour son propre carnet (une première fois).
- **Coup de main** : arroser la mare d'un voisin, lui laisser des graines (avec un plafond quotidien).
- **Classement doux** : îles les plus « aimées » du serveur, harmonie la plus haute. Pas de compétition destructrice.

### 7.3 Échanges
- On n'échange que les **figurines de spécimens rares**. Pas d'animaux vivants (l'écologie reste un mérite personnel), pas d'objets achetés en Robux.
- Interface à double confirmation : les deux joueurs voient les deux offres ; tout changement remet les confirmations à zéro ; 5 secondes de verrouillage avant validation.
- Historique des échanges consultable, pour limiter les arnaques.

### 7.4 Monétisation (sans tirage payant opaque)
Principe : tout achat a un **effet connu à l'avance**. Aucune boîte surprise. Les événements achetés sont identiques aux événements naturels, avec les chances affichées, et profitent à tout le serveur. Le doré n'est jamais lié à un achat.

| Type | Exemples | Prix indicatif (à tester) |
|---|---|---|
| **Achats ponctuels** | Déclencher un orage pour tout le serveur (au plus 1 toutes les 15 min par serveur ; le nom de l'acheteur est annoncé) ; Floraison pour le serveur ; faire pousser un arbre d'un coup ; paquet de sève | 25 à 99 R$ |
| **Pass permanents** | Carnet du naturaliste (+1 indice révélé par espèce, vitrine +20 places) ; Jardinier (récolte automatique des graines) ; Grand îlot (+1 agrandissement) | 99 à 299 R$ |
| **Cosmétiques** | thèmes de papier de l'île (kraft, pastel, nuit étoilée), cadres de vitrine, panneaux, chapeau origami pour l'avatar | 25 à 150 R$ |

Revenu complémentaire : les paiements Roblox Premium liés au temps de jeu (automatiques, sans effort commercial).

**Leviers pour maximiser les achats** (objectif fixé par Christophe le 30/10), tous compatibles avec la règle « pas de tirage opaque » :
1. **L'achat social visible** : l'achat le plus important du jeu est « Déclencher un orage pour tout le serveur ». L'acheteur est annoncé à tous (« Merci à Léa pour l'orage ! »), ses voisins reçoivent la pluie et leurs chances de papier journal. Les autres joueurs voient l'effet et ont envie d'offrir le prochain. Il faut que ce bouton soit dans la clairière commune, bien en vue.
2. **Le pack de départ** : une offre unique, très avantageuse, proposée après 10 minutes de jeu (pas avant) : sève, une tenue de garde forestière et une place de vitrine. Le premier achat est le plus difficile ; ensuite les joueurs rachètent plus facilement.
3. **Les cosmétiques de saison** : une petite collection (thème de papier, décoration) vendue seulement pendant une saison réelle (Halloween, Noël, printemps). Le prix est fixe et connu, seule la disponibilité est limitée.
4. **Le gain de temps** : faire pousser un arbre tout de suite, prolonger un événement sur son île. Les joueurs impatients paient pour aller plus vite, sans que le contenu soit réservé aux payeurs.
5. **La vitrine** : montrer sa collection de spécimens rares aux visiteurs donne envie d'agrandir la vitrine (pass) et de la décorer (cosmétiques).
6. **Le pass le plus rentable en premier** : sur Roblox, les pass permanents rapportent souvent plus que les petits achats. On sortira « Jardinier » et « Grand îlot » dès le lancement.

À ne pas faire : vendre de la puissance qui écrase les autres (pas de classement achetable), vendre des chances sur le doré, faire des fausses promotions avec compte à rebours. Ces pratiques font fuir les joueurs, et Roblox les surveille de plus en plus. Les prix seront ajustés avec les statistiques de vente de Roblox une fois le jeu en ligne.

---

## 8. Formats de données (le contrat avec ChatGPT)

### 8.1 Organisation des fichiers

```
data/
  especes/<id>.json      une fiche par espèce (mécanique seulement, pas de texte)
  etapes.json            les 5 étapes
  evenements.json        les événements
  rares.json             les règles des papiers spéciaux
  amenagements.json      actions et coûts
  missions.json          missions de la garde forestière
  textes/fr.json         tous les textes en français, rangés par clé
  textes/en.json         la même structure en anglais
tools/
  validate.js            vérifie tous les fichiers (Claude)
  sim-headless.js        simule 5 h de jeu pour l'équilibrage (Claude)
```

Les **textes sont séparés des mécaniques** : ChatGPT peut écrire ou traduire sans toucher aux chiffres, et la traduction anglaise n'est qu'un second fichier.

Règles communes :
- Identifiants en minuscules ASCII, sans accent, avec `_` (`paon_du_jour`, pas `paon-du-jour`).
- Pourcentages en fraction de 0 à 1 (`0.3`) ; statistiques de tuile de 0 à 100 ; durées en **jours de jeu** (1 jour = 4 min) sauf mention contraire.
- Aucune valeur `null` : un champ sans objet est omis s'il est facultatif.

### 8.2 Les conditions (langage commun)

Les besoins d'arrivée, les conditions de passage d'étape et les déclencheurs d'événement utilisent la même liste d'objets `condition`. Toutes doivent être vraies.

| `type` | Champs | Sens |
|---|---|---|
| `couvert` | `couvert`, `min`, `portee`, `rayon?` | part de tuiles avec ce couvert (`herbe`, `fleurs`, `ronce`, `arbre`, `eau`, `ouvert`, `bois_mort`…) ≥ `min` (fraction) dans la portée |
| `couvert_nb` | `couvert`, `min`, `portee`, `rayon?` | même chose en nombre de tuiles |
| `stat` | `stat` (`fertilite`, `humidite`, `ombre`), `op` (`>=`, `<=`), `valeur`, `portee`, `rayon?` | valeur moyenne d'une statistique de tuile |
| `amenagement` | `id`, `min`, `portee`, `rayon?` | nombre d'aménagements de ce type |
| `espece` | `id`, `min`, `portee`, `rayon?` | individus (agent), zones peuplées (population) ou tuiles (tuile) de cette espèce |
| `arbre_adulte` | `id`, `min`, `age_min_jours?` | nombre d'arbres adultes |
| `saison` | `dans` (liste) | saison courante |
| `moment` | `dans` (`jour`, `nuit`, `crepuscule`) | moment de la journée |
| `etape` | `min` (id d'étape) | étape atteinte |
| `rayon_ile` | `min` | taille de l'île |
| `harmonie` | `min`, `duree_jours?` | harmonie ≥ `min` (fraction), tenue pendant la durée |
| `nb_especes` | `min`, `etapes?` | nombre d'espèces présentes |

`portee` vaut `ile` (toute l'île) ou `zone` (cercle de `rayon` tuiles autour de la tuile candidate pour l'arrivée).

### 8.3 Fiche espèce : `data/especes/<id>.json`

```json
{
  "id": "herisson",
  "etape": "lisiere",
  "categorie": "animal",
  "mode": "agent",
  "venue": "spontanee",
  "roles": ["insectivore"],
  "activite": "nuit",
  "saisons_actives": ["printemps", "ete", "automne"],
  "hiver": "hiberne",
  "besoins": [
    { "type": "couvert_nb", "couvert": "ronce", "min": 3, "portee": "ile" },
    { "type": "amenagement", "id": "tas_bois", "min": 1, "portee": "zone", "rayon": 5 },
    { "type": "espece", "id": "ver", "min": 1, "portee": "zone", "rayon": 6 }
  ],
  "capacite": { "par": "amenagement", "id": "tas_bois", "nombre": 2, "max": 4 },
  "reproduction": { "saisons": ["printemps"], "portee_moyenne": 2, "intervalle_jours": 3 },
  "interactions": [
    { "type": "mange", "cible": "ver", "intensite": 0.3 },
    { "type": "mange", "cible": "sauterelle", "intensite": 0.2 },
    { "type": "evite", "cible": "renard" }
  ],
  "production": { "seve_par_s": 0.05, "pages_photo": 1 },
  "depart_apres_jours": 1,
  "modele": "herisson",
  "palette": ["#8a6a4f", "#c9b49a", "#3b2e25"],
  "papiers_rares": ["journal", "washi", "calque", "dore"]
}
```

Valeurs autorisées :
- `etape` : `prairie`, `lisiere`, `jeune_foret`, `foret_ancienne`, `zone_humide`
- `categorie` : `plante`, `animal`, `champignon`, `insecte` (les vers en font partie, au sens de « petites bêtes »)
- `mode` : `tuile`, `population`, `agent`
- `venue` : `semee` (le joueur la plante) ou `spontanee`
- `roles` (un ou plusieurs) : `producteur`, `herbivore`, `insectivore`, `omnivore`, `predateur`, `decomposeur`, `pollinisateur`, `disperseur`, `ingenieur`, `abri`
- `activite` : `jour`, `nuit`, `crepuscule`, `toujours`
- `hiver` : `actif`, `hiberne`, `migre`, `dormant`
- `capacite.par` : `tuiles` (avec `couvert` et `nombre` = tuiles par individu), `amenagement` (`id`, `nombre` par aménagement), `espece` (`id`, `nombre` d'individus de la proie par individu), plus `max` facultatif
- `interactions[].type` : `mange`, `pollinise`, `disperse` (avec `plante`), `abrite`, `fertilise`, `evite`, `transforme` (avec `effet`)
- `intensite` : de 0 à 1 (proportion de la cible consommée par jour au maximum, ou force de l'effet)
- Pour les plantes, champ supplémentaire `croissance` : `{ "jours_adulte": 12, "extension_par_jour": 0.1, "ombre_projetee": 25, "rayon_ombre": 1.5, "cout_seve": 40, "cout_graines": 3 }`

### 8.4 Étapes : `data/etapes.json`

```json
[
  {
    "id": "lisiere",
    "ordre": 2,
    "rayon_ile": 11,
    "conditions_entree": [
      { "type": "couvert", "couvert": "vegetal", "min": 0.6, "portee": "ile" },
      { "type": "stat", "stat": "humidite", "op": ">=", "valeur": 35, "portee": "ile" },
      { "type": "stat", "stat": "fertilite", "op": ">=", "valeur": 30, "portee": "ile" },
      { "type": "nb_especes", "min": 6, "etapes": ["prairie"] },
      { "type": "harmonie", "min": 0.6, "duree_jours": 1 }
    ],
    "debloque": {
      "especes": ["ronce", "bouleau", "herisson", "merle", "renard", "tircis", "coulemelle"],
      "amenagements": ["semer_ronce", "planter_bouleau", "tas_bois", "nichoir"],
      "agrandissement_cout": 400
    },
    "palette_ile": ["#9cc27a", "#6f9e58", "#d8c9a3"]
  }
]
```

### 8.5 Événements : `data/evenements.json`

```json
[
  {
    "id": "orage",
    "saisons": { "ete": 0.6, "automne": 0.3 },
    "conditions": [],
    "duree_jours": 0.25,
    "effets": [
      { "type": "stat_tuile", "stat": "humidite", "delta": 30, "portee": "ile" },
      { "type": "abattre_arbre", "nombre": 1, "chance": 0.5 },
      { "type": "abri_animaux" }
    ],
    "papier": { "id": "journal", "multiplicateur": 5 },
    "roblox": { "achetable": true, "portee": "serveur", "delai_min_minutes": 15 },
    "statut": "proto"
  }
]
```

Champ facultatif `repos_annees` : nombre d'années sans cet événement après qu'il a eu lieu (sécheresse : 1). Champs facultatifs d'un effet `stat_tuile_par_s` : `cumul_max` (écart maximal de l'humidité de l'air) et `plancher` (statistique de tuile minimale). Les multiplicateurs ont un champ `facteur`.

Types d'effet : `stat_tuile`, `stat_tuile_par_s`, `multiplicateur_croissance` (`cible` : espèce ou rôle), `multiplicateur_arrivee`, `multiplicateur_graines`, `abattre_arbre`, `abri_animaux`, `visiteurs` (liste d'espèces de passage), `zone_feu` [PLUS TARD]. Le champ `recompense` est facultatif (et doit alors être omis, pas mis à `null`) ; s'il existe : `{ "condition": [...], "pages": 3, "seve": 200 }`.

### 8.6 Papiers rares : `data/rares.json`

```json
[
  { "id": "journal", "chance_base": 0.0167, "garantie_apres": 20, "statut": "proto" },
  { "id": "washi",   "chance_base": 0.0167, "garantie_apres": 20, "statut": "proto" },
  { "id": "calque",  "chance_base": 0.0125, "garantie_apres": 20, "statut": "plus_tard" },
  { "id": "dore",    "chance_base": 0.0033, "garantie_apres": 0,  "statut": "plus_tard" }
]
```

### 8.7 Textes : `data/textes/fr.json` (et `en.json`)

```json
{
  "especes": {
    "herisson": {
      "nom": "Hérisson",
      "nom_latin": "Erinaceus europaeus",
      "description": "Petit insectivore nocturne qui fouille la litière en reniflant bruyamment.",
      "anecdote": "Un hérisson peut parcourir 2 km en une nuit à la recherche de vers et d'insectes.",
      "indices": [
        "Des traces fines près des ronces… il aime s'y cacher.",
        "Il lui faut un abri sec pour dormir l'hiver.",
        "Il renifle le sol à la recherche de vers."
      ],
      "comportements": {
        "chasse": "Il a trouvé un ver sous les feuilles.",
        "hibernation": "Le tas de bois ronfle doucement.",
        "arrivee": "Un hérisson est sorti des ronces !"
      },
      "depart": "Le hérisson est parti. Il manquait : {manque}."
    }
  },
  "evenements": {
    "orage": { "nom": "Orage", "annonce": "Le ciel se fronce : un orage arrive.", "fin": "L'orage est passé. La terre a bu." }
  },
  "etapes": {
    "lisiere": { "nom": "Lisière", "titre_passage": "La prairie devient lisière", "texte_passage": "Les premiers buissons s'installent au bord de l'herbe." }
  },
  "missions": {},
  "interface": {}
}
```

Contraintes de texte : `indices[i]` correspond à `besoins[i]` de la fiche (même ordre, même nombre). Description ≤ 140 caractères, anecdote ≤ 160, indice ≤ 90, messages ≤ 80. Variables autorisées entre accolades : `{manque}`, `{nombre}`, `{joueur}`.

### 8.8 Vérification automatique (`tools/validate.js`, écrit par Claude)
- Le JSON est valide ; tous les champs obligatoires sont là ; les valeurs énumérées sont connues.
- Toute référence (`cible`, `id` d'espèce, d'aménagement, d'étape) existe.
- Les nombres sont dans les bornes (stats de 0 à 100, fractions de 0 à 1, chances ≤ 0,05) ; pas de cycle de dépendance impossible (une espèce qui a besoin d'elle-même, ou d'une espèce d'une étape plus tardive).
- Les textes FR et EN ont exactement les mêmes clés ; le nombre d'indices égale le nombre de besoins ; les longueurs maximales sont respectées ; les `{variables}` sont identiques dans les deux langues.
- Sortie : rapport en français, une ligne par problème, et un code d'erreur si un problème bloque.

---

## 9. Consignes prêtes à coller dans ChatGPT

Les trois premières consignes sont dans le document compagnon **`claude/gdd-biome-v2-consignes-chatgpt.md`** (séparé pour être plus facile à copier-coller) :
1. Fiches espèces de la Prairie et de la Lisière → `chatgpt/especes-prairie-lisiere.json`
2. Textes du carnet en français → `chatgpt/textes-fr.json`
3. Traduction anglaise → `chatgpt/textes-en.json`

---

## 10. Périmètre du prototype v2

### 10.1 Question à laquelle le prototype doit répondre
**Est-ce amusant de faire venir des espèces de façon indirecte ?** Concrètement :
1. Le joueur comprend-il **pourquoi** une espèce est venue, ou partie ?
2. Une arrivée procure-t-elle une **vraie joie** (plus que l'achat de la v1) ?
3. A-t-il envie de jouer la saison suivante pour voir la Lisière se remplir ?

### 10.2 Contenu [PROTO]
- Étapes **Prairie** et **Lisière**, plus un **teaser** de Jeune forêt : à l'entrée des conditions, un premier chêne germe sous un bouleau, avec le message « La suite pousse… ».
- **14 espèces** (section 3.1 et 3.2), dont 5 agents visibles (lapin, alouette, hérisson, merle, renard).
- **10 actions** (section 4.2) + agrandissement 1.
- Jour/nuit, 4 saisons.
- 3 événements : Floraison, Orage, Sécheresse.
- 2 papiers rares : Journal et Washi (28 cartes).
- Carnet de terrain : silhouettes, indices, photos, comportements.
- Missions du garde forestier : 10 missions dans la liste.
- Hors ligne plafonné à 8 h.
- Français et anglais.
- Pubs : couche `ads.js` avec un **simulateur** (bouton « regarder une pub » qui accorde la récompense). Pas encore de vrai kit de portail.

### 10.3 Exclu du prototype [PLUS TARD]
Étapes 3 à 5 et leurs 20 espèces, migration, incendie, lucioles, brouillard, neige, aube dorée, papiers calque et doré, Roblox entier, échanges, vrais kits des portails, sauvegarde en ligne, nouvelles îles.

### 10.4 Architecture
On garde `core.js` (simulation pure, sans DOM), `engine.js` (rendu Canvas 2D), `models.js` (modèles origami générés par le code) et `game.js` (interface). Ajouts :
- `data/` (section 8) lu par `core.js` : les espèces ne sont plus codées en dur.
- `core.js` gagne : la grille de tuiles (couvert, fertilité, humidité, ombre), le système de conditions, les arrivées et départs, le temps et les événements. Le RNG déterministe et l'état en JSON pur sont conservés.
- `tools/validate.js` et `tools/sim-headless.js` (Node) : vérification des données et simulation accélérée de 5 heures avec un joueur automatique simple, pour mesurer les temps de passage et repérer les espèces qui ne viennent jamais.
- Une **construction** en un seul fichier HTML (assemblage des modules et des données) pour publier sur claude.ai puis sur les portails.

Précisions du sprint 4 (rendu, `engine.js`, `models.js`, `rendu.js`) :
- **Modèles** : générés par le code, aux couleurs du champ `palette` des fiches (données et rendu restent d'accord). Budget de faces vérifié par `tools/test-modeles.js` (ex. herbe 3 faces, ronce ≤ 75, bouleau ≤ 140, animaux ≤ 80).
- **Tuiles** : couleur du sol selon fertilité (sol pauvre clair, riche brun), humidité (plus sombre), ombre des arbres et saison ; herbe jaunie quand l'humidité baisse. Mare creusée dans le papier, eau qui miroite, gelée en hiver. Paillis : brins de paille. Sol craquelé seulement pendant une sécheresse (ou humidité < 10). Neige progressive en hiver.
- **Saisons** : bouleau vert tendre, vert, doré, nu ; ronce verte, fleurie (fin de printemps, début d'été), à mûres (fin d'été, automne), rougie en hiver ; coulemelles visibles en automne, mycélium (filaments blancs) le reste de l'année ; feuilles qui tombent en automne, flocons en hiver.
- **Animaux** : le lapin sautille, le hérisson se dandine, merle et alouette volent quand ils se déplacent vite ; l'alouette monte chanter en vol stationnaire au-dessus de son territoire. Hibernation : le hérisson disparaît dans son abri, des « z » s'en échappent (le tas « ronfle »). Prédation : la proie devient une boule de papier froissé qui rétrécit.
- **Populations** : quelques individus visibles par zone (sauterelles qui bondissent de touffe en touffe, abeilles et tircis qui vont de fleur en fleur, vers qui sortent de terre près de leurs turricules) ; cachés la nuit, en hiver et pendant l'orage selon l'espèce.
- **Météo** : orage (ciel gris, nuages au fond de la scène, pluie, éclairs, éclair sur l'arbre foudroyé), sécheresse (lumière chaude, brume), floraison (pétales qui volent, fleurs plus grandes et plus nombreuses), annonce de l'orage (nuages qui se rassemblent). Jour, crépuscule et nuit par une teinte d'ambiance ; la fenêtre de la cabane reste éclairée la nuit.
- **Papiers rares** : motif collé aux faces du spécimen (journal : papier gris et colonnes de texte ; washi : pastel, fibres, petites fleurs et points dorés), plus une petite étoile au-dessus de lui pour attirer l'œil.
- **Performances** : le ciel, le sol, l'herbe et les fleurs sont dessinés dans une image mise en cache tant que la caméra ne bouge pas (rafraîchie toutes les 1,5 s) ; seuls les objets hauts et les animaux sont triés à chaque image. Si l'appareil peine (moins de 45 images/s), la définition baisse automatiquement.

Précisions du sprint 5 (interface, `game.js`, `game.css`, `ads.js`) :
- **Construction** : `node tools/construire.js` produit `dist/jeu.html` (le jeu) ; la vitrine du sprint 4 reste disponible avec `--vitrine`.
- **Textes de l'interface** : `data/textes/interface-fr.json`, écrits par Claude ; l'anglais (`interface-en.json`) et celui de la garde et des missions viennent de ChatGPT (consigne 05). Tant qu'un texte anglais manque, le jeu affiche le français.
- **Barre d'actions** : Observer, les 10 aménagements (vignettes origami, coût en sève et graines, cadenas jusqu'à l'étape), Retirer, Agrandir (visible quand l'agrandissement est possible). Une action choisie reste active pour poser plusieurs fois ; au survol, contour de la tuile (2×2 pour la mare), **rouge si la pose ne marcherait pas** (tuile occupée, sève, graines ou sol qui ne convient pas). Un refus est toujours expliqué (« Ça ne pousserait pas ici : fertilité moyenne d'au moins 20 (actuellement 12) »).
- **Observer** : toucher un animal ou une nuée le photographie (flash) ; toucher la cabane ou Odile ouvre les missions ; toucher une tuile mûre récolte ses graines (bulle qui s'envole vers le compteur) ; sinon un petit panneau montre la tuile (fertilité, humidité, ombre) avec les gestes possibles : photographier la plante ou le champignon, récolter, poser un nichoir, retirer.
- **Carnet** (3 onglets : espèces, collection, journal) : silhouettes des espèces pas encore venues. Un besoin se révèle quand il a été réuni une fois, quand l'espèce est venue, par un indice d'Odile ou par la pub « Indice du naturaliste ». Coche verte ou croix rouge selon l'état actuel de l'île, avec la valeur précise (le chiffre n'apparaît qu'une fois le besoin réuni ou l'espèce venue). Description à la venue, anecdote à la première photo, comportements, 2 cartes de spécimens rares par espèce ; chances affichées dans l'onglet collection.
- **Comportements observés** (choix de Claude) : la première observation d'un comportement (repas, pollinisation, dispersion, hibernation ou migration, plante adulte, fructification) donne **1 page** et révèle un besoin caché d'une espèce qui dépend de celle observée (le ver mange → indice du hérisson). Aujourd'hui, le comportement est compté dès qu'il a lieu en jeu actif, même hors de l'écran.
- **Odile** : bulle de 2 lignes au plus, toujours fermable, une à la fois (file d'attente). Tutoriel du 4.4 déclenché par l'état de l'île (pas par le temps seul), réaction à chaque première venue, annonce et fin des événements, départs (« il lui manquait… »), hiver, mission remplie. **Blocage** : 5 min sans nouvelle espèce → elle propose un indice gratuit sur l'espèce la plus proche de venir.
- **Jauge de succession** : en haut à droite, nombre de conditions remplies ; elle s'illumine quand tout est prêt. Le passage reste un geste du joueur (« Passer à la Lisière »), suivi de la cinématique de papier qui se replie et se redéplie, puis d'une coupure pub. Le panneau détaille aussi l'harmonie en 4 parts. Après la Lisière : la jauge mène au teaser de la Jeune forêt (voir sprint 5 bis).
- **Météo** : pastille qui annonce l'événement 30 s avant, puis le temps restant.
- **Pubs** (`ads.js`, simulateur de 3 s en attendant les kits des portails ; le jeu est en pause pendant la pub) : récompensées dans le panneau Bonus (pluie bienfaisante, sève double, prolonger l'événement), dans le carnet (indice du naturaliste, 3 par jour) et sur l'écran de retour (retour doublé). Pluie bienfaisante : humidité +30 sur les tuiles et dans l'air, qui revient à la normale en un jour environ. Prolonger : +1 jour, sans dépasser la fin de la saison. Coupures : au passage d'étape et au changement de saison, jamais dans les 2 premières minutes, au moins 3 min d'écart, jamais pendant une action choisie ou un panneau ouvert.
- **Sauvegarde** : `localStorage` toutes les 10 s et quand la page se cache. Au retour (page rouverte, ou onglet caché plus d'une minute), la progression hors ligne est calculée et l'écran « Pendant ton absence » s'affiche.
- **Téléphone** : mise en page portrait (menu en colonne à droite, barre d'actions qui défile), tactile (toucher pour agir, glisser pour tourner, pincer pour zoomer).
- **Tests** : `tools/test-jeu.js` joue à la souris et au doigt dans Chromium (semer, refus, panneau de tuile, photo, carnet, mission, pub, passage à la Lisière, retour, sauvegarde, téléphone) : 25 vérifications, aucune erreur.

Précisions du sprint 5 bis :
- **Économie de la sève** : plafond de réserve par étape, rendement décroissant, hors ligne par paliers (4.3 et 6.2). La pub « Sève double » est grisée quand la réserve est pleine à 90 %.
- **Sécheresse durcie** (5.1) : l'humidité moyenne tombe de 47 à 21 (avant : 29) ; aucune espèce perdue en moyenne, récompense toujours obtenue par le joueur automatique.
- **Teaser de la Jeune forêt** : une fois la Lisière atteinte, la jauge devient « Vers la Jeune forêt » avec les conditions du GDD 2 (8 bouleaux adultes ; mi-ombre, ombre ≥ 20, sur 10 % de l'île ; le renard présent depuis une saison ; 12 espèces ; 25 % de terrain ouvert). Choix de Claude : l'ombre « ≥ 30 sur 20 % » du GDD n'est jamais atteinte avec 10 bouleaux espacés (7 % au mieux), d'où la mi-ombre sur 10 % ; à revoir quand la Jeune forêt sera construite. Quand tout est réuni, un **jeune chêne** germe sur la tuile libre la plus ombragée à côté d'un bouleau adulte (il sort de terre en 1 min, garde ses feuilles sèches en hiver), avec un message, une bulle d'Odile et la jauge « La suite pousse… ». On ne change pas d'étape. Joueur automatique : chêne vers 1 h 14 de jeu, dans 20 parties sur 20.
- **Images par seconde** dans les réglages : moyenne et pire seconde des 30 dernières, définition actuelle (pour les tests sur téléphone).
- Tests : 167 pour `core.js`, 542 pour les modèles, 32 vérifications dans le navigateur.

Précisions du sprint 6 (retours de Christophe après ses premiers tests) :
- **Barre d'actions** : compacte (boutons de 60 px, 52 px sur téléphone) et centrée ; les aménagements encore verrouillés sont rangés derrière un seul bouton « À débloquer » (+4). L'aide d'une action s'efface seule après 3,5 s.
- **Bord de l'île** : le cône sombre sous l'île (l'« ombre » étrange) est retiré ; la tranche est une carte de papier crème puis kraft, éclairée doucement.
- **Pose en glissant** : avec Herbe, Fleurs, Paillis, Ronce ou Retirer, maintenir le clic ou le doigt et glisser pose sur chaque tuile traversée (seulement là où ça marche ; si rien ne marche, un seul refus expliqué). Retirer en glissant n'enlève que ce qui ressemble à la première tuile touchée. Les aménagements (mare, hôtel, tas, bouleau, nichoir) restent à l'unité.
- **Caméra** : plus proche (on voit les animaux), animaux et nuées 35 % plus gros, fleurs plus grandes. En observation, glisser **déplace** la vue ; clic droit (ou Maj) + glisser pour tourner, molette pour zoomer ; au doigt, deux doigts pour zoomer, tourner et déplacer ; boutons ⟲ ⟳ et « recentrer » ; flèches ou ZQSD au clavier.
- **Moins de fenêtres** : une seule bulle à la fois en bas de l'écran ; le fil du journal n'est plus à l'écran (onglet journal du carnet) ; plus de bandeau pour les comportements, les débuts d'événement, les photos déjà faites ; mission remplie : un seul bandeau ; réactions d'Odile aux espèces rangées dans le journal.
- **Guide des premières minutes** (remplace les bulles du tutoriel de la Prairie, 7 étapes) : accueil → semer 3 fleurs → hôtel à insectes → tas de pierres → mare → 3 paillis → jauge. À chaque étape, une main montre le bouton à toucher puis, sur l'île, les tuiles dorées où la pose marche (avec un geste de glissé pour les semis). Si la sève manque, le guide affiche « x / coût ». Les étapes se valident d'après l'état de l'île (on peut les faire dans le désordre) ; on peut passer le guide (×). Astuce unique de récolte quand la première capsule de graines est mûre.
- **Montrer le résultat** : à la première venue d'une espèce, une étiquette s'affiche au-dessus d'elle sur l'île (« Nouvelle espèce : … » et, pour la sauterelle, l'abeille, le lapin, le ver et l'alouette, pourquoi elle est venue) ; pendant le guide, la caméra glisse jusqu'à elle.
- **Graphismes** : herbe verte et dense (3 touffes par tuile, brins éclairés doucement), herbe sèche seulement quand le sol est vraiment sec, sol kraft plus chaud et moins tacheté, arêtes de pli légèrement plus sombres sur les modèles, grain de papier et halo doux sur le fond.
- **Sève et herbe** (second retour du 31/10 : « la sève met trop de temps, on attend pour remplir la carte d'herbe ») : semer de l'herbe coûte 3 sève au lieu de 5, l'herbe produit 0,015 sève/s par tuile au lieu de 0,01, et s'étend seule un peu plus vite (0,2 par jour au lieu de 0,15). Un joueur qui ne sème que de l'herbe couvre 60 % de l'île en 3 min au lieu de 7. La Lisière reste à 16:17 en médiane (simulation de 20 parties), car elle dépend surtout des espèces et de l'harmonie. Le compteur de sève affiche son débit (« +1,0/s »).
- **Retours 3 (31/10)** :
  - **Graines** : toucher une capsule ramasse aussi les capsules mûres voisines (rayon 3) ; un bouton doré « Récolter (n) » au-dessus de la barre ramasse toute l'île d'un coup. Les capsules passent avant les animaux au clic. Le guide explique à quoi servent les graines (semer fleurs, ronces, bouleaux).
  - **Bouleaux** : adultes en 5 jours de jeu (20 min) au lieu de 12 (48 min). Le panneau d'une jeune plante montre sa croissance (« 40 % · adulte dans ~12 min ») ou ce qui la bloque (souvent l'ombre de bouleaux trop serrés) ; Odile l'explique une fois ; le refus du nichoir dit dans combien de temps le premier bouleau sera adulte. Simulation : Lisière 16:17 en médiane, chêne teaser vers 51 min.
  - **Clics** : les bulles (guide, Odile, aides, bandeaux) laissent passer les clics vers l'île, seuls leurs boutons sont cliquables (une règle CSS rendait cliquables même les bulles invisibles, au-dessus de la barre : c'était la zone « morte » près du menu, et la cause des boutons d'indice d'Odile impossibles à toucher). Zone de clic des animaux resserrée. Les panneaux redessinés toutes les 0,5 s ne remplacent plus leurs boutons si rien n'a changé.
  - **Graphismes** : sol adouci (chaque triangle mêle la couleur de sa tuile et celle des tuiles voisines), brins d'herbe moins sombres ; de loin, moins de touffes puis aucune, et plus d'arêtes de pli : l'île dézoomée reste lisible.
- Textes du guide écrits par Claude en français et en anglais (`interface-*.json`, rubriques `guide`, `camera`, `barre`, `arrivee`, `peinture`).
- Tests : 167 (`core.js`), 542 (modèles), 41 vérifications dans le navigateur (dont semis en glissant, déplacement, guide, pince à deux doigts sans semer).

Précisions du sprint 8a (rendu WebGL, `src/moteur3d.js`, Three.js r160) :
- **Three.js inclus dans le fichier du jeu** : `vendor/three/` (licence MIT), transformé en script classique par `tools/three-global.js` à la construction. Le jeu reste un seul fichier HTML, sans rien à charger ailleurs (1,1 Mo au lieu de 480 Ko ; on pourra l'alléger au sprint 8c).
- **Même façon de dessiner** : `rendu.js` appelle toujours `add(modèle, x, y, z, ...)` ; le moteur WebGL convertit chaque modèle origami une fois, puis dessine toutes ses copies d'un coup (instances). Toute la logique de `rendu.js` (saisons, météo, animaux, populations, Odile, effets) est conservée telle quelle.
- **Lumière** réglée pour retrouver les couleurs du Canvas 2D (0,58 à l'ombre, 1,10 en plein soleil, faces douces jamais grises), avec de **vraies ombres portées** (arbres, ronces, animaux, cabane ; l'herbe et les fleurs les reçoivent sans en projeter). Une part du soleil ne projette pas d'ombre, pour des ombres douces de maquette. Le soleil traverse le ciel au fil de la journée (les ombres tournent), la lune revient la nuit.
- **Sol** : un seul maillage, couleurs recalculées à chaque image (eau qui miroite). **Décalques** (carte des habitats, survol, guide, anneaux, paille, sol craquelé, graines au sol) : polygones posés juste au-dessus du sol. **Pluie, neige, pétales, feuilles** : petites cartes de papier dans la scène, cachées par les arbres.
- **Deux calques 2D** autour du canvas WebGL : le ciel derrière ; devant, les étoiles des spécimens rares, les « z » du hérisson, l'éclair et la brume de chaleur. Ils ne captent pas les clics.
- **Caméra** : celle d'engine.js reste la référence (clics, bulles, repères) ; la caméra Three.js en recopie exactement la projection (écart mesuré : 0 pixel).
- **Repli** : sans WebGL (ou sans Three.js), le jeu reprend l'ancien moteur Canvas 2D ; `?canvas2d` dans l'adresse le force. Les réglages (images par seconde) affichent le moteur utilisé. Les vignettes de l'interface restent dessinées en Canvas 2D.
- **Pas encore** : arêtes de pli marquées (le Canvas 2D les dessinait de près) ; elles reviennent au sprint 8b avec le rendu papier.
- **Mesures** : processeur par image sur une île de 2 h, 3 ms en WebGL contre 67 ms en Canvas 2D (sans le cache du fond) ; environ 70 commandes de dessin et 12 000 triangles.
- **Tests** : `tools/test-webgl.js` (14 vérifications : WebGL choisi, calques, caméra identique, clic qui sème, 5 scènes avec ombres, repli Canvas 2D sans Three.js et avec `?canvas2d`, aucune erreur). Le navigateur de test n'a pas de carte graphique (3 images par seconde en WebGL) : `tools/test-jeu.js` teste donc l'interface avec le moteur Canvas 2D (`--webgl` pour forcer WebGL).

Précisions du sprint 8b (rendu papier, `src/moteur3d.js`) :
- **Grain et fibres du papier** sur toutes les faces et sur le sol : une texture de papier (grain, taches, fibres) fabriquée par le code au lancement, posée selon les coordonnées propres à chaque modèle (le motif ne « glisse » pas quand un animal bouge). Force : ±8 % de luminosité.
- **Arêtes de pli** : le bord de chaque face est assombri de 17 % sur un trait d'un pixel (les diagonales internes des faces ne sont pas marquées). Elles s'effacent de loin (caméra au-delà de 34) pour que l'île dézoomée reste calme. Pas sur les faces douces (brins, feuilles), comme en Canvas 2D.
- **Ombre de contact** : le pied des modèles (40 premiers centièmes de hauteur) est jusqu'à 26 % plus sombre (18 % pour l'herbe) : les objets semblent posés, pas flottants.
- **Eau** : reflet de la couleur du ciel, plus fort quand on la regarde de biais ; petites ondes ; étincelles de soleil qui dérivent (le jour seulement) ; plus sombre la nuit.
- **Nuit** : la cabane d'Odile éclaire autour d'elle (lumière chaude, portée 7,5 tuiles), des étoiles scintillent dans le ciel (sauf par orage), pétales, feuilles et flocons s'assombrissent avec la nuit.
- **Effet maquette** : l'image est dessinée dans une image intermédiaire, puis le haut et le bas sont légèrement flous (13 échantillons), plus fort quand on voit l'île entière, discret de près. La bande nette suit le centre de la vue.
- **Qualité qui baisse seule** : qualité 2 (tout), 1 (sans effet maquette), 0 (sans ombres portées). Les téléphones démarrent en qualité 1. Si l'appareil passe sous 45 images/s : d'abord sans effet maquette, puis définition plus basse, puis, sous 32 images/s, sans ombres. Les réglages affichent la qualité. `?qualite=0`, `1` ou `2` dans l'adresse la fixe (tests, comparaisons).
- **Correction** : depuis le sprint 8a, un contour au sol (survol, guide, carte) faisait redimensionner le rendu à chaque image ; corrigé (gain de fluidité pendant la pose).
- **Pluie, neige, pétales en 3D** : faits dès le sprint 8a.
- **Tests** : `tools/test-webgl.js` passe à 19 vérifications (matériaux papier compilés, effet maquette actif sur ordinateur, lampe allumée la nuit, qualité qui baisse par paliers, capture de près).

Précisions du sprint 8c (vie et mouvement, `src/moteur3d.js`, `src/rendu.js`, `src/game.js`) :
- **Vent** calculé par la carte graphique : chaque copie d'herbe, de fleur, de ronce ou d'arbre plie selon le carré de sa hauteur (le pied ne bouge pas). Souplesse par plante (herbe 0,55, fleurs 0,32, jeune chêne 0,035, ronce 0,04, bouleau 0,016 ; `VENT` dans `rendu.js`). Les touffes voisines ondulent ensemble, comme une vague qui traverse la prairie, et une rafale lente passe sur l'île. Les **ombres portées** des arbres et des ronces bougent avec eux. Force : brise ordinaire 1, nuit 0,75, hiver 0,8, nuages qui s'annoncent 1,6, orage 2,6, sécheresse 0,45 (air immobile) ; la direction tourne lentement. Le moteur Canvas 2D (repli) reste immobile.
- **Prairie dense** en WebGL : de près (caméra à moins de 20), 6 touffes par tuile au lieu de 3.
- **Objets qui se déplient** à la pose, comme dans un livre animé : tas de pierres, hôtel, tas de bois, nichoir, ronce, bouleau se relèvent en 0,85 s avec un petit dépassement, et un anneau de papier s'ouvre au sol ; herbe et fleurs semées poussent en 0,5 s ; une mare creusée fait une onde.
- **Passage d'étape en 3D** : l'île elle-même se replie (les objets se couchent du bord vers le centre, le sol redevient une page crème) pendant que la caméra tourne lentement ; le titre de l'étape s'affiche sur une carte de papier en haut de l'écran, sans cacher l'île. Au bouton « Continuer », tout se redéplie du centre vers le bord. En Canvas 2D, l'ancienne cinématique (deux volets de papier) est gardée.
- **Qualité automatique par paliers** (7 paliers : effet maquette, définition ×2 → ×0,75, herbe dense, ombres portées). Ordinateur : palier 1 (tout). **Téléphone : palier 3** (sans effet maquette, définition ×1,5, ombres de 1 024 px). Moins de 45 images/s → palier suivant (au plus toutes les 3 s) ; plus de 57 images/s pendant 15 s → on remonte d'un palier, sauf vers un palier qui a déjà échoué deux fois (pas de va-et-vient) ; rien pendant une pub ou onglet caché. Les réglages affichent le palier (« palier 3 sur 7, réglé seul »). `?qualite=0/1/2` fixe toujours la qualité.
- **Fichier allégé** : 827 Ko au lieu de 1 164 Ko (242 Ko une fois compressé par le serveur). Three.js réduit aux 31 pièces utilisées (`vendor/three/three.biome.min.js`, 504 Ko au lieu de 655, produit par `tools/alleger-three.js`, à relancer seulement si `moteur3d.js` utilise une nouvelle pièce de Three.js) ; nos scripts et la feuille de style compactés à la construction si esbuild est présent (`--lisible` pour les garder tels quels, `--three-complet` pour la version entière de Three.js). La construction n'a toujours besoin d'aucun outil externe.
- **Tests** : `tools/test-webgl.js` passe à 28 vérifications (vent compilé, ombres au vent, île qui bouge à l'arrêt, dépliage d'un tas de pierres, pli et dépli de l'île, paliers sur ordinateur, sur téléphone et sur un appareil lent, taille du fichier). Fluidité réelle toujours à vérifier par Christophe (pas de carte graphique ici).

### 10.5 Ordre de travail (une conversation par sprint)

| Sprint | Contenu | Qui |
|---|---|---|
| 0 | Consignes 1 et 2 dans ChatGPT (en parallèle des sprints 1 et 2) | Christophe + ChatGPT |
| 1 | `core.js` v2 : tuiles, statistiques, conditions, `validate.js` ; intégration des fiches de ChatGPT | Claude |
| 2 | Arrivées, départs, capacités, chaîne alimentaire ; `sim-headless.js` ; premier équilibrage | Claude |
| 3 | Temps, saisons, 3 événements, papiers rares ; textures journal et washi | Claude |
| 4 | Modèles origami des 9 nouvelles espèces, rendu des tuiles (eau, ronce, paillis) ; textures journal et washi (fait le 31/10) | Claude |
| 5 | Interface : carnet, photos, missions, barre d'actions, jauge de succession ; consigne 05 (anglais de la garde, des missions et de l'interface) (fait le 31/10) | Claude, puis ChatGPT |
| 5 bis | Économie de la sève, sécheresse, chêne teaser, images/s (fait le 31/10) | Claude |
| 6 | Test de jeu par Christophe et ses proches, retours, corrections (première série de corrections faite le 31/10 : barre, bord de l'île, pose en glissant, guide, caméra, graphismes) | Christophe, puis Claude |
| 7 | Gameplay actif : l'île se dérègle, coups de pouce, voisinages et carte des habitats, demandes des habitants, effets visibles (fait le 31/10, section 12) | Claude |
| 8a | Moteur WebGL à l'identique : instances, sol, décalques, vraies ombres portées, soleil qui tourne, repli Canvas 2D (fait le 31/10) | Claude |
| 8b | Rendu papier : grain et fibres sur les faces, arêtes de pli, ombre de contact, eau qui reflète le ciel, effet maquette, vraie nuit (lumière de la cabane, étoiles), qualité qui baisse seule (fait le 31/10) | Claude |
| 8c | Vie et mouvement : herbe dense qui ondule, arbres qui se balancent, aménagements qui se déplient à la pose, passage d'étape en 3D, qualité automatique pour téléphones, fichier allégé (fait le 31/10) | Claude |

### 10.6 Critères de réussite (mesurés par simulation et par les tests)
- Première arrivée d'espèce en moins de 30 s ; un événement visible toutes les 60 s au moins.
- Lisière atteinte entre 12 et 20 minutes par un joueur moyen.
- Les 14 espèces sont toutes venues au moins une fois dans 90 % des simulations de 1 h.
- Aucune espèce n'oscille sans fin entre arrivée et départ (au plus 2 départs par heure par espèce dans une île bien tenue).
- En test : au moins 3 testeurs sur 5 savent expliquer pourquoi un animal est venu, et veulent continuer après 15 min.
- 60 images par seconde sur un téléphone moyen avec 30 agents.

---

## 11. Décisions de Christophe (30/10)

1. **Incendie** : gardé, détaillé en section 5.2, désactivable dans les réglages.
2. **Prédation** : visible, la proie disparaît dans un froissement de papier.
3. **Monnaie** : on garde « sève ».
4. **Missions** : un personnage, la garde forestière (section 1.9).
5. **Roblox** : 6 joueurs par serveur ; priorité à maximiser les achats, sans tirage opaque (section 7.4).

### Décisions du 31/10 (lancement du sprint 7)
6. **Gameplay actif** (réponse au constat « on ajoute les éléments et on attend ») : on fait, dans cet ordre, les pistes de `docs/idees-gameplay-agir.md` :
   1. **L'île se dérègle et le joueur répare** (surpâturage, ronces envahissantes, sécheresse à arroser, abri du hérisson avant l'hiver), avec les **coups de pouce actifs** qui vont avec (piste 4 : arroser, tailler, éloigner le renard, graines au sol) ;
   2. **L'endroit où l'on pose compte** : carte des habitats quand on choisit un aménagement, voisinages qui changent la taille des populations ;
   3. **Les habitants demandent** : bulles de besoin avec délai, récompense si on répond à temps, départ expliqué sinon ;
   4. **Voir l'effet de chaque geste** (piste 5), au fil de l'eau.
   Voir la section 12 (sprint 7) pour le détail.
7. **Choix de Claude du sprint 6 validés** : textes du guide et des aides écrits directement par Claude en français et en anglais ; réactions d'Odile aux espèces rangées dans le journal du carnet.
8. **Graphismes** : passage du rendu en **WebGL avec Three.js** juste après le sprint 7. D'ici là, aucune retouche graphique.

### Décisions du 31/10 au soir (lancement du sprint 8)
9. **Choix de Claude du sprint 7 validés** (12.7) : gestes Arroser et Graines au sol dès la Prairie, carte des habitats aussi pour les gestes et cachée pendant le guide, réglages de départ de `P.vie`, barre de 11 boutons.
10. **Découpage du chantier WebGL** en trois sprints (10.5) : 8a moteur à l'identique avec ombres, 8b rendu papier, 8c vie et mouvement.
11. **Fin de chaque étape** : Claude donne toujours à Christophe l'action à faire et le texte exact à coller pour lancer l'étape suivante (nouvelle conversation, consigne ChatGPT...).

Aucune question ouverte pour le moment.

---

## 12. Gameplay actif (sprint 7)

Réponse au constat de Christophe après le sprint 6 (« on ajoute les éléments et on attend »). Principe : l'île vit et se dérègle ; le joueur observe, comprend et répond. On ne place toujours jamais d'animal. Code : `src/core.js` (section « Sprint 7 », réglages dans `P.vie`), interface dans `src/game.js`, textes dans `data/textes/interface-*.json` (écrits par Claude en français et en anglais).

### 12.1 L'île se dérègle (piste 1)
Cinq problèmes, détectés toutes les 5 s. Un problème est annoncé après 2 constats de suite et réglé après 3 absences de suite (pas de clignotement). Il apparaît comme un **repère « ! »** sur l'île (orange, rouge s'il est grave) ; la première fois, Odile l'explique.

| Problème | Quand | Ce qui se passe si on ne fait rien | Solutions proposées |
|---|---|---|---|
| **Trop de lapins ici** (surpâturage) | moins de 5 tuiles d'herbe par lapin autour du terrier (rayon 3) : l'herbe s'use, jaunit (usure ≥ 0,35), puis devient du sol nu | l'herbe disparaît par plaques, les lapins finissent par partir | semer de l'herbe autour, retirer un abri ; en Lisière le renard régule |
| **Les ronces envahissent la prairie** (Lisière) | ronces ≥ 8 % de l'île (elles gagnent maintenant l'herbe, 0,12 tuile par jour, et le merle en sème) | la prairie d'un seul tenant rétrécit, l'alouette perd sa place | tailler |
| **Le sol sèche** | au moins 3 fleurs ou zones de vers à moins de 3 points de leur seuil d'humidité, ou une plante déjà en souffrance | fleurs qui reculent, vers qui partent | arroser, pailler, creuser une mare |
| **Un hérisson sans abri d'hiver** | en automne, plus de hérissons que de places d'hibernation (1 par tas de bois, 2 si au moins 2 ronces l'entourent) ; délai affiché jusqu'à l'hiver | au premier jour d'hiver, les hérissons en trop partent (« pas de place pour hiberner ») | ajouter un tas de bois |
| **Le renard vide le terrier** | renard présent, 4 lapins ou moins (hors hiver) | le renard n'a plus rien à chasser et part | éloigner le renard, un abri de plus, plus d'herbe |

Un problème réglé après au moins 20 s, avec un geste du joueur depuis son début, rapporte 1 page et 15 sève (au plus une fois par jour de jeu et par type).

### 12.2 Coups de pouce (piste 4)
Quatre gestes dans la barre, à côté des aménagements :

| Geste | Coût | Effet | Débloqué |
|---|---|---|---|
| **Arroser** (en glissant possible) | 8 sève | humidité +30 dans un rayon de 1,5, puis +25 sur l'équilibre pendant 1 jour | Prairie |
| **Graines au sol** | 2 graines | pendant 1 jour, merles et alouettes à moins de 7 tuiles viennent picorer (photos, demande « les merles ont faim ») | Prairie |
| **Tailler** (en glissant possible) | 2 sève | une ronce redevient de l'herbe (1 graine toutes les 2 tailles) | Lisière |
| **Éloigner le renard** | 20 sève, recharge 1 jour | pendant 1 jour, le renard ne chasse plus dans un rayon de 5 (cercle pointillé sur l'île) et s'installe ailleurs | Lisière |

### 12.3 L'endroit où l'on pose compte (piste 2)
**Voisinages qui changent les populations** :
- Tas de pierres : 1 place de lapin + 1 par 4 tuiles d'herbe dans un rayon de 2 (4 au plus) ; une tuile de ronce abrite 1 lapin. Au printemps, ×1,5 (les portées). L'herbe n'est plus un plafond global : c'est le surpâturage qui sanctionne.
- Hôtel à insectes : +20 % de pollinisateurs, jusqu'à +80 % avec 6 fleurs dans un rayon de 3.
- « Coin à vers » : capacité des vers ×0,7 de base, +0,4 près de l'eau, +0,3 avec 2 tuiles paillées, +0,2 avec 2 tuiles à mi-ombre.
- Alouettes : 1 par 25 tuiles de la plus grande prairie d'un seul tenant (herbe et fleurs reliées).
- Hérisson : places d'hiver (voir 12.1).

**Carte des habitats** : quand on choisit un aménagement ou un geste, chaque tuile où la pose est possible se colore (vert : la pose y sert beaucoup ; jaune : un peu ; gris : peu). Une légende dit pour quelles espèces et ce qui compte (« Plus il y a d'herbe tout près, plus le tas abrite de lapins »). Au survol, la valeur précise (« 4 places pour les lapins »). Pendant le guide, la carte reste cachée (les tuiles dorées suffisent).

### 12.4 Les habitants demandent (piste 3)
Une espèce présente peut faire une demande, avec un délai. Au plus 2 à la fois, pas avant 6 min de jeu, une occasion par minute (une chance sur deux), jamais pendant un événement ; une même demande ne revient pas avant 2 jours. Elle apparaît comme un **repère « ? »** vert sur l'île, avec un cercle qui se vide.

| Demande | Saison | Délai | Satisfaite quand | Sinon |
|---|---|---|---|---|
| Les merles cherchent où nicher | printemps | 2 jours | un nichoir de plus | un merle part |
| Les abeilles manquent de fleurs | printemps, été | 1,5 jour | 3 fleurs de plus autour de l'hôtel | la nuée fond de moitié |
| Les lapins cherchent un abri | printemps, été | 2 jours | un tas de pierres de plus | un lapin part |
| Les merles ont faim | hiver | 1,5 jour | un merle a picoré des graines au sol | un merle part |
| Les vers ont soif | été | 1 jour | humidité +12 sur leur coin | la population fond de moitié |

Récompense : 2 pages, 25 sève, 2 petits pour les merles et les lapins (+3 pour les nuées), et une chance sur trois qu'un individu prenne un papier rare (journal ou washi). Une demande dont l'espèce a quitté l'île est annulée.

### 12.5 Voir l'effet de chaque geste (piste 5)
- À la pose, un chiffre s'envole au-dessus de la tuile (« +3 places pour les lapins », « Humidité +30 », « Pollinisées : graines ×2 »).
- Au survol d'un animal, et quand on le photographie de nouveau : « Lapins : 4 / 6 · limité par les abris ».
- Le carnet affiche la même ligne pour une espèce présente.
- Le panneau d'une tuile dit si l'herbe est usée, si la tuile est arrosée ou porte des graines au sol.
- Un bouton **« À faire »** (en haut, avec le nombre) liste problèmes et demandes, avec leurs solutions et « Voir » (la caméra y va).

### 12.6 Mesures (joueur automatique, 20 parties de 60 min)
- Lisière en 16:49 en médiane (cible 12 à 20 min, inchangée) ; les 14 espèces venues dans 19 parties sur 20.
- Joueur attentif (répond après 20 s) : surpâturage 2,1 fois par partie, réglé en 4:35 ; sol sec 8,8 fois, réglé en 0:35 ; hérisson sans abri 1 fois, réglé en 2:40 ; demandes toutes satisfaites (environ 7 par heure).
- Joueur passif : surpâturage réglé seul en 10 à 12 min (l'herbe disparaît, les lapins partent) ; hérisson parti à l'hiver ; la plupart des demandes échouent.
- Les ronces envahissantes arrivent vers 60 à 70 min (3,8 fois en 90 min chez le joueur attentif, qui taille).

### 12.7 Choix de Claude (validés le 31/10)
- Les gestes « Arroser » et « Graines au sol » sont disponibles dès la Prairie ; « Tailler » et « Éloigner le renard » en Lisière.
- La carte des habitats colore aussi les gestes, et reste cachée pendant le guide.
- Réglages de départ (tous dans `P.vie`, faciles à changer) : seuils, délais, récompenses et coûts ci-dessus.
- Barre d'actions : 11 boutons visibles en Prairie (au lieu de 9) ; elle défile sur téléphone.
