# WoM Helper

[English](../README.md) [简体中文](./README.zh-CN.md) 日本語 [Русский](./README.ru.md) [DeepWiki](https://deepwiki.com/fzlins/WoM-Helper)

[minesweeper.online](https://minesweeper.online/) 向けの Tampermonkey ユーザースクリプトです。ボード設定の表示を強化し、ノーフラッグモードを追加します。

## 機能

- **クリック可能なボードリンク** — `WxH/M` 形式のプレーンテキスト（例：`58x35/393`）を、そのボード設定でゲームを開始するクリック可能なリンクに自動変換します。
- **地雷密度** — 各ボード仕様の後に地雷密度のパーセンテージを表示します（例：`58x35/393 (19.36%)`）。
- **言語対応リンク** — リンクは現在のページの言語プレフィックスに基づいて生成されます（例：中国語ページでは `/cn/start/58x35/393`、英語ページでは `/start/58x35/393`）。
- **NF（ノーフラッグ）トグル** — ノーフラッグスタイルを練習したいプレイヤー向けの補助機能です。ゲームページの *Custom* 難易度セレクターの後に **NF** というチェックボックスが追加されます（デスクトップ行とモバイルドロップダウンの両方）。チェックを入れると、ゲームボード上のすべての右クリック入力がブロックされ、誤ってフラグを置くことを防ぎます。設定は `localStorage` を通じてセッション間で保持されます。
- **動的コンテンツ** — `MutationObserver` を使用して、初期ページレンダリング後に読み込まれるコンテンツを処理します。

## インストール

**方法 A — Greasy Fork（推奨）**

[Greasy Fork](https://greasyfork.org/scripts/578042-minesweeper-online-helper) から直接インストールしてください。

**方法 B — 手動インストール**

1. [Tampermonkey](https://www.tampermonkey.net/) ブラウザ拡張機能をインストールしてください。
2. Tampermonkey ダッシュボードを開き、**新しいスクリプトを作成** をクリックします。
3. デフォルトのコンテンツを [wom-helper.user.js](../wom-helper.user.js) の内容に置き換えます。
4. 保存してください。スクリプトは `https://minesweeper.online/*` で自動的に有効になります。

## 密度の計算式

$$\text{密度} = \frac{\text{地雷数}}{W \times H} \times 100\%$$

例：`58x35/393` → $393 \div (58 \times 35) \approx 19.36\%$

## ライセンス

[MIT](../LICENSE)
