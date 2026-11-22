import { LevelLayout } from "../src/layout.js";
const L = new LevelLayout(20261110, 30, 30, 6);
const seed = 20261110;
let placed = 0;
outer:
for (let cy = 1; cy < L.maze.height - 1 && placed < 4; cy++)
  for (let cx = 1; cx < L.maze.width - 1 && placed < 4; cx++) {
    if (L.isSolid(cx, cy)) continue;
    if (((cx * 53 + cy * 29 + (seed | 0)) % 37) !== 0) continue;
    const faces = [
      ["+x", L.isSolid(cx + 1, cy)], ["-x", L.isSolid(cx - 1, cy)],
      ["+z", L.isSolid(cx, cy + 1)], ["-z", L.isSolid(cx, cy - 1)],
    ].filter((f) => f[1]);
    if (!faces.length) continue;
    const pick = faces[(cx + cy + (seed | 0)) % faces.length];
    const C = 4.0, x = (cx + 0.5) * C, z = (cy + 0.5) * C;
    const pos = { "+x": [x + 2 - 0.02, z], "-x": [x - 2 + 0.02, z], "+z": [x, z + 2 - 0.02], "-z": [x, z - 2 + 0.02] }[pick[0]];
    console.log("poster", placed, "cell", cx + "," + cy, "face", pick[0], "at", pos.map((v) => v.toFixed(2)).join(","));
    placed++;
    if (placed >= 4) break outer;
  }
