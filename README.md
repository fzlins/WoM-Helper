# WoM Helper

[English](./README.md) [简体中文](./docs/README.zh-CN.md) [日本語](./docs/README.ja.md) [Русский](./docs/README.ru.md) [DeepWiki](https://deepwiki.com/fzlins/WoM-Helper)

A Tampermonkey userscript for [minesweeper.online](https://minesweeper.online/) that enhances board configuration display, adds a No-Flag mode, shows event score projections, includes an auto-find-opponent toggle on the PvP page, and provides one-click shortcuts on the Quests page.

## Features

- **Board links & mine density** — Any `WxH/M` board spec anywhere on the page (e.g. `30x16/99`) is automatically turned into a clickable link that launches that exact game. The mine density percentage is shown right after each spec, so you can gauge difficulty at a glance.
- **NF (No-Flag) toggle** — A **NF** checkbox appears next to the difficulty selector on game pages (works on both desktop and mobile). When checked, right-clicking on the board is disabled, preventing accidental flag placement — perfect for practicing No-Flag style. The setting is remembered between sessions.
- **Event stats column** — On the [Events](https://minesweeper.online/events) page, a 🎯 column appears in the leaderboard showing each player's projected total points by the end of the event, based on their current pace. Hover any cell to see the daily average.
- **Auto-scroll to my rank** — When the leaderboard loads or your rank changes after a stats update, the page automatically scrolls to your position in the table. Navigating between leaderboard pages does not trigger this.
- **Auto-find opponent (PvP)** — On the [PvP](https://minesweeper.online/pvp) page, an **Auto** checkbox appears next to the *Find Opponent* button. When checked, the button is pressed automatically whenever it becomes available — on page load, after each match, or after a timeout. Click *Cancel* to stop. The setting is remembered between sessions and works regardless of the site language.
- **Quest collect-all** — On the [Quests](https://minesweeper.online/quests) page, a *Collect All* button appears at the top of each quest category whenever rewards are ready to collect. One click claims every available reward in that section; the button disappears once all are claimed.

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

## Density Formula

$$\text{density} = \frac{\text{mines}}{W \times H} \times 100\%$$

## License

[MIT](./LICENSE)
