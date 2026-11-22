// Port of maze_generator.gd — seeded recursive-backtracker perfect maze.
import { makeRng } from "./prng.js";

export class Maze {
  constructor(width, height, seed) {
    this.width = Math.max(7, (width | 1));
    this.height = Math.max(7, (height | 1));
    const g = [];
    for (let y = 0; y < this.height; y++) g.push(new Array(this.width).fill(true));
    this.grid = g;
    const rng = makeRng(seed);
    const stack = [];
    const start = { x: 1, y: 1 };
    g[1][1] = false;
    stack.push(start);
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const options = [];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx > 0 && ny > 0 && nx < this.width - 1 && ny < this.height - 1 && g[ny][nx]) {
          if (g[cur.y + dy / 2][cur.x + dx / 2]) options.push([dx, dy]);
        }
      }
      if (!options.length) { stack.pop(); continue; }
      const [dx, dy] = options[rng.ri(0, options.length - 1)];
      g[cur.y + dy / 2][cur.x + dx / 2] = false;
      g[cur.y + dy][cur.x + dx] = false;
      stack.push({ x: cur.x + dx, y: cur.y + dy });
    }
  }
  isSolid(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
    return this.grid[y][x];
  }
  bfsFarthest(from) {
    const dist = new Map(); dist.set(from.x + "," + from.y, 0);
    const queue = [from]; let farthest = from; let i = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (i < queue.length) {
      const cur = queue[i++];
      const d0 = dist.get(cur.x + "," + cur.y);
      for (const [dx, dy] of dirs) {
        const n = { x: cur.x + dx, y: cur.y + dy }, k = n.x + "," + n.y;
        if (!this.isSolid(n.x, n.y) && !dist.has(k)) {
          dist.set(k, d0 + 1); queue.push(n);
          if (d0 + 1 > dist.get(farthest.x + "," + farthest.y)) farthest = n;
        }
      }
    }
    return { dist, farthest, order: queue };
  }
}
