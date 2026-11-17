// The Solmar Bay mission chain: three jobs in a row, each with its own golden beacon
// on the street and its own line on the HUD. Finish a step and the next one lights up;
// finish all three and the payout lands in the player's pocket. Getting busted only
// resets the step in progress — the chain itself keeps going, and it replays forever.
import * as THREE from 'three';

const STEPS = [
  { x: 81, z: 27, label: 'Pick up the package', done: 'Package collected!' },
  { x: -81, z: 81, label: 'Deliver to the docks', done: 'Delivered! The heat is on.' },
  { x: -81, z: -81, label: 'Lose the cops — reach the safe house', done: 'You made it out clean.' },
];
const PAYOUT = 500;
const REACH_RANGE = 7;

function buildBeacon() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xaa7700, roughness: 0.3, metalness: 0.4 }),
  );
  gem.position.y = 35;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(beam, gem, ring);
  group.userData.gem = gem;
  return group;
}

export function createMissions(scene) {
  const beacon = buildBeacon();
  scene.add(beacon);
  let step = 0;
  let cash = 0;
  let completed = 0;

  function placeBeacon() {
    const target = STEPS[step];
    beacon.position.set(target.x, 0, target.z);
    beacon.visible = true;
  }
  placeBeacon();

  return {
    beacon,
    get step() {
      return step;
    },
    get cash() {
      return cash;
    },
    get completed() {
      return completed;
    },
    get payout() {
      return PAYOUT;
    },
    /** The marker the player is heading for right now. */
    currentTarget() {
      return STEPS[step];
    },
    /** The HUD line for the current step. */
    objectiveText() {
      return `Objective: ${STEPS[step].label}`;
    },
    /** Jump to a step (used by staged screenshots, not by live play). */
    setStep(n) {
      step = Math.max(0, Math.min(STEPS.length - 1, Math.round(n)));
      placeBeacon();
    },
    /** A bust only costs the step in progress: the beacon stays where it was. */
    resetCurrentStep() {
      placeBeacon();
    },
    /** Spin the beacon gem; called once a frame with the frame time. */
    animate(nowMs) {
      const gem = beacon.userData.gem;
      gem.rotation.y += 0.02;
      gem.position.y = 35 + Math.sin(nowMs / 500) * 0.5;
    },
    /**
     * Check whether the player reached the marker. `hooks` reports progress:
     * showToast(text), setObjective(text), onHeat() when the delivery draws the cops.
     * Returns 'step' when a step finished, 'passed' when the chain paid out, else null.
     */
    update(focus, hooks) {
      const target = STEPS[step];
      if (Math.hypot(focus.x - target.x, focus.z - target.z) >= REACH_RANGE) return null;
      if (step < STEPS.length - 1) {
        if (hooks && hooks.showToast) hooks.showToast(target.done);
        step += 1;
        if (step === 2 && hooks && hooks.onHeat) hooks.onHeat();
        placeBeacon();
        if (hooks && hooks.setObjective) hooks.setObjective(this.objectiveText());
        return 'step';
      }
      cash += PAYOUT;
      completed += 1;
      if (hooks && hooks.showToast) hooks.showToast(`MISSION PASSED  $${PAYOUT}`);
      if (hooks && hooks.setObjective) hooks.setObjective(`Mission passed! $${PAYOUT} earned — the next job is waiting.`);
      step = 0;
      placeBeacon();
      return 'passed';
    },
  };
}
