// Keyboard + mouse-drag input: WASD/arrows to walk, Shift to run, drag to orbit the camera.
export function createInput(canvas) {
  const keys = new Set();
  let yaw = Math.PI; // camera starts behind the player, looking north down the avenue
  let pitch = 0.42;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    yaw -= (e.clientX - lastX) * 0.005;
    pitch += (e.clientY - lastY) * 0.004;
    pitch = Math.max(0.12, Math.min(1.1, pitch));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  /** Wish direction in world space from held keys, relative to the camera yaw. */
  function wishDirection() {
    let fx = 0;
    let fz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) { fx += -Math.sin(yaw); fz += -Math.cos(yaw); }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { fx += Math.sin(yaw); fz += Math.cos(yaw); }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { fx += -Math.cos(yaw); fz += Math.sin(yaw); }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { fx += Math.cos(yaw); fz += -Math.sin(yaw); }
    return { x: fx, z: fz };
  }

  return {
    get yaw() { return yaw; },
    set yaw(v) { yaw = v; },
    get pitch() { return pitch; },
    running() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    wishDirection,
  };
}
