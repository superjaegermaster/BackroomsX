// Node test suite for the layout port — mirrors the Godot test gates:
// determinism, border walls, full connectivity, doors always wall-flanked,
// exit reachable. Run: node tests/test_layout.mjs
import { LevelLayout } from "../src/layout.js";

let fails = 0;
const fail = (m) => { console.log("FAIL:", m); fails++; };

for (const seed of [20261110, 20261111, 42, 7, 999]) {
  const a = new LevelLayout(seed), b = new LevelLayout(seed);
  // determinism
  if (JSON.stringify(a.maze.grid) !== JSON.stringify(b.maze.grid)) fail(`seed ${seed}: grid differs`);
  if (JSON.stringify(a.doors.map((d) => [d.c, d.n])) !== JSON.stringify(b.doors.map((d) => [d.c, d.n]))) fail(`seed ${seed}: doors differ`);
  // borders solid
  for (let x = 0; x < a.maze.width; x++) { if (!a.isSolid(x, 0) || !a.isSolid(x, a.maze.height - 1)) fail(`seed ${seed}: border hole`); }
  for (let y = 0; y < a.maze.height; y++) { if (!a.isSolid(0, y) || !a.isSolid(a.maze.width - 1, y)) fail(`seed ${seed}: border hole`); }
  // connectivity over final grid
  const seen = new Set([a.spawn.x + "," + a.spawn.y]);
  const q = [a.spawn];
  for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = { x: q[i].x + dx, y: q[i].y + dy };
    if (!a.isSolid(n.x, n.y) && !seen.has(n.x + "," + n.y)) { seen.add(n.x + "," + n.y); q.push(n); }
  }
  let open = 0;
  for (let y = 0; y < a.maze.height; y++) for (let x = 0; x < a.maze.width; x++) if (!a.isSolid(x, y)) open++;
  if (seen.size !== open) fail(`seed ${seed}: connectivity ${seen.size}/${open}`);
  if (!seen.has(a.exitCell.x + "," + a.exitCell.y)) fail(`seed ${seed}: exit unreachable`);
  // door flush rule (owner M12f): flanking room-side cells both solid
  for (const d of a.doors) {
    const p = { x: -d.n.y, y: d.n.x }, rx = d.c.x + d.n.x, ry = d.c.y + d.n.y;
    if (!a.isSolid(rx + p.x, ry + p.y) || !a.isSolid(rx - p.x, ry - p.y))
      fail(`seed ${seed}: door at (${d.c.x},${d.c.y}) not wall-flanked`);
  }
  console.log(`seed ${seed}: rooms=${a.rooms.length} doors=${a.doors.length} open=${open} exit=(${a.exitCell.x},${a.exitCell.y}) OK`);
}
console.log(fails ? `LAYOUT TESTS: FAIL (${fails})` : "LAYOUT TESTS: PASS");
process.exit(fails ? 1 : 0);
