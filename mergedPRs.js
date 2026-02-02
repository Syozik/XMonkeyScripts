// ==UserScript==
// @name         Merged PRs
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Indicate PRs merged.
// @author       BVR
// @match        https://runbot.odoo.com/runbot/*?search=*
// @icon         https://cdn-icons-png.flaticon.com/512/1647/1647447.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    document.querySelectorAll('.line-through').forEach(el => {
        const cell = el.closest('.cell');
        if (!cell) return;

        const oneLine = cell.querySelector('.one_line');
        if (oneLine && !oneLine.classList.contains('line-through')) {
            oneLine.classList.add('line-through');
        }
    });
})();
