// ==UserScript==
// @name         Minesweeper.online Helper
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Converts board-size text (WxH/M) into clickable links with mine density, adds a No-Flag toggle, shows event score projections, auto-clicks the player's rank link, adds an auto-find-opponent toggle on the PvP page, provides one-click shortcuts on the Quests page, adds sell-max and market-price helpers in the Sell modal, shows a Quest Advisor on the Equipment page, adds a copy-link icon after player profile links, and adds a helper settings panel on minesweeper.online
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
    const BOARD_RE_G = /(\d+)x(\d+)\/(\d+)/g;
    // Per-feature processed markers — kept separate to avoid cross-feature conflicts
    const PROCESSED_BOARD = 'data-ms-board-done';
    const PROCESSED_SELL = 'data-ms-sell-done';

    // Feature enable/disable keys (stored in localStorage; default: enabled)
    const FEAT_BOARD_LINKS_KEY = 'ms-feat-board-links';
    const FEAT_EVENT_STATS_KEY = 'ms-feat-event-stats';
    const FEAT_COLLECT_ALL_KEY = 'ms-feat-collect-all';
    const FEAT_MY_RANK_KEY = 'ms-feat-my-rank';
    const FEAT_NF_KEY = 'ms-feat-nf';
    const FEAT_AUTO_DUEL_KEY = 'ms-feat-auto-duel';
    const FEAT_SELL_MAX_KEY = 'ms-feat-sell-max';
    const FEAT_QUEST_ADVISOR_KEY = 'ms-feat-eq-advisor';
    const FEAT_PLAYER_LINK_COPY_KEY = 'ms-feat-player-link-copy';

    // Named timing constants (avoids magic numbers scattered through the code)
    const AUTO_DUEL_CLICK_DELAY = 400; // ms to wait for #start_duel_btn state to stabilize
    const AUTO_DUEL_INITIAL_DELAY = 500; // ms before first auto-click after checkbox injection
    const MARKET_PRICE_TIMEOUT_MS = 5000; // ms before giving up on WebSocket market price response
    const PRICE_FETCH_GAP_MS = 150; // ms between sequential market price fetches (avoid WS throttling)
    const MIN_ELAPSED_MS = 60_000; // prevents div-by-zero at event period start
    const EVENT_START_DAY = 4; // events begin on the 4th of each month

    /**
     * Returns true when the feature is enabled.
     * Returns false only when the key is explicitly '0'; absent key defaults to true
     * so all features are on out-of-the-box.
     */
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

    const STRINGS = {
        en: {
            featBoardLinks: 'Board links & mine density',
            featBoardLinksDesc: 'Converts WxH/M board-size text into clickable links and shows the mine density percentage.',
            featEventStats: 'Event score projection',
            featEventStatsDesc: 'Adds a projected end-of-event score column to the events leaderboard.',
            featQuestAll: 'Collect-all buttons',
            featQuestAllDesc: 'Adds a one-click button for table rows with collect actions. The script checks the first column first, then the last column.',
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
            featSellMax: 'Sell max & market price',
            featSellMaxDesc: 'In the Sell modal on the Marketplace page, adds a ▲ button next to each quantity field to fill it with the maximum you own, and a 🏷 button next to each price field to auto-fetch the current market price.',
            featQuestAdvisor: 'Quest Advisor',
            featQuestAdvisorDesc: 'On the Equipment page, shows a panel where you enter a Minecoin target and number of plays, and it recommends the optimal board based on your current equipment bonus.',
            featPlayerLinkCopy: 'Player link copy icon',
            featPlayerLinkCopyDesc: 'Adds a copy icon after player-name links (id starts with player_link_) so you can copy the full profile URL with one click.',
            playerLinkCopyTitle: 'Copy full profile link',
            playerLinkCopiedTitle: 'Copied',
            questAdvisorLabel: 'Quest Advisor',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Target',
            questAdvisorPlay: 'play',
            questAdvisorPlays: 'plays',
            
        },
        de: {
            featBoardLinks: 'Spielfeld-Links & Minendichte',
            featBoardLinksDesc: 'Konvertiert WxH/M-Feldtexte in anklickbare Links und zeigt den Minendichte-Prozentsatz an.',
            featEventStats: 'Event-Punkteprojektion',
            featEventStatsDesc: 'Fügt der Event-Rangliste eine Spalte mit den prognostizierten Endpunkten hinzu.',
            featQuestAll: 'Alle Quests einsammeln',
            featQuestAllDesc: 'Fügt eine Schaltfläche hinzu, um alle verfügbaren Belohnungen in jeder Quest-Tabelle mit einem Klick einzusammeln.',
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
            featSellMax: 'Max. verkaufen & Marktpreis',
            featSellMaxDesc: 'Im Verkaufsdialog auf der Marktplatz-Seite wird eine ▲-Schaltfläche neben jedem Mengenfeld hinzugefügt, um die maximal besessene Menge einzutragen, sowie eine 🏷-Schaltfläche neben jedem Preisfeld zum automatischen Abrufen des aktuellen Marktpreises.',
            featQuestAdvisor: 'Quest-Berater',
            featQuestAdvisorDesc: 'Auf der Ausrüstungsseite erscheint ein Panel, in dem du ein Minecoin-Ziel und die Anzahl der Spielrunden eingibst – das optimale Spielfeld wird basierend auf deinem aktuellen Ausrüstungsbonus empfohlen.',
            featPlayerLinkCopy: 'Symbol zum Kopieren des Spieler-Links',
            featPlayerLinkCopyDesc: 'Fügt hinter Spieler-Links (ID beginnt mit player_link_) ein Kopiersymbol hinzu, um die vollständige Profil-URL mit einem Klick zu kopieren.',
            playerLinkCopyTitle: 'Vollständigen Profil-Link kopieren',
            playerLinkCopiedTitle: 'Kopiert',
            questAdvisorLabel: 'Quest-Berater',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Ziel',
            questAdvisorPlay: 'Runde',
            questAdvisorPlays: 'Runden',

        },
        ru: {
            featBoardLinks: 'Ссылки на поле & плотность мин',
            featBoardLinksDesc: 'Преобразует текст формата WxH/M в кликабельные ссылки и показывает процент плотности мин.',
            featEventStats: 'Прогноз очков события',
            featEventStatsDesc: 'Добавляет столбец с прогнозируемыми итоговыми очками в таблицу лидеров события.',
            featQuestAll: 'Забрать все награды',
            featQuestAllDesc: 'Добавляет кнопку для получения всех доступных наград в каждой таблице заданий одним кликом.',
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
            featSellMax: 'Продать максимум & рыночная цена',
            featSellMaxDesc: 'В диалоге продажи на странице Маркетплейса добавляет кнопку ▲ рядом с каждым полем количества для заполнения максимально возможного, и кнопку 🏷 рядом с полем цены для автоматического получения текущей рыночной цены.',
            featQuestAdvisor: 'Советник',
            featQuestAdvisorDesc: 'На странице снаряжения появляется панель: укажи целевое количество Minecoin и число попыток — скрипт подберёт оптимальное поле с учётом твоего текущего бонуса снаряжения.',
            featPlayerLinkCopy: 'Значок копирования ссылки игрока',
            featPlayerLinkCopyDesc: 'Добавляет значок копирования после ссылок на игрока (id начинается с player_link_), чтобы в один клик копировать полный URL профиля.',
            playerLinkCopyTitle: 'Скопировать полную ссылку профиля',
            playerLinkCopiedTitle: 'Скопировано',
            questAdvisorLabel: 'Советник',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Цель',
            questAdvisorPlay: 'партия',
            questAdvisorPlays: 'партии',

        },
        es: {
            featBoardLinks: 'Enlaces de tablero & densidad de minas',
            featBoardLinksDesc: 'Convierte el texto WxH/M en enlaces clicables y muestra el porcentaje de densidad de minas.',
            featEventStats: 'Proyección de puntuación del evento',
            featEventStatsDesc: 'Añade una columna de puntuación proyectada al final del evento en la tabla de clasificación.',
            featQuestAll: 'Recolectar todas las misiones',
            featQuestAllDesc: 'Añade un botón de un clic para recolectar todas las recompensas disponibles en cada tabla de misiones.',
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
            featSellMax: 'Vender el máximo & precio de mercado',
            featSellMaxDesc: 'En el modal de venta de la página del Mercado, añade un botón ▲ junto a cada campo de cantidad para rellenar el máximo disponible, y un botón 🏷 junto a cada campo de precio para obtener automáticamente el precio de mercado actual.',
            featQuestAdvisor: 'Asesor',
            featQuestAdvisorDesc: 'En la página de Equipamiento aparece un panel: introduce un objetivo de Minecoin y el número de partidas, y obtendrás la recomendación del tablero óptimo según tu bono de equipo actual.',
            featPlayerLinkCopy: 'Icono para copiar enlace de jugador',
            featPlayerLinkCopyDesc: 'Añade un icono de copia después de los enlaces de jugador (id empieza por player_link_) para copiar la URL completa del perfil con un clic.',
            playerLinkCopyTitle: 'Copiar enlace completo del perfil',
            playerLinkCopiedTitle: 'Copiado',
            questAdvisorLabel: 'Asesor',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Objetivo',
            questAdvisorPlay: 'partida',
            questAdvisorPlays: 'partidas',

        },
        pt: {
            featBoardLinks: 'Links de tabuleiro & densidade de minas',
            featBoardLinksDesc: 'Converte o texto WxH/M em links clicáveis e exibe a porcentagem de densidade de minas.',
            featEventStats: 'Projeção de pontuação do evento',
            featEventStatsDesc: 'Adiciona uma coluna de pontuação projetada ao final do evento na tabela de classificação.',
            featQuestAll: 'Coletar todas as missões',
            featQuestAllDesc: 'Adiciona um botão de um clique para coletar todas as recompensas disponíveis em cada tabela de missões.',
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
            featSellMax: 'Vender o máximo & preço de mercado',
            featSellMaxDesc: 'No modal de venda da página do Mercado, adiciona um botão ▲ junto a cada campo de quantidade para preencher o máximo disponível, e um botão 🏷 junto a cada campo de preço para obter automaticamente o preço de mercado atual.',
            featQuestAdvisor: 'Consultor',
            featQuestAdvisorDesc: 'Na página de Equipamento surge um painel: insira uma meta de Minecoin e o número de jogadas para receber a recomendação do tabuleiro ideal com base no seu bónus de equipamento atual.',
            featPlayerLinkCopy: 'Ícone de copiar link do jogador',
            featPlayerLinkCopyDesc: 'Adiciona um ícone de cópia após links de jogador (id começa com player_link_) para copiar a URL completa do perfil com um clique.',
            playerLinkCopyTitle: 'Copiar link completo do perfil',
            playerLinkCopiedTitle: 'Copiado',
            questAdvisorLabel: 'Consultor',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Meta',
            questAdvisorPlay: 'jogada',
            questAdvisorPlays: 'jogadas',

        },
        it: {
            featBoardLinks: 'Link campo & densità mine',
            featBoardLinksDesc: 'Converte il testo WxH/M in link cliccabili e mostra la percentuale di densità delle mine.',
            featEventStats: 'Proiezione punteggio evento',
            featEventStatsDesc: 'Aggiunge una colonna con il punteggio previsto a fine evento nella classifica.',
            featQuestAll: 'Raccolta quest completa',
            featQuestAllDesc: 'Aggiunge un pulsante per raccogliere tutte le ricompense disponibili in ogni tabella delle quest con un clic.',
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
            featSellMax: 'Vendi il massimo & prezzo di mercato',
            featSellMaxDesc: 'Nel modale di vendita della pagina Marketplace, aggiunge un pulsante ▲ accanto a ogni campo quantità per inserire il massimo disponibile, e un pulsante 🏷 accanto a ogni campo prezzo per recuperare automaticamente il prezzo di mercato attuale.',
            featQuestAdvisor: 'Consulente',
            featQuestAdvisorDesc: 'Nella pagina Equipaggiamento compare un pannello: inserisci un obiettivo di Minecoin e il numero di partite per ricevere il consiglio sul campo ottimale in base al tuo bonus equipaggiamento attuale.',
            featPlayerLinkCopy: 'Icona copia link giocatore',
            featPlayerLinkCopyDesc: 'Aggiunge un\'icona di copia dopo i link del giocatore (id che inizia con player_link_) per copiare con un clic l\'URL completo del profilo.',
            playerLinkCopyTitle: 'Copia link completo del profilo',
            playerLinkCopiedTitle: 'Copiato',
            questAdvisorLabel: 'Consulente',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Obiettivo',
            questAdvisorPlay: 'partita',
            questAdvisorPlays: 'partite',

        },
        fr: {
            featBoardLinks: 'Liens de plateau & densité de mines',
            featBoardLinksDesc: 'Convertit le texte WxH/M en liens cliquables et affiche le pourcentage de densité de mines.',
            featEventStats: 'Projection du score d\'événement',
            featEventStatsDesc: 'Ajoute une colonne de score projeté en fin d\'événement au tableau de classement.',
            featQuestAll: 'Collecte de quêtes en masse',
            featQuestAllDesc: 'Ajoute un bouton en un clic pour collecter toutes les récompenses disponibles dans chaque tableau de quêtes.',
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
            featSellMax: 'Vendre le maximum & prix du marché',
            featSellMaxDesc: "Dans la fenêtre de vente de la page Marketplace, ajoute un bouton ▲ à côté de chaque champ de quantité pour remplir le maximum disponible, et un bouton 🏷 à côté de chaque champ de prix pour récupérer automatiquement le prix du marché actuel.",
            featQuestAdvisor: 'Conseiller',
            featQuestAdvisorDesc: 'Sur la page Équipement, un panneau apparaît : saisissez un objectif de Minecoin et le nombre de parties pour obtenir la recommandation du plateau optimal selon votre bonus d\'équipement actuel.',
            featPlayerLinkCopy: 'Icône de copie du lien joueur',
            featPlayerLinkCopyDesc: 'Ajoute une icône de copie après les liens joueur (id commençant par player_link_) pour copier en un clic l\'URL complète du profil.',
            playerLinkCopyTitle: 'Copier le lien complet du profil',
            playerLinkCopiedTitle: 'Copié',
            questAdvisorLabel: 'Conseiller',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: 'Objectif',
            questAdvisorPlay: 'partie',
            questAdvisorPlays: 'parties',

        },
        cn: {
            featBoardLinks: '棋盘链接 & 雷密度',
            featBoardLinksDesc: '将 WxH/M 格式的棋盘文字转换为可点击链接，并显示雷密度百分比。',
            featEventStats: '活动分数预测',
            featEventStatsDesc: '在活动排行榜中添加预测活动结束时总分的列。',
            featQuestAll: '一键领取按钮',
            featQuestAllDesc: '在表格中自动添加一键领取按钮：先检测第一列，没有则检测最后一列。',
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
            featSellMax: '最大出售 & 市场价格',
            featSellMaxDesc: '在市场页面的出售弹窗中，每行数量输入框旁添加 ▲ 按钮以自动填入您拥有的最大数量，价格输入框旁添加 🏷 按钮以自动获取当前市场价格。',
            featQuestAdvisor: '任务顾问',
            featQuestAdvisorDesc: '在装备页面显示一个面板：输入 Minecoin 目标和游玩次数，根据当前装备加成推荐最优棋盘。',
            featPlayerLinkCopy: '玩家链接复制图标',
            featPlayerLinkCopyDesc: '在玩家名称链接（id 以 player_link_ 开头）后添加复制图标，一键复制完整个人主页链接。',
            playerLinkCopyTitle: '复制完整个人主页链接',
            playerLinkCopiedTitle: '已复制',
            questAdvisorLabel: '任务顾问',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: '目标',
            questAdvisorPlay: '局',
            questAdvisorPlays: '局',

        },
        tw: {
            featBoardLinks: '棋盤連結 & 地雷密度',
            featBoardLinksDesc: '將 WxH/M 格式的棋盤文字轉換為可點擊連結，並顯示地雷密度百分比。',
            featEventStats: '活動分數預測',
            featEventStatsDesc: '在活動排行榜中新增預測活動結束時總分的欄位。',
            featQuestAll: '一鍵領取全部任務',
            featQuestAllDesc: '在每個任務表格中新增一鍵領取所有可用獎勵的按鈕。',
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
            featSellMax: '最大出售 & 市場價格',
            featSellMaxDesc: '在市場頁面的出售彈窗中，每行數量輸入框旁新增 ▲ 按鈕以自動填入您擁有的最大數量，價格輸入框旁新增 🏷 按鈕以自動取得目前市場價格。',
            featQuestAdvisor: '任務顧問',
            featQuestAdvisorDesc: '在裝備頁面顯示一個面板：輸入 Minecoin 目標和遊玩次數，根據目前裝備加成推薦最佳棋盤。',
            featPlayerLinkCopy: '玩家連結複製圖示',
            featPlayerLinkCopyDesc: '在玩家名稱連結（id 以 player_link_ 開頭）後方新增複製圖示，一鍵複製完整個人頁面連結。',
            playerLinkCopyTitle: '複製完整個人頁面連結',
            playerLinkCopiedTitle: '已複製',
            questAdvisorLabel: '任務顧問',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: '目標',
            questAdvisorPlay: '局',
            questAdvisorPlays: '局',

        },
        ja: {
            featBoardLinks: 'ボードリンク & 地雷密度',
            featBoardLinksDesc: 'WxH/M 形式のボードテキストをクリック可能なリンクに変換し、地雷密度のパーセンテージを表示します。',
            featEventStats: 'イベントスコア予測',
            featEventStatsDesc: 'イベントリーダーボードにイベント終了時の予測スコア列を追加します。',
            featQuestAll: 'クエスト一括収集',
            featQuestAllDesc: '各クエストテーブルで利用可能なすべての報酬をワンクリックで収集するボタンを追加します。',
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
            featSellMax: '最大売却 & 市場価格',
            featSellMaxDesc: 'マーケットプレイスページの売却ダイアログで、各数量フィールドの横に所有する最大数量を入力する ▲ ボタンを追加し、各価格フィールドの横に現在の市場価格を自動取得する 🏷 ボタンを追加します。',
            featQuestAdvisor: 'クエストアドバイザー',
            featQuestAdvisorDesc: '装備ページにパネルを表示します：Minecoin の目標値とプレイ回数を入力すると、現在の装備ボーナスに基づいて最適なボードを推薦します。',
            featPlayerLinkCopy: 'プレイヤーリンクのコピーアイコン',
            featPlayerLinkCopyDesc: 'プレイヤー名リンク（id が player_link_ で始まる）の後ろにコピーアイコンを追加し、プロフィールの完全なURLをワンクリックでコピーできます。',
            playerLinkCopyTitle: 'プロフィールの完全なリンクをコピー',
            playerLinkCopiedTitle: 'コピーしました',
            questAdvisorLabel: 'クエストアドバイザー',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: '目標',
            questAdvisorPlay: '回',
            questAdvisorPlays: '回',

        },
        ko: {
            featBoardLinks: '보드 링크 & 지뢰 밀도',
            featBoardLinksDesc: 'WxH/M 형식의 보드 텍스트를 클릭 가능한 링크로 변환하고 지뢰 밀도 비율을 표시합니다.',
            featEventStats: '이벤트 점수 예측',
            featEventStatsDesc: '이벤트 리더보드에 이벤트 종료 시 예상 점수 열을 추가합니다.',
            featQuestAll: '퀘스트 전체 수집',
            featQuestAllDesc: '각 퀘스트 테이블에서 사용 가능한 모든 보상을 한 번에 수집하는 버튼을 추가합니다.',
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
            featSellMax: '최대 판매 & 시장 가격',
            featSellMaxDesc: '마켓플레이스 페이지의 판매 모달에서 각 수량 필드 옆에 최대 보유 수량을 자동 입력하는 ▲ 버튼을 추가하고, 각 가격 필드 옆에 현재 시장 가격을 자동으로 가져오는 🏷 버튼을 추가합니다.',
            featQuestAdvisor: '퀘스트 어드바이저',
            featQuestAdvisorDesc: '장비 페이지에 패널이 표시됩니다: Minecoin 목표와 플레이 횟수를 입력하면 현재 장비 보너스를 기반으로 최적의 보드를 추천합니다.',
            featPlayerLinkCopy: '플레이어 링크 복사 아이콘',
            featPlayerLinkCopyDesc: '플레이어 이름 링크(id가 player_link_로 시작) 뒤에 복사 아이콘을 추가해 프로필 전체 URL을 한 번에 복사합니다.',
            playerLinkCopyTitle: '프로필 전체 링크 복사',
            playerLinkCopiedTitle: '복사됨',
            questAdvisorLabel: '퀘스트 어드바이저',
            questAdvisorGoalMC: 'MC',
            questAdvisorTarget: '목표',
            questAdvisorPlay: '판',
            questAdvisorPlays: '판',

        },
    };

    // Computed once at startup — the language code and URL prefix don't change within a session.
    const { _lang, _langPrefix } = (() => {
        const m = /^\/([a-z]{2})(?:\/|$)/.exec(location.pathname);
        const code = m ? m[1] : null;
        return { _lang: code ?? 'en', _langPrefix: code ? '/' + code : '' };
    })();

    /** Returns the translated string for key, falling back to English. */
    function t(key) {
        return STRINGS[_lang]?.[key] ?? STRINGS.en[key] ?? key;
    }

    // ── Board links & density ──────────────────────────────────────────────

    /** Returns a mine-density percentage string, e.g. '20.50%'. */
    function densityPct(w, h, mines) {
        return `${((mines / (w * h)) * 100).toFixed(2)}%`;
    }

    /** Creates an <a> linking to the given board configuration.
     *  For mode 1, wraps the link text in an <abbr class="tooltip-extra"> so hovering
     *  shows a help cursor (cursor:help) and a Bootstrap tooltip with the mine density. */
    function makeLink(w, h, mines, mode) {
        const a = document.createElement('a');
        a.href = `${_langPrefix}/start/${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED_BOARD, '1');
        if (mode === 1) {
            const abbr = document.createElement('abbr');
            abbr.className = 'tooltip-extra';
            abbr.setAttribute('data-original-title', `${t('boardLinksDensityLabel')} ${densityPct(+w, +h, +mines)}`);
            abbr.title = '';
            abbr.textContent = `${w}x${h}/${mines}`;
            a.appendChild(abbr);
        } else {
            a.textContent = `${w}x${h}/${mines}`;
        }
        return a;
    }

    /** Creates a <span> displaying the mine density, e.g. '(20.50%)'. */
    function makeDensitySpan(w, h, mines) {
        const s = document.createElement('span');
        s.className = 'ms-density';
        s.textContent = `(${densityPct(+w, +h, +mines)})`;
        s.style.cssText = 'color:#888;font-size:.9em;margin-left:2px;';
        return s;
    }

    /** Initializes Bootstrap tooltip behavior for board-link density hints. */
    function initBoardTooltip(abbr) {
        if (!abbr || !window.jQuery?.fn.tooltip) return;
        const $abbr = window.jQuery(abbr);
        $abbr.tooltip({ container: 'body', trigger: 'hover' });
        abbr.addEventListener('click', () => $abbr.tooltip('hide'));
    }

    /** Replaces each WxH/M occurrence in a text node with a link and optionally a density span. */
    function processTextNode(node) {
        const parent = node.parentNode;
        if (!parent) return;
        // Prevent generating nested <a> tags from text already inside links.
        if (parent.nodeType === Node.ELEMENT_NODE && parent.closest('a')) return;

        const text = node.textContent;
        const matches = [...text.matchAll(BOARD_RE_G)];
        if (!matches.length) return;

        const mode = _boardLinksMode;
        const frag = document.createDocumentFragment();
        const tooltipElems = [];
        let pos = 0;
        for (const m of matches) {
            const [full, w, h, mines] = m;
            if (m.index > pos) frag.appendChild(document.createTextNode(text.slice(pos, m.index)));
            const link = makeLink(w, h, mines, mode);
            frag.appendChild(link);
            if (mode === 1) tooltipElems.push(link.querySelector('abbr'));
            if (mode === 2) frag.appendChild(makeDensitySpan(w, h, mines));
            pos = m.index + full.length;
        }
        if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
        parent.replaceChild(frag, node);
        tooltipElems.forEach(initBoardTooltip);
    }

    /**
     * Corrects the href of an existing board-link <a> to use the current
     * language prefix, and appends a density span if not already present.
     */
    function processAnchor(a) {
        if (a.getAttribute(PROCESSED_BOARD)) return;

        const m = BOARD_RE.exec(a.textContent.trim());
        if (!m) return;

        const [, w, h, mines] = m;
        const mode = _boardLinksMode;
        a.href = `${_langPrefix}/start/${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED_BOARD, '1');
        if (mode === 1) {
            if (!a.querySelector('abbr.tooltip-extra')) {
                const abbr = document.createElement('abbr');
                abbr.className = 'tooltip-extra';
                abbr.setAttribute('data-original-title', `${t('boardLinksDensityLabel')} ${densityPct(+w, +h, +mines)}`);
                abbr.title = '';
                abbr.textContent = a.textContent;
                a.textContent = '';
                a.appendChild(abbr);
                initBoardTooltip(abbr);
            }
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
        if (tag === 'SCRIPT' || tag === 'STYLE' || node.getAttribute(PROCESSED_BOARD)) return;

        if (tag === 'A') {
            if (BOARD_RE.test(node.textContent)) processAnchor(node);
            return;
        }

        // Snapshot before iterating to guard against DOM mutations during traversal
        Array.from(node.childNodes).forEach(walk);
    }

    // ── Shared DOM observer dispatcher ─────────────────────────────────────
    // All persistent document.body MutationObservers are merged into one shared
    // observer, reducing main-thread callback overhead on high-churn pages.

    // Cached per-navigation values; refreshed by the shared observer on URL change.
    let _boardLinksMode = getBoardLinksMode();
    let _isGamePage = /\/game(\/|$)/.test(location.pathname);

    // Handlers registered by each feature module.
    const _domHandlers = [];

    /** Registers a persistent handler with the shared body MutationObserver. */
    function onDomChange(handler) {
        _domHandlers.push(handler);
    }

    /**
     * Waits for selector to match an element, then calls callback(el) and stops.
     * If the element already exists, callback is invoked immediately.
     */
    function waitFor(selector, callback) {
        const el = document.querySelector(selector);
        if (el) { callback(el); return; }
        function handler() {
            const found = document.querySelector(selector);
            if (found) {
                const idx = _domHandlers.indexOf(handler);
                if (idx !== -1) _domHandlers.splice(idx, 1);
                callback(found);
            }
        }
        _domHandlers.push(handler);
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
        if (initNF._done) return;
        initNF._done = true;
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

        // Persistent — re-inserts checkbox / re-applies NF on every SPA navigation.
        onDomChange(tryInsert);
        onDomChange(() => applyNF(nfEnabled));
        tryInsert();
        applyNF(nfEnabled);
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
            if (now.getUTCDate() < EVENT_START_DAY) {
                if (--m < 0) { m = 11; y--; }
            }
            return { start: Date.UTC(y, m, EVENT_START_DAY), end: Date.UTC(y, m + 1, 1) };
        }

        // Computed once — event boundaries don't change during a session.
        const EVENT_PERIOD = getEventPeriod();

        /**
         * Returns projected stats for a player with the given point total,
         * or null if the event period has not started yet.
         *   avgD — rounded average points per day
         *   est  — rounded projected total at event end
         */
        function calcStats(points) {
            const { start, end } = EVENT_PERIOD;
            const now = Date.now();
            if (now < start) return null;
            const elapsedMs = Math.max(now - start, MIN_ELAPSED_MS); // avoid div-by-zero
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

        // Registered with the shared dispatcher — URL-gated inside trySetup.
        onDomChange(trySetup);
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
        if (initAutoDuel._done) return;
        initAutoDuel._done = true;
        let autoEnabled = localStorage.getItem(AUTO_DUEL_KEY) === '1';
        let clickTimer = null;

        function disableAuto() {
            clearTimeout(clickTimer);
            autoEnabled = false;
            localStorage.setItem(AUTO_DUEL_KEY, '0');
            const c = document.getElementById('ms-auto-duel-chk');
            if (c) c.checked = false;
        }

        function tryClickBtn() {
            if (!autoEnabled) return;
            const reconnectBtn = document.getElementById('reconnect_duel_btn');
            if (reconnectBtn && !reconnectBtn.disabled && !reconnectBtn.classList.contains('disabled')) {
                reconnectBtn.click();
                return;
            }
            const btn = document.getElementById('start_duel_btn');
            if (!btn || btn.disabled || btn.classList.contains('disabled')) return;
            btn.click();
        }

        function scheduleClick(delay) {
            clearTimeout(clickTimer);
            clickTimer = setTimeout(tryClickBtn, delay ?? AUTO_DUEL_CLICK_DELAY);
        }

        // Register cancel/quit listeners immediately — independent of page state.
        // cancel_duel_btn: cancels matchmaking search (lobby state).
        // quit_duel_btn:   quits an ongoing game (in-game state).
        document.addEventListener('click', function (e) {
            const id = e.target?.id ?? e.target?.closest?.('[id^="cancel_duel_btn"],[id^="quit_duel_btn"]')?.id;
            if (id === 'cancel_duel_btn' || id === 'quit_duel_btn') disableAuto();
        }, true);

        // Handles both page states on every DOM change:
        //   Lobby state    — #start_duel_btn present: inject Auto checkbox.
        //   In-game state  — #reconnect_duel_btn present: auto-click when available.
        function tryInsert() {
            // In-game state: watch #reconnect_duel_btn.
            const reconnectBtn = document.getElementById('reconnect_duel_btn');
            if (reconnectBtn && !reconnectBtn.dataset.msDuelObs) {
                reconnectBtn.dataset.msDuelObs = '1';
                scheduleClick(0);
                new MutationObserver(() => scheduleClick()).observe(reconnectBtn, {
                    attributes: true, attributeFilter: ['disabled', 'class']
                });
            }

            // Lobby state: inject Auto checkbox next to #start_duel_btn.
            const btn = document.getElementById('start_duel_btn');
            if (!btn || document.getElementById('ms-auto-duel-chk')) return;

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

            // Re-click automatically whenever #start_duel_btn transitions back to enabled.
            new MutationObserver(() => scheduleClick()).observe(btn, {
                attributes: true, attributeFilter: ['disabled', 'class']
            });

            // Initial auto-click if the feature was already enabled.
            scheduleClick(AUTO_DUEL_INITIAL_DELAY);
        }

        // Persistent — handles both lobby and in-game states across SPA navigation.
        onDomChange(tryInsert);
        tryInsert();
    }

    // ── Quest collect-all ──────────────────────────────────────────────────────

    // ── Collect-all buttons (Quests & Marketplace) ────────────────────────────

    /**
     * Injects a "Collect All" button into each table that contains collectable
     * rows, on both the Quests and Marketplace pages. The button auto-clicks
     * every visible collect_btn in its table and is removed automatically once
     * no collectable rows remain.
     *
     * Per-page config:
     *   pathRe        — URL path pattern that activates this config.
     *   featKey       — localStorage feature-enable key.
     *   btnClass      — CSS class applied to the injected button.
     *   getRoot()     — returns the container to search for tables (null = skip).
     *   getAnchorCell(table) — returns the cell to append the button into.
     */
    function initCollectAll() {
        const BTN_CLASS = 'ms-collect-all';

        function getPlacement(table) {
            const firstColSelector = 'tbody td:first-child button[id^="collect_btn_"]';
            const firstColBtns = table.querySelectorAll(firstColSelector);
            if (firstColBtns.length) {
                const cell = table.querySelector('tr:first-child th:first-child') || table.querySelector('tr:first-child td:first-child');
                if (cell) return { cell, collectBtnSelector: firstColSelector, clickById: true };
            }

            const lastColSelector = 'tbody td:last-child button[class*="collect_btn"]';
            const lastColBtns = table.querySelectorAll(lastColSelector);
            if (lastColBtns.length) {
                const cell = table.querySelector('tr:first-child th:last-child') || table.querySelector('tr:first-child td:last-child');
                if (cell) return { cell, collectBtnSelector: lastColSelector, clickById: false };
            }

            return null;
        }

        function processTable(table) {
            const existingBtns = table.querySelectorAll('.' + BTN_CLASS);
            const placement = getPlacement(table);

            if (!placement) {
                existingBtns.forEach(el => el.remove());
                return;
            }

            const { cell, collectBtnSelector, clickById } = placement;
            let allBtn = cell.querySelector('.' + BTN_CLASS);

            if (existingBtns.length && !allBtn) {
                existingBtns.forEach(el => el.remove());
            }

            if (!allBtn) {
                allBtn = document.createElement('button');
                allBtn.className = BTN_CLASS + ' btn btn-danger btn-xs';
                allBtn.style.cssText = 'vertical-align:middle;';
                allBtn.textContent = t('questCollectAllBtn');
                allBtn.addEventListener('click', () => {
                    if (clickById) {
                        table.querySelectorAll(collectBtnSelector).forEach(btn => {
                            if (!btn.id) return;
                            const target = document.getElementById(btn.id);
                            if (target) target.click();
                        });
                        return;
                    }
                    table.querySelectorAll(collectBtnSelector).forEach(btn => btn.click());
                });
                cell.appendChild(allBtn);
            }
        }

        function trySetup() {
            if (!featEnabled(FEAT_COLLECT_ALL_KEY)) {
                document.querySelectorAll('.' + BTN_CLASS).forEach(el => el.remove());
                return;
            }

            document.querySelectorAll('table.table').forEach(processTable);
        }

        // Registered with the shared dispatcher — re-evaluates on every DOM change
        // so buttons appear/disappear as rows become collectable or are claimed.
        onDomChange(trySetup);
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

        // Registered with the shared dispatcher — survives SPA navigation and
        // re-attaches whenever #stat_my_rank is replaced by a new element.
        onDomChange(() => {
            const span = document.getElementById('stat_my_rank');
            if (span && span !== currentSpan) {
                lastClickedRank = null; // new page context: allow re-click
                attachSpanObs(span);
                tryClick();
            }
        });

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
        function makeIconLink(glyphClass, className) {
            const a = document.createElement('a');
            a.href = 'javascript:void(0)';
            if (className) a.className = className;
            a.innerHTML = `<i class="glyphicon ${glyphClass}"></i>`;
            a.style.cssText = 'margin-left:3px;';
            return a;
        }

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
            let elapsed = 0;
            try {
                $(helpSpan).popover('show');
            } catch (e) {
                console.warn('[WoM Helper] popover error:', e);
                if (onDone) onDone();
                return;
            }
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
                if (elapsed >= MARKET_PRICE_TIMEOUT_MS) {
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
                fetchMarketPrice(id, priceInput, helpSpan, () => setTimeout(next, PRICE_FETCH_GAP_MS));
            }
            next();
        }

        function processSellingContent(content) {
            if (!featEnabled(FEAT_SELL_MAX_KEY)) return;

            const table = content.querySelector('table');
            if (!table) return;
            if (table.querySelectorAll('thead tr th').length < 4) return;

            // Per-row max links (column 2)
            content.querySelectorAll('input.market-amount-small').forEach(input => {
                if (input.getAttribute(PROCESSED_SELL)) return;
                input.setAttribute(PROCESSED_SELL, '1');
                const max = input.getAttribute('max');
                if (!max) return;
                const a = makeIconLink('glyphicon-arrow-up');
                a.addEventListener('click', () => {
                    input.value = max;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
                input.insertAdjacentElement('afterend', a);
            });

            // Per-row market-price fetch links (column 3)
            content.querySelectorAll('input.market-price-small').forEach(priceInput => {
                if (priceInput.getAttribute(PROCESSED_SELL)) return;
                priceInput.setAttribute(PROCESSED_SELL, '1');
                const row = priceInput.closest('tr[id^="selling_item_"]');
                if (!row) return;
                const id = row.id.slice('selling_item_'.length);
                const helpSpan = row.querySelector('td:first-child .help');
                if (!helpSpan) return;
                const a = makeIconLink('glyphicon-tag', 'ms-price-fetch');
                a.addEventListener('click', () => fetchMarketPrice(id, priceInput, helpSpan));
                const coinIcon = priceInput.closest('td')?.querySelector('img');
                (coinIcon || priceInput).insertAdjacentElement('afterend', a);
            });

            // Column 2 header: fill-all ▲ link
            const th2 = table.querySelector('thead tr th:nth-child(2)');
            if (th2 && !th2.querySelector('.ms-sell-max-all')) {
                const allLink = makeIconLink('glyphicon-arrow-up', 'ms-sell-max-all');
                allLink.addEventListener('click', () => fillAll(content));
                th2.appendChild(allLink);
            }

            // Column 3 header: fetch-all price 🏷 link
            const th3 = table.querySelector('thead tr th:nth-child(3)');
            if (th3 && !th3.querySelector('.ms-price-fetch-all')) {
                const allPriceLink = makeIconLink('glyphicon-tag', 'ms-price-fetch-all');
                allPriceLink.addEventListener('click', () => fetchAllPrices(content));
                th3.appendChild(allPriceLink);
            }
        }

        onDomChange(() => {
            const content = document.getElementById('selling_content');
            if (content) processSellingContent(content);
        });

        const content = document.getElementById('selling_content');
        if (content) processSellingContent(content);
    }


    // ── Quest Advisor ───────────────────────────────────────────────────────

    // Board strings for difficulty 1–1500 (index = diff − 1), pipe-separated.
    const _BOARD_LOW = '8x5/8|10x6/12|10x8/16|10x10/20|12x10/24|13x10/26|15x10/30|15x11/33|15x12/36|15x13/39|15x14/42|21x10/42|15x15/45|16x15/48|17x15/51|18x15/54|26x10/52|19x15/57|20x15/60|25x12/60|20x16/64|30x10/60|20x17/68|23x15/69|20x18/72|24x15/72|20x19/76|25x15/75|20x20/80|26x15/78|25x16/80|21x20/84|27x15/81|22x20/88|28x15/84|30x14/84|23x20/92|39x10/78|50x7/70|24x20/96|40x10/80|31x15/93|25x20/100|30x16/96|32x15/96|25x21/105|40x11/88|30x17/102|25x22/110|34x15/102|30x18/108|25x23/115|35x15/105|27x22/118|25x24/120|36x15/108|35x16/112|37x15/111|25x25/125|48x10/96|35x17/119|30x21/126|26x25/130|39x15/117|32x20/128|27x25/135|40x15/120|51x10/102|33x20/132|41x15/123|28x25/140|34x20/136|40x16/128|85x5/85|29x25/145|35x20/140|43x15/129|40x17/136|30x25/150|36x20/144|35x21/147|56x10/112|75x6/90|30x26/156|57x10/114|39x19/148|35x22/154|38x20/152|30x27/162|40x19/152|47x15/141|35x23/161|30x28/168|33x25/165|48x15/144|55x12/132|40x20/160|30x29/174|34x25/170|38x22/167|41x20/164|30x30/180|35x25/175|40x21/168|45x18/162|42x20/168|51x15/153|31x30/186|35x26/182|40x22/176|43x20/172|31x31/192|32x30/192|35x27/189|53x15/159|40x23/184|39x24/187|38x25/190|33x30/198|35x28/196|67x10/134|49x18/176|40x24/192|39x25/195|34x30/204|60x13/156|45x21/189|66x11/145|40x25/200|85x7/119|35x30/210|59x14/165|70x10/140|45x22/198|41x25/205|40x26/208|35x31/217|60x14/168|42x25/210|49x20/196|75x9/135|35x32/224|37x30/222|55x17/187|50x20/200|43x25/215|73x10/146|35x33/231|38x30/228|45x24/216|44x25/220|47x23/216|50x21/210|61x15/183|35x34/238|39x30/234|64x14/179|45x25/225|60x16/192|43x27/232|35x35/245|50x22/220|40x30/240|80x9/144|45x26/234|54x20/216|38x33/250|87x8/139|36x35/252|47x25/235|40x31/248|78x10/156|55x20/220|45x27/243|36x36/259|48x25/240|37x35/259|42x30/252|40x32/256|50x24/240|60x18/216|77x11/169|45x28/252|57x20/228|39x34/265|38x35/266|40x33/264|81x10/162|70x14/196|50x25/250|58x20/232|45x29/261|44x30/264|39x35/273|48x27/259|95x8/152|51x25/255|59x20/236|53x24/254|65x17/221|45x30/270|40x35/280|70x15/210|60x20/240|52x25/260|84x10/168|39x37/288|51x26/265|46x30/276|45x31/279|40x36/288|41x35/287|74x14/207|58x22/255|72x15/216|55x24/264|47x30/282|62x20/248|40x37/296|45x32/288|42x35/294|73x15/219|49x29/284|87x10/174|39x39/304|48x30/288|65x19/247|40x38/304|45x33/297|43x35/301|85x11/187|50x29/290|53x27/286|49x30/294|80x13/208|56x25/280|40x39/312|69x18/248|45x34/306|44x35/308|65x20/260|76x15/228|50x30/300|57x25/285|41x40/326|40x40/320|56x26/291|70x18/252|66x20/264|45x35/315|55x27/297|51x30/306|58x25/290|50x31/310|65x21/273|60x24/288|41x40/328|62x23/285|64x22/281|46x35/322|45x36/324|52x30/312|55x28/308|68x20/272|57x27/307|41x41/336|50x32/320|44x38/334|42x40/336|47x35/329|45x37/333|53x30/318|64x23/294|43x40/343|51x32/326|45x38/341|95x10/190|55x29/319|50x33/330|43x40/344|48x35/336|54x30/324|45x38/342|60x26/312|65x23/299|90x12/216|82x15/246|62x25/310|43x41/352|71x20/284|50x34/340|55x30/330|49x35/343|44x40/352|45x39/351|53x32/339|70x21/294|63x25/315|98x10/196|60x27/324|95x11/209|56x30/336|84x15/252|43x42/361|71x21/298|50x35/350|73x20/292|45x40/360|74x20/295|63x26/327|80x17/272|57x30/342|43x43/369|60x28/336|74x20/296|44x42/369|59x29/342|65x25/325|51x35/357|50x36/360|55x32/352|45x42/376|46x40/368|45x41/369|52x35/363|53x34/360|57x31/353|66x25/330|87x15/261|45x42/377|60x29/348|52x35/364|79x19/299|70x23/322|65x26/338|45x42/378|59x30/354|47x40/376|55x33/363|69x24/331|100x11/220|54x34/367|73x22/321|77x20/308|75x21/315|53x35/371|48x40/383|89x15/267|60x30/360|47x41/385|45x43/387|50x38/380|48x40/384|65x27/351|78x20/312|93x14/260|55x34/374|45x44/395|64x28/358|54x35/378|47x42/394|49x40/391|77x21/323|61x30/366|79x20/316|45x44/396|63x29/365|97x13/252|50x39/390|49x40/392|59x32/377|54x36/388|74x23/340|70x25/350|55x35/385|62x30/372|81x20/323|50x40/399|95x14/266|85x18/306|57x34/387|45x45/405|47x43/404|48x42/403|50x40/400|71x25/355|75x23/345|70x26/363|65x29/376|60x32/384|56x35/392|68x27/367|84x19/319|76x23/349|55x36/396|47x44/413|65x29/377|70x26/364|46x45/414|87x18/313|72x25/360|67x28/375|69x27/372|50x41/410|57x35/399|64x30/384|90x17/306|83x20/332|86x19/326|71x26/369|60x33/396|77x23/354|54x38/410|55x37/407|46x46/423|96x15/288|99x14/277|48x44/422|78x23/358|47x45/423|50x42/420|58x35/406|47x46/431|57x36/410|80x22/352|74x25/370|97x15/291|56x37/414|69x28/386|100x14/280|85x20/340|71x27/383|60x34/408|95x16/304|55x38/418|66x30/396|54x39/421|98x15/294|48x45/432|84x21/352|50x43/430|75x25/375|65x31/403|82x22/360|72x27/388|74x26/384|70x28/392|99x15/297|66x31/408|89x19/338|49x45/440|67x30/402|90x19/341|52x42/436|76x25/380|69x29/400|55x39/429|60x35/420|54x40/432|65x32/415|49x45/441|98x16/313|85x21/357|90x19/342|95x17/323|58x37/429|68x30/408|79x24/379|56x39/436|75x26/390|65x32/416|96x17/326|89x20/355|70x29/406|61x35/427|72x28/403|68x31/420|56x40/446|55x40/440|52x43/447|50x45/450|60x36/432|63x34/428|92x19/349|89x20/356|69x30/414|54x42/452|61x36/438|48x48/460|57x39/444|55x41/450|50x46/459|100x16/320|69x31/426|62x35/434|65x33/429|77x26/400|75x27/405|56x40/448|98x17/333|79x25/395|50x46/460|72x29/417|64x34/435|51x45/459|60x37/444|99x17/336|59x38/448|66x33/435|84x23/386|76x27/410|58x39/452|63x35/441|91x20/364|49x48/470|80x25/400|87x22/382|94x19/357|75x28/419|57x40/456|71x30/426|54x43/464|50x47/470|79x26/410|65x34/442|52x45/468|53x45/475|100x17/340|92x20/368|85x23/391|60x38/456|64x35/448|63x36/453|81x25/405|59x39/460|90x21/378|62x37/458|53x45/476|49x49/480|72x30/432|58x40/464|74x29/429|56x42/470|50x48/480|54x44/475|84x24/403|60x39/467|53x45/477|91x21/382|71x31/440|82x25/410|65x35/455|74x30/442|63x37/465|50x49/489|83x25/414|60x39/468|97x19/368|87x23/400|94x20/376|51x48/489|92x21/386|59x40/472|70x32/448|50x49/490|71x32/453|85x24/408|81x26/421|83x25/415|82x26/425|61x39/475|55x44/484|54x45/486|90x22/396|78x28/436|95x20/380|74x30/444|71x32/454|68x34/462|87x24/416|65x36/468|64x37/473|82x26/426|54x50/530|60x40/480|91x22/400|84x25/420|50x50/500|58x42/487|94x21/394|57x44/499|96x20/384|67x35/469|53x47/498|70x33/462|52x50/516|55x45/495|75x30/450|83x26/431|66x36/475|79x28/442|69x34/469|51x50/509|76x30/455|85x25/425|75x31/463|61x40/488|59x42/495|97x20/388|58x43/498|52x49/509|60x41/492|68x35/476|51x50/510|59x43/505|90x23/414|95x21/399|76x30/456|75x31/464|67x36/482|56x45/504|55x46/506|73x32/467|93x22/409|80x28/448|70x34/476|59x43/506|66x37/488|52x50/519|65x38/493|62x40/496|96x21/403|75x31/465|72x33/475|51x51/520|94x22/413|69x35/483|60x42/504|58x44/510|79x29/458|54x48/518|65x38/494|52x50/520|83x27/448|87x25/435|85x26/442|55x47/517|97x21/407|61x42/511|92x23/423|76x31/471|53x51/537|91x24/435|63x40/504|62x41/508|75x32/479|53x50/529|70x35/490|69x36/496|90x24/432|55x48/527|74x33/487|80x29/464|88x25/440|95x22/418|79x30/473|64x40/511|53x50/530|60x43/516|59x44/519|65x39/507|58x45/522|60x46/545|55x48/528|67x38/508|55x49/537|63x41/516|96x22/422|68x37/503|64x40/512|52x52/540|71x35/497|54x52/556|89x25/445|67x38/509|56x51/563|53x51/540|85x27/459|78x31/483|75x33/494|92x24/441|70x36/504|62x43/531|56x48/537|53x52/549|60x44/528|69x37/510|82x29/475|54x50/540|59x45/531|63x42/528|55x49/539|65x40/520|86x27/464|72x35/504|62x43/532|53x52/550|56x50/556|79x31/489|58x55/617|91x25/454|100x21/420|95x23/437|71x36/511|74x34/503|54x51/550|66x40/527|76x33/501|62x43/533|78x32/498|53x52/551|64x42/536|83x29/481|96x23/441|81x30/486|91x25/455|74x35/516|55x50/550|60x45/540|57x48/547|85x28/476|69x38/524|71x37/524|78x32/499|99x22/435|65x41/533|63x43/541|59x47/553|94x24/451|59x49/572|74x35/517|75x34/510|80x31/496|62x44/545|86x28/481|56x50/559|54x52/561|82x30/492|84x29/487|70x38/531|88x27/475|90x26/468|72x37/531|74x35/518|68x40/542|57x49/558|67x40/536|55x51/561|61x45/549|60x46/552|56x50/560|60x49/581|70x38/532|95x24/456|57x50/568|100x22/440|89x27/480|72x37/532|68x40/543|93x25/465|91x26/473|65x42/546|64x43/550|87x28/487|85x29/493|55x54/589|75x35/525|63x44/554|57x50/569|54x53/572|74x36/532|71x38/539|77x34/523|80x32/512|68x40/544|56x52/580|56x51/571|55x52/572|58x49/568|92x26/478|57x50/570|94x25/470|60x48/574|64x44/562|84x30/504|62x46/569|56x52/581|55x53/582|90x27/486|70x39/546|91x27/490|65x43/559|64x44/563|76x35/532|85x30/509|69x40/552|56x52/582|55x53/583|63x45/567|72x38/547|59x49/578|86x30/514|75x36/540|58x50/580|95x25/475|66x43/567|85x30/510|79x34/536|80x33/528|76x36/546|100x23/460|77x35/539|86x30/515|98x24/470|56x53/593|70x40/560|79x34/537|65x44/572|55x54/594|75x37/554|64x45/576|56x54/603|86x30/516|72x39/561|59x50/590|71x40/567|90x28/504|60x50/598|55x55/604|83x32/531|75x37/555|99x24/475|67x43/576|56x54/604|74x38/562|71x40/568|85x31/527|55x55/605|97x25/485|89x29/516|65x45/585|70x41/574|82x33/541|73x39/569|58x52/603|76x37/562|75x38/569|60x50/600|71x41/581|57x54/614|79x35/553|86x31/533|94x27/507|78x36/561|98x25/490|96x26/499|72x40/576|88x30/528|57x54/615|75x38/570|71x41/582|64x47/601|56x55/616|62x49/607|59x52/613|65x46/598|74x39/577|91x29/527|85x32/544|70x42/588|99x25/495|60x51/612|67x45/602|57x56/635|58x54/625|89x30/534|73x40/584|84x33/554|72x41/590|63x49/616|61x51/621|59x57/663|56x56/627|88x31/545|67x45/603|71x42/596|58x54/626|75x39/585|57x55/627|65x47/611|83x34/564|61x51/622|90x30/540|65x48/622|62x50/620|60x52/624|74x40/592|77x38/585|80x36/576|69x44/607|84x34/570|85x33/561|79x37/584|61x52/633|67x46/616|57x56/638|68x45/612|82x35/574|66x47/620|71x43/610|88x32/562|91x30/546|84x34/571|86x33/567|58x55/638|62x51/632|65x48/624|75x40/600|60x53/636|60x54/646|77x39/600|96x28/537|88x32/563|70x44/616|61x53/645|100x26/520|76x40/607|83x35/581|90x31/558|69x45/621|92x30/552|80x37/592|91x31/563|81x37/598|82x36/590|85x34/578|76x40/608|87x33/574|63x51/642|70x45/629|59x55/649|73x43/626|59x56/659|60x54/648|78x39/608|64x50/640|75x41/615|84x35/588|74x42/621|93x30/558|95x29/551|73x43/627|83x36/597|70x45/630|62x53/656|59x56/660|66x49/646|65x50/649|58x57/661|77x40/616|80x38/608|67x48/643|58x58/671|71x45/638|90x32/576|93x31/575|60x55/660|85x35/595|65x50/650|59x57/671|84x36/604|65x51/661|77x41/630|63x53/666|81x38/615|71x45/639|62x54/668|69x47/648|75x42/630|91x32/582|74x43/636|78x40/624|70x46/644|65x51/662|67x49/656|60x59/701|73x44/642|90x33/593|86x35/602|83x37/614|93x42/744|60x56/672|61x56/681|61x55/671|65x51/663|76x42/638|75x43/644|70x47/657|68x49/665|72x45/648|85x36/612|71x46/653|98x29/568|79x40/632|61x56/682|100x28/560|78x41/639|96x30/576|87x35/609|70x47/658|65x52/675|73x45/656|80x40/639|68x49/666|74x44/651|69x49/674|60x57/684|61x56/683|64x53/678|63x54/680|67x50/670|62x55/682|90x34/611|65x52/676|72x46/662|87x36/625|80x40/640|69x49/675|97x30/582|71x47/667|88x35/616|66x52/685|60x58/695|100x29/579|64x54/690|74x45/665|85x37/629|63x55/692|59x59/696|87x36/626|70x48/672|69x49/676|61x57/695|60x58/696|62x56/694|80x41/655|68x50/680|74x45/666|98x30/588|81x40/648|63x55/693|93x33/613|89x35/623|86x37/636|77x43/662|76x44/668|83x39/647|92x34/624|75x45/674|88x36/633|60x59/707|80x41/656|79x42/663|73x60/835|94x33/619|95x32/608|98x31/606|74x46/680|99x30/594|70x49/686|78x43/670|87x37/643|75x45/675|69x50/690|60x59/708|82x41/670|72x48/690|94x33/620|89x36/640|98x31/607|96x32/614|81x41/664|84x39/655|64x55/704|76x45/683|81x42/678|71x49/695|100x30/600|79x43/678|60x60/719|72x48/691|75x46/689|74x47/694|68x52/706|80x42/672|76x45/684|93x34/632|83x40/664|99x31/613|90x36/647|79x43/679|68x67/868|70x50/700|66x54/712|60x60/720|95x33/627|75x46/690|68x52/707|78x44/686|85x39/663|73x48/700|70x51/712|63x57/718|81x42/680|90x36/648|65x55/715|87x38/661|76x46/698|82x42/687|96x33/633|92x35/644|84x40/672|83x53/839|90x37/664|83x41/680|77x45/693|98x32/627|86x51/836|75x47/704|70x66/880|80x43/688|100x31/620|88x38/668|91x36/655|71x50/710|66x55/725|62x59/731|90x37/665|70x51/714|79x44/695|61x60/732|86x40/686|80x44/702|75x47/705|77x46/707|85x40/680|84x41/688|95x34/646|65x56/728|81x43/696|66x55/726|94x35/657|78x45/702|73x49/715|92x36/662|61x61/743|77x46/708|78x46/715|69x53/730|96x34/652|93x36/668|89x38/676|98x33/646|64x58/741|62x60/743|72x50/720|73x50/728|76x47/714|71x51/724|83x42/697|86x40/688|80x44/704|71x52/736|63x59/743|69x53/731|100x32/640|64x58/742|62x60/744|68x54/734|79x59/887|98x34/664|79x45/711|66x56/739|82x43/705|65x57/741|67x55/737|78x46/717|84x55/879|74x49/725|83x43/712|95x35/665|90x38/684|84x42/705|77x47/723|71x67/907|94x36/676|86x41/704|69x54/744|87x40/696|73x50/730|63x60/755|98x45/840|71x52/738|83x43/713|68x55/747|62x61/756|89x39/694|93x37/687|71x53/750|91x38/691|63x61/766|86x41/705|77x48/737|96x35/672|63x60/756|70x53/742|66x57/752|79x46/726|94x48/860|65x58/754|100x33/660|90x39/701|93x37/688|71x53/751|84x43/721|75x49/735|88x40/704|79x61/916|92x38/698|73x51/744|85x42/714|72x52/748|74x50/740|88x41/719|78x47/733|78x62/920|70x54/755|97x35/679|90x39/702|63x61/768|84x43/722|88x53/889|80x46/735|92x38/699|77x48/739|81x45/729|76x49/744|66x58/765|88x41/720|68x56/761|100x34/679|93x50/885|91x39/709|64x60/768|65x59/767|86x42/722|89x40/712|84x44/737|79x61/919|80x46/736|64x61/779|73x52/758|98x35/686|97x36/697|96x48/878|75x50/750|77x49/753|78x48/748|76x50/758|90x40/719|92x39/716|81x46/744|99x35/692|84x44/738|67x58/776|71x54/766|64x61/780|82x45/738|85x43/731|87x42/730|97x36/698|95x37/703|77x49/754|87x55/912|91x40/726|76x50/759|90x40/720|96x37/709|81x46/745|99x35/693|70x55/770|68x57/775|65x60/780|69x57/784|76x66/954|100x46/877|77x65/952|94x38/714|64x62/792|86x43/739|76x50/760|78x49/763|93x39/724|96x37/710|77x50/768|98x36/705|80x47/752|63x63/793|73x53/773|75x51/765|83x45/747|89x42/745|71x55/780|81x47/760|70x56/783|64x62/793|72x54/777|91x40/728|76x66/956|78x49/764|68x58/788|88x42/739|64x63/804|79x49/772|67x59/790|78x65/964|85x44/748|65x61/793|86x44/755|71x55/781|81x47/761|66x60/792|74x69/972|80x48/767|95x38/722|68x59/800|77x50/770|90x41/738|87x43/748|70x57/796|76x51/775|79x49/773|84x45/756|88x43/755|84x46/770|86x44/756|76x68/982|83x46/763|91x41/745|92x40/736|80x48/768|75x52/780|71x56/794|64x63/806|94x39/733|100x36/719|73x54/788|79x49/774|85x45/764|92x41/752|88x43/756|64x64/817|93x40/743|80x49/782|66x61/805|65x62/806|91x41/746|78x50/780|83x47/778|70x57/798|67x61/815|67x60/804|90x42/755|100x36/720|81x48/777|69x59/812|85x45/765|84x46/772|68x60/814|80x49/783|93x40/744|76x52/790|82x48/785|66x62/817|88x44/772|65x63/818|72x56/805|73x55/802|71x57/808|90x42/756|69x59/813|99x37/732|86x45/773|64x64/819|92x41/754|75x53/795|80x49/784|91x42/763|92x55/962|82x48/786|81x49/792|65x63/819|72x56/806|73x55/803|79x50/790|73x56/815|76x53/804|96x39/748|69x59/814|85x46/781|86x45/774|84x61/977|68x60/816|98x38/744|100x37/739|82x48/787|99x38/750|94x41/768|88x44/774|67x62/829|66x63/830|76x53/805|73x56/816|93x41/762|65x64/831|85x46/782|80x50/799|77x52/801|74x55/813|91x43/780|89x58/982|84x47/789|65x65/842|100x37/740|66x63/831|67x62/830|90x57/977|75x54/810|73x56/817|79x51/805|65x64/832|68x61/829|90x43/774|80x50/800|74x55/814|95x40/760|81x50/808|91x43/781|71x59/835|75x55/823|77x53/815|77x69/1013|67x62/831|69x60/828|94x41/770|79x51/806|89x44/783|86x46/791|78x52/811|85x47/798|88x45/791|98x39/763|81x50/809|69x61/840|65x65/844|75x55/824|95x41/777|77x53/816|95x54/977|93x42/780|67x63/843|66x64/844|76x71/1028|80x51/815|74x56/828|97x40/774|83x64/1012|85x47/799|88x45/792|96x40/768|65x65/845|81x50/810|75x55/825|95x41/778|67x63/844|68x63/854|93x42/781|68x62/843|66x64/845|87x46/800'.split('|');

    // [difficulty, board] pairs for difficulty > 1500, sorted ascending.
    const _BOARD_HIGH = [[1525,'89x45/801'],[1550,'84x49/823'],[1575,'76x56/851'],[1600,'96x42/806'],[1625,'75x59/882'],[1650,'91x46/837'],[1675,'67x67/898'],[1700,'85x51/867'],[1725,'77x59/906'],[1750,'95x45/855'],[1775,'72x64/921'],[1800,'100x43/859'],[1825,'94x47/883'],[1850,'80x58/927'],[1875,'79x59/932'],[1900,'87x71/1175'],[1925,'90x51/918'],[1950,'74x65/962'],[1975,'94x50/937'],[2000,'77x63/970'],[2025,'88x55/965'],[2050,'84x58/973'],[2075,'89x54/961'],[2100,'91x53/964'],[2125,'73x70/1020'],[2150,'89x55/979'],[2175,'76x67/1018'],[2200,'81x63/1019'],[2225,'72x72/1037'],[2250,'77x67/1032'],[2325,'86x61/1046'],[2400,'75x72/1079'],[2475,'79x69/1089'],[2550,'77x73/1121'],[2625,'96x56/1075'],[2700,'86x65/1118'],[2775,'84x68/1142'],[2850,'80x74/1181'],[2925,'92x63/1158'],[3000,'90x89/1521'],[3150,'90x88/1513'],[3300,'86x72/1238'],[3450,'90x90/1553'],[3600,'81x80/1296'],[3750,'100x86/1639'],[3900,'87x78/1353'],[4050,'97x69/1337'],[4200,'99x69/1363'],[4350,'92x76/1396'],[4500,'97x72/1396']];

    /**
     * Returns [difficulty, board] for the smallest difficulty >= minDiff
     * that exists in the lookup table, or null if minDiff exceeds the maximum.
     */
    function findBoard(minDiff) {
        const d = Math.ceil(minDiff);
        if (d <= 1) return [1, _BOARD_LOW[0]];
        if (d <= 1500) return [d, _BOARD_LOW[d - 1]];
        let lo = 0, hi = _BOARD_HIGH.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (_BOARD_HIGH[mid][0] < d) lo = mid + 1;
            else hi = mid;
        }
        return _BOARD_HIGH[lo][0] >= d ? _BOARD_HIGH[lo] : null;
    }

    /**
     * On /equipment pages, injects a panel into #EquipmentBlock that reads the
     * player's Minecoin bonus from the all-stats popover, then recommends the
     * optimal board to play N times to reach a target Minecoin total.
     *
    * Reward per play = difficulty x mc_bonus, where mc_bonus is the
     * numeric value from the "Minecoins: Nx" line of the combined stats tooltip.
     */
    function initQuestAdvisor() {
        function trySetup() {
            if (!/\/equipment(\/|$|\?)/.test(location.pathname)) return;
            if (!featEnabled(FEAT_QUEST_ADVISOR_KEY)) {
                document.getElementById('ms-eq-advisor')?.remove();
                return;
            }
            const block = document.getElementById('EquipmentBlock');
            if (!block || document.getElementById('ms-eq-advisor')) return;

            let bonus = 0;

            const panel = document.createElement('div');
            panel.id = 'ms-eq-advisor';
            panel.style.cssText = 'margin:8px 0;display:flex;align-items:center;flex-wrap:wrap;gap:6px;';

            const lbl = document.createElement('strong');
            lbl.textContent = t('questAdvisorLabel');
            panel.appendChild(lbl);

            const goalSelect = document.createElement('select');
            goalSelect.className = 'form-control input-sm';
            goalSelect.style.width = 'auto';
            [['mc', 'questAdvisorGoalMC']].forEach(([val, key]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = t(key);
                goalSelect.appendChild(opt);
            });
            panel.appendChild(goalSelect);

            const targetInput = document.createElement('input');
            targetInput.type = 'number';
            targetInput.min = '1';
            targetInput.placeholder = t('questAdvisorTarget');
            targetInput.className = 'form-control input-sm';
            targetInput.style.width = '110px';
            panel.appendChild(targetInput);

            const playsSelect = document.createElement('select');
            playsSelect.className = 'form-control input-sm';
            playsSelect.style.width = 'auto';
            for (let i = 1; i <= 5; i++) {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = i + ' ' + t(i === 1 ? 'questAdvisorPlay' : 'questAdvisorPlays');
                playsSelect.appendChild(opt);
            }
            panel.appendChild(playsSelect);

            const resultSpan = document.createElement('span');
            panel.appendChild(resultSpan);

            function parseBonus(text) {
                const m = /([\d.]+)x/.exec(text || '');
                return m ? parseFloat(m[1]) : NaN;
            }

            function tryReadBonus(callback) {
                const el = document.querySelector('.popover .bonus-2');
                if (el) {
                    const v = parseBonus(el.textContent);
                    if (!isNaN(v)) { callback(v); return; }
                }
                const icon = block.querySelector('.all-stats-icon');
                if (!icon || !window.jQuery?.fn.popover) return;
                const $ = window.jQuery;
                try { $(icon).popover('show'); } catch (e) { return; }
                let elapsed = 0;
                const timer = setInterval(() => {
                    elapsed += 50;
                    const popped = document.querySelector('.popover .bonus-2');
                    if (popped) {
                        const v = parseBonus(popped.textContent);
                        clearInterval(timer);
                        try { $(icon).popover('hide'); } catch (_) { /* ignore */ }
                        if (!isNaN(v)) callback(v);
                        return;
                    }
                    if (elapsed >= 3000) clearInterval(timer);
                }, 50);
            }

            function updateResult() {
                const target = parseFloat(targetInput.value);
                const plays = parseInt(playsSelect.value, 10);
                resultSpan.innerHTML = '';
                if (!(target > 0)) return;
                const found = findBoard(Math.ceil(target / plays) / bonus);
                if (found) {
                    const [diff, board] = found;
                    const expected = Math.floor(diff * bonus);
                    const a = document.createElement('a');
                    a.href = `${_langPrefix}/start/${board}`;
                    a.textContent = board;
                    a.style.fontFamily = 'monospace';
                    resultSpan.append('→ ', a, ` (≈${expected} ${t('questAdvisorGoalMC')})`);
                } else {
                    resultSpan.textContent = '→ —';
                }
            }

            [targetInput, playsSelect, goalSelect].forEach(el => {
                el.addEventListener('input', updateResult);
                el.addEventListener('change', updateResult);
            });

            const hr = block.querySelector('.shop-hr');
            if (hr) hr.insertAdjacentElement('beforebegin', panel);
            else block.appendChild(panel);

            // Pre-fill from URL query params (e.g. ?quest=mc&target=1000).
            const _params = new URLSearchParams(location.search);
            const _questParam = _params.get('quest');
            if (_questParam && goalSelect.querySelector(`option[value="${_questParam}"]`)) {
                goalSelect.value = _questParam;
            }
            const _targetParam = parseFloat(_params.get('target'));
            if (_targetParam > 0) {
                targetInput.value = _targetParam;
            }

            let bonusLoaded = false;
            tryReadBonus(v => { bonus = v; bonusLoaded = true; updateResult(); });
            // Only retry if the first attempt failed (avoids a redundant popover flash).
            setTimeout(() => { if (!bonusLoaded) tryReadBonus(v => { bonus = v; updateResult(); }); }, 1000);
        }

        onDomChange(trySetup);
        trySetup();
    }

    // ── Player link copy icon ─────────────────────────────────────────────

    /**
     * Appends a copy icon after profile links with id="player_link_*".
     * Clicking the icon copies the absolute profile URL.
     */
    function initPlayerLinkCopy() {
        const BTN_CLASS = 'ms-player-link-copy';
        const PLAYER_PATH_RE = /^\/(?:[a-z]{2}\/)?player\/\d+\/?$/;

        function setCopyFeedback(btn, copied) {
            btn.title = t(copied ? 'playerLinkCopiedTitle' : 'playerLinkCopyTitle');
            btn.style.color = copied ? '#3c763d' : '#777';
            btn.innerHTML = copied
                ? `<i class="glyphicon glyphicon-ok"></i><span style="margin-left:3px;">${t('playerLinkCopiedTitle')}</span>`
                : '<i class="glyphicon glyphicon-copy"></i>';
        }

        function copyText(text) {
            if (navigator.clipboard?.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise((resolve, reject) => {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                let ok = false;
                try {
                    ok = document.execCommand('copy');
                } catch (_) {
                    ok = false;
                }
                ta.remove();
                if (ok) resolve();
                else reject(new Error('copy failed'));
            });
        }

        function isTargetAnchor(a) {
            if (!a || a.tagName !== 'A') return false;
            if (!a.id || !a.id.startsWith('player_link_')) return false;
            return PLAYER_PATH_RE.test(a.pathname);
        }

        function addCopyIcon(a) {
            const marker = `data-ms-copy-for="${a.id}"`;
            if (a.parentElement?.querySelector(`.${BTN_CLASS}[${marker}]`)) return;

            const btn = document.createElement('a');
            btn.href = 'javascript:void(0)';
            btn.className = BTN_CLASS;
            btn.setAttribute('data-ms-copy-for', a.id);
            btn.style.cssText = 'margin-left:4px;color:#777;text-decoration:none;cursor:pointer;';
            setCopyFeedback(btn, false);
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                setCopyFeedback(btn, true);
                copyText(a.href).then(() => {
                    setTimeout(() => { setCopyFeedback(btn, false); }, 1200);
                }).catch(() => {
                    setCopyFeedback(btn, false);
                });
            });
            a.insertAdjacentElement('afterend', btn);
        }

        function processNode(node) {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.tagName === 'A') {
                if (isTargetAnchor(node)) addCopyIcon(node);
                return;
            }
            node.querySelectorAll('a[id^="player_link_"]').forEach(a => {
                if (isTargetAnchor(a)) addCopyIcon(a);
            });
        }

        function trySetup(mutations) {
            if (!featEnabled(FEAT_PLAYER_LINK_COPY_KEY)) {
                document.querySelectorAll('.' + BTN_CLASS).forEach(el => el.remove());
                return;
            }

            if (!mutations) {
                processNode(document.body);
                return;
            }

            for (const m of mutations) {
                if (!m.addedNodes) continue;
                m.addedNodes.forEach(processNode);
            }
        }

        onDomChange(trySetup);
        trySetup();
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
                key: FEAT_COLLECT_ALL_KEY,
                label: t('featQuestAll'),
                desc: t('featQuestAllDesc'),
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
            {
                key: FEAT_SELL_MAX_KEY,
                label: t('featSellMax'),
                desc: t('featSellMaxDesc'),
            },
            {
                key: FEAT_QUEST_ADVISOR_KEY,
                label: t('featQuestAdvisor'),
                desc: t('featQuestAdvisorDesc'),
            },
            {
                key: FEAT_PLAYER_LINK_COPY_KEY,
                label: t('featPlayerLinkCopy'),
                desc: t('featPlayerLinkCopyDesc'),
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

        onDomChange(tryInsert);
        tryInsert();
    }

    // ── Entry point ────────────────────────────────────────────────────────

    function initPageFeatures() {
        const path = location.pathname;
        if (/\/game(\/|$)/.test(path) && featEnabled(FEAT_NF_KEY)) initNF();

        if (/\/pvp(\/|$|\?)/.test(path) && featEnabled(FEAT_AUTO_DUEL_KEY)) initAutoDuel();
    }

    function init() {
        if (_boardLinksMode !== 0 && !_isGamePage) walk(document.body);

        // Board-links handler for newly added nodes.
        onDomChange(mutations => {
            if (_boardLinksMode === 0 || _isGamePage) return;
            for (const { addedNodes } of mutations) addedNodes.forEach(walk);
        });

        initPageFeatures();
        initEventStats();
        initCollectAll();
        initMyRankClick();
        initSettings();
        initSellMaxBtn();
        initQuestAdvisor();
        initPlayerLinkCopy();

        // Single shared body observer.
        // URL-change detection here replaces unsafe pushState/replaceState monkey-patching.
        let _lastNavPath = location.pathname;
        new MutationObserver(mutations => {
            const path = location.pathname;
            if (path !== _lastNavPath) {
                _lastNavPath = path;
                _boardLinksMode = getBoardLinksMode();
                _isGamePage = /\/game(\/|$)/.test(path);
                initPageFeatures();
            }
            const snapshot = [..._domHandlers];
            for (const h of snapshot) h(mutations);
        }).observe(document.body, { childList: true, subtree: true });

        // Also handle back/forward navigation via the History API.
        window.addEventListener('popstate', () => {
            _boardLinksMode = getBoardLinksMode();
            _isGamePage = /\/game(\/|$)/.test(location.pathname);
            initPageFeatures();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
