// ==UserScript==
// @name         Minesweeper.online Helper
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Converts WxH/M board-size text into clickable links, appends mine density, and adds NF (No-Flag) toggle on game pages
// @author
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

    function init() {
        walk(document.body);

        // Initialize NF toggle on game pages
        if (/\/game(\/|$)/.test(location.pathname)) {
            initNF();
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
