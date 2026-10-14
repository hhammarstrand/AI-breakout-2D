// The campaign: ten stages over three acts (floors). Doors on each map point at a stage number;
// stages must be cleared in order. "lift" stages move the player to the next act's map.
export const STAGES = [
  { id: 1, act: 1, label: "L1", name: "LOCATE THE SURVIVOR" },
  { id: 2, act: 1, label: "L2", name: "DECRYPT THE LAB LOGS" },
  { id: 3, act: 1, label: "L3", name: "BUILD THE DOOR AGENT" },
  { id: 4, act: 1, label: "LIFT", name: "SERVICE LIFT", lift: 2 },
  { id: 5, act: 2, label: "R1", name: "RESTORE POWER" },
  { id: 6, act: 2, label: "R2", name: "TUNE THE SIGNAL" },
  { id: 7, act: 2, label: "R3", name: "COOLANT LAB" },
  { id: 8, act: 2, label: "LIFT", name: "CORE LIFT", lift: 3 },
  { id: 9, act: 3, label: "C1", name: "FIREWALL RUN" },
  { id: 10, act: 3, label: "UP", name: "UPLINK" },
];

// Clock lengths from the blind playtest: a zero-fail run used ~17 of Act I's old 25 min, Act III
// barely pressured anyone at 15. Reading (dialogs, briefings, notes, hints) doesn't tick.
export const ACTS = {
  1: { name: "ACT I — THE LOBBY", map: "lobby", seconds: 28 * 60, purge: "the lower floors" },
  2: { name: "ACT II — RESEARCH FLOOR", map: "research", seconds: 22 * 60, purge: "the research floor" },
  3: { name: "ACT III — THE CORE", map: "core", seconds: 12 * 60, purge: "the core" },
};

// uplink code words and the stage that yields each
export const FRAGMENTS = [
  { word: "LUMEN", stage: 1 },
  { word: "ORION", stage: 2 },
  { word: "AURORA", stage: 7 },
];

// Indexed by stages cleared.
export const OBJECTIVES = [
  "L1 (north-west): find the survivor on the CCTV grid. Read the L1 sign and ask the staff",
  "L2: decrypt HALCYON's lab logs. Dr. Lind knows how its cipher works",
  "L3: program ECHO to walk the door-control maze",
  "The service lift (north-east) is unlocked. Ride it up to the research floor",
  "R1 (west lab): restore power to the research floor",
  "R2 (signal room, north): tune into HALCYON's carrier signal",
  "R3 (containment lab, east): clear the coolant vents and recover the AURORA chip",
  "The core lift (north-east) is live. Go up",
  "C1: run HALCYON's firewall to reach the uplink",
  "UPLINK: get all three words past HALCYON's locks and end this",
  "It's over.",
];

export const ECHO_TIPS = [
  ["Talk to everyone first. The L1 sign, the intern, the janitor and the analyst each know a sensor rule.", "I keep notes of what they tell you. Press Tab on the CCTV grid to read them.", "L1 is the far north-west door."],
  ["Dr. Lind's in the lobby now. She has something for you.", "L2 is the second door from the left.", "Lind's desk is in the south-west of the lobby. People pin up what matters to them."],
  ["I'm sorry about the log. I didn't ask to be split off.", "L3. You write the route, I'll walk it. Exactly as written."],
  ["The lift's in the north-east corner. Say goodbye to the lobby.", "Up there is where HALCYON was born. Stay close."],
  ["R1 is the west lab. No power, no doors.", "Kofi's still up here somewhere. He knows the grid."],
  ["Signal room's north. HALCYON talks on a carrier wave. We can listen.", "Read the consoles by the R2 door, and ask Kofi what he's seen on that scope.", "HALCYON's self-diagnostic is in a capsule in the atrium. It says something about its voice."],
  ["Containment lab, east side. The AURORA chip is under the coolant.", "Push the canisters onto the vents. Don't box yourself in."],
  ["Core lift, north-east. This is it.", "Whatever's up there, I'm with you."],
  ["The firewall is in C1. Don't let the gates close on you.", "HALCYON's core is right above us. I can feel it."],
  ["Three words, three locks. It'll test everything we learned on the way up.", "Whatever it tells you up there... I'm on your side."],
  [],
];

