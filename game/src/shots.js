// Teluk Senja — staging screenshot deterministik.
// Menyiapkan dunia ke satu dari empat adegan (cover, onfoot, chase, mission).
// Kamera diatur lewat world.setCameraOverride() — main.js menggambar lewat
// renderer.followCamera(world.getCamera()), jadi override inilah yang
// menentukan bingkai (menyetel renderer.camera langsung akan tertimpa
// frame berikutnya). Ditulis fresh di sesi ini (pemulihan recording baru).

import { STEP } from './config.js';
import { ACTION_INTERACT } from './input.js';
import { SCREEN_PLAY } from './render.js';

// Input pura-pura untuk menggerakkan dunia saat staging (tanpa keyboard).
function dummyInput(throttle) {
  return {
    move: () => ({ forward: throttle ? 1 : 0, strafe: 0 }),
    run: () => false,
    brake: () => false,
    takeLook: () => ({ x: 0, y: 0 }),
    takeActions: () => 0,
  };
}

function driveSteps(world, count, throttle) {
  const input = dummyInput(throttle);
  for (let i = 0; i < count; i += 1) {
    world.step(STEP, input, 0);
  }
}

function idleSteps(world, count) {
  driveSteps(world, count, false);
}

// Mobil parkir paling barat (paling dekat laut) — untuk adegan pesisir.
function westernmostParkedCar(world) {
  let best = null;
  let bestX = Infinity;
  for (const car of world.traffic.parked) {
    if (car.x < bestX) {
      bestX = car.x;
      best = car;
    }
  }
  return best;
}

// Mobil parkir terdekat dari satu titik.
function nearestParkedCar(world, x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (const car of world.traffic.parked) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
  }
  return best;
}

// Masuk ke sebuah mobil parkir: teleport pemain ke sampingnya lalu masuk.
function enterParkedCar(world, car) {
  if (!car) return false;
  world.teleport(car.x + 2, car.z + 2, car.heading);
  world.step(STEP, dummyInput(false), ACTION_INTERACT);
  return world.driving;
}

// Atur bingkai kamera untuk shot ini (fokus, arah pandang, jarak, tinggi).
function frameCamera(world, x, z, heading, distance, height, pitch) {
  world.setCameraOverride({
    x,
    z,
    heading,
    distance,
    height,
    pitch: pitch === undefined ? 0.28 : pitch,
  });
}

function stageCover(world) {
  const car = westernmostParkedCar(world);
  if (!car) return { name: 'cover', staged: false, reason: 'no parked car' };
  enterParkedCar(world, car);
  // Hadap ke barat (laut + matahari senja) lalu melaju sebentar.
  const driven = world.currentCar;
  if (driven) {
    driven.heading = -Math.PI / 2;
    if (driven.group) driven.group.rotation.y = -Math.PI / 2;
  }
  driveSteps(world, 45, true);
  const focus = world.currentCar || world.player.state;
  // Kamera di belakang mobil, arah pandang diputar ~26 derajat dari arah
  // mobil supaya matahari senja tidak tepat di tengah bingkai, melainkan
  // di kiri atas — mobil tetap di tengah, kota di kanan, laut di kiri.
  frameCamera(world, focus.x, focus.z, focus.heading + 0.45, 11, 4.2, 0.28);
  return { name: 'cover', screen: SCREEN_PLAY, staged: true };
}

function stageOnFoot(world) {
  // Pemain jalan kaki di trotoar dekat mobil parkir + pejalan kaki.
  const point = world.city.sidewalkPoints && world.city.sidewalkPoints.length > 0
    ? world.city.sidewalkPoints[Math.min(3, world.city.sidewalkPoints.length - 1)]
    : { x: 0, z: 20 };
  world.teleport(point.x, point.z, Math.PI / 4);
  idleSteps(world, 90);
  // Kamera default (di belakang pemain) sudah bagus — tanpa override.
  world.setCameraOverride(null);
  return { name: 'onfoot', screen: SCREEN_PLAY, staged: true };
}

function stageChase(world) {
  const car = world.traffic.parked[0] || world.traffic.cars[0];
  if (!car) return { name: 'chase', staged: false, reason: 'no car' };
  enterParkedCar(world, car);
  world.setWanted(3);
  // Melaju supaya polisi mendekat (dari ~70m ke belasan meter) tapi belum
  // sempat menangkap pemain — 240 langkah terlalu lama (pemain tertangkap).
  driveSteps(world, 200, true);
  const focus = world.currentCar || world.player.state;
  // Bingkai pada mobil polisi TERDEKAT: kamera di belakangnya, menghadap
  // mobil pemain di depannya — polisi (lampu) + mobil pemain sama terlihat.
  let nearest = null;
  let nearestD = Infinity;
  for (const policeCar of world.police.cars) {
    const d = Math.hypot(policeCar.x - focus.x, policeCar.z - focus.z);
    if (d < nearestD) {
      nearestD = d;
      nearest = policeCar;
    }
  }
  if (nearest) {
    const headingToPlayer = Math.atan2(focus.x - nearest.x, focus.z - nearest.z);
    frameCamera(world, nearest.x, nearest.z, headingToPlayer, 8, 4.5, 0.3);
  } else {
    // Cadangan: kamera di depan mobil, menghadap ke belakang.
    frameCamera(world, focus.x, focus.z, focus.heading + Math.PI, 9, 5, 0.3);
  }
  return {
    name: 'chase',
    screen: SCREEN_PLAY,
    staged: true,
    wanted: world.wanted,
    policeCars: world.police.cars.length,
    nearestPoliceDistance: nearestD,
  };
}

function stageMission(world) {
  world.setMission(1);
  const mission = world.missions[1];
  const target = mission && mission.target ? mission.target : { x: 120, z: -120 };
  // Pemain jalan kaki 18m di timur target, menghadap barat ke arahnya —
  // garis pandang lurus menyusuri jalan, pilar penanda misi terlihat jelas.
  const px = target.x + 18;
  const pz = target.z;
  world.teleport(px, pz, -Math.PI / 2);
  idleSteps(world, 30);
  // Kamera di belakang pemain, menghadap penanda misi.
  frameCamera(world, world.player.state.x, world.player.state.z, -Math.PI / 2, 7.5, 3.2, 0.32);
  return { name: 'mission', screen: SCREEN_PLAY, staged: true };
}

const STAGES = {
  cover: stageCover,
  onfoot: stageOnFoot,
  chase: stageChase,
  mission: stageMission,
};

export function stageShot(name, world, renderer, hud) {
  if (hud && hud.hideTitle) hud.hideTitle();
  const stage = STAGES[name];
  if (!stage) {
    return { name, screen: SCREEN_PLAY, staged: false, reason: 'unknown shot name' };
  }
  return stage(world, renderer);
}
