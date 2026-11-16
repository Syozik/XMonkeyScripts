// ==UserScript==
// @name         Hide Closed Bundles
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Indicate PRs merged.
// @author       SERU
// @match        https://runbot.odoo.com/runbot*
// @grant        none
// ==/UserScript==

function main() {
    const closedBundles = document.querySelectorAll(".line-through");
    closedBundles.forEach((el) => {
        const cell = el.closest('.cell');
        if (!cell) return;

        const text = cell.querySelector('b');
        if (text && !text.classList.contains('line-through')) {
            text.classList.add('line-through');
        }
    });

    const toggleBundles = (shouldHide) => {
        for (const bundle of closedBundles) {
            bundle.closest(".bundle_row").style.display = shouldHide ? "none" : "";
        }
    }

    const parent = document.querySelector(".slots_infos").closest("div");
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

main();
