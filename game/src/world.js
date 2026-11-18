// Teluk Senja — orkestrator dunia.
// Menggabungkan pemain, lalu lintas, pejalan kaki, polisi, misi, combat,
// dan save menjadi satu simulasi yang dijalankan main.js tiap frame.
// Ditulis fresh di sesi ini (pemulihan recording baru).

import * as THREE from '../vendor/three.module.min.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { stepCar } from './car.js';
import {
  ENTER_DISTANCE,
  STEAL_STARS,
  POLICE_CATCH_DISTANCE,
  SEA_X,
  HALF,
} from './config.js';
import { ACTION_INTERACT, ACTION_CONFIRM } from './input.js';

const SAVE_KEY = 'teluk-senja-save-v1';
const SAVE_EVERY_SECONDS = 10;
const PUNCH_RANGE = 2.6;
const PUNCH_COOLDOWN = 0.5;
const BUSTED_COOLDOWN = 5;
const MISSION_ARRIVE_DISTANCE = 10;
const FLASH_SECONDS = 2.5;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function distance(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function createWorld(scene, city, random) {
  const params = new URLSearchParams(window.location.search);
  const staged = params.has('shot') || params.get('test') === '1';

  // Titik awal pemain: trotoar pertama kota, atau tengah kota bila tidak ada.
  let start = { x: 0, z: 20, heading: 0 };
  if (city.sidewalkPoints && city.sidewalkPoints.length > 0) {
    const point = city.sidewalkPoints[0];
    if (Number.isFinite(point.x) && Number.isFinite(point.z)) {
      start = { x: point.x, z: point.z, heading: 0 };
    }
  }

  const player = createPlayer(scene, start);
  const traffic = createTraffic(scene, city, random);
  const pedestrians = createPedestrians(scene, city, random);
  const police = createPolice(scene, city, random);

  // ---- Misi: tiga misi berantai dengan cerita singkat. ----
  // Target M2 = simpang terjauh dari titik awal; target M3 = markas dekat awal.
  let missionTarget2 = { x: 120, z: -120 };
  let missionTarget3 = { x: start.x, z: start.z };
  if (Array.isArray(city.nodes) && city.nodes.length > 0) {
    let farthest = null;
    let farthestDistance = -1;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const node of city.nodes) {
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.z)) continue;
      const d = distance(node.x, node.z, start.x, start.z);
      if (d > farthestDistance) {
        farthestDistance = d;
        farthest = node;
      }
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = node;
      }
    }
    if (farthest) missionTarget2 = { x: farthest.x, z: farthest.z };
    if (nearest) missionTarget3 = { x: nearest.x, z: nearest.z };
  }

  const missions = [
    {
      title: 'Mobil Pertama',
      text: 'Curi sebuah mobil. Dekati mobil parkir lalu tekan E.',
      done: false,
    },
    {
      title: 'Antar Paket',
      text: 'Antar paket ke Pasar Ikan. Ikuti penanda kuning.',
      target: missionTarget2,
      done: false,
    },
    {
      title: 'Kembali ke Markas',
      text: 'Kembali ke markas. Ikuti penanda kuning.',
      target: missionTarget3,
      done: false,
    },
  ];
  let missionIndex = 0;

  // Penanda misi: pilar cahaya kuning di lokasi tujuan.
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2c94c,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
    beaconMaterial,
  );
  beacon.visible = false;
  scene.add(beacon);

  function placeBeacon() {
    const mission = missions[missionIndex];
    if (mission && mission.target) {
      beacon.position.set(mission.target.x, 13, mission.target.z);
      beacon.visible = true;
    } else {
      beacon.visible = false;
    }
  }
  placeBeacon();

  let currentCar = null;
  let prompt = missions[0].text;
  let flashText = '';
  let flashTimer = 0;
  let punchCooldown = 0;
  let bustedCooldown = 0;
  let saveTimer = 0;

  // Arah kamera (yaw/pitch) — diakumulasi dari gerakan mouse (look.x/look.y).
  // player.update memakai look.yaw, sedangkan input.takeLook() memberi
  // delta {x, y}; dunia yang mengakumulasikan delta menjadi yaw absolut.
  let cameraYaw = start.heading;
  let cameraPitch = 0.32;

  // Override kamera untuk staging screenshot (shots.js): bila di-set, bidang
  // yang ada di override menggantikan nilai default getCamera(). Dipakai
  // hanya saat staged (?shot=...); permainan normal tidak menyentuhnya.
  let cameraOverride = null;
  function setCameraOverride(override) {
    cameraOverride = override || null;
  }

  function syncCameraTo(heading) {
    cameraYaw = heading;
  }

  function flash(text) {
    flashText = text;
    flashTimer = FLASH_SECONDS;
  }

  // ---- Tabrakan: jaga entitas di dalam kota, di luar laut dan gedung. ----
  function collide(x, z, radius) {
    const r = radius || 1;
    x = clamp(x, SEA_X + 2 + r, HALF + 18);
    z = clamp(z, -HALF - 18, HALF + 18);
    for (const building of city.buildings) {
      const halfW = building.width / 2 + r;
      const halfD = building.depth / 2 + r;
      const dx = x - building.x;
      const dz = z - building.z;
      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
        const pushX = halfW - Math.abs(dx);
        const pushZ = halfD - Math.abs(dz);
        if (pushX < pushZ) {
          x = building.x + (dx >= 0 ? halfW : -halfW);
        } else {
          z = building.z + (dz >= 0 ? halfD : -halfD);
        }
      }
    }
    return { x, z };
  }

  function focusPoint() {
    if (currentCar) return currentCar;
    return player.state;
  }

  function nearestStealableCar() {
    const px = player.state.x;
    const pz = player.state.z;
    let best = null;
    let bestDistance = ENTER_DISTANCE;
    const candidates = [...traffic.parked, ...traffic.cars];
    for (const car of candidates) {
      if (car.driver) continue;
      const d = distance(px, pz, car.x, car.z);
      if (d < bestDistance) {
        bestDistance = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    currentCar = car;
    car.driver = player;
    player.hide();
    syncCameraTo(car.heading);
    if (!car.stolenByPlayer) {
      car.stolenByPlayer = true;
      police.crimeCommitted(STEAL_STARS);
    }
    if (missionIndex === 0) {
      missions[0].done = true;
      missionIndex = 1;
      placeBeacon();
    }
  }

  function exitCar() {
    if (!currentCar) return;
    const car = currentCar;
    car.driver = null;
    currentCar = null;
    const side = car.heading + Math.PI / 2;
    const px = car.x + Math.sin(side) * 2.4;
    const pz = car.z + Math.cos(side) * 2.4;
    const spot = collide(px, pz, 1);
    player.showAt(spot.x, spot.z, car.heading);
    syncCameraTo(car.heading);
  }

  function punch() {
    if (punchCooldown > 0) return false;
    punchCooldown = PUNCH_COOLDOWN;
    const px = player.state.x;
    const pz = player.state.z;
    // Cari pejalan kaki terdekat untuk didorong.
    let victim = null;
    let victimDistance = PUNCH_RANGE;
    for (const walker of pedestrians.walkers) {
      const d = distance(px, pz, walker.x, walker.z);
      if (d < victimDistance) {
        victimDistance = d;
        victim = walker;
      }
    }
    if (victim) {
      const away = Math.atan2(victim.x - px, victim.z - pz);
      const pushed = collide(
        victim.x + Math.sin(away) * 3,
        victim.z + Math.cos(away) * 3,
        1,
      );
      victim.x = pushed.x;
      victim.z = pushed.z;
      if (victim.group) {
        victim.group.position.x = pushed.x;
        victim.group.position.z = pushed.z;
      }
    } else {
      // Tidak ada pejalan kaki: dorong mobil polisi terdekat.
      let nearest = null;
      let nearestDistance = 4;
      for (const car of police.cars) {
        const d = distance(px, pz, car.x, car.z);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = car;
        }
      }
      if (nearest) {
        const away = Math.atan2(nearest.x - px, nearest.z - pz);
        const pushed = collide(
          nearest.x + Math.sin(away) * 3,
          nearest.z + Math.cos(away) * 3,
          1.6,
        );
        nearest.x = pushed.x;
        nearest.z = pushed.z;
      }
    }
    police.crimeCommitted(1);
    flash('Pukulan! Polisi mengejarmu.');
    return true;
  }

  function checkBusted() {
    if (bustedCooldown > 0) return;
    const focus = focusPoint();
    for (const car of police.cars) {
      if (distance(focus.x, focus.z, car.x, car.z) < POLICE_CATCH_DISTANCE) {
        bustedCooldown = BUSTED_COOLDOWN;
        if (currentCar) {
          currentCar.driver = null;
          currentCar = null;
        }
        player.showAt(start.x, start.z, start.heading);
        syncCameraTo(start.heading);
        flash('Tertangkap! Kamu kembali ke titik awal.');
        return;
      }
    }
  }

  function updateMissions() {
    const focus = focusPoint();
    if (missionIndex === 1) {
      const target = missions[1].target;
      if (currentCar && distance(focus.x, focus.z, target.x, target.z) < MISSION_ARRIVE_DISTANCE) {
        missions[1].done = true;
        missionIndex = 2;
        placeBeacon();
      }
    } else if (missionIndex === 2) {
      const target = missions[2].target;
      if (distance(focus.x, focus.z, target.x, target.z) < MISSION_ARRIVE_DISTANCE) {
        missions[2].done = true;
        missionIndex = 3;
        placeBeacon();
      }
    }
  }

  function contextualPrompt() {
    if (!currentCar) {
      const near = nearestStealableCar();
      if (near) return 'Tekan E untuk masuk mobil.';
    } else {
      return 'Tekan E untuk keluar mobil. Spasi untuk rem.';
    }
    if (missionIndex < missions.length) return missions[missionIndex].text;
    return 'Semua misi selesai! Teluk Senja milikmu.';
  }

  // ---- Save / load (localStorage). ----
  // saveGame/loadGame selalu bisa dipanggil eksplisit (untuk selftest);
  // auto-load saat pembuatan dunia dan auto-save berkala hanya jalan
  // saat bermain normal (bukan shot/test) agar staging tetap deterministik.
  function saveGame() {
    try {
      const focus = focusPoint();
      const data = {
        x: focus.x,
        z: focus.z,
        heading: focus.heading,
        wanted: police.wanted,
        missionIndex,
        at: Date.now(),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!Number.isFinite(data.x) || !Number.isFinite(data.z)) return false;
      if (currentCar) {
        currentCar.driver = null;
        currentCar = null;
      }
      player.showAt(data.x, data.z, data.heading || 0);
      syncCameraTo(data.heading || 0);
      if (Number.isInteger(data.missionIndex)) {
        missionIndex = Math.min(data.missionIndex, missions.length);
        for (let i = 0; i < missionIndex && i < missions.length; i += 1) {
          missions[i].done = true;
        }
        placeBeacon();
      }
      if (Number.isFinite(data.wanted) && data.wanted > police.wanted) {
        police.crimeCommitted(data.wanted - police.wanted);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Muat save lama saat mulai bermain normal (bukan shot/test).
  if (!staged) loadGame();

  function step(dt, input, actions) {
    const pressed = actions || 0;
    if (punchCooldown > 0) punchCooldown -= dt;
    if (bustedCooldown > 0) bustedCooldown -= dt;
    beacon.rotation.y += dt * 0.6;

    // Kota tetap hidup: lalu lintas dan pejalan kaki selalu bergerak.
    traffic.step(dt, collide);
    pedestrians.step(dt);

    const move = input.move();
    const run = input.run();
    const look = input.takeLook();
    // Akumulasi gerakan mouse menjadi arah kamera absolut.
    cameraYaw -= (look.x || 0) * 0.003;
    cameraPitch = clamp(cameraPitch - (look.y || 0) * 0.002, 0.05, 0.9);

    if (currentCar) {
      const drive = {
        throttle: move.forward,
        steer: move.strafe,
        brake: input.brake(),
      };
      stepCar(currentCar, dt, drive, collide);
      if (pressed & ACTION_INTERACT) exitCar();
    } else {
      player.update(dt, move, run, { yaw: cameraYaw }, collide);
      if (pressed & ACTION_INTERACT) {
        const car = nearestStealableCar();
        if (car) enterCar(car);
      } else if (pressed & ACTION_CONFIRM) {
        punch();
      }
    }

    police.step(dt, focusPoint(), collide);
    checkBusted();
    updateMissions();

    if (flashTimer > 0) {
      flashTimer -= dt;
      prompt = flashText;
    } else {
      prompt = contextualPrompt();
    }

    // Auto-save berkala saat bermain normal (bukan shot/test).
    saveTimer += dt;
    if (saveTimer >= SAVE_EVERY_SECONDS) {
      saveTimer = 0;
      if (!staged) saveGame();
    }
  }

  function getCamera() {
    const focus = focusPoint();
    let cam;
    if (currentCar) {
      cam = {
        x: focus.x,
        z: focus.z,
        heading: focus.heading,
        pitch: 0.28,
        distance: 11,
        height: 4.2,
      };
    } else {
      cam = {
        x: focus.x,
        z: focus.z,
        heading: cameraYaw,
        pitch: cameraPitch,
        distance: 7.5,
        height: 3.2,
      };
    }
    if (cameraOverride) {
      cam = { ...cam, ...cameraOverride };
    }
    return cam;
  }

  function getHudState() {
    const focus = focusPoint();
    return {
      player: { x: focus.x, z: focus.z, heading: focus.heading },
      trafficCars: traffic.cars,
      parkedCars: traffic.parked,
      policeCars: police.cars,
      pedestrians: pedestrians.walkers,
      wanted: police.wanted,
      speed: Math.round(Math.abs(currentCar ? currentCar.speed : player.state.speed) * 3.6),
      driving: !!currentCar,
      prompt,
    };
  }

  function teleport(x, z, heading) {
    if (currentCar) {
      currentCar.driver = null;
      currentCar = null;
    }
    player.showAt(x, z, heading ?? player.state.heading);
    syncCameraTo(heading ?? player.state.heading);
  }

  function setWanted(stars) {
    if (stars > police.wanted) {
      police.crimeCommitted(stars - police.wanted);
    }
    return police.wanted;
  }

  function setMission(index) {
    missionIndex = Math.min(Math.max(index, 0), missions.length);
    for (let i = 0; i < missionIndex && i < missions.length; i += 1) {
      missions[i].done = true;
    }
    placeBeacon();
    return missionIndex;
  }

  return {
    scene,
    city,
    random,
    player,
    traffic,
    pedestrians,
    police,
    missions,
    get missionIndex() {
      return missionIndex;
    },
    get currentCar() {
      return currentCar;
    },
    get driving() {
      return !!currentCar;
    },
    get wanted() {
      return police.wanted;
    },
    step,
    getCamera,
    getHudState,
    enterCar,
    exitCar,
    teleport,
    setWanted,
    setMission,
    saveGame,
    loadGame,
    collide,
    setCameraOverride,
  };
}
