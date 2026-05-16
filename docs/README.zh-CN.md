# WoM Helper

[English](../README.md) 简体中文 [日本語](./README.ja.md) [Русский](./README.ru.md) [DeepWiki](https://deepwiki.com/fzlins/WoM-Helper)

适用于 [minesweeper.online](https://minesweeper.online/) 的 Tampermonkey 用户脚本，增强棋盘配置显示、添加无旗模式、在活动页面显示活动积分预测、在 PvP 页面提供自动寻找对手功能，并在任务页面添加一键领取功能。

## 功能

- **可点击的棋盘链接** — 任意纯文本 `WxH/M` 格式会自动转换为可点击链接，点击后即可启动对应配置的游戏。
- **雷密度** — 在每个棋盘规格后显示雷密度百分比。
- **语言感知链接** — 链接根据当前页面的语言前缀生成。
- **NF（无旗）开关** — 为想练习无旗打法的玩家提供的辅助功能。在游戏页面，*Custom* 难度选择器后方会注入一个标有 **NF** 的复选框（桌面行和移动下拉菜单均有）。勾选后，游戏棋盘上的所有右键输入将被屏蔽，防止误插旗帜。该设置通过 `localStorage` 跨会话持久保存。
- **活动预计列** — 在[活动页面](https://minesweeper.online/events)的排行榜中新增 🎯 列，根据玩家当前进度预测活动结束时的总积分。悬停单元格可在提示框中查看每天（`/d`）均值。
- **自动点击我的排名** — 页面加载完成且 `#stat_my_rank` 中出现有效排名数字时，自动点击该排名链接一次。若排名值因刷新而变化，则再次点击。翻页操作不会触发此行为。
- **自动寻找对手（PvP）** — 在 [PvP 页面](https://minesweeper.online/pvp)的 *寻找对手* 按钮旁注入一个 **Auto** 复选框。勾选后，每当按钮可用时（页面加载时及每场对局或超时结束后）都会自动点击该按钮。点击 *取消* 会取消勾选并停止自动循环。设置通过 `localStorage` 跨会话持久保存，支持所有语言版本的页面。- **一键领取任务奖励** — 在[任务页面](https://minesweeper.online/quests)，当任务表格中存在可领取的行时，会在该表格最后一列的表头单元格中注入一个按鈕（样式和文字与页面自身领取按鈕保持一致）。点击后自动领取该表格内所有可领取的奖励。奖励全部领取完毕后按鈕自动消失。- **动态内容** — 使用 `MutationObserver` 处理初始页面渲染后加载的内容。

## 安装

**方式一 — Greasy Fork（推荐）**

直接从 [Greasy Fork](https://greasyfork.org/scripts/578042-minesweeper-online-helper) 安装。

**方式二 — 手动安装**

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2. 在浏览器中打开 [wom-helper.user.js](https://raw.githubusercontent.com/fzlins/WoM-Helper/main/wom-helper.user.js)。
3. Tampermonkey 将提示安装，点击 **安装** 即可。

> **脚本无法运行？** 在 Chrome 系浏览器上，Tampermonkey 5.3+ 需要额外的一次性设置才能执行用户脚本。详见 [Q209：用户脚本执行权限](https://www.tampermonkey.net/faq.php?q=Q209#Q209)：
> - **Chrome/Edge 138+** — 右键点击 Tampermonkey 图标 → *管理扩展程序* → 启用 **允许用户脚本**。
> - **旧版 Chrome/Edge** — 前往 `chrome://extensions`（或 `edge://extensions`），开启 **开发者模式**。

## 密度公式

$$\text{密度} = \frac{\text{雷数}}{W \times H} \times 100\%$$

## 许可证

[MIT](../LICENSE)
