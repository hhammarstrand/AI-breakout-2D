# BLACKOUT // Operation Lifeline — 2D

A top-down 2D variant of [AI-breakout](https://hhammarstrand.github.io/AI-breakout/). Same universe (an
infected smart-building you escape with help from AI tools), but you walk a character through the world
Pokémon-style instead of typing terminal commands.

This first iteration is a **skeleton**: movement, tile-map, camera, and a dialog scaffold — no puzzles
wired up yet. The four locked doors in the lobby are placeholders for the original game's four levels.

## Run locally

ES modules require a real HTTP server. From the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any other static server works too (`npx serve`, `caddy file-server`, etc.).

## Controls

| Action      | Key                 |
| ----------- | ------------------- |
| Move        | `WASD` / arrow keys |
| Interact    | `Space` / `E`       |
| Pause/close | `Esc`               |

## Deploying to GitHub Pages

The repo root already contains `index.html`, so Pages can serve it directly:

1. Push to `main` (or merge the working branch into it).
2. Repo → Settings → Pages → **Source: Deploy from a branch** → branch `main`, folder `/`.
3. Pages publishes at `https://<user>.github.io/<repo>/`.

No build step, no dependencies.

## Project layout

```
index.html              entry point
style.css               CRT theme + layout
src/
  main.js               bootstraps the game
  engine/               loop, input, camera, canvas helpers
  world/                tilemap + map data
  entities/             player, npc
  scenes/               title, world
  ui/                   dialog, hud
```

## Future iterations

- Wire the four locked doors to puzzle scenes mirroring the original game's levels (sensors, ciphers,
  pathfinding, breach).
- LocalStorage progress (`src/state.js`).
- Real pixel-art sprites under `assets/`.
- Audio + SFX toggle.
- Lose condition when the containment timer hits 0.
