/**
 * Swiss cheese slice — thin extruded square with scattered round holes.
 * Run: node scripts/generate-cheese-glb.mjs
 */
import { Buffer } from 'node:buffer';

globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then((ab) => {
      this.result = ab;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    Promise.resolve(blob.arrayBuffer()).then((ab) => {
      this.result = `data:application/octet-stream;base64,${Buffer.from(ab).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCheeseSliceRoot } from './lib/cheese-slice.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'models');
const outFile = path.join(outDir, 'cheese_slice_papercut.glb');

const root = buildCheeseSliceRoot({
  depth: 0.05,
  meshName: 'cheese_slice',
  rootName: 'cheese_slice_papercut',
  gradient: {
    center: '#fff9c4',
    edge: '#f9a825',
    side: '#ef6c00',
    bottom: '#e65100',
  },
  material: {
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.06,
  },
});

const scene = new THREE.Scene();
scene.add(root);

const exporter = new GLTFExporter();

exporter.parse(
  scene,
  (result) => {
    if (result instanceof ArrayBuffer) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, Buffer.from(result));
      console.log('Wrote', outFile, `(${result.byteLength} bytes)`);
    } else {
      console.error('Expected binary GLB (ArrayBuffer), got:', typeof result);
      process.exit(1);
    }
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: true, onlyVisible: true }
);
