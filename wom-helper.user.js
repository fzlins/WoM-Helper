// ==UserScript==
// @name         Minesweeper.online Helper
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Converts board-size text (WxH/M) into clickable links with mine density, and adds a No-Flag toggle to disable right-click flagging on minesweeper.online
// @author
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

        function setupTable() {
            const table = document.getElementById('stat_table');
            if (!table) return false;
            const thead = table.querySelector('#stat_table_head');
            const tbody = table.querySelector('#stat_table_body');
            if (!thead || !tbody) return false;

            ensureHeaders(thead);
            fillBodyCols(tbody);

            // childList-only (no subtree) — fires on pagination, not on our own <td> inserts
            new MutationObserver(() => {
                ensureHeaders(thead);
                fillBodyCols(tbody);
            }).observe(tbody, { childList: true });

            return true;
        }

        if (!setupTable()) {
            const obs = new MutationObserver(() => { if (setupTable()) obs.disconnect(); });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ── Entry point ────────────────────────────────────────────────────────

    function initPageFeatures() {
        const path = location.pathname;
        if (/\/game(\/|$)/.test(path)) initNF();
        if (/\/events(\/|$|\?)/.test(path)) initEventStats();
    }

    function init() {
        walk(document.body);
        initPageFeatures();

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
