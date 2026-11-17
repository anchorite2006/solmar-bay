// Pedestrians for Solmar Bay: walkers strolling the sidewalks on rectangular loops around
// city blocks, one loop per walker, with varied shirt colours and a simple bob-and-swing
// walk cycle. They never leave the sidewalk ring, so they never wander into the road centre.
import * as THREE from 'three';
import { CITY } from './config.js';
import { mulberry32, range, pick } from './random.js';

const SHIRTS = [0xd84a3a, 0x3a7dd8, 0x3ad86a, 0xe8c53a, 0x8a5ad8, 0xe87ab0, 0xeeeeee, 0x3ad8c8];
const INSET = 1.6;

// One walker: torso, head, hair cap, swinging arms and legs, built from boxes like the player.
function buildWalker(rng) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, [0xc98e6a, 0x8a5a3b, 0xe8b88a, 0x6b4423]), roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: pick(rng, [0x2b2f36, 0x4a3a2a, 0x3a4a6b]), roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: pick(rng, [0x1c1410, 0x3a2a1a, 0x777777]), roughness: 1 });
  const scale = range(rng, 0.92, 1.06);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirt);
  torso.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skin);
  head.position.y = 1.62;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.34), hair);
  cap.position.y = 1.8;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), shirt);
  armL.position.set(-0.37, 1.08, 0);
  const armR = armL.clone();
  armR.position.x = 0.37;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.72, 0.19), pants);
  legL.position.set(-0.14, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  for (const part of [torso, head, cap, armL, armR, legL, legR]) {
    part.castShadow = true;
    group.add(part);
  }
  group.scale.setScalar(scale);
  group.userData = { armL, armR, legL, legR, phase: rng() * Math.PI * 2 };
  return group;
}

/** Block centre for block (bx, bz), matching the city layout in world.js. */
function blockCentre(bx, bz) {
  const pitch = CITY.blockSize + CITY.roadWidth;
  const half = (CITY.blocks * pitch - CITY.roadWidth) / 2;
  return {
    x: -half + CITY.blockSize / 2 + bx * pitch,
    z: -half + CITY.blockSize / 2 + bz * pitch,
  };
}

/** The four corners of a sidewalk loop around a block, clockwise from the north-west. */
function sidewalkCorners(bx, bz) {
  const c = blockCentre(bx, bz);
  const r = CITY.blockSize / 2 - INSET;
  return [
    { x: c.x - r, z: c.z - r },
    { x: c.x + r, z: c.z - r },
    { x: c.x + r, z: c.z + r },
    { x: c.x - r, z: c.z + r },
  ];
}

export function createPedestrians(scene, seed, count = 24) {
  const rng = mulberry32(seed * 17 + 3);
  const walkers = [];
  const side = CITY.blockSize - INSET * 2;
  for (let i = 0; i < count; i += 1) {
    const bx = Math.floor(rng() * CITY.blocks);
    const bz = Math.floor(rng() * CITY.blocks);
    const corners = sidewalkCorners(bx, bz);
    const mesh = buildWalker(rng);
    const walker = {
      mesh,
      corners,
      edge: Math.floor(rng() * 4),
      along: rng() * side,
      speed: range(rng, 1.1, 1.9),
      clockwise: rng() < 0.5,
      clock: 0,
      fleeUntil: 0,
      fleeing: false,
      threatX: 0,
      threatZ: 0,
    };
    scene.add(mesh);
    walkers.push(walker);
  }
  return {
    walkers,
    /**
     * Scare the nearest walker within `radius` of (x, z): they stagger away from the
     * threat for `seconds`, then rejoin their sidewalk loop where they ended up.
     * Returns the scared walker, or null when nobody was close enough.
     */
    scare(x, z, radius = 3, seconds = 2.5) {
      let best = null;
      let bestD = radius;
      for (const w of walkers) {
        const d = Math.hypot(w.mesh.position.x - x, w.mesh.position.z - z);
        if (d < bestD) {
          bestD = d;
          best = w;
        }
      }
      if (!best) return null;
      best.threatX = x;
      best.threatZ = z;
      best.fleeUntil = best.clock + seconds;
      best.fleeing = true;
      return best;
    },
    /** Advance every walker one frame; call with a fixed dt for deterministic screenshots. */
    update(dt) {
      for (const w of walkers) {
        w.clock += dt;
        if (w.fleeUntil > w.clock) {
          // Fleeing: run straight away from the threat, legs pumping.
          const dx = w.mesh.position.x - w.threatX;
          const dz = w.mesh.position.z - w.threatZ;
          const len = Math.hypot(dx, dz) || 1;
          const run = 4.2 * dt;
          w.mesh.position.x += (dx / len) * run;
          w.mesh.position.z += (dz / len) * run;
          w.mesh.rotation.y = Math.atan2(dx, dz);
          const u = w.mesh.userData;
          u.phase += dt * 14;
          const swing = Math.sin(u.phase) * 0.7;
          u.legL.rotation.x = swing;
          u.legR.rotation.x = -swing;
          u.armL.rotation.x = -swing * 0.8;
          u.armR.rotation.x = swing * 0.8;
          continue;
        }
        if (w.fleeing) {
          // The scare is over: rejoin the sidewalk loop at the nearest point of it.
          w.fleeing = false;
          let bestD = Infinity;
          let bestEdge = 0;
          let bestAlong = 0;
          for (let e = 0; e < 4; e += 1) {
            const from = w.corners[e];
            const to = w.clockwise ? w.corners[(e + 1) % 4] : w.corners[(e + 3) % 4];
            const ex = to.x - from.x;
            const ez = to.z - from.z;
            const segLen = Math.hypot(ex, ez) || 1;
            const t = Math.max(0, Math.min(1,
              ((w.mesh.position.x - from.x) * ex + (w.mesh.position.z - from.z) * ez) / (segLen * segLen)));
            const px = from.x + ex * t;
            const pz = from.z + ez * t;
            const d = Math.hypot(w.mesh.position.x - px, w.mesh.position.z - pz);
            if (d < bestD) {
              bestD = d;
              bestEdge = e;
              bestAlong = t * segLen;
            }
          }
          w.edge = bestEdge;
          w.along = bestAlong;
        }
        w.along += w.speed * dt;
        if (w.along >= side) {
          w.along -= side;
          w.edge = w.clockwise ? (w.edge + 1) % 4 : (w.edge + 3) % 4;
        }
        const from = w.corners[w.edge];
        const to = w.clockwise
          ? w.corners[(w.edge + 1) % 4]
          : w.corners[(w.edge + 3) % 4];
        const t = Math.max(0, Math.min(1, w.along / side));
        const x = from.x + (to.x - from.x) * t;
        const z = from.z + (to.z - from.z) * t;
        w.mesh.position.set(x, 0, z);
        w.mesh.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        const u = w.mesh.userData;
        u.phase += dt * w.speed * 4.5;
        const swing = Math.sin(u.phase) * 0.5;
        u.legL.rotation.x = swing;
        u.legR.rotation.x = -swing;
        u.armL.rotation.x = -swing * 0.8;
        u.armR.rotation.x = swing * 0.8;
        w.mesh.position.y = Math.abs(Math.sin(u.phase)) * 0.05;
      }
    },
  };
}
