# WoM Helper

[![English](https://img.shields.io/badge/docs-English-blue)](./README.md) [![简体中文](https://img.shields.io/badge/docs-简体中文-yellow)](./docs/README.zh-CN.md) [![日本語](https://img.shields.io/badge/docs-日本語-red)](./docs/README.ja.md) [![Русский](https://img.shields.io/badge/docs-Русский-orange)](./docs/README.ru.md) [![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/fzlins/WoM-Helper)

A Tampermonkey userscript for [minesweeper.online](https://minesweeper.online/) that enhances board configuration display, adds a No-Flag mode, shows event score projections, includes an auto-find-opponent toggle on the PvP page, provides one-click shortcuts on the Quests page, adds sell-max and market-price helpers in the Sell modal on the Marketplace page, and lets you toggle each feature from the Settings page.

## Settings

On the [Settings](https://minesweeper.online/settings) page, a **WoM Helper** section appears at the bottom of the settings panel. Use it to toggle the following features on or off; changes take effect the next time you navigate to that feature's page — no page reload required:

- Board links & mine density
- Event score projection
- Quest collect-all
- My-rank auto-scroll
- Sell max & market price

## Features

- **Board links & mine density** — Any `WxH/M` board spec anywhere on the page (e.g. `30x16/99`) is automatically turned into a clickable link that launches that exact game. By default, hovering a link shows the mine density as a tooltip. On the Settings page you can switch to showing the density inline next to each link, or disable the feature entirely.

- **NF (No-Flag) toggle** — A **NF** checkbox appears next to the difficulty selector on game pages (works on both desktop and mobile). When checked, right-clicking on the board is disabled, preventing accidental flag placement — perfect for practicing No-Flag style. The setting is remembered between sessions.
- **Event stats column** — On the [Events](https://minesweeper.online/events) page, an **Est. Total** column appears in the leaderboard showing each player's projected total points by the end of the event, based on their current pace. Hover any cell to see the daily average.
- **Auto-scroll to my rank** — When the leaderboard loads or your rank changes after a stats update, the page automatically scrolls to your position in the table. Navigating between leaderboard pages does not trigger this.
- **Auto-find opponent (PvP)** — On the [PvP](https://minesweeper.online/pvp) page, an **Auto** checkbox appears next to the *Find Opponent* button. When checked, the button is pressed automatically whenever it becomes available — on page load, after each match, or after a timeout. Click *Cancel* to stop. The setting is remembered between sessions.
- **Quest collect-all** — On the [Quests](https://minesweeper.online/quests) page, a *Collect All* button appears at the top of each quest category whenever rewards are ready to collect. One click claims every available reward in that section; the button disappears once all are claimed.
- **Sell max & market price** — On the [Marketplace](https://minesweeper.online/marketplace) page, the Sell modal gains two helpers per row: a **▲** link next to the quantity field that fills it with the maximum amount you own, and a **🏷** link next to the price field that automatically fetches the current market price via the site's WebSocket. A matching header link lets you fill all rows at once.

## Installation

**Option A — Greasy Fork (recommended)**

Install directly from [Greasy Fork](https://greasyfork.org/scripts/578042-minesweeper-online-helper).

**Option B — Manual**

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open [wom-helper.user.js](https://raw.githubusercontent.com/fzlins/WoM-Helper/main/wom-helper.user.js) in your browser.
3. Tampermonkey will prompt you to install it — click **Install**.

> **Script not working?** Tampermonkey 5.3+ on Chrome-based browsers requires an extra one-time step before userscripts can run. See [Q209: Permission to execute userscripts](https://www.tampermonkey.net/faq.php?q=Q209#Q209) for instructions:
> - **Chrome/Edge 138+** — Right-click the Tampermonkey icon → *Manage Extension* → enable **Allow User Scripts**.
> - **Older Chrome/Edge** — Go to `chrome://extensions` (or `edge://extensions`) and enable **Developer Mode**.

## License

[MIT](./LICENSE)
