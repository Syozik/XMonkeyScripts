// ==UserScript==
// @name         GitHub Odoo PR
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Improve GitHub Odoo PR by adding links and buttons to useful features like Odoo Tasks and Runbot.
// @author       AGE & DMO
// @match        https://github.com/odoo*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// @require      https://gist.githubusercontent.com/Zynton/2262dc9133523dceeb6cc4487e424b8d/raw/bac2744c81c969b0ca0445039797bf1a5bb39148/waitForKeyElements.js
// @downloadURL  https://gist.github.com/dmo-odoo/ccf2f248e3a7e95f13750931dfe2e000/raw/tampermonkey_odoo.js
// @updateURL    https://gist.github.com/dmo-odoo/ccf2f248e3a7e95f13750931dfe2e000
// ==/UserScript==
/* global waitForKeyElements */

const SETTINGS = {
    target: '_blank',
    style: 'color: inherit;text-decoration: inherit',
    icons: {
        task: '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-browser"><path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25ZM14.5 6h-13v7.25c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25Zm-6-3.5v2h6V2.75a.25.25 0 0 0-.25-.25ZM5 2.5v2h2v-2Zm-3.25 0a.25.25 0 0 0-.25.25V4.5h2v-2Z"></path></svg>',
    },
};

// Improve the PR header on GitHub.
(function() {
    'use strict';
    // Get task IDs and turn them into links.
    let taskId;
    const taskIDSelector = '.comment p, .comment h1, .comment h2, .comment h3, .comment h4, .comment h5, .comment h6, .comment li, .commit-desc > pre';
    waitForKeyElements(taskIDSelector, el => {
        const matches = el.innerHTML.matchAll(/(?:task\s*(?:id)?|opw)[-:]\s*(\d+)/gi);
        for (const [match, id] of matches) {
            taskId ||= id;
            const link = `<a href="https://www.odoo.com/web#id=${id}&cids=1&menu_id=4720&action=333&active_id=1695&model=project.task&view_type=form" target=${SETTINGS.target} style="${SETTINGS.style}"}>${match}</a>`;
            el.innerHTML = el.innerHTML.replace(match, link);
        }
    });
    // Add the buttons.
    const headerSelector = '.gh-header-meta, .gh-header-sticky.is-stuck';
    waitForKeyElements(headerSelector, header => {
        const buttons = []
        // Strip the origin from the head ref.
        let branch = header.querySelector('.head-ref').innerText;
        if (branch.includes(':')) {
            [, branch] = branch.split(':');
        }
        // Update clipboard button to use branch name instead of head ref.
        const clipboardButton = header.querySelector('clipboard-copy');
        clipboardButton.value = branch;
        // Create runbot button.
        const runbotButton = document.createElement('a');
        runbotButton.href = `https://runbot.odoo.com/runbot/r-d-1?search=${branch}`;
        runbotButton.style.marginLeft = '3px';
        runbotButton.innerHTML = '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-beaker"><path d="M5 5.782V2.5h-.25a.75.75 0 0 1 0-1.5h6.5a.75.75 0 0 1 0 1.5H11v3.282l3.666 5.76C15.619 13.04 14.543 15 12.767 15H3.233c-1.776 0-2.852-1.96-1.899-3.458Zm-2.4 6.565a.75.75 0 0 0 .633 1.153h9.534a.75.75 0 0 0 .633-1.153L12.225 10.5h-8.45ZM9.5 2.5h-3V6c0 .143-.04.283-.117.403L4.73 9h6.54L9.617 6.403A.746.746 0 0 1 9.5 6Z"></path></svg>';
        buttons.push(runbotButton);
        // Create task button.
        if (taskId) {
            const taskButton = document.createElement('a');
            taskButton.href = `https://www.odoo.com/web#id=${taskId}&cids=1&menu_id=4720&action=333&active_id=1695&model=project.task&view_type=form`;
            taskButton.style.marginLeft = '4px';
            taskButton.innerHTML = SETTINGS.icons.task;
            buttons.push(taskButton);
        }
        // Configure and insert the buttons.
        for (const button of buttons) {
            button.target = SETTINGS.target;
            button.classList.add('Link--onHover');
            button.classList.add('color-fg-muted');
            clipboardButton.closest('span')?.after(button);
        }
    });
})();
