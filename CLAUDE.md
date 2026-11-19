# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static GitHub Pages personal portfolio site for Kaiwen Li (CMU Mathematics). No build system, no package manager, no frameworks — every page is a self-contained HTML file with embedded CSS and JavaScript. Changes are deployed by pushing to `main`.

## Running locally

Open any `.html` file directly in a browser, or serve the directory:

```
python3 -m http.server 8080
```

## Design system

All pages share a dark GitHub-inspired theme via CSS custom properties defined in each file's `<style>` block:

```css
--bg: #0d1117;
--card: #161b22;
--text: #c9d1d9;
--sub: #8b949e;
--border: #30363d;
--highlight: #f0f6fc;
```

Fonts: **Inter** (body) and **JetBrains Mono** (code/monospace), both loaded from Google Fonts.

## Page structure

Every page uses the same two-column layout: a sticky left `<nav>` sidebar (220px wide, collapses to a top bar on mobile at ≤850px) and a `.container` content area (max-width 800px). When adding a new page, copy the nav and shared CSS from an existing page — the nav list in `index.html` is the authoritative list of all pages.

## Pages and their purpose

| File | Content |
|------|---------|
| `index.html` | Home/landing — profile header + MegaGem featured project |
| `education.html`, `experience.html`, `honors.html`, `interests.html` | Static resume content |
| `news.html` | News intelligence engine project |
| `todo.html` | Interactive To-Do List Planner (JS app) |
| `megagem.html` | MegaGem Live project showcase |
| `habits.html` | Habits tracker (CMU 15-113 course project) |
| `bingbeats.html` | Bing Beats music app |

## Conventions

- All styling is inline per-page — there is no shared stylesheet.
- Interactive apps (todo, habits, bingbeats) keep their JavaScript embedded in a `<script>` tag at the bottom of the file.
- The sidebar footer in `index.html` shows contact info; other pages omit it.
- Nav links use `class="active"` on the link matching the current page.