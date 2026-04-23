# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static landing page for **Pousinox** — a manufacturer of stainless steel porcelain tile fixers (fixadores de porcelanato) based in Pouso Alegre, MG, Brazil. Deployed via GitHub Pages at `fixadorporcelanato.com.br`.

No build tools, no package manager, no compilation step. All files are served directly.

## Deployment

- **Live branch:** `gh-pages` — this is what GitHub Pages serves. Pushing to `gh-pages` deploys to production.
- **Development branch:** `main`
- **Domain:** configured via `CNAME` → `fixadorporcelanato.com.br`
- To preview locally, open `index.html` directly in a browser or use any static file server (e.g. `npx serve .` or VS Code Live Server).

## Architecture

### File Structure

| File | Purpose |
|---|---|
| `index.html` | Main landing page (single-page, all sections inline) |
| `admin/index.html` | Admin panel for managing dynamic content |
| `static/styles-v7.css` | Active CSS — **always edit this file, not `styles.css`** |
| `static/app.js` | Main JS: admin config injection, UI interactions, form submission |
| `static/admin.css` | Admin panel styles |
| `static/admin.js` | Admin panel logic |
| `static/config.json` | Default config schema (reference only — not loaded at runtime) |

### Admin → Landing Page Data Flow

The admin panel (`/admin/`) lets the owner update WhatsApp number/message, product images (via URL), and YouTube video URLs. Changes are saved to `localStorage` under the key `pousinox_config`.

On every page load, `app.js` runs an IIFE (`applyAdminConfig`) that reads `localStorage('pousinox_config')` and:
1. Updates all `a[href*="wa.me"]` links with the configured number and message.
2. Replaces image placeholder elements (identified by `aria-label` or CSS class) with `<img>` tags sourced from the configured URLs.
3. Sets `data-video-url` attributes on `.video-embed-placeholder` elements with normalized YouTube embed URLs.

When the admin saves changes in a separate tab, it posts a `POUSINOX_CONFIG_UPDATE` message via `window.postMessage`, and `app.js` listens for this to trigger `location.reload()`.

### CSS Versioning / Cache Busting

CSS is versioned by filename (`styles-v7.css`). When making significant CSS changes that need to bust browser cache, rename the file (e.g. `styles-v8.css`) and update the `<link>` in `index.html`.

### Form Submission

The contact form (`#lead-form`) submits via `fetch` to `formsubmit.co/adm@pousinox.com.br` — no backend required.

## Key Conventions

- All text content is in Portuguese (pt-BR).
- CSS custom properties are defined in `:root` in `styles-v7.css` — use these variables rather than hardcoded values.
- Animate-on-scroll uses the class `animate-on-scroll`; JS adds `in-view` when the element enters the viewport via `IntersectionObserver`.
- Counter animations use `data-counter` (integer) and `data-counter-decimal` (float) attributes.
- Video placeholders use the class `video-embed-placeholder` with a `data-video-url` attribute; clicking them replaces the placeholder with an `<iframe>`.
