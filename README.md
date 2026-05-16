# WoM Helper

[English](./README.md) [简体中文](./docs/README.zh-CN.md) [日本語](./docs/README.ja.md) [Русский](./docs/README.ru.md) [DeepWiki](https://deepwiki.com/fzlins/WoM-Helper)

- **Dynamic content** — Uses a `MutationObserver` to handle content loaded after the initial page render.A Tampermonkey userscript for [minesweeper.online](https://minesweeper.online/) that enhances board configuration display, adds a No-Flag mode, shows event score projections, includes an auto-find-opponent toggle on the PvP page, and provides one-click shortcuts on the Quests and Marketplace pages.

## Features

- **Board links & mine density** — Any `WxH/M` board spec anywhere on the page (e.g. `30x16/99`) is automatically turned into a clickable link that launches that exact game. The mine density percentage is shown right after each spec, so you can gauge difficulty at a glance.
- **NF (No-Flag) toggle** — An auxiliary feature for players who want to practice No-Flag play style. On game pages, a checkbox labeled **NF** is injected after the *Custom* level selector (desktop row and mobile dropdown). When checked, all right-click input on the game board is blocked, preventing accidental flag placement. The setting persists across sessions via `localStorage`.
- **Event stats column** — On the [/events](https://minesweeper.online/events) page, a 🎯 column is appended to the ranking table showing each player's projected total event points at the event's end, based on their current pace. Hovering a cell reveals the `/d` (daily) average in a tooltip.
- **Auto-click my rank** — Whenever a page loads and `#stat_my_rank` contains a valid rank number, the rank link is clicked automatically (once). If the rank value changes after a stats refresh, it is clicked again. Pagination changes are naturally ignored.
- **Auto-find opponent (PvP)** — On the [/pvp](https://minesweeper.online/pvp) page, an **Auto** checkbox is injected next to the *Find Opponent* button. When checked, the button is clicked automatically whenever it becomes available (on page load and again after each match or timeout). Clicking *Cancel* unchecks the box and stops the loop. The setting persists across sessions via `localStorage`. Works on all language variants of the page.
- **Quest collect-all** — On the [/quests](https://minesweeper.online/quests) page, a *Collect All* button appears in the header of each quest table whenever rewards are waiting to be claimed. One click claims every available reward in that table; the button disappears automatically once all are claimed.
- **Sell max & market price** — In the sell dialog on the [/marketplace](https://minesweeper.online/marketplace) page, a **▲** link fills the quantity field with the maximum amount you own; a **🏷** link fetches and fills the current market price for that item. Both links are available per-row and as column header links that apply to all rows at once.

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
