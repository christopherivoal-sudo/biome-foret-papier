You are a professional game localizer (French → English) for "Biome: The Paper Forest", a cozy ecosystem-building game in a folded-paper world, played on web portals (Poki, CrazyGames) and Roblox, for all ages (8+). Tone: warm, precise, slightly poetic, never childish. Address the player as "you". Natural, idiomatic English (not literal). British or American? Use American spelling.

TASK: translate the JSON below into English.

Source: file chatgpt/textes-fr.json in the GitHub repository christopherivoal-sudo/biome-foret-papier. Read it first.

RULES:
- Keep EXACTLY the same JSON structure and keys. Translate only the values.
- Do not translate "nom_latin" values (copy them as is).
- Keep {variables} like {manque} unchanged, in a natural position in the sentence.
- Respect the same maximum lengths as the French (description ≤ 140 chars, anecdote ≤ 160, each hint ≤ 90, messages ≤ 80, titre_passage ≤ 50, texte_passage ≤ 140). Shorter is fine.
- Use the standard English common name of each species (e.g. herisson → "Hedgehog", merle → "Blackbird", coulemelle → "Parasol mushroom", tircis → "Speckled wood", alouette → "Skylark", lapin → "Rabbit", renard → "Red fox", ronce → "Bramble", bouleau → "Birch", sauterelle → "Grasshopper", abeille → "Wild bee", ver → "Earthworm", herbe → "Meadow grass", fleurs → "Wildflowers").
- Glossary (always use these): sève = "sap", graines = "seeds", carnet de terrain = "field journal", harmonie = "harmony", lisière = "forest edge", prairie = "meadow", jeune forêt = "young forest", forêt ancienne = "old-growth forest", zone humide = "wetland", aménager = "build" / "set up", tas de bois = "log pile", tas de pierres = "rock pile", hôtel à insectes = "bug hotel", mare = "pond", paillis = "mulch", nichoir = "nest box".
- The file contains ONLY the valid JSON, no text before or after.

OUTPUT (mandatory, to save messages):
- Write the full result to the GitHub repository christopherivoal-sudo/biome-foret-papier, file `chatgpt/textes-en.json` (create or replace), branch main.
- In the conversation, reply ONLY with one line: "Done: chatgpt/textes-en.json", optionally followed by one line of remarks. Do not display the file content.
- If you cannot write to the repository, provide textes-en.json as a downloadable file, without displaying it.
