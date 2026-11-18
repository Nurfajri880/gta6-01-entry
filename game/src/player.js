// The player on foot in Teluk Senja: a low-poly pedestrian with a third-person
// camera. WASD moves relative to the camera yaw, Shift runs, the mouse (pointer
// lock) turns the camera. The character turns toward where it walks and its legs
// swing with its stride. Entering a car is the world's job; this module only
// knows how to walk.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER_HEIGHT, PLAYER_TURN, RUN_SPEED, SEA_X, WALK_SPEED } from './config.js';

export function createPlayer(scene, start) {
  const group = new THREE.Group();
  group.name = 'player';

  const jacket = new THREE.MeshStandardMaterial({ color: 0x2e86ab, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const denim = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), jacket);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xd94f30, roughness: 0.8 }));
  cap.position.y = 2.05;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), denim);
  legL.position.set(-0.2, 0.38, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), denim);
  legR.position.set(0.2, 0.38, 0);
  legR.castShadow = true;
  group.add(legR);

  scene.add(group);

  const state = {
    x: start.x,
    z: start.z,
    heading: start.heading ?? 0,
    moving: false,
    speed: 0,
    stride: 0,
    visible: true,
  };
  group.position.set(state.x, 0, state.z);

  // Keep the player inside the city and out of the sea.
  function clampToCity(x, z) {
    return {
      x: Math.min(178, Math.max(SEA_X + 16, x)),
      z: Math.min(178, Math.max(-178, z)),
    };
  }

  function update(dt, move, run, look, collide) {
    const yaw = look.yaw;
    const forward = move.forward;
    const strafe = move.strafe;
    const speed = run ? RUN_SPEED : WALK_SPEED;
    // Movement is relative to the camera yaw: W walks away from the camera.
    // View direction is (sin yaw, cos yaw); the camera's right is (-cos yaw, sin yaw).
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    let dx = sin * forward - cos * strafe;
    let dz = cos * forward + sin * strafe;
    const length = Math.hypot(dx, dz);
    state.moving = length > 0.01;
    if (state.moving) {
      dx /= length;
      dz /= length;
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-PLAYER_TURN * dt, Math.min(PLAYER_TURN * dt, diff));
      state.heading += turn;
      let nextX = state.x + dx * speed * dt;
      let nextZ = state.z + dz * speed * dt;
      const clamped = clampToCity(nextX, nextZ);
      nextX = clamped.x;
      nextZ = clamped.z;
      if (collide) {
        const resolved = collide(nextX, nextZ, 0.6);
        nextX = resolved.x;
        nextZ = resolved.z;
      }
      state.x = nextX;
      state.z = nextZ;
      state.speed = speed;
      state.stride += speed * dt * 1.6;
    } else {
      state.speed = 0;
    }
    group.position.set(state.x, 0, state.z);
    group.rotation.y = state.heading;
    const swing = state.moving ? Math.sin(state.stride) * 0.55 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    group.visible = state.visible;
  }

  return {
    state,
    group,
    update,
    hide() {
      state.visible = false;
      group.visible = false;
    },
    showAt(x, z, heading) {
      state.x = x;
      state.z = z;
      state.heading = heading;
      state.visible = true;
      group.position.set(x, 0, z);
      group.rotation.y = heading;
      group.visible = true;
    },
  };
}
