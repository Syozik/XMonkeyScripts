// ==UserScript==
// @name         Runbot search me
// @namespace    http://tampermonkey.net/
// @version      2026-06-25
// @description  Search my bundles on runbot.
// @author       Serhii Rubanskyi
// @match        https://runbot.odoo.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=odoo.com
// @grant        none
// ==/UserScript==

function main() {
    if (window.location.search === "?search=seru") return;
    const input = document.querySelector(".input-group input");
    input.insertAdjacentHTML("afterend", "<a class='btn btn-default' href='/runbot/rd-1?search=seru'><i class='fa fa-user' />");
    input.nextElementSibling.focus();
}


main();
