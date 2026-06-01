# WoM-Helper Copilot Instructions

## Project Overview

This is a single-file Tampermonkey userscript (`wom-helper.user.js`) for [minesweeper.online](https://minesweeper.online). It enhances the site with several quality-of-life features and runs entirely in the browser via the userscript engine.

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

5. **Collect-all buttons** (`initCollectAll`)  
   Single shared implementation with one feature toggle key. It runs on all `table.table` instances (no path gating): for each table, it first checks whether collect buttons exist in the first column; if found, it injects *Collect All* into the first cell of the first row. Otherwise it checks the last column and injects into the last cell of the first row when found. If neither column has collect buttons, no button is shown. The button auto-clicks all `collect_btn` elements in that detected column and is removed when no collectable rows remain.

6. **My-rank auto-click** (`initMyRankClick`)  
   Watches `#stat_my_rank` and auto-clicks the `.position` anchor whenever the rank value changes, scrolling the leaderboard to the player's row.

7. **Sell max & market price** (`initSellMaxBtn`)  
   On `/marketplace` pages, watches the sell modal (`#selling_content`) via MutationObserver. Injects a **▲** link per row (and in the quantity column header) to fill each quantity input with the player's maximum owned amount. Also injects a **🏷** link per row (and in the price column header) that triggers the site's Bootstrap popover on the item's `.help` span to load the market price via Socket.IO, then polls `.market_price_{id}` until a numeric value or `n/a` appears and fills the price input accordingly. Sequential fetch with 150 ms delay between rows for the header link.

## Entry Point

```
init()
   ├─ walk(document.body)        — initial DOM scan
   ├─ initPageFeatures()         — NF toggle + auto-duel + sell max (path-gated)
   ├─ initEventStats()           — event leaderboard column
   ├─ initCollectAll()           — global collect-all buttons (first/last column detection)
   ├─ initMyRankClick()          — rank auto-click
   ├─ MutationObserver(walk)     — process newly added nodes
   └─ history patch              — re-run initPageFeatures() on SPA navigation
```

## SPA Navigation

The site uses `pushState`/`replaceState` for navigation. The script monkey-patches both methods and listens for `popstate` to call `initPageFeatures()` on every navigation. `initEventStats` and `initMyRankClick` use persistent observers that self-manage across navigations.

## Adding a New Feature

1. Write a self-contained `initXxx()` function.
2. If it is page-specific, gate it with a path check inside `initPageFeatures()` or via an internal path guard.
3. If it needs to run on every page, call it directly from `init()`.
4. Bump the **minor** version in `@version` (three-segment, e.g. `1.5.0`).
5. Update `@description` if the feature is user-visible.
6. Update `README.md` and all `docs/README.*.md` translations to document the new feature. Write feature descriptions from the player's perspective: explain what the player does to trigger the feature and what benefit they get, using plain language. Avoid implementation details, internal function names, and DOM terminology — players should be able to understand the feature's purpose from the description alone.
