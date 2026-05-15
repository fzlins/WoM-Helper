# WoM-Helper Copilot Instructions

## Project Overview

This is a single-file Tampermonkey userscript (`wom-helper.user.js`) for [minesweeper.online](https://minesweeper.online). It enhances the site with several quality-of-life features and runs entirely in the browser via the userscript engine.

## Version Numbering

The version is declared in the `@version` field of the UserScript metadata block at the top of `wom-helper.user.js`. **Always update the version on every commit.**

| Commit type              | Version segment to increment |
| ------------------------ | ---------------------------- |
| `feat:` / `refactor:`   | **Minor** — e.g. `1.4` → `1.5` |
| All other types (`fix:`, `docs:`, `chore:`, `style:`, etc.) | **Patch** — e.g. `1.4.0` → `1.4.1` |

> If the current version has no patch segment (e.g. `1.4`) and a patch bump is needed, append `.1` (→ `1.4.1`).

## File Structure

```
wom-helper.user.js   ← the entire script; single entry point
docs/
  README.ja.md       ← Japanese translation of README
  README.ru.md       ← Russian translation
  README.zh-CN.md    ← Simplified Chinese translation
```

## Code Conventions

- **Language**: plain ES2020+ JavaScript; no build tools, no dependencies.
- **Style**: 4-space indentation, single-quoted strings, semicolons required.
- **IIFE wrapper**: all code lives inside the top-level `(function () { 'use strict'; ... })();`.
- **`PROCESSED` attribute** (`data-ms-done`): used on DOM nodes to prevent duplicate processing. Set it on every node you mutate.
- **MutationObservers**: preferred over polling. Disconnect them as soon as their job is done; keep them alive only when they must survive SPA navigation.
- **`localStorage` keys**: use the `ms-` prefix (e.g. `ms-nf-enabled`, `ms-auto-duel-enabled`).
- **CSS**: inject styles inline via `.style.cssText`; do not create `<style>` tags unless unavoidable.
- **No external requests**: `@grant none` — the script must not make any network requests of its own.

## Feature Sections (in file order)

1. **Board links & density** (`walk`, `processTextNode`, `processAnchor`, `makeLink`, `makeDensitySpan`)  
   Converts `WxH/M` text into `<a>` links pointing to `/start/WxH/M` and appends a mine-density percentage span.

2. **No-Flag toggle** (`initNF`, `applyNF`, `makeNFCheckbox`)  
   Injects a checkbox into `#levels_full` (desktop) and `#levels_compact` (mobile) that blocks right-click / contextmenu events on `#game` in the capture phase. State saved in `localStorage`.

3. **Event stats** (`initEventStats`)  
   On `/events` pages, appends a 🎯 column to `#stat_table` showing each player's projected end-of-event total based on elapsed days since the 4th of the current month. Tooltips use Bootstrap 3's `$.fn.tooltip`.

4. **Auto-duel** (`initAutoDuel`)  
   On `/pvp` pages, injects an "Auto" checkbox that automatically re-clicks `#start_duel_btn` whenever it becomes enabled. Cancelled by clicking `#cancel_duel_btn`. State saved in `localStorage`.

5. **My-rank auto-click** (`initMyRankClick`)  
   Watches `#stat_my_rank` and auto-clicks the `.position` anchor whenever the rank value changes, scrolling the leaderboard to the player's row.

## Entry Point

```
init()
  ├─ walk(document.body)        — initial DOM scan
  ├─ initPageFeatures()         — NF toggle + auto-duel (path-gated)
  ├─ initEventStats()           — event leaderboard column
  ├─ initMyRankClick()          — rank auto-click
  ├─ MutationObserver(walk)     — process newly added nodes
  └─ history patch              — re-run initPageFeatures() on SPA navigation
```

## SPA Navigation

The site uses `pushState`/`replaceState` for navigation. The script monkey-patches both methods and listens for `popstate` to call `initPageFeatures()` on every navigation. `initEventStats` and `initMyRankClick` use persistent observers that self-manage across navigations.

## Adding a New Feature

1. Write a self-contained `initXxx()` function.
2. If it is page-specific, gate it with a path check inside `initPageFeatures()`.
3. If it needs to run on every page, call it directly from `init()`.
4. Bump the **minor** version in `@version`.
5. Update `@description` if the feature is user-visible.
