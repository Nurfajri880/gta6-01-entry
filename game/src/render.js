// Three.js rendering for Teluk Senja: the WebGL renderer, the sunset sky dome,
// the low sun over the sea, lights and fog, and the third-person camera. Drawing
// only — no game rules live here.
import * as THREE from '../vendor/three.module.min.js';
import { SKY_HORIZON, SKY_TOP, SUN_COLOR, SUN_POSITION } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8a5a6e, 120, 520);

  // Sky dome: a gradient from deep purple overhead to orange at the horizon.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(SKY_TOP) },
        horizon: { value: new THREE.Color(SKY_HORIZON) },
      },
      vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; void main() { float h = clamp(normalize(vPos).y * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.8)), 1.0); }',
    }),
  );
  sky.name = 'sky';
  scene.add(sky);

  // The sun itself: a warm disc low over the sea, plus a soft halo.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: SUN_COLOR, fog: false }),
  );
  sun.position.set(SUN_POSITION[0], SUN_POSITION[1], SUN_POSITION[2]);
  sun.lookAt(0, SUN_POSITION[1], 0);
  scene.add(sun);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.25, fog: false }),
  );
  halo.position.set(SUN_POSITION[0] + 4, SUN_POSITION[1], SUN_POSITION[2]);
  halo.lookAt(0, SUN_POSITION[1], 0);
  scene.add(halo);

  const hemi = new THREE.HemisphereLight(0x8a6fb8, 0x3a2f28, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb347, 2.2);
  sunLight.position.set(SUN_POSITION[0], 90, SUN_POSITION[2]);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -220;
  sunLight.shadow.camera.right = 220;
  sunLight.shadow.camera.top = 220;
  sunLight.shadow.camera.bottom = -220;
  sunLight.shadow.camera.far = 700;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 12, 30);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);

  // Third-person camera: behind `target` (a {x, z} ground point plus a heading),
  // `distance` back, `height` up, pitched down toward the target.
  function followCamera(target, heading, pitch, distance, height) {
    const backX = -Math.sin(heading) * distance;
    const backZ = -Math.cos(heading) * distance;
    const eye = new THREE.Vector3(target.x + backX, height, target.z + backZ);
    // Keep the camera out of buildings is a polish problem; for now clamp it above ground.
    if (eye.y < 1.2) eye.y = 1.2;
    camera.position.copy(eye);
    const look = new THREE.Vector3(target.x, 1.6 + pitch * 4, target.z);
    camera.lookAt(look);
  }

  function draw() {
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, followCamera, draw, resize };
}
