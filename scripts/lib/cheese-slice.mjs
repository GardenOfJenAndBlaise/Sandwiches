import * as THREE from 'three';

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createCheeseSliceShape(scale = 1) {
  const s = scale;
  const hw = 0.98 * s;
  const hh = 0.98 * s;
  const r = 0.14 * s;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - r);
  shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hh);
  shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + r);
  shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);

  return shape;
}

export function addSwissHoles(shape, scale = 1, seed = 0xc0ffee42) {
  const rng = seededRandom(seed);
  const hw = 0.98 * scale;
  const hh = 0.98 * scale;
  const edgeMargin = 0.24 * scale;
  const targetCount = 9;
  const placed = [];

  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const edgeDist = (x, z, r) =>
    Math.min(hw - Math.abs(x), hh - Math.abs(z)) - r;

  for (let attempt = 0; placed.length < targetCount && attempt < 200; attempt++) {
    const x = (rng() * 2 - 1) * (hw - edgeMargin);
    const z = (rng() * 2 - 1) * (hh - edgeMargin);
    const r = (0.075 + rng() * 0.055) * scale;

    if (edgeDist(x, z, r) < 0.06 * scale) continue;

    const tooClose = placed.some((hole) => dist(hole, { x, z }) < hole.r + r + 0.1 * scale);
    if (tooClose) continue;

    placed.push({ x, z, r });
  }

  for (const hole of placed) {
    const path = new THREE.Path();
    path.absellipse(hole.x, hole.z, hole.r, hole.r, 0, Math.PI * 2, false, 0);
    shape.holes.push(path);
  }
}

function applyOmbreVertexColors(geometry, { center, edge, side, bottom }) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const halfW = Math.max((box.max.x - box.min.x) * 0.5, 1e-4);
  const halfD = Math.max((box.max.z - box.min.z) * 0.5, 1e-4);
  const yRange = Math.max(box.max.y - box.min.y, 1e-4);
  const topThreshold = box.max.y - yRange * 0.14;
  const bottomThreshold = box.min.y + yRange * 0.14;

  const cCenter = new THREE.Color(center);
  const cEdge = new THREE.Color(edge);
  const cSide = new THREE.Color(side);
  const cBottom = new THREE.Color(bottom ?? edge);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const radial = Math.min(1, Math.hypot((x - cx) / halfW, (z - cz) / halfD));
    const edgeMix = Math.pow(radial, 1.4);

    if (y >= topThreshold) {
      c.copy(cCenter).lerp(cEdge, edgeMix * 0.82);
      const highlight = Math.pow(1 - radial, 2.2) * 0.14;
      c.r = Math.min(1, c.r + highlight);
      c.g = Math.min(1, c.g + highlight * 0.92);
      c.b = Math.min(1, c.b + highlight * 0.28);
    } else if (y <= bottomThreshold) {
      c.copy(cCenter).lerp(cBottom, 0.5 + edgeMix * 0.4);
      c.multiplyScalar(0.9);
    } else {
      c.copy(cSide).lerp(cEdge, 0.35 + edgeMix * 0.55);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function buildCheeseSliceRoot({
  depth,
  material,
  meshName,
  rootName,
  targetFootprint = 2.0,
  gradient,
}) {
  const cheeseShape = createCheeseSliceShape(1);
  addSwissHoles(cheeseShape, 1);

  const cheeseGeo = new THREE.ExtrudeGeometry(cheeseShape, {
    depth,
    curveSegments: 20,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.006,
    bevelOffset: 0,
    bevelSegments: 1,
  });

  cheeseGeo.rotateX(-Math.PI / 2);
  cheeseGeo.computeVertexNormals();

  if (gradient) {
    applyOmbreVertexColors(cheeseGeo, gradient);
    material = { vertexColors: true, color: new THREE.Color(0xffffff), ...material };
  }

  const cheese = new THREE.Mesh(cheeseGeo, new THREE.MeshStandardMaterial(material));
  cheese.name = meshName;

  const box = new THREE.Box3().setFromObject(cheese);
  const center = new THREE.Vector3();
  box.getCenter(center);
  cheese.position.sub(center);

  const root = new THREE.Group();
  root.name = rootName;
  root.add(cheese);

  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(root).getSize(size);
  const maxXZ = Math.max(size.x, size.z);
  if (maxXZ > 1e-6) {
    root.scale.setScalar(targetFootprint / maxXZ);
  }

  new THREE.Box3().setFromObject(root).getCenter(center);
  root.position.sub(center);

  return root;
}
