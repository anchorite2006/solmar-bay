// Stealable, drivable cars for Solmar Bay: walk up to a parked car, press E to steal it,
// drive with arcade controls, press E again to step out. The driven car stays on the road
// network (a move that would leave the asphalt is refused) and slides to a stop against
// building footprints instead of passing through them.
import { CITY, CITY_SPAN, ROAD_CENTERS } from './config.js';

const STEAL_RANGE = 3.6;
const CAR_RADIUS = 2.1;
const ACCEL = 15;
const REVERSE_ACCEL = 10;
const BRAKE = 30;
const MAX_FORWARD = 22;
const MAX_BOOST = 30;
const MAX_REVERSE = 8;
const TURN_RATE = 1.9;
const DRAG = 6;

export function createDriving() {
  return { car: null, collider: null, speed: 0, heading: 0 };
}

/** The nearest parked car within stealing range of a world position, or null. */
export function nearestStealable(pos, cars, maxDist = STEAL_RANGE) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.position.x - pos.x, car.position.z - pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** True when a world point sits on asphalt (within a road strip), with a kerb margin. */
export function onRoad(x, z) {
  const m = CITY.roadWidth / 2 - 0.8;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) <= m || Math.abs(z - c) <= m) return true;
  }
  return false;
}

/** The AABB of a car, axis-aligned from its heading: long side follows the direction of travel. */
function carBox(x, z, heading) {
  const eastWest = Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading));
  const hx = eastWest ? 2.3 : 1.1;
  const hz = eastWest ? 1.1 : 2.3;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

/** Push a circle (the driven car) out of every building/car collider it overlaps. */
function resolveColliders(x, z, colliders, ignore) {
  let px = x;
  let pz = z;
  let hit = false;
  for (const c of colliders) {
    if (c === ignore || c.disabled) continue;
    if (px + CAR_RADIUS > c.minX && px - CAR_RADIUS < c.maxX
      && pz + CAR_RADIUS > c.minZ && pz - CAR_RADIUS < c.maxZ) {
      hit = true;
      const left = px + CAR_RADIUS - c.minX;
      const right = c.maxX - (px - CAR_RADIUS);
      const back = pz + CAR_RADIUS - c.minZ;
      const front = c.maxZ - (pz - CAR_RADIUS);
      const m = Math.min(left, right, back, front);
      if (m === left) px = c.minX - CAR_RADIUS;
      else if (m === right) px = c.maxX + CAR_RADIUS;
      else if (m === back) pz = c.minZ - CAR_RADIUS;
      else pz = c.maxZ + CAR_RADIUS;
    }
  }
  return { x: px, z: pz, hit };
}

/**
 * Put the player in a car: the player mesh hides and rides along, the car's own parked-car
 * collider is handed to the driving system so it follows the car instead of blocking its
 * old parking spot. `carColliders` is aligned with `cars` (see world.js). Parked cars sit
 * nose-in at the kerb, facing across the road, so the car is swung onto the road's own
 * direction (nearest east/west or north/south heading) as the player pulls out.
 */
export function enterCar(driving, car, cars, carColliders, player) {
  const idx = cars.indexOf(car);
  driving.car = car;
  driving.collider = idx >= 0 ? carColliders[idx] : null;
  driving.speed = 0;
  driving.heading = alignToRoad(car.position.x, car.position.z, car.rotation.y);
  car.rotation.y = driving.heading;
  player.visible = false;
  player.position.set(car.position.x, 0, car.position.z);
}

/** Nearest road-aligned heading for a car parked at (x, z): along its road, else as-is. */
function alignToRoad(x, z, heading) {
  const m = CITY.roadWidth / 2;
  let onEastWest = false;
  let onNorthSouth = false;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(z - c) <= m) onEastWest = true;
    if (Math.abs(x - c) <= m) onNorthSouth = true;
  }
  if (onEastWest && !onNorthSouth) return Math.sin(heading) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  if (onNorthSouth && !onEastWest) return Math.cos(heading) >= 0 ? 0 : Math.PI;
  return heading;
}

/** Step out beside the driven car, leaving it where it stopped. */
export function exitCar(driving, player) {
  const car = driving.car;
  if (!car) return;
  const rx = -Math.cos(driving.heading);
  const rz = Math.sin(driving.heading);
  player.position.set(car.position.x + rx * 2.6, 0, car.position.z + rz * 2.6);
  player.rotation.y = driving.heading;
  player.visible = true;
  driving.car = null;
  driving.collider = null;
  driving.speed = 0;
}

/**
 * Advance the driven car one frame. `drive` is { throttle: -1..1, steer: -1..1, boost }.
 * Returns the speed in m/s (negative while reversing).
 */
export function updateDriving(driving, drive, colliders, dt) {
  const car = driving.car;
  if (!car) return 0;
  let speed = driving.speed;
  if (drive.throttle > 0) {
    speed += ACCEL * dt;
    const cap = drive.boost ? MAX_BOOST : MAX_FORWARD;
    if (speed > cap) speed = cap;
  } else if (drive.throttle < 0) {
    if (speed > 0.6) speed -= BRAKE * dt;
    else {
      speed -= REVERSE_ACCEL * dt;
      if (speed < -MAX_REVERSE) speed = -MAX_REVERSE;
    }
  } else {
    const drag = DRAG * dt;
    if (Math.abs(speed) <= drag) speed = 0;
    else speed -= Math.sign(speed) * drag;
  }
  const grip = Math.max(-1, Math.min(1, speed / 9));
  driving.heading += drive.steer * TURN_RATE * grip * dt;
  const fx = Math.sin(driving.heading);
  const fz = Math.cos(driving.heading);
  const oldX = car.position.x;
  const oldZ = car.position.z;
  let nx = oldX + fx * speed * dt;
  let nz = oldZ + fz * speed * dt;
  nx = Math.max(-CITY_SPAN, Math.min(CITY_SPAN, nx));
  nz = Math.max(-CITY_SPAN, Math.min(CITY_SPAN, nz));
  const solved = resolveColliders(nx, nz, colliders, driving.collider);
  if (solved.hit) speed *= 0.45;
  nx = solved.x;
  nz = solved.z;
  if (!onRoad(nx, nz)) {
    // Off the asphalt: try sliding along one axis (turning a corner stays on the road);
    // only refuse the move outright when neither axis stays on asphalt.
    const xOnly = resolveColliders(oldX + fx * speed * dt, oldZ, colliders, driving.collider);
    const zOnly = resolveColliders(oldX, oldZ + fz * speed * dt, colliders, driving.collider);
    if (onRoad(xOnly.x, xOnly.z)) { nx = xOnly.x; nz = xOnly.z; }
    else if (onRoad(zOnly.x, zOnly.z)) { nx = zOnly.x; nz = zOnly.z; }
    else { nx = oldX; nz = oldZ; speed *= 0.25; }
  }
  car.position.set(nx, 0, nz);
  car.rotation.y = driving.heading;
  if (driving.collider) {
    const b = carBox(nx, nz, driving.heading);
    driving.collider.minX = b.minX;
    driving.collider.maxX = b.maxX;
    driving.collider.minZ = b.minZ;
    driving.collider.maxZ = b.maxZ;
  }
  driving.speed = speed;
  return speed;
}

/** Speedometer reading in km/h for the HUD. */
export function speedKmh(driving) {
  return Math.abs(driving.speed) * 3.6;
}

/** The driven car's world position, or null when the player is on foot. */
export function drivingCarPosition(driving) {
  return driving.car ? driving.car.position : null;
}
