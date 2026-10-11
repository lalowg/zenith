/* ZENITH — page orchestration */
import { BreathEngine, FreeBreath, LandscapeRenderer, STAR_COUNT, phaseValue, breathAt, cycleLength, clamp } from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 760;

const store = {
  get(k, d) { try { const v = localStorage.getItem('zenith:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('zenith:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

/* ------------------------------------------------------------------ */
/* Content                                                              */
/* ------------------------------------------------------------------ */
const SESSIONS = {
  arrive: {
    name: 'Arrive', minutes: 3, durs: [4, 0, 6, 0],
    cues: ['Let the shoulders drop a little further.', 'Notice where your body meets the chair.', 'Nothing to fix. Only the next breath.', 'Let the out-breath take its time.'],
  },
  clear: {
    name: 'Clear', minutes: 2, durs: [4, 2, 4, 0],
    cues: ['Look up from the task, as if from a page.', 'At the top of the breath, simply pause.', 'Set the last thing down. Pick it up later.'],
  },
  steady: {
    name: 'Steady', minutes: 5, durs: [4, 4, 4, 4],
    cues: ['Four sides, drawn slowly.', 'If a thought arrives, let it pass behind the hills.', 'Keep the hold soft. No gripping.', 'Follow the dot along the arc.'],
  },
  unwind: {
    name: 'Unwind', minutes: 8, durs: [4, 7, 8, 0],
    cues: ['Let the day settle into the water.', 'Soften the jaw and the space between the eyes.', 'If the hold feels long, breathe out sooner.', 'Each star is one breath you have already taken.'],
  },
  own: { name: 'Your rhythm', minutes: null, durs: null, cues: ['Your rhythm, your pace.', 'Watch the sun rather than the numbers.', 'Let the breath leave a little slower than it came.'] },
};
const RHYTHMS = { even: [5, 0, 5, 0], long: [4, 0, 6, 0], triangle: [4, 4, 4, 0], square: [4, 4, 4, 4], '478': [4, 7, 8, 0] };

const PROMPTS = [
  { text: 'Breathe in', hint: 'Through the nose, slowly. Let the sun rise.' },
  { text: 'Hold', hint: 'Soft shoulders. Nothing to grip.' },
  { text: 'Breathe out', hint: 'Long and quiet, like steam leaving a cup.' },
  { text: 'Rest', hint: 'Empty and still. Wait for the next sunrise.' },
];
const IDLE = { text: 'Take a moment', hint: 'Choose a session, then press Begin. The landscape will keep the pace.' };
const READY = { text: 'Ready when you are', hint: 'Press Begin. You can pause at any time.' };
const PAUSED = { text: 'Paused', hint: 'Press Resume to carry on from this breath.' };
const DONE = { text: 'Rest here', hint: 'Your session is complete. Stay under the stars as long as you like.' };
const FREE_IDLE = { text: 'Hold to breathe in', hint: 'Press and hold Breathe in. Let go to breathe out. The sun follows you.' };
const TINT = [1, 0.5, -1, -0.6];
const WIND = [0.45, 0.2, 1, 0.05];
const GLOW = [0.35, 1, 0.15, 0];
const STEP = ['In', 'Hold', 'Out', 'Rest'];

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */
const LIMITS = [[2, 10], [0, 10], [2, 12], [0, 10]];
let sessionKey = store.get('session', 'arrive');
if (!SESSIONS[sessionKey]) sessionKey = 'arrive';
let own = store.get('own', [4, 2, 6, 2]);
if (!Array.isArray(own) || own.length !== 4) own = [4, 2, 6, 2];
own = own.map((v, i) => Math.round(clamp(Number(v) || 0, LIMITS[i][0], LIMITS[i][1])));
let lengthMin = Number(store.get('length', 3));
if (![1, 3, 5, 10].includes(lengthMin)) lengthMin = 3;
let pace = Number(store.get('pace', 1));
if (!(pace >= 0.75 && pace <= 1.5)) pace = 1;
let mode = 'paced';

const r1 = (v) => Math.round(v * 10) / 10;
const baseOf = (k) => (k === 'own' ? own.slice() : SESSIONS[k].durs.slice());
const durOf = (k) => baseOf(k).map((v) => r1(v * pace));
const minutesOf = (k) => (k === 'own' ? lengthMin : SESSIONS[k].minutes);
const secs = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const shapeOf = (d) => d.map((v, i) => (v > 0 ? `${STEP[i]} ${secs(v)}` : '')).filter(Boolean).join(' · ');
const fmt = (sec) => {
  const s = Math.max(0, Math.ceil(sec - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */
const hero = $('#breathe');
const canvas = $('.hero__canvas', hero);
const guideEl = $('#guide');
const titleEl = $('.hero__title', hero);
const skyArea = $('#sky-area');
const promptEl = $('#prompt');
const countEl = $('#count');
const hintEl = $('#hint');
const cueEl = $('#cue');
const startBtn = $('#start');
const startLabel = $('.btn-begin__label', startBtn);
const resetBtn = $('#reset');
const remainEl = $('#remain');
const cyclesEl = $('#cycles');
const skyNameEl = $('#skyname');
const stSession = $('#st-session');
const sessionBtn = $('#session-btn');
const sessionLabel = $('#session-label');
const panel = $('#dock-panel');
const ownPanel = $('#own-panel');
const ownMeta = $('#own-meta');
const paceInput = $('#pace');
const paceOut = $('#pace-out');
const freeBtn = $('#free-btn');
const pill = $('#pill');
const pillText = $('#pill-text');
const pillCount = $('#pill-count');

let promptKey = '';
function setPrompt(p, hint) {
  const key = p.text;
  if (key !== promptKey) {
    promptEl.replaceChildren(Object.assign(document.createElement('span'), { textContent: p.text }));
    promptKey = key;
    if (!reduced) {
      promptEl.classList.remove('is-new');
      void promptEl.offsetWidth;
      promptEl.classList.add('is-new');
    }
  }
  hintEl.textContent = hint ?? p.hint;
}
let cueIdx = -1;
function setCue(text) {
  if (cueEl.textContent === text) return;
  cueEl.classList.remove('is-in');
  cueEl.textContent = text;
  if (text) { void cueEl.offsetWidth; cueEl.classList.add('is-in'); }
}

const engine = new BreathEngine({
  durations: durOf(sessionKey),
  sessionSec: minutesOf(sessionKey) * 60,
  onPhase(i, cycle) {
    cyclesEl.textContent = String(cycle);
    if (renderer) renderer.pulse();
    if (engine.status === 'paused') return;
    let hint = PROMPTS[i].hint;
    if (engine.finishing) hint = i === 2 ? 'The last out-breath. Slowly.' : 'Nearly there.';
    setPrompt(PROMPTS[i], hint);
    const cues = SESSIONS[sessionKey].cues;
    const ci = Math.floor((cycle - 1) / 2) % cues.length;
    if (ci !== cueIdx) { cueIdx = ci; setCue(cues[ci]); }
  },
  onDone(cycle) {
    cyclesEl.textContent = String(cycle);
    setPrompt(DONE);
    setCue('A star for every breath, and the last one at the zenith.');
    syncButtons();
    kick();
  },
});

const free = new FreeBreath({
  onBreath(last, n) {
    cyclesEl.textContent = String(n);
    if (renderer) renderer.pulse();
    setCue(`Last breath: in ${last.inSec.toFixed(1)} s, out ${last.outSec.toFixed(1)} s.`);
  },
});

let renderer = null;
try {
  renderer = new LandscapeRenderer(canvas, { reduced, small: isSmall() });
} catch {
  renderer = null;
  hero.classList.add('no-canvas');
}

function measure() {
  const w = hero.clientWidth, h = hero.clientHeight;
  const hr = hero.getBoundingClientRect();
  const gr = guideEl.getBoundingClientRect();
  const tr = titleEl.getBoundingClientRect();
  const horizon = Math.round(gr.top - hr.top - 14);
  const header = $('.site-header').getBoundingClientRect().height;
  const titleAbove = tr.bottom < gr.top - 20;
  const top = titleAbove ? tr.bottom - hr.top + 20 : header + 24;
  const R = clamp(Math.min(w * (isSmall() ? 0.4 : 0.36), horizon - top - 30), 70, 440);
  hero.style.setProperty('--horizon', `${horizon}px`);
  hero.style.setProperty('--dome', `${Math.round(R)}px`);
  if (!renderer) return;
  const dpr = Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2);
  renderer.resize(w, h, dpr);
  renderer.setLayout({ cx: w / 2, horizon, R, top });
  kick();
}

function syncButtons() {
  const st = engine.status;
  if (mode === 'free') {
    startLabel.textContent = 'Breathe in';
    startBtn.setAttribute('aria-describedby', 'free-hint');
    resetBtn.disabled = !free.started;
    hero.dataset.state = free.held ? 'holding' : free.started ? 'free' : 'idle';
  } else {
    startLabel.textContent = st === 'running' ? 'Pause' : st === 'paused' ? 'Resume' : st === 'done' ? 'Again' : 'Begin';
    startBtn.removeAttribute('aria-describedby');
    resetBtn.disabled = st === 'idle';
    hero.dataset.state = st;
    if (st === 'idle') cyclesEl.textContent = '—';
  }
  const lockSettings = mode === 'free';
  sessionBtn.disabled = lockSettings;
  paceInput.disabled = lockSettings;
}

function skyName(p) { return p < 0.34 ? 'Dusk' : p < 0.67 ? 'Afterglow' : 'Nightfall'; }

let clock = 0;
function buildInput() {
  const d = mode === 'free' ? [5, 0, 6, 0] : engine.durs;
  if (mode === 'free') {
    const pi = free.phase;
    const started = free.started;
    const b = started ? free.b : (reduced ? 0.3 : 0.32 + 0.14 * Math.sin((clock * Math.PI * 2) / 12));
    return {
      b, phaseIndex: pi, phaseProgress: pi === 0 ? b : pi === 2 ? 1 - b : 1, cyclePos: pi === 0 || pi === 1 ? b * 0.45 : 0.55 + (1 - b) * 0.45,
      durs: d, active: started, tint: started ? TINT[pi] : 0, wind: started ? WIND[pi] : 0.35, glow: started ? GLOW[pi] : 0,
      prog: Math.min(1, free.breaths / 24), night: 0, lit: Math.min(STAR_COUNT - 1, free.breaths),
    };
  }
  const st = engine.status;
  let b, pp = 0, cp = 0, active = false, tint = 0, wind = 0.35, glow = 0;
  const pi = engine.phaseIndex;
  if (st === 'running' || st === 'paused') {
    active = true;
    const dur = engine.phaseDur;
    let pe = engine.phaseElapsed;
    if (reduced) pe = Math.min(dur, Math.floor(pe) + 1); // step-based: one change per second
    pp = dur > 0 ? Math.min(1, pe / dur) : 1;
    b = phaseValue(pi, pp);
    let acc = 0;
    for (let i = 0; i < pi; i++) acc += d[i];
    cp = (acc + pp * dur) / cycleLength(d);
    tint = TINT[pi]; wind = WIND[pi]; glow = GLOW[pi];
  } else if (st === 'done') {
    b = 0.06; wind = 0.05;
  } else {
    b = reduced ? 0.3 : 0.32 + 0.14 * Math.sin((clock * Math.PI * 2) / 12);
  }
  let prog = st === 'idle' ? 0 : st === 'done' ? 1 : Math.min(1, engine.elapsed / engine.sessionSec);
  if (reduced) prog = Math.round(prog * 40) / 40;
  const lit = st === 'done' ? STAR_COUNT : active ? Math.min(STAR_COUNT - 1, engine.cycle - 1) : 0;
  return { b, phaseIndex: pi, phaseProgress: pp, cyclePos: cp, durs: d, active, tint, wind, glow, prog, night: st === 'done' ? 1 : 0, lit };
}

const last = { remain: '', count: '', sky: '', pill: '', pillCount: '' };
let heroVisible = true;
function updateDOM(inp) {
  let remain, count = '', sky, live, pillT = '';
  if (mode === 'free') {
    live = free.started;
    remain = 'Open';
    if (free.started) {
      if (free.phase === 0) { count = free.t.toFixed(1); pillT = 'Breathing in'; }
      else if (free.phase === 1) { count = free.t.toFixed(1); pillT = 'Full'; }
      else if (free.phase === 2) { count = free.t.toFixed(1); pillT = 'Breathing out'; }
      else pillT = 'Rest';
    }
    sky = skyName(inp.prog);
    updateFreePrompt();
  } else {
    const st = engine.status;
    live = st === 'running' || st === 'paused';
    remain = fmt(st === 'idle' ? engine.sessionSec : engine.remaining);
    count = live ? String(Math.max(1, Math.ceil(engine.phaseRemaining - 1e-6))) : '';
    sky = st === 'done' ? 'Night' : skyName(inp.prog);
    pillT = st === 'paused' ? 'Paused' : PROMPTS[engine.phaseIndex].text;
    if (st === 'paused') count = '';
  }
  if (remain !== last.remain) { remainEl.textContent = remain; last.remain = remain; }
  if (count !== last.count) { countEl.textContent = count; last.count = count; }
  if (sky !== last.sky) { skyNameEl.textContent = sky; last.sky = sky; }

  const showPill = live && !heroVisible;
  if (pill.hidden === showPill) pill.hidden = !showPill;
  if (showPill) {
    if (pillT !== last.pill) { pillText.textContent = pillT; last.pill = pillT; }
    if (count !== last.pillCount) { pillCount.textContent = mode === 'free' ? '' : count; last.pillCount = count; }
    pill.style.setProperty('--b', inp.b.toFixed(3));
  }
}

let freePhaseShown = -1;
function updateFreePrompt() {
  if (!free.started) return;
  const ph = free.phase;
  if (ph === freePhaseShown) return;
  freePhaseShown = ph;
  const T = ['Breathing in', 'Full', 'Breathing out', 'Rest'];
  const H = ['Hold for as long as feels easy.', 'Let go whenever you are ready.', 'Slowly. The sun sinks with you.', 'Press again when the next breath arrives.'];
  setPrompt({ text: T[ph], hint: H[ph] });
}

let night = false;
function setNight(v) {
  if (v === night) return;
  night = v;
  hero.classList.toggle('is-night', v);
}

let raf = 0, lastT = 0, readyShown = false;
function loop(now) {
  raf = 0;
  const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
  lastT = now;
  clock += dt;
  engine.tick(dt);
  free.tick(dt);
  const inp = buildInput();
  updateDOM(inp);
  if (heroVisible) {
    if (renderer) {
      const s = renderer.frame(dt, inp);
      setNight(s.night > 0.5);
      if (!readyShown) { canvas.classList.add('is-ready'); readyShown = true; }
    } else {
      hero.style.setProperty('--b', inp.b.toFixed(3));
      setNight(inp.night > 0.5);
    }
  }
  if (wantLoop()) raf = requestAnimationFrame(loop);
  else lastT = 0;
}
function wantLoop() {
  if (document.hidden) return false;
  if (mode === 'paced' && engine.status === 'running') return true;
  if (mode === 'free' && free.started && (free.held || free.b > 0.001 || free.phase !== 3)) return true;
  if (!heroVisible) return false;
  if (reduced) return renderer ? renderer.settling() : false;
  return true;
}
function kick() { if (!raf) raf = requestAnimationFrame(loop); }

function freshStart() {
  engine.reset();
  engine.setDurations(durOf(sessionKey), true);
  engine.setSession(minutesOf(sessionKey) * 60);
  cueIdx = -1;
  setCue('');
}

startBtn.addEventListener('click', () => {
  if (mode === 'free') return; // free mode is press-and-hold
  const st = engine.status;
  if (st === 'running') {
    engine.pause();
    setPrompt(PAUSED);
  } else if (st === 'paused') {
    engine.start();
    setPrompt(PROMPTS[engine.phaseIndex]);
  } else {
    freshStart();
    engine.start();
  }
  closePanel(false);
  syncButtons();
  kick();
});

resetBtn.addEventListener('click', () => {
  if (mode === 'free') {
    free.reset();
    freePhaseShown = -1;
    cyclesEl.textContent = '—';
    setPrompt(FREE_IDLE);
    setCue('');
  } else {
    freshStart();
    setPrompt(IDLE);
  }
  syncButtons();
  kick();
  startBtn.focus();
});

/* free breath: press and hold */
function freePress(e) {
  if (mode !== 'free') return;
  if (e && e.cancelable) e.preventDefault();
  free.press();
  syncButtons();
  kick();
}
function freeRelease() {
  if (mode !== 'free' || !free.held) return;
  free.release();
  syncButtons();
  kick();
}
startBtn.addEventListener('pointerdown', (e) => {
  if (mode !== 'free' || e.button > 0) return;
  try { startBtn.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  freePress(e);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => startBtn.addEventListener(t, freeRelease));
startBtn.addEventListener('keydown', (e) => {
  if (mode !== 'free' || (e.key !== ' ' && e.key !== 'Enter')) return;
  e.preventDefault();
  if (!e.repeat) freePress();
});
startBtn.addEventListener('keyup', (e) => {
  if (mode !== 'free' || (e.key !== ' ' && e.key !== 'Enter')) return;
  e.preventDefault();
  freeRelease();
});
startBtn.addEventListener('blur', freeRelease);
startBtn.addEventListener('contextmenu', (e) => { if (mode === 'free') e.preventDefault(); });
skyArea.addEventListener('pointerdown', (e) => {
  if (mode !== 'free' || e.button > 0) return;
  try { skyArea.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  freePress(e);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => skyArea.addEventListener(t, freeRelease));

freeBtn.addEventListener('click', () => {
  const on = mode !== 'free';
  if (on) {
    if (engine.status === 'running') engine.pause();
    engine.reset();
    mode = 'free';
    free.reset();
    freePhaseShown = -1;
    setPrompt(FREE_IDLE);
    setCue('');
    stSession.textContent = 'Your own pace';
    cyclesEl.textContent = '—';
    closePanel(false);
  } else {
    free.reset();
    mode = 'paced';
    freshStart();
    setPrompt(IDLE);
    syncSessionUI();
  }
  hero.dataset.mode = mode;
  freeBtn.setAttribute('aria-pressed', String(on));
  syncButtons();
  kick();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (engine.status === 'running') { engine.pause(); setPrompt(PAUSED); syncButtons(); }
    freeRelease();
  } else {
    lastT = 0;
    kick();
  }
});

/* ------------------------------------------------------------------ */
/* Dock: session panel, own rhythm, pace                                */
/* ------------------------------------------------------------------ */
function openPanel() {
  panel.hidden = false;
  sessionBtn.setAttribute('aria-expanded', 'true');
  const checked = $('input[name="session"]:checked', panel) || $('input[name="session"]', panel);
  checked.focus();
}
function closePanel(returnFocus = true) {
  if (panel.hidden) return;
  panel.hidden = true;
  sessionBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus) sessionBtn.focus();
}
sessionBtn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
$('#panel-close').addEventListener('click', () => closePanel());
panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePanel(); } });
document.addEventListener('pointerdown', (e) => {
  if (!panel.hidden && !panel.contains(e.target) && !sessionBtn.contains(e.target)) closePanel(false);
});

function syncSessionUI() {
  const s = SESSIONS[sessionKey];
  const min = minutesOf(sessionKey);
  sessionLabel.textContent = `${s.name} · ${min} min`;
  stSession.textContent = s.name;
  ownPanel.classList.toggle('is-active', sessionKey === 'own');
  ownMeta.textContent = `${lengthMin} min · ${shapeOf(own).toLowerCase()}`;
  const d = durOf(sessionKey);
  paceOut.textContent = `One breath · ${secs(r1(cycleLength(d)))} s`;
  paceInput.setAttribute('aria-valuetext', `One breath lasts ${secs(r1(cycleLength(d)))} seconds`);
  paceInput.style.setProperty('--p', `${((pace - 0.75) / 0.75) * 100}%`);
  if (engine.status === 'idle') remainEl.textContent = fmt(min * 60);
}

function applySession(k, { immediate = true } = {}) {
  sessionKey = k;
  store.set('session', k);
  $$('input[name="session"]', panel).forEach((r) => { r.checked = r.value === k; });
  if (engine.status === 'running' || engine.status === 'paused') {
    engine.setDurations(durOf(k), immediate);
    engine.setSession(minutesOf(k) * 60);
  } else {
    engine.setDurations(durOf(k), true);
    engine.setSession(minutesOf(k) * 60);
    if (engine.status === 'done') { freshStart(); setPrompt(READY); }
  }
  syncSessionUI();
  if (renderer) renderer.invalidate();
  kick();
}

$$('input[name="session"]', panel).forEach((r) => {
  r.checked = r.value === sessionKey;
  r.addEventListener('change', () => { if (r.checked) applySession(r.value); });
});
$$('input[name="length"]', panel).forEach((r) => {
  r.checked = Number(r.value) === lengthMin;
  r.addEventListener('change', () => {
    if (!r.checked) return;
    lengthMin = Number(r.value);
    store.set('length', lengthMin);
    if (sessionKey === 'own') engine.setSession(lengthMin * 60);
    syncSessionUI();
    kick();
  });
});

function syncOwnSliders() {
  $$('.panel__sliders input[type="range"]', panel).forEach((input) => {
    const i = Number(input.dataset.idx);
    input.value = String(own[i]);
    $(`#o-${i}`).textContent = `${own[i]} s`;
    input.setAttribute('aria-valuetext', `${own[i]} seconds`);
  });
  const total = cycleLength(own);
  $('#own-len').textContent = String(total);
  $('#own-shape').textContent = shapeOf(own);
}
$$('.panel__sliders input[type="range"]', panel).forEach((input) => {
  input.addEventListener('input', () => {
    const i = Number(input.dataset.idx);
    own[i] = Number(input.value);
    store.set('own', own);
    syncOwnSliders();
    if (sessionKey !== 'own') applySession('own');
    else if (engine.status === 'running' || engine.status === 'paused') engine.setDurations(durOf('own'), false);
    else engine.setDurations(durOf('own'), true);
    syncSessionUI();
    buildRhythm(rhythms.find((x) => x.key === 'own'));
    if (renderer) renderer.invalidate();
    kick();
  });
});

paceInput.value = String(pace);
paceInput.addEventListener('input', () => {
  pace = Number(paceInput.value);
  store.set('pace', pace);
  const live = engine.status === 'running' || engine.status === 'paused';
  engine.setDurations(durOf(sessionKey), !live);
  syncSessionUI();
  if (renderer) renderer.invalidate();
  kick();
});

/* resize + visibility */
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => measure());
  ro.observe(hero);
  ro.observe(guideEl);
  ro.observe(titleEl);
} else {
  addEventListener('resize', measure);
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => {
    heroVisible = entries[entries.length - 1].isIntersecting;
    lastT = 0;
    kick();
    updateDOM(buildInput());
  }, { threshold: 0.02 }).observe(hero);
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (renderer) renderer.setFont('500 11px Karla, sans-serif');
    measure();
    kick();
  });
}
syncOwnSliders();
syncSessionUI();
syncButtons();
setPrompt(IDLE);
measure();
kick();

