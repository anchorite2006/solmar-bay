// Solmar Bay M3: renderer, sun + sky, city, player, drivable cars, moving traffic,
// pedestrians, a wanted level with police chases, a three-step mission chain, a
// shove on foot, a 2D minimap, HUD, start overlay, and the ?shot= staged views used
// for screenshots.
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
import { createWanted } from './wanted.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? SEED_DEFAULT) || SEED_DEFAULT;
const shot = params.get('shot');
const trafficCount = params.has('traffic') ? Number(params.get('traffic')) : 14;
const pedCount = params.has('peds') ? Number(params.get('peds')) : 24;

const app = document.getElementById('app');
const posEl = document.getElementById('pos');
const speedEl = document.getElementById('speed');
const objectiveEl = document.getElementById('objective');
const wantedEl = document.getElementById('wanted');
const cashEl = document.getElementById('cash');
const promptEl = document.getElementById('prompt');
const toastEl = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const bustedEl = document.getElementById('busted');
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

const wanted = createWanted();
const police = createPolice(scene, city.colliders);
const missions = createMissions(scene);
objectiveEl.textContent = missions.objectiveText();

const ctx = {
  player,
  input,
  cars: city.cars,
  carColliders: city.carColliders,
  colliders: city.colliders,
  traffic,
  pedestrians,
  driving,
  wanted,
  police,
  missions,
  overview: false,
  cameraPitch: 0.42,
  cameraDistance: CAMERA.distance,
  promptEl,
  toastEl,
  objectiveEl,
  wantedEl,
  cashEl,
  bustedEl,
};

function focusPoint() {
  return driving.car ? driving.car.position : player.position;
}

function focusSpeed() {
  if (driving.car) return Math.abs(driving.speed);
  return 0;
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
  wantedEl.textContent = wanted.starsText();
  wantedEl.style.color = wanted.level > 0 ? '#ffd34d' : 'rgba(255,255,255,0.55)';
  cashEl.textContent = `$${missions.cash}`;
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
  // Mission marker: the golden beacon the player is heading for.
  const target = missions.currentTarget();
  mapCtx.fillStyle = '#ffd34d';
  mapCtx.beginPath();
  mapCtx.arc(toMap(target.x), toMap(target.z), 5, 0, Math.PI * 2);
  mapCtx.fill();
  // Traffic cars as white dots.
  mapCtx.fillStyle = '#ffffff';
  for (const car of traffic.cars) {
    mapCtx.beginPath();
    mapCtx.arc(toMap(car.mesh.position.x), toMap(car.mesh.position.z), 2, 0, Math.PI * 2);
    mapCtx.fill();
  }
  // Police cars as flashing red/blue dots.
  const flashRed = Math.sin(performance.now() / 180) > 0;
  mapCtx.fillStyle = flashRed ? '#ff3b30' : '#3b82ff';
  for (const car of police.cars) {
    mapCtx.beginPath();
    mapCtx.arc(toMap(car.mesh.position.x), toMap(car.mesh.position.z), 3.5, 0, Math.PI * 2);
    mapCtx.fill();
  }
  // The player: yellow on foot, cyan in a car.
  const focus = focusPoint();
  mapCtx.fillStyle = driving.car ? '#37d8e8' : '#ffe9a8';
  mapCtx.beginPath();
  mapCtx.arc(toMap(focus.x), toMap(focus.z), 4, 0, Math.PI * 2);
  mapCtx.fill();
}

// Busted: the cops haul the player in. The overlay holds for a beat, then the player
// is dropped back on foot nearby with a clean slate and the current job step re-armed.
let busted = { active: false, until: 0 };
function triggerBusted() {
  if (busted.active) return;
  busted.active = true;
  busted.until = performance.now() + 1800;
  bustedEl.style.display = 'flex';
  if (driving.car) exitCar(driving, player);
}
function resolveBusted() {
  busted.active = false;
  bustedEl.style.display = 'none';
  player.position.set(0, 0, 27);
  player.rotation.y = Math.PI / 2;
  player.visible = true;
  input.yaw = -Math.PI / 2;
  wanted.clear();
  police.removeAll();
  missions.resetCurrentStep();
  objectiveEl.textContent = missions.objectiveText();
  showToast('You walked away clean. The job is still waiting.');
}

