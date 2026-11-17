// The staged views behind ?shot=drive|aerial|crosswalk|steal (plus the M1 names as aliases).
// Each one settles traffic and pedestrians from the same seeded city, then composes one
// distinct angle: driving down the avenue, a high aerial of the network, pedestrians at a
// crosswalk, and the steal prompt at a parked car. Every street-level shot looks EAST down
// the avenue (road z=27): the subject faces +x, the camera sits behind on the same road,
// so the frame holds the subject, traffic, palms and building fronts — never a camera
// wedged inside a building block.
import { movePlayer } from './player.js';
import { enterCar, updateDriving } from './vehicles.js';

/** Run traffic and pedestrians forward `seconds` at a fixed step, deterministically. */
function settle(ctx, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    ctx.traffic.update(1 / 60);
    ctx.pedestrians.update(1 / 60);
  }
}

/** Put one parked car at a fixed spot on the avenue, facing along the road. */
function parkCarForFrame(car, x, z, facing) {
  car.position.set(x, 0, z);
  car.rotation.y = facing;
}

/** Override one traffic car's mesh pose for the frame (shot mode renders once). */
function placeTrafficForFrame(ctx, index, x, z, heading) {
  const car = ctx.traffic.cars[index];
  if (!car) return;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
}

/** Override one walker's mesh pose for the frame (shot mode renders once). */
function placeWalkerForFrame(ctx, index, x, z, heading) {
  const walker = ctx.pedestrians.walkers[index];
  if (!walker) return;
  walker.mesh.position.set(x, 0, z);
  walker.mesh.rotation.y = heading;
}

/** Shared street-level setup: player on the avenue facing east, camera behind on the road. */
function faceEast(ctx, playerX, distance, pitch) {
  const { player, input } = ctx;
  player.position.set(playerX, 0, 27);
  player.rotation.y = Math.PI / 2;
  input.yaw = -Math.PI / 2;
  ctx.cameraPitch = pitch;
  ctx.cameraDistance = distance;
}

export function stageShot(name, ctx) {
  const { player, input, cars } = ctx;
  ctx.overview = false;
  if (name === 'aerial' || name === 'overview') {
    // High aerial: the whole traffic network from above, cars visible at intersections.
    settle(ctx, 4);
    player.position.set(0, 0, 27);
    player.rotation.y = Math.PI / 2;
    input.yaw = -Math.PI / 2;
    ctx.overview = true;
    return;
  }
  if (name === 'crosswalk') {
    // Close-up at the 27 / 27 intersection: pedestrians crossing, traffic passing behind.
    settle(ctx, 2);
    player.position.set(20, 0, 33);
    player.rotation.y = Math.PI / 2;
    input.yaw = -Math.PI / 2;
    ctx.cameraPitch = 0.3;
    ctx.cameraDistance = 5.5;
    placeWalkerForFrame(ctx, 0, 26, 25, 0);
    placeWalkerForFrame(ctx, 1, 28.5, 29, Math.PI);
    placeWalkerForFrame(ctx, 2, 23.5, 33.5, Math.PI / 2);
    placeWalkerForFrame(ctx, 3, 30.5, 20.5, -Math.PI / 2);
    placeTrafficForFrame(ctx, 0, 16, 29.4, Math.PI / 2);
    placeTrafficForFrame(ctx, 1, 38, 24.6, -Math.PI / 2);
    placeTrafficForFrame(ctx, 2, 24.6, 14, 0);
    placeTrafficForFrame(ctx, 3, 29.4, 40, Math.PI);
    return;
  }
  if (name === 'steal') {
    // The steal interaction: player beside a parked car, the prompt on screen.
    settle(ctx, 1);
    faceEast(ctx, 0, 6, 0.3);
    player.position.set(0, 0, 26.5);
    parkCarForFrame(cars[0], 2.5, 24.8, Math.PI / 2);
    ctx.promptEl.textContent = 'Press E to steal';
    ctx.promptEl.style.display = 'block';
    return;
  }
  if (name === 'drive') {
    // Cover: the player driving east down the avenue at speed, traffic ahead in both
    // lanes, pedestrians on the sidewalks, HUD speed visible.
    settle(ctx, 3);
    const car = cars[0];
    parkCarForFrame(car, -30, 27, Math.PI / 2);
    enterCar(ctx.driving, car, cars, ctx.carColliders, player);
    for (let i = 0; i < 90; i += 1) {
      updateDriving(ctx.driving, { throttle: 1, steer: 0, boost: false }, ctx.colliders, 1 / 60);
    }
    const front = car.position.x;
    input.yaw = ctx.driving.heading + Math.PI;
    ctx.cameraPitch = 0.28;
    ctx.cameraDistance = 10;
    placeTrafficForFrame(ctx, 0, front + 16, 29.4, Math.PI / 2);
    placeTrafficForFrame(ctx, 1, front + 26, 29.4, Math.PI / 2);
    placeTrafficForFrame(ctx, 2, front + 36, 24.6, -Math.PI / 2);
    placeTrafficForFrame(ctx, 3, front + 48, 29.4, Math.PI / 2);
    placeTrafficForFrame(ctx, 4, front + 58, 24.6, -Math.PI / 2);
    placeWalkerForFrame(ctx, 0, front + 8, 21, Math.PI / 2);
    placeWalkerForFrame(ctx, 1, front + 20, 33, -Math.PI / 2);
    placeWalkerForFrame(ctx, 2, front + 30, 21, Math.PI / 2);
    return;
  }
  if (name === 'street') {
    faceEast(ctx, -2, 6, 0.22);
    parkCarForFrame(cars[2], 3, 24.5, Math.PI / 2);
    return;
  }
  if (name === 'play') {
    // Walk the player east up the avenue for two seconds so the frame catches a mid-stride pose.
    faceEast(ctx, -6, 8, 0.35);
    parkCarForFrame(cars[1], 10, 29.5, -Math.PI / 2);
    for (let i = 0; i < 120; i += 1) movePlayer(player, ctx.colliders, 1, 0, 1 / 60, false);
    player.rotation.y = Math.PI / 2;
    return;
  }
  // start (default, also the old cover): player at the kerb, a parked car just ahead on the right,
  // camera low behind, avenue and towers filling the frame.
  faceEast(ctx, 0, 9, 0.3);
  parkCarForFrame(cars[0], 6, 24.5, Math.PI / 2);
}
