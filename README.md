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

Each act is a floor with its own purge countdown; riding the lift up is a checkpoint. Running out of
time restarts only the stage in hand (see *The clock* below).

| Act | Floor | Stages |
| --- | ----- | ------ |
| I (28 min) | Lobby | **L1** classify CCTV feeds from raw motion, thermal and audio readings, using sensor rules pieced together from the L1 sign and three lobby staff; two rounds (fragment LUMEN) · **L2** three escalating cipher logs: a Caesar wheel by frequency analysis, one where E isn't the commonest letter and word shapes give the key, then a four-wheel keyword cipher keyed with a name found in the lobby (ORION) · **L3** program ECHO's command queue over four levels: laser-gate timing, pressure plates that flip the doors, no spare slots · service lift |
| II (22 min) | Research floor | **R1** rotate conduits to restore power · **R2** tune HALCYON's carrier: copy a wave, pick HALCYON's voice out of its sum with ECHO's (opposite phases subtract), then answer a sentinel handshake from rules found on the floor, with ▲/▼/✓ marks per try · **R3** sokoban coolant bays (AURORA) · core lift |
| III (12 min) | The core | **C1** firewall run — an action sequence steering a packet through closing gates · **UPLINK** three locks, one per code word, each a twist on an earlier puzzle (see below), then decide ECHO's fate |

The HUD's UPLINK CODE cell names each fragment by the stage it came from (◆L1 ◆L2 ◆R3) and only
spells a word once the uplink accepts it.

### The uplink

HALCYON puts a lock on every word of the code, and each one asks you to use something you learned
on the way up, bent by one new rule:

- **LUMEN** — four console cameras (you, a cleanbot, a sentinel, a server rack), one sensor jammed
  on each and every thermal reading pushed up by the same few degrees, so nobody reads 36–37C.
  Find yourself with L1's motion and sound rules; HALCYON warns that its cleanbot moves as slowly
  as you do. Boards are random per visit and only kept if exactly one feed can be you.
- **ORION** — HALCYON's key phrase on L2's cipher wheel with a new key and no live decode. It has
  no E, so frequency analysis fails; the crib is the fragment it names: find the five-letter word
  whose first and fourth letters match, and turn the wheel until it reads ORION.
- **AURORA** — six commands, one per letter, and ECHO must reach the socket on exactly the sixth,
  through L3's alternating gates. Working backwards rules out the short way (its B gate would be
  live on step 5) and puts the long way's single wait in the only place that works.

