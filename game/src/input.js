// Keyboard and mouse input for Teluk Senja. Held keys give a movement vector;
// one-shot presses (interact, pause, confirm) are queued as flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// Mouse look works through pointer lock; a test hook lets the self-test drive the
// same input path without a real keyboard.
import {
  KEY_BACK,
  KEY_BRAKE,
  KEY_FORWARD,
  KEY_INTERACT,
  KEY_LEFT,
  KEY_PAUSE,
  KEY_RIGHT,
  KEY_RUN,
} from './config.js';

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let locked = false;
  let testDrive = null;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === KEY_INTERACT) actions |= ACTION_INTERACT;
    else if (event.code === KEY_PAUSE || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === KEY_BRAKE) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    lookX += event.movementX;
    lookY += event.movementY;
  });
  canvas.addEventListener('click', () => {
    if (!locked && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });

  return {
    // Forward/strafe as -1, 0 or 1 each, relative to the camera yaw.
    move() {
      if (testDrive) return testDrive.move;
      const forward = (held.has(KEY_FORWARD) ? 1 : 0) - (held.has(KEY_BACK) ? 1 : 0);
      const strafe = (held.has(KEY_RIGHT) ? 1 : 0) - (held.has(KEY_LEFT) ? 1 : 0);
      return { forward, strafe };
    },
    run() {
      if (testDrive) return !!testDrive.run;
      return held.has(KEY_RUN);
    },
    brake() {
      if (testDrive) return !!testDrive.brake;
      return held.has(KEY_BRAKE);
    },
    // Mouse look deltas since the last call, in pixels.
    takeLook() {
      const taken = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return taken;
    },
    // One-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      if (testDrive && testDrive.actions) {
        const taken = testDrive.actions;
        testDrive.actions = 0;
        return taken;
      }
      const taken = actions;
      actions = 0;
      return taken;
    },
    isLocked() {
      return locked;
    },
    // Self-test only: drive the game with a scripted input object
    // { move: { forward, strafe }, run, brake, actions }.
    setTestDrive(script) {
      testDrive = script;
    },
    clearTestDrive() {
      testDrive = null;
    },
  };
}
