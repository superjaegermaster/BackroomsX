// Port of level_layout.gd — perfect-maze skeleton, rooms punched every X BFS
// steps (rect + 35% L-tab), door links that must be wall-flanked (owner rule:
// doors are ALWAYS against a wall), exit at BFS-farthest cell. One seed => one level.
import { makeRng } from "./prng.js";
import { Maze } from "./maze.js";

const k = (p) => p.x + "," + p.y;
const R = (x, y, w, h) => ({ x, y, w, h, x2: x + w, y2: y + h });
const inRect = (r, p) => p.x >= r.x && p.y >= r.y && p.x < r.x2 && p.y < r.y2;
const intersects = (a, b) => a.x < b.x2 && b.x < a.x2 && a.y < b.y2 && b.y < a.y2;

export class LevelLayout {
  constructor(seed, w = 41, h = 41) {
    this.seed = seed;
    this.spawn = { x: 1, y: 1 };
    this.rooms = [];       // array of 1-2 rects (L-shape)
    this.roomRects = [];
    this.doors = [];       // { c, n, room }
    this.maze = new Maze(w, h, seed);
    const rng = makeRng(seed * 7919 + 13);
    this._carveRooms(rng);
    this.doors = this.doors.filter((d) => this._doorFlush(d.c, d.n));
    this.exitCell = this.maze.bfsFarthest(this.spawn).farthest;
  }
  isSolid(x, y) { return this.maze.isSolid(x, y); }

  _carveRooms(rng) {
    const old = this.maze.grid.map((r) => r.slice());
    let acc = 0, gap = rng.ri(10, 18);
    for (const c of this._bfsOrder()) {
      acc += 1;
      if (acc < gap) continue;
      acc = 0; gap = rng.ri(26, 42);
      this._tryRoom(c, rng, old);
    }
  }

  _tryRoom(anchor, rng, old) {
    let rw = rng.ri(2, 4) * 2 + 1, rh = rng.ri(1, 3) * 2 + 1;
    if (rng.randf() < 0.4) { const t = rw; rw = rh; rh = t; }
    const x0 = Math.min(Math.max(anchor.x - Math.floor(rw / 2), 1), this.maze.width - rw - 2);
    const y0 = Math.min(Math.max(anchor.y - Math.floor(rh / 2), 1), this.maze.height - rh - 2);
    const rect = R(x0, y0, rw, rh);
    if (this._overlaps(rect)) return;
    const rects = [rect];
    if (rng.randf() < 0.35) {
      const tab = this._randomTab(rect, rng);
      if (tab && !this._overlaps(tab)) rects.push(tab);
    }
    const snap = new Map();
    for (const r of rects)
      for (let y = r.y; y < r.y2; y++)
        for (let x = r.x; x < r.x2; x++) { snap.set(k({ x, y }), this.maze.grid[y][x]); this.maze.grid[y][x] = false; }
    let links = this._findLinks(rects, old);
    if (!links.length) links = this._tryStubs(rects, old);
    if (!links.length) {
      for (const kk of snap.keys()) { const [x, y] = kk.split(",").map(Number); this.maze.grid[y][x] = snap.get(kk); }
      return;
    }
    const pool = [], fpool = [];
    for (const l of links) {
      const rc0 = { x: l.c.x + l.n.x, y: l.c.y + l.n.y };
      if (old[rc0.y][rc0.x] && this._doorBacked(l.c, l.n)) {
        pool.push(l);
        if (this._doorFlush(l.c, l.n)) fpool.push(l);
      }
    }
    const cand = fpool.length ? fpool : pool;
    const chosen = [];
    const n = Math.min(3, cand.length);
    for (let i = 0; i < n; i++) {
      const l = cand.splice(rng.ri(0, cand.length - 1), 1)[0];
      l.room = this.rooms.length;
      this.doors.push(l); chosen.push(l);
    }
    if (!chosen.length && links.length) chosen.push(links[0]);
    const openSet = new Set(chosen.map((l) => k({ x: l.c.x + l.n.x, y: l.c.y + l.n.y })));
    for (const l of links) {
      const rc = { x: l.c.x + l.n.x, y: l.c.y + l.n.y };
      if (openSet.has(k(rc))) continue;
      if (old[l.c.y][l.c.x]) this.maze.grid[l.c.y][l.c.x] = true;
      else if (old[rc.y][rc.x]) this.maze.grid[rc.y][rc.x] = true;
    }
    this.rooms.push(rects);
    this.roomRects.push(...rects);
  }

