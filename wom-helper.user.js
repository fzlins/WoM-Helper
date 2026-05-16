// ==UserScript==
// @name         Minesweeper.online Helper
// @namespace    http://tampermonkey.net/
// @version      1.6.0
// @description  Converts board-size text (WxH/M) into clickable links with mine density, adds a No-Flag toggle, shows event score projections, auto-clicks the player's rank link, adds an auto-find-opponent toggle on the PvP page, adds a collect-all button on the Quests page, and adds a sell-max button on the Marketplace page on minesweeper.online
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

    // ── Board links & density ──────────────────────────────────────────────

    /** Returns the two-letter language prefix from the URL, e.g. '/cn', or ''. */
    function getLangPrefix() {
        const m = /^(\/[a-z]{2})(\/|$)/.exec(location.pathname);
        return m ? m[1] : '';
    }

    /** Returns a mine-density string, e.g. '(20.50%)'. */
    function densityText(w, h, mines) {
        return `(${((mines / (w * h)) * 100).toFixed(2)}%)`;
    }

    /** Creates an <a> linking to the given board configuration. */
    function makeLink(w, h, mines) {
        const a = document.createElement('a');
        a.href = `${getLangPrefix()}/start/${w}x${h}/${mines}`;
        a.textContent = `${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED, '1');
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

    /** Replaces each WxH/M occurrence in a text node with a link + density span. */
    function processTextNode(node) {
        const parent = node.parentNode;
        if (!parent) return;

        const text = node.textContent;
        const matches = [...text.matchAll(/(\d+)x(\d+)\/(\d+)/g)];
        if (!matches.length) return;

        const frag = document.createDocumentFragment();
        let pos = 0;
        for (const m of matches) {
            const [full, w, h, mines] = m;
            if (m.index > pos) frag.appendChild(document.createTextNode(text.slice(pos, m.index)));
            frag.appendChild(makeLink(w, h, mines));
            frag.appendChild(makeDensitySpan(w, h, mines));
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
        a.href = `${getLangPrefix()}/start/${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED, '1');

        const next = a.nextSibling;
        const alreadyHasDensity =
            next?.nodeType === Node.ELEMENT_NODE && next.classList.contains('ms-density');
        if (!alreadyHasDensity && a.parentNode) {
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

        /** Appends the 🎯 header column to the leaderboard thead (idempotent). */
        function ensureHeaders(thead) {
            const row = thead.querySelector('tr');
            if (!row || row.querySelector('th[data-ms-evt]')) return;
            const th = document.createElement('th');
            th.setAttribute('data-ms-evt', '1');
            th.textContent = '🎯';
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
                    span.setAttribute('data-original-title', `${stats.avgD.toLocaleString()}/d`);

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
            if (!thead || !tbody || tbody === currentTbody) return;
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
                allBtn.innerHTML = collectBtns[0].innerHTML;
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
     * On /marketplace pages, injects a ▲ link after each quantity input in
     * the "出售" (Sell) modal. Clicking the link fills the input with its
     * maximum value (the quantity the player currently owns).
     */
    function initSellMaxBtn() {
        function fillAll(content) {
            content.querySelectorAll('input.market-amount-small').forEach(input => {
                const max = input.getAttribute('max');
                if (!max) return;
                input.value = max;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        function processSellingContent(content) {
            // Per-row max links
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

            // Column-header fill-all link
            const table = content.querySelector('table');
            if (!table) return;
            const th = table.querySelector('thead tr th:nth-child(2)');
            if (!th || th.querySelector('.ms-sell-max-all')) return;
            const allLink = document.createElement('a');
            allLink.href = 'javascript:void(0)';
            allLink.className = 'ms-sell-max-all';
            allLink.innerHTML = '<i class="glyphicon glyphicon-arrow-up"></i>';
            allLink.style.cssText = 'margin-left:3px;';
            allLink.addEventListener('click', () => fillAll(content));
            th.appendChild(allLink);
        }

        new MutationObserver(() => {
            const content = document.getElementById('selling_content');
            if (content) processSellingContent(content);
        }).observe(document.body, { childList: true, subtree: true });

        const content = document.getElementById('selling_content');
        if (content) processSellingContent(content);
    }

    // ── Entry point ────────────────────────────────────────────────────────

    function initPageFeatures() {
        const path = location.pathname;
        if (/\/game(\/|$)/.test(path)) initNF();

        if (/\/pvp(\/|$|\?)/.test(path)) initAutoDuel();
    }

    function init() {
        walk(document.body);
        initPageFeatures();
        initEventStats();
        initQuestCollect();
        initMyRankClick();
        initSellMaxBtn();

        new MutationObserver(mutations => {
            for (const { addedNodes } of mutations) addedNodes.forEach(walk);
        }).observe(document.body, { childList: true, subtree: true });

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
