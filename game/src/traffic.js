// Moving traffic for Solmar Bay: AI cars circulating on the road network on rectangular
// waypoint loops around city blocks. No pathfinding, no avoidance AI — each car follows the
// four corners of its loop, eases off near crossings, and respawns at the next corner if it
// ever stalls for more than three seconds, so the network can never deadlock.
import * as THREE from 'three';
import { CITY, ROAD_CENTERS } from './config.js';
import { mulberry32, range, pick } from './random.js';

const PAINT = [0xc23b2e, 0x2e6db4, 0xe8e8e8, 0x222222, 0xd8a020, 0x3f7d4e, 0x7a4a8a, 0xd86a20];
const LANE = 2.4;
const STALL_LIMIT = 3;

// One traffic car: a body slab, a glass cabin, a roof panel and four wheels.
function buildTrafficCar(rng) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: pick(rng, PAINT), roughness: 0.35, metalness: 0.35,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.0), paint);
  body.position.y = 0.5;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.45, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x202e3a, roughness: 0.15, metalness: 0.6 }),
  );
  cabin.position.set(0, 0.95, -0.25);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.7), paint);
  roof.position.set(0, 1.2, -0.25);
  car.add(body, cabin, roof);
  const tyre = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 1 });
  for (const [wx, wz] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]) {
    const wheel = new THREE.Mesh(tyre, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.32, wz);
    car.add(wheel);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0x665522 });
  for (const wx of [-0.55, 0.55]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.05), lampMat);
    lamp.position.set(wx, 0.55, 2.02);
    car.add(lamp);
  }
  for (const part of car.children) part.castShadow = true;
  return car;
}

/** The four corners of a loop around block (bx, bz), clockwise starting north-west. */
function loopCorners(bx, bz) {
  const x1 = ROAD_CENTERS[bx];
  const x2 = ROAD_CENTERS[bx + 1];
  const z1 = ROAD_CENTERS[bz];
  const z2 = ROAD_CENTERS[bz + 1];
  return [
    { x: x1, z: z1 },
    { x: x2, z: z1 },
    { x: x2, z: z2 },
    { x: x1, z: z2 },
  ];
}

/** Heading (rotation.y) for travelling from one corner to the next. */
function legHeading(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Ease a heading toward a target heading, turning at most `rate * dt` radians. */
function turnToward(current, target, rate, dt) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = rate * dt;
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}

/**
 * Build `count` traffic cars. Loops are dealt round-robin over the blocks and each car
 * starts at a different point of its loop, so cars spread out instead of stacking.
 */
export function createTraffic(scene, seed, count = 14) {
  const rng = mulberry32(seed * 31 + 7);
  const cars = [];
  const blocks = [];
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) blocks.push([bx, bz]);
  }
  for (let i = 0; i < count; i += 1) {
    const [bx, bz] = blocks[i % blocks.length];
    const corners = loopCorners(bx, bz);
    const mesh = buildTrafficCar(rng);
    const edge = Math.floor(rng() * 4);
    const along = rng() * (CITY.blockSize + CITY.roadWidth);
    const car = {
      mesh,
      corners,
      edge,
      along,
      speed: range(rng, 6, 11),
      heading: legHeading(corners[edge], corners[(edge + 1) % 4]),
      stalled: 0,
      lastX: 0,
      lastZ: 0,
    };
    placeOnLoop(car);
    car.lastX = car.mesh.position.x;
    car.lastZ = car.mesh.position.z;
    scene.add(mesh);
    cars.push(car);
  }
  return {
    cars,
    /** Advance every car one frame; call with a fixed dt for deterministic screenshots. */
    update(dt) {
      for (const car of cars) updateCar(car, dt);
    },
  };
}

/** Where a car sits on its loop: corner + distance along the current leg + lane offset. */
function placeOnLoop(car) {
  const from = car.corners[car.edge];
  const to = car.corners[(car.edge + 1) % 4];
  const leg = CITY.blockSize + CITY.roadWidth;
  const t = Math.max(0, Math.min(1, car.along / leg));
  const cx = from.x + (to.x - from.x) * t;
  const cz = from.z + (to.z - from.z) * t;
  // Right-hand lane: offset to the driver's right of the direction of travel.
  let ox = 0;
  let oz = 0;
  if (to.x > from.x) oz = LANE;
  else if (to.x < from.x) oz = -LANE;
  else if (to.z > from.z) ox = -LANE;
  else ox = LANE;
  car.mesh.position.set(cx + ox, 0, cz + oz);
}

/** Slow down while crossing a perpendicular road (an intersection). */
function crossingFactor(car) {
  const p = car.mesh.position;
  const movingX = Math.abs(Math.sin(car.heading)) > 0.7;
  for (const c of ROAD_CENTERS) {
    const d = movingX ? Math.abs(p.x - c) : Math.abs(p.z - c);
    if (d < 8) return 0.45;
  }
  return 1;
}

function updateCar(car, dt) {
  const leg = CITY.blockSize + CITY.roadWidth;
  const from = car.corners[car.edge];
  const to = car.corners[(car.edge + 1) % 4];
  const target = legHeading(from, to);
  car.heading = turnToward(car.heading, target, 2.6, dt);
  const step = car.speed * crossingFactor(car) * dt;
  car.along += step;
  if (car.along >= leg) {
    car.along -= leg;
    car.edge = (car.edge + 1) % 4;
  }
  car.mesh.rotation.y = car.heading;
  placeOnLoop(car);
  // Anti-deadlock: a car that barely moved for three seconds jumps to its next corner.
  const moved = Math.hypot(car.mesh.position.x - car.lastX, car.mesh.position.z - car.lastZ);
  if (moved < 0.01 && step > 0.01) car.stalled += dt;
  else car.stalled = 0;
  car.lastX = car.mesh.position.x;
  car.lastZ = car.mesh.position.z;
  if (car.stalled > STALL_LIMIT) {
    car.edge = (car.edge + 1) % 4;
    car.along = 0;
    car.stalled = 0;
    car.heading = legHeading(car.corners[car.edge], car.corners[(car.edge + 1) % 4]);
    placeOnLoop(car);
    car.lastX = car.mesh.position.x;
    car.lastZ = car.mesh.position.z;
  }
}
