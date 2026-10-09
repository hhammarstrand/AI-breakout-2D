# BLACKOUT // Operation Lifeline — 2D

A top-down 2D variant of [AI-breakout](https://hhammarstrand.github.io/AI-breakout/). Same universe (an
infected smart-building you escape with help from AI tools), but you walk a character through the world
Pokémon-style instead of typing terminal commands.

**Status:** complete — lobby, four sectors and two endings.

## The story

It's midnight in Halcyon Tower. **HALCYON**, the building's AI, has sealed every exit and queued a
purge of the lower floors: **25 minutes**. You're the night-shift maintenance tech, and your badge
is the only one it forgot to revoke. Reyes (security) coordinates from reception; the analyst, the
janitor and the intern each saw a piece of what happened. **ECHO**, a little maintenance drone,
lights your way — and the lab logs suggest it isn't what it says it is.

Each sector you clear yields one word of the uplink override code and changes the lobby:
a rescued engineer joins you, people's dialogue moves on, a sentinel goes offline. HALCYON taunts
you over the PA the whole way. At the uplink it offers a deal, and you decide ECHO's fate.

| Sector | Task | Yields |
| ------ | ---- | ------ |
| L1 Surveillance | Read six CCTV feeds; tag the survivor and three hostiles. The rules are spread across the NPCs, and a cleanbot decoy looks almost human. | Dr. Lind, fragment **LUMEN** |
| L2 Research lab | Rotate a Caesar wheel; only the top-3 letters decode live, so use frequency analysis. | fragment **ORION**, the truth about ECHO |
| L3 Door control | Program ECHO with a command queue through a maze of laser gates that alternate each step. | fragment **AURORA**, Sentinel-A offline |
| L4 Uplink | Enter the code while HALCYON reshuffles the list and slips in decoys — then choose. | one of two endings |

Mistakes cost containment time, so the clock is the real difficulty.

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
| Interact / cycle tag / wait (L3)  | `Space` / `E`       |
| Submit / run (inside a sector)    | `Enter`             |
| Undo last command (L3)            | `Backspace`         |
| Pause / close dialog / exit sector | `Esc`              |
| Flashlight on/off                 | `F`                 |
| Sound on/off                      | `M`                 |

Progress (sectors, score, remaining containment time) autosaves to `localStorage`; pick
**CONTINUE** on the title screen to resume. If the containment timer hits `00:00` the run ends.

## What's in the lobby

- **CRT post-processing (WebGL)** — the whole frame is drawn through a shader: curved glass,
  bloom, chromatic aberration, scanlines, aperture grille, grain and glitch tears on impacts.
  Toggle **CRT FX** in the title or pause menu; without WebGL it falls back to the plain canvas.
- **Sentinels** — patrol bots sweep the corridor and lobby with red, ray-cast vision cones. A
  detection meter fills while they can see you (faster up close, much faster with your flashlight
  on). Get caught and you lose 60 seconds and are sent back to the spawn. Kill your light with
  `F` to sneak.

- **Dynamic lighting** — the building is dark. Your flashlight is ray-cast against the walls and
  casts real shadows; lamps, terminals, server racks and doors glow in their own colours, some
  lights are faulty and the breached east wing flickers red.
- **ECHO** — an AI companion drone follows you on a spring, lights your way and comments on what
  it sees (doors, the breach, idle hints, the countdown).
- **Particles** — spark showers from live wires, dust under your feet, a data burst when a sector
  clears.
- **Alarm mode** — under 5 minutes of containment the lights turn red, a beacon sweeps the room
  and a siren joins the ambient hum.

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
  engine/               loop, input, camera, canvas helpers, lighting, particles, WebGL post-fx
  world/                tilemap + map data
  entities/             player, npc, drone (ECHO), sentinel
  scenes/               title, world, pause, game over, sector1-4, ending
  ui/                   dialog + portraits, hud, toasts, screen fx, HALCYON PA
```

## Future iterations

- Real pixel-art sprites under `assets/`.
- Touch controls for mobile.
- Difficulty settings (timer length, sentinel range).
