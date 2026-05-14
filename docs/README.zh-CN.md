# WoM Helper

[English](../README.md) 简体中文 [日本語](./README.ja.md) [Русский](./README.ru.md) [DeepWiki](https://deepwiki.com/fzlins/WoM-Helper)

适用于 [minesweeper.online](https://minesweeper.online/) 的 Tampermonkey 用户脚本，增强棋盘配置显示并添加无旗模式。

## 功能

- **可点击的棋盘链接** — 任意纯文本 `WxH/M` 格式（如 `58x35/393`）会自动转换为可点击链接，点击后即可启动对应配置的游戏。
- **雷密度** — 在每个棋盘规格后显示雷密度百分比，如 `58x35/393 (19.36%)`。
- **语言感知链接** — 链接根据当前页面的语言前缀生成（如中文页面为 `/cn/start/58x35/393`，英文页面为 `/start/58x35/393`）。
- **NF（无旗）开关** — 为想练习无旗打法的玩家提供的辅助功能。在游戏页面，*Custom* 难度选择器后方会注入一个标有 **NF** 的复选框（桌面行和移动下拉菜单均有）。勾选后，游戏棋盘上的所有右键输入将被屏蔽，防止误插旗帜。该设置通过 `localStorage` 跨会话持久保存。
- **动态内容** — 使用 `MutationObserver` 处理初始页面渲染后加载的内容。

## 安装

**方式一 — Greasy Fork（推荐）**

直接从 [Greasy Fork](https://greasyfork.org/scripts/578042-minesweeper-online-helper) 安装。

**方式二 — 手动安装**

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2. 打开 Tampermonkey 控制面板，点击 **创建新脚本**。
3. 将默认内容替换为 [wom-helper.user.js](../wom-helper.user.js)。
4. 保存。脚本将自动在 `https://minesweeper.online/*` 上激活。

## 密度公式

$$\text{密度} = \frac{\text{雷数}}{W \times H} \times 100\%$$

示例：`58x35/393` → $393 \div (58 \times 35) \approx 19.36\%$

## 许可证

[MIT](../LICENSE)
