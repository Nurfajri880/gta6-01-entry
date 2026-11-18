// Pedestrians in Teluk Senja: walkers on the sidewalks who stroll from one
// sidewalk point to the next, bobbing as they go. They are scenery with a pulse —
// they make the streets feel lived in and give the minimap its grey dots.
import * as THREE from '../vendor/three.module.min.js';
import { PED_COUNT, PED_SPEED } from './config.js';

const SHIRTS = [0xe0a458, 0x4f7d8c, 0xc96f4a, 0x5c7a5a, 0xd9d9d9, 0x8a6f5c, 0x2e86ab];

function makeWalker(scene, color) {
  const group = new THREE.Group();
  group.name = 'pedestrian';
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const legs = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 8), shirt);
  torso.position.y = 1.0;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), legs);
  legL.position.set(-0.16, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), legs);
  legR.position.set(0.16, 0.33, 0);
  group.add(legR);
  scene.add(group);
  return { group, legL, legR };
}

export function createPedestrians(scene, city, random) {
  const walkers = [];
  for (let index = 0; index < PED_COUNT; index += 1) {
    const point = city.sidewalkPoints[random.int(0, city.sidewalkPoints.length - 1)];
    const { group, legL, legR } = makeWalker(scene, random.pick(SHIRTS));
    group.position.set(point.x, 0, point.z);
    walkers.push({
      x: point.x,
      z: point.z,
      heading: random.range(0, Math.PI * 2),
      target: null,
      speed: PED_SPEED * random.range(0.8, 1.3),
      phase: random.range(0, Math.PI * 2),
      group,
      legL,
      legR,
    });
  }

  function pickTarget(walker) {
    // A nearby sidewalk point, so walkers stay on the pavements.
    let best = null;
    let bestDist = Infinity;
    for (let tries = 0; tries < 6; tries += 1) {
      const point = city.sidewalkPoints[random.int(0, city.sidewalkPoints.length - 1)];
      const dx = point.x - walker.x;
      const dz = point.z - walker.z;
      const dist = dx * dx + dz * dz;
      if (dist > 25 && dist < 3600 && dist < bestDist) {
        bestDist = dist;
        best = point;
      }
    }
    walker.target = best ?? city.sidewalkPoints[random.int(0, city.sidewalkPoints.length - 1)];
  }

  function step(dt) {
    for (const walker of walkers) {
      if (!walker.target) pickTarget(walker);
      const dx = walker.target.x - walker.x;
      const dz = walker.target.z - walker.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        pickTarget(walker);
        continue;
      }
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - walker.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      walker.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      walker.x += Math.sin(walker.heading) * walker.speed * dt;
      walker.z += Math.cos(walker.heading) * walker.speed * dt;
      walker.phase += walker.speed * dt * 3.2;
      const swing = Math.sin(walker.phase) * 0.4;
      walker.legL.rotation.x = swing;
      walker.legR.rotation.x = -swing;
      walker.group.position.set(walker.x, Math.abs(Math.sin(walker.phase)) * 0.06, walker.z);
      walker.group.rotation.y = walker.heading;
    }
  }

  return { walkers, step };
}
