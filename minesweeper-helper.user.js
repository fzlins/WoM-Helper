// ==UserScript==
// @name         Minesweeper.online Helper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Converts WxH/M board-size text into clickable links and appends mine density percentage
// @author
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

    function init() {
        walk(document.body);

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
