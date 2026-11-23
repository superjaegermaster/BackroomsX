// Backrooms — three.js port. Deterministic seeded maze-escape on the web with
// bloom + found-footage VHS post, procedural audio, pointer-lock FPS.
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { LevelLayout } from "./layout.js";
import { World, CELL, WALL_H, doorPlaneCollision } from "./world.js";
import { makeComposer } from "./post.js";
import { AudioBed, MysteryMusic } from "./audio.js";
import { Hud } from "./hud.js";
import { makeRng } from "./prng.js";

const params = new URLSearchParams(location.search);
let seed = parseInt(params.get("seed") ?? "20261110", 10);
let fxOn = params.get("fx") !== "0";

const app = document.getElementById("app");
const hud = new Hud();
const audio = new AudioBed();
const music = new MysteryMusic();

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x403f27);
scene.fog = new THREE.FogExp2(0x77764d, 0.032);   // preserve distant surface detail
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 60);
const EYE = 1.68;
camera.position.set(2, EYE, 2);

const { composer, bloom, vhs } = makeComposer(renderer, scene, camera);

const controls = new PointerLockControls(camera, renderer.domElement);
const startEl = document.getElementById("start");
const startBtn = document.getElementById("startBtn");
startBtn.addEventListener("click", () => {
  audio.start();
  placeNeonFn && placeNeonFn();
  music.start(audio);
  startEl.style.display = "none";
  controls.lock();
});
controls.addEventListener("lock", () => { startEl.style.display = "none"; });
controls.addEventListener("unlock", () => { if (!won) startEl.style.display = "flex"; });

// ---------------- state ----------------
let layout, world, transitioning = false, won = false;
let placeNeonFn = null;
let sessionT = 0, nearDoor = null;
const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, onGround: true, lastCell: "" };
const keys = new Set();
let stepDist = 0, lightTick = 0, signT = 3, signNodes = [];

function buildLevel(s, emergeNearCell) {
  if (world) world.dispose();
  layout = new LevelLayout(s);
  world = new World(scene, layout);
  seed = s;
  hud.setInfo(seed, layout.rooms.length, layout.doors.length, world.zones.size);
  signNodes.forEach((n) => n && n.src.stop());
  signNodes = [];
  placeNeonFn = () => {
    if (!audio.ready || !world.exitPos) return;
    signNodes.push(audio.placeNeon(world.exitPos, 0.11, 1));
    const rng = makeRng(s * 7919 + 31);
    const p1 = world.lightPanels[rng.ri(0, world.lightPanels.length - 1)];
    const p2 = world.lightPanels[rng.ri(0, world.lightPanels.length - 1)];
    if (p1) signNodes.push(audio.placeNeon(p1, 0.05, 0.82));
    if (p2) signNodes.push(audio.placeNeon(p2, 0.05, 1.13));
  };
  placeNeonFn();
  // spawn: emerge near the door we walked through, else maze spawn
  let cell;
  if (emergeNearCell) cell = nearestOpen(emergeNearCell);
  else cell = layout.spawn;
  player.pos.set((cell.x + 0.5) * CELL, EYE, (cell.y + 0.5) * CELL);
  faceOpenDir(cell);
  player.vel.set(0, 0, 0);
  player.lastCell = cell.x + "," + cell.y;
  won = false;
  hud.showWin(false);
  world.updateLights(player.pos, 0, 0);
  if (params.get("door") === "1") debugFaceNearestDoor();
}
function nearestOpen(fromCell) {
  const q = [fromCell], seen = new Set([fromCell.x + "," + fromCell.y]);
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy }, k = n.x + "," + n.y;
      if (!layout.isSolid(n.x, n.y) && !seen.has(k)) { seen.add(k); q.push(n); }
    }
  }
  return q[0];
}
function faceOpenDir(cell) {
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const [dx, dy] of dirs) if (!layout.isSolid(cell.x + dx, cell.y + dy)) {
    camera.position.set(player.pos.x, EYE, player.pos.z);
    camera.lookAt(player.pos.x + dx * 4, EYE, player.pos.z + dy * 4);
    break;
  }
}
function debugFaceNearestDoor() {
  if (!world.doors.length) return;
  let best = null, bd = 1e9;
  for (const d of world.doors) {
    const dd = d.center.distanceToSquared(player.pos);
    if (dd < bd) { bd = dd; best = d; }
  }
  player.pos.set((best.c.x + 0.5) * CELL, EYE, (best.c.y + 0.5) * CELL);
  camera.position.copy(player.pos).setY(EYE);
  camera.lookAt(best.center.x, 1.4, best.center.z);
}

