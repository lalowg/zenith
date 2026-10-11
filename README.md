# ZENITH — Your Mind, in Focus

A breathing sanctuary built around one image: **the sun climbing to the zenith as you breathe in, and settling into a still lake as you breathe out.** The first viewport is the product. It is a near-chromeless evening landscape with a single control dock, and the rest of the page explains the practice in quiet editorial sections.

Production URL: `https://zenith-blue-beta.vercel.app`

> Fictional concept brand, built as a portfolio project. ZENITH is not a real service and makes no medical claims.

---

## Concept

Most breathing tools give you a circle and a number. ZENITH gives you a landscape that answers each movement of the breath:

| Breath | Landscape |
|---|---|
| In-breath | The sun lifts out of the lake and climbs the meridian. The sky warms toward peach. |
| Hold | The sun rests at the zenith. Haze gathers on the horizon and the light brightens. |
| Out-breath | The sun returns to the water. The sky cools toward lilac and a breeze loosens the reflection into ripples. |
| Rest | The water turns to glass. |

Every completed breath lights a star above the hills. By the end of a session the stars form a constellation, and the final star appears at the zenith. As the session passes, the evening deepens from **Dusk** through **Afterglow** to **Nightfall**, and at the end the sky becomes **Night**.

## Brand & positioning

- **Name:** the zenith is the point directly above you, wherever you stand. The brand presents breathing as a few minutes of evening you can step into at any time.
- **Promise:** a sanctuary, not a programme. There are no streaks, scores or feeds, and settings stay on the device.
- **Tone:** calm, plain and specific. The copy speaks in short, gentle imperatives ("Breathe in", "Rest") and never promises outcomes.
- **Conversion:** a "First light list" for a fictional ZENITH app. It is a demo form, and nothing is sent.

## Audience

Adults (25–55) who want a short, beautiful, ad-free pause: at a desk between tasks, after a loud day, or before sleep. They are often sceptical of wellness hype and prefer to be shown rather than sold to.

## Art direction

- **Palette:** dusk `#2B2440`, peach `#F6C6A8`, mist `#E9E4F0`, ink `#1D1A2B`. Derived tones: plum `#3A2F57`, lilac `#A99DC4`, deep `#141222`, and ember-ink `#8A4A2F` for accent text on the mist section.
- **Composition:** the hero is chromeless. The sky is image only. The words live "on the water": the title on the left, the breathing prompt in the centre and the session status on the right, with one glassy dock beneath them. On phones the title moves into the sky and the dock recomposes into two rows.
- **Layering:** the canvas paints a gradient sky, background stars, a sun with bloom, horizon haze, three ranges of procedurally generated hills that open into a valley on the sun's meridian, a lake with mirrored hills, a reflected sun, a column of glints and elliptical ripples. A fine SVG grain sits on top so the gradients read as film rather than flat digital colour.
- **Motifs:** the dome (sky arc), the meridian, the horizon line and the reflection glints. These carry into the logo, the menu button (a sun that sets when the index opens), the step glyphs, the "arc of a breath" plate and the footer.
- **Logo:** an original mark (a dome over a horizon, the sun at its apex and three reflection glints) with a hand-drawn geometric ZENITH wordmark built from strokes, so it renders identically without web fonts. See `logo.svg`; `favicon.svg` is the compact mark on a dusk tile.

## Typography

- **Gilda Display** (400) for display: headlines, the breathing prompt, numerals and status values. Italics are used for the brand's emotional words.
- **Karla** (300/400/500/600, plus italic 300/400) for text, labels and controls. Small caps labels are letter-spaced at 0.22em.
- Both fonts load from Google Fonts with `display=swap`. Headings use `text-wrap: balance` and `overflow-wrap: normal` so words never break mid-word.

## Motion language

The whole site moves on the breath curve, a sine in-out (`cubic-bezier(.37,0,.63,1)`), which is the same easing the sun follows.

- **Exhale prompts:** each phase prompt arrives with a letter-spacing contraction and a blur-to-clear.
- **Dawn reveals:** content rises from behind an invisible horizon line. A clip-path opens upward while the block settles 18px, and headings tighten their letter-spacing as they land. Index-list rules extend outward from the centre, like a horizon.
- **Sticky plate:** in "The arc of a breath", the sun, sky stops, reflection, ripples and a traced dome arc tween between the four phases as the passages scroll past.
- **Evening scroll:** the page background deepens from dusk to night as you scroll toward the footer, where the stars come out.
- **Live rhythm lines:** every rhythm diagram has a dot that travels in real time at the true seconds of that rhythm, so you can breathe along with the diagrams too.

## Signature interaction: how to use it

1. **Choose a session.** Open **Session** in the dock:
   - *Arrive* (3 min, in 4 / out 6)
   - *Clear* (2 min, in 4 / hold 2 / out 4)
   - *Steady* (5 min, 4·4·4·4)
   - *Unwind* (8 min, 4·7·8)
   - *Your rhythm* (sliders for in 2–10 s, hold 0–10 s, out 2–12 s and rest 0–10 s, with a length of 1, 3, 5 or 10 minutes)