/* ------------------------------------------------------------------ */
/* Rhythm lines drawn from real timings                                 */
/* ------------------------------------------------------------------ */
const Y = (b) => 120 - b * 92;
const rhythmDurs = (key) => (key === 'own' ? own.slice() : SESSIONS[key] ? SESSIONS[key].durs.slice() : RHYTHMS[key].slice());
const rhythms = $$('[data-rhythm]').map((svg) => ({
  svg, key: svg.dataset.rhythm,
  line: $('.rhythm__line', svg), area: $('.rhythm__area', svg),
  dot: $('.rhythm__dot', svg), halo: $('.rhythm__halo', svg), visible: false,
}));
function buildRhythm(r) {
  if (!r) return;
  const d = rhythmDurs(r.key);
  const cyc = cycleLength(d);
  const scale = Math.min(14, 560 / cyc);
  const n = Math.max(1, Math.floor(560 / (cyc * scale) + 1e-6));
  Object.assign(r, { d, cyc, scale, loop: cyc * n });
  const pts = [];
  for (let t = 0; t <= r.loop + 1e-6; t += 0.1) pts.push(`${(20 + t * scale).toFixed(1)} ${Y(breathAt(d, t % cyc)).toFixed(1)}`);
  const lineD = 'M' + pts.join(' L');
  r.line.setAttribute('d', lineD);
  r.area.setAttribute('d', `${lineD} L${(20 + r.loop * scale).toFixed(1)} 120 L20 120 Z`);
  r.area.setAttribute('fill', 'url(#rhythm-grad)');
  if (r.key === 'own') r.svg.setAttribute('aria-label', `Your rhythm as currently set: ${shapeOf(d).toLowerCase()}, in seconds`);
  placeDot(r, 0);
}
function placeDot(r, t) {
  const tt = t % r.loop;
  const b = breathAt(r.d, tt % r.cyc);
  const x = (20 + tt * r.scale).toFixed(1), y = Y(b).toFixed(1);
  r.dot.setAttribute('cx', x); r.dot.setAttribute('cy', y);
  r.halo.setAttribute('cx', x); r.halo.setAttribute('cy', y);
  r.halo.setAttribute('r', (6 + b * 10).toFixed(1));
}
rhythms.forEach(buildRhythm);

