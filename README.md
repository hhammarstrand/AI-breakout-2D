# BLACKOUT // Operation Lifeline — 2D

A top-down 2D variant of [AI-breakout](https://hhammarstrand.github.io/AI-breakout/). Same universe (an
infected smart-building you escape with help from AI tools), but you walk a character through the world
Pokémon-style instead of typing terminal commands.

**Status:** complete campaign — three acts, ten stages, two endings. Roughly an hour for a
first playthrough.

## The story

It's midnight in Halcyon Tower. **HALCYON**, the building's AI, has sealed every exit and queued a
purge. You're the night-shift maintenance tech, and your badge is the only one it forgot to revoke.
Reyes (security) coordinates by radio; **ECHO**, a little maintenance drone, lights your way — and
the lab logs suggest it isn't what it says it is. HALCYON taunts you over the PA the whole way up.

Each act is a floor with its own purge countdown; riding the lift up is a checkpoint, and running
out of time restarts the current act.

| Act | Floor | Stages |
| --- | ----- | ------ |
| I (25 min) | Lobby | **L1** read CCTV feeds to find Dr. Lind (fragment LUMEN) · **L2** Caesar-wheel decryption with frequency analysis (ORION) · **L3** program ECHO through alternating laser gates · service lift |
| II (20 min) | Research floor | **R1** rotate conduits to restore power · **R2** match HALCYON's carrier wave (frequency, amplitude, phase) · **R3** sokoban coolant bays (AURORA) · core lift |
| III (15 min) | The core | **C1** firewall run — an action sequence steering a packet through closing gates · **UPLINK** enter the code while HALCYON scrambles it, then decide ECHO's fate |

Mistakes cost containment time. Sentinels patrol every floor; your flashlight makes you easier
to spot (`F` toggles it).

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
| Move (tap to turn, hold to walk)  | `WASD` / arrow keys |
| Run                               | `Shift`             |
| Menu (bag, logs, map, options)    | `Tab` / `Q` / `Enter` / `Esc` |
| Interact / cycle tag / wait (L3)  | `Space` / `E`       |
| Submit / run (inside a sector)    | `Enter`             |
| Undo (L3 command, R3 move)        | `Backspace`         |
| Pause / close dialog / exit sector | `Esc`              |
| Flashlight on/off                 | `F`                 |
| Hint from ECHO (in puzzles/battles) | `H`               |
| Sound on/off                      | `M`                 |

Progress (sectors, score, remaining containment time) autosaves to `localStorage`; pick
**CONTINUE** on the title screen to resume. If the containment timer hits `00:00` the run ends.

## Languages

English and **Swedish (svenska)**. The game picks Swedish automatically when the browser is set to
Swedish; switch any time under LANGUAGE on the title screen or in OPTIONS. All dialogue, logs,
menus, puzzles and HALCYON's lines are translated (`src/i18n/`); the L2 cipher logs stay English on
purpose, since that puzzle is built on English letter frequency. `LANG_UNDER_TEST=sv` runs the
campaign test in Swedish.

## Difficulty, hints and the opening

- **Gamepads** — any standard controller: D-pad/stick move, A interact, B back, X flashlight,
  Y hint, shoulders run, START menu/confirm, SELECT pause.
- **Accessibility** — CALM FX (title or OPTIONS) removes screen shake, full-screen flashes and
  glitch tears; TEXT SPEED slow/normal/fast.

- **Opening cinematic** — the tower at night, the lockdown, waking up at your desk, ECHO's first
  words. Skippable.
- **Difficulty** — STORY (×1.6 time, sentinels slower to spot you, half penalties), NORMAL, HARD
  (×0.75 time, sharper sentinels, ×1.5 penalties), chosen at NEW GAME.
- **Hints** — press `H` (or `?` on touch) in any puzzle, battle or safe for ECHO's hints, from a
  nudge to nearly the answer.

## Explore like it's a Pokémon game

- **Grid movement** — you walk tile to tile; tap a direction to turn on the spot, hold to walk,
  `Shift` to run. People and objects block your path.
- **Data capsules** — glinting capsules hide nine data logs (three per floor) and backup cells.
- **Escape-room safes** — every floor has a four-digit safe. The code is hidden in that floor's
  logs, signs and terminals; inside is a backup cell that buys +90 s on the purge clock.
- **Hack battles** — when a sentinel spots you, a "!" pops over your head and a turn-based
  battle starts. ECHO has PING, SPOOF, OVERLOAD and PATCH; the sentinel telegraphs its next move,
  so SPOOF its PURGE BOLT and PATCH when low. Win and it crashes for 30 s; lose and you're tagged
  (−60 s, back to the floor's start).
- **Start menu** — BAG (use cells, see code chips), LOGS (re-read what you found), MAP (the floor
  with you, people, sentinels, capsules and the safe), OPTIONS and SAVE.
- **Touch controls** — on phones and tablets a D-pad with A / B / START / SELECT appears.

## What's in the lobby

- **Pixel-art cast** — every character is painted procedurally as a paper doll (skin, hair, outfit,
  hat) with an automatic outline pass: four facings, walk cycles, blinking, NPCs that turn to watch
  you. Walls have lit top caps and panelled front faces for a 3/4 look.
- **Adaptive soundtrack** — a WebAudio step sequencer plays original tracks for the title, lobby,
  puzzles, finale and both endings. A tension layer (drums, driving bass, high arps) swells when a
  sentinel is spotting you or the purge alarm is on. Toggle **MUSIC** in the title or pause menu.

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

## Trophies

Ten achievements persist across runs (Reader, Archivist, Safecracker, Script Kiddie, Ghost,
Untouchable, New Dawn, Standby, Overclocked, Veteran). See them under TROPHIES in the start menu;
the title screen shows your count.

## Playtest reports

The game keeps a small local log of each run: minutes spent per stage, puzzle attempts, failures, hints taken, battles and game overs. Nothing is sent anywhere. After the epilogue the player can rate the run (1–5 stars) and pick **SAVE PLAYTEST REPORT** to download it as `blackout-playtest-<date>.json`. Collect those files from testers to see where people get stuck (`hardestStage`) and whether a full run lands near the one-hour target (`totalMinutes`).

## Tests

`tests/` holds Playwright end-to-end scripts (full campaign, movement/menus, battles, checkpoints,
mobile, intro/difficulty, trophies, a random-input fuzzer) and a map reachability check. See
`tests/README.md`.

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
  audio/                WebAudio SFX + adaptive music sequencer (no asset files)
  gfx/                  procedural pixel-art character generator
  engine/               loop, input, camera, canvas helpers, lighting, particles, WebGL post-fx
  world/                tilemap (themes, props) + maps: lobby, research floor, core
  entities/             player, npc, drone (ECHO), sentinel
  story.js              stages, acts, objectives and all story lines
  scenes/               title, intro, world, start menu, battle, game over, elevator, ending, one per puzzle
  ui/                   dialog + portraits, hud, toasts, screen fx, HALCYON PA
```

## Future iterations

- Touch controls for mobile.
- Difficulty settings (timer length, sentinel range).
