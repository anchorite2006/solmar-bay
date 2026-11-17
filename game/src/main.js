// Solmar Bay M2: renderer, sun + sky, city, player, drivable cars, moving traffic,
// pedestrians, a mission marker, a 2D minimap, HUD, start overlay, and the ?shot= staged
// views used for screenshots.
import * as THREE from 'three';
import { CAMERA, CITY_SPAN, ROAD_CENTERS, SEED_DEFAULT, SKY } from './config.js';
import { buildCity } from './world.js';
import { makePlayer, movePlayer } from './player.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import {
  createDriving, enterCar, exitCar, nearestStealable, speedKmh, updateDriving,
} from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? SEED_DEFAULT) || SEED_DEFAULT;
const shot = params.get('shot');
const trafficCount = params.has('traffic') ? Number(params.get('traffic')) : 14;
const pedCount = params.has('peds') ? Number(params.get('peds')) : 24;

const app = document.getElementById('app');
const posEl = document.getElementById('pos');
const speedEl = document.getElementById('speed');
const objectiveEl = document.getElementById('objective');
const promptEl = document.getElementById('prompt');
const toastEl = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const minimap = document.getElementById('minimap');
const mapCtx = minimap.getContext('2d');

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
const traffic = createTraffic(scene, seed, trafficCount);
const pedestrians = createPedestrians(scene, seed, pedCount);
const driving = createDriving();
const player = makePlayer();
player.position.set(0, 0, 27);
player.rotation.y = Math.PI / 2;
scene.add(player);
const input = createInput(renderer.domElement);
input.yaw = -Math.PI / 2; // live play starts facing east down the avenue, camera behind on the road

// Mission seed: one beacon at the 81 / 27 intersection. Reach it, on foot or by car.
const MARKER = { x: 81, z: 27 };
const beacon = new THREE.Group();
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(1.4, 1.4, 34, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
);
beam.position.y = 17;
const gem = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.6),
  new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xaa7700, roughness: 0.3, metalness: 0.4 }),
);
gem.position.y = 35;
const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 3.0, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.06;
beacon.add(beam, gem, ring);
beacon.position.set(MARKER.x, 0, MARKER.z);
scene.add(beacon);

const ctx = {
  player,
  input,
  cars: city.cars,
  carColliders: city.carColliders,
  colliders: city.colliders,
  traffic,
  pedestrians,
  driving,
  overview: false,
  cameraPitch: 0.42,
  cameraDistance: CAMERA.distance,
  promptEl,
  toastEl,
  objectiveEl,
  marker: MARKER,
  markerDone: false,
  beacon,
};

function focusPoint() {
  return driving.car ? driving.car.position : player.position;
}

function placeCamera() {
  const focus = focusPoint();
  if (ctx.overview) {
    camera.position.set(80, 120, 80);
    camera.lookAt(0, 0, 0);
    return;
  }
  const yaw = input.yaw;
  const pitch = shot ? ctx.cameraPitch : input.pitch;
  const dist = driving.car ? Math.max(ctx.cameraDistance, 11) : ctx.cameraDistance;
  const horiz = dist * Math.cos(pitch);
  camera.position.set(
    focus.x + Math.sin(yaw) * horiz,
    focus.y + 1.6 + dist * Math.sin(pitch),
    focus.z + Math.cos(yaw) * horiz,
  );
  camera.lookAt(focus.x, focus.y + 1.5, focus.z);
}

let toastUntil = 0;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  toastUntil = performance.now() + 4000;
}

function updateHud() {
  const focus = focusPoint();
  posEl.textContent = `x ${focus.x.toFixed(1)} \u00a0 z ${focus.z.toFixed(1)}`;
  speedEl.textContent = driving.car ? `${speedKmh(driving).toFixed(0)} km/h` : 'On foot';
}

function drawMinimap() {
  const W = minimap.width;
  const H = minimap.height;
  const toMap = (v) => ((v + CITY_SPAN) / (CITY_SPAN * 2)) * W;
  mapCtx.clearRect(0, 0, W, H);
  mapCtx.fillStyle = 'rgba(8,24,44,0.72)';
  mapCtx.fillRect(0, 0, W, H);
  // Roads as pale strips on the grid lines.
  mapCtx.fillStyle = '#8a94a0';
  for (const c of ROAD_CENTERS) {
    const p = toMap(c);
    mapCtx.fillRect(0, p - 3, W, 6);
    mapCtx.fillRect(p - 3, 0, 6, H);
  }
  // Mission marker.
  mapCtx.fillStyle = '#ffd34d';
  mapCtx.beginPath();
  mapCtx.arc(toMap(MARKER.x), toMap(MARKER.z), 5, 0, Math.PI * 2);
  mapCtx.fill();
  // Traffic cars as white dots.
  mapCtx.fillStyle = '#ffffff';
  for (const car of traffic.cars) {
    mapCtx.beginPath();
    mapCtx.arc(toMap(car.mesh.position.x), toMap(car.mesh.position.z), 2, 0, Math.PI * 2);
    mapCtx.fill();
  }
  // The player: yellow on foot, cyan in a car.
  const focus = focusPoint();
  mapCtx.fillStyle = driving.car ? '#37d8e8' : '#ffe9a8';
  mapCtx.beginPath();
  mapCtx.arc(toMap(focus.x), toMap(focus.z), 4, 0, Math.PI * 2);
  mapCtx.fill();
}

function checkMission() {
  if (ctx.markerDone) return;
  const focus = focusPoint();
  if (Math.hypot(focus.x - MARKER.x, focus.z - MARKER.z) < 7) {
    ctx.markerDone = true;
    objectiveEl.textContent = 'Objective complete — welcome to Solmar Bay!';
    showToast('Objective complete — welcome to Solmar Bay!');
    beacon.visible = false;
  }
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
// Debug handle for local play-testing (positions, driving state); harmless in the game.
window.__solmarDebug = { traffic, pedestrians, driving, player, cars: city.cars };
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started) {
    if (input.consumeAction()) {
      if (driving.car) {
        exitCar(driving, player);
      } else {
        const target = nearestStealable(player.position, city.cars);
        if (target) {
          enterCar(driving, target, city.cars, city.carColliders, player);
          input.yaw = driving.heading + Math.PI; // swing the camera behind the car
        }
      }
    }
    if (driving.car) {
      updateDriving(driving, input.drive(), city.colliders, dt);
      player.position.set(driving.car.position.x, 0, driving.car.position.z);
    } else {
      const wish = input.wishDirection();
      movePlayer(player, city.colliders, wish.x, wish.z, dt, input.running());
    }
    traffic.update(dt);
    pedestrians.update(dt);
    gem.rotation.y += dt * 1.5;
    gem.position.y = 35 + Math.sin(performance.now() / 500) * 0.5;
    // Steal prompt: only on foot, only near a parked car.
    if (!driving.car && nearestStealable(player.position, city.cars)) {
      promptEl.style.display = 'block';
    } else {
      promptEl.style.display = 'none';
    }
    checkMission();
    if (toastUntil && performance.now() > toastUntil) {
      toastEl.style.display = 'none';
      toastUntil = 0;
    }
  }
  placeCamera();
  updateHud();
  drawMinimap();
  renderer.render(scene, camera);
}

if (shot) {
  // Staged screenshot mode: no overlay, no loop — settle the world, stage the frame,
  // render once, then signal readiness.
  overlay.classList.add('hidden');
  started = true;
  stageShot(shot, ctx);
  placeCamera();
  updateHud();
  drawMinimap();
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__solmarReady = true;
} else {
  renderer.setAnimationLoop(frame);
  window.__solmarReady = true;
}