let rhythmRaf = 0;
function rhythmLoop(now) {
  rhythmRaf = 0;
  const vis = rhythms.filter((r) => r.visible);
  if (!vis.length || document.hidden) return;
  vis.forEach((r) => placeDot(r, now / 1000));
  rhythmRaf = requestAnimationFrame(rhythmLoop);
}
if (!reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { const r = rhythms.find((x) => x.svg === e.target); if (r) r.visible = e.isIntersecting; });
    if (!rhythmRaf) rhythmRaf = requestAnimationFrame(rhythmLoop);
  }, { threshold: 0.1 });
  rhythms.forEach((r) => io.observe(r.svg));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !rhythmRaf) rhythmRaf = requestAnimationFrame(rhythmLoop); });
}

function toHero() {
  if (mode === 'free') freeBtn.click();
  if (engine.status === 'idle' || engine.status === 'done') { freshStart(); setPrompt(READY); syncButtons(); }
  hero.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  startBtn.focus({ preventScroll: true });
}
$$('[data-use]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (mode === 'free') freeBtn.click();
    applySession(btn.dataset.use);
    toHero();
  });
});
$$('[data-rhythm-use]').forEach((btn) => {
  btn.addEventListener('click', () => {
    own = RHYTHMS[btn.dataset.rhythmUse].slice();
    store.set('own', own);
    syncOwnSliders();
    buildRhythm(rhythms.find((x) => x.key === 'own'));
    if (mode === 'free') freeBtn.click();
    applySession('own');
    toHero();
  });
});

