# WoM Helper

A Tampermonkey userscript for [minesweeper.online](https://minesweeper.online/) that enhances board configuration display.

## Features

- **Clickable board links** — Any plain `WxH/M` text (e.g. `58x35/393`) is automatically converted into a clickable link that starts a game with that configuration.
- **Mine density** — Displays the mine density percentage after each board spec, e.g. `58x35/393 (19.36%)`.
- **Language-aware links** — Links are generated using the current page's language prefix (e.g. `/cn/start/58x35/393` on Chinese pages, `/start/58x35/393` on English pages).
- **Dynamic content** — Uses a `MutationObserver` to handle content loaded after the initial page render.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open the Tampermonkey dashboard and click **Create a new script**.
3. Replace the default content with [minesweeper-helper.user.js](./minesweeper-helper.user.js).
4. Save. The script activates automatically on `https://minesweeper.online/*`.

## Density Formula

$$\text{density} = \frac{\text{mines}}{W \times H} \times 100\%$$

Example: `58x35/393` → $393 \div (58 \times 35) \approx 19.36\%$

## License

[MIT](./LICENSE)
