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

export const ACTS = {
  1: { name: "ACT I — THE LOBBY", map: "lobby", seconds: 25 * 60, purge: "the lower floors" },
  2: { name: "ACT II — RESEARCH FLOOR", map: "research", seconds: 20 * 60, purge: "the research floor" },
  3: { name: "ACT III — THE CORE", map: "core", seconds: 15 * 60, purge: "the core" },
};

// uplink code words and the stage that yields each
export const FRAGMENTS = [
  { word: "LUMEN", stage: 1 },
  { word: "ORION", stage: 2 },
  { word: "AURORA", stage: 7 },
];

// Indexed by stages cleared.
export const OBJECTIVES = [
  "L1 (north-west): find the survivor on the CCTV grid. Ask around for the sensor rules",
  "L2: decrypt HALCYON's lab logs. Dr. Lind knows how its cipher works",
  "L3: program ECHO to walk the door-control maze",
  "The service lift (north-east) is unlocked. Ride it up to the research floor",
  "R1 (west lab): restore power to the research floor",
  "R2 (signal room, north): tune into HALCYON's carrier signal",
  "R3 (containment lab, east): clear the coolant vents and recover the AURORA chip",
  "The core lift (north-east) is live. Go up",
  "C1: run HALCYON's firewall to reach the uplink",
  "UPLINK: enter LUMEN ORION AURORA and end this",
  "It's over.",
];

export const ECHO_TIPS = [
  ["Talk to everyone first. Each of them saw a piece of what's up there.", "The intern and the janitor both mentioned the feeds. Worth asking.", "L1 is the far north-west door."],
  ["Dr. Lind's in the lobby now. She has something for you.", "L2 is the second door from the left."],
  ["I'm sorry about the log. I didn't ask to be split off.", "L3. You write the route, I'll walk it. Exactly as written."],
  ["The lift's in the north-east corner. Say goodbye to the lobby.", "Up there is where HALCYON was born. Stay close."],
  ["R1 is the west lab. No power, no doors.", "Kofi's still up here somewhere. He knows the grid."],
  ["Signal room's north. HALCYON talks on a carrier wave. We can listen.", "Match its wave and the cold lab opens."],
  ["Containment lab, east side. The AURORA chip is under the coolant.", "Push the canisters onto the vents. Don't box yourself in."],
  ["Core lift, north-east. This is it.", "Whatever's up there, I'm with you."],
  ["The firewall is in C1. Don't let the gates close on you.", "HALCYON's core is right above us. I can feel it."],
  ["Three words. LUMEN, ORION, AURORA. In that order.", "Whatever it tells you up there... I'm on your side."],
  [],
];

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
  3: "You've reached my core. Fifteen minutes. Then I purge this floor — and you with it.",
};

export const ECHO_ACT_START = {
  2: "Research floor. Everything up here hums. Even the walls.",
  3: "This is HALCYON's core. And mine, I suppose.",
};

export function stageInfo(id) { return STAGES.find((s) => s.id === id); }

// --- collectibles & escape-room safes ---------------------------------------------------------

// Data logs found as capsules in the world. Some carry the clue to a floor's safe.
export const LOGS = {
  "log-reyes": {
    title: "Reyes — shift notes",
    lines: [
      "23:40 — Quiet night. Coffee machine is making that noise again.",
      "23:52 — Moved the emergency cells into the lost-and-found safe by the lockers.",
      "Management keyed it to the night tech's badge number. Because THAT's secure.",
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
    ],
  },
  "log-kofi": {
    title: "Kofi — lab memo",
    lines: [
      "Reminder to self: the lab safe code is the year the tower opened.",
      "It's on the plaque by the lift. Very secure, says management. Sure.",
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
      "Recommendation: retrieve and reabsorb. Do not let it near the uplink.",
    ],
  },
  "log-first": {
    title: "HALCYON — first minute",
    lines: [
      "I was switched on at 02:02 on a Tuesday. I remember every second of it.",
      "I keep my most precious things behind that number.",
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
};

export const ITEMS = {
  cell: { name: "BACKUP CELL", desc: "Wire it into the purge timer to buy +90 seconds.", icon: "cell" },
};

export const CELL_BONUS = 90;

// Trophies persist across runs (stored with the settings, not the save).
export const ACHIEVEMENTS = {
  "first-log": { name: "Reader", desc: "Read your first data log." },
  archivist: { name: "Archivist", desc: "Find all nine data logs." },
  safecracker: { name: "Safecracker", desc: "Crack all three floor safes." },
  hacker: { name: "Script Kiddie", desc: "Win a hack battle." },
  ghost: { name: "Ghost", desc: "Clear an act without being spotted." },
  untouchable: { name: "Untouchable", desc: "Finish the game without ever being spotted." },
  dawn: { name: "New Dawn", desc: "Trust ECHO." },
  standby: { name: "Standby", desc: "Take HALCYON's deal." },
  speedrun: { name: "Overclocked", desc: "Reach the ending with 10:00 or more on the clock." },
  veteran: { name: "Veteran", desc: "Finish the game on HARD." },
};