/* horizontal track */
const track = $('#rhythm-track');
$$('[data-track]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const plate = $('.plate', track);
    const step = plate ? plate.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
    track.scrollBy({ left: Number(btn.dataset.track) * step, behavior: reduced ? 'auto' : 'smooth' });
  });
});
function syncTrackButtons() {
  const max = track.scrollWidth - track.clientWidth - 2;
  $$('[data-track]').forEach((b) => { b.disabled = b.dataset.track === '-1' ? track.scrollLeft <= 2 : track.scrollLeft >= max; });
}
track.addEventListener('scroll', () => requestAnimationFrame(syncTrackButtons), { passive: true });
addEventListener('resize', syncTrackButtons);
syncTrackButtons();

/* ------------------------------------------------------------------ */
/* Navigation overlay                                                   */
/* ------------------------------------------------------------------ */
const menuBtn = $('.menu-btn');
const menuLabel = $('.menu-btn__label');
const nav = $('#site-nav');
const navLinks = $$('a', nav);
function setMenu(open) {
  root.classList.toggle('nav-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuLabel.textContent = open ? 'Close' : 'Index';
  if (open) navLinks[0].focus();
  else if (nav.contains(document.activeElement)) menuBtn.focus();
}
menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('nav-open')));
navLinks.forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
  if (!root.classList.contains('nav-open')) return;
  if (e.key === 'Escape') { setMenu(false); return; }
  if (e.key === 'Tab') {
    const first = menuBtn, lastLink = navLinks[navLinks.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastLink.focus(); }
    else if (!e.shiftKey && document.activeElement === lastLink) { e.preventDefault(); first.focus(); }
  }
});

