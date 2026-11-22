// World: merged wall/floor/ceiling geometry with world-space UVs, ceiling
// light panels + a roaming PointLight pool, hinged doors styled per zone,
// exit monolith + neon EXIT sign, dust motes. Deterministic from seed.
import * as THREE from "three";
import { wallTexture, carpetTexture, ceilingTexture, doorTexture, signTexture, posterTexture, DOOR_STYLES } from "./textures.js";
import { makeRng } from "./prng.js";

export const CELL = 4.0;
export const WALL_H = 3.4;
export const ZONE_CELLS = 14;

const PL_INT = 22;

export class World {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.doors = [];         // {cell, dir, hinge, leaf, open, angle, target, center, style}
    this.blocked = new Set(); // "x,y" cells that block movement (solid + closed doors)
    this.lightPanels = [];
    this.lightPool = [];
    this._buildShell();
    this._buildLights();
    this._buildDoors();
    this._buildPosters();
    this._buildExit();
    this._buildDust();
  }

  dispose() { this.scene.remove(this.group); this.group.traverse((o) => o.geometry && o.geometry.dispose()); }

  // ---------- merged shell ----------
  _buildShell() {
    const L = this.layout, C = CELL, H = WALL_H;
    const pos = [], nor = [], uv = [];
    const TILE = 4.0; // one texture tile per 4 m
    const quad = (a, b, c, d, n, uvs) => {
      for (const v of [a, b, c, a, c, d]) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); }
      const [ua, va, ub, vb, uc, vc, ud, vd] = uvs;
      uv.push(ua, va, ub, vb, uc, vc, ua, va, uc, vc, ud, vd);
    };
    for (let cy = 0; cy < L.maze.height; cy++) for (let cx = 0; cx < L.maze.width; cx++) {
      if (!L.isSolid(cx, cy)) continue;
      const x0 = cx * C, z0 = cy * C;
      const face = (nxOpen, nz, n) => {
        if (!L.isSolid(nxOpen, cy) || true) { /* placeholder */ }
      };
      // exposed faces toward open neighbors
      if (!L.isSolid(cx + 1, cy)) quad([x0 + C, 0, z0], [x0 + C, 0, z0 + C], [x0 + C, H, z0 + C], [x0 + C, H, z0], [1, 0, 0],
        [x0 / TILE, 0, (x0 + C) / TILE, 0, (x0 + C) / TILE, H / TILE, x0 / TILE, H / TILE]);
      if (!L.isSolid(cx - 1, cy)) quad([x0, 0, z0 + C], [x0, 0, z0], [x0, H, z0], [x0, H, z0 + C], [-1, 0, 0],
        [x0 / TILE, 0, (x0 + C) / TILE, 0, (x0 + C) / TILE, H / TILE, x0 / TILE, H / TILE]);
      if (!L.isSolid(cx, cy + 1)) quad([x0 + C, 0, z0 + C], [x0, 0, z0 + C], [x0, H, z0 + C], [x0 + C, H, z0 + C], [0, 0, 1],
        [x0 / TILE, 0, (x0 + C) / TILE, 0, (x0 + C) / TILE, H / TILE, x0 / TILE, H / TILE]);
      if (!L.isSolid(cx, cy - 1)) quad([x0, 0, z0], [x0 + C, 0, z0], [x0 + C, H, z0], [x0, H, z0], [0, 0, -1],
        [x0 / TILE, 0, (x0 + C) / TILE, 0, (x0 + C) / TILE, H / TILE, x0 / TILE, H / TILE]);
    }
    const W = L.maze.width * C, Ht = L.maze.height * C;
    // floor (one quad per open cell keeps UV tidy; whole-map quad also fine)
    for (let cy = 0; cy < L.maze.height; cy++) for (let cx = 0; cx < L.maze.width; cx++) {
      if (L.isSolid(cx, cy)) continue;
      const x0 = cx * C, z0 = cy * C;
      quad([x0, 0, z0], [x0, 0, z0 + C], [x0 + C, 0, z0 + C], [x0 + C, 0, z0], [0, 1, 0],
        [x0 / TILE, z0 / TILE, x0 / TILE, (z0 + C) / TILE, (x0 + C) / TILE, (z0 + C) / TILE, (x0 + C) / TILE, z0 / TILE]);
      quad([x0, H, z0 + C], [x0, H, z0], [x0 + C, H, z0], [x0 + C, H, z0 + C], [0, -1, 0],
        [x0 / TILE, z0 / TILE, x0 / TILE, (z0 + C) / TILE, (x0 + C) / TILE, (z0 + C) / TILE, (x0 + C) / TILE, z0 / TILE]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const mk = (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0.02 });
    // walls, floor, ceiling: split by material via groups is overkill — three meshes
    const walls = new THREE.BufferGeometry();
    const nq = pos.length / 9;
    const wallCount = (() => { let c = 0; for (let y = 0; y < L.maze.height; y++) for (let x = 0; x < L.maze.width; x++) if (L.isSolid(x, y)) { if (!L.isSolid(x + 1, y)) c++; if (!L.isSolid(x - 1, y)) c++; if (!L.isSolid(x, y + 1)) c++; if (!L.isSolid(x, y - 1)) c++; } return c; })();
    const setSub = (geom, startQuad) => {
      const n = geom === walls ? wallCount : (nq - wallCount) / 2;
      return n;
    };
    // simpler: rebuild three arrays
    const split = { wall: { p: [], n: [], u: [] }, floor: { p: [], n: [], u: [] }, ceil: { p: [], n: [], u: [] } };
    let q = 0;
    for (const _ of [0]) { void _; }
    for (let i = 0; i < pos.length; i += 18) {
      const ny = nor[i + 1]; // normal y of first vert of quad
      const nx = nor[i]; const nz = nor[i + 2];
      const bucket = ny > 0.5 ? "floor" : (ny < -0.5 ? "ceil" : "wall");
      for (let v = 0; v < 6; v++) {
        split[bucket].p.push(...pos.slice(i + v * 3, i + v * 3 + 3));
        split[bucket].n.push(...nor.slice(i + v * 3, i + v * 3 + 3));
        split[bucket].u.push(...uv.slice(i + v * 2, i + v * 2 + 2));
      }
      q++;
    }
    const build = (s, t) => {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.Float32BufferAttribute(s.p, 3));
      bg.setAttribute("normal", new THREE.Float32BufferAttribute(s.n, 3));
      bg.setAttribute("uv", new THREE.Float32BufferAttribute(s.u, 2));
      const m = new THREE.Mesh(bg, mk(t));
      m.matrixAutoUpdate = false;
      this.group.add(m);
    };
    build(split.wall, wallTexture());
    build(split.floor, carpetTexture());
    build(split.ceil, ceilingTexture());
    void g; void setSub;

    // movement blockers: all solid cells
    for (let cy = 0; cy < L.maze.height; cy++) for (let cx = 0; cx < L.maze.width; cx++)
      if (L.isSolid(cx, cy)) this.blocked.add(cx + "," + cy);
    void W; void Ht;
  }

  // ---------- lights ----------
  _buildLights() {
    const L = this.layout, C = CELL;
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a12, emissive: 0xfff1c4, emissiveIntensity: 1.7, roughness: 1 });
    const panelGeo = new THREE.PlaneGeometry(2.2, 0.7);
    const pts = [];
    for (let cy = 1; cy < L.maze.height - 1; cy++) for (let cx = 1; cx < L.maze.width - 1; cx++) {
      if (L.isSolid(cx, cy) || ((cx * 31 + cy * 17) % 7) !== 0) continue;
      // only where a corridor runs along X or Z
      const alongX = !L.isSolid(cx - 1, cy) && !L.isSolid(cx + 1, cy);
      const alongZ = !L.isSolid(cx, cy - 1) && !L.isSolid(cx, cy + 1);
      if (!alongX && !alongZ) continue;
      pts.push([cx + 0.5, cy + 0.5]);
      const m = new THREE.Mesh(panelGeo, panelMat);
      m.rotation.x = Math.PI / 2;
      if (!alongX || alongZ) m.rotation.z = Math.PI / 2;
      m.position.set((cx + 0.5) * C, WALL_H - 0.03, (cy + 0.5) * C);
      this.group.add(m);
    }
    this.lightPanels = pts.map(([cx, cy]) => new THREE.Vector3((cx + 0.5) * C, WALL_H - 0.3, (cy + 0.5) * C));
    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xffeccb, PL_INT, 19, 1.7);
      pl.position.copy(this.lightPanels[0] ?? new THREE.Vector3());
      this.group.add(pl);
      this.lightPool.push(pl);
    }
    this.hemi = new THREE.HemisphereLight(0xa8924a, 0x322a12, 0.5);
    this.group.add(this.hemi);
  }
  updateLights(playerPos, t, dt, flickCb) {
    const P = this.lightPanels;
    if (!P.length) return;
    // reassign pool to 6 nearest panels (throttled by caller)
    this._assignPool(playerPos);
    // fluorescent flicker: random pool light stutters
    this._ft = (this._ft ?? 0) - dt;
    if (this._ft <= 0) {
      this._ft = 0.35 + Math.random() * 1.5;
      if (Math.random() < 0.5) {
        const pl = this.lightPool[(Math.random() * this.lightPool.length) | 0];
        pl.userData.flick = 0.35 + Math.random() * 0.3;
        if (flickCb) flickCb();
      }
    }
    for (const pl of this.lightPool) {
      if (pl.userData.flick > 0) {
        pl.userData.flick -= dt;
        pl.intensity = PL_INT * (0.25 + 0.75 * Math.abs(Math.sin(performance.now() * 0.04 + pl.id)));
      } else pl.intensity = PL_INT;
    }
    void t;
  }
  _assignPool(playerPos) {
    const P = this.lightPanels;
    if (this._assignedTo === playerPos.x.toFixed(1) + "," + playerPos.z.toFixed(1)) return;
    this._assignedTo = playerPos.x.toFixed(1) + "," + playerPos.z.toFixed(1);
    const idx = P.map((p, i) => [p.distanceToSquared(playerPos), i])
      .sort((a, b) => a[0] - b[0]).slice(0, this.lightPool.length);
    idx.forEach(([d, i], j) => this.lightPool[j].position.copy(P[i]));
  }

  // ---------- doors (5 zone styles, hinged, all unlocked) ----------
  _zoneStyle(cx, cy) {
    const zx = Math.floor(cx / ZONE_CELLS), zy = Math.floor(cy / ZONE_CELLS);
    this.zones ??= this._makeZones();
    return this.zones.get(zx + "," + zy) ?? DOOR_STYLES[0];
  }
  _makeZones() {
    const L = this.layout, nz = Math.ceil(L.maze.width / ZONE_CELLS);
    const rng = makeRng(L.seed * 104729 + 7);
    const base = DOOR_STYLES.slice();
    for (let i = base.length - 1; i > 0; i--) { const j = rng.ri(0, i);[base[i], base[j]] = [base[j], base[i]]; }
    const zones = new Map();
    for (let zy = 0; zy < nz; zy++) for (let zx = 0; zx < nz; zx++) {
      let s = base[(zy * nz + zx) % base.length];
      const left = zones.get((zx - 1) + "," + zy), up = zones.get(zx + "," + (zy - 1));
      if (s === left || s === up) s = base.find((c) => c !== left && c !== up) ?? s;
      zones.set(zx + "," + zy, s);
    }
    return zones;
  }
  _buildDoors() {
    const L = this.layout, C = CELL;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4a, roughness: 0.9 });
    const leafH = 2.9;
    const texCache = {};
    for (const d of L.doors) {
      const style = this._zoneStyle(d.c.x, d.c.y);
      const cell = { x: d.c.x + d.n.x, y: d.c.y + d.n.y }; // room-side doorway cell
      const cx = (d.c.x + 0.5 + d.n.x * 0.5) * C, cz = (d.c.y + 0.5 + d.n.y * 0.5) * C;
      const horiz = d.n.y !== 0; // door plane runs along X if normal is Z
      const frame = new THREE.Group();
      frame.position.set(cx, 0, cz);
      frame.rotation.y = horiz ? 0 : Math.PI / 2;
      const bar = (w, hgt, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.2), frameMat);
        m.position.set(0, y, 0); frame.add(m);
      };
      bar(4.2, 0.16, leafH + 0.08);                    // header
      const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.16, leafH + 0.16, 0.24), frameMat);
      jambL.position.set(-1.95, (leafH + 0.16) / 2, 0); frame.add(jambL);
      const jambR = jambL.clone(); jambR.position.x = 1.95; frame.add(jambR);
      const backing = new THREE.Mesh(new THREE.PlaneGeometry(4.0, WALL_H),
        new THREE.MeshStandardMaterial({ color: 0x6b5c34, roughness: 1, side: THREE.DoubleSide }));
      backing.position.set(0, WALL_H / 2, 0.0);
      frame.add(backing);
      this.group.add(frame);
      // hinge at left jamb, leaf swings toward corridor
      const hinge = new THREE.Group();
      hinge.position.set(cx - 1.9, 0, cz);
      if (!horiz) hinge.position.set(cx, 0, cz - 1.9);
      hinge.rotation.y = horiz ? 0 : -Math.PI / 2;
      const leafTex = texCache[style] ??= doorTexture(style);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.8, leafH, 0.1),
        [new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.8 }),
         new THREE.MeshStandardMaterial({ color: 0x55492c, roughness: 1 }),
         new THREE.MeshStandardMaterial({ color: 0x443a22, roughness: 1 }),
         new THREE.MeshStandardMaterial({ color: 0x55492c, roughness: 1 }),
         new THREE.MeshStandardMaterial({ color: 0x3c3420, roughness: 1 }),
         new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9 })]);
      leaf.position.set(1.9, leafH / 2, 0);
      hinge.add(leaf);
      this.group.add(hinge);
      const dd = {
        cellKey: cell.x + "," + cell.y, c: d.c, cell, n: d.n,
        hinge, open: false, target: 0, angle: 0,
        center: new THREE.Vector3(cx, 1.5, cz), style, horiz,
      };
      this.doors.push(dd);
      this.blocked.add(dd.cellKey); // closed door blocks its doorway cell
    }
  }
  openDoor(d, audio) {
    if (d.open) return;
    d.open = true; d.target = -Math.PI * 0.58;
    this.blocked.delete(d.cellKey);
    audio?.doorCreak();
  }
  animateDoors(dt) {
    for (const d of this.doors) {
      if (Math.abs(d.angle - d.target) < 0.001) continue;
      const k = 1 - Math.pow(0.0008, dt);
      d.angle += (d.target - d.angle) * k;
      d.hinge.rotation.y = (d.horiz ? 0 : -Math.PI / 2) + d.angle;
    }
  }

  // ---------- exit ----------
  // out-of-place retro posters — the video's "safe threat": one weird mundane
  // object breaks the monotony and implies the space once had occupants.
  _buildPosters() {
    const L = this.layout, C = CELL;
    let placed = 0, variant = 0;
    const posters = [];
    const mats = [0, 1, 2].map((v) => {
      const map = posterTexture(v);
      return new THREE.MeshStandardMaterial({
        map, emissiveMap: map, emissive: 0xffe9a8, emissiveIntensity: 0.22,
        roughness: 0.9, metalness: 0,
      });
    });
    outer:
    for (let cy = 1; cy < L.maze.height - 1 && placed < 4; cy++)
      for (let cx = 1; cx < L.maze.width - 1 && placed < 4; cx++) {
        if (L.isSolid(cx, cy)) continue;
        if (((cx * 53 + cy * 29 + (L.seed | 0)) % 37) !== 0) continue;  // sparse, seeded
        const x = (cx + 0.5) * C, z = (cy + 0.5) * C;
        const faces = [
          [L.isSolid(cx + 1, cy), x + C / 2 - 0.02, z, -Math.PI / 2],
          [L.isSolid(cx - 1, cy), x - C / 2 + 0.02, z, Math.PI / 2],
          [L.isSolid(cx, cy + 1), x, z + C / 2 - 0.02, Math.PI],
          [L.isSolid(cx, cy - 1), x, z - C / 2 + 0.02, 0],
        ].filter((f) => f[0]);
        if (!faces.length) continue;
        const [, px, pz, ry] = faces[(cx + cy + (L.seed | 0)) % faces.length];
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.22), mats[variant % 3]);
        m.position.set(px, 1.62, pz);
        m.rotation.y = ry;
        this.group.add(m);
        posters.push([+px.toFixed(2), +pz.toFixed(2), +ry.toFixed(2)]);
        placed++; variant++;
        if (placed >= 4) break outer;
      }
    this.posterCount = placed;
    this.posterPos = posters;
  }

  _buildExit() {
    const L = this.layout, C = CELL;
    const ec = L.exitCell;
    this.exitPos = new THREE.Vector3((ec.x + 0.5) * C, 1.3, (ec.y + 0.5) * C);
    const mono = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.7, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x06231a, emissive: 0x18ff8c, emissiveIntensity: 1.4, roughness: 0.4 }));
    mono.position.copy(this.exitPos);
    this.group.add(mono);
    const eg = new THREE.PointLight(0x22ff9a, 6, 14, 1.6);
    eg.position.copy(this.exitPos).add(new THREE.Vector3(0, 1.2, 0));
    this.group.add(eg);
    // neon EXIT sign
    const sm = new THREE.MeshStandardMaterial({ color: 0x160404, emissive: 0xffffff, emissiveMap: signTexture(), emissiveIntensity: 2.4 });
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.36), sm);
    this.sign.position.copy(this.exitPos).add(new THREE.Vector3(0, WALL_H - 0.55, 0));
    this.sign.rotation.y = Math.PI;
    this.group.add(this.sign);
    this.sign2 = this.sign.clone();
    this.sign2.rotation.y = 0;
    this.group.add(this.sign2);
    this.signLight = new THREE.PointLight(0xff2a1c, 3.2, 8, 1.5);
    this.signLight.position.copy(this.sign.position).add(new THREE.Vector3(0, -0.3, 0));
    this.group.add(this.signLight);
    this.signEmissiveMat = sm;
  }

  // ---------- dust ----------
  _buildDust() {
    const n = 2200, arr = new Float32Array(n * 3);
    const L = this.layout, C = CELL;
    for (let i = 0; i < n; i++) {
      arr[i * 3] = Math.random() * L.maze.width * C;
      arr[i * 3 + 1] = 0.2 + Math.random() * (WALL_H - 0.4);
      arr[i * 3 + 2] = Math.random() * L.maze.height * C;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffe9b0, size: 0.02, transparent: true, opacity: 0.34, sizeAttenuation: true }));
    this.group.add(this.dust);
  }
  animateDust(t) {
    this.dust.position.y = Math.sin(t * 0.35) * 0.12;
    this.dust.rotation.y = t * 0.008;
  }
}