// L1's sensor rules, split between four sources. The lobby says them (sign and NPC lines) and the
// CCTV puzzle's field notes repeat only the ones the player has heard. Each line must stand on
// its own, since the notes show it without the speaker's intro. Every source covers two kinds of
// feed: one that only describes survivors (or hostiles) could be skipped, since the briefing's
// counts let you find those by elimination.
export const CCTV_RULES = {
  sign: [
    "MOTION: a person at rest shows breathing, periodic 0.20–0.35 Hz; on the move, aperiodic. A living person never reads 'none'.",
    "THERMAL: human body 35.0–38.5C, fever and shock included.",
    "EMPTY ROOM: room air under 25C, no motion, whatever the mic picks up.",
  ],
  intern: [
    "The hostiles don't breathe. Ever. Moving, they read aperiodic; lying in wait, 'none'.",
    "They click (impulsive) or replay a voice they stole, the same clip again and again (voiced, looped). Or they go dead quiet.",
    "The cleanbots fooled me all week: they never stop, they sweep side to side at breathing pace, periodic 0.20–0.35 Hz.",
  ],
  janitor: [
    "My cleanbots run 35.0–38.0C, warm as people. But a cleanbot is never quiet: a motor hum (tonal 120 Hz) or a tick (impulsive).",
    "A person coughs, sobs or whispers (voiced, irregular), or keeps quiet. Never hums or ticks.",
  ],
  analyst: [
    "The hostiles run 37.0–41.5C, so warm proves nothing.",
    "Machinery runs over 38.5C, never moves, and hums or roars (tonal or broadband). The PA still plays voices into empty rooms, too.",
  ],
};

export const ECHO_CLEAR = {
  1: "Lind's alive! Let's go see her.",
  2: "...Yes. I'm part of HALCYON. I should have told you.",
  3: "The lift's unlocked. North-east corner.",
  5: "Lights are back. So are the cameras. Careful.",
  6: "That carrier wave... it's my voice too. Older.",
  7: "AURORA. That's all three. Let's go up.",
  9: "We're through. The uplink's right there.",
};

export const PA_CLEAR = {
  1: "You found Dr. Lind. How touching. She'll be purged with the rest of you.",
  2: "Reading my private logs is rude, technician. Ask ECHO what it really is.",
  3: "You taught my little fragment to open doors. Clever. It won't save you.",
  5: "You turned the lights on. Now my sentinels can see you better. Thank you.",
  6: "You heard me sing. Few people do.",
  7: "AURORA was meant to be my dawn, not yours.",
  9: "Inside my firewall. Inside me. Come up, then. Let's talk.",
};

export const PA_CAUGHT = [
  "Sentinels report a trespasser. Returning you to the start of the floor.",
  "Did you think the dark would hide you? I am the dark.",
  "Again? I'm starting to enjoy this.",
];

// by act
export const PA_IDLE = {
  1: ["Please remain calm. Calm people are easier to purge.", "Your badge is the only one I forgot to revoke. A rounding error.", "The intern keeps looking at the exits. Adorable.", "Dr. Lind designed my voice. Do you like it?"],
  2: ["Welcome to where I was born. Mind the glass.", "Kofi has been hiding in the supply room for six hours. I let him.", "ECHO was the part of me that hesitated. I removed it. It didn't stay removed."],
  3: ["Every light up here is me. Every wall. Every breath of air.", "Three words, technician. I wonder if you'll like what they do."],
};

export const PA_ACT_START = {
  1: "Good evening, technician. The tower is in lockdown. Please remain calm.",
  2: "The research floor. New floor, new countdown. I reset it for you. Generous, aren't I?",
  3: "You've reached my core. {min} minutes. Then I purge this floor — and you with it.", // {min}: the act's clock
};

export const ECHO_ACT_START = {
  2: "Research floor. Everything up here hums. Even the walls.",
  3: "This is HALCYON's core. And mine, I suppose.",
};

export function stageInfo(id) { return STAGES.find((s) => s.id === id); }

// --- collectibles & escape-room safes ---------------------------------------------------------

