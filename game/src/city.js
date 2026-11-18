// Teluk Senja's static city: ground, sea and beach to the west, a road grid with
// sidewalks, procedural buildings with lit windows, street lamps and palms along
// the coast road. Everything is generated from the seeded random, so the same seed
// always builds the same city. The road graph (intersections + edges) is what
// traffic follows and what pedestrians walk beside.
import * as THREE from '../vendor/three.module.min.js';
import {
  ASPHALT,
  BUILDING_COLORS,
  GRID,
  GROUND_COLOR,
  HALF,
  ROAD_WIDTH,
  SEA_COLOR,
  SEA_X,
  SIDEWALK,
  SIDEWALK_COLOR,
} from './config.js';

const STREET_NAMES_NS = ['Jl. Pantai Senja', 'Jl. Merdeka', 'Jl. Pelabuhan', 'Jl. Sudirman', 'Jl. Gajah Mada'];
const STREET_NAMES_EW = ['Jl. Malioboro', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Kartini', 'Jl. Pahlawan'];

// A facade texture: warm wall colour with a grid of windows, some lit for sunset.
function facadeTexture(random, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = random.chance(0.45);
      ctx.fillStyle = lit ? '#ffd27a' : '#2c3550';
      ctx.fillRect(10 + col * 19, 12 + row * 20, 12, 14);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Asphalt with a dashed centre line, tiled along the road. When alongU is true the
// dashes run along the texture's U axis (for east-west roads); otherwise along V.
function roadTexture(alongU) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#e8e8e8';
  if (alongU) {
    ctx.fillRect(0, 3, 64, 2);
    ctx.fillRect(0, 123, 64, 2);
  } else {
    ctx.fillRect(3, 0, 2, 128);
    ctx.fillRect(59, 0, 2, 128);
  }
  ctx.fillStyle = '#d8c26a';
  if (alongU) ctx.fillRect(8, 62, 48, 4);
  else ctx.fillRect(30, 8, 4, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roadLines() {
  const lines = [];
  for (let value = -HALF; value <= HALF; value += GRID) lines.push(value);
  return lines;
}

export function createCity(scene, random) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const lines = roadLines();
  const asphaltNS = roadTexture(false);
  const asphaltEW = roadTexture(true);

  // Ground and sea. The sea sits west of the beach; the beach is a sand strip.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, HALF * 2 + 120),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(180, HALF * 2 + 240),
    new THREE.MeshStandardMaterial({ color: SEA_COLOR, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X - 90, 0.1, 0);
  group.add(sea);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(24, HALF * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(SEA_X + 12, 0.02, 0);
  group.add(beach);

  // Roads: one long plane per road line, textured with dashes.
  for (const x of lines) {
    const tex = asphaltNS.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, (HALF * 2) / 16);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, HALF * 2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.01, 0);
    road.receiveShadow = true;
    group.add(road);
  }
  for (const z of lines) {
    const tex = asphaltEW.clone();
    tex.needsUpdate = true;
    tex.repeat.set((HALF * 2) / 16, 1);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2, ROAD_WIDTH),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, z);
    road.receiveShadow = true;
    group.add(road);
  }

  // Sidewalks: lighter strips flanking every road.
  const walkMaterial = new THREE.MeshStandardMaterial({ color: SIDEWALK_COLOR, roughness: 1 });
  for (const x of lines) {
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(SIDEWALK, HALF * 2), walkMaterial);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(x + side * (ROAD_WIDTH / 2 + SIDEWALK / 2), 0.03, 0);
      group.add(walk);
    }
  }
  for (const z of lines) {
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, SIDEWALK), walkMaterial);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.03, z + side * (ROAD_WIDTH / 2 + SIDEWALK / 2));
      group.add(walk);
    }
  }

  // Buildings: one to three per block, boxes with lit-window facades.
  const buildings = [];
  const facadeCache = new Map();
  function facadeFor(color) {
    const key = `#${color.toString(16).padStart(6, '0')}`;
    if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(random, key));
    return facadeCache.get(key);
  }
  for (let bx = 0; bx < lines.length - 1; bx += 1) {
    for (let bz = 0; bz < lines.length - 1; bz += 1) {
      const x0 = lines[bx] + ROAD_WIDTH / 2 + SIDEWALK;
      const z0 = lines[bz] + ROAD_WIDTH / 2 + SIDEWALK;
      const x1 = lines[bx + 1] - ROAD_WIDTH / 2 - SIDEWALK;
      const z1 = lines[bz + 1] - ROAD_WIDTH / 2 - SIDEWALK;
      const count = random.int(1, 3);
      for (let n = 0; n < count; n += 1) {
        const width = random.range(8, Math.max(9, (x1 - x0) / count - 4));
        const depth = random.range(8, Math.max(9, z1 - z0 - 4));
        const height = random.chance(0.12) ? random.range(28, 44) : random.range(7, 22);
        const cx = random.range(x0 + width / 2, x1 - width / 2);
        const cz = random.range(z0 + depth / 2, z1 - depth / 2);
        const color = random.pick(BUILDING_COLORS);
        const facade = facadeFor(color);
        const side = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.9, emissive: 0xffffff, emissiveMap: facade, emissiveIntensity: 0.35 });
        const top = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          [side, side, top, top, side, side],
        );
        mesh.position.set(cx, height / 2, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        buildings.push({ x: cx, z: cz, width, depth, height, mesh });
      }
    }
  }

  // Street lamps at intersections, and palms along the coast road.
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.6 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.6 });
  const lamps = [];
  for (const x of lines) {
    for (const z of lines) {
      if (!random.chance(0.5)) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMaterial);
      pole.position.set(x + ROAD_WIDTH / 2 + 1, 3, z + ROAD_WIDTH / 2 + 1);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMaterial);
      head.position.set(x + ROAD_WIDTH / 2 + 1, 6.1, z + ROAD_WIDTH / 2 + 1);
      group.add(head);
      lamps.push({ x: pole.position.x, z: pole.position.z });
    }
  }
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 });
  const palms = [];
  for (let index = 0; index < 14; index += 1) {
    const px = -HALF + 4;
    const pz = -HALF + 20 + index * 24 + random.range(-6, 6);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMaterial);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = random.range(-0.12, 0.12);
    group.add(trunk);
    for (let leaf = 0; leaf < 5; leaf += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 4), leafMaterial);
      const angle = (leaf / 5) * Math.PI * 2;
      frond.position.set(px + Math.cos(angle) * 1.2, 7.2, pz + Math.sin(angle) * 1.2);
      frond.rotation.z = Math.cos(angle) * 0.9;
      frond.rotation.x = -Math.sin(angle) * 0.9;
      group.add(frond);
    }
    palms.push({ x: px, z: pz });
  }

  // Road graph: intersections as nodes, edges to the four neighbours.
  const nodes = [];
  const nodeIndex = new Map();
  for (const x of lines) {
    for (const z of lines) {
      nodeIndex.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z, neighbours: [] });
    }
  }
  for (let ix = 0; ix < lines.length; ix += 1) {
    for (let iz = 0; iz < lines.length; iz += 1) {
      const node = nodes[nodeIndex.get(`${lines[ix]},${lines[iz]}`)];
      if (ix > 0) node.neighbours.push(nodeIndex.get(`${lines[ix - 1]},${lines[iz]}`));
      if (ix < lines.length - 1) node.neighbours.push(nodeIndex.get(`${lines[ix + 1]},${lines[iz]}`));
      if (iz > 0) node.neighbours.push(nodeIndex.get(`${lines[ix]},${lines[iz - 1]}`));
      if (iz < lines.length - 1) node.neighbours.push(nodeIndex.get(`${lines[ix]},${lines[iz + 1]}`));
    }
  }
  function nearestNode(x, z) {
    let best = 0;
    let bestDist = Infinity;
    for (let index = 0; index < nodes.length; index += 1) {
      const dx = nodes[index].x - x;
      const dz = nodes[index].z - z;
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    }
    return best;
  }

  // Sidewalk waypoints: points just off each road, for pedestrians.
  const sidewalkPoints = [];
  for (const x of lines) {
    for (let z = -HALF; z <= HALF; z += 20) {
      sidewalkPoints.push({ x: x + ROAD_WIDTH / 2 + SIDEWALK / 2, z });
      sidewalkPoints.push({ x: x - ROAD_WIDTH / 2 - SIDEWALK / 2, z });
    }
  }
  for (const z of lines) {
    for (let x = -HALF; x <= HALF; x += 20) {
      sidewalkPoints.push({ x, z: z + ROAD_WIDTH / 2 + SIDEWALK / 2 });
      sidewalkPoints.push({ x, z: z - ROAD_WIDTH / 2 - SIDEWALK / 2 });
    }
  }

  return {
    group,
    buildings,
    lamps,
    palms,
    nodes,
    nearestNode,
    sidewalkPoints,
    streetNamesNS: STREET_NAMES_NS,
    streetNamesEW: STREET_NAMES_EW,
    lines,
  };
}
