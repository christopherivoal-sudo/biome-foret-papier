// Sprint 8 : Three.js (r160, licence MIT, vendor/three/) inclus dans le fichier HTML unique du jeu.
// Le fichier fourni est un module ES ; on le transforme en script classique qui crée window.THREE,
// pour garder la construction sans dépendance ni outil externe (GDD 6.1 et 10.4).
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function threeGlobal() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'three', 'three.module.min.js'), 'utf8');
  const i = src.lastIndexOf('export{');
  if (i < 0 || /\bimport\s*[{(*]|import\.meta/.test(src)) throw new Error('three.module.min.js : format inattendu');
  const j = src.indexOf('}', i);
  const noms = src.slice(i + 7, j).split(',').map(s => {
    const m = s.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
    if (!m) throw new Error('three.module.min.js : export illisible « ' + s + ' »');
    return (m[2] || m[1]) + ':' + m[1];
  });
  const corps = src.slice(0, i) + 'self.THREE={' + noms.join(',') + '};' + src.slice(j + 1).replace(/^;/, '');
  return '(function(){' + corps.replace(/<\/script/gi, '<\\/script') + '\n})();';
};
