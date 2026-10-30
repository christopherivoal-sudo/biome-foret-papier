tircis : exception validée par Christophe le 30 octobre 2026 : quatre conditions de besoins sont conservées, sans modifier le schéma.
tircis : les deux conditions stat en zone de rayon 2 bornent une moyenne d'ombre entre 20 et 50 ; le code doit en plus vérifier qu'au moins trois mêmes tuiles ont chacune une ombre comprise entre 20 et 50.
lapin : l'abri doit être un tas_pierres OU une ronce dans un rayon de 4 ; le JSON retient tas_pierres, car les besoins sont conjonctifs et ne permettent pas cette alternative.
lapin : la capacité JSON reste d'un lapin pour cinq tuiles d'herbe, maximum douze ; la limitation supplémentaire par les abris, ronces comprises, doit être combinée dans le code (le GDD indique quatre lapins au plus par abri).
merle : la capacité de base est d'un merle pour deux tuiles de ronce, maximum six ; proposition initiale à tester : ajouter une place par nichoir, tout en conservant ce maximum, car capacite ne permet pas de combiner couvert et aménagement.
ronce : les mûres sont disponibles en été et en automne ; les saisons de reproduction ne constituent pas un filtre saisonnier des ressources alimentaires.
merle : l'interaction mange ciblant ronce concerne seulement les mûres disponibles en été et en automne, sans consommer ni supprimer la tuile de ronce.
merle : l'interaction disperse sème gratuitement une ronce sur une tuile admissible respectant ses besoins ; le coût de semis de la ronce concerne uniquement le joueur.
bouleau : les interactions fertilise représentent la chute des feuilles et doivent être déclenchées en automne uniquement ; le schéma des interactions ne comporte pas de saison.
ver : les cibles végétales des interactions fertilise désignent le sol de leur habitat, pas une augmentation directe de leur population ; le code doit aussi permettre de fertiliser le sol nu, sans exiger la présence de ces plantes et sans cumuler quatre fois le même effet sur une tuile.
coulemelle : les cibles végétales des interactions fertilise désignent le sol de leur habitat ; le code doit aussi permettre de fertiliser le sol nu, sans exiger la présence de ces plantes et sans cumuler quatre fois le même effet sur une tuile.
coulemelle : le code doit accepter un bouleau OU un tas_bois dans un rayon de 2 ; le JSON retient tas_bois conformément à la consigne, et la capacité doit également fonctionner lorsque seul le bouleau fournit la litière.
coulemelle : le mycélium reste actif toute l'année ; la fructification visible est limitée à l'automne, indépendamment de saisons_actives.
herbe : extension_par_jour s'applique aux tuiles voisines admissibles ; reproduction et croissance ne doivent pas déclencher deux fois la même extension.
abeille : les saisons et l'activité décrivent les périodes d'activité ; l'hibernation ne doit pas provoquer un départ pour absence d'activité ou de fleurs.
herisson : l'hibernation suspend activité et alimentation ; elle ne doit pas provoquer un départ pour absence de proies saisonnières.
tircis : l'absence d'activité en automne et la dormance hivernale ne doivent pas être traitées comme une perte d'habitat provoquant un départ.
ronce : la dormance hivernale conserve le couvert et sa fonction d'abri ; elle ne doit pas supprimer l'abri des lapins, hérissons, merles et renards.
