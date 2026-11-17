// Solmar Bay M1 baseline: renderer, sun + sky, city, player, follow camera, HUD, start overlay,
// and the ?shot= staged views used for screenshots.
import * as THREE from 'three';
import { CAMERA, SEED_DEFAULT, SKY } from './config.js';
import { buildCity } from './world.js';
import { makePlayer, movePlayer } from './player.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? SEED_DEFAULT) || SEED_DEFAULT;
const shot = params.get('shot');

const app = document.getElementById('app');
const posEl = document.getElementById('pos');
const overlay = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY.horizon);
scene.fog = new THREE.Fog(SKY.fogColor, SKY.fogNear, SKY.fogFar);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);

const hemi = new THREE.HemisphereLight(SKY.top, 0xa89878, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(SKY.sunColor, SKY.sunIntensity);
sun.position.set(60, 150, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -140;
sun.shadow.camera.right = 140;
sun.shadow.camera.top = 140;
sun.shadow.camera.bottom = -140;
sun.shadow.camera.far = 400;
scene.add(sun);

const city = buildCity(scene, seed);
const player = makePlayer();
player.position.set(0, 0, 27);
player.rotation.y = Math.PI / 2;
scene.add(player);
const input = createInput(renderer.domElement);
input.yaw = -Math.PI / 2; // live play starts facing east down the avenue, camera behind on the road

const ctx = {
  player,
  input,
  cars: city.cars,
  colliders: city.colliders,
  overview: false,
  cameraPitch: 0.42,
  cameraDistance: CAMERA.distance,
};

function placeCamera() {
  if (ctx.overview) {
    camera.position.set(70, 85, 70);
    camera.lookAt(0, 0, 0);
    return;
  }
  const yaw = input.yaw;
  const pitch = shot ? ctx.cameraPitch : input.pitch;
  const dist = ctx.cameraDistance;
  const horiz = dist * Math.cos(pitch);
  camera.position.set(
    player.position.x + Math.sin(yaw) * horiz,
    player.position.y + 1.6 + dist * Math.sin(pitch),
    player.position.z + Math.cos(yaw) * horiz,
  );
  camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
}

function updateHud() {
  posEl.textContent = `x ${player.position.x.toFixed(1)} \u00a0 z ${player.position.z.toFixed(1)}`;
}

let started = false;
overlay.addEventListener('click', () => {
  started = true;
  overlay.classList.add('hidden');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started) {
    const wish = input.wishDirection();
    movePlayer(player, city.colliders, wish.x, wish.z, dt, input.running());
  }
  placeCamera();
  updateHud();
  renderer.render(scene, camera);
}

if (shot) {
  // Staged screenshot mode: no overlay, no loop — one settled frame, then signal readiness.
  overlay.classList.add('hidden');
  started = true;
  stageShot(shot, ctx);
  placeCamera();
  updateHud();
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__solmarReady = true;
} else {
  renderer.setAnimationLoop(frame);
  window.__solmarReady = true;
}