// Crime timers: a hard crash or a pedestrian hit only counts once per incident.
let crashCooldownUntil = 0;
const pedHitAt = new Map();

function checkCrimes(prevSpeed) {
  const now = performance.now();
  if (driving.car) {
    const drop = prevSpeed - driving.speed;
    if (prevSpeed > 8 && drop > 7 && now > crashCooldownUntil) {
      wanted.add(1);
      crashCooldownUntil = now + 3000;
      showToast('Hard crash! The cops noticed.');
    }
    if (Math.abs(driving.speed) > 4) {
      const car = driving.car.position;
      pedestrians.walkers.forEach((w, i) => {
        const d = Math.hypot(w.mesh.position.x - car.x, w.mesh.position.z - car.z);
        if (d < 1.8 && now - (pedHitAt.get(i) || 0) > 4000) {
          pedHitAt.set(i, now);
          pedestrians.scare(car.x, car.z, 2, 2.5);
          wanted.add(1);
          showToast('You hit a pedestrian!');
        }
      });
    }
  }
  // Shove on foot: F near a walker sends them fleeing and draws a star.
  if (!driving.car && input.consumePunch()) {
    const scared = pedestrians.scare(player.position.x, player.position.z, 3, 2.5);
    if (scared) {
      wanted.add(1);
      showToast('You shoved a pedestrian. Someone called the cops.');
    }
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
// Debug handle for local play-testing (positions, driving, wanted, police, missions).
window.__solmarDebug = {
  traffic, pedestrians, driving, player, cars: city.cars,
  wanted, police, missions,
  get busted() { return busted.active; },
};
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started && !busted.active) {
    if (input.consumeAction()) {
      if (driving.car) {
        exitCar(driving, player);
      } else {
        const target = nearestStealable(player.position, city.cars);
        if (target) {
          enterCar(driving, target, city.cars, city.carColliders, player);
          wanted.add(1);
          showToast('Stolen! The cops are on their way.');
          input.yaw = driving.heading + Math.PI; // swing the camera behind the car
        }
      }
    }
    const prevSpeed = driving.speed;
    if (driving.car) {
      updateDriving(driving, input.drive(), city.colliders, dt);
      player.position.set(driving.car.position.x, 0, driving.car.position.z);
    } else {
      const wish = input.wishDirection();
      movePlayer(player, city.colliders, wish.x, wish.z, dt, input.running());
    }
    checkCrimes(prevSpeed);
    traffic.update(dt);
    pedestrians.update(dt);
    missions.animate(performance.now());
    missions.update(focusPoint(), {
      showToast,
      setObjective: (text) => { objectiveEl.textContent = text; },
      onHeat: () => { wanted.add(1); },
    });
    const focus = focusPoint();
    police.ensure(wanted.level, focus);
    police.update(dt, focus, focusSpeed(), { onBusted: triggerBusted }, driving.collider);
    wanted.update(dt, police.nearestDistance(focus));
    // Steal prompt: only on foot, only near a parked car.
    if (!driving.car && nearestStealable(player.position, city.cars)) {
      promptEl.style.display = 'block';
    } else {
      promptEl.style.display = 'none';
    }
    if (toastUntil && performance.now() > toastUntil) {
      toastEl.style.display = 'none';
      toastUntil = 0;
    }
  }
  if (busted.active && performance.now() > busted.until) resolveBusted();
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
  missions.animate(performance.now());
  police.update(0.12, focusPoint(), focusSpeed(), { onBusted: () => {} }, driving.collider);
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
