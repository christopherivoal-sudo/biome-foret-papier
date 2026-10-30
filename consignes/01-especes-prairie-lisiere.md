Contexte complet du jeu (à lire si besoin) : docs/gdd-biome-v2.md dans le même dépôt.

Tu es game designer et naturaliste. Tu produis des données pour le jeu « Biome, la forêt de papier », un jeu de gestion d'écosystème : le joueur aménage une île en tuiles (grille, cercle de rayon 9 puis 11), il n'achète jamais d'animaux, les espèces viennent seules quand leurs besoins sont réunis. Un jour de jeu = 4 minutes, une saison = 3 jours. Les tuiles ont trois statistiques de 0 à 100 : fertilite, humidite, ombre. Couverts possibles : nu, herbe, fleurs, ronce, arbre, eau, roche, bois_mort, ouvert (= ni arbre ni ronce), vegetal (= herbe + fleurs).

TÂCHE : écris les 14 fiches espèces ci-dessous en JSON, en respectant EXACTEMENT le schéma. Les besoins, rôles et interactions sont déjà décidés : traduis-les fidèlement en conditions, et propose des valeurs chiffrées raisonnables pour ce qui n'est pas précisé (capacité, reproduction, intensité, production). Ce sont des premières valeurs ; elles seront testées en simulation.

