# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kaiwen Li's personal portfolio, a **pure static site** served by GitHub Pages from the `main`
branch of `kli_create.github.io` (a GitHub user site, so it publishes at the repo root — no
`docs/` folder, no CNAME). There is **no build step, no bundler, no package manager, no tests,
and no lint** — files are hand-authored and served as-is. Edit HTML/CSS/JS directly and the
change is live on push.

## Commands

```bash
# Serve locally (any static server works; this is what's been used here)
python3 -m http.server 8931 --bind 127.0.0.1   # then open http://127.0.0.1:8931

# Visual checks / screenshots have been done with Playwright via npx
npx playwright ...
```

There is nothing to build, compile, or test. "Deploy" = commit and push to `main`.

## Architecture

### Page structure — duplicated shell, no templating
There are 8 standalone HTML pages (`index.html` plus `education`, `experience`, `honors`,
`interests`, `bingbeats`, `megagem`). **Every page duplicates the entire `<head>`, the
`.site-nav`, the `.overlay-menu`, the `.ambient` background container, and the `.site-footer`
inline.** There is no partial/include system, so any change to navigation, fonts, meta tags, or
the footer must be applied to **all 8 files**. Keep them in sync manually.

Every page loads the same three shared assets, in this order:
`styles.css` → `site.js` → `signature.js`.

### Two independent animation layers
The site's motion comes from two scripts that each run their **own** `requestAnimationFrame`
loop and their **own** cursor-lerp state — they do not share state and both attach their own
`pointermove` listeners:

- **`site.js`** — the "portfolio interactions" layer. Owns the constellation/particle canvas
  (appended into `.ambient`), cursor parallax on orbs + hero, per-character cursor-repel on big
  headings (`moveWords()`), scroll-triggered reveals, the overlay menu, magnetic buttons, and
  3D tilt.
- **`signature.js`** — the "signature/math" layer, loaded on top. Owns a **second** canvas
  running Conway's Game of Life (seeded by the cursor, gliders on click), a hand-rolled 4D
  tesseract projection, and a **hidden terminal** opened by pressing the **backtick (`` ` ``)**
  key. The terminal implements commands (`help`, `resume`, `prove`, `prime`, `collatz`, `fib`,
  `life`, `glider`, `spin`, `open`, …) parsed in a `switch` around `signature.js:441`; the
  command list lives in the `COMMANDS` array (`signature.js:426`).

Both canvases live inside the single `<div class="ambient">` element — that container must
exist on every page or the animations silently no-op.

### Behavior wired by data attributes
JS discovers elements by attribute/class rather than IDs:
- `data-reveal` — element fades/slides in via IntersectionObserver; stagger controlled by an
  inline `style="--d: <seconds>"` custom property.
- `data-tilt` — element gets pointer-driven 3D tilt.
- `.glass-card`, `.btn`, `.hero-name`/`.display`/`.section-title` — targeted for glow, magnetic,
  and per-character effects respectively.

### Motion is intentionally NOT reduced-motion-aware
`site.js` hardcodes `const reduceMotion = false` and explicitly ignores the OS
"prefers-reduced-motion" setting by design. Most effects are additionally gated behind
`finePointer` (`pointer: fine`) so touch devices skip cursor-driven work.

### Styling — token-driven, dark, glassmorphic
`styles.css` defines the whole design system as CSS custom properties in `:root` (near the top):
color tokens (`--bg`, `--ink`, `--a-violet`, `--a-cyan`, …), gradient tokens (`--grad-text`,
`--grad-line`), four font-family tokens (`--font-display/serif/mono/body` → Space Grotesk /
Instrument Serif / JetBrains Mono / Inter, loaded from Google Fonts), and an `--ease-out`
easing. Prefer these tokens over hard-coded values. Gradient text is done with
`background: var(--grad-text)` + `background-clip: text`, which is why `moveWords()` treats
gradient words (`em`, `.shine`, `.serif-accent`, `.hl`) as single units instead of splitting them
per character.

## Gotchas

- **Unreferenced image files exist in the repo** (e.g. large `.jpg`/`.png` files). Only
  `381769150556_.pic.jpg` is actually used (in `index.html`). Grep before assuming an image is
  live, and grep before deleting one.
- Adding a nav link means editing the `.site-nav` **and** the `.overlay-menu` on all 8 pages.
- New animated background effects need the `.ambient` container and should follow the existing
  pattern of appending a `<canvas>` into it rather than adding a new full-screen element.
