// Solmar Bay's procedural city: a 5x5 grid of blocks split by roads, each block holding one or
// two buildings with varied heights and sun-bleached colours, sidewalks, palm trees along the
// avenues, and a few parked cars. Everything is placed from a seeded rng, so seed 1 always builds
// the same city. Returns the colliders (building + car footprints) the player walks around.
import * as THREE from 'three';
import { CITY } from './config.js';
import { mulberry32, range, pick } from './random.js';

const PALETTE = [0xf2e3c6, 0xe8c9a0, 0xd9a679, 0xcfe0e2, 0xf7f0e0, 0xe6b8a2, 0xbcd4c8, 0xf0d060];
const CAR_COLORS = [0xc23b2e, 0x2e6db4, 0xe8e8e8, 0x222222, 0xd8a020, 0x3f7d4e];
const ROOF_COLORS = [0x8a5a3b, 0x6b7c8a, 0x9c8a6a, 0x54707a];

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** One palm: a leaning trunk of stacked segments and a crown of flat fronds. */
function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const lean = range(rng, -0.12, 0.12);
  let y = 0;
  for (let i = 0; i < 5; i += 1) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.14 - i * 0.015, 0.18 - i * 0.015, 1.1, 6), trunkMat);
    seg.position.set(lean * y, y + 0.55, 0);
    seg.rotation.z = -lean * 2;
    seg.castShadow = true;
    palm.add(seg);
    y += 1.05;
  }
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.4), frondMat);
    frond.position.set(Math.cos(angle) * 0.85, y + 0.1, Math.sin(angle) * 0.85);
    frond.rotation.set(Math.sin(angle) * 0.7, -angle, Math.cos(angle) * 0.7);
    frond.castShadow = true;
    palm.add(frond);
  }
  palm.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a1e, roughness: 1 }),
  ));
  palm.children[palm.children.length - 1].position.set(lean * y, y + 0.1, 0);
  return palm;
}

/** One parked car: a low box body, a cabin box, four cylinder wheels, two headlights. */
function makeCar(rng) {
  const car = new THREE.Group();
  const color = pick(rng, CAR_COLORS);
  const body = box(1.9, 0.55, 4.2, color, 0, 0.45, 0);
  const cabin = box(1.7, 0.5, 2.1, 0x1c2733, 0, 0.95, -0.2);
  cabin.material = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.25, metalness: 0.4 });
  car.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    wheel.castShadow = true;
    car.add(wheel);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0x554400 });
  for (const wx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), lightMat);
    light.position.set(wx, 0.5, 2.12);
    car.add(light);
  }
  return car;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const cars = [];
  const pitch = CITY.blockSize + CITY.roadWidth;
  const half = (CITY.blocks * pitch - CITY.roadWidth) / 2;

  // Ground: one big sun-baked slab under the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 120, half * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: dark asphalt strips along every grid line, plus a dashed centre line.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8d44f, roughness: 0.8 });
  const span = half * 2 + CITY.roadWidth;
  for (let i = 0; i <= CITY.blocks; i += 1) {
    const c = -half - CITY.roadWidth / 2 + i * pitch;
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(span, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : c, 0.02, horizontal ? c : 0);
      road.receiveShadow = true;
      scene.add(road);
    }
    for (let d = -span / 2 + 4; d < span / 2 - 2; d += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.28), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.04, c);
      scene.add(dash);
      const dash2 = dash.clone();
      dash2.rotation.z = Math.PI / 2;
      dash2.position.set(c, 0.04, d);
      scene.add(dash2);
    }
  }

  // Blocks: sidewalk slab, then buildings, palms and parked cars.
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const cx = -half + CITY.blockSize / 2 + bx * pitch;
      const cz = -half + CITY.blockSize / 2 + bz * pitch;
      const walk = new THREE.Mesh(
        new THREE.PlaneGeometry(CITY.blockSize, CITY.blockSize),
        new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 1 }),
      );
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.03, cz);
      walk.receiveShadow = true;
      scene.add(walk);

      const tall = rng() < 0.3;
      const count = tall ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = count === 1 ? CITY.blockSize - 2 * CITY.sidewalk : (CITY.blockSize - 3 * CITY.sidewalk) / 2;
        const d = count === 1 ? CITY.blockSize - 2 * CITY.sidewalk : CITY.blockSize - 2 * CITY.sidewalk;
        const h = tall ? range(rng, 26, 48) : range(rng, 7, 20);
        const ox = count === 1 ? 0 : (b === 0 ? -1 : 1) * (w / 2 + CITY.sidewalk / 2);
        const building = box(w, h, d, pick(rng, PALETTE), cx + ox, h / 2, cz);
        scene.add(building);
        // Roof cap + a few lit windows as thin bright boxes on the street face.
        const roof = box(w + 0.4, 0.5, d + 0.4, pick(rng, ROOF_COLORS), cx + ox, h + 0.25, cz);
        scene.add(roof);
        const winMat = new THREE.MeshStandardMaterial({ color: 0x2b4a63, roughness: 0.2, metalness: 0.5, emissive: 0x0a1a28 });
        const rows = Math.max(1, Math.floor(h / 4));
        const cols = Math.max(1, Math.floor(w / 4));
        for (let r = 0; r < rows; r += 1) {
          for (let cI = 0; cI < cols; cI += 1) {
            if (rng() < 0.45) continue;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), winMat);
            win.position.set(cx + ox - w / 2 + 2 + cI * 4, 2.5 + r * 4, cz + d / 2 + 0.06);
            scene.add(win);
          }
        }
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }

      // Palms along the block's south edge, spaced out.
      const palms = 2 + Math.floor(rng() * 3);
      for (let p = 0; p < palms; p += 1) {
        const palm = makePalm(rng);
        palm.position.set(cx - CITY.blockSize / 2 + 4 + p * 12 + rng() * 3, 0, cz + CITY.blockSize / 2 - 1.6);
        palm.rotation.y = rng() * Math.PI * 2;
        scene.add(palm);
      }
    }
  }

  // Parked cars along the roads: one per chosen road segment, hugging the kerb.
  for (let i = 0; i < 14; i += 1) {
    const along = range(rng, -half + 8, half - 8);
    const lane = Math.floor(range(rng, 0, CITY.blocks + 1));
    const roadC = -half - CITY.roadWidth / 2 + lane * pitch;
    const side = rng() < 0.5 ? -1 : 1;
    const horizontal = rng() < 0.5;
    const car = makeCar(rng);
    if (horizontal) {
      car.position.set(along, 0, roadC + side * (CITY.roadWidth / 2 - 2.4));
      car.rotation.y = side > 0 ? 0 : Math.PI;
    } else {
      car.position.set(roadC + side * (CITY.roadWidth / 2 - 2.4), 0, along);
      car.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    scene.add(car);
    cars.push(car);
    const hx = 1.1;
    const hz = 2.3;
    colliders.push({
      minX: car.position.x - (horizontal ? hz : hx),
      maxX: car.position.x + (horizontal ? hz : hx),
      minZ: car.position.z - (horizontal ? hx : hz),
      maxZ: car.position.z + (horizontal ? hx : hz),
    });
  }

  return { colliders, cars, half };
}
