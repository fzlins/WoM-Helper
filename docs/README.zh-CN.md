# WoM Helper

[![English](https://img.shields.io/badge/docs-English-blue)](../README.md) [![简体中文](https://img.shields.io/badge/docs-简体中文-yellow)](./README.zh-CN.md) [![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/fzlins/WoM-Helper)

适用于 [minesweeper.online](https://minesweeper.online/) 的 Tampermonkey 用户脚本，增强棋盘配置显示、添加无旼模式、在活动页面显示活动积分预测、在 PvP 页面提供自动寻找对手功能、在任务和市场页面提供一键领取功能、在市场出售弹窗中提供最大出售和市场价格辅助、在装备页面提供 Minecoin 最优棋盘推荐、为玩家个人主页链接添加复制图标、支持在来源页面内置棋盘计算生成器，并支持在设置页面单独开关每项功能。

## 设置

在[设置页面](https://minesweeper.online/settings)的设置面板底部，会出现一个 **WoM Helper** 区块，可开关以下功能；切换后导航到对应页面即刻生效，无需刷新：

- 棋盘链接与雷密度
- 活动积分预测
- 一键领取按钮
- 自动滚动到我的排名
- 最大出售与市场价格
- 任务顾问
- 玩家链接复制图标
- 棋盘计算器联动

## 功能

- **棋盘链接与雷密度** — 页面上任意 `WxH/M` 格式的棋盘规格（例如 `30x16/99`）会自动转换为可点击链接，点击即可启动对应配置的游戏。默认悬停链接即可看到雷密度提示；也可在设置页面切换为直接显示在链接旁，或完全禁用此功能。

- **NF（无旗）开关** — 游戏页面的难度选择器旁会出现一个 **NF** 复选框（桌面端和移动端均可使用）。勾选后，棋盘上的右键操作将被禁用，防止误插旗帜，非常适合练习无旗打法。该设置在会话之间自动记忆。
- **活动预计列** — 在[活动页面](https://minesweeper.online/events)的排行榜中新增「预计总分」列，根据玩家当前进度预测活动结束时的总积分。悬停任意格可查看每日均值。
- **自动滚动到我的排名** — 排行榜加载完毕或积分刷新后排名变化时，页面会自动滚动到你在排行榜中的位置。翻页操作不会触发此行为。
- **自动寻找对手（PvP）** — 在 [PvP 页面](https://minesweeper.online/pvp)的 *寻找对手* 按钮旁会出现一个 **Auto** 复选框。勾选后，每当按钮可用时（页面加载时、每场对局或超时结束后）都会自动点击。点击 *取消* 可随时停止。该设置在会话之间自动记忆。
- **一键领取按钮** — 在任意页面的表格中，只要存在可领取按钮，脚本就会自动添加 *全部领取*。检测顺序是先看第一列；如果第一列没有，再看最后一列。两列都没有可领取按钮时，不会显示 *全部领取*。
- **最大出售与市场价格** — 在[市场页面](https://minesweeper.online/marketplace)的出售弹窗中，每行将新增两个辅助：数量输入框旁的 **▲** 链接可一键填入您拥有的最大数量，价格输入框旁的 **🏷** 链接可通过站点 WebSocket 自动获取当前市场价格。表头链接可对所有行批量操作。
- **任务顾问** — 在[装备页面](https://minesweeper.online/equipment)的装备标题下方，出现一行任务顾问控件。选择目标类型（如 MC），输入目标数量，并选择计划游玩次数，推荐棋盘会作为可点击链接实时显示。脚本会自动从装备统计数据中读取当前 Minecoin 加成。
- **玩家链接复制图标** — 在全站范围内，只要玩家名称链接符合个人主页格式（`<a>` 的 id 以 `player_link_` 开头，且链接形如 `/player/123456` 或 `/cn/player/123456`），链接后方就会自动出现复制图标。点击即可复制完整的绝对链接地址。
- **棋盘计算器联动** — 在来源页面上，只要脚本能读取所需数值，就会在页面中显示 **棋盘计算器** 按钮。点击后会直接调用内置生成器，在当前页面展示可用棋盘结果。

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

## 致谢

| 贡献者 | 贡献内容 |
|---|---|
| [Curiosity](https://minesweeper.online/player/8440847) | Quest Advisor 所使用的[棋盘难度数据](https://docs.google.com/spreadsheets/d/19AGUudLMQ1nuPUmmbl8KUvOw5BLystwqbCOvIIta-9o/edit#gid=379786772) |

## 许可证

[MIT](../LICENSE)
