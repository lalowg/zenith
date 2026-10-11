/* ZENITH — breathing engine + canvas landscape renderer (no dependencies)
   The engine is a time-based state machine: idle → running ⇄ paused → done.
   The renderer paints a lake between two ranges of hills; the sun climbs
   toward the zenith on the in-breath and sinks into the water on the out-breath. */

const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
export const cycleLength = (d) => d[0] + d[1] + d[2] + d[3];

/** Breath fullness (0 = empty, 1 = full) for phase i at progress p. */
export function phaseValue(i, p) {
  if (i === 0) return ease(p);
  if (i === 1) return 1;
  if (i === 2) return 1 - ease(p);
  return 0;
}

/** Breath fullness at time t (seconds) inside one cycle of durations d. */
export function breathAt(d, t) {
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    if (d[i] <= 0) continue;
    if (t < acc + d[i]) return phaseValue(i, (t - acc) / d[i]);
    acc += d[i];
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Paced engine                                                         */
/* ------------------------------------------------------------------ */
export class BreathEngine {
  constructor({ durations, sessionSec, onPhase, onDone }) {
    this.durs = durations.slice();
    this.sessionSec = sessionSec;
    this.onPhase = onPhase || (() => {});
    this.onDone = onDone || (() => {});
    this.reset();
  }

  reset() {
    this.status = 'idle';
    this.elapsed = 0;
    this.phaseIndex = this.firstPhase();
    this.phaseElapsed = 0;
    this.cycle = 0;
    this.finishing = false;
    this.pending = null;
  }

  firstPhase() {
    let i = 0;
    while (i < 3 && this.durs[i] <= 0) i++;
    return i;
  }

  start() {
    if (this.status === 'running') return;
    if (this.status === 'paused') { this.status = 'running'; return; }
    this.reset();
    this.status = 'running';
    this.cycle = 1;
    this.onPhase(this.phaseIndex, this.cycle);
  }

  pause() { if (this.status === 'running') this.status = 'paused'; }
  setSession(sec) { this.sessionSec = sec; }

  /** immediate = restart the cycle now; otherwise apply from the next cycle. */
  setDurations(d, immediate) {
    if (this.status === 'idle' || this.status === 'done') {
      this.durs = d.slice();
      this.pending = null;
      this.phaseIndex = this.firstPhase();
      return;
    }
    if (immediate) {
      this.durs = d.slice();
      this.pending = null;
      this.phaseIndex = this.firstPhase();
      this.phaseElapsed = 0;
      this.cycle++;
      this.onPhase(this.phaseIndex, this.cycle);
    } else {
      this.pending = d.slice();
    }
  }

  advance() {
    let i = this.phaseIndex;
    let guard = 0;
    do {
      i = (i + 1) % 4;
      if (i === 0) {
        this.cycle++;
        if (this.pending) { this.durs = this.pending; this.pending = null; }
      }
    } while (this.durs[i] <= 0 && ++guard < 5);
    this.phaseIndex = i;
  }

  tick(dt) {
    if (this.status !== 'running') return;
    this.elapsed += dt;
    this.phaseElapsed += dt;
    let guard = 0;
    while (this.phaseElapsed >= this.durs[this.phaseIndex] && guard++ < 6) {
      this.phaseElapsed -= this.durs[this.phaseIndex];
      // a session always ends on a completed out-breath
      if (this.finishing && this.phaseIndex === 2) { this.finish(); return; }
      this.advance();
      this.onPhase(this.phaseIndex, this.cycle);
    }
    if (!this.finishing && this.elapsed >= this.sessionSec) {
      this.finishing = true;
      if (this.phaseIndex === 3) this.finish();
    }
  }

  finish() {
    this.status = 'done';
    this.finishing = false;
    this.phaseElapsed = 0;
    this.onDone(this.cycle);
  }

  get phaseDur() { return this.durs[this.phaseIndex]; }
  get phaseRemaining() { return Math.max(0, this.durs[this.phaseIndex] - this.phaseElapsed); }
  get remaining() { return Math.max(0, this.sessionSec - this.elapsed); }
}

/* ------------------------------------------------------------------ */
/* Free breath: the visitor sets the pace by holding a control          */
/* ------------------------------------------------------------------ */
export class FreeBreath {
  constructor({ onBreath } = {}) {
    this.onBreath = onBreath || (() => {});
    this.reset();
  }
  reset() {
    this.held = false;
    this.b = 0;
    this.t = 0;          // seconds in the current movement
    this.phase = 3;      // 0 in, 1 full, 2 out, 3 still
    this.inLen = 0;
    this.breaths = 0;
    this.last = null;    // { inSec, outSec }
    this.started = false;
  }
  press() {
    if (this.held) return;
    if (this.phase === 2 && this.started && this.inLen > 0.4) {
      this.breaths++;
      this.last = { inSec: this.inLen, outSec: this.t };
      this.onBreath(this.last, this.breaths);
    }
    this.held = true; this.started = true; this.t = 0; this.phase = 0;
  }
  release() {
    if (!this.held) return;
    this.held = false;
    this.inLen = this.t;
    this.t = 0;
    this.phase = 2;
  }
  tick(dt) {
    if (!this.started) return;
    this.t += dt;
    // a full in-breath takes about five seconds, a full out-breath about six
    if (this.held) {
      this.b = Math.min(1, this.b + dt / 5);
      this.phase = this.b >= 0.999 ? 1 : 0;
    } else {
      this.b = Math.max(0, this.b - dt / 6);
      if (this.b <= 0.001 && this.phase === 2) {
        this.phase = 3;
        if (this.inLen > 0.4) {
          this.breaths++;
          this.last = { inSec: this.inLen, outSec: this.t };
          this.onBreath(this.last, this.breaths);
          this.inLen = 0;
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                       */
/* ------------------------------------------------------------------ */
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a).toFixed(3)})`;

// Evening keyframes across a session: dusk → afterglow → nightfall  (top, middle, horizon)
const KEYS = [
  ['#3A2F57', '#8C6F9C', '#F6C6A8'],
  ['#2B2440', '#6E5280', '#EBA48E'],
  ['#191630', '#352B4E', '#7C5878'],
].map((k) => k.map(hx));
const NIGHT = ['#0E0C1A', '#1D1A2B', '#3A2F57'].map(hx);
const PEACH = hx('#F6C6A8');
const PALE = hx('#FFF4EC');
const MIST = hx('#E9E4F0');
const DUSK = hx('#2B2440');
const INK = hx('#1D1A2B');
const LILAC = hx('#9C8FB8');
const DEEP = hx('#141222');
const LABELS = ['in', 'hold', 'out', 'rest'];

function keyAt(list, t) {
  const x = clamp(t) * (list.length - 1);
  const i = Math.min(list.length - 2, Math.floor(x));
  return [list[i], list[i + 1], ease(x - i)];
}
export function skyAt(t) {
  const [a, b, k] = keyAt(KEYS, t);
  return [0, 1, 2].map((i) => mix(a[i], b[i], k));
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise with a few octaves. */
function makeNoise(seed) {
  const r = rng(seed);
  const tbl = Array.from({ length: 256 }, () => r());
  const v = (x) => {
    const i = Math.floor(x), f = x - i;
    const a = tbl[i & 255], b = tbl[(i + 1) & 255];
    return a + (b - a) * (f * f * (3 - 2 * f));
  };
  return (x) => (v(x) * 0.55 + v(x * 2.3 + 7) * 0.28 + v(x * 5.1 + 3) * 0.12 + v(x * 11 + 1) * 0.05);
}

// Constellation lit one star per completed breath; the last star sits at the zenith.
const CONSTELLATION = [
  [-0.86, -0.34], [-0.7, -0.58], [-0.5, -0.76], [-0.3, -0.62], [-0.16, -0.88],
  [0.16, -0.9], [0.32, -0.66], [0.52, -0.8], [0.72, -0.56], [0.86, -0.32],
  [0.4, -0.42], [-0.42, -0.4], [0, -1.12],
];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 12], [12, 5], [5, 6], [6, 7], [7, 8], [8, 9], [6, 10], [3, 11]];
export const STAR_COUNT = CONSTELLATION.length;

/* ------------------------------------------------------------------ */
/* Renderer                                                             */
/* ------------------------------------------------------------------ */
export class LandscapeRenderer {
  constructor(canvas, { reduced = false, small = false } = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.c = canvas; this.ctx = ctx;
    this.reduced = reduced;
    this.small = small;
    this.w = 1; this.h = 1; this.dpr = 1;
    this.lay = { cx: 0.5, horizon: 400, R: 200, top: 80 };
    this.s = { b: 0.3, prog: 0, night: 0, tint: 0, wind: 0.4, glow: 0, lit: 0, intro: reduced ? 1 : 0 };
    this.time = 0;
    this.ripples = [];
    this.lastKey = '';
    this.font = '500 11px Karla, sans-serif';
    this.seed();
  }

  seed() {
    const r = rng(1805);
    const n = this.small ? 70 : 150;
    this.stars = Array.from({ length: n }, () => ({ x: r(), y: r(), s: r() < 0.1 ? 1.8 : 0.6 + r() * 0.8, p: r() * TAU, a: 0.3 + r() * 0.7 }));
    const m = this.small ? 24 : 44;
    this.shimmer = Array.from({ length: m }, (_, i) => ({ d: (i + r() * 0.6) / m, w: 0.4 + r() * 0.9, sp: 0.4 + r() * 1.2, ph: r() * TAU, o: 0.4 + r() * 0.6 }));
    this.noises = [makeNoise(11), makeNoise(29), makeNoise(53)];
  }

  resize(w, h, dpr) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    this.lastKey = '';
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    this.buildRidges();
  }

  /** cx: px, horizon: px from top, R: dome radius px, top: highest usable px */
  setLayout(lay) {
    this.lay = lay;
    this.lastKey = '';
    this.buildRidges();
  }

  setFont(f) { this.font = f; this.lastKey = ''; }
  invalidate() { this.lastKey = ''; }
  pulse() { if (!this.reduced) this.ripples.push({ t: 0 }); }
  settling() { return !this.reduced && (this.ripples.length > 0 || this.s.intro < 0.995); }

  buildRidges() {
    const { w } = this;
    const H = this.lay.horizon;
    if (!(H > 10)) return;
    const cxn = this.lay.cx / w;
    // far, middle, near ranges; the valley opens around the sun's meridian
    const spec = [
      { amp: 0.17, open: 0.03, rise: 0.3, freq: 3.2, n: this.noises[0] },
      { amp: 0.24, open: 0.1, rise: 0.32, freq: 2.2, n: this.noises[1] },
      { amp: 0.32, open: 0.2, rise: 0.3, freq: 1.5, n: this.noises[2] },
    ];
    this.ridges = spec.map((sp) => {
      const p = new Path2D();
      const m = new Path2D();
      const step = 4;
      p.moveTo(0, H); m.moveTo(0, H);
      for (let x = 0; x <= w + step; x += step) {
        const xn = x / w;
        const d = Math.abs(xn - cxn);
        const env = ease(clamp((d - sp.open) / sp.rise));
        const nv = sp.n(xn * sp.freq + 4);
        const y = H - H * sp.amp * env * (0.3 + 0.7 * nv) - 1;
        p.lineTo(x, y);
        m.lineTo(x, H + (H - y) * 0.62);
      }
      p.lineTo(w + step, H + 2); p.lineTo(0, H + 2); p.closePath();
      m.lineTo(w + step, H); m.lineTo(0, H); m.closePath();
      return { p, m };
    });
  }

  frame(dt, inp) {
    const s = this.s;
    const k = (tau) => (this.reduced ? 1 : 1 - Math.exp(-dt / tau));
    this.dt = dt;
    if (!this.reduced) this.time += dt;
    s.b = inp.b;
    s.tint += (inp.tint - s.tint) * k(1.1);
    s.prog += (inp.prog - s.prog) * k(1.6);
    s.night += (inp.night - s.night) * k(2.6);
    s.wind += (inp.wind - s.wind) * k(1.2);
    s.glow += (inp.glow - s.glow) * k(0.8);
    s.lit += (inp.lit - s.lit) * k(0.7);
    s.intro += (1 - s.intro) * k(1.1);
    if (this.reduced) {
      const key = [s.b.toFixed(3), inp.phaseIndex, inp.active, s.prog.toFixed(3), s.night.toFixed(2), s.tint.toFixed(2),
        inp.cyclePos.toFixed(3), inp.phaseProgress.toFixed(3), inp.lit, this.w, this.h, inp.durs.join()].join('|');
      if (key === this.lastKey) return s;
      this.lastKey = key;
    }
    for (const rp of this.ripples) rp.t += dt;
    this.ripples = this.ripples.filter((rp) => rp.t < 3.2);
    this.draw(inp);
    return s;
  }

  draw(inp) {
    const { ctx, w, h, s } = this;
    const { cx, horizon: H, R } = this.lay;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const nt = ease(s.night);
    const day = 1 - nt;
    const tp = Math.max(0, s.tint), tn = Math.max(0, -s.tint);
    const intro = ease(s.intro);

    /* sky — warmer and brighter on the in-breath, cooler on the out-breath */
    const sky = skyAt(s.prog).map((c, i) => {
      let m = mix(c, NIGHT[i], nt);
      m = mix(m, i === 2 ? PEACH : MIST, tp * (i === 2 ? 0.16 : 0.06) * day);
      return mix(m, i === 0 ? DUSK : LILAC, tn * 0.12 * day);
    });
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(sky[0]));
    g.addColorStop(0.58, rgba(sky[1]));
    g.addColorStop(1, rgba(sky[2]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H + 1);

    /* stars: they gather as the evening deepens */
    const starA = clamp(s.prog * 0.75 - 0.15) * day + nt;
    if (starA > 0.02) {
      ctx.fillStyle = rgba(MIST);
      for (const st of this.stars) {
        const y = st.y * H * 0.86;
        const fade = 1 - y / H;
        const tw = this.reduced ? 0.85 : 0.6 + 0.4 * Math.sin(this.time * 0.8 + st.p);
        ctx.globalAlpha = clamp(starA * st.a * tw * fade);
        ctx.fillRect(st.x * w, y, st.s, st.s);
      }
      ctx.globalAlpha = 1;
    }

    /* sun on the meridian: half-sunk when empty, at the zenith when full */
    const sunR = Math.max(14, R * 0.085);
    const low = H + sunR * 0.35;
    const high = H - R * 0.8;
    const target = low + (high - low) * s.b;
    const sy = target + (1 - intro) * (H + sunR * 2.2 - target);
    const sunC = mix(mix(PEACH, PALE, s.b), MIST, nt * 0.7);
    const sunA = day * 0.94 + nt * 0.55;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, H); ctx.clip();
    const gr = Math.max(w, H) * (0.34 + 0.08 * s.b + 0.06 * s.glow);
    const sg = ctx.createRadialGradient(cx, sy, 0, cx, sy, gr);
    sg.addColorStop(0, rgba(sunC, 0.75 * sunA));
    sg.addColorStop(0.06, rgba(sunC, (0.42 + 0.2 * s.glow) * sunA));
    sg.addColorStop(0.3, rgba(PEACH, 0.12 * sunA * day));
    sg.addColorStop(1, rgba(PEACH, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, H);
    const disc = ctx.createRadialGradient(cx, sy, sunR * 0.2, cx, sy, sunR);
    disc.addColorStop(0, rgba(PALE, sunA));
    disc.addColorStop(0.85, rgba(sunC, sunA));
    disc.addColorStop(1, rgba(sunC, 0));
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(cx, sy, sunR, 0, TAU); ctx.fill();
    ctx.restore();

    /* haze over the horizon — thickest while the breath is held */
    const hz = ctx.createLinearGradient(0, H - R * 0.35, 0, H + 8);
    hz.addColorStop(0, rgba(sky[2], 0));
    hz.addColorStop(1, rgba(sky[2], (0.28 + 0.3 * s.glow) * day + 0.1 * nt));
    ctx.fillStyle = hz;
    ctx.fillRect(0, H - R * 0.35, w, R * 0.35 + 8);

    /* hills */
    const far = mix(mix(sky[2], DUSK, 0.42), LILAC, 0.12);
    const mid = mix(sky[1], DUSK, 0.68);
    const near = mix(INK, DUSK, 0.35);
    const cols = [far, mid, near];
    if (this.ridges) {
      this.ridges.forEach((rd, i) => {
        ctx.fillStyle = rgba(cols[i]);
        ctx.fill(rd.p);
      });
      // rim light on the far range
      ctx.strokeStyle = rgba(PEACH, 0.22 * day * (0.6 + 0.4 * s.b));
      ctx.lineWidth = 1;
      ctx.stroke(this.ridges[0].p);
    }

    /* water */
    const wg = ctx.createLinearGradient(0, H, 0, h);
    wg.addColorStop(0, rgba(mix(sky[2], DUSK, 0.45)));
    wg.addColorStop(0.18, rgba(mix(sky[1], INK, 0.55)));
    wg.addColorStop(1, rgba(DEEP));
    ctx.fillStyle = wg;
    ctx.fillRect(0, H, w, h - H);

    // reflected hills
    if (this.ridges) {
      ctx.globalAlpha = 0.5;
      this.ridges.forEach((rd, i) => { ctx.fillStyle = rgba(mix(cols[i], DEEP, 0.35)); ctx.fill(rd.m); });
      ctx.globalAlpha = 1;
    }

    // reflected sun: a soft orb under the surface and a column of glints
    const depth = Math.max(0, H - sy);
    const ry = H + depth * 0.82;
    const ro = ctx.createRadialGradient(cx, ry, 0, cx, ry, sunR * 3.2);
    ro.addColorStop(0, rgba(sunC, 0.32 * sunA));
    ro.addColorStop(1, rgba(sunC, 0));
    ctx.fillStyle = ro;
    ctx.fillRect(cx - sunR * 3.2, Math.max(H, ry - sunR * 3.2), sunR * 6.4, sunR * 6.4);

    const colLen = Math.min(h - H, depth * 1.25 + 46);
    const wind = s.wind;
    ctx.lineCap = 'round';
    for (const sh of this.shimmer) {
      const yy = H + 3 + sh.d * sh.d * colLen;
      if (yy > h) continue;
      const spread = sunR * (1.1 + sh.d * 2.4) * sh.w;
      const dx = this.reduced ? 0 : Math.sin(this.time * sh.sp * (0.6 + wind) + sh.ph) * sunR * 0.6 * (0.3 + wind);
      ctx.strokeStyle = rgba(sunC, sh.o * (1 - sh.d) * (0.55 + 0.35 * s.b) * sunA);
      ctx.lineWidth = 1 + (1 - sh.d) * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - spread + dx, yy);
      ctx.lineTo(cx + spread + dx, yy);
      ctx.stroke();
    }

    // ripples leave the sun's reflection at each phase change
    for (const rp of this.ripples) {
      const p = rp.t / 3.2;
      const rr = sunR * 1.2 + ease(p) * w * 0.42;
      ctx.strokeStyle = rgba(MIST, (1 - p) * 0.32);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, H + 22, rr, rr * 0.11, 0, 0, TAU);
      ctx.stroke();
    }

    // horizon line
    ctx.fillStyle = rgba(MIST, 0.16 + 0.1 * s.glow);
    ctx.fillRect(0, H, w, 1);

    /* constellation: one star per completed breath */
    const litN = Math.min(CONSTELLATION.length, Math.floor(s.lit + 0.02));
    ctx.globalAlpha = intro;
    if (litN > 0) {
      const pts = CONSTELLATION.map(([x, y]) => [cx + x * R, H + y * R]);
      ctx.strokeStyle = rgba(MIST, 0.28 + 0.2 * nt);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const [i, j] of EDGES) {
        if (i >= litN || j >= litN) continue;
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
      }
      ctx.stroke();
      for (let i = 0; i < litN; i++) {
        const [x, y] = pts[i];
        const zen = i === CONSTELLATION.length - 1;
        const tw = this.reduced ? 1 : 0.8 + 0.2 * Math.sin(this.time * 1.4 + i);
        const sr = (zen ? 3.2 : 2) * tw;
        const st = ctx.createRadialGradient(x, y, 0, x, y, sr * 5);
        st.addColorStop(0, rgba(PALE, 0.95));
        st.addColorStop(0.25, rgba(PALE, 0.4));
        st.addColorStop(1, rgba(PALE, 0));
        ctx.fillStyle = st;
        ctx.beginPath(); ctx.arc(x, y, sr * 5, 0, TAU); ctx.fill();
      }
    }

    /* the dome: one arc segment per phase, sized by its duration */
    const d = inp.durs;
    const total = cycleLength(d);
    const ink = mix(MIST, PALE, 0.4);
    // meridian guide from the horizon to the zenith
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = rgba(ink, 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, H - 4); ctx.lineTo(cx, H - R + 8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(ink, 0.55);
    ctx.fillRect(cx - 5, H - R * 0.8 - 0.5, 10, 1);

    if (total > 0) {
      const gap = 0.05;
      let a0 = Math.PI;
      ctx.font = this.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        if (d[i] <= 0) continue;
        const sweep = (d[i] / total) * Math.PI;
        const a1 = a0 + gap / 2, a2 = a0 + sweep - gap / 2;
        const cur = inp.active && i === inp.phaseIndex;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(ink, 0.24);
        ctx.beginPath(); ctx.arc(cx, H, R, a1, a2); ctx.stroke();
        if (cur) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = rgba(PALE, 0.85);
          ctx.beginPath(); ctx.arc(cx, H, R, a1, a1 + (a2 - a1) * clamp(inp.phaseProgress)); ctx.stroke();
        }
        const am = (a1 + a2) / 2;
        ctx.fillStyle = rgba(ink, cur ? 0.95 : 0.5);
        ctx.fillText(LABELS[i].toUpperCase(), cx + Math.cos(am) * (R + 18), H + Math.sin(am) * (R + 18));
        a0 += sweep;
      }
      if (inp.active) {
        const ad = Math.PI + clamp(inp.cyclePos) * Math.PI;
        const dx = cx + Math.cos(ad) * R, dy = H + Math.sin(ad) * R;
        ctx.fillStyle = rgba(PALE, 0.95);
        ctx.beginPath(); ctx.arc(dx, dy, 3.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(PALE, 0.35);
        ctx.beginPath(); ctx.arc(dx, dy, 7, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