**L1 in detail.** Each camera feed shows neutral readings: MOTION (`periodic 0.27 Hz`, `aperiodic`,
`none`), THERMAL in °C and AUDIO (`quiet`, `voiced, irregular`, `voiced, looped 6s`, `tonal 120 Hz`,
`impulsive`, `broadband`). Survivors, hostiles, cleanbots, machinery and empty rooms share values on
every channel, so no single reading decides a feed. The rules come from the L1 sign, the intern, the
janitor and the analyst, each covering two kinds of feed; `Tab` in the puzzle shows the ones you have
heard. Round 1 has 6 feeds; round 2 has 9, adding machinery and quiet look-alikes that only
temperature separates. The briefing states how many survivors and hostiles to mark; a miscount costs
10 s and wrong targets 30 s.

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
| Interact / cycle tag / wait (L3, AURORA) | `Space` / `E` |
| Reset a floor puzzle (hold)       | `E`                 |
| Submit / run (inside a sector)    | `Enter`             |
| Field notes (L1: the rules you've been told) | `Tab`  |
| Undo (L3/AURORA command, R3 move); hold to clear the L3 queue | `Backspace` |
| Pause / close dialog / exit sector (pauses the C1 run) | `Esc` |
| Flashlight on/off                 | `F`                 |
| Hint from ECHO (in puzzles/battles) | `H`               |
| Sound on/off                      | `M`                 |

Progress (sectors, score, remaining containment time) autosaves to `localStorage`; pick
**CONTINUE** on the title screen to resume. If the containment timer hits `00:00`, see below.

### The clock

One rule: **the purge clock only runs while you can act** — walking the floor, or working a puzzle
(the C1 run, the locks, the safes). Everything you read stops it: conversations, the start menu, the
L1 briefing and field notes, HALCYON's lock briefs at the uplink, and ECHO's hints. Overlays that stop
the clock say *‖ CLOCK PAUSED* and hide the puzzle behind them, so reading can't be used to solve for
free; the HUD timer turns into *‖ PAUSED* whenever it isn't ticking. Battles freeze it too. The game
also pauses (and saves) when the window loses focus or the tab is hidden, and `Esc` mid-run in C1
pauses the run with RESUME / LEAVE THE RUN. ECHO's 30 s gap between stronger hints counts only time
spent in the puzzle itself, not in the hint overlay or a pause.

Act clocks (×1.6 Story, ×0.75 Hard) are 28 / 22 / 12 min, tuned to the blind playtest: a zero-fail
run used about 17 of Act I's old 25 minutes, and Act III never pressured anyone at 15.

**Timeout.** GAME OVER restarts the *stage you were on* from the floor's start. Stages cleared since
the lift stay cleared, and so do your logs, items, cells and catches. The clock refills to the
remaining stages' share of the act ×1.25 (at least 3 min, at most the full act): on Normal, timing out
in R3 retries it with 09:10. When stages were cleared this act, GAME OVER also offers RESTART ACT
(the old full reset with the full clock). The save on disk already holds the stage retry when the
screen appears, so reloading can't dodge it.

## Languages

English and **Swedish (svenska)**. The game picks Swedish automatically when the browser is set to
Swedish; switch any time under LANGUAGE on the title screen or in OPTIONS. All dialogue, logs,
menus, puzzles and HALCYON's lines are translated (`src/i18n/`); the L2 cipher logs stay English on
purpose, since that puzzle is built on English letter frequency and word shapes. `LANG_UNDER_TEST=sv` runs the
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
- **Data capsules** — glinting capsules hide nine data logs (three per floor) and backup cells; three
  more logs, ECHO's memories, are locked in the safes.
- **Escape-room safes** — every floor has a four-digit safe with a note on its dial saying what the
  code is made of. No single clue gives it away: the pieces are spread over that floor's signs,
  terminals and data logs and must be combined. Lobby: four screens froze when HALCYON killed them;
  take the last digit of each clock in the order they died (mind midnight). Research floor: Kofi
  reshuffled the old code from the plaque under three rules found in three places. Core: the minute
  HALCYON first spoke, worked out from its boot log and a memory-log offset. Each safe holds a
  backup cell (+90 s) and an ECHO memory, a data log found nowhere else. A wrong code costs 5 s;
  ECHO's hints go from where to look, to how to combine, to nearly the answer.
- **Floor puzzles** — each floor hides one optional, Pokémon-gym-style room built into the map
  itself, guarding a spare backup cell. A sign at the door states the rules; the room is shielded,
  so sentinels never see in. Solved rooms stay solved in the save (`wp-*` ids).
  - *Lobby, B1 laser grid* (east door off the south corridor): magenta and cyan gates swap on
    every step a floor sensor feels. Walk into a gate while it is lit — it goes dark as you step
    in. Walking around never changes the beat you return with, so the two cracked panels (which
    skip a beat) are the only way through, in the right order. A zap costs time and sends you back
    to the start pad; leaving the room resets the beat.
  - *Research, cold store* (east door off the server room): coolant iced the floor, so a pushed
    canister slides until something stops it — vents don't. Cap all three vents to unseal the
    inner store. The yellow pad, or holding `E` in the room, recalls the canisters.
  - *Core, memory lattice* (east of the pillar hall): one stroke from the entry socket over every
    panel exactly once, ending on the vault socket. Spent panels won't take a second step; corner
    and pillar-pinched panels force most of the trace. Hold `E` or step off to clear it.
  Rules live in `src/world/puzzle-rules.js` (shared with the solver); the live rooms in
  `src/world/floor-puzzles.js`.
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
