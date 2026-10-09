# BLACKOUT // Operation Lifeline — 2D

A top-down 2D variant of [AI-breakout](https://hhammarstrand.github.io/AI-breakout/). Same universe (an
infected smart-building you escape with help from AI tools), but you walk a character through the world
Pokémon-style instead of typing terminal commands.

**Status:** lobby + sector 1 (Locate the Survivor) playable. Sectors L2–L4 are sealed and unlock as
you clear earlier sectors.

## Run locally

ES modules require a real HTTP server. From the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any other static server works too (`npx serve`, `caddy file-server`, etc.).

## Controls

| Action                            | Key                 |
| --------------------------------- | ------------------- |
| Move / cursor                     | `WASD` / arrow keys |
| Interact / cycle survivor-hostile | `Space` / `E`       |
| Submit (inside a sector)          | `Enter`             |
| Pause / close dialog / exit sector | `Esc`              |
| Sound on/off                      | `M`                 |

Progress (sectors, score, remaining containment time) autosaves to `localStorage`; pick
**CONTINUE** on the title screen to resume. If the containment timer hits `00:00` the run ends.

## Sector 1 — Locate the Survivor

Walk to the cyan **L1** door in the north wall and press `E`. You enter a CCTV control room
with six feeds, randomised on every visit. Read each room's sensor data (motion, thermal, audio)
and tag exactly **one** room as `SURVIVOR` and **three** rooms as `HOSTILE` (`Space` cycles
hostile → survivor → unmarked), then `Enter` to submit. Wrong submissions
cost 2 points; clearing the sector awards 25.

## Deploying to GitHub Pages

A workflow at `.github/workflows/pages.yml` publishes the repo root to Pages on every push to
`main` or the working branch. One-time setup:

1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` or `claude/2d-ai-breakout-game-3DKQc`.
3. Watch the run under **Actions → Deploy to GitHub Pages**.
4. Pages publishes at `https://<user>.github.io/<repo>/`.

You can also trigger the workflow manually from the Actions tab (`workflow_dispatch`).

No build step, no dependencies — the workflow uploads the repo as-is.

## Project layout

```
index.html              entry point
style.css               CRT theme + layout
src/
  main.js               bootstraps the game
  state.js              progress, score, timer + localStorage save
  audio/                WebAudio synth SFX (no asset files)
  engine/               loop, input, camera, canvas helpers
  world/                tilemap + map data
  entities/             player, npc
  scenes/               title, world, pause, game over, sector1
  ui/                   dialog + portraits, hud, toasts, screen fx
```

## Future iterations

- Wire L2 (cipher decryption), L3 (pathfinding agent), and L4 (breach) to their own scenes.
- Real pixel-art sprites under `assets/`.
- Darkness + flashlight cone in the lobby.
- Patrolling hostiles and a companion drone that gives hints.
- Touch controls for mobile.
