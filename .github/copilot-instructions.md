# WoM-Helper Copilot Instructions

## Project Overview

This is a single-file Tampermonkey userscript for [minesweeper.online](https://minesweeper.online). It adds quality-of-life helpers for board links, No-Flag play, event projections, PvP auto-finding, collect-all shortcuts, sell helpers, equipment advice, profile link copying, board generation, and a Settings page for toggling individual features. The script runs entirely in the browser with no external requests.

## Version Numbering

The version is declared in the `@version` field of the UserScript metadata block at the top of `wom-helper.user.js`. Versions always use three segments: `MAJOR.MINOR.PATCH`.

**Only update the version when the user explicitly asks to commit or publish, or when they ask you to bump the version.** Do not bump the version on every individual edit during an iterative working session — multiple rounds of changes in one conversation count as a single version bump at the end. If the user has not mentioned committing or publishing, leave the version unchanged.

**Only update the version when `wom-helper.user.js` itself is modified.** If the commit only touches other files (READMEs, docs, `.github/`, etc.), leave the version unchanged.

| Commit type              | Version segment to increment |
| ------------------------ | ---------------------------- |
| `feat:` / `refactor:`   | **Minor** — bump minor, reset patch to `0` — e.g. `1.4.1` → `1.5.0` |
| All other types (`fix:`, `docs:`, `chore:`, `style:`, etc.) | **Patch** — e.g. `1.5.0` → `1.5.1` |

## File Structure

```
wom-helper.user.js   ← the entire script; single entry point
docs/
  README.zh-CN.md    ← Simplified Chinese translation
```

## Code Conventions

- **Language**: plain ES2020+ JavaScript; no build tools, no dependencies.
- **Style**: 4-space indentation, single-quoted strings, semicolons required.
- **IIFE wrapper**: all code lives inside the top-level `(function () { 'use strict'; ... })();`.
- **Processed markers**: use specific DOM attributes or `data-*` markers to avoid duplicate work; do not rely on global processing flags unless required.
- **MutationObservers**: preferred over polling. Disconnect them as soon as their job is done; keep them alive only when they must survive SPA navigation.
- **`localStorage` keys**: use the `ms-` prefix (e.g. `ms-feat-board-links`, `ms-feat-auto-duel`).
- **CSS**: inject styles inline via `.style.cssText`; do not create `<style>` tags unless unavoidable.
- **No external requests**: `@grant none` — the script must not make any network requests of its own.
- **Feature toggles**: prefer `featEnabled(key)` and per-feature `localStorage` defaults so features stay enabled unless a user turns them off.

## Feature Sections (in file order)

1. **Board links & density** (`walk`, `processTextNode`, `processAnchor`, `makeLink`, `makeDensitySpan`)  
   Converts `WxH/M` text into clickable links pointing to `/start/WxH/M` and optionally shows mine density inline or as a tooltip.

2. **No-Flag toggle** (`initNF`, `applyNF`, `makeNFCheckbox`)  
   Injects a checkbox into the game-level selectors on desktop/mobile that blocks right-click / contextmenu events on `#game` in the capture phase and persists the setting in `localStorage`.

3. **Event stats** (`initEventStats`)  
   On `/events` pages, adds an `Est. Total` column to `#stat_table` showing each player's projected end-of-event total based on their current pace. The values use Bootstrap 3 tooltips.

4. **Auto-duel** (`initAutoDuel`)  
   On `/pvp` pages, injects an Auto checkbox that re-clicks `#start_duel_btn` whenever it becomes enabled and stops when the user clicks `#cancel_duel_btn`.

5. **Collect-all buttons** (`initCollectAll`)  
   Runs on any table with collect actions. It checks the first column first and falls back to the last column when needed, then inserts a one-click `Collect All` control that auto-clicks every matching action in that column and removes itself when no collectable rows remain.

6. **My-rank auto-scroll** (`initMyRankClick`)  
   Watches `#stat_my_rank` and auto-clicks the player's `.position` link when the rank changes, scrolling the leaderboard to that row.

7. **Sell max & market price** (`initSellMaxBtn`)  
   On `/marketplace` pages, watches the sell modal (`#selling_content`) and adds `▲` helpers to fill quantity fields with the maximum owned count and `🏷` helpers to fetch the current market price via the site's existing AJAX/WebSocket flow before filling the price field.

8. **Quest Advisor** (`initQuestAdvisor`)  
   On `/equipment` pages, injects a panel that reads the current Minecoin bonus from the all-stats popover, accepts a target and number of plays, and recommends the best board to reach the goal as a clickable link.

9. **Player link copy icon** (`initPlayerLinkCopy`)  
   Appends a copy icon after profile links with IDs starting in `player_link_`, copying the full absolute profile URL to the clipboard with one click.

10. **Board generator** (`initBoardGenerator`)  
    On NFT edit pages, adds a `Board Generator` button next to the reset control. It reads the saved digit counts and generates a local board layout from them, then displays the generated result inline.

11. **Settings panel** (`initSettings`)  
    On `/settings` pages, inserts a WoM Helper section with per-feature toggles and a select mode for board links, saving changes in `localStorage` so they take effect on the next relevant page load without reloading.

## Entry Point

```
init()
   ├─ walk(document.body)                     — initial DOM scan
   ├─ initPageFeatures()                     — page-gated NF + auto-duel setup
   ├─ initEventStats()                       — event leaderboard column
   ├─ initCollectAll()                       — global collect-all buttons
   ├─ initMyRankClick()                      — auto-scroll on rank changes
   ├─ initSettings()                         — add feature toggles on /settings
   ├─ initSellMaxBtn()                       — Marketplace sell helpers
   ├─ initQuestAdvisor()                     — Equipment recommendation panel
   ├─ initPlayerLinkCopy()                   — player-link copy icon
   ├─ initBoardGenerator()                   — generate boards from saved counts
   ├─ onDomChange(...)                       — process newly added nodes
   └─ path-based reinitialization            — rerun page-gated features on navigation
```

## SPA Navigation

The site updates the URL via `pushState`/`replaceState` and DOM mutations. The userscript reacts to path changes and re-runs the page-gated setup instead of relying on fragile history monkey-patching. Persistent observers such as event and rank tracking stay active across navigations.

## Adding a New Feature

1. Write a self-contained `initXxx()` function.
2. If it is page-specific, gate it with a path check inside `initPageFeatures()` or via an internal path guard.
3. If it needs to run on every page, call it directly from `init()`.
4. Bump the **minor** version in `@version` (three-segment, e.g. `1.5.0`) only when the user explicitly asks for a release or version bump.
5. Update `@description` if the feature is user-visible.
6. Update `README.md` and all `docs/README.*.md` translations to document the new feature. Write feature descriptions from the player's perspective: explain what the player does to trigger the feature and what benefit they get, using plain language. Avoid implementation details, internal function names, and DOM terminology — players should be able to understand the feature's purpose from the description alone.

## Maintenance Notes

- Prefer targeted DOM checks and `MutationObserver` usage rather than heavy polling.
- Keep feature toggles user-visible and discoverable through the Settings page when relevant.
- Prefer helpful, player-facing descriptions in docs and strings over technical implementation notes.
- Keep `@grant none` and avoid browser-side network calls that are not already available on the site.
