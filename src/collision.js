// Pure collision helpers shared by runtime and Node regression tests.
export const CELL = 4.0;

export function doorPlaneCollision(d, px, pz, radius = 0.34) {
  if (d.open) return false;
  const halfSpan = CELL * 0.5;
  if (d.horiz) {
    // Z-normal door: plane runs along X.
    return Math.abs(pz - d.center.z) < radius && Math.abs(px - d.center.x) < halfSpan + radius;
  }
  // X-normal door: plane runs along Z.
  return Math.abs(px - d.center.x) < radius && Math.abs(pz - d.center.z) < halfSpan + radius;
}
