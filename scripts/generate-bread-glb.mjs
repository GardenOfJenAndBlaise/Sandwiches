/**
 * Pan-loaf toast slice: one continuous silhouette (waist + crown dome),
 * solid crust rim via inset crumb — no hollow frame.
 * Run: node scripts/generate-bread-glb.mjs
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'models');
const outFile = path.join(outDir, 'bread_white_papercut.glb');

/**
 * Pan-loaf toast outline — one continuous curve (no bolted-on bump arcs).
 * Rounded rectangle: straight vertical sides, soft bottom corners, wide rounded top.
 * Matches the dashed placement guide on the board reference.
 */
function createPanLoafSliceShape(scale = 1) {
  const s = scale;
  const hw = 1.02 * s;
  const hh = 0.96 * s;
  const rBot = 0.1 * s;
  const rTop = 0.38 * s;
  const topDip = 0.055 * s; // subtle center valley on crown (muffin-top drip)

  const shape = new THREE.Shape();

  shape.moveTo(-hw + rBot, -hh);
  shape.lineTo(hw - rBot, -hh);
  shape.absarc(hw - rBot, -hh + rBot, rBot, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - rTop);
  shape.absarc(hw - rTop, hh - rTop, rTop, 0, Math.PI / 2, false);
  shape.quadraticCurveTo(0, hh - topDip, -hw + rTop, hh);
  shape.absarc(-hw + rTop, hh - rTop, rTop, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + rBot);
  shape.absarc(-hw + rBot, -hh + rBot, rBot, Math.PI, Math.PI * 1.5, false);

  return shape;
}

function extrudeMesh(shape, depth, matOpts, extrudeOverrides = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 24,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.007,
    bevelOffset: 0,
    bevelSegments: 1,
    ...extrudeOverrides,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial(matOpts));
}

const crustMat = {
  color: new THREE.Color(0xb8956e),
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0.08,
};

const crumbMat = {
  color: new THREE.Color(0xeee8e1),
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0.08,
};

const CRUST_DEPTH = 0.234;
const CRUMB_RECESS = 0.008; // tan cap on bottom
const CRUMB_PROUD = 0.0035; // white top slightly above tan rim
const CRUMB_DEPTH = CRUST_DEPTH - CRUMB_RECESS - CRUMB_PROUD;
const CRUMB_INSET = 0.87;

const crust = extrudeMesh(createPanLoafSliceShape(1), CRUST_DEPTH, crustMat);
crust.name = 'bread_crust';

const crumb = extrudeMesh(createPanLoafSliceShape(CRUMB_INSET), CRUMB_DEPTH, crumbMat);
crumb.name = 'bread_crumb';

function centerMeshesInPlace(meshes) {
  const box = new THREE.Box3();
  box.makeEmpty();
  for (const m of meshes) {
    box.union(new THREE.Box3().setFromObject(m));
  }
  const c = new THREE.Vector3();
  box.getCenter(c);
  for (const m of meshes) {
    m.position.sub(c);
  }
}

centerMeshesInPlace([crust, crumb]);

// White top just above flush with brown crust rim
const crustBox = new THREE.Box3().setFromObject(crust);
const crumbBox = new THREE.Box3().setFromObject(crumb);
crumb.position.y += crustBox.max.y - crumbBox.max.y + CRUMB_PROUD;

const root = new THREE.Group();
root.name = 'bread_white_papercut';
root.add(crust);
root.add(crumb);

const box = new THREE.Box3().setFromObject(root);
const size = new THREE.Vector3();
box.getSize(size);
const maxXZ = Math.max(size.x, size.z);
const targetFootprint = 2.2;
if (maxXZ > 1e-6) {
  root.scale.setScalar(targetFootprint / maxXZ);
}
box.setFromObject(root);
const center = new THREE.Vector3();
box.getCenter(center);
root.position.sub(center);

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