function newMaze(emergeCell) {
  if (transitioning) return;
  transitioning = true;
  hud.fadeTo(1, 280);
  setTimeout(() => {
    buildLevel(seed + 1, emergeCell);
    if (Math.random() < 0.5) music.start(audio);
    hud.fadeTo(0, 420);
    setTimeout(() => { transitioning = false; }, 300);
  }, 300);
}

// ---------------- input ----------------
addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && !transitioning) { hud.fadeTo(1, 200); setTimeout(() => { buildLevel(seed + 1); music.start(audio); hud.fadeTo(0, 400); }, 220); return; }
  if (e.code === "KeyM") hud.mapOn = !hud.mapOn, hud.mapEl.style.display = hud.mapOn ? "" : "none";
  if (e.code === "KeyV") {
    fxOn = !fxOn;
    bloom.strength = fxOn ? 0.45 : 0;
    vhs.uniforms.amount.value = fxOn ? 1 : 0;
  }
  if (e.code === "KeyE" && nearDoor && !transitioning) world.openDoor(nearDoor, audio);
  keys.add(e.code);
});
addEventListener("keyup", (e) => keys.delete(e.code));

// ---------------- movement + collision ----------------
function collide(px, pz) {
  const r = 0.34;
  // Closed doors are thin blockers at the rendered door plane. Previously the
  // entire room-side 4m cell was marked blocked, creating invisible walls well
  // away from the visible door. Solid maze cells remain full-cell blockers.
  if (world.doors.some((d) => doorPlaneCollision(d, px, pz, r))) return true;
  for (let cy = Math.floor((pz - r) / CELL); cy <= Math.floor((pz + r) / CELL); cy++)
    for (let cx = Math.floor((px - r) / CELL); cx <= Math.floor((px + r) / CELL); cx++)
      if (world.blocked.has(cx + "," + cy)) {
        const nx = Math.max(cx * CELL, Math.min(px, cx * CELL + CELL));
        const nz = Math.max(cy * CELL, Math.min(pz, cy * CELL + CELL));
        if ((px - nx) ** 2 + (pz - nz) ** 2 < r * r) return true;
      }
  return false;
}

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  sessionT += dt;
  hud.setRec(sessionT, fxOn);

  // movement
  const locked = controls.isLocked || params.has("freemove");
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.2 : 3.0;
  const f = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const s = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  if (locked && !won && !transitioning) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const move = dir.multiplyScalar(f).add(side.multiplyScalar(s));
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      const nx = player.pos.x + move.x, nz = player.pos.z + move.z;
      if (!collide(nx, player.pos.z)) player.pos.x = nx;
      if (!collide(player.pos.x, nz)) player.pos.z = nz;
      stepDist += move.length();
      if (stepDist > (speed > 5 ? 2.4 : 3.2)) { stepDist = 0; audio.step(); }
    }
    if (keys.has("Space") && player.onGround) { player.vel.y = 4.4; player.onGround = false; }
  }
  player.vel.y -= 14 * dt;
  player.pos.y = Math.max(EYE, player.pos.y + player.vel.y * dt);
  if (player.pos.y <= EYE + 0.001) { player.pos.y = EYE; player.vel.y = 0; player.onGround = true; }
  // head bob
  const bob = (f || s) && player.onGround && locked ? Math.sin(sessionT * (speed > 4 ? 10 : 7.5)) * 0.05 : 0;
  camera.position.set(player.pos.x, player.pos.y + bob, player.pos.z);

  // doors: nearest-in-cone prompt + walk-through detection
  nearDoor = null;
  if (!transitioning && !won) {
    let bd = 6.8;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    for (const d of world.doors) {
      if (d.open) continue;
      const to = new THREE.Vector3().subVectors(d.center, player.pos); to.y = 0;
      const dd = to.length();
      if (dd < 2.9 && to.normalize().dot(fwd) > 0.55 && dd < bd) { bd = dd; nearDoor = d; }
    }
    hud.setPrompt(!!nearDoor);
    const cell = Math.floor(player.pos.x / CELL) + "," + Math.floor(player.pos.z / CELL);
    if (cell !== player.lastCell) {
      for (const d of world.doors)
        if (d.open && cell === d.cellKey && player.lastCell === d.c.x + "," + d.c.y) {
          player.lastCell = cell; newMaze(d.c); return;
        }
      player.lastCell = cell;
    }
    // exit?
    if (world.exitPos && player.pos.distanceTo(world.exitPos.clone().setY(player.pos.y)) < 1.6) {
      won = true; hud.showWin(true, seed); controls.unlock();
    }
  }

  // world anims
  world.animateDoors(dt);
  world.animateDust(sessionT);
  lightTick -= dt;
  if (lightTick <= 0) { lightTick = 0.4; world.updateLights(player.pos, sessionT, 0.4, () => audio.humSurge()); }
  else world.updateLightsFlickerOnly?.(dt);
  // pool flicker runs inside updateLights; run it every frame cheaply:
  for (const pl of world.lightPool) {
    if (pl.userData.flick > 0) {
      pl.userData.flick -= dt;
      pl.intensity = 22 * (0.2 + 0.8 * Math.abs(Math.sin(performance.now() * 0.041 + pl.id)));
    } else if (Math.abs(pl.intensity - 22) > 0.01) pl.intensity = 22;
  }
  // dying neon sign flicker (light + audio surge together)
  signT -= dt;
  if (signT <= 0) {
    signT = 3 + Math.random() * 7;
    if (Math.random() < 0.7 && world.signEmissiveMat) {
      const m = world.signEmissiveMat;
      const t0 = performance.now();
      const seq = [0.25, 2.4, 0.5, 2.4];
      let i = 0;
      const step = () => {
        if (i >= seq.length) { m.emissiveIntensity = 2.4; return; }
        m.emissiveIntensity = seq[i++];
        world.signLight.intensity = seq[i - 1] * 1.3;
        setTimeout(step, 55);
      };
      step();
      audio.buzzSurge(signNodes[0]);
    }
  }

  vhs.uniforms.time.value = sessionT;
  hud.drawMap(layout, world, player.pos, getForward());
  hud.setPos(player.pos, layout, world);

  if (fxOn || true) composer.render();
  void renderer;
}
function getForward() {
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  d.y = 0; return d.normalize();
}

addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  vhs.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
});
vhs.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);

buildLevel(seed);
tick();

// owner/QA debug handle (also used by the browser test probes)
window.BR = {
  info: () => ({ fxOn, seed, doors: world.doors.length,
    rooms: layout.rooms.length, zones: world.zones.size, posters: world.posterCount || 0,
    furniture: world.furnitureCount || 0,
    pos: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
    open: world.doors.filter((d) => d.open).length,
    blockedDoorCells: world.doors.filter((d) => world.blocked.has(d.cellKey)).length,
    exit: world.exitPos.toArray().map((v) => +v.toFixed(1)),
    setPos: (x, z, yaw) => { player.pos.x = x; player.pos.z = z;
      if (yaw !== undefined) camera.rotation.set(0, yaw, 0); },
    fwd: (() => { const v = new THREE.Vector3(); camera.getWorldDirection(v);
      return [+v.x.toFixed(2), +v.z.toFixed(2)]; })(),
    posterPos: world.posterPos || [],
    near: !!nearDoor }),
};