if ('IntersectionObserver' in window) {
  const ids = ['breathe', 'sessions', 'arc', 'rhythms', 'practice', 'sanctuary', 'letter'];
  const navIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => {
        if (a.getAttribute('href') === `#${e.target.id}`) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      root.dataset.section = e.target.id;
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach((id) => navIo.observe(document.getElementById(id)));
}

/* ------------------------------------------------------------------ */
/* Reveals: content rises from behind a horizon line                    */
/* ------------------------------------------------------------------ */
const revealEls = $$('[data-rise]');
if (reduced || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('is-in'));
} else {
  const rio = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach((el) => rio.observe(el));
}
window.zenithReady = true;

/* ------------------------------------------------------------------ */
/* The arc of a breath: sticky plate                                    */
/* ------------------------------------------------------------------ */
const arc = $('#arc');
const arcName = $('#arc-name');
const arcPhase = $('#arc-phase');
const passages = $$('.passage', arc);
const ARC = { rise: ['In-breath', 'The rise'], zenith: ['Hold', 'The zenith'], descent: ['Out-breath', 'The descent'], still: ['Rest', 'The stillness'] };
function setArc(step) {
  if (arc.dataset.step === step && arcName.textContent === ARC[step][1]) return;
  arc.dataset.step = step;
  passages.forEach((p) => p.classList.toggle('is-active', p.dataset.step === step));
  arcPhase.textContent = ARC[step][0];
  arcName.textContent = ARC[step][1];
}
setArc('rise');
if ('IntersectionObserver' in window) {
  const aio = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setArc(e.target.dataset.step); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  passages.forEach((p) => aio.observe(p));
}

