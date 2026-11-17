// Solmar Bay shared tuning: city layout, player feel, camera, sky. One place to change numbers.
export const SEED_DEFAULT = 1;
export const CITY = {
  blocks: 5, // blocks per side (5x5 grid of city blocks)
  blockSize: 42, // metres of buildable block, edge to edge
  roadWidth: 12, // metres of road between blocks
  sidewalk: 3, // pavement strip around each block
};
export const PLAYER = {
  walkSpeed: 5,
  runSpeed: 9,
  height: 1.8,
  radius: 0.45,
};
export const CAMERA = {
  distance: 9,
  height: 4.2,
  minPitch: 0.12,
  maxPitch: 1.1,
};
export const SKY = {
  top: 0x3f8fd2,
  horizon: 0xcfe8f2,
  sunColor: 0xfff2cf,
  sunIntensity: 2.4,
  fogColor: 0xcfe0ea,
  fogNear: 90,
  fogFar: 320,
};
