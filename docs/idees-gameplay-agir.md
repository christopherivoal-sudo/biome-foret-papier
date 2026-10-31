# Biome : idées pour que le joueur agisse vraiment (31/10)

Copie de la note `claude/idees-gameplay-agir.md` du projet claude.ai (pour les sessions qui n'ont accès qu'au dépôt).

Constat de Christophe après le sprint 6 : « il suffit d'ajouter les éléments au fur et à mesure et d'attendre ». Aujourd'hui, l'île ne se dérègle presque jamais, et le joueur ne voit pas l'effet de ses choix de placement. Le problème : chaque action est un achat qui coche une case, il n'y a ni décision à prendre ni problème à régler.

Principe proposé : l'île vit et se dérègle ; le joueur observe, comprend et répond. On garde la règle d'or « on ne place jamais d'animal ».

## 1. L'île se dérègle : des problèmes à régler (recommandé)
La simulation sait déjà faire du surpâturage, des départs et de la prédation, mais le joueur ne le voit pas. On en fait des situations visibles, signalées sur l'île par une petite icône, avec une solution à trouver :
- **Trop de lapins** : l'herbe jaunit puis disparaît par plaques. Solutions : plus d'herbe, des ronces pour le renard, ou retirer un abri.
- **Ronces envahissantes** (semées par le merle) : elles mangent la prairie de l'alouette. Il faut tailler (glisser avec Retirer) ou équilibrer.
- **Sécheresse** : les tuiles sèchent, les vers et les fleurs souffrent. On arrose en touchant les tuiles (coût en sève, ou une mare à creuser vite).
- **Hiver qui approche** : le hérisson a besoin d'un tas de bois avant le premier jour d'hiver, sinon il part.
Effet recherché : un vrai « je dois faire quelque chose », avec des choix (quelle solution ?).

## 2. Le placement compte : vue des habitats et voisinages (recommandé)
- Quand on choisit un aménagement, une **carte de chaleur** montre où chaque espèce se plairait (vert : parfait, jaune : presque, gris : non) et ce que la pose changerait (« +2 places pour les lapins »).
- **Voisinages qui comptent** : fleurs près de l'hôtel = abeilles plus nombreuses ; mare + paillis + ombre = coin à vers ; prairie ouverte d'un seul tenant = alouettes. La taille des populations dépend de la qualité du coin.
- Effet : l'île devient un petit puzzle de paysage. Deux joueurs n'ont pas la même île.

## 3. Les habitants demandent (recommandé)
- Un animal présent affiche parfois une petite bulle de besoin, avec un délai : « Les merles cherchent où nicher (2 jours) », « Les abeilles manquent de fleurs ».
- Réponse à temps : bébés, spécimen rare plus probable, pages. Sinon : départ, qui reste expliqué.
- Effet : des objectifs courts et vivants, à la place des missions abstraites.

## 4. Coups de pouce actifs sur le vivant
Petits gestes avec un temps de recharge, sans jamais placer d'animal :
- **Arroser** une zone ;
- **Éloigner le renard** d'un coin pendant un moment pour protéger les lapins ;
- **Laisser des graines au sol** pour attirer les oiseaux à un endroit ;
- **Tailler, faucher** pour rouvrir la prairie.

## 5. Voir l'effet de chaque geste
- Chiffres qui s'envolent à la pose (« +15 humidité » autour de la mare) ;
- Jauges de population par espèce (actuelle / capacité) au survol d'un animal ;
- Le carnet dit ce qui limite une espèce (« 4 lapins sur 6 possibles : manque d'abris »).

## 6. Choisir, c'est renoncer
- L'île est petite : la prairie ouverte de l'alouette et les ronces du merle et du renard se disputent la place.
- Les étapes suivantes demandent une mosaïque (déjà dans le GDD) : on rend ces tensions visibles dès la Lisière.

## Proposition de Claude
Sprint 7 = idées 1, 2 et 3, dans cet ordre, puis 5 au fil de l'eau. L'idée 4 viendra avec les problèmes (arroser = réponse à la sécheresse).
