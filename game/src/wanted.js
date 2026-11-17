// Wanted level for Solmar Bay: 0 to 5 stars. Crimes raise it, laying low lowers it.
// A star is earned, never given for free: stealing a car, hitting a pedestrian, or a
// hard crash each add one. While no police car is close enough to see the player the
// heat cools off, one star at a time, so a clean getaway is always possible.
export const WANTED_MAX = 5;
const DECAY_HIDDEN_SECONDS = 9;
const SIGHT_RANGE = 55;

export function createWanted() {
  let level = 0;
  let hiddenSeconds = 0;
  return {
    get level() {
      return level;
    },
    /** Raise the level by n stars, clamped to the 0-5 range. */
    add(n) {
      if (n <= 0) return;
      level = Math.min(WANTED_MAX, level + n);
      hiddenSeconds = 0;
    },
    /** Set the level directly (used by staged screenshots, not by live play). */
    setLevel(n) {
      level = Math.max(0, Math.min(WANTED_MAX, Math.round(n)));
      hiddenSeconds = 0;
    },
    /** Busted or escaped clean: the slate is wiped. */
    clear() {
      level = 0;
      hiddenSeconds = 0;
    },
    /**
     * Cool down while the player is out of sight. `nearestPolice` is the distance to
     * the closest police car, or Infinity when no police car is on the street.
     */
    update(dt, nearestPolice) {
      if (level <= 0) return;
      if (nearestPolice > SIGHT_RANGE) {
        hiddenSeconds += dt;
        if (hiddenSeconds >= DECAY_HIDDEN_SECONDS) {
          level -= 1;
          hiddenSeconds = 0;
        }
      } else {
        hiddenSeconds = 0;
      }
    },
    /** Five stars, filled up to the current level, for the HUD. */
    starsText() {
      let out = '';
      for (let i = 0; i < WANTED_MAX; i += 1) out += i < level ? '★' : '☆';
      return out;
    },
  };
}
