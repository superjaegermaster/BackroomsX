// DOM HUD + minimap port of map_view.gd: walls, rooms, open/closed doors,
// cyan arrow = you (biggest marker), gold diamond = exit, legend inside panel.
const $ = (id) => document.getElementById(id);
export function mapArrowAngle(fwd) {
  return Math.atan2(fwd.x, -fwd.z);
}

export class Hud {
  constructor() {
    this.info = $("info"); this.pos = $("pos"); this.rec = $("rec");
    this.stamp = $("stamp"); this.music = $("music");
    this.prompt = $("prompt"); this.win = $("win"); this.fade = $("fade");
    this.mapEl = $("map");
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = 320;
    this.mapEl.appendChild(this.canvas);
    this.mapOn = true;
    this.mapCtx = this.canvas.getContext("2d");
  }
  setInfo(seed, rooms, doors, zones) {
    this.info.textContent = `WASD · Shift · Space · Esc · R new · E doors · M map · V fx   ` +
      `[seed ${seed} · rooms ${rooms} · doors ${doors} · zones ${zones}]`;
    this.setStamp(seed);
  }
  setPos(p, layout, world) {
    const cx = Math.floor(p.x / 4), cz = Math.floor(p.z / 4);
    const zx = Math.floor(cx / 14), zy = Math.floor(cz / 14);
    const style = world.zones.get(zx + "," + zy) ?? "?";
    this.pos.textContent = `x ${p.x.toFixed(1)}  z ${p.z.toFixed(1)}  |  cell (${cx}, ${cz})  |  zone (${zx}, ${zy}) ${style}`;
  }
  setRec(t, on) {
    const tt = Math.floor(t);
    const ff = Math.floor((t % 1) * 30); // 30 fps tape, like the reference
    const dot = (t % 1) < 0.6 ? "●" : " ";
    this.rec.textContent = `${dot} REC ${String(Math.floor(tt / 3600)).padStart(2, "0")}:${String(Math.floor(tt / 60) % 60).padStart(2, "0")}:${String(tt % 60).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
    this.rec.style.display = on ? "" : "none";
  }
  setStamp(seed) {
    // camcorder date stamp, bottom-right — found-footage framing
    this.stamp.textContent = `NOV.21.2026  ${String(6 + (seed % 12)).padStart(2, "0")}:${String(10 + (seed % 50)).padStart(2, "0")}  AM  SP ${seed % 100}`;
  }
  setMusic(name) {
    this.music.textContent = `♪ ${name} · N next track`;
  }
  setPrompt(show, label = "[E] open the door") {
    this.prompt.style.display = show ? "block" : "none";
    if (show) this.prompt.textContent = label;
  }
  showWin(show, seed) {
    this.win.style.display = show ? "flex" : "none";
    if (show) this.win.querySelector(".sub").textContent =
      `level ${seed} · press R to dive again`;
  }
  fadeTo(alpha, ms = 300) {
    this.fade.style.transition = `opacity ${ms}ms ease`;
    this.fade.style.opacity = alpha;
  }

  drawMap(layout, world, playerPos, fwd) {
    if (!this.mapOn) return;
    const c = this.mapCtx, S = 320;
    const L = layout, n = L.maze.width, sc = S / n;
    c.clearRect(0, 0, S, S);
    c.fillStyle = "rgba(12,10,4,0.55)"; c.fillRect(0, 0, S, S);
    // open cells
    c.fillStyle = "rgba(220,190,90,0.20)";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (!L.isSolid(x, y)) c.fillRect(x * sc, y * sc, sc + 0.5, sc + 0.5);
    // room outlines
    c.strokeStyle = "rgba(150,200,255,0.28)"; c.lineWidth = 1;
    for (const r of L.roomRects) c.strokeRect(r.x * sc, r.y * sc, (r.x2 - r.x) * sc, (r.y2 - r.y) * sc);
    // doors
    for (const d of world.doors) {
      c.fillStyle = d.open ? "#39e66f" : "#ff9a30";
      const px = (d.c.x + 0.5 + d.n.x * 0.5) * sc, py = (d.c.y + 0.5 + d.n.y * 0.5) * sc;
      c.fillRect(px - 2, py - 2, 4, 4);
    }
    // exit diamond (gold)
    const ex = (L.exitCell.x + 0.5) * sc, ey = (L.exitCell.y + 0.5) * sc;
    c.fillStyle = "#ffd24a";
    c.beginPath(); c.moveTo(ex, ey - 6); c.lineTo(ex + 6, ey); c.lineTo(ex, ey + 6); c.lineTo(ex - 6, ey);
    c.closePath(); c.fill();
    // player: big cyan arrow rotated to face look direction
    const pxp = (playerPos.x / 4) * sc, pyp = (playerPos.z / 4) * sc;
    const ang = mapArrowAngle(fwd); // map: +x right, +z down
    c.save(); c.translate(pxp, pyp); c.rotate(ang);
    c.fillStyle = "#2ee6ff";
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 7); c.lineTo(0, 3.5); c.lineTo(-6, 7);
    c.closePath(); c.fill(); c.restore();
    // legend
    c.fillStyle = "rgba(255,235,170,0.9)"; c.font = "10px ui-monospace, monospace";
    c.fillText("▶ you   ◆ exit   ▸ closed door · green open", 8, S - 6);
  }
}
