// ==UserScript==
// @name         Odoo login
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Logins to dev pages as 'admin'
// @author       Serhii Rubanskyi
// @match        localhost:8069/web/login*
// @match        *.odoo.com/web/login*
// @icon        https://cdn-icons-png.flaticon.com/512/154/154345.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const loginButton = document.querySelector(".oe_login_buttons > .btn-primary");
    const loginEl = document.querySelector(".oe_login_form #login");
    const passwordEl = document.querySelector(".oe_login_form #password");
    loginButton.addEventListener("click", (ev) => {
        if (loginEl.value || passwordEl.value) {
            return;
        }
        loginEl.value = "admin";
        passwordEl.value = "admin";
    });
})();
