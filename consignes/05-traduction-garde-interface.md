# Consigne 05 : English translation of the ranger's lines, the missions and the game interface

You are a professional game localizer (French → English) for "Biome: The Paper Forest", a cozy ecosystem-building game in a folded-paper world, played on web portals (Poki, CrazyGames) and later Roblox, for all ages (8+). Tone: warm, precise, slightly poetic, never childish. Address the player as "you". Natural, idiomatic American English (not literal).

You write TWO files in the `chatgpt/` folder of the GitHub repository christopherivoal-sudo/biome-foret-papier (branch main). Do not modify any other folder.

## Read first
- `docs/gdd-biome-v2.md`, section 1.9 (Odile, the forest ranger) and section 4.2 (player actions).
- `data/textes/en.json`: the English texts already validated (species names, events, stages). Your words must match them.

## File 1: `chatgpt/garde-en.json`
Source: `chatgpt/garde-fr.json` (rubrics `garde` and `missions`).
- Same JSON structure and keys, translate only the values.
- `garde.nom` stays "Odile".
- Same maximum lengths as the French: tutorial, reactions, alerts and hints ≤ 80 characters each; mission `titre` ≤ 40, `texte` ≤ 90, `reussite` ≤ 80.
- Keep `{manque}` and `{nombre}` unchanged, in a natural place in the sentence.
- A mission text that gives a number keeps exactly that number.

## File 2: `chatgpt/interface-en.json`
Source: `data/textes/interface-fr.json` (buttons, counters, tooltips, notebook, missions panel, ads, return screen, event log).
- Same JSON structure and keys, translate only the values.
- Keep every `{variable}` unchanged (for example `{espece}`, `{etape}`, `{nombre}`, `{min}`, `{rayon}`), each exactly once if it appears once in the French.
- Keep it short: buttons and labels are read on a phone. Never more than 1.3 times the French length; button labels (`boutons`, `actions`) at most 18 characters when possible.
- French writes "(e)" or "(s)" for gender or plural ("est arrivé(e)", "graine(s)"). In English, write a natural sentence instead ("{espece} arrived.", "seed(s)" is fine only when nothing better fits).
- Variables are inserted as is: `{espece}` is a species name ("Hedgehog", "Wild bee"), `{etape}` is a stage name ("Meadow", "Forest edge"), `{papier}` is a paper name ("newspaper", "washi"). Build sentences that read well with them, for example "Go to the {etape}" → "Go to the Forest edge".
- `papiers.journal` = "newspaper" (the gray printed paper), `papiers.washi` = "washi", `papiers.calque` = "tracing paper", `papiers.dore` = "gold".
- `saisons`: "Spring", "Summer", "Fall", "Winter". `horloge` example: "Spring, day 2, year 1".

## Glossary (always use these)
sève = "sap", graines = "seeds", pages = "pages", carnet de terrain = "field journal", harmonie = "harmony", lisière = "forest edge", prairie = "meadow", jeune forêt = "young forest", garde forestière = "forest ranger", aménager = "build", semer = "sow", récolter = "harvest", tas de bois = "log pile", tas de pierres = "rock pile", hôtel à insectes = "bug hotel", mare = "pond", paillis = "mulch", nichoir = "nest box", ronce = "bramble", bouleau = "birch", spécimen rare = "rare specimen", carte de collection = "collection card", pub = "ad", publicité (simulée) = "ad (simulated)", succession = "succession".

## Rules
- Each file contains ONLY valid JSON, no text before or after, no comments.
- No emoji. No `null` values.

## Output (mandatory)
- Write `chatgpt/garde-en.json` and `chatgpt/interface-en.json` in the repository (create or replace), branch main.
- In the conversation, reply ONLY with one line: "Done: chatgpt/garde-en.json and chatgpt/interface-en.json", optionally followed by one line of remarks. Do not display the files.
- If you cannot write to the repository, provide the two files as downloads, without displaying them.
