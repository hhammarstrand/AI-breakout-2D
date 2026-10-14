// WebGL CRT post-processing: barrel curvature, bloom, chromatic aberration, scanlines,
// aperture-grille mask, vignette, grain and glitch. The 2D canvas stays the source of truth;
// each frame it's uploaded as a texture and drawn through the shader onto a second canvas.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// TAPS and MASK are prepended per GPU (fewer taps, no grille on software renderers)
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float; // texel snapping needs more than fp16 across 480 columns
#else
precision mediump float;
#endif
uniform sampler2D uTex;
uniform vec2 uSrc;
uniform float uTime;
uniform float uGlitch;
uniform float uDanger;
varying vec2 vUv;

// the source is uploaded once with LINEAR filtering; sampling texel centres gives the crisp
// nearest-neighbour picture, sampling anywhere else gives the soft bloom input
vec2 nearest(vec2 uv) { return (floor(uv * uSrc) + 0.5) / uSrc; }

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(5.5, 4.5);
  uv = uv + uv * off * off;
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = curve(vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // glitch: tear random horizontal bands sideways
  float band = floor(uv.y * uSrc.y / 6.0);
  float tear = step(0.82, rand(vec2(band, floor(uTime * 24.0)))) * uGlitch;
  uv.x += (rand(vec2(band, uTime)) - 0.5) * 0.12 * tear;
  // constant subtle wobble line rolling down the tube
  float roll = smoothstep(0.0, 0.02, abs(fract(uv.y - uTime * 0.08) - 0.5));
  uv.x += (1.0 - roll) * 0.0015;

  vec2 dir = uv - 0.5;
  float ca = 0.0015 + 0.012 * uGlitch + 0.004 * dot(dir, dir);
  vec3 col;
  col.r = texture2D(uTex, nearest(uv + dir * ca)).r;
  col.g = texture2D(uTex, nearest(uv)).g;
  col.b = texture2D(uTex, nearest(uv - dir * ca)).b;

  // bloom: ring-sampled bright pass. Only near-white/neon light glows, and gently, so dark text
  // on the light UI panels keeps its contrast.
  vec3 bloom = vec3(0.0);
  vec2 px = 1.0 / uSrc;
  for (int i = 0; i < TAPS; i++) {
    float a = float(i) * 6.2832 / float(TAPS);
    vec2 d = vec2(cos(a), sin(a)) * px;
    bloom += max(texture2D(uTex, uv + d * 2.0).rgb - 0.8, 0.0);
    bloom += max(texture2D(uTex, uv + d * 5.0).rgb - 0.8, 0.0) * 0.6;
  }
  col += bloom / float(TAPS) * 0.4;

  // scanlines locked to source rows; a soft cosine profile, so fractional scales don't beat
  // into moire bands across the light panels
  float f = fract(uv.y * uSrc.y);
  col *= mix(0.74, 1.08, 0.5 - 0.5 * cos(f * 6.2832));

  // aperture grille: a soft RGB phase per source column, so it never beats against the
  // device pixel grid (no moire at fractional scales)
#if MASK
  float ph = fract(uv.x * uSrc.x) * 6.2832;
  col *= vec3(1.0) + 0.07 * cos(vec3(ph, ph - 2.0944, ph + 2.0944));
#endif
  col *= 1.06;

  // vignette + flicker + grain
  float vig = pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.22);
  col *= vig;
  col *= 0.975 + 0.025 * sin(uTime * 120.0);
  col += (rand(uv * (uTime + 1.0)) - 0.5) * (0.035 + 0.15 * uGlitch);

  // danger: red bleed from the edges
  col.r += uDanger * (1.0 - vig) * 0.9;

  gl_FragColor = vec4(col, 1.0);
}`;

export class PostFx {
  constructor(source) {
    this.source = source;
    this.enabled = false;
    this.wanted = false;
    this.lost = false;
    this.glitch = 0;
    this.danger = 0;
    const canvas = document.createElement("canvas");
    canvas.id = "screen";
    canvas.setAttribute("aria-hidden", "true");
    let gl = null;
    try { gl = canvas.getContext("webgl", { antialias: false, alpha: false }); } catch { gl = null; }
    // software rasterisers (SwiftShader, llvmpipe) can't afford the full shader at device size
    this.software = !!gl && /swiftshader|llvmpipe|software|basic render/i.test(rendererName(gl));
    this.ok = !!gl && this._init(gl);
    if (!this.ok) return;
    this.canvas = canvas;
    this.gl = gl;
    // A GPU reset or a backgrounded mobile tab drops the context. Show the plain 2D canvas until
    // the browser hands it back, instead of a black screen.
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); // without this the context is never restored
      this.lost = true;
      this._apply();
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
      this.ok = this._init(gl);
      if (this.ok) this._resize();
      this._apply();
    });
    source.after(canvas);
    this._resize();
    new ResizeObserver(() => this._resize()).observe(source.parentElement);
  }

  _init(gl) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const defs = this.software ? "#define TAPS 6\n#define MASK 0\n" : "#define TAPS 12\n#define MASK 1\n";
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, defs + FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // one texture, uploaded once per frame (it used to be uploaded twice, NEAREST and LINEAR)
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = tex;
    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
    gl.uniform2f(gl.getUniformLocation(prog, "uSrc"), this.source.width, this.source.height);
    this.uTime = gl.getUniformLocation(prog, "uTime");
    this.uGlitch = gl.getUniformLocation(prog, "uGlitch");
    this.uDanger = gl.getUniformLocation(prog, "uDanger");
    return true;
  }

  // Keep the source's 3:2 aspect, letterboxed inside the stage. The backing store is capped at
  // 3x the source (2x on software GL): enough for the scanlines, far fewer fragments on big screens.
  _resize() {
    const parent = this.source.parentElement;
    const aspect = this.source.width / this.source.height;
    const cw = parent.clientWidth, ch = parent.clientHeight;
    const w = Math.max(1, Math.min(cw, ch * aspect));
    const h = w / aspect;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cap = this.source.width * (this.software ? 2 : 3);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.max(1, Math.round(Math.min(w * dpr, cap)));
    this.canvas.height = Math.max(1, Math.round(this.canvas.width / aspect));
    if (!this.lost) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setEnabled(on) {
    this.wanted = on;
    this._apply();
  }

  _apply() {
    this.enabled = this.wanted && this.ok && !this.lost;
    document.body.classList.toggle("postfx", this.enabled);
  }

  kick(amount = 1) { this.glitch = Math.max(this.glitch, amount); }

  render(time, dt) {
    if (!this.enabled) return;
    const gl = this.gl;
    if (gl.isContextLost()) return; // the lost event follows shortly
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
    this.glitch = Math.max(0, this.glitch - dt * 2.2);
    gl.uniform1f(this.uTime, time);
    gl.uniform1f(this.uGlitch, this.glitch);
    gl.uniform1f(this.uDanger, this.danger);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function rendererName(gl) {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
  } catch { return ""; }
}
