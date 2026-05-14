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

    // Matches WxH/M patterns, e.g. 58x35/393
    const BOARD_RE = /(\d+)x(\d+)\/(\d+)/g;
    // Attribute used to mark already-processed nodes and avoid duplicate work
    const PROCESSED = 'data-ms-done';

    /**
     * Extracts the language prefix from the current page URL.
     * e.g. /cn/quests → /cn, /quests → ''
     */
    function getLangPrefix() {
        const m = /^(\/[a-z]{2,})(\/|$)/.exec(location.pathname);
        // Only accept two-letter language codes; exclude functional paths like /start
        if (m && /^\/[a-z]{2}$/.test(m[1])) {
            return m[1];
        }
        return '';
    }

    /**
     * Returns a formatted mine density string: mines / (w * h) * 100%
     */
    function densityText(w, h, mines) {
        return `(${((mines / (w * h)) * 100).toFixed(2)}%)`;
    }

    /**
     * Creates an <a> element linking to the specified board configuration.
     */
    function makeLink(w, h, mines) {
        const a = document.createElement('a');
        a.href = `${getLangPrefix()}/start/${w}x${h}/${mines}`;
        a.textContent = `${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED, '1');
        return a;
    }

    /**
     * Creates a <span> element displaying the mine density.
     */
    function makeDensitySpan(w, h, mines) {
        const s = document.createElement('span');
        s.className = 'ms-density';
        s.textContent = densityText(+w, +h, +mines);
        s.style.cssText = 'color:#888;font-size:.9em;margin-left:2px;';
        return s;
    }

    /**
     * Processes a plain text node: replaces every WxH/M occurrence
     * with a clickable link followed by a density span.
     */
    function processTextNode(node) {
        const parent = node.parentNode;
        if (!parent) return;

        const text = node.textContent;
        BOARD_RE.lastIndex = 0;

        const matches = [];
        let m;
        while ((m = BOARD_RE.exec(text)) !== null) {
            matches.push({
                index: m.index,
                len: m[0].length,
                w: m[1],
                h: m[2],
                mines: m[3],
            });
        }
        if (!matches.length) return;

        const frag = document.createDocumentFragment();
        let pos = 0;
        for (const { index, len, w, h, mines } of matches) {
            if (index > pos) {
                frag.appendChild(document.createTextNode(text.slice(pos, index)));
            }
            frag.appendChild(makeLink(w, h, mines));
            frag.appendChild(makeDensitySpan(w, h, mines));
            pos = index + len;
        }
        if (pos < text.length) {
            frag.appendChild(document.createTextNode(text.slice(pos)));
        }
        parent.replaceChild(frag, node);
    }

    /**
     * Processes an existing <a> element: corrects its href to include the
     * current language prefix and inserts a density span after it.
     */
    function processAnchor(a) {
        if (a.getAttribute(PROCESSED)) return;

        const text = a.textContent.trim();
        BOARD_RE.lastIndex = 0;
        const m = BOARD_RE.exec(text);
        if (!m) return;

        const [, w, h, mines] = m;

        // Rewrite href to match the current page language
        a.href = `${getLangPrefix()}/start/${w}x${h}/${mines}`;
        a.setAttribute(PROCESSED, '1');

        // Only insert a density span if one is not already present immediately after
        const next = a.nextSibling;
        const alreadyHasDensity =
            next &&
            next.nodeType === Node.ELEMENT_NODE &&
            next.classList.contains('ms-density');
        if (!alreadyHasDensity && a.parentNode) {
            a.parentNode.insertBefore(makeDensitySpan(w, h, mines), next);
        }
    }

    /**
     * Recursively walks the DOM, processing text nodes and <a> elements.
     */
    function walk(node) {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            BOARD_RE.lastIndex = 0;
            if (BOARD_RE.test(node.textContent)) processTextNode(node);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;
        // Skip script and style elements
        if (tag === 'SCRIPT' || tag === 'STYLE') return;
        // Skip already-processed elements (including their subtrees)
        if (node.getAttribute(PROCESSED)) return;

        if (tag === 'A') {
            BOARD_RE.lastIndex = 0;
            if (BOARD_RE.test(node.textContent)) processAnchor(node);
            // Do not recurse into the anchor's child text nodes
            return;
        }

        // Snapshot child nodes before iterating to avoid issues caused by DOM mutations
        Array.from(node.childNodes).forEach(walk);
    }

    // ── NF (No-Flag) toggle — game pages only ─────────────────────────────

    const NF_KEY = 'ms-nf-enabled';

    /**
     * Blocks right-click input on the game board.
     * The game uses mousedown/mouseup (button 2) for flagging — not contextmenu —
     * so all three event types must be intercepted in the capture phase.
     */
    function blockRightClick(e) {
        if (e.button === 2 || e.type === 'contextmenu') {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    /**
     * Attaches or detaches right-click blockers on #game.
     * Returns true if #game was found.
     */
    function applyNF(enabled) {
        const game = document.getElementById('game');
        if (!game) return false;
        const m = enabled ? 'addEventListener' : 'removeEventListener';
        ['contextmenu', 'mousedown', 'mouseup'].forEach(evt => {
            game[m](evt, blockRightClick, true);
        });
        return true;
    }

    /**
     * Builds a label+checkbox element. All NF checkboxes share the class
     * 'ms-nf-chk' so they stay in sync when any one is toggled.
     */
    function makeNFCheckbox(id, labelStyle) {
        const label = document.createElement('label');
        label.htmlFor = id;
        label.title   = 'No Flag — disable right-click flagging';
        label.style.cssText = labelStyle;

        const chk = document.createElement('input');
        chk.type      = 'checkbox';
        chk.id        = id;
        chk.className = 'ms-nf-chk';
        chk.style.cssText = 'margin-right:3px;vertical-align:middle;cursor:pointer;';

        const span = document.createElement('span');
        span.textContent = 'NF';
        span.style.verticalAlign = 'middle';

        label.appendChild(chk);
        label.appendChild(span);
        return label;
    }

    /**
     * Injects NF checkboxes after level_select_4 (desktop + mobile compact)
     * and restores the saved preference.
     */
    function initNF() {
        let nfEnabled = localStorage.getItem(NF_KEY) === '1';

        function syncAll() {
            document.querySelectorAll('.ms-nf-chk').forEach(c => {
                c.checked = nfEnabled;
            });
        }

        function onchange() {
            nfEnabled = this.checked;
            syncAll();
            localStorage.setItem(NF_KEY, nfEnabled ? '1' : '0');
            applyNF(nfEnabled);
        }

        /**
         * Inserts checkboxes after level_select_4 in both the desktop row
         * (#levels_full) and the mobile dropdown (#levels_compact).
         * Returns true once #levels_full is found.
         */
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
            const obs = new MutationObserver(() => {
                if (tryInsert()) obs.disconnect();
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        // Apply initial NF state — #game may not exist yet either
        if (!applyNF(nfEnabled)) {
            const obs2 = new MutationObserver(() => {
                if (document.getElementById('game')) {
                    applyNF(nfEnabled);
                    obs2.disconnect();
                }
            });
            obs2.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ──────────────────────────────────────────────────────────────────────

    // ── Event stats columns — /events pages only ──────────────────────────

    function initEventStats() {
        const COL_CLASS = 'ms-evt-col';

        /**
         * Returns the UTC start/end timestamps of the active event.
         * Events run from the 4th of a month at 00:00 UTC through the end of
         * that same month.  Before the 4th, the previous month's event is used.
         */
        function getEventPeriod() {
            const now = new Date();
            let y = now.getUTCFullYear();
            let m = now.getUTCMonth(); // 0-based
            if (now.getUTCDate() < 4) {
                m -= 1;
                if (m < 0) { m = 11; y -= 1; }
            }
            const start = Date.UTC(y, m, 4);       // 4th 00:00 UTC
            const end   = Date.UTC(y, m + 1, 1);   // first of next month
            return { start, end };
        }

        /**
         * Given a player's current point total, returns:
         *   avgH — rounded average points per hour since event start
         *   avgD — rounded average points per day since event start
         *   est  — rounded projected total at event end
         * Returns null if the event hasn't started yet.
         */
        function calcStats(points) {
            const { start, end } = getEventPeriod();
            const now = Date.now();
            if (now < start) return null;
            const elapsedMs = Math.max(now - start, 60000); // avoid div-by-zero
            const totalMs   = end - start;
            const avgPerDay = points / (elapsedMs / 86400000);
            const est = now >= end ? points : avgPerDay * (totalMs / 86400000);
            return {
                avgD: Math.round(avgPerDay),
                est:  Math.round(est),
            };
        }

        /** Appends a single 🎯 header <th> to the thead row (idempotent). */
        function ensureHeaders(thead) {
            const row = thead.querySelector('tr');
            if (!row || row.querySelector('th[data-ms-evt]')) return;
            const th = document.createElement('th');
            th.setAttribute('data-ms-evt', '1');
            th.textContent = '🎯';
            row.appendChild(th);
        }

        /**
         * Adds a <td> to every tbody row with the projected total in a Bootstrap
         * tooltip span: <span class="help" data-original-title="{avg/d}">
         * <strong>EST</strong><img></span>.
         * Stale cells are removed before re-adding.
         * childList-only observer (no subtree) ensures our <td> additions inside
         * rows do not re-trigger the pagination observer.
         */
        function fillBodyCols(tbody) {
            for (const row of tbody.querySelectorAll('tr')) {
                row.querySelectorAll('.' + COL_CLASS).forEach(el => el.remove());
                const strong = row.querySelector('strong[class*="event-pos"]');
                if (!strong) continue;

                const points = parseInt(strong.textContent.replace(/,/g, ''), 10);
                const stats  = isNaN(points) ? null : calcStats(points);
                // Clone the event icon from the existing points cell (varies per event)
                const icon = strong.closest('td')?.querySelector('img') ?? null;

                const td = document.createElement('td');
                td.className = COL_CLASS + ' text-nowrap narrow-td';

                if (stats) {
                    // Tooltip shows avg/h and avg/d; span content is projected total.
                    // Bootstrap 3 tooltip pattern used by the site: title="" +
                    // data-original-title carries the visible tooltip text.
                    const tip = `${stats.avgD.toLocaleString()}/d`;
                    const span = document.createElement('span');
                    span.className = 'help';
                    span.setAttribute('data-original-title', tip);

                    const s = document.createElement('strong');
                    s.textContent = stats.est.toLocaleString();
                    span.appendChild(s);
                    if (icon) span.appendChild(icon.cloneNode(true));

                    td.appendChild(span);
                } else {
                    td.textContent = '\u2013';
                }

                row.appendChild(td);

                // Directly initialize Bootstrap 3 tooltip — the site's delegated
                // .help tooltip may not cover dynamically inserted elements.
                if (stats && window.jQuery && window.jQuery.fn.tooltip) {
                    window.jQuery(td.querySelector('span.help')).tooltip({ container: 'body' });
                }
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

            // childList-only (no subtree) — fires when rows are added/removed
            // by pagination, but NOT when we add <td> cells inside rows.
            new MutationObserver(() => {
                ensureHeaders(thead);
                fillBodyCols(tbody);
            }).observe(tbody, { childList: true });

            return true;
        }

        if (!setupTable()) {
            const obs = new MutationObserver(() => {
                if (setupTable()) obs.disconnect();
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ──────────────────────────────────────────────────────────────────────

    function init() {
        walk(document.body);

        // Initialize NF toggle on game pages
        if (/\/game(\/|$)/.test(location.pathname)) {
            initNF();
        }

        // Initialize event stats columns on events pages
        if (/\/events(\/|$|\?)/.test(location.pathname)) {
            initEventStats();
        }

        // Watch for dynamically loaded content
        new MutationObserver((mutations) => {
            for (const { addedNodes } of mutations) {
                addedNodes.forEach(walk);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
