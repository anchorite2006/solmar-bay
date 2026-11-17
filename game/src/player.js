// The player on foot: a simple articulated figure (torso, head, swinging arms and legs) that
// walks the streets, turns toward its movement direction, and slides around building and car
// footprints instead of walking through them.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function makePlayer() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e6db4, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.68;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), hair);
  cap.position.y = 1.88;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), shirt);
  armL.position.set(-0.4, 1.12, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.76, 0.2), pants);
  legL.position.set(-0.15, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  for (const part of [torso, head, cap, armL, armR, legL, legR]) {
    part.castShadow = true;
    group.add(part);
  }
  group.userData = { armL, armR, legL, legR, swing: 0 };
  return group;
}

/** Move the player by a wish direction (world-space x/z) for dt seconds, resolving colliders. */
export function movePlayer(player, colliders, wishX, wishZ, dt, running) {
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(wishX, wishZ);
  if (len < 0.001) return 0;
  const nx = wishX / len;
  const nz = wishZ / len;
  const step = speed * dt;
  let px = player.position.x + nx * step;
  let pz = player.position.z + nz * step;
  const r = PLAYER.radius;
  for (const c of colliders) {
    if (px + r > c.minX && px - r < c.maxX && pz + r > c.minZ && pz - r < c.maxZ) {
      const pushLeft = px + r - c.minX;
      const pushRight = c.maxX - (px - r);
      const pushBack = pz + r - c.minZ;
      const pushFront = c.maxZ - (pz - r);
      const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
      if (m === pushLeft) px = c.minX - r;
      else if (m === pushRight) px = c.maxX + r;
      else if (m === pushBack) pz = c.minZ - r;
      else pz = c.maxZ + r;
    }
  }
  player.position.x = px;
  player.position.z = pz;
  player.rotation.y = Math.atan2(nx, nz);
  const u = player.userData;
  u.swing += dt * speed * 1.6;
  const amp = running ? 0.7 : 0.45;
  u.legL.rotation.x = Math.sin(u.swing) * amp;
  u.legR.rotation.x = -Math.sin(u.swing) * amp;
  u.armL.rotation.x = -Math.sin(u.swing) * amp * 0.8;
  u.armR.rotation.x = Math.sin(u.swing) * amp * 0.8;
  return speed;
}
