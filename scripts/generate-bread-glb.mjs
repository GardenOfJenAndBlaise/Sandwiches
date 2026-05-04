/**
 * Classic "tombstone" bread slice (top view): flat bottom, straight sides with
 * a slight outward bow, semicircular top — tan crust ring + cream crumb fill.
 * Y-up after extrusion. Run: node scripts/generate-bread-glb.mjs
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
 * Classic loaf slice outline in XY (later rotated so thickness is Y).
 * @param {number} scale - uniform scale from unit template (half-width ~1.1)
 */
function createClassicBreadShape(scale = 1) {
  const s = scale;
  const hw = 1.1 * s;
  const H_rect = 0.52 * s;
  const bulge = 0.045 * s;

  const shape = new THREE.Shape();
  // CCW: flat bottom → right side → arch → left side → close
  shape.moveTo(-hw, -H_rect);
  shape.lineTo(hw, -H_rect);
  shape.quadraticCurveTo(hw + bulge, -H_rect * 0.48, hw, 0);
  // Upper semicircle: flat top of rectangle at y=0, dome toward +Y
  shape.absarc(0, 0, hw, 0, Math.PI, false);
  shape.quadraticCurveTo(-hw - bulge, -H_rect * 0.48, -hw, -H_rect);

  return shape;
}

/** Hole path with opposite winding to outer (for ExtrudeGeometry). */
function createCrumbHolePath(innerScale) {
  const inner = createClassicBreadShape(innerScale);
  const pts = inner.getPoints(96);
  const path = new THREE.Path();
  if (pts.length < 3) return path;
  const last = pts[pts.length - 1];
  path.moveTo(last.x, last.y);
  for (let i = pts.length - 2; i >= 0; i--) {
    path.lineTo(pts[i].x, pts[i].y);
  }
  path.lineTo(last.x, last.y);
  return path;
}

function extrudeMesh(shape, depth, matOpts, extrudeOverrides = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 32,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.014,
    bevelOffset: 0,
    bevelSegments: 2,
    ...extrudeOverrides,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial(matOpts));
}

const crustMat = {
  color: new THREE.Color(0xc1a57b),
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0.1,
};

const crumbMat = {
  color: new THREE.Color(0xebe6e0),
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0.1,
};

const INNER = 0.82;

const crustShape = createClassicBreadShape(1);
crustShape.holes.push(createCrumbHolePath(INNER));

const crustRing = extrudeMesh(crustShape, 0.1, crustMat, {
  bevelThickness: 0.012,
  bevelSize: 0.016,
});
crustRing.name = 'bread_crust_ring';

// Slightly smaller than hole so inner crust wall reads; avoids coplanar caps with ring
const crumbSolid = extrudeMesh(createClassicBreadShape(INNER * 0.996), 0.098, crumbMat, {
  bevelThickness: 0.008,
  bevelSize: 0.01,
});
crumbSolid.name = 'bread_crumb';

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

centerMeshesInPlace([crustRing, crumbSolid]);

const root = new THREE.Group();
root.name = 'bread_white_papercut';
root.add(crustRing);
root.add(crumbSolid);

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
