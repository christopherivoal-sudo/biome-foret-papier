#!/usr/bin/env node
// Sprint 8c : fichier du jeu allégé. Produit vendor/three/three.biome.min.js, une copie de Three.js (r160, MIT)
// réduite aux seules pièces dont le jeu se sert (liste ci-dessous), sous forme de script classique (window.THREE).
// Ce fichier est gardé dans le dépôt : la construction (tools/construire.js) n'a besoin d'aucun outil externe.
// Il ne faut relancer ce script que si moteur3d.js se sert d'une nouvelle pièce de Three.js (sinon : « THREE.X is not a constructor »).
// Il a besoin d'esbuild (npm), cherché dans node_modules ou dans /opt/npm-tools.
// Usage : node tools/alleger-three.js
'use strict';
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..');

const PIECES = ['BufferAttribute', 'BufferGeometry', 'CanvasTexture', 'Color', 'ColorManagement', 'DirectionalLight', 'DoubleSide',
  'DynamicDrawUsage', 'HemisphereLight', 'InstancedBufferAttribute', 'InstancedMesh', 'LinearSRGBColorSpace', 'Mesh',
  'MeshBasicMaterial', 'MeshDepthMaterial', 'MeshLambertMaterial', 'NoBlending', 'OrthographicCamera', 'PCFSoftShadowMap',
  'PerspectiveCamera', 'PlaneGeometry', 'PointLight', 'REVISION', 'RGBADepthPacking', 'RepeatWrapping', 'Scene', 'ShaderMaterial',
  'Vector2', 'Vector3', 'WebGLRenderTarget', 'WebGLRenderer'];

function trouverEsbuild() {
  for (const p of ['esbuild', '/opt/npm-tools/node_modules/esbuild']) { try { return require(p); } catch (e) { /* suivant */ } }
  throw new Error('esbuild introuvable : npm install esbuild');
}

const esbuild = trouverEsbuild();
const source = path.join(R, 'vendor', 'three', 'three.module.min.js');
const entree = `import { ${PIECES.join(', ')} } from ${JSON.stringify(source)};\nself.THREE = { ${PIECES.join(', ')} };\n`;
const r = esbuild.buildSync({
  stdin: { contents: entree, resolveDir: R, loader: 'js' },
  bundle: true, minify: true, format: 'iife', write: false, legalComments: 'none', target: 'es2019',
});
const code = '/* Three.js r160 (https://threejs.org), licence MIT, (c) 2010-2023 Three.js Authors : voir vendor/three/LICENSE.\n'
  + '   Réduit aux pièces utilisées par Biome (tools/alleger-three.js). */\n'
  + r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.writeFileSync(path.join(R, 'vendor', 'three', 'three.biome.min.js'), code);
console.log(`vendor/three/three.biome.min.js : ${(code.length / 1024).toFixed(0)} Ko (au lieu de ${(fs.statSync(source).size / 1024).toFixed(0)} Ko), ${PIECES.length} pièces.`);
