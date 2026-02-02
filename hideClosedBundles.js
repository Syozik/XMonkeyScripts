// ==UserScript==
// @name         Hide Closed Bundles
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Indicate PRs merged.
// @author       SERU
// @match        https://runbot.odoo.com/runbot/*?search=*
// @grant        none
// ==/UserScript==

function toggleBundles(shouldHide) {
    const closedBundles = document.querySelectorAll('.line-through');
    for (const bundle of closedBundles) {
        bundle.closest(".bundle_row").style.display = shouldHide ? "none" : "";
    }
}

function addButton(parent) {
    let isHidden = false;
    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", "checkbox");
    checkbox.addEventListener("click", () => {
        toggleBundles(!isHidden)
        isHidden = !isHidden;
    });
    const label = document.createElement("label");
    label.setAttribute("for", "checkbox");
    label.textContent = "Hide closed?";
    const div = document.createElement("div");
    div.style = "display: flex; gap: 5px; ";
    div.appendChild(label);
    div.appendChild(checkbox);
    parent.appendChild(div);
}

function main() {
    addButton(document.querySelector(".slots_infos").closest("div"));
}

main();