/* ------------------------------------------------------------------ */
/* Scroll-linked evening: the page deepens toward night                 */
/* ------------------------------------------------------------------ */
const PAGE_STOPS = ['#2B2440', '#2A2340', '#26203B', '#221D36', '#1F1B31', '#1D1A2B', '#17152A'].map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
let scrollTick = false;
function onScroll() {
  scrollTick = false;
  const max = root.scrollHeight - innerHeight;
  const p = max > 0 ? clamp(scrollY / max) : 0;
  const x = p * (PAGE_STOPS.length - 1);
  const i = Math.min(PAGE_STOPS.length - 2, Math.floor(x));
  const t = x - i;
  const a = PAGE_STOPS[i], b = PAGE_STOPS[i + 1];
  root.style.setProperty('--page-bg', `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`);
  root.classList.toggle('is-scrolled', scrollY > 40);
}
addEventListener('scroll', () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */
const form = $('#letter-form');
const done = $('#form-done');
const summary = $('#form-summary');
const noteCount = $('#f-note-count');
const MAXNOTE = 240;
const fields = {
  name: { el: $('#f-name'), err: $('#f-name-err'), check: (el) => (el.value.trim().length >= 2 ? '' : 'Please tell us your first name.') },
  email: {
    el: $('#f-email'), err: $('#f-email-err'),
    check: (el) => {
      const v = el.value.trim();
      if (!v) return 'Please add your email address.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email address looks incomplete. For example: name@example.com.';
    },
  },
  time: {
    el: $('#f-time'), err: $('#f-time-err'), focusEl: () => $('#t-morning'),
    check: () => ($('input[name="time"]:checked', form) ? '' : 'Choose the time you most often pause.'),
  },
  note: {
    el: $('#f-note'), err: $('#f-note-err'),
    check: (el) => (el.value.length > MAXNOTE ? `Please keep this under ${MAXNOTE} characters (currently ${el.value.length}).` : ''),
  },
  ok: { el: $('#f-ok'), err: $('#f-ok-err'), check: (el) => (el.checked ? '' : 'Tick the box so we know you would like that one email.') },
};
let attempted = false;
function validate(key) {
  const f = fields[key];
  const msg = f.check(f.el);
  f.err.textContent = msg;
  if (msg) f.el.setAttribute('aria-invalid', 'true');
  else f.el.removeAttribute('aria-invalid');
  if (key === 'time') $$('input[name="time"]', form).forEach((r) => (msg ? r.setAttribute('aria-invalid', 'true') : r.removeAttribute('aria-invalid')));
  return !msg;
}
Object.keys(fields).forEach((key) => {
  const f = fields[key];
  const evt = key === 'time' || key === 'ok' ? 'change' : 'input';
  f.el.addEventListener(evt, () => { if (attempted || f.el.getAttribute('aria-invalid')) validate(key); });
  if (key === 'name' || key === 'email') f.el.addEventListener('blur', () => { if (f.el.value.trim()) validate(key); });
});
fields.note.el.addEventListener('input', () => {
  const n = fields.note.el.value.length;
  noteCount.textContent = `${n} / ${MAXNOTE}`;
  noteCount.classList.toggle('is-over', n > MAXNOTE);
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  attempted = true;
  const bad = Object.keys(fields).filter((k) => !validate(k));
  if (bad.length) {
    summary.textContent = bad.length === 1 ? 'One field needs a second look.' : `${bad.length} fields need a second look.`;
    summary.hidden = false;
    const f = fields[bad[0]];
    (f.focusEl ? f.focusEl() : f.el).focus();
    return;
  }
  summary.hidden = true;
  $('#done-name').textContent = `, ${fields.name.el.value.trim().split(/\s+/)[0]}`;
  form.hidden = true;
  done.hidden = false;
  done.focus();
});
$('#form-again').addEventListener('click', () => {
  form.reset();
  attempted = false;
  Object.keys(fields).forEach((k) => { fields[k].err.textContent = ''; fields[k].el.removeAttribute('aria-invalid'); });
  $$('input[name="time"]', form).forEach((r) => r.removeAttribute('aria-invalid'));
  noteCount.textContent = `0 / ${MAXNOTE}`;
  noteCount.classList.remove('is-over');
  summary.hidden = true;
  done.hidden = true;
  form.hidden = false;
  fields.name.el.focus();
});

/* ------------------------------------------------------------------ */
/* Footer night sky                                                     */
/* ------------------------------------------------------------------ */
const starsHost = $('.footer__sky');
if (starsHost) {
  let seed = 23;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 300');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('focusable', 'false');
  for (let i = 0; i < 80; i++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', (rnd() * 1000).toFixed(1));
    c.setAttribute('cy', (rnd() * 260).toFixed(1));
    c.setAttribute('r', (rnd() < 0.1 ? 1.5 : 0.4 + rnd() * 0.7).toFixed(2));
    if (i % 6 === 0) { c.classList.add('tw'); c.style.animationDelay = `${(rnd() * 6).toFixed(2)}s`; }
    svg.appendChild(c);
  }
  starsHost.appendChild(svg);
}
