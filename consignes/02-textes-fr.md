Tu es rédacteur pour « Biome, la forêt de papier », un jeu de gestion d'écosystème doux et contemplatif dans un monde en papier plié. Public : tout public dès 8 ans, joueurs de jeux web (Poki) et Roblox. Ton : chaleureux, précis, un brin poétique, jamais niais. Tutoiement. Exactitude naturaliste obligatoire (pas de fausse anecdote).

Le joueur n'achète jamais d'animaux : il aménage l'habitat et les espèces viennent seules. Un « carnet de terrain » montre les silhouettes des espèces pas encore venues et révèle leurs besoins un par un sous forme d'indices.

TÂCHE : écris tous les textes français pour les 14 espèces et les 3 événements ci-dessous, au format JSON exact.

Les fiches espèces (pour connaître leurs besoins, dans l'ordre) sont dans le fichier chatgpt/especes-prairie-lisiere.json du dépôt GitHub christopherivoal-sudo/biome-foret-papier. Lis-le d'abord.

Événements : floraison (printemps, les fleurs donnent deux fois plus de graines), orage (été, la terre se gorge d'eau, la foudre peut abattre un arbre qui devient du bois mort utile), secheresse (été, l'humidité baisse, il faut tenir).
Étapes : prairie (départ), lisiere (premiers buissons et bouleaux).

FORMAT DE RÉPONSE :
{
  "especes": {
    "<id>": {
      "nom": "nom courant en français",
      "nom_latin": "nom scientifique exact (pour herbe et fleurs : nom générique, ex. 'Poaceae')",
      "description": "≤ 140 caractères",
      "anecdote": "≤ 160 caractères, fait réel et vérifiable",
      "indices": [ "un indice par besoin, DANS LE MÊME ORDRE que le tableau besoins de la fiche, ≤ 90 caractères, qui suggère le besoin sans donner le chiffre" ],
      "comportements": { "arrivee": "≤ 80", "<comportement>": "≤ 80" },
      "depart": "≤ 80 caractères, doit contenir {manque}"
    }
  },
  "evenements": { "<id>": { "nom": "", "annonce": "≤ 80", "fin": "≤ 80" } },
  "etapes": { "<id>": { "nom": "", "titre_passage": "≤ 50", "texte_passage": "≤ 140" } }
}

Comportements à écrire selon l'espèce (clé : texte) :
- toutes : "arrivee"
- qui mangent quelque chose : "repas"
- pollinisateurs : "pollinisation" ; disperseur (merle) : "dispersion"
- qui hibernent ou migrent : "hiver"
- plantes : "pousse" et "adulte" ; champignon : "fructification"

RÈGLES :
- Le fichier contient UNIQUEMENT le JSON valide, sans texte autour.
- Les clés <id> sont exactement celles des fiches.
- Le nombre d'indices est exactement le nombre de besoins de chaque fiche.
- Respecte les longueurs maximales (compte les caractères).
- Pas d'emoji. Guillemets typographiques français « » autorisés dans les textes.

SORTIE (obligatoire, pour économiser les échanges) :
- Écris ta réponse complète dans le dépôt GitHub christopherivoal-sudo/biome-foret-papier, fichier `chatgpt/textes-fr.json` (crée-le ou remplace-le), branche main.
- Dans la conversation, réponds UNIQUEMENT par une ligne : « Fait : chatgpt/textes-fr.json » suivie, si besoin, d'une ligne de remarques (doutes, choix faits). N'affiche pas le contenu du fichier dans la conversation.
- Si tu ne peux pas écrire dans le dépôt, fournis le fichier `textes-fr.json` à télécharger, sans l'afficher.
