// Procedural canvas textures — mono-yellow wallpaper, damp carpet, ceiling
// tiles, 5 door styles (medieval / victorian_iron / rustic_pine / industrial_wood
// / metal_fire), EXIT sign. Zero downloads, deterministic.
import * as THREE from "three";

function cv(size) { const c = document.createElement("canvas"); c.width = c.height = size; return c; }
function noise(ctx, s, amt, alpha) {
  const img = ctx.getImageData(0, 0, s, s), d = img.data;
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * alpha;
  }
  ctx.putImageData(img, 0, 0);
}
function blobs(ctx, s, n, col, rmin, rmax) {
  let seed = 999;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = rmin + rnd() * (rmax - rmin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col(0.12 + rnd() * 0.18)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}
function tex(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function wallTexture() {
  const s = 1024, c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#cbb867"; x.fillRect(0, 0, s, s);
  // faint vertical damask stripes
  for (let i = 0; i < s; i += 64) {
    x.fillStyle = "rgba(120,100,30,0.10)"; x.fillRect(i, 0, 2, s);
    x.fillStyle = "rgba(255,240,170,0.07)"; x.fillRect(i + 32, 0, 1, s);
  }
  // subtle repeating dot pattern
  x.fillStyle = "rgba(150,130,50,0.08)";
  for (let yy = 0; yy < s; yy += 16) for (let xx = (yy / 16) % 2 ? 8 : 0; xx < s; xx += 16) {
    x.beginPath(); x.arc(xx, yy, 1.2, 0, 7); x.fill();
  }
  noise(x, s, 26, 0.6);
  blobs(x, s, 26, (a) => `rgba(90,72,20,${a})`, 30, 160);   // age stains
  const g = x.createLinearGradient(0, s * 0.82, 0, s);       // kick scuff line
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(50,40,10,0.5)");
  x.fillStyle = g; x.fillRect(0, s * 0.82, s, s * 0.18);
  return tex(c);
}

export function carpetTexture() {
  const s = 1024, c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#bfa94f"; x.fillRect(0, 0, s, s);
  // fiber noise
  let seed = 777;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 90000; i++) {
    const px = rnd() * s, py = rnd() * s, v = (rnd() - 0.5);
    x.fillStyle = v > 0 ? "rgba(255,240,170,0.05)" : "rgba(70,55,10,0.06)";
    x.fillRect(px, py, 1.5, 1);
  }
  blobs(x, s, 18, (a) => `rgba(60,48,12,${a})`, 40, 220);    // damp traffic lanes
  noise(x, s, 18, 0.5);
  return tex(c);
}

export function ceilingTexture() {
  const s = 1024, c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#d6d2c4"; x.fillRect(0, 0, s, s);
  noise(x, s, 14, 0.3);
  x.strokeStyle = "rgba(70,66,52,0.55)"; x.lineWidth = 5;      // T-bar grid
  x.strokeRect(2, 2, s - 4, s - 4);
  x.beginPath(); x.moveTo(s / 2, 0); x.lineTo(s / 2, s); x.moveTo(0, s / 2); x.lineTo(s, s / 2); x.stroke();
  x.strokeStyle = "rgba(70,66,52,0.16)"; x.lineWidth = 1;      // tile speckle cells
  for (let i = 1; i < 8; i++) {
    x.beginPath(); x.moveTo(i * s / 8, 0); x.lineTo(i * s / 8, s); x.stroke();
    x.beginPath(); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke();
  }
  blobs(x, s, 8, (a) => `rgba(90,80,40,${a})`, 30, 120);       // water rings
  return tex(c);
}

// ---- doors: one 512x1024 canvas per style (leaf fills opening) ----
export const DOOR_STYLES = ["medieval", "victorian_iron", "rustic_pine", "industrial_wood", "metal_fire"];
export function doorTexture(style) {
  const w = 512, h = 1024, c = cv(1024), x = c.getContext("2d");
  c.height = 1024;
  const P = 18; // plank width
  const plank = (base, streakA, streakB) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    let seed = 4242;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let px = 0; px < w; px += P) {
      x.strokeStyle = "rgba(0,0,0,0.35)"; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke();
      for (let i = 0; i < 26; i++) {
        x.strokeStyle = rnd() > .5 ? streakA : streakB;
        const yy = rnd() * h; x.beginPath(); x.moveTo(px + 2, yy); x.lineTo(px + P - 2, yy + (rnd() - .5) * 30); x.stroke();
      }
    }
  };
  const band = (yy, hh, col) => { x.fillStyle = col; x.fillRect(0, yy, w, hh);
    x.fillStyle = "rgba(255,255,255,0.06)"; x.fillRect(0, yy, w, 3); };
  if (style === "medieval") {
    plank("#6e4a1f", "rgba(40,22,5,0.5)", "rgba(140,95,40,0.25)");
    band(h * 0.12, 44, "#2c2a28"); band(h * 0.5, 44, "#2c2a28"); band(h * 0.86, 44, "#2c2a28");
    x.fillStyle = "#17161a";
    for (let px = 20; px < w; px += 48) for (const yy of [h * 0.12 + 8, h * 0.5 + 8, h * 0.86 + 8]) {
      x.beginPath(); x.arc(px, yy + 14, 7, 0, 7); x.fill(); }
    x.fillStyle = "#3a3733"; x.fillRect(w - 66, h * 0.47, 34, 90); // ring pull plate
    x.strokeStyle = "#d8d3c8"; x.lineWidth = 7;
    x.beginPath(); x.arc(w - 49, h * 0.45, 20, 0, 7); x.stroke();
  } else if (style === "victorian_iron") {
    x.fillStyle = "#1c1b1a"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#111"; x.lineWidth = 14;
    for (let px = 30; px < w; px += 52) { x.beginPath(); x.moveTo(px, 40); x.lineTo(px, h - 30); x.stroke(); }
    band(30, 26, "#26241f"); band(h * 0.45, 26, "#26241f"); band(h - 56, 26, "#26241f");
    x.fillStyle = "#2e2b26";
    for (let px = 30; px < w; px += 52) for (const yy of [h * 0.45 + 2, h * 0.45 + 24])
      { x.beginPath(); x.arc(px, yy, 8, 0, 7); x.fill(); }
    x.strokeStyle = "#33302a"; x.lineWidth = 6;                 // spear tips
    for (let px = 30; px < w; px += 52) { x.beginPath(); x.moveTo(px, 40); x.lineTo(px, 8); x.stroke(); }
    noise(x, w, 12, 0.4);
  } else if (style === "rustic_pine") {
    plank("#a8853e", "rgba(80,55,15,0.45)", "rgba(230,200,120,0.2)");
    band(h * 0.2, 30, "#8a6b2c"); band(h * 0.78, 30, "#8a6b2c");
    x.fillStyle = "#2c2418"; x.beginPath(); x.arc(w - 52, h * 0.5, 16, 0, 7); x.fill();
    x.fillStyle = "#c9b28a"; x.beginPath(); x.arc(w - 52, h * 0.5, 8, 0, 7); x.fill();
  } else if (style === "industrial_wood") {
    plank("#7a6a44", "rgba(45,38,20,0.5)", "rgba(180,160,110,0.18)");
    x.fillStyle = "rgba(30,26,16,0.85)";                        // cross bracing Z
    x.fillRect(0, h * 0.14, w, 26); x.fillRect(0, h * 0.8, w, 26);
    x.save(); x.translate(w / 2, h / 2); x.rotate(0.55); x.fillRect(-w, 0, w * 2, 24); x.restore();
    x.fillStyle = "#1f1d18"; x.fillRect(w - 78, h * 0.47, 44, 12); // bar latch
  } else { // metal_fire
    x.fillStyle = "#b8bcae"; x.fillRect(0, 0, w, h);
    noise(x, w, 10, 0.3);
    x.strokeStyle = "rgba(40,44,38,0.6)"; x.lineWidth = 8;
    x.strokeRect(26, 26, w - 52, h - 52);
    x.strokeRect(58, 58, w - 116, h * 0.36);
    x.strokeRect(58, h * 0.52, w - 116, h * 0.36);
    band(h * 0.46, 34, "#8d9184");                              // push bar rail
    x.fillStyle = "#6f736a"; x.fillRect(40, h * 0.47, w - 80, 22);
    blobs(x, w, 10, (a) => `rgba(70,60,30,${a})`, 20, 90);      // rust bleed
    x.fillStyle = "#c23b2e"; x.fillRect(w * 0.28, h * 0.08, w * 0.44, 60); // exit plate
    x.fillStyle = "#fff"; x.font = "bold 34px sans-serif"; x.textAlign = "center";
    x.fillText("EXIT", w / 2, h * 0.08 + 42);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// out-of-place retro wall poster (video ref: the pirate poster — the one
// "safe threat" that implies the space once had occupants)
export function posterTexture(variant = 0) {
  const c = cv(512); c.height = 680;
  const x = c.getContext("2d");
  x.fillStyle = "#d9b23a"; x.fillRect(0, 0, 512, 680);           // aged paper
  x.fillStyle = "rgba(60,45,10,0.25)"; x.fillRect(0, 640, 512, 40); // burn bottom
  x.strokeStyle = "#241c08"; x.lineWidth = 10; x.strokeRect(22, 22, 468, 636);
  if (variant % 3 === 0) {                                        // grinning captain
    x.fillStyle = "#1d1508";
    x.beginPath(); x.arc(256, 280, 150, 0, 7); x.fill();          // face
    x.fillRect(106, 105, 300, 60);                                // hat brim
    x.fillRect(156, 50, 200, 60);                                 // hat crown
    x.fillStyle = "#e8d9a0";                                      // eyes
    x.beginPath(); x.arc(200, 255, 26, 0, 7); x.arc(312, 255, 26, 0, 7); x.fill();
    x.fillStyle = "#111";
    x.beginPath(); x.arc(206, 260, 9, 0, 7); x.arc(306, 260, 9, 0, 7); x.fill();
    x.strokeStyle = "#e8d9a0"; x.lineWidth = 12;                  // grin
    x.beginPath(); x.arc(256, 300, 78, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke();
    x.fillStyle = "#c33"; x.font = "bold 64px serif"; x.textAlign = "center";
    x.fillText("ARRR!", 256, 560);
  } else if (variant % 3 === 1) {                                 // safety first smiley
    x.fillStyle = "#f4d03f";
    x.beginPath(); x.arc(256, 300, 170, 0, 7); x.fill();
    x.fillStyle = "#111";
    x.beginPath(); x.arc(196, 250, 22, 0, 7); x.arc(316, 250, 22, 0, 7); x.fill();
    x.strokeStyle = "#111"; x.lineWidth = 16;
    x.beginPath(); x.arc(256, 300, 100, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
    x.fillStyle = "#7a1010"; x.font = "bold 58px sans-serif"; x.textAlign = "center";
    x.fillText("SAFETY FIRST", 256, 590);
  } else {                                                        // staff notice
    x.fillStyle = "#1d1508"; x.font = "bold 44px serif"; x.textAlign = "center";
    x.fillText("STAFF ONLY", 256, 110);
    x.font = "30px serif";
    x.fillText("Level 0 — maintain", 256, 200);
    x.fillText("moisture at 43%", 256, 250);
    x.fillText("Do NOT switch off", 256, 330);
    x.fillText("the lights.", 256, 380);
    x.font = "italic 26px serif";
    x.fillText("(they will not thank you)", 256, 500);
  }
  noise(x, 512, 40, 0.7);                                          // aged grain
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function signTexture() {  const c = cv(512); c.height = 160;
  const x = c.getContext("2d");
  x.fillStyle = "#160404"; x.fillRect(0, 0, 512, 160);
  x.shadowColor = "#ff2418"; x.shadowBlur = 34;
  x.fillStyle = "#ff5040"; x.font = "bold 96px sans-serif"; x.textAlign = "center";
  x.fillText("EXIT", 256, 116);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
