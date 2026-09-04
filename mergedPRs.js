// ==UserScript==
// @name         Merged PRs
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Indicate PRs merged.
// @author       SERU (fork from BVR)
// @match        https://runbot.odoo.com/runbot/*?search=*
// @icon         https://cdn-icons-png.flaticon.com/512/1647/1647447.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    document.querySelectorAll('.line-through').forEach(el => {
        const cell = el.closest('.cell');
        if (!cell) return;

        const text = cell.querySelector('b');
        if (text && !text.classList.contains('line-through')) {
            text.classList.add('line-through');
        }
    });
})();
