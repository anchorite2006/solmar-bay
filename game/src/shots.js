// The staged views behind ?shot=start|play|overview|street. Each one places the player and the
// camera (and, where it helps the frame, nudges one parked car into view) from the same seeded
// city, so the same seed always gives the same frame. Every street-level shot looks EAST down
// the avenue (road z=27): the player faces +x, the camera sits behind on the same road, so the
// frame holds the player, a parked car, palms and the building fronts on both sides — never a
// camera wedged inside a building block.
import { movePlayer } from './player.js';

/** Put one parked car at a fixed spot on the avenue, facing along the road. */
function parkCarForFrame(car, x, z, facing) {
  car.position.set(x, 0, z);
  car.rotation.y = facing;
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
  if (name === 'overview') {
    player.position.set(0, 0, 27);
    player.rotation.y = Math.PI / 2;
    input.yaw = -Math.PI / 2;
    ctx.overview = true;
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
  // start (default, also the cover): player at the kerb, a parked car just ahead on the right,
  // camera low behind, avenue and towers filling the frame.
  faceEast(ctx, 0, 9, 0.3);
  parkCarForFrame(cars[0], 6, 24.5, Math.PI / 2);
}
