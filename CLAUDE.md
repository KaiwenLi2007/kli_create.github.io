# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kaiwen Li's personal portfolio, a **pure static site** served by GitHub Pages from the `main`
branch of `kli_create.github.io` (a GitHub user site, so it publishes at the repo root — no
`docs/` folder, no CNAME). There is **no build step, no bundler, no package manager, no tests,
and no lint** — files are hand-authored and served as-is. "Deploy" = commit and push to `main`.

## Commands

```bash
# Serve locally (any static server works; this is what's been used here)
python3 -m http.server 8931 --bind 127.0.0.1   # then open http://127.0.0.1:8931

# Visual checks / screenshots have been done with Playwright via npx.
# On this WSL2 machine the browser deps need a one-time (password-gated):
#   sudo npx playwright install-deps chromium
npx playwright ...
```

## Design concept — "monochrome until you move"

This is the site's core idea; preserve it in any change:

- **Two themes** via `data-theme` on `<html>`: the default is **light "paper"** (`:root` tokens —
  ink `#17150f` on `#f2efe6`); the alternate is dark (`:root[data-theme="dark"]`). A toggle
  button (bottom-left, injected by `site.js`) persists the choice to `localStorage["kl-theme"]`.
- **The page is black-and-white at rest; colour is earned by movement.** `site.js` owns
  `window.__klMotion = { energy, hue }`: `energy` rises with cursor speed and decays every frame
  (`*= 0.94`), `hue` tracks pointer x. `signature.js` reads the same object. Canvas layers paint
  with `hsla(...)` whose *saturation* is proportional to `energy` — grey when idle, colourful in
  motion. **Do not add permanently-coloured elements**; the only static colour is the sparing
  accent (`--accent` / `--accent-rgb`, vermilion in light / coral in dark) used for tiny marks
  (status dot, hero-prompt caret, bio underlines, card hover glow).
- All colour flows from CSS custom properties in `styles.css` `:root` /
  `:root[data-theme="dark"]`. Theme-dependent translucent overlays use
  `rgba(var(--tint-rgb), α)` (ink-on-paper vs white-on-black). The historical AI-slop look
  (violet/cyan gradient text, aurora orbs, glass blur everywhere, neon glows) was deliberately
  removed — don't reintroduce it.
- **Exception:** the terminal, `.code-block`, and toast are dark-pinned widgets — they stay dark
  in *both* themes, and their inner text colours are intentionally hardcoded (not tokens).

## Architecture

### Page structure — duplicated shell, no templating
There are **6 standalone HTML pages**: `index.html`, `experience.html` (education + work + 
involvement merged), `honors.html` (titled/labelled **"Achievements"** — the filename is
historical), `interests.html`, `bingbeats.html`, `megagem.html`. **Every page duplicates the
entire `<head>`, the `.site-nav`, the `.overlay-menu` (numbered indices), the `.ambient`
background container, and the `.site-footer` inline.** There is no partial/include system, so a
nav/footer/meta change must be applied to **all 6 files**, keeping the overlay-menu index
numbers sequential.

Every page loads the same three shared assets, in this order:
`styles.css` → `site.js` → `signature.js`.

### Two independent animation layers
Both scripts run their **own** `requestAnimationFrame` loop and their **own** cursor-lerp state:

- **`site.js`** — theme init + toggle, motion-energy tracking (`window.__klMotion`), the
  constellation/particle canvas (appended into `.ambient`), cursor glow (colour from motion
  energy), cursor parallax on orbs + hero, per-character cursor-repel on big headings
  (`moveWords()` — batched read-then-write to avoid forced reflow; keep it that way),
  scroll reveals, overlay menu, magnetic buttons, 3D tilt.
- **`signature.js`** — Conway's Game of Life (second canvas in `.ambient`, cursor-seeded,
  gliders on click), the 4D tesseract (canvas inside `.hero`, **home page only** — code guards
  on element existence), the on-demand **globe** overlay (Fibonacci sphere, canvas appended to
  `<body>` when first summoned), the hidden **terminal**, and the Konami code.

The `.ambient` container must exist on every page or the background animations silently no-op.
New background effects should append a `<canvas>` into `.ambient` and follow the motion-colour
contract above.

### The terminal
Opened with backtick (`` ` ``), the floating `.term-launcher`, or the `.hero-prompt` button in
the home hero. Commands are parsed in the `exec()` switch in `signature.js` (search for
`function exec`); the tab-completion list is the `COMMANDS` array and page navigation aliases
live in the `PAGES` map just above it (e.g. `education` → `experience.html`). Notable commands:
`resume`, `prove`, `prime`, `collatz`, `fib`, `life on|off|soup`, `glider [n]`, `spin`,
`globe` (aliases `sphere`/`earth`; `globe off` or Esc dismisses). **All terminal output is
rendered via `textContent`/`createTextNode` (the `print`/`printCmd` helpers) — never switch
this to `innerHTML`**, since it echoes arbitrary user input.

### Behavior wired by data attributes
- `data-reveal` — IntersectionObserver fade/slide-in; stagger via inline `style="--d: <s>"`.
- `data-tilt` — pointer-driven 3D tilt.
- `.glass-card`, `.btn`, `.hero-name`/`.display`/`.section-title` — glow, magnetic, and
  per-character effects respectively. `moveWords()` treats gradient words (`em`, `.shine`,
  `.serif-accent`, `.hl`) as single units so their `background-clip: text` stays intact; those
  spans have a solid `color: var(--ink)` fallback inside an `@supports` block — keep the
  fallback when touching them.

### Motion is intentionally NOT reduced-motion-aware
`site.js` hardcodes `const reduceMotion = false` by design. Most cursor-driven effects are
gated behind `finePointer` (`pointer: fine`) so touch devices skip them.

## Gotchas

- **Nav edits touch 6 files** — both the `.site-nav` and the `.overlay-menu` (renumber the
  `idx` spans). A regeneration script pattern exists in git history if the list changes again.
- **Unreferenced image files exist in the repo** (large `.jpg`/`.png`). Only
  `381769150556_.pic.jpg` is actually used (the portrait in `index.html`). Grep before assuming
  an image is live, and grep before deleting one.
- `honors.html` = the "Achievements" page; the terminal `PAGES` map and nav labels already
  reflect this — keep filename and label mapping consistent when linking.
- The résumé content (degree: B.S. Mathematics, Discrete Mathematics & Logic — Mellon College
  of Science) is mirrored in several places: home bio, hero tag, `experience.html`,
  `honors.html`, and the terminal's `resume`/`whoami`/boot banner in `signature.js`. Update all
  of them together.
- `spinBoost` in `signature.js` is shared by the tesseract and the globe; its per-frame decay
  must run on every page, not only where the tesseract exists.
