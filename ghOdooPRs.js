// ==UserScript==
// @name         GitHub Odoo PR
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Improve GitHub Odoo PR by adding links and buttons to useful features like Odoo Tasks and Runbot.
// @author       Syozik
// @match        https://github.com/odoo*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @require      https://gist.githubusercontent.com/Zynton/2262dc9133523dceeb6cc4487e424b8d/raw/bac2744c81c969b0ca0445039797bf1a5bb39148/waitForKeyElements.js
// @downloadURL  https://raw.githubusercontent.com/Syozik/XMonkeyScripts/refs/heads/master/ghOdooPRs.js
// @updateURL    https://raw.githubusercontent.com/Syozik/XMonkeyScripts/refs/heads/master/ghOdooPRs.js
// @resource     runbotImg https://runbot.odoo.com/runbot/static/src/img/icon_ok.png
// @grant        GM_getResourceURL
// ==/UserScript==
/* global waitForKeyElements */

const logo = GM_getResourceURL("runbotImg");

const SETTINGS = {
    target: "_blank",
    style: "color: inherit;text-decoration: inherit",
    icons: {
        task: '<svg aria-hidden="true" height="16" width="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-view-component="true"><circle cx="8" cy="8" r="6" stroke="#714B67" stroke-width="2.5"/></svg>',
        runbot: `<img src="${logo}" alt="runbot logo" height="16" width="16"/>`,
    },
};

const keys = {
    task: {
        regex: /(?:task\s*(?:id)?|opw)[-:]\s*(\d+)/gi,
        getHref: (id) => `https://www.odoo.com/web#id=${id}&cids=1&menu_id=4720&action=333&active_id=974&model=project.task&view_type=form`,
    },
    runbot: {
        regex: /(?:runbot|error)[-:]\s*(\d+)/gi,
        getHref: (id) => `https://runbot.odoo.com/odoo/error/${id}`, 
    },
};

// Improve the PR header on GitHub.
(function() {
    'use strict';
    // Get task IDs and turn them into links.
    const ids = {};
    const taskIDSelector = '.comment p, .comment h1, .comment h2, .comment h3, .comment h4, .comment h5, .comment h6, .comment li, .commit-desc > pre';
    waitForKeyElements(taskIDSelector, (el) => {
        for (const key of Object.keys(keys)) {
            const matches = el.innerHTML.matchAll(keys[key].regex);
            for (const [match, id] of matches) {
                ids[key] = id;
                const link = `<a href="${keys[key].getHref(id)}" target=${SETTINGS.target} style="${SETTINGS.style}">${match}</a>`;
                el.innerHTML = el.innerHTML.replace(match, link);
            }
        }
    });
    // Add the buttons.
    const headerSelector = '.gh-header-meta, .gh-header-sticky.is-stuck, [class*="PageHeader-Description"], [class*=" PullRequestHeaderSummary"]';
    waitForKeyElements(headerSelector, header => {
        const buttons = []
        // Strip the origin from the head ref.
        let branch = header.querySelectorAll('[class*=" prc-BranchName"]')[1].innerText;
        if (branch.includes(':')) {
            [, branch] = branch.split(':');
        }
        // Update clipboard button to use branch name instead of head ref.
        const clipboardButton = header.querySelector("[class^='prc-Button'], [class*=' prc-Button']");
        clipboardButton.addEventListener("click", () => {
            requestAnimationFrame(() => (navigator.clipboard.writeText(branch)));
        });
        // Create runbot button.
        const runbotButton = document.createElement('a');
        runbotButton.href = `https://runbot.odoo.com/runbot/r-d-1?search=${branch}`;
        runbotButton.innerHTML = SETTINGS.icons.runbot;
        buttons.push(runbotButton);
        // Create task button.
        for (const key of Object.keys(keys)) {
            if (ids[key]) {
                const taskButton = document.createElement('a');
                taskButton.href = keys[key].getHref(ids[key]);
                taskButton.innerHTML = SETTINGS.icons[key];
                buttons.push(taskButton);
            }
        }
        // Configure and insert the buttons.
        const clipboardButtonStyle = getComputedStyle(clipboardButton);
        for (const button of buttons) {
            button.target = SETTINGS.target;
            button.classList.add('Link--onHover');
            button.classList.add('color-fg-muted');
            button.style.height = clipboardButtonStyle.height;
            button.style.width = clipboardButtonStyle.width;
            button.style.display = "flex";
            button.style.alignItems = "center";
            button.style.justifyContent = "center";
            clipboardButton?.after(button);
        }
    });
})();
