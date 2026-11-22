# BackroomsX

A deterministic first-person Backrooms maze built for the browser with three.js.

This is the browser redevelopment of the original macOS Godot prototype. It uses
vendored three.js modules and procedural textures/audio so the game can run
without an npm install or runtime CDN dependency.

## Play in your browser

**[Launch BackroomsX](https://superjaegermaster.github.io/BackroomsX/)**

The link runs the repository's `index.html` through GitHub Pages. The source is
available at [`index.html`](https://github.com/superjaegermaster/BackroomsX/blob/main/index.html).
If Pages has not been enabled yet for the repository, use the local HTTP command
below; opening the file with `file://` will not work because the game uses ES modules.

## Run locally

From this directory:

```bash
python3 -m http.server 8421
```

Open <http://localhost:8421/>.

The browser must use HTTP (not `file://`) because ES modules are loaded locally.

## Controls

- `WASD` — move
- `Shift` — run
- `Space` — jump
- `E` — open a nearby door
- `M` — toggle minimap
- `V` — toggle VHS effects
- `R` — regenerate with the next deterministic seed
- `Esc` — release pointer lock

Click the start screen to capture the mouse. The first interaction also enables
audio in browsers that require a user gesture.

## Features

- Seeded recursive-backtracker maze with reachable rooms and exit
- Hinged, opaque doors styled per zone
- Bloom, amber found-footage grade, vignette, scanlines, grain and chromatic aberration
- REC/timecode overlay, date stamp and viewfinder brackets
- Milky haze and slow handheld-style camera movement
- Seeded wall posters and red EXIT signage
- Procedural WebAudio room tone, neon buzz, door creaks and ambient music
- Minimap and QA hooks

Optional QA parameters:

```text
?seed=20261110&door=1&freemove=1
```

`window.BR.info()` exposes deterministic layout and runtime diagnostics in the
browser console.

## Tests

```bash
node tests/test_layout.mjs
```

The test suite checks determinism, borders, connectivity, wall-flush doors and
exit reachability across multiple seeds.

## Project layout

- `src/` — game, maze/layout generation, world, textures, audio, HUD and post FX
- `vendor/` — vendored three.js and post-processing dependencies
- `assets/audio/` — ambient music tracks
- `docs/changelog.md` — milestone history and reference-video analysis
- `tests/` — deterministic layout and poster QA helpers