  _doorBacked(c, n) {
    const p = { x: -n.y, y: n.x }, x = { x: c.x + n.x, y: c.y + n.y };
    return this.maze.isSolid(c.x + p.x, c.y + p.y) || this.maze.isSolid(c.x - p.x, c.y - p.y) ||
           this.maze.isSolid(x.x + p.x, x.y + p.y) || this.maze.isSolid(x.x - p.x, x.y - p.y);
  }
  _doorFlush(c, n) { // owner M12f rule: wall run continues on BOTH flanks
    const p = { x: -n.y, y: n.x }, x = { x: c.x + n.x, y: c.y + n.y };
    return this.maze.isSolid(x.x + p.x, x.y + p.y) && this.maze.isSolid(x.x - p.x, x.y - p.y);
  }

  _findLinks(rects, old) {
    const links = [], seen = new Set();
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const r of rects)
      for (let y = r.y; y < r.y2; y++)
        for (let x = r.x; x < r.x2; x++) {
          if (x !== r.x && x !== r.x2 - 1 && y !== r.y && y !== r.y2 - 1) continue;
          for (const [dx, dy] of dirs) {
            const o = { x: x + dx, y: y + dy };
            if (o.x < 0 || o.y < 0 || o.x >= this.maze.width || o.y >= this.maze.height) continue;
            if (rects.some((r2) => inRect(r2, o))) continue;
            if (!old[o.y][o.x] && !seen.has(k(o))) {
              seen.add(k(o));
              links.push({ c: o, n: { x: -dx, y: -dy } });
            }
          }
        }
    return links;
  }

  _tryStubs(rects, old) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const r of rects)
      for (let y = r.y; y < r.y2; y++)
        for (let x = r.x; x < r.x2; x++) {
          if (x !== r.x && x !== r.x2 - 1 && y !== r.y && y !== r.y2 - 1) continue;
          for (const [dx, dy] of dirs) {
            const o = { x: x + dx, y: y + dy }, o2 = { x: x + 2 * dx, y: y + 2 * dy };
            const lim = (p) => p.x >= 1 && p.y >= 1 && p.x < this.maze.width - 1 && p.y < this.maze.height - 1;
            if (!lim(o) || !lim(o2)) continue;
            if (rects.some((r2) => inRect(r2, o) || inRect(r2, o2))) continue;
            if (!old[o2.y][o2.x] && old[o.y][o.x]) {
              this.maze.grid[o.y][o.x] = false;
              return [{ c: o, n: { x: -dx, y: -dy } }];
            }
          }
        }
    return [];
  }

  _randomTab(rect, rng) {
    const side = rng.ri(0, 3);
    const tw = rng.ri(1, 2) * 2 + 1, th = 3;
    const fit = (r) => (r.x < 1 || r.y < 1 || r.x2 > this.maze.width - 1 || r.y2 > this.maze.height - 1) ? null : r;
    const cl = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    if (side === 0) return fit(R(rect.x2, cl(rect.y + Math.floor((rect.y2 - rect.y) / 2) - Math.floor(th / 2), 1, this.maze.height - th - 2), tw, th));
    if (side === 1) return fit(R(rect.x - tw, cl(rect.y + Math.floor((rect.y2 - rect.y) / 2) - Math.floor(th / 2), 1, this.maze.height - th - 2), tw, th));
    if (side === 2) return fit(R(cl(rect.x + Math.floor((rect.x2 - rect.x) / 2) - Math.floor(th / 2), 1, this.maze.width - th - 2), rect.y2, th, tw));
    return fit(R(cl(rect.x + Math.floor((rect.x2 - rect.x) / 2) - Math.floor(th / 2), 1, this.maze.width - th - 2), rect.y - tw, th, tw));
  }

  _overlaps(rect) {
    for (const r of this.roomRects) {
      if (inRect({ x: r.x - 1, y: r.y - 1, x2: r.x2 + 1, y2: r.y2 + 1 }, rect) ||
          inRect({ x: rect.x - 1, y: rect.y - 1, x2: rect.x2 + 1, y2: rect.y2 + 1 }, r) ||
          intersects(r, rect)) return true;
    }
    return false;
  }

  _bfsOrder() {
    const order = [this.spawn], seen = new Set([k(this.spawn)]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < order.length; i++) {
      const cur = order[i];
      for (const [dx, dy] of dirs) {
        const n = { x: cur.x + dx, y: cur.y + dy };
        if (!this.isSolid(n.x, n.y) && !seen.has(k(n))) { seen.add(k(n)); order.push(n); }
      }
    }
    return order;
  }
}
