# Biome, la forêt de papier

Jeu de gestion d'écosystème en papier plié (web puis Roblox). Dépôt commun à Claude (architecte, code) et ChatGPT (contenu).

## Organisation
- `docs/` : document de conception (GDD). Référence pour tout le monde.
- `consignes/` : tâches pour ChatGPT, écrites par Claude. Une consigne = un fichier.
- `chatgpt/` : réponses de ChatGPT. **ChatGPT n'écrit que dans ce dossier.**
- `data/`, `src/`, `tools/` : données validées et code du jeu (Claude uniquement, à venir).

## Règles pour ChatGPT
1. Lire la consigne demandée dans `consignes/`, puis le GDD si besoin.
2. Écrire le résultat complet dans le fichier indiqué par la consigne, dans `chatgpt/`.
3. Dans la conversation, répondre en une ligne (« Fait : chemin du fichier »), sans afficher le contenu.
4. Ne jamais modifier les autres dossiers.