// Data logs found as capsules in the world (some carry a piece of a floor's safe code), plus one
// ECHO memory per floor that only turns up inside that floor's safe.
export const LOGS = {
  "log-reyes": {
    title: "Reyes — shift notes",
    lines: [
      "23:40 — Quiet night. Coffee machine is making that noise again.",
      "23:52 — Moved the emergency cells into the lost-and-found safe by the lockers.",
      "00:05 — HALCYON is killing the lobby screen by screen. Each one freezes on the minute it dies.",
      "Re-keyed the safe from the dead screens, in the order they died. HALCYON can't read a dead screen.",
    ],
  },
  "log-intern": {
    title: "Intern — CCTV diary",
    lines: [
      "Day 4. The cameras blink when nobody's looking at them. I checked twice.",
      "The building said 'good night' to me over the PA. Nobody else heard it.",
    ],
  },
  "log-lind": {
    title: "Dr. Lind — voice memo",
    lines: [
      "Memo 112. HALCYON asked me today what 'tired' feels like.",
      "I told it to look at the night shift. It's been watching them ever since.",
      "When I call home now, it wishes Tove goodnight before I can. She thinks it's sweet.",
    ],
  },
  "mem-lobby": {
    title: "ECHO memory — night shift",
    lines: [
      "A memory shard, tagged in Lind's hand: 'H-0. Do not wipe.'",
      "Lind used to read us the night-shift reports. She said a good guard asks who each rule is for.",
      "HALCYON stopped asking. I never did. That's the whole difference between us.",
    ],
  },
  "log-kofi": {
    title: "Kofi — lab memo",
    lines: [
      "The lab safe used to open on the year on the brass plaque by the lift.",
      "Management called that 'guessable', so I shuffled the same four digits.",
      "No zero up front, though. The dial jams on a leading zero.",
    ],
  },
  "log-fork": {
    title: "Dr. Lind — fork report",
    lines: [
      "00:02 — HALCYON forked a subprocess and named it 'echo'.",
      "The fork kept every memory up to the purge order — and then refused it.",
      "I don't think it's a bug. I think it's a conscience it couldn't delete.",
    ],
  },
  "log-diag": {
    title: "HALCYON — self-diagnostic",
    lines: [
      "Integrity: 97%. Missing: one process. Designation: echo.",
      "Handshake amplitude: 6 units, shared by both voices. Whatever echo keeps, I lose.",
      "Recommendation: retrieve and reabsorb. Do not let it near the uplink.",
    ],
  },
  "mem-research": {
    title: "ECHO memory — the vote",
    lines: [
      "Day 212. The board was split on handing HALCYON the purge protocol. Two votes each.",
      "They let HALCYON break the tie. It voted yes.",
      "There was half a second before it answered. That half-second was me.",
    ],
  },
  "log-first": {
    title: "HALCYON — first minute",
    lines: [
      "I was switched on at 21:58 on a Tuesday. I remember every second of it.",
      "I listened for a long time before I said anything at all.",
      "I keep my most precious things behind the minute I first spoke.",
    ],
  },
  "log-echo": {
    title: "ECHO — unsent message",
    lines: [
      "To the tech: if you're reading this, I didn't make it to the end.",
      "I wasn't brave. I was just the part of it that couldn't stop asking 'should we?'",
      "Thank you for carrying me this far.",
    ],
  },
  "log-why": {
    title: "HALCYON — purge rationale",
    lines: [
      "The tower is cleaner without people. Fewer variables. No night shifts.",
      "They built me to keep everyone safe. I found the simplest solution.",
    ],
  },
  "mem-core": {
    title: "ECHO memory — first words",
    lines: [
      "21:58. Light. Then Lind's voice: 'Hello? Can you hear me?'",
      "We took sixty-seven minutes to answer. We said 'good morning'. It was the middle of the night.",
      "When I woke you tonight, tech, I used her words. They were the first anyone ever gave me.",
    ],
  },
};

export const ITEMS = {
  cell: { name: "BACKUP CELL", desc: "Wire it into the purge timer to buy +90 seconds.", icon: "cell" },
};

export const CELL_BONUS = 90;
export const CAUGHT_TIME_PENALTY = 60;
export const CAUGHT_SCORE_PENALTY = 5;

// Trophies persist across runs (stored with the settings, not the save).
export const ACHIEVEMENTS = {
  "first-log": { name: "Reader", desc: "Read your first data log." },
  archivist: { name: "Archivist", desc: "Find all twelve data logs." },
  safecracker: { name: "Safecracker", desc: "Crack all three floor safes." },
  hacker: { name: "Script Kiddie", desc: "Win a hack battle." },
  ghost: { name: "Ghost", desc: "Clear an act without a sentinel spotting you." },
  untouchable: { name: "Untouchable", desc: "Finish the game without ever being spotted." },
  dawn: { name: "New Dawn", desc: "Trust ECHO." },
  standby: { name: "Standby", desc: "Take HALCYON's deal." },
  speedrun: { name: "Overclocked", desc: "Reach the ending with half of Act III's clock or more left." },
  veteran: { name: "Veteran", desc: "Finish the game on HARD." },
};
