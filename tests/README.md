# Browser tests

End-to-end checks driven by Playwright against the static game. Start a server from the repo root
(`python3 -m http.server 8123`), then run any script with Node:

```bash
node tests/campaign.mjs dawn   # all three acts, every stage, ending A (use "standby" for B)
node tests/pokemon.mjs         # grid movement, capsules, safe code lock, start menu
node tests/battle.mjs          # spotted "!" encounter and a full hack battle
node tests/retry.mjs           # real sokoban inputs, game over and checkpoint retry
node tests/mobile.mjs          # emulated phone: D-pad, A/B/START
node tests/intro.mjs           # difficulty menu, opening cinematic, hints, scaled penalties
node tests/trophy.mjs          # achievement unlocks, ending stats, trophy menu
node tests/fuzz.mjs            # random input mashed into every scene type, reports page errors
```

Map sanity check (no browser): every capsule, safe, NPC and door must be reachable from spawn:

```bash
node --experimental-default-type=module tests/maps.mjs
```

Env vars: `BASE` (default `http://localhost:8123/`), `SHOTS` (screenshot dir, default `shots`),
`PW` (path to the playwright package if it isn't resolvable). The game exposes internals on
`window.__blackout` only when loaded with `?debug`.