SCHÉMA d'une fiche :
{
  "id": string, "etape": "prairie"|"lisiere",
  "categorie": "plante"|"animal"|"champignon"|"insecte",
  "mode": "tuile"|"population"|"agent",
  "venue": "semee"|"spontanee",
  "roles": [ "producteur"|"herbivore"|"insectivore"|"omnivore"|"predateur"|"decomposeur"|"pollinisateur"|"disperseur"|"ingenieur"|"abri" ],
  "activite": "jour"|"nuit"|"crepuscule"|"toujours",
  "saisons_actives": [ "printemps"|"ete"|"automne"|"hiver" ],
  "hiver": "actif"|"hiberne"|"migre"|"dormant",
  "besoins": [ condition, ... ],
  "capacite": { "par": "tuiles"|"amenagement"|"espece", "couvert"?: string, "id"?: string, "nombre": number, "max"?: number },
  "reproduction": { "saisons": [...], "portee_moyenne": number, "intervalle_jours": number },
  "interactions": [ { "type": "mange"|"pollinise"|"disperse"|"abrite"|"fertilise"|"evite"|"transforme", "cible": id, "intensite"?: 0..1, "plante"?: id } ],
  "production": { "seve_par_s": number, "pages_photo": 1 },
  "depart_apres_jours": number,
  "croissance"?: { "jours_adulte": n, "extension_par_jour": 0..1, "ombre_projetee": 0..100, "rayon_ombre": n, "cout_seve": n, "cout_graines": n },   // seulement pour les plantes
  "modele": même valeur que id,
  "palette": [3 couleurs hex de papier unies, réalistes pour l'espèce],
  "papiers_rares": ["journal","washi","calque","dore"]
}

CONDITIONS (champ "besoins") : liste d'objets parmi
- { "type":"couvert", "couvert":X, "min":fraction 0..1, "portee":"ile"|"zone", "rayon"?:n }
- { "type":"couvert_nb", "couvert":X, "min":nombre de tuiles, "portee":..., "rayon"?:n }
- { "type":"stat", "stat":"fertilite"|"humidite"|"ombre", "op":">="|"<=", "valeur":0..100, "portee":..., "rayon"?:n }
- { "type":"amenagement", "id":"tas_pierres"|"mare"|"hotel_insectes"|"paillis"|"tas_bois"|"nichoir", "min":n, "portee":..., "rayon"?:n }
- { "type":"espece", "id":X, "min":n, "portee":..., "rayon"?:n }
- { "type":"arbre_adulte", "id":X, "min":n }
- { "type":"saison", "dans":[...] }   { "type":"moment", "dans":["jour"|"nuit"|"crepuscule"] }
- { "type":"rayon_ile", "min":n }
"rayon" est obligatoire quand portee = "zone".

LES 14 ESPÈCES (id ; catégorie, mode ; venue ; besoins ; rôle ; interactions) :
PRAIRIE
1. herbe ; plante, tuile ; semee ; fertilite >= 5, ombre <= 60 ; producteur ; s'étend aux tuiles voisines, mangée par lapin et sauterelle. Coût 5 sève, 0 graine.
2. fleurs ; plante, tuile ; semee ; fertilite >= 20, humidite >= 20, ombre <= 40 ; producteur ; nourrit abeille et tircis. Coût 10 sève, 1 graine.
3. sauterelle ; insecte, population ; spontanee ; herbe >= 20 % de l'île ; actives printemps–automne, dormantes l'hiver ; herbivore ; mange l'herbe (faible), mangée par alouette et hérisson.
4. abeille ; insecte, population ; spontanee ; fleurs >= 6 tuiles sur l'île + 1 hotel_insectes dans un rayon de 6 ; jour, hors hiver (hiberne) ; pollinisateur ; pollinise fleurs (forte).
5. ver ; insecte (ver de terre), population ; spontanee ; humidite >= 35 et fertilite >= 15 dans un rayon de 3 ; décomposeur ; fertilise le sol, mangé par hérisson et merle.
6. lapin ; animal, agent ; spontanee ; herbe >= 30 % dans un rayon de 5 + (tas_pierres dans un rayon de 4 — la ronce compte aussi comme abri, ajoute-le en capacité) ; herbivore ; mange l'herbe, chassé par renard. Capacité : 1 lapin pour 5 tuiles d'herbe, max 12.
7. alouette ; animal (oiseau), agent ; spontanee ; sauterelle >= 4 sur l'île + couvert "ouvert" >= 40 % de l'île ; jour ; migre l'hiver ; insectivore ; mange sauterelles.
LISIÈRE
8. ronce ; plante, tuile ; semee (aussi semée par le merle) ; fertilite >= 25, ombre <= 70 ; abri + producteur ; abrite lapin, hérisson, merle, renard ; mûres en été/automne. Coût 20 sève, 2 graines.
9. bouleau ; plante (arbre pionnier), tuile ; semee ; fertilite >= 20, ombre <= 30 ; producteur ; ombre légère rayon 1.5, adulte en 12 jours, feuilles d'automne fertilisent. Coût 40 sève, 3 graines.
10. herisson ; animal, agent ; spontanee ; ronce >= 3 tuiles + tas_bois dans un rayon de 5 + ver présent dans un rayon de 6 ; nuit ; hiberne ; insectivore ; mange ver et sauterelle, évite renard.
11. merle ; animal (oiseau), agent ; spontanee ; ronce >= 2 tuiles + ver présent ; jour ; actif l'hiver ; omnivore + disperseur ; mange ver, tircis, et les mûres de la ronce ; disperse la ronce. Capacité augmentée par le nichoir.
12. renard ; animal, agent ; spontanee ; lapin >= 6 + ronce >= 4 tuiles + rayon_ile >= 11 ; crepuscule ; actif l'hiver ; prédateur ; mange lapin, évite rien. Capacité : 1 renard pour 4 lapins, max 2.
13. tircis ; insecte (papillon), population ; spontanee ; herbe >= 30 % + au moins 3 tuiles avec ombre entre 20 et 50 (exprime-le avec deux conditions stat en zone rayon 2) + fleurs >= 4 tuiles ; jour ; printemps et été, dormant l'hiver ; pollinisateur ; pollinise fleurs (moyenne), mangé par merle.
14. coulemelle ; champignon, tuile ; spontanee ; fertilite >= 35, humidite >= 40, et (bouleau OU tas_bois dans un rayon de 2 — choisis tas_bois comme condition, le bouleau sera géré par le code) ; toujours (fructifie en automne) ; décomposeur ; fertilise le sol.

RÈGLES :
- Le fichier contient UNIQUEMENT un tableau JSON valide de 14 objets, sans texte avant ni après, sans commentaire dans le JSON.
- Identifiants exactement comme ci-dessus. Aucune valeur null : omets les champs facultatifs sans objet.
- N'invente aucune espèce, aucun aménagement, aucun type de condition en dehors de ces listes.
- Chaque besoin doit être utile et compréhensible par un joueur (3 besoins maximum par espèce).

SORTIE (obligatoire, pour économiser les échanges) :
- Écris ta réponse complète dans le dépôt GitHub christopherivoal-sudo/biome-foret-papier, fichier `chatgpt/especes-prairie-lisiere.json` (crée-le ou remplace-le), branche main.
- Dans la conversation, réponds UNIQUEMENT par une ligne : « Fait : chatgpt/especes-prairie-lisiere.json » suivie, si besoin, d'une ligne de remarques (doutes, choix faits). N'affiche pas le contenu du fichier dans la conversation.
- Si tu ne peux pas écrire dans le dépôt, fournis le fichier `especes-prairie-lisiere.json` à télécharger, sans l'afficher.
