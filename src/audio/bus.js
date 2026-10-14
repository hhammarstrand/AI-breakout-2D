// Shared audio plumbing per AudioContext, built once and reused by music, SFX and ambience:
// a gentle limiter on the output, one small generated-impulse reverb send, a looping noise
// buffer and a 25% pulse wave. Works the same on an OfflineAudioContext (level checks).

const buses = new WeakMap();

export function bus(ctx) {
  let b = buses.get(ctx);
  if (b) return b;
  // glue + clip guard: music, SFX and ambience can stack up in a busy moment
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -10;
  out.knee.value = 8;
  out.ratio.value = 4;
  out.attack.value = 0.004;
  out.release.value = 0.2;
  out.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 1.6, 2.6);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.5;
  reverb.connect(reverbOut).connect(out);

  const n = Math.floor(ctx.sampleRate * 2);
  const noise = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  // 25% duty pulse: the classic handheld lead timbre
  const H = 24, re = new Float32Array(H), im = new Float32Array(H);
  for (let k = 1; k < H; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  const pulse = ctx.createPeriodicWave(re, im);

  b = { out, reverb, noise, pulse };
  buses.set(ctx, b);
  return b;
}

// Exponentially decaying stereo noise, darkened over time like a small concrete room.
function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const k = 0.15 + 0.8 * x; // more smoothing (darker) further into the tail
      lp += (Math.random() * 2 - 1 - lp) * (1 - k);
      d[i] = lp * Math.pow(1 - x, decay);
    }
  }
  return buf;
}

// ±amount random pitch factor, so repeated sounds never sound identical
export const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;
