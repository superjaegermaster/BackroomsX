# backrooms-threejs — Changelog

Port of the macOS Godot Backrooms game (~/Projects/backrooms) to the browser
with three.js + modern post-processing. Deterministic, seeded, offline
(vendored three 0.187.0, procedural textures + WebAudio, zero downloads at runtime).

## JS-M0 — Scaffold (2026-11-21)
- Vendored three@0.187.0 (`three.module.js`, `three.core.js`, postprocessing addons).
- Modules: prng (mulberry32), maze (recursive backtracker), layout (rooms/L-tabs/
  door-links/exit, ported 1:1 from GDScript), textures (procedural canvas: wall,
  carpet, ceiling, 5 door styles, EXIT sign), world (merged geometry, world-space
  UVs, light pool, hinged doors per zone, exit monolith + neon, dust motes),
  audio (WebAudio: hum, hiss, 3D neon buzz, creak, music crossfade), hud
  (DOM + minimap port of map_view.gd), post (UnrealBloom + custom VHS shader:
  amber grade, vignette, scanlines, grain, tape-black lift, chromatic aberration),
  main (renderer, pointer lock, collision, doors, seed chain, REC, flicker).
- Tests: `tests/test_layout.mjs` — determinism, borders, connectivity, door-flush,
  exit reachability; stress 60 seeds OK. Fixed half-integer tab bug (seed 999).

## JS-M1 — Browser bring-up + QA hooks
- Served on :8421; fixed missing three.core.js dependency.
- `window.BR` debug handle; `?seed= &fx= &door= &freemove=` QA params.
- E / V / R keys verified live; screenshots + pixel audit (vignette, 44 scanline
  dips, amber bias); raw scene too dark → lighting tune (PL_INT 22, denser
  panels, exposure 1.35); grade tune (amber mix 0.62, tint, black lift).

## JS-M15 — BackroomsX identity + start menu
- Renamed the browser title and start screen to **BackroomsX**.
- Added a compact found-footage start menu with a BX logo mark, wordmark,
  level identifier, one primary `ENTER LEVEL 0` button and condensed controls.
- Added scanline texture, amber/black menu card, red recording accent and
  keyboard-focus/hover states; respects reduced-motion preferences.
- Start interaction is now bound to the explicit button rather than the whole
  overlay, while preserving pointer lock and audio activation.

## JS-M16 — Door collision alignment
- Removed the full 4m room-side cell blocker previously added for every closed
  door. It could feel like an invisible wall several metres away from the
  rendered doorway.
- Closed doors now collide against a thin plane matching the visible door
  opening; open doors are immediately passable. Solid maze cells retain their
  full-cell collision.
- Added `src/collision.js` and `tests/test_collision.mjs` regression coverage
  for both door orientations, opening span, open-door passage and the former
  full-cell false-positive. `COLLISION TESTS: PASS`.

## JS-M17 — Minimap heading fix
- Fixed a type mismatch where `main.js` passed a scalar yaw into `Hud.drawMap`,
  which expected a forward vector. `fwd.x`/`fwd.z` were therefore undefined,
  producing `NaN` rotation and a pointer that never turned.
- `drawMap` now receives the normalized camera forward vector every frame.
- Added `tests/test_map_arrow.mjs` covering north/east/south/west headings.

## JS-M18 — Solid walls, visible doors and furniture
- Replaced single-sided wall planes with solid 0.22m-thick box segments around
  every exposed maze wall. This removes the paper-thin/triangular wall look and
  gives corridor corners real depth.
- Corrected the non-horizontal hinged-door pivot: its hinge was offset to the
  wrong side, leaving the leaf outside the doorway. Door leaves now span the
  opening correctly and are pulled 8cm toward the corridor to avoid z-fighting
  with the opaque backing.
- Door backings now use the selected procedural door texture, with readable
  emissive framing and a small local warm light so doors remain visible in dark
  corridors.
- Restored seeded room furniture: eight table/chair or filing-cabinet groups
  are placed in sufficiently large rooms. `BR.info().furniture` exposes the
  generated count.
- Fixed HUD room count (`layout.rooms` is an array, not a Set); the HUD now
  reports the actual room total instead of `rooms undefined`.

Reference: youtube.com/watch?v=ucJSZLxFQv8, first minute, measured with ffmpeg
(signalstats per-frame + per-band audio) and vision analysis of a 12-frame montage.
Measured profile: warm cast (V +7), soft contrast, no 60 Hz audio line, flat
low-mid bed ~-30 dB, zero transients in 592 s, REC+timecode-with-frames top-LEFT,
viewfinder corner brackets, milky haze, slow handheld wander, one out-of-place
retro poster as the only event.

Implemented:
- **Room tone bed** (audio.js): brownish noise HP 40 / LP 380 Hz, gain 0.16,
  47 s subliminal swell — matches the measured flat low-mid rumble; hum tones
  reduced 0.055→0.02 (reference has no 60 Hz peak). Flicker surge retuned.
- **REC top-left** with 30 fps frame counter (`REC hh:mm:ss:ff`), blinking dot —
  matches reference format.
- **Camcorder date stamp** bottom-right, seeded per run.
- **Viewfinder corner brackets** at all four corners (CSS).
- **Out-of-place posters** (world.js `_buildPosters` + textures.js
  `posterTexture`): up to 4 per level, seeded sparse placement on real wall
  faces; 3 variants (captain "ARRR!", SAFETY FIRST smiley, STAFF ONLY notice);
  slight self-emissive so they read in dim corridors. `BR.info().posters` +
  `posterPos` exposed for QA.
- **Milky haze**: fog 0.052→0.06. **Pacing**: walk 3.4→3.0, run 6.2→5.2,
  head bob 0.035→0.05 (reference's slow cautious drift).
- QA: `BR.setPos(x,z,yaw)` teleport hook; `tests/find_posters.mjs` locator.
- Verified: zero JS errors, layout tests PASS, poster visible via vision check
  (`docs/shot_m14_poster3.png`), overlay stack confirmed
  (`docs/shot_m14_hud.png`).
- Bug found+fixed during QA: `Hud` constructor lacked `this.stamp` element →
  module-init TypeError (caught via `Page.addScriptToEvaluateOnNewDocument` hook;
  recipe: install hook BEFORE reload to capture module-init errors).
