// Boot and the one loop for Teluk Senja: the world advances in fixed 1/60 s
// steps and the renderer paints what is there. Three screens: title (a living
// city backdrop), play, paused. ?seed=N fixes the city. ?shot=cover|onfoot|chase
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot. ?test=1 runs the functional
// self-test instead of the normal loop.
import { MAX_FRAME, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createWorld } from './world.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const testMode = params.get('test') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const renderer = createRenderer(canvas);
const city = createCity(renderer.scene, random);
const world = createWorld(renderer.scene, city, random);
const hud = createHud(city);
const input = createInput(canvas);

// Kait debug (hanya saat ?debug=1): paparkan dunia + input agar pengujian
// end-to-end via CDP bisa membaca posisi dan memverifikasi alur keyboard
// (mis. tombol E masuk mobil) tanpa mengubah permainan normal.
if (params.get('debug') === '1') {
  window.__world = world;
  window.__input = input;
}

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, world, renderer, hud);
  let painted = 0;
  function paint() {
    // Posisikan kamera mengikuti dunia (termasuk override dari shots.js),
    // sama seperti frame loop permainan — tanpanya kamera diam di posisi
    // awal dan semua shot menampilkan pemandangan yang sama.
    const cam = world.getCamera();
    renderer.followCamera({ x: cam.x, z: cam.z }, cam.heading, cam.pitch, cam.distance, cam.height);
    renderer.draw();
    hud.drawMinimap(world.getHudState());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

async function runTest() {
  const { runSelfTest } = await import('./selftest.js');
  const results = runSelfTest(world, input, renderer, hud);
  const box = document.getElementById('selftest');
  box.style.display = 'block';
  box.textContent = JSON.stringify(results, null, 2);
  window.__testResults = results;
  window.__testDone = true;
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let orbit = 0;
  hud.showTitle();
  announce('Teluk Senja. Klik atau tekan Enter untuk bermain.');

  function startGame() {
    screen = SCREEN_PLAY;
    hud.hideTitle();
    announce('Bermain. WASD untuk bergerak, E untuk masuk mobil.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      // Attract mode: the city lives (traffic, pedestrians) behind the title.
      while (accumulator >= STEP) {
        world.step(STEP, { move: () => ({ forward: 0, strafe: 0 }), run: () => false, brake: () => false, takeLook: () => ({ x: 0, y: 0 }), takeActions: () => 0 });
        accumulator -= STEP;
      }
      orbit += 0.00012;
      const ox = Math.cos(orbit) * 130;
      const oz = Math.sin(orbit) * 130;
      renderer.camera.position.set(ox, 48, oz);
      renderer.camera.lookAt(-80, 12, 0);
      renderer.draw();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showPaused();
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      hud.hidePaused();
      announce('Bermain.');
    }
    if (screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP) {
        // Serahkan aksi sekali-tekan ke world.step pada substep pertama saja,
        // supaya E (masuk/keluar mobil) tidak hilang karena sudah dikonsumsi
        // takeActions() di atas. Substep berikutnya mendapat 0.
        world.step(STEP, input, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const cam = world.getCamera();
    renderer.followCamera({ x: cam.x, z: cam.z }, cam.heading, cam.pitch, cam.distance, cam.height);
    renderer.draw();
    const hudState = world.getHudState();
    hud.setWanted(hudState.wanted);
    hud.setSpeed(hudState.speed, hudState.driving);
    hud.setPrompt(hudState.prompt);
    hud.drawMinimap(hudState);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showPaused();
      announce('Jeda.');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (testMode) runTest();
else runGame();
