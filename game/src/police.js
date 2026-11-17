// Police response for Solmar Bay: black-and-white patrol cars with a flashing
// red/blue light bar that chase the player while the wanted level is up. They steer
// straight at the player (no pathfinding), slide around building footprints instead of
// driving through them, and pressure the player by ramming. Cornered and slow, the
// player gets BUSTED. At most four patrol cars are ever on the street at once.
import * as THREE from 'three';
import { ROAD_CENTERS } from './config.js';

const MAX_POLICE = 4;
const CHASE_SPEED = 17;
const RAM_RANGE = 4;
const BUSTED_HOLD_SECONDS = 1.5;
const DESPAWN_RANGE = 260;

function buildPatrolCar() {
  const car = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), white);
  body.position.y = 0.5;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.1, 1.1), black);
  hood.position.set(0, 0.79, 1.45);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.1, 0.9), black);
  trunk.position.set(0, 0.79, -1.55);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.5, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.2, metalness: 0.5 }),
  );
  cabin.position.set(0, 0.98, -0.2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 2.6), black);
  stripe.position.set(0, 0.62, 0);
  car.add(body, hood, trunk, cabin, stripe);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, emissive: 0xaa0000, emissiveIntensity: 1 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0022aa, emissiveIntensity: 1 });
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.4), black);
  barBase.position.set(0, 1.28, -0.2);
  const redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.36), redMat);
  redLamp.position.set(-0.32, 1.38, -0.2);
  const blueLamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.36), blueMat);
  blueLamp.position.set(0.32, 1.38, -0.2);
  car.add(barBase, redLamp, blueLamp);
  const tyre = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 1 });
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(tyre, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    car.add(wheel);
  }
  for (const part of car.children) part.castShadow = true;
  return { car, redMat, blueMat };
}

/** Ease a heading toward a target, turning at most rate*dt radians. */
function turnToward(current, target, rate, dt) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = rate * dt;
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}

/** Push a patrol car out of building footprints so it slides along walls. */
function pushOutOfColliders(x, z, colliders, radius, ignore) {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    if (c === ignore || c.disabled) continue;
    if (px + radius > c.minX && px - radius < c.maxX && pz + radius > c.minZ && pz - radius < c.maxZ) {
      const left = px + radius - c.minX;
      const right = c.maxX - (px - radius);
      const back = pz + radius - c.minZ;
      const front = c.maxZ - (pz - radius);
      const m = Math.min(left, right, back, front);
      if (m === left) px = c.minX - radius;
      else if (m === right) px = c.maxX + radius;
      else if (m === back) pz = c.minZ - radius;
      else pz = c.maxZ + radius;
    }
  }
  return { x: px, z: pz };
}

/** A road point near the player, on the closest grid line, for spawning a patrol car. */
function spawnPointNear(focus, index, spread) {
  let best = ROAD_CENTERS[0];
  let bestD = Infinity;
  for (const c of ROAD_CENTERS) {
    const d = Math.min(Math.abs(focus.x - c), Math.abs(focus.z - c));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const along = (index % 2 === 0 ? -1 : 1) * (34 + index * 9 + spread);
  const onVertical = Math.abs(focus.x - best) <= Math.abs(focus.z - best);
  if (onVertical) return { x: best, z: focus.z + along };
  return { x: focus.x + along, z: best };
}

export function createPolice(scene, colliders) {
  const cars = [];
  let flashTime = 0;

  function spawnOne(focus, index) {
    const built = buildPatrolCar();
    const at = spawnPointNear(focus, index, index * 3);
    built.car.position.set(at.x, 0, at.z);
    built.car.rotation.y = Math.atan2(focus.x - at.x, focus.z - at.z);
    scene.add(built.car);
    const unit = {
      mesh: built.car,
      redMat: built.redMat,
      blueMat: built.blueMat,
      heading: built.car.rotation.y,
      speed: 0,
      bustedTimer: 0,
    };
    cars.push(unit);
    return unit;
  }

  return {
    cars,
    /** How many patrol cars the current wanted level calls for (0 when clean). */
    desiredCount(level) {
      if (level <= 0) return 0;
      return Math.min(MAX_POLICE, level + 1);
    },
    /** Add or remove patrol cars to match the wanted level, spawning near the player. */
    ensure(level, focus) {
      const want = this.desiredCount(level);
      while (cars.length < want) spawnOne(focus, cars.length);
      while (cars.length > want) {
        const gone = cars.pop();
        scene.remove(gone.mesh);
      }
    },
    /** Pull every patrol car off the street (after a bust, or when the heat is gone). */
    removeAll() {
      while (cars.length > 0) {
        const gone = cars.pop();
        scene.remove(gone.mesh);
      }
    },
    /** Distance to the nearest patrol car, or Infinity when none is out. */
    nearestDistance(focus) {
      let best = Infinity;
      for (const car of cars) {
        const d = Math.hypot(car.mesh.position.x - focus.x, car.mesh.position.z - focus.z);
        if (d < best) best = d;
      }
      return best;
    },
    /**
     * Chase the player for one frame. `focusSpeed` is how fast the player is moving;
     * a slow player cornered by a patrol car gets busted. `hooks.onBusted` fires once.
     * `ignoreCollider` (the driven car's own footprint) is skipped so a patrol car
     * can close in and ram the player instead of being pushed back out of range.
     */
    update(dt, focus, focusSpeed, hooks, ignoreCollider) {
      flashTime += dt;
      const lit = Math.sin(flashTime * 9) > 0;
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        car.redMat.emissiveIntensity = lit ? 2.4 : 0.25;
        car.blueMat.emissiveIntensity = lit ? 0.25 : 2.4;
        const dx = focus.x - car.mesh.position.x;
        const dz = focus.z - car.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > DESPAWN_RANGE) {
          scene.remove(car.mesh);
          cars.splice(i, 1);
          continue;
        }
        const target = Math.atan2(dx, dz);
        car.heading = turnToward(car.heading, target, 2.8, dt);
        const cruise = dist > 14 ? CHASE_SPEED : CHASE_SPEED * 0.55;
        car.speed += (cruise - car.speed) * Math.min(1, dt * 2.5);
        let nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
        let nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
        const solved = pushOutOfColliders(nx, nz, colliders, 2.0, ignoreCollider);
        nx = solved.x;
        nz = solved.z;
        car.mesh.position.set(nx, 0, nz);
        car.mesh.rotation.y = car.heading;
        if (dist < RAM_RANGE && focusSpeed < 2.5) {
          car.bustedTimer += dt;
          if (car.bustedTimer >= BUSTED_HOLD_SECONDS && hooks && hooks.onBusted) {
            car.bustedTimer = 0;
            hooks.onBusted();
          }
        } else {
          car.bustedTimer = Math.max(0, car.bustedTimer - dt);
        }
      }
    },
  };
}
