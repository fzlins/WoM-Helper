// ==UserScript==
// @name         Minesweeper.online Helper
// @namespace    http://tampermonkey.net/
// @version      1.11.0
// @description  Converts board-size text (WxH/M) into clickable links with mine density, adds a No-Flag toggle, shows event score projections, auto-clicks the player's rank link, adds an auto-find-opponent toggle on the PvP page, provides one-click shortcuts on the Quests page, and adds a helper settings panel on minesweeper.online
// @author       fzlins
// @license      MIT
// @homepageURL  https://github.com/fzlins/WoM-Helper
// @supportURL   https://github.com/fzlins/WoM-Helper/issues
// @icon         https://minesweeper.online/favicon.ico
// @match        https://minesweeper.online/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // WxH/M board-size pattern, e.g. 58x35/393
    const BOARD_RE = /(\d+)x(\d+)\/(\d+)/;
    // Marks nodes that have already been processed to prevent duplicate work
    const PROCESSED = 'data-ms-done';

    // Feature enable/disable keys (stored in localStorage; default: enabled)
    const FEAT_BOARD_LINKS_KEY = 'ms-feat-board-links';
    const FEAT_EVENT_STATS_KEY = 'ms-feat-event-stats';
    const FEAT_QUEST_COLLECT_KEY = 'ms-feat-quest-collect';
    const FEAT_MY_RANK_KEY = 'ms-feat-my-rank';
    const FEAT_NF_KEY = 'ms-feat-nf';
    const FEAT_AUTO_DUEL_KEY = 'ms-feat-auto-duel';

    /** Returns true if a feature is enabled (default: true when key is absent). */
    function featEnabled(key) {
        return localStorage.getItem(key) !== '0';
    }

    /** Returns the board-links display mode: 0 = disabled, 1 = links only (density as tooltip), 2 = links + density inline (default). */
    function getBoardLinksMode() {
        const val = localStorage.getItem(FEAT_BOARD_LINKS_KEY);
        if (val === '0') return 0;
        if (val === '2') return 2;
        return 1;
    }

    // ── i18n ───────────────────────────────────────────────────────────────

    /** Returns the two-letter language code for the current page, e.g. 'de', 'cn', or 'en'. */
    function getLang() {
        const m = /^\/([a-z]{2})(?:\/|$)/.exec(location.pathname);
        return m ? m[1] : 'en';
    }

    const STRINGS = {
        en: {
            featBoardLinks: 'Board links & mine density',
            featBoardLinksDesc: 'Converts WxH/M board-size text into clickable links and shows the mine density percentage.',
            featEventStats: 'Event score projection',
            featEventStatsDesc: 'Adds a projected end-of-event score column to the events leaderboard.',
            featQuestCollect: 'Quest collect-all',
            featQuestCollectDesc: 'Adds a one-click button to collect all available rewards in each quest table.',
            featMyRank: 'My-rank auto-scroll',
            featMyRankDesc: 'Automatically scrolls the leaderboard to your rank row whenever the rank loads or changes.',
            questCollectAllBtn: 'Collect All',
            eventStatsHeader: 'Est. Total',
            eventStatsPerDay: 'Avg/day: ',
            boardLinksOptDisabled: 'Disabled',
            boardLinksOptLinks: 'Board links',
            boardLinksOptDensity: 'Board links & density',
            boardLinksDensityLabel: 'Mine density:',
            featNF: 'No-Flag toggle',
            featNFDesc: 'Adds a No-Flag checkbox to the game page that disables right-click flagging on the board.',
            featAutoDuel: 'Auto-find PvP opponent',
            featAutoDuelDesc: 'Adds an Auto checkbox on the PvP page that automatically re-clicks the find opponent button.',
        },
        de: {
            featBoardLinks: 'Spielfeld-Links & Minendichte',
            featBoardLinksDesc: 'Konvertiert WxH/M-Feldtexte in anklickbare Links und zeigt den Minendichte-Prozentsatz an.',
            featEventStats: 'Event-Punkteprojektion',
            featEventStatsDesc: 'Fügt der Event-Rangliste eine Spalte mit den prognostizierten Endpunkten hinzu.',
            featQuestCollect: 'Alle Quests einsammeln',
            featQuestCollectDesc: 'Fügt eine Schaltfläche hinzu, um alle verfügbaren Belohnungen in jeder Quest-Tabelle mit einem Klick einzusammeln.',
            featMyRank: 'Automatischer Rang-Scroll',
            featMyRankDesc: 'Scrollt die Rangliste automatisch zur eigenen Rangzeile, sobald der Rang geladen oder geändert wird.',
            questCollectAllBtn: 'Alle abholen',
            eventStatsHeader: 'Est. Gesamt',
            eventStatsPerDay: 'Ø/Tag: ',
            boardLinksOptDisabled: 'Deaktiviert',
            boardLinksOptLinks: 'Spielfeld-Links',
            boardLinksOptDensity: 'Spielfeld-Links & Minendichte',
            boardLinksDensityLabel: 'Minendichte:',
            featNF: 'No-Flag-Schalter',
            featNFDesc: 'Fügt eine No-Flag-Checkbox auf der Spielseite hinzu, die das Rechtsklick-Markieren deaktiviert.',
            featAutoDuel: 'Gegner automatisch suchen',
            featAutoDuelDesc: 'Fügt auf der PvP-Seite eine Auto-Checkbox hinzu, die automatisch erneut auf die Suche-Schaltfläche klickt.',
        },
        ru: {
            featBoardLinks: 'Ссылки на поле & плотность мин',
            featBoardLinksDesc: 'Преобразует текст формата WxH/M в кликабельные ссылки и показывает процент плотности мин.',
            featEventStats: 'Прогноз очков события',
            featEventStatsDesc: 'Добавляет столбец с прогнозируемыми итоговыми очками в таблицу лидеров события.',
            featQuestCollect: 'Забрать все награды',
            featQuestCollectDesc: 'Добавляет кнопку для получения всех доступных наград в каждой таблице заданий одним кликом.',
            featMyRank: 'Авто-прокрутка к рангу',
            featMyRankDesc: 'Автоматически прокручивает таблицу лидеров до вашей строки ранга при загрузке или изменении ранга.',
            questCollectAllBtn: 'Получить все',
            eventStatsHeader: 'Прогноз итога',
            eventStatsPerDay: 'Ср/день: ',
            boardLinksOptDisabled: 'Отключено',
            boardLinksOptLinks: 'Ссылки на поле',
            boardLinksOptDensity: 'Ссылки & плотность мин',
            boardLinksDensityLabel: 'Плотность мин:',
            featNF: 'Переключатель No-Flag',
            featNFDesc: 'Добавляет флажок No-Flag на игровой странице, отключающий установку флажков правой кнопкой мыши.',
            featAutoDuel: 'Авто-поиск соперника',
            featAutoDuelDesc: 'Добавляет флажок Auto на странице PvP, который автоматически нажимает кнопку поиска соперника.',
        },
        es: {
            featBoardLinks: 'Enlaces de tablero & densidad de minas',
            featBoardLinksDesc: 'Convierte el texto WxH/M en enlaces clicables y muestra el porcentaje de densidad de minas.',
            featEventStats: 'Proyección de puntuación del evento',
            featEventStatsDesc: 'Añade una columna de puntuación proyectada al final del evento en la tabla de clasificación.',
            featQuestCollect: 'Recolectar todas las misiones',
            featQuestCollectDesc: 'Añade un botón de un clic para recolectar todas las recompensas disponibles en cada tabla de misiones.',
            featMyRank: 'Auto-desplazamiento a mi rango',
            featMyRankDesc: 'Desplaza automáticamente la tabla de clasificación a tu fila de rango cuando se carga o cambia.',
            questCollectAllBtn: 'Recoger todo',
            eventStatsHeader: 'Total est.',
            eventStatsPerDay: 'Prom./día: ',
            boardLinksOptDisabled: 'Desactivado',
            boardLinksOptLinks: 'Solo enlaces',
            boardLinksOptDensity: 'Enlaces & densidad',
            boardLinksDensityLabel: 'Densidad de minas:',
            featNF: 'Interruptor No-Flag',
            featNFDesc: 'Añade una casilla No-Flag en la página del juego que desactiva el marcado con clic derecho.',
            featAutoDuel: 'Buscar rival automáticamente',
            featAutoDuelDesc: 'Añade una casilla Auto en la página PvP que hace clic automáticamente en el botón de buscar rival.',
        },
        pt: {
            featBoardLinks: 'Links de tabuleiro & densidade de minas',
            featBoardLinksDesc: 'Converte o texto WxH/M em links clicáveis e exibe a porcentagem de densidade de minas.',
            featEventStats: 'Projeção de pontuação do evento',
            featEventStatsDesc: 'Adiciona uma coluna de pontuação projetada ao final do evento na tabela de classificação.',
            featQuestCollect: 'Coletar todas as missões',
            featQuestCollectDesc: 'Adiciona um botão de um clique para coletar todas as recompensas disponíveis em cada tabela de missões.',
            featMyRank: 'Rolagem automática para minha classificação',
            featMyRankDesc: 'Rola automaticamente a tabela de classificação para sua linha de classificação quando o ranking é carregado ou alterado.',
            questCollectAllBtn: 'Coletar tudo',
            eventStatsHeader: 'Total est.',
            eventStatsPerDay: 'Méd./dia: ',
            boardLinksOptDisabled: 'Desativado',
            boardLinksOptLinks: 'Apenas links',
            boardLinksOptDensity: 'Links & densidade',
            boardLinksDensityLabel: 'Densidade de minas:',
            featNF: 'Alternância No-Flag',
            featNFDesc: 'Adiciona uma caixa No-Flag na página do jogo que desativa a marcação com clique direito.',
            featAutoDuel: 'Buscar adversário automaticamente',
            featAutoDuelDesc: 'Adiciona uma caixa Auto na página PvP que clica automaticamente no botão de buscar adversário.',
        },
        it: {
            featBoardLinks: 'Link campo & densità mine',
            featBoardLinksDesc: 'Converte il testo WxH/M in link cliccabili e mostra la percentuale di densità delle mine.',
            featEventStats: 'Proiezione punteggio evento',
            featEventStatsDesc: 'Aggiunge una colonna con il punteggio previsto a fine evento nella classifica.',
            featQuestCollect: 'Raccolta quest completa',
            featQuestCollectDesc: 'Aggiunge un pulsante per raccogliere tutte le ricompense disponibili in ogni tabella delle quest con un clic.',
            featMyRank: 'Auto-scroll al mio grado',
            featMyRankDesc: 'Scorre automaticamente la classifica fino alla tua riga di grado quando il grado viene caricato o cambia.',
            questCollectAllBtn: 'Ritira tutto',
            eventStatsHeader: 'Totale prev.',
            eventStatsPerDay: 'Media/gg: ',
            boardLinksOptDisabled: 'Disabilitato',
            boardLinksOptLinks: 'Solo link',
            boardLinksOptDensity: 'Link & densità',
            boardLinksDensityLabel: 'Densità mine:',
            featNF: 'Interruttore No-Flag',
            featNFDesc: 'Aggiunge una casella No-Flag nella pagina di gioco che disabilita la marcatura con clic destro.',
            featAutoDuel: 'Trova avversario automaticamente',
            featAutoDuelDesc: 'Aggiunge una casella Auto nella pagina PvP che fa clic automaticamente sul pulsante di ricerca avversario.',
        },
        fr: {
            featBoardLinks: 'Liens de plateau & densité de mines',
            featBoardLinksDesc: 'Convertit le texte WxH/M en liens cliquables et affiche le pourcentage de densité de mines.',
            featEventStats: 'Projection du score d\'événement',
            featEventStatsDesc: 'Ajoute une colonne de score projeté en fin d\'événement au tableau de classement.',
            featQuestCollect: 'Collecte de quêtes en masse',
            featQuestCollectDesc: 'Ajoute un bouton en un clic pour collecter toutes les récompenses disponibles dans chaque tableau de quêtes.',
            featMyRank: 'Défilement automatique vers mon rang',
            featMyRankDesc: 'Fait défiler automatiquement le classement jusqu\'à votre ligne de rang lors du chargement ou d\'un changement.',
            questCollectAllBtn: 'Tout collecter',
            eventStatsHeader: 'Total est.',
            eventStatsPerDay: 'Moy./jour : ',
            boardLinksOptDisabled: 'Désactivé',
            boardLinksOptLinks: 'Liens seulement',
            boardLinksOptDensity: 'Liens & densité',
            boardLinksDensityLabel: 'Densité de mines :',
            featNF: 'Interrupteur No-Flag',
            featNFDesc: "Ajoute une case No-Flag sur la page de jeu qui désactive le marquage par clic droit.",
            featAutoDuel: "Recherche automatique d'adversaire",
            featAutoDuelDesc: "Ajoute une case Auto sur la page PvP qui clique automatiquement sur le bouton de recherche d'adversaire.",
        },
        cn: {
            featBoardLinks: '棋盘链接 & 雷密度',
            featBoardLinksDesc: '将 WxH/M 格式的棋盘文字转换为可点击链接，并显示雷密度百分比。',
            featEventStats: '活动分数预测',
            featEventStatsDesc: '在活动排行榜中添加预测活动结束时总分的列。',
            featQuestCollect: '一键领取全部任务',
            featQuestCollectDesc: '在每个任务表格中添加一键领取所有可用奖励的按钮。',
            featMyRank: '自动滚动到我的排名',
            featMyRankDesc: '当排名加载或发生变化时，自动将排行榜滚动到您的位置。',
            questCollectAllBtn: '全部领取',
            eventStatsHeader: '预计总分',
            eventStatsPerDay: '平均每天：',
            boardLinksOptDisabled: '禁用',
            boardLinksOptLinks: '棋盘链接',
            boardLinksOptDensity: '棋盘链接 & 雷密度',
            boardLinksDensityLabel: '雷密度：',
            featNF: '无插旗模式开关',
            featNFDesc: '在游戏页面添加"无插旗"复选框，禁用右键插旗功能。',
            featAutoDuel: '自动寻找 PvP 对手',
            featAutoDuelDesc: '在 PvP 页面添加"自动"复选框，自动重新点击寻找对手按钮。',
        },
        tw: {
            featBoardLinks: '棋盤連結 & 地雷密度',
            featBoardLinksDesc: '將 WxH/M 格式的棋盤文字轉換為可點擊連結，並顯示地雷密度百分比。',
            featEventStats: '活動分數預測',
            featEventStatsDesc: '在活動排行榜中新增預測活動結束時總分的欄位。',
            featQuestCollect: '一鍵領取全部任務',
            featQuestCollectDesc: '在每個任務表格中新增一鍵領取所有可用獎勵的按鈕。',
            featMyRank: '自動捲動至我的排名',
            featMyRankDesc: '當排名載入或變更時，自動將排行榜捲動至您的位置。',
            questCollectAllBtn: '全部領取',
            eventStatsHeader: '預計總分',
            eventStatsPerDay: '平均每天：',
            boardLinksOptDisabled: '停用',
            boardLinksOptLinks: '棋盤連結',
            boardLinksOptDensity: '棋盤連結 & 地雷密度',
            boardLinksDensityLabel: '地雷密度：',
            featNF: '無旗模式切換',
            featNFDesc: '在遊戲頁面新增「無插旗」複選框，停用右鍵插旗功能。',
            featAutoDuel: '自動尋找 PvP 對手',
            featAutoDuelDesc: '在 PvP 頁面新增「自動」複選框，自動重新點擊尋找對手按鈕。',
        },
        ja: {
            featBoardLinks: 'ボードリンク & 地雷密度',
            featBoardLinksDesc: 'WxH/M 形式のボードテキストをクリック可能なリンクに変換し、地雷密度のパーセンテージを表示します。',
            featEventStats: 'イベントスコア予測',
            featEventStatsDesc: 'イベントリーダーボードにイベント終了時の予測スコア列を追加します。',
            featQuestCollect: 'クエスト一括収集',
            featQuestCollectDesc: '各クエストテーブルで利用可能なすべての報酬をワンクリックで収集するボタンを追加します。',
            featMyRank: '自分のランクへ自動スクロール',
            featMyRankDesc: 'ランクが読み込まれたり変更されたりすると、リーダーボードが自分のランク行に自動的にスクロールします。',
            questCollectAllBtn: '一括受け取り',
            eventStatsHeader: '予想合計',
            eventStatsPerDay: '平均/日：',
            boardLinksOptDisabled: '無効',
            boardLinksOptLinks: 'リンクのみ',
            boardLinksOptDensity: 'リンク & 地雷密度',
            boardLinksDensityLabel: '地雷密度：',
            featNF: 'フラグなしトグル',
            featNFDesc: 'ゲームページに「フラグなし」チェックボックスを追加し、右クリックによるフラグ設置を無効化します。',
            featAutoDuel: 'PvP 対戦相手を自動検索',
            featAutoDuelDesc: 'PvP ページに「自動」チェックボックスを追加し、対戦相手検索ボタンを自動的にクリックします。',
        },
        ko: {
            featBoardLinks: '보드 링크 & 지뢰 밀도',
            featBoardLinksDesc: 'WxH/M 형식의 보드 텍스트를 클릭 가능한 링크로 변환하고 지뢰 밀도 비율을 표시합니다.',
            featEventStats: '이벤트 점수 예측',
            featEventStatsDesc: '이벤트 리더보드에 이벤트 종료 시 예상 점수 열을 추가합니다.',
            featQuestCollect: '퀘스트 전체 수집',
            featQuestCollectDesc: '각 퀘스트 테이블에서 사용 가능한 모든 보상을 한 번에 수집하는 버튼을 추가합니다.',
            featMyRank: '내 순위로 자동 스크롤',
            featMyRankDesc: '순위가 로드되거나 변경될 때 리더보드가 내 순위 행으로 자동 스크롤됩니다.',
            questCollectAllBtn: '전부 수집',
            eventStatsHeader: '예상 합계',
            eventStatsPerDay: '일 평균: ',
            boardLinksOptDisabled: '비활성화',
            boardLinksOptLinks: '링크만',
            boardLinksOptDensity: '링크 & 지뢰 밀도',
            boardLinksDensityLabel: '지뢰 밀도:',
            featNF: '노 플래그 토글',
            featNFDesc: '게임 페이지에 "노 플래그" 체크박스를 추가하여 우클릭 깃발 설치를 비활성화합니다.',
            featAutoDuel: 'PvP 상대 자동 찾기',
            featAutoDuelDesc: 'PvP 페이지에 "자동" 체크박스를 추가하여 상대 찾기 버튼을 자동으로 클릭합니다.',
        },
    };

    /** Returns the translated string for key, falling back to English. */
    function t(key) {
        return STRINGS[getLang()]?.[key] ?? STRINGS.en[key] ?? key;
    }

    // ── Board links & density ──────────────────────────────────────────────

    /** Returns the two-letter language prefix from the URL, e.g. '/cn', or ''. */
    function getLangPrefix() {
        const m = /^(\/[a-z]{2})(\/|$)/.exec(location.pathname);
        return m ? m[1] : '';
    }

    /** Returns a mine-density percentage string, e.g. '20.50%'. */
    function densityPct(w, h, mines) {
        return `${((mines / (w * h)) * 100).toFixed(2)}%`;
    }

    /** Returns a mine-density string with parentheses, e.g. '(20.50%)'. */
    function densityText(w, h, mines) {
        return `(${densityPct(w, h, mines)})`;
    }

    /** Creates an <a> linking to the given board configuration. */
    function makeLink(w, h, mines, mode) {
        const a = document.createElement('a');
        a.href = `${getLangPrefix()}/start/${w}x${h}/${mines}`;
        a.textContent = `${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED, '1');
        if (mode === 1) {
            a.title = `${t('boardLinksDensityLabel')} ${densityPct(+w, +h, +mines)}`;
        }
        return a;
    }

    /** Creates a <span> displaying the mine density. */
    function makeDensitySpan(w, h, mines) {
        const s = document.createElement('span');
        s.className = 'ms-density';
        s.textContent = densityText(+w, +h, +mines);
        s.style.cssText = 'color:#888;font-size:.9em;margin-left:2px;';
        return s;
    }

    /** Replaces each WxH/M occurrence in a text node with a link and optionally a density span. */
    function processTextNode(node) {
        const parent = node.parentNode;
        if (!parent) return;

        const text = node.textContent;
        const matches = [...text.matchAll(/(\d+)x(\d+)\/(\d+)/g)];
        if (!matches.length) return;

        const mode = getBoardLinksMode();
        const frag = document.createDocumentFragment();
        let pos = 0;
        for (const m of matches) {
            const [full, w, h, mines] = m;
            if (m.index > pos) frag.appendChild(document.createTextNode(text.slice(pos, m.index)));
            frag.appendChild(makeLink(w, h, mines, mode));
            if (mode === 2) frag.appendChild(makeDensitySpan(w, h, mines));
            pos = m.index + full.length;
        }
        if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
        parent.replaceChild(frag, node);
    }

    /**
     * Corrects the href of an existing board-link <a> to use the current
     * language prefix, and appends a density span if not already present.
     */
    function processAnchor(a) {
        if (a.getAttribute(PROCESSED)) return;

        const m = BOARD_RE.exec(a.textContent.trim());
        if (!m) return;

        const [, w, h, mines] = m;
        const mode = getBoardLinksMode();
        a.href = `${getLangPrefix()}/start/${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED, '1');
        if (mode === 1) {
            a.title = `${t('boardLinksDensityLabel')} ${densityPct(+w, +h, +mines)}`;
        }

        const next = a.nextSibling;
        const alreadyHasDensity =
            next?.nodeType === Node.ELEMENT_NODE && next.classList.contains('ms-density');
        if (mode === 2 && !alreadyHasDensity && a.parentNode) {
            a.parentNode.insertBefore(makeDensitySpan(w, h, mines), next);
        }
    }

    /** Recursively walks the DOM, processing board-size text nodes and links. */
    function walk(node) {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            if (BOARD_RE.test(node.textContent)) processTextNode(node);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || node.getAttribute(PROCESSED)) return;

        if (tag === 'A') {
            if (BOARD_RE.test(node.textContent)) processAnchor(node);
            return;
        }

        // Snapshot before iterating to guard against DOM mutations during traversal
        Array.from(node.childNodes).forEach(walk);
    }

    // ── No-Flag toggle ─────────────────────────────────────────────────────

    const NF_KEY = 'ms-nf-enabled';

    /**
     * Blocks right-click events on #game in the capture phase.
     * The game flags on mousedown/mouseup (button 2), not contextmenu alone,
     * so all three event types are intercepted.
     */
    function blockRightClick(e) {
        if (e.button === 2 || e.type === 'contextmenu') {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    /**
     * Attaches or detaches right-click blocking on #game.
     * Returns true if #game was found.
     */
    function applyNF(enabled) {
        const game = document.getElementById('game');
        if (!game) return false;
        const method = enabled ? 'addEventListener' : 'removeEventListener';
        for (const evt of ['contextmenu', 'mousedown', 'mouseup']) {
            game[method](evt, blockRightClick, true);
        }
        return true;
    }

    /** Creates a label+checkbox for the NF toggle. All checkboxes share 'ms-nf-chk'. */
    function makeNFCheckbox(id, labelStyle) {
        const label = document.createElement('label');
        label.htmlFor = id;
        label.title = 'No Flag — disable right-click flagging';
        label.style.cssText = labelStyle;

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = id;
        chk.className = 'ms-nf-chk';
        chk.style.cssText = 'margin-right:3px;vertical-align:middle;cursor:pointer;';

        const span = document.createElement('span');
        span.textContent = 'NF';
        span.style.verticalAlign = 'middle';

        label.append(chk, span);
        return label;
    }

    /** Injects NF checkboxes into the level bar and restores the saved state. */
    function initNF() {
        let nfEnabled = localStorage.getItem(NF_KEY) === '1';

        const syncAll = () => {
            document.querySelectorAll('.ms-nf-chk').forEach(c => { c.checked = nfEnabled; });
        };

        function onchange() {
            nfEnabled = this.checked;
            syncAll();
            localStorage.setItem(NF_KEY, nfEnabled ? '1' : '0');
            applyNF(nfEnabled);
        }

        function tryInsert() {
            const levelsFull = document.getElementById('levels_full');
            if (!levelsFull) return false;

            // Desktop: append label directly inside #levels_full
            if (!document.getElementById('ms-nf-desktop')) {
                const label = makeNFCheckbox(
                    'ms-nf-chk-desktop',
                    'margin-left:12px;font-weight:normal;cursor:pointer;user-select:none;vertical-align:middle;'
                );
                label.id = 'ms-nf-desktop';
                levelsFull.appendChild(label);
                label.querySelector('.ms-nf-chk').addEventListener('change', onchange);
            }

            // Mobile: append <li> to #levels_compact dropdown
            const levelsCompact = document.getElementById('levels_compact');
            if (levelsCompact && !document.getElementById('ms-nf-mobile')) {
                const li = document.createElement('li');
                li.id = 'ms-nf-mobile';
                li.style.borderTop = '1px solid #e5e5e5';
                const label = makeNFCheckbox(
                    'ms-nf-chk-mobile',
                    'display:block;padding:3px 20px;font-weight:normal;cursor:pointer;user-select:none;white-space:nowrap;'
                );
                li.appendChild(label);
                levelsCompact.appendChild(li);
                label.querySelector('.ms-nf-chk').addEventListener('change', onchange);
            }

            syncAll();
            return true;
        }

        if (!tryInsert()) {
            const obs = new MutationObserver(() => { if (tryInsert()) obs.disconnect(); });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        // Apply initial NF state — #game may not exist yet
        if (!applyNF(nfEnabled)) {
            const obs = new MutationObserver(() => {
                if (document.getElementById('game')) { applyNF(nfEnabled); obs.disconnect(); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ── Event stats ────────────────────────────────────────────────────────

    function initEventStats() {
        const COL_CLASS = 'ms-evt-col';

        /**
         * Returns UTC start/end timestamps for the current event period.
         * Events run from the 4th of a month through the last day of that month.
         * If the current date is before the 4th, the previous month is used.
         */
        function getEventPeriod() {
            const now = new Date();
            let y = now.getUTCFullYear();
            let m = now.getUTCMonth(); // 0-based
            if (now.getUTCDate() < 4) {
                if (--m < 0) { m = 11; y--; }
            }
            return { start: Date.UTC(y, m, 4), end: Date.UTC(y, m + 1, 1) };
        }

        /**
         * Returns projected stats for a player with the given point total,
         * or null if the event period has not started yet.
         *   avgD — rounded average points per day
         *   est  — rounded projected total at event end
         */
        function calcStats(points) {
            const { start, end } = getEventPeriod();
            const now = Date.now();
            if (now < start) return null;
            const elapsedMs = Math.max(now - start, 60_000); // avoid div-by-zero
            const avgPerDay = points / (elapsedMs / 86_400_000);
            const est = now >= end ? points : avgPerDay * ((end - start) / 86_400_000);
            return { avgD: Math.round(avgPerDay), est: Math.round(est) };
        }

        /** Appends the projected-score header column to the leaderboard thead (idempotent). */
        function ensureHeaders(thead) {
            const row = thead.querySelector('tr');
            if (!row || row.querySelector('th[data-ms-evt]')) return;
            const th = document.createElement('th');
            th.setAttribute('data-ms-evt', '1');
            th.textContent = t('eventStatsHeader');
            row.appendChild(th);
        }

        /**
         * Fills each leaderboard row with a projected-total cell.
         * Stale cells are removed before re-adding to handle pagination reloads.
         * Uses childList-only observation to avoid re-triggering on our own <td> additions.
         */
        function fillBodyCols(tbody) {
            for (const row of tbody.querySelectorAll('tr')) {
                row.querySelectorAll('.' + COL_CLASS).forEach(el => el.remove());
                const strong = row.querySelector('strong[class*="event-pos"]');
                if (!strong) continue;

                const points = parseInt(strong.textContent.replace(/,/g, ''), 10);
                const stats = isNaN(points) ? null : calcStats(points);
                // Clone the event icon from the points cell (varies per event)
                const icon = strong.closest('td')?.querySelector('img') ?? null;

                const td = document.createElement('td');
                td.className = `${COL_CLASS} text-nowrap narrow-td`;

                if (stats) {
                    const span = document.createElement('span');
                    span.className = 'help';
                    span.setAttribute('data-original-title', `${t('eventStatsPerDay')}${stats.avgD.toLocaleString()}${icon?.alt ? ' ' + icon.alt : ''}`);

                    const s = document.createElement('strong');
                    s.textContent = stats.est.toLocaleString();
                    span.appendChild(s);
                    if (icon) span.appendChild(icon.cloneNode(true));
                    td.appendChild(span);

                    // Initialize Bootstrap 3 tooltip directly for dynamically inserted elements
                    if (window.jQuery?.fn.tooltip) {
                        window.jQuery(span).tooltip({ container: 'body' });
                    }
                } else {
                    td.textContent = '–';
                }

                row.appendChild(td);
            }
        }

        let currentTbody = null;
        let tbodyObs = null;

        function attachTbodyObs(thead, tbody) {
            if (tbodyObs) tbodyObs.disconnect();
            currentTbody = tbody;
            tbodyObs = new MutationObserver(() => {
                ensureHeaders(thead);
                fillBodyCols(tbody);
            });
            tbodyObs.observe(tbody, { childList: true });
        }

        function trySetup() {
            if (!/\/events(\/|$|\?)/.test(location.pathname)) return;
            const table = document.getElementById('stat_table');
            if (!table) return;
            const thead = table.querySelector('#stat_table_head');
            const tbody = table.querySelector('#stat_table_body');
            if (!thead || !tbody) return;

            if (!featEnabled(FEAT_EVENT_STATS_KEY)) {
                thead.querySelector('th[data-ms-evt]')?.remove();
                tbody.querySelectorAll('.' + COL_CLASS).forEach(el => el.remove());
                if (tbodyObs) { tbodyObs.disconnect(); tbodyObs = null; currentTbody = null; }
                return;
            }

            if (tbody === currentTbody) return;
            ensureHeaders(thead);
            fillBodyCols(tbody);
            attachTbodyObs(thead, tbody);
        }

        // Single persistent observer for the script's lifetime — never disconnects.
        // Checks the URL before acting, so stat_table on other pages is ignored.
        new MutationObserver(trySetup).observe(document.body, { childList: true, subtree: true });
        trySetup();
    }

    // ── Auto-duel ──────────────────────────────────────────────────────────

    const AUTO_DUEL_KEY = 'ms-auto-duel-enabled';

    /**
     * Injects an "Auto" checkbox after #start_duel_btn on the /pvp page.
     * When checked, automatically clicks the button whenever it becomes
     * enabled (initially and again after each match ends). State is persisted
     * in localStorage.
     */
    function initAutoDuel() {
        let autoEnabled = localStorage.getItem(AUTO_DUEL_KEY) === '1';
        let clickTimer = null;
        let cancelListenerAdded = false;

        function tryClickBtn() {
            if (!autoEnabled) return;
            const btn = document.getElementById('start_duel_btn');
            if (!btn || btn.disabled || btn.classList.contains('disabled')) return;
            btn.click();
        }

        function scheduleClick(delay) {
            clearTimeout(clickTimer);
            clickTimer = setTimeout(tryClickBtn, delay ?? 400);
        }

        function tryInsert() {
            const btn = document.getElementById('start_duel_btn');
            if (!btn) return;
            if (document.getElementById('ms-auto-duel-chk')) return;

            const label = document.createElement('label');
            label.htmlFor = 'ms-auto-duel-chk';
            label.title = 'Auto-find opponent';
            label.style.cssText =
                'margin-left:8px;font-weight:normal;cursor:pointer;' +
                'user-select:none;vertical-align:middle;white-space:nowrap;';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.id = 'ms-auto-duel-chk';
            chk.checked = autoEnabled;
            chk.style.cssText = 'margin-right:3px;vertical-align:middle;cursor:pointer;';

            const span = document.createElement('span');
            span.textContent = 'Auto';
            span.style.verticalAlign = 'middle';

            label.append(chk, span);

            chk.addEventListener('change', function () {
                autoEnabled = this.checked;
                localStorage.setItem(AUTO_DUEL_KEY, autoEnabled ? '1' : '0');
                if (autoEnabled) scheduleClick(0);
            });

            btn.insertAdjacentElement('afterend', label);

            // Re-click automatically whenever the button transitions back to enabled
            // (e.g. after a match completes or search times out).
            new MutationObserver(() => scheduleClick()).observe(btn, {
                attributes: true, attributeFilter: ['disabled', 'class']
            });

            // Register the cancel listener only once for the lifetime of the page.
            if (!cancelListenerAdded) {
                cancelListenerAdded = true;
                document.addEventListener('click', function (e) {
                    if (e.target?.id === 'cancel_duel_btn' || e.target?.closest?.('#cancel_duel_btn')) {
                        clearTimeout(clickTimer);
                        autoEnabled = false;
                        localStorage.setItem(AUTO_DUEL_KEY, '0');
                        const c = document.getElementById('ms-auto-duel-chk');
                        if (c) c.checked = false;
                    }
                }, true);
            }

            // Initial auto-click if the feature was already enabled
            scheduleClick(500);
        }

        // Persistent — never disconnects so it can re-insert the checkbox
        // whenever #start_duel_btn re-appears after a cancel or page update.
        new MutationObserver(tryInsert).observe(document.body, { childList: true, subtree: true });
        tryInsert();
    }

    // ── Quest collect-all ──────────────────────────────────────────────────────

    /**
     * On /quests pages, injects a "领取全部" button next to each quest-table
     * heading whenever the table contains any collectable rows.  Clicking the
     * button auto-clicks every visible collect_btn in that table.  The button
     * is removed automatically once there are no more rows left to collect.
     */
    function initQuestCollect() {
        const BTN_CLASS = 'ms-quest-collect-all';

        /** Returns all desktop-visible collect buttons in the table's last column. */
        function getCollectBtns(table) {
            return table.querySelectorAll('tbody td:last-child button[class*="collect_btn"]');
        }

        /**
         * Adds or removes the "collect all" button in the last <th> of the
         * table's header row, depending on whether any collectable rows exist.
         */
        function processTable(table) {
            const th = table.querySelector('thead tr th:last-child');
            if (!th) return;

            const collectBtns = getCollectBtns(table);
            let allBtn = th.querySelector('.' + BTN_CLASS);

            if (collectBtns.length === 0) {
                if (allBtn) allBtn.remove();
                return;
            }

            if (!allBtn) {
                allBtn = document.createElement('button');
                allBtn.className = BTN_CLASS + ' btn btn-danger btn-xs';
                allBtn.style.cssText = 'vertical-align:middle;';
                allBtn.textContent = t('questCollectAllBtn');
                allBtn.addEventListener('click', () => {
                    getCollectBtns(table).forEach(btn => btn.click());
                });
                th.appendChild(allBtn);
            }
        }

        function trySetup() {
            if (!/\/quests(\/|$|\?)/.test(location.pathname)) return;
            const block = document.getElementById('QuestsBlock');
            if (!block) return;

            if (!featEnabled(FEAT_QUEST_COLLECT_KEY)) {
                block.querySelectorAll('.' + BTN_CLASS).forEach(el => el.remove());
                return;
            }

            block.querySelectorAll('table.table').forEach(processTable);
        }

        // Persistent observer — re-evaluates on every DOM change so the button
        // disappears after all quests in a table have been collected.
        new MutationObserver(trySetup).observe(document.body, { childList: true, subtree: true });
        trySetup();
    }

    // ── My rank auto-click ──────────────────────────────────────────────────

    /**
     * Automatically clicks the player's rank link inside #stat_my_rank once
     * per unique rank value. Fires on initial load (when the number first
     * appears) and again whenever the rank changes (e.g. after a stats
     * refresh). Pagination does not affect #stat_my_rank, so it is naturally
     * ignored.
     */
    function initMyRankClick() {
        let lastClickedRank = null;
        let currentSpan = null;
        let spanObs = null;

        function tryClick() {
            if (!featEnabled(FEAT_MY_RANK_KEY)) return;
            const span = document.getElementById('stat_my_rank');
            if (!span) return;
            const a = span.querySelector('a.position');
            if (!a) return;
            const rank = a.textContent.trim().replace(/\s+/g, '');
            if (!/^\d+$/.test(rank)) return;
            if (rank === lastClickedRank) return;
            lastClickedRank = rank;
            a.click();
        }

        function attachSpanObs(span) {
            if (spanObs) spanObs.disconnect();
            spanObs = new MutationObserver(tryClick);
            spanObs.observe(span, { childList: true, subtree: true, characterData: true });
            currentSpan = span;
        }

        // Persistent — never disconnects, so it survives SPA navigation and
        // re-attaches whenever #stat_my_rank is replaced by a new element.
        new MutationObserver(() => {
            const span = document.getElementById('stat_my_rank');
            if (span && span !== currentSpan) {
                lastClickedRank = null; // new page context: allow re-click
                attachSpanObs(span);
                tryClick();
            }
        }).observe(document.body, { childList: true, subtree: true });

        // Handle element already present on script load
        const span = document.getElementById('stat_my_rank');
        if (span) { attachSpanObs(span); tryClick(); }
    }

    // ── Selling max button ─────────────────────────────────────────────────

    /**
     * On /marketplace pages, injects helpers into the "Sell" modal:
     * - Column 2: ▲ link per row (fill max quantity) + ▲ header link (fill all).
     * - Column 3: 🏷 link per row (fetch market price) + 🏷 header link (fetch all).
     *
     * The market-price fetch works by programmatically showing the Bootstrap
     * popover on the item name (column 1).  The site's own `shown.bs.popover`
     * handler calls `getMarketPriceWsAction` via Socket.IO; once the response
     * populates `.market_price_{id}`, the value is read and written into the
     * price input, then the popover is hidden.
     */
    function initSellMaxBtn() {
        // DISABLED: Temporarily disabled pending review of minesweeper.online marketplace rules.
        // To re-enable: remove the `return;` below and uncomment `initSellMaxBtn()` in init().
        return;

        function fillAll(content) {
            content.querySelectorAll('input.market-amount-small').forEach(input => {
                const max = input.getAttribute('max');
                if (!max) return;
                input.value = max;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        /**
         * Shows the item popover in column 1, waits for the site to populate
         * `.market_price_{id}` via WebSocket, writes the value into priceInput,
         * then hides the popover. Calls onDone() on completion or timeout.
         */
        function fetchMarketPrice(id, priceInput, helpSpan, onDone) {
            if (!window.jQuery) { if (onDone) onDone(); return; }
            const $ = window.jQuery;
            $(helpSpan).popover('show');
            let elapsed = 0;
            const timer = setInterval(() => {
                elapsed += 100;
                const el = document.querySelector('.market_price_' + id);
                if (el) {
                    const text = el.textContent.trim();
                    // Loading state: empty or contains only a spinner image (no digits, not 'n/a')
                    if (text === 'n/a' || /\d/.test(text)) {
                        clearInterval(timer);
                        $(helpSpan).popover('hide');
                        const num = parseInt(text.replace(/\D/g, ''), 10);
                        if (!isNaN(num) && num > 0) {
                            priceInput.value = num;
                            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                            priceInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        if (onDone) onDone();
                        return;
                    }
                }
                if (elapsed >= 5000) {
                    clearInterval(timer);
                    $(helpSpan).popover('hide');
                    if (onDone) onDone();
                }
            }, 100);
        }

        /** Fetches market prices for all rows sequentially to avoid WS throttling. */
        function fetchAllPrices(content) {
            const rows = [...content.querySelectorAll('tr[id^="selling_item_"]')].flatMap(row => {
                const id = row.id.slice('selling_item_'.length);
                const priceInput = row.querySelector('input.market-price-small');
                const helpSpan = row.querySelector('td:first-child .help');
                return priceInput && helpSpan ? [{ id, priceInput, helpSpan }] : [];
            });
            let i = 0;
            function next() {
                if (i >= rows.length) return;
                const { id, priceInput, helpSpan } = rows[i++];
                fetchMarketPrice(id, priceInput, helpSpan, () => setTimeout(next, 150));
            }
            next();
        }

        function processSellingContent(content) {
            // Per-row max links (column 2)
            content.querySelectorAll('input.market-amount-small').forEach(input => {
                if (input.getAttribute(PROCESSED)) return;
                input.setAttribute(PROCESSED, '1');
                const max = input.getAttribute('max');
                if (!max) return;
                const a = document.createElement('a');
                a.href = 'javascript:void(0)';
                a.innerHTML = '<i class="glyphicon glyphicon-arrow-up"></i>';
                a.style.cssText = 'margin-left:3px;';
                a.addEventListener('click', () => {
                    input.value = max;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
                input.insertAdjacentElement('afterend', a);
            });

            // Per-row market-price fetch links (column 3)
            content.querySelectorAll('input.market-price-small').forEach(priceInput => {
                if (priceInput.getAttribute(PROCESSED)) return;
                priceInput.setAttribute(PROCESSED, '1');
                const row = priceInput.closest('tr[id^="selling_item_"]');
                if (!row) return;
                const id = row.id.slice('selling_item_'.length);
                const helpSpan = row.querySelector('td:first-child .help');
                if (!helpSpan) return;
                const a = document.createElement('a');
                a.href = 'javascript:void(0)';
                a.className = 'ms-price-fetch';
                a.innerHTML = '<i class="glyphicon glyphicon-tag"></i>';
                a.style.cssText = 'margin-left:3px;';
                a.addEventListener('click', () => fetchMarketPrice(id, priceInput, helpSpan));
                const coinIcon = priceInput.closest('td')?.querySelector('img');
                (coinIcon || priceInput).insertAdjacentElement('afterend', a);
            });

            const table = content.querySelector('table');
            if (!table) return;

            // Column 2 header: fill-all ▲ link
            const th2 = table.querySelector('thead tr th:nth-child(2)');
            if (th2 && !th2.querySelector('.ms-sell-max-all')) {
                const allLink = document.createElement('a');
                allLink.href = 'javascript:void(0)';
                allLink.className = 'ms-sell-max-all';
                allLink.innerHTML = '<i class="glyphicon glyphicon-arrow-up"></i>';
                allLink.style.cssText = 'margin-left:3px;';
                allLink.addEventListener('click', () => fillAll(content));
                th2.appendChild(allLink);
            }

            // Column 3 header: fetch-all price 🏷 link
            const th3 = table.querySelector('thead tr th:nth-child(3)');
            if (th3 && !th3.querySelector('.ms-price-fetch-all')) {
                const allPriceLink = document.createElement('a');
                allPriceLink.href = 'javascript:void(0)';
                allPriceLink.className = 'ms-price-fetch-all';
                allPriceLink.innerHTML = '<i class="glyphicon glyphicon-tag"></i>';
                allPriceLink.style.cssText = 'margin-left:3px;';
                allPriceLink.addEventListener('click', () => fetchAllPrices(content));
                th3.appendChild(allPriceLink);
            }
        }

        new MutationObserver(() => {
            const content = document.getElementById('selling_content');
            if (content) processSellingContent(content);
        }).observe(document.body, { childList: true, subtree: true });

        const content = document.getElementById('selling_content');
        if (content) processSellingContent(content);
    }

    // ── Settings panel ─────────────────────────────────────────────────────

    /**
     * On /settings pages, appends a "WoM Helper" section inside #SettingsBlock
     * with checkboxes to enable or disable each script feature.
     * Changes are saved immediately to localStorage and take effect on the
     * next page load.
     */
    function initSettings() {
        const FEATURES = [
            {
                key: FEAT_BOARD_LINKS_KEY,
                type: 'select',
                label: t('featBoardLinks'),
                desc: t('featBoardLinksDesc'),
                options: [
                    { value: '0', label: t('boardLinksOptDisabled') },
                    { value: '1', label: t('boardLinksOptLinks') },
                    { value: '2', label: t('boardLinksOptDensity') },
                ],
                defaultValue: '1',
            },
            {
                key: FEAT_EVENT_STATS_KEY,
                label: t('featEventStats'),
                desc: t('featEventStatsDesc'),
            },
            {
                key: FEAT_QUEST_COLLECT_KEY,
                label: t('featQuestCollect'),
                desc: t('featQuestCollectDesc'),
            },
            {
                key: FEAT_MY_RANK_KEY,
                label: t('featMyRank'),
                desc: t('featMyRankDesc'),
            },
            {
                key: FEAT_NF_KEY,
                label: t('featNF'),
                desc: t('featNFDesc'),
            },
            {
                key: FEAT_AUTO_DUEL_KEY,
                label: t('featAutoDuel'),
                desc: t('featAutoDuelDesc'),
            },
        ];

        function tryInsert() {
            if (!/\/settings(\/|$|\?)/.test(location.pathname)) return;
            const block = document.getElementById('SettingsBlock');
            if (!block || document.getElementById('ms-settings-section')) return;

            const section = document.createElement('div');
            section.id = 'ms-settings-section';

            section.appendChild(document.createElement('hr'));

            // "WoM Helper" heading row
            const titleRow = document.createElement('div');
            titleRow.className = 'form-group';
            const titleLabelCol = document.createElement('label');
            titleLabelCol.className = 'col-xs-4 control-label';
            const titleValCol = document.createElement('div');
            titleValCol.className = 'col-xs-8 bold';
            titleValCol.textContent = 'WoM Helper';
            titleRow.append(titleLabelCol, titleValCol);
            section.appendChild(titleRow);

            FEATURES.forEach(({ key, label, desc, type, options, defaultValue }) => {
                const group = document.createElement('div');
                group.className = 'form-group';

                const labelCol = document.createElement('label');
                labelCol.className = 'col-xs-4 control-label';
                const valueCol = document.createElement('div');
                valueCol.className = 'col-xs-8';

                const helpIcon = document.createElement('i');
                helpIcon.className = 'fa fa-question-circle-o gray help';
                helpIcon.setAttribute('data-original-title', desc);
                helpIcon.title = '';
                helpIcon.style.marginLeft = '4px';

                if (type === 'select') {
                    labelCol.textContent = label;
                    const storedVal = localStorage.getItem(key);
                    const validValues = options.map(o => o.value);
                    const currentVal = validValues.includes(storedVal) ? storedVal : defaultValue;
                    const sel = document.createElement('select');
                    sel.className = 'settings-select form-control';
                    sel.style.cssText = 'display:inline-block;width:auto;';
                    options.forEach(({ value, label: optLabel }) => {
                        const opt = document.createElement('option');
                        opt.value = value;
                        opt.textContent = optLabel;
                        if (value === currentVal) opt.selected = true;
                        sel.appendChild(opt);
                    });
                    sel.addEventListener('change', function () {
                        localStorage.setItem(key, this.value);
                    });
                    const wrap = document.createElement('div');
                    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
                    wrap.append(sel, helpIcon);
                    valueCol.append(wrap);
                } else {
                    const lbl = document.createElement('label');
                    lbl.className = 'normal cursor-pointer';
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.checked = featEnabled(key);
                    chk.addEventListener('change', function () {
                        localStorage.setItem(key, this.checked ? '1' : '0');
                    });
                    lbl.append(chk, '\u00a0\u00a0' + label + '\u00a0\u00a0', helpIcon);
                    valueCol.appendChild(lbl);
                }

                group.append(labelCol, valueCol);
                section.appendChild(group);
            });

            const formHoriz = block.querySelector('.form-horizontal');
            const container = formHoriz || block;
            const hrs = [...container.querySelectorAll(':scope > hr')];
            const lastHr = hrs[hrs.length - 1];
            if (lastHr) {
                container.insertBefore(section, lastHr);
            } else {
                container.appendChild(section);
            }

            // Initialise Bootstrap 3 tooltips on the injected help icons
            if (window.jQuery?.fn.tooltip) {
                window.jQuery(section.querySelectorAll('.help')).tooltip({ container: 'body' });
            }
        }

        new MutationObserver(tryInsert).observe(document.body, { childList: true, subtree: true });
        tryInsert();
    }

    // ── Entry point ────────────────────────────────────────────────────────

    function initPageFeatures() {
        const path = location.pathname;
        if (/\/game(\/|$)/.test(path) && featEnabled(FEAT_NF_KEY)) initNF();

        if (/\/pvp(\/|$|\?)/.test(path) && featEnabled(FEAT_AUTO_DUEL_KEY)) initAutoDuel();
    }

    function init() {
        if (getBoardLinksMode() !== 0) walk(document.body);

        new MutationObserver(mutations => {
            if (getBoardLinksMode() === 0) return;
            for (const { addedNodes } of mutations) addedNodes.forEach(walk);
        }).observe(document.body, { childList: true, subtree: true });

        initPageFeatures();
        initEventStats();
        initQuestCollect();
        initMyRankClick();
        initSettings();
        // initSellMaxBtn(); // DISABLED: see initSellMaxBtn() above

        // Detect SPA navigation (pushState / replaceState / back-forward)
        const _push = history.pushState.bind(history);
        history.pushState = function (...args) { _push(...args); initPageFeatures(); };
        const _replace = history.replaceState.bind(history);
        history.replaceState = function (...args) { _replace(...args); initPageFeatures(); };
        window.addEventListener('popstate', initPageFeatures);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
