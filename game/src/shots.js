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

/** Override one patrol car's mesh pose for the frame (shot mode renders once). */
function placePoliceForFrame(ctx, index, x, z, heading) {
  const unit = ctx.police.cars[index];
  if (!unit) return;
  unit.mesh.position.set(x, 0, z);
  unit.mesh.rotation.y = heading;
  unit.heading = heading;
}

/** Put the player in a parked car and drive it east down the avenue for a beat. */
function driveEastForFrame(ctx, startX, seconds) {
  const car = ctx.cars[0];
  parkCarForFrame(car, startX, 27, Math.PI / 2);
  enterCar(ctx.driving, car, ctx.cars, ctx.carColliders, ctx.player);
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    updateDriving(ctx.driving, { throttle: 1, steer: 0, boost: false }, ctx.colliders, 1 / 60);
  }
  ctx.input.yaw = ctx.driving.heading + Math.PI;
  return car;
}
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
  if (name === 'chase') {
    // COVER: police chase — player driving east, two patrol cars tight behind with
    // lights flashing, three wanted stars, the golden mission beacon ahead, minimap
    // showing the red/blue police dots.
    settle(ctx, 3);
    ctx.missions.setStep(0);
    ctx.objectiveEl.textContent = ctx.missions.objectiveText();
    const car = driveEastForFrame(ctx, -30, 1.5);
    const front = car.position.x;
    ctx.wanted.setLevel(3);
    ctx.police.ensure(3, car.position);
    // Diagonal camera (yaw swung off the road axis) so the units behind the player
    // stay in frame: two tight behind in the side lanes, one cutting in ahead.
    ctx.input.yaw = ctx.driving.heading + Math.PI + 0.55;
    placePoliceForFrame(ctx, 0, front - 9, 29.4, Math.PI / 2);
    placePoliceForFrame(ctx, 1, front - 17, 24.6, Math.PI / 2);
    placePoliceForFrame(ctx, 2, front + 12, 24.6, -Math.PI / 2);
    ctx.cameraPitch = 0.32;
    ctx.cameraDistance = 13;
    placeTrafficForFrame(ctx, 0, front + 18, 29.4, Math.PI / 2);
    placeTrafficForFrame(ctx, 1, front + 30, 24.6, -Math.PI / 2);
    placeWalkerForFrame(ctx, 0, front + 10, 21, Math.PI / 2);
    placeWalkerForFrame(ctx, 1, front + 24, 33, -Math.PI / 2);
    return;
  }
  if (name === 'mission') {
    // Mission in progress: the player driving toward the golden beacon, one patrol
    // car closing in behind, HUD objective "Pick up the package" on screen.
    settle(ctx, 3);
    ctx.missions.setStep(0);
    ctx.objectiveEl.textContent = ctx.missions.objectiveText();
    const car = driveEastForFrame(ctx, 30, 1.2);
    const front = car.position.x;
    ctx.wanted.setLevel(1);
    ctx.police.ensure(1, car.position);
    placePoliceForFrame(ctx, 0, front - 13, 24.6, Math.PI / 2);
    ctx.cameraPitch = 0.3;
    ctx.cameraDistance = 9.5;
    placeTrafficForFrame(ctx, 0, front + 22, 29.4, Math.PI / 2);
    placeWalkerForFrame(ctx, 0, front + 14, 21, Math.PI / 2);
    return;
  }
  if (name === 'busted') {
    // BUSTED: a patrol car blocking the player's car nose-to-nose, a second unit
    // pulling in behind, the red BUSTED overlay across the frame.
    settle(ctx, 2);
    ctx.missions.setStep(0);
    ctx.objectiveEl.textContent = ctx.missions.objectiveText();
    const car = ctx.cars[0];
    parkCarForFrame(car, 10, 27, Math.PI / 2);
    enterCar(ctx.driving, car, ctx.cars, ctx.carColliders, ctx.player);
    ctx.input.yaw = ctx.driving.heading + Math.PI;
    ctx.wanted.setLevel(3);
    ctx.police.ensure(3, car.position);
    placePoliceForFrame(ctx, 0, 16, 27, -Math.PI / 2);
    placePoliceForFrame(ctx, 1, 1, 29.4, Math.PI / 2);
    placePoliceForFrame(ctx, 2, -8, 24.6, Math.PI / 2);
    ctx.bustedEl.style.display = 'flex';
    ctx.cameraPitch = 0.34;
    ctx.cameraDistance = 11;
    placeTrafficForFrame(ctx, 0, 30, 29.4, Math.PI / 2);
    placeWalkerForFrame(ctx, 0, 20, 21, Math.PI / 2);
    return;
  }
  if (name === 'wanted') {
    // Wanted on foot: two stars in the HUD, a pedestrian fleeing the shove, a patrol
    // car rolling up the intersection behind the player.
    settle(ctx, 2);
    ctx.missions.setStep(0);
    ctx.objectiveEl.textContent = ctx.missions.objectiveText();
    faceEast(ctx, 18, 6, 0.3);
    ctx.player.position.set(18, 0, 27);
    ctx.wanted.setLevel(2);
    ctx.police.ensure(2, ctx.player.position);
    placePoliceForFrame(ctx, 0, 27, 40, Math.PI);
    placePoliceForFrame(ctx, 1, 36, 24.6, -Math.PI / 2);
    placeWalkerForFrame(ctx, 0, 21.5, 24.5, Math.PI / 2);
    ctx.pedestrians.scare(18, 27, 6, 60);
    placeWalkerForFrame(ctx, 1, 14, 33, -Math.PI / 2);
    placeWalkerForFrame(ctx, 2, 26, 21, Math.PI / 2);
    parkCarForFrame(ctx.cars[0], 24, 24.8, Math.PI / 2);
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
