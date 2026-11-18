// Teluk Senja — self-test fungsional.
// Menjalankan dunia secara skrip (tanpa keyboard/mouse) dan memeriksa
// setiap sistem: pemain, lalu lintas, pejalan kaki, curi mobil, wanted,
// polisi, misi, combat, save, HUD, kamera, dan tabrakan.
// Dipanggil dari main.js lewat ?test=1; hasilnya JSON di #selftest.
// Ditulis fresh di sesi ini (pemulihan recording baru).

import { STEP } from './config.js';
import { ACTION_INTERACT, ACTION_CONFIRM } from './input.js';

const SAVE_KEY = 'teluk-senja-save-v1';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function runSelfTest(world, input, renderer, hud) {
  const checks = [];
  let passed = 0;
  let failed = 0;

  function check(name, fn) {
    try {
      const detail = fn();
      checks.push({ name, pass: true, detail: detail ?? 'ok' });
      passed += 1;
    } catch (error) {
      checks.push({ name, pass: false, detail: String(error && error.message ? error.message : error) });
      failed += 1;
    }
  }

  function expect(condition, message) {
    if (!condition) throw new Error(message);
  }

  function stepWorld(count, actions) {
    for (let i = 0; i < count; i += 1) {
      world.step(STEP, input, actions || 0);
    }
  }

  function setDrive(forward, strafe, run, brake) {
    input.setTestDrive({
      move: { forward, strafe },
      run: !!run,
      brake: !!brake,
      actions: 0,
    });
  }

  function clearDrive() {
    input.clearTestDrive();
  }

  function nearestParkedCar() {
    const px = world.player.state.x;
    const pz = world.player.state.z;
    let best = null;
    let bestDistance = Infinity;
    for (const car of world.traffic.parked) {
      const d = Math.hypot(car.x - px, car.z - pz);
      if (d < bestDistance) {
        bestDistance = d;
        best = car;
      }
    }
    return { car: best, distance: bestDistance };
  }

  // ---- 1. Renderer dan scene hidup. ----
  check('renderer', () => {
    expect(renderer && renderer.scene, 'renderer.scene tidak ada');
    expect(renderer.camera, 'renderer.camera tidak ada');
    expect(typeof renderer.draw === 'function', 'renderer.draw bukan fungsi');
    return 'scene + camera + draw ada';
  });

  // ---- 2. Kota prosedural ada isinya. ----
  check('city', () => {
    const buildings = world.city.buildings.length;
    const nodes = world.city.nodes.length;
    const sidewalks = world.city.sidewalkPoints.length;
    expect(buildings > 0, 'tidak ada gedung');
    expect(nodes > 0, 'tidak ada simpang jalan');
    expect(sidewalks > 0, 'tidak ada titik trotoar');
    return `${buildings} gedung, ${nodes} simpang, ${sidewalks} titik trotoar`;
  });

  // ---- 3. Pemain bisa jalan kaki. ----
  check('player-walk', () => {
    const before = { x: world.player.state.x, z: world.player.state.z };
    setDrive(1, 0, false, false);
    stepWorld(30, 0);
    clearDrive();
    const moved = Math.hypot(
      world.player.state.x - before.x,
      world.player.state.z - before.z,
    );
    expect(moved > 0.5, `pemain tidak bergerak (bergerak ${moved.toFixed(2)}m)`);
    return `pemain bergerak ${moved.toFixed(2)}m dalam 0,5 detik`;
  });

  // ---- 4. Lalu lintas bergerak. ----
  check('traffic-moves', () => {
    expect(world.traffic.cars.length > 0, 'tidak ada mobil lalu lintas');
    const car = world.traffic.cars[0];
    const before = { x: car.x, z: car.z };
    stepWorld(30, 0);
    const moved = Math.hypot(car.x - before.x, car.z - before.z);
    expect(moved > 0.1, `mobil lalu lintas tidak bergerak (${moved.toFixed(2)}m)`);
    return `mobil lalu lintas bergerak ${moved.toFixed(2)}m dalam 0,5 detik`;
  });

  // ---- 5. Pejalan kaki bergerak. ----
  check('pedestrians-move', () => {
    expect(world.pedestrians.walkers.length > 0, 'tidak ada pejalan kaki');
    const walker = world.pedestrians.walkers[0];
    const before = { x: walker.x, z: walker.z };
    stepWorld(30, 0);
    const moved = Math.hypot(walker.x - before.x, walker.z - before.z);
    expect(moved > 0.05, `pejalan kaki tidak bergerak (${moved.toFixed(2)}m)`);
    return `pejalan kaki bergerak ${moved.toFixed(2)}m dalam 0,5 detik`;
  });

  // ---- 6. Tabrakan gedung: pemain tidak bisa menembus gedung. ----
  // (player.update hanya memanggil collide saat bergerak, jadi beri input jalan.)
  check('collision-building', () => {
    const building = world.city.buildings[0];
    expect(building, 'tidak ada gedung untuk diuji');
    world.teleport(building.x, building.z, 0);
    setDrive(1, 0, false, false);
    stepWorld(10, 0);
    clearDrive();
    const px = world.player.state.x;
    const pz = world.player.state.z;
    const insideX = Math.abs(px - building.x) < building.width / 2;
    const insideZ = Math.abs(pz - building.z) < building.depth / 2;
    expect(!(insideX && insideZ), 'pemain masih di dalam gedung');
    return `pemain terdorong keluar gedung ke (${px.toFixed(1)}, ${pz.toFixed(1)})`;
  });

  // ---- 7. Masuk mobil (E di dekat mobil parkir). ----
  check('enter-car', () => {
    const found = nearestParkedCar();
    expect(found.car, 'tidak ada mobil parkir');
    world.teleport(found.car.x + 2, found.car.z + 2, found.car.heading);
    stepWorld(1, ACTION_INTERACT);
    expect(world.driving, 'pemain tidak masuk mobil setelah E');
    return 'pemain masuk mobil (driving=true)';
  });

  // ---- 8. Curi mobil menaikkan wanted. ----
  check('steal-wanted', () => {
    expect(world.wanted >= 1, `wanted tidak naik setelah curi mobil (wanted=${world.wanted})`);
    return `wanted=${world.wanted} setelah curi mobil`;
  });

  // ---- 9. Misi 1 selesai setelah masuk mobil. ----
  check('mission-1', () => {
    expect(world.missionIndex >= 1, `misi 1 tidak selesai (missionIndex=${world.missionIndex})`);
    return `missionIndex=${world.missionIndex}`;
  });

  // ---- 10. Keluar mobil (E saat mengemudi). ----
  check('exit-car', () => {
    expect(world.driving, 'pemain tidak sedang mengemudi sebelum keluar');
    stepWorld(1, ACTION_INTERACT);
    expect(!world.driving, 'pemain masih di dalam mobil setelah E kedua');
    return 'pemain keluar mobil (driving=false)';
  });

  // ---- 11. Polisi muncul saat wanted. ----
  check('police-spawn', () => {
    world.setWanted(2);
    stepWorld(90, 0);
    expect(world.police.cars.length > 0, 'tidak ada mobil polisi padahal wanted=2');
    return `${world.police.cars.length} mobil polisi mengejar`;
  });

  // ---- 12. Polisi mendekati pemain. ----
  check('police-chase', () => {
    expect(world.police.cars.length > 0, 'tidak ada mobil polisi untuk diuji');
    const focus = world.player.state;
    const before = Math.min(
      ...world.police.cars.map((car) => Math.hypot(car.x - focus.x, car.z - focus.z)),
    );
    stepWorld(120, 0);
    const after = Math.min(
      ...world.police.cars.map((car) => Math.hypot(car.x - focus.x, car.z - focus.z)),
    );
    expect(after < before, `polisi tidak mendekat (${before.toFixed(1)}m -> ${after.toFixed(1)}m)`);
    return `jarak polisi terdekat ${before.toFixed(1)}m -> ${after.toFixed(1)}m`;
  });

  // ---- 13. Misi 2 selesai saat sampai di target dengan mobil. ----
  check('mission-2', () => {
    world.setMission(1);
    const found = nearestParkedCar();
    expect(found.car, 'tidak ada mobil parkir untuk misi 2');
    world.teleport(found.car.x + 2, found.car.z + 2, found.car.heading);
    stepWorld(1, ACTION_INTERACT);
    expect(world.driving, 'gagal masuk mobil untuk misi 2');
    const target = world.missions[1].target;
    const car = world.currentCar;
    car.x = target.x - 4;
    car.z = target.z - 4;
    if (car.group) {
      car.group.position.x = car.x;
      car.group.position.z = car.z;
    }
    stepWorld(5, 0);
    expect(world.missionIndex >= 2, `misi 2 tidak selesai (missionIndex=${world.missionIndex})`);
    return `missionIndex=${world.missionIndex} setelah sampai di target`;
  });

  // ---- 14. Combat: pukulan menaikkan wanted. ----
  check('punch', () => {
    // Keluar dari mobil dulu bila masih mengemudi.
    if (world.driving) stepWorld(1, ACTION_INTERACT);
    // Teleport ke dekat pejalan kaki terdekat.
    const walker = world.pedestrians.walkers[0];
    expect(walker, 'tidak ada pejalan kaki untuk dipukul');
    world.teleport(walker.x + 1.5, walker.z + 1.5, 0);
    const before = world.wanted;
    stepWorld(1, ACTION_CONFIRM);
    expect(world.wanted > before, `wanted tidak naik setelah pukulan (${before} -> ${world.wanted})`);
    return `wanted ${before} -> ${world.wanted} setelah pukulan`;
  });

  // ---- 15. Tertangkap: polisi dekat me-respawn pemain. ----
  check('busted', () => {
    world.setWanted(2);
    stepWorld(30, 0);
    expect(world.police.cars.length > 0, 'tidak ada mobil polisi untuk uji tertangkap');
    const car = world.police.cars[0];
    const px = world.player.state.x;
    const pz = world.player.state.z;
    car.x = px + 1;
    car.z = pz + 1;
    if (car.group) {
      car.group.position.x = car.x;
      car.group.position.z = car.z;
    }
    stepWorld(2, 0);
    // Setelah tertangkap pemain kembali ke titik awal (jarak dari posisi
    // sebelum uji jauh) — atau setidaknya tidak lagi di tempat yang sama.
    const moved = Math.hypot(world.player.state.x - px, world.player.state.z - pz);
    expect(moved > 5, 'pemain tidak di-respawn setelah ditangkap');
    return `pemain di-respawn ${moved.toFixed(1)}m dari lokasi tertangkap`;
  });

  // ---- 16. Save / load localStorage. ----
  check('save-load', () => {
    const saved = world.saveGame();
    expect(saved, 'saveGame() mengembalikan false');
    const raw = window.localStorage.getItem(SAVE_KEY);
    expect(raw, 'tidak ada data save di localStorage');
    const data = JSON.parse(raw);
    expect(isFiniteNumber(data.x) && isFiniteNumber(data.z), 'data save tidak punya koordinat');
    expect(Number.isInteger(data.missionIndex), 'data save tidak punya missionIndex');
    const loaded = world.loadGame();
    expect(loaded, 'loadGame() mengembalikan false');
    // Bersihkan save uji agar tidak mencemari permainan normal.
    window.localStorage.removeItem(SAVE_KEY);
    return `save/load ok (x=${data.x.toFixed(1)}, mission=${data.missionIndex})`;
  });

  // ---- 17. HUD dan kamera memberi state lengkap. ----
  check('hud-camera', () => {
    const hudState = world.getHudState();
    for (const key of ['player', 'trafficCars', 'parkedCars', 'policeCars', 'pedestrians', 'wanted', 'speed', 'driving', 'prompt']) {
      expect(key in hudState, `getHudState() tidak punya ${key}`);
    }
    expect(isFiniteNumber(hudState.player.x) && isFiniteNumber(hudState.player.z), 'posisi pemain di HUD bukan angka');
    const cam = world.getCamera();
    for (const key of ['x', 'z', 'heading', 'pitch', 'distance', 'height']) {
      expect(isFiniteNumber(cam[key]), `getCamera().${key} bukan angka`);
    }
    return 'getHudState + getCamera lengkap dan finite';
  });

  // ---- 18. Mengemudi: mobil bergerak saat gas. ----
  check('drive', () => {
    const found = nearestParkedCar();
    expect(found.car, 'tidak ada mobil parkir untuk uji mengemudi');
    world.teleport(found.car.x + 2, found.car.z + 2, found.car.heading);
    stepWorld(1, ACTION_INTERACT);
    expect(world.driving, 'gagal masuk mobil untuk uji mengemudi');
    const car = world.currentCar;
    const before = { x: car.x, z: car.z };
    setDrive(1, 0, false, false);
    stepWorld(60, 0);
    clearDrive();
    const moved = Math.hypot(car.x - before.x, car.z - before.z);
    expect(moved > 2, `mobil tidak bergerak saat gas (${moved.toFixed(2)}m)`);
    expect(Math.abs(car.speed) > 0.5, `kecepatan mobil 0 saat gas (speed=${car.speed})`);
    return `mobil bergerak ${moved.toFixed(2)}m dalam 1 detik, speed=${car.speed.toFixed(1)}`;
  });

  clearDrive();
  if (world.driving) stepWorld(1, ACTION_INTERACT);

  return {
    passed,
    failed,
    total: checks.length,
    checks,
  };
}
