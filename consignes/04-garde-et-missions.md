# Consigne 04 : la garde forestière et ses 10 missions

Tu écris DEUX fichiers dans le dossier `chatgpt/` du dépôt christopherivoal-sudo/biome-foret-papier :
1. `chatgpt/missions.json` : la mécanique des 10 missions ;
2. `chatgpt/garde-fr.json` : tous les textes de la garde forestière, en français.

Ne modifie aucun autre dossier. Quand c'est fini, réponds en une ligne : « Fait : chatgpt/missions.json et chatgpt/garde-fr.json ».

## À lire d'abord
- `docs/gdd-biome-v2.md` : sections 1.6, 1.7, **1.9 (la garde forestière)**, 4.2 (actions), 4.4 (déroulé des 15 premières minutes), 5.1 (événements), 8.2 (conditions).
- `data/especes/*.json` : les 14 espèces (identifiants, besoins).
- `data/textes/fr.json` : le ton déjà employé dans le carnet.

## Le personnage
Odile, la garde forestière : figurine origami en papier kraft, chapeau à large bord, jumelles, carnet sous le bras. Elle vit dans une cabane au bord de l'île. Ton : chaleureux, malicieux, naturaliste passionnée, jamais moralisatrice, jamais niaise. Elle tutoie le joueur. Public : tout public dès 8 ans. Exactitude naturaliste obligatoire. Pas d'emoji.

## Fichier 1 : `chatgpt/missions.json`

Un tableau JSON de **10 missions** : 5 pour la Prairie, 5 pour la Lisière. Variées : construire, faire venir des espèces, observer et photographier, récolter, traverser un événement. Les missions doivent être faisables en 5 à 15 minutes et apprendre quelque chose sur l'écosystème.

Schéma d'une mission :
```
{
  "id": "minuscules_ascii_avec_underscores",
  "etape": "prairie" | "lisiere",
  "objectif": OBJECTIF,
  "recompense": { "seve": nombre, "graines": nombre, "pages": nombre }
}
```
Récompenses : sève entre 20 et 150, graines entre 0 et 5, pages entre 0 et 2. Tous les champs de récompense sont présents (mets 0 si besoin).

OBJECTIF est l'un des deux formats suivants :

A. Un état de l'île à atteindre (toutes les conditions vraies en même temps), avec le langage de conditions de la section 8.2 du GDD :
```
{ "type": "etat", "conditions": [ condition, ... ] }
```
Conditions autorisées ici : `couvert`, `couvert_nb`, `stat` (portée `ile` seulement), `amenagement` (portée `ile`), `espece` (portée `ile`), `arbre_adulte`, `nb_especes`, `harmonie`. N'utilise jamais la portée `zone`.

B. Un compteur d'actions ou d'observations :
```
{ "type": "compteur", "quoi": QUOI, "id"?: identifiant, "nombre": entier ≥ 1, "moment"?: ["jour"|"nuit"|"crepuscule"], "nouvelle"?: true }
```
QUOI parmi :
- `photo` : photographier un individu (`id` = espèce, facultatif) ;
- `arrivee` : arrivées d'espèces (`nouvelle: true` = espèces jamais venues avant) ;
- `semis` : semer ou planter (`id` = espèce semée, facultatif) ;
- `construction` : poser un aménagement (`id` parmi tas_pierres, mare, hotel_insectes, paillis, tas_bois, nichoir) ;
- `recolte` : graines récoltées (nombre de graines) ;
- `evenement` : traverser un événement jusqu'au bout (`id` parmi floraison, orage, secheresse).

Identifiants autorisés : uniquement les 14 espèces de `data/especes/`, les aménagements ci-dessus et les 3 événements. N'invente rien d'autre. Une mission Prairie ne doit utiliser que des espèces et aménagements de la Prairie. Aucune valeur `null`.

## Fichier 2 : `chatgpt/garde-fr.json`

```
{
  "garde": {
    "nom": "Odile",
    "tutoriel": { CLÉ: "texte", ... },
    "reactions": { "<id espèce>": "texte", ... },
    "alertes": { CLÉ: "texte", ... },
    "indices": { "blocage": "texte", "pub_naturaliste": "texte" }
  },
  "missions": {
    "<id mission>": { "titre": "texte", "texte": "texte", "reussite": "texte" }
  }
}
```

**tutoriel** : une bulle par étape du déroulé du GDD 4.4, avec exactement ces clés :
`accueil`, `carnet`, `sauterelles`, `semer_fleurs`, `besoin_partiel`, `hotel`, `alouette`, `abri_lapin`, `premiere_nuit`, `mare_paillis`, `harmonie`, `lisiere`.

**reactions** : une phrase par espèce (les 14), dite par Odile à la première arrivée de l'espèce. Elle peut glisser un détail naturaliste.

**alertes** : clés exactes `floraison`, `orage`, `secheresse`, `fin_evenement`, `nouvelle_mission`, `mission_reussie`, `depart_espece` (doit contenir `{manque}`), `nuit`, `hiver`, `retour_hors_ligne` (doit contenir `{nombre}`, le nombre d'espèces venues pendant l'absence).

**indices** : `blocage` (aucune nouvelle espèce depuis 5 minutes, elle propose un indice gratuit) et `pub_naturaliste` (elle propose de regarder une pub pour révéler un besoin caché ; honnête et sans pression).

**missions** : pour chacune des 10 missions de `missions.json`, même identifiant : `titre` (le nom), `texte` (ce qu'il faut faire, dit par Odile, sans chiffre caché : si la mission demande 4 fleurs, le texte dit 4), `reussite` (sa réaction).

Longueurs maximales (compte les caractères) : tutoriel ≤ 90 ; reactions ≤ 80 ; alertes ≤ 80 ; indices ≤ 90 ; titre ≤ 40 ; texte ≤ 90 ; reussite ≤ 80. Variables autorisées uniquement : `{manque}`, `{nombre}`, `{joueur}`.

## Règles
- Deux fichiers JSON valides, sans commentaire, sans texte autour.
- Les clés sont exactement celles demandées.
- Respecte les longueurs maximales.
- Pas d'emoji. Guillemets français « » autorisés.
