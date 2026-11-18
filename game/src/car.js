// Cars in Teluk Senja: a low-poly car mesh (body, cabin, four wheels with steering
// pivots up front) and arcade driving physics — accelerate, brake, reverse, steer
// by speed, drag. A car is either parked, traffic-driven, police-driven, or the
// player's. Entering and stealing are the world's job; this module only knows
// how a car looks and how one drives.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_MAX_SPEED, CAR_REVERSE_MAX, CAR_STEER } from './config.js';

export const CAR_COLORS = [0xc0392b, 0x2e86ab, 0xe0a458, 0x5c7a5a, 0xd9d9d9, 0x8a6f5c, 0x3a3a3a, 0xf2c94c];

function wheelMesh() {
  // Steer pivot -> spin pivot -> tyre cylinder (axle along X).
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }),
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.4, metalness: 0.7 }),
  );
  hub.rotation.z = Math.PI / 2;
  spin.add(tyre);
  spin.add(hub);
  steer.add(spin);
  return { steer, spin };
}

export function buildCarMesh(color, police) {
  const group = new THREE.Group();
  group.name = police ? 'police-car' : 'car';
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2836, roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glass);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.8 });
  for (const side of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMaterial);
    head.position.set(side, 0.66, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.18, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0x7a1a12, emissiveIntensity: 0.8 }),
    );
    tail.position.set(side, 0.66, -2.22);
    group.add(tail);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4 }),
    );
    bar.position.set(0, 1.56, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xe33, emissive: 0xff2222, emissiveIntensity: 1.5 }),
    );
    red.position.set(-0.28, 1.56, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x33e, emissive: 0x2222ff, emissiveIntensity: 1.5 }),
    );
    blue.position.set(0.28, 1.56, -0.2);
    group.add(blue);
  }
  const wheels = {
    fl: wheelMesh(),
    fr: wheelMesh(),
    rl: wheelMesh(),
    rr: wheelMesh(),
  };
  wheels.fl.steer.position.set(-0.95, 0.36, 1.45);
  wheels.fr.steer.position.set(0.95, 0.36, 1.45);
  wheels.rl.steer.position.set(-0.95, 0.36, -1.45);
  wheels.rr.steer.position.set(0.95, 0.36, -1.45);
  for (const key of Object.keys(wheels)) group.add(wheels[key].steer);
  return { group, wheels };
}

export function createCar(scene, x, z, heading, color, police = false) {
  const { group, wheels } = buildCarMesh(color, police);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    police,
    color,
    group,
    wheels,
    parked: false,
    driver: null,
  };
}

// One fixed step of arcade driving. drive = { throttle: -1..1, steer: -1..1, brake }.
// Returns the distance travelled this step.
export function stepCar(car, dt, drive, collide) {
  const throttle = drive.throttle ?? 0;
  const steerInput = drive.steer ?? 0;
  if (drive.brake) {
    car.speed -= Math.sign(car.speed) * CAR_BRAKE * dt;
    if (Math.abs(car.speed) < 0.4) car.speed = 0;
  } else if (throttle > 0) {
    car.speed += CAR_ACCEL * throttle * dt;
  } else if (throttle < 0) {
    car.speed += CAR_ACCEL * throttle * dt * 0.7;
  }
  // Drag and speed caps.
  car.speed -= car.speed * CAR_DRAG * dt;
  if (car.speed > CAR_MAX_SPEED) car.speed = CAR_MAX_SPEED;
  if (car.speed < -CAR_REVERSE_MAX) car.speed = -CAR_REVERSE_MAX;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;

  // Steering only bites while moving. Bicycle model: yaw rate is speed times the
  // tangent of the wheel angle over the wheelbase. Positive steer turns the wheels
  // left; reversing flips the yaw rate on its own, as a real car does.
  const steerTarget = steerInput * CAR_STEER * Math.min(1, Math.abs(car.speed) / 8);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += (car.speed / 2.9) * Math.tan(car.steer) * dt;

  const forwardX = Math.sin(car.heading);
  const forwardZ = Math.cos(car.heading);
  let nextX = car.x + forwardX * car.speed * dt;
  let nextZ = car.z + forwardZ * car.speed * dt;
  if (collide) {
    const resolved = collide(nextX, nextZ, 1.6);
    nextX = resolved.x;
    nextZ = resolved.z;
  }
  const travelled = Math.hypot(nextX - car.x, nextZ - car.z);
  car.x = nextX;
  car.z = nextZ;

  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = (car.speed * dt) / 0.36;
  for (const key of Object.keys(car.wheels)) car.wheels[key].spin.rotation.x += spin;
  car.wheels.fl.steer.rotation.y = car.steer * 0.45;
  car.wheels.fr.steer.rotation.y = car.steer * 0.45;
  return travelled;
}