2. **Set the pace.** The **Pace** slider scales every phase from quicker (×0.75) to slower (×1.5). The dock shows the length of one breath.
3. **Begin / Pause / Resume / Again**, and **Reset.** The prompt, a countdown and the session's guided cues appear beneath the sun. A dome arc divides one breath into proportional segments (IN / HOLD / OUT / REST), and a dot travels it.
4. **Follow my breath (user-paced).** Toggle this mode, then press and hold **Breathe in** (or hold Space or Enter while it is focused, or press and hold the sky). The sun rises while you hold and sinks when you let go. Each breath lights a star, and the cue line reports your last breath ("in 4.1 s, out 5.8 s").
5. A session always ends on a completed out-breath. Settings changed during a session apply from the next breath. Changing the session restarts the cycle.
6. If you scroll away mid-session, a small pill keeps the prompt and countdown visible and links back. Switching tabs pauses the session.
7. **Sessions** list and **Rhythms** track: "Begin …" loads a session; "Breathe …" loads a rhythm into *Your rhythm* (still editable). Both scroll back to the hero and focus the main button.
8. Session, rhythm, length and pace are remembered in `localStorage`. Every access is wrapped in try/catch, so the site works without storage.

## Sections

0. **Breathe:** the landscape, prompt, status and dock.
1. **Sessions:** an index list of the four guided sessions, each with a live rhythm line.
2. **The arc of a breath:** sticky storytelling with an arched plate that moves through rise → zenith → descent → stillness.
3. **Rhythms:** a horizontal, scroll-snapped track of rhythm plates with previous/next buttons, including a live "Your rhythm" plate.
4. **Before you begin:** a split spread with a sticky statement, four steps with horizon glyphs and a note on care.
5. **The sanctuary:** a mist-coloured section with the brand statement under a great arc, three promises, and what ZENITH is and is not.
6. **First light list:** a validated sign-up form with an honest demo confirmation.
7. **Footer:** a starfield, navigation and the designed credit.

## Tech

- Static HTML, CSS and ES modules. No build step, no frameworks, no CDNs besides Google Fonts.
- `engine.js` contains:
  - `BreathEngine`, a time-based state machine adapted from the earlier unshipped breathing prototype (idle → running ⇄ paused → done)
  - `FreeBreath`, the user-paced model
  - `LandscapeRenderer`, a new Canvas 2D renderer
- `main.js` handles orchestration: dock, panel, free mode, render loop, rhythm diagrams, track, sticky plate, overlay index, reveals, scroll colour, form and footer stars.
- About 50 KB of hand-written JS (unminified), well under the 140 KB budget.

## Local development

```bash
npx serve .
```

Open the printed URL. ES modules need http(s), not `file://`.

## Accessibility

- `lang="en"`, a skip link, landmarks, one `<h1>` and a logical heading order.
- Every control is a native element: buttons, radio groups in `<fieldset>`/`<legend>`, range inputs with `<output>` and `aria-valuetext` ("One breath lasts 10 seconds"). All have a visible `:focus-visible` style.
- The canvas is decorative (`aria-hidden`), and its state is mirrored in text:
  - The prompt is an `aria-live="polite"` region, announced once per phase.
  - The remaining time uses `role="timer"`.
  - Breaths and sky stage are plain text.
- Free mode is fully keyboard operable (hold Space or Enter on the focused button), and the button carries instructions through `aria-describedby`.
- The session panel closes on Esc or an outside click and returns focus to the dock. The overlay index traps focus, closes on Esc and returns focus to its button.
- The form uses `novalidate` with inline errors linked through `aria-describedby` and `aria-invalid`, plus a `role="alert"` summary. Focus moves to the first invalid field. The success state says plainly that it is a portfolio demo and nothing was sent.
- `prefers-reduced-motion: reduce`:
  - Nothing animates on its own.
  - The guide still works, but **step-based**: the sun moves once per second, with no glint drift, ripples or twinkle.
  - Reveals and the arc plate switch instantly.
  - Rhythm dots stay still.
- Health copy: no medical claims. A care note advises skipping holds and consulting a professional where relevant, and repeats that you can return to natural breathing at any time.

## Performance

- One canvas and one 2D context. `devicePixelRatio` is capped at 2 on desktop and 1.5 on mobile. Small screens get fewer stars and glints.
- Hill silhouettes are generated once per resize as `Path2D` objects and only re-filled per frame.
- The render loop runs only while the hero is visible or a session is live. It stops on hidden tabs, which also pause the session. Under reduced motion the renderer redraws only when the visible state changes.
- No external images. The only network requests besides the site's own files are the two Google Fonts.

## Known limitations

- The canvas dome labels draw in a fallback sans-serif for a moment until Karla loads, then redraw.
- Animated SVG `stop-color` transitions on the arc plate need a recent Chromium, Safari or Firefox. Older engines switch the colours instantly.
- `backdrop-filter` falls back to a translucent dusk panel where unsupported.
- If Canvas 2D is unavailable, a CSS gradient landscape and a CSS sun (driven by the same engine) replace the canvas.
- The sign-up form makes no network calls (by design).

---

Designed & built by Saad Bashir — https://www.linkedin.com/in/saadbashirmarketing/
