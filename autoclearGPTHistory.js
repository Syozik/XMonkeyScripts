// ==UserScript==
// @name                Autoclear ChatGPT History
// @description         Auto-clears chat history when visiting chatgpt.com
// @compatible          chrome
// @match               *://chatgpt.com/*
// @connect             cdn.jsdelivr.net
// @connect             gm.autoclearchatgpt.com
// @connect             raw.githubusercontent.com
// @require             https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@3.9.0/dist/chatgpt.min.js#sha256-XyrLEk81vg4/zgOeYDWtugRQKJvrWEefACp0EfwMVHE=
// @require             https://cdn.jsdelivr.net/gh/adamlui/userscripts@ff2baba/assets/js/lib/css.js/dist/css.min.js#sha256-zf9s8C0cZ/i+gnaTIUxa0+RpDYpsJVlyuV5L2q4KUdA=
// @require             https://cdn.jsdelivr.net/gh/adamlui/userscripts@ff2baba/assets/js/lib/dom.js/dist/dom.min.js#sha256-nTc2by3ZAz6AR7B8fOqjloJNETvjAepe15t2qlghMDo=
// @resource rpgCSS     https://cdn.jsdelivr.net/gh/adamlui/ai-web-extensions@727feff/assets/styles/rising-particles/dist/gray.min.css#sha256-48sEWzNUGUOP04ur52G5VOfGZPSnZQfrF3szUr4VaRs=
// @resource rpwCSS     https://cdn.jsdelivr.net/gh/adamlui/ai-web-extensions@727feff/assets/styles/rising-particles/dist/white.min.css#sha256-6xBXczm7yM1MZ/v0o1KVFfJGehHk47KJjq8oTktH4KE=
// @grant               GM_setValue
// @grant               GM_getValue
// @grant               GM_registerMenuCommand
// @grant               GM_unregisterMenuCommand
// @grant               GM_getResourceText
// @grant               GM_xmlhttpRequest
// @grant               GM.xmlHttpRequest
// @noframes
// @downloadURL         https://gm.autoclearchatgpt.com
// @updateURL           https://gm.autoclearchatgpt.com
// @homepageURL         https://autoclearchatgpt.com
// @supportURL          https://support.autoclearchatgpt.com
// @contributionURL     https://ko-fi.com/adamlui
// ==/UserScript==

// Documentation: https://docs.autoclearchatgpt.com
// NOTE: This script relies on the powerful chatgpt.js library @ https://chatgpt.js.org
//  © 2023–2026 KudoAI & contributors under the MIT license.

(async () => {
    'use strict'

    // Init DATA
    window.env = {
        browser: { language: chatgpt.getUserLanguage(), isMobile: chatgpt.browser.isMobile() },
        scriptManager: {
            name: (() => { try { return GM_info.scriptHandler } catch (err) { return 'unknown' }})(),
            version: (() => { try { return GM_info.version } catch (err) { return 'unknown' }})()
        },
        ui: { scheme: getScheme() }
    }
    Object.assign(env.browser, { get isCompact() { return innerWidth <= 480 }})
    env.scriptManager.supportsTooltips = env.scriptManager.name == 'Tampermonkey'
                                      && parseInt(env.scriptManager.version.split('.')[0]) >= 5
    window.xhr = typeof GM != 'undefined' && GM.xmlHttpRequest || GM_xmlhttpRequest
    window.app = {
        version: GM_info.script.version, chatgptjsVer: /chatgpt\.js@([\d.]+)/.exec(GM_info.scriptMetaStr)[1],
        commitHashes: { app: '5367fdd' } // for cached <app|messages>.json + navicon in toggles.sidebar.insert()
    }
    app.urls = { resourceHost: `https://cdn.jsdelivr.net/gh/adamlui/autoclear-chatgpt-history@${app.commitHashes.app}` }
    const remoteData = {
        app: await new Promise(resolve => xhr({
            method: 'GET', url: `${app.urls.resourceHost}/assets/data/app.json`,
            onload: ({ responseText }) => resolve(JSON.parse(responseText))
        })),
        msgs: await new Promise(resolve => {
            const msgHostDir = `${app.urls.resourceHost}/greasemonkey/_locales/`,
                  msgLocaleDir = `${ env.browser.language ? env.browser.language.replace('-', '_') : 'en' }/`
            let msgHref = `${ msgHostDir + msgLocaleDir }messages.json`, msgXHRtries = 0
            function fetchMsgs() { xhr({ method: 'GET', url: msgHref, onload: handleMsgs })}
            function handleMsgs(resp) {
                try { // to return localized messages.json
                    const msgs = JSON.parse(resp.responseText), flatMsgs = {}
                    for (const key in msgs)  // remove need to ref nested keys
                        if (typeof msgs[key] == 'object' && 'message' in msgs[key])
                            flatMsgs[key] = msgs[key].message
                    resolve(flatMsgs)
                } catch (err) { // if bad response
                    msgXHRtries++ ; if (msgXHRtries == 3) return resolve({}) // try original/region-stripped/EN only
                    msgHref = env.browser.language.includes('-') && msgXHRtries == 1 ? // if regional lang on 1st try...
                        msgHref.replace(/(_locales\/[^_]+)_[^_]+(\/)/, '$1$2') // ...strip region before retrying
                            : `${msgHostDir}en/messages.json` // else use default English messages
                    fetchMsgs()
                }
            }
            fetchMsgs()
        })
    }
    Object.assign(app, { ...remoteData.app, urls: { ...app.urls, ...remoteData.app.urls }, msgs: remoteData.msgs })

    // Init SETTINGS
    app.config ??= {}
    const settings = {

        controls: { // displays top-to-bottom in toolbar menu
            autoclear: { type: 'toggle', defaultVal: false,
                label: app.msgs.menuLabel_autoclear, helptip: app.msgs.appDesc },
            toggleHidden: { type: 'toggle', defaultVal: false,
                label: app.msgs.menuLabel_toggleVis, helptip: app.msgs.helptip_toggleVis },
            notifDisabled: { type: 'toggle', defaultVal: false,
                label: app.msgs.menuLabel_modeNotifs, helptip: app.msgs.helptip_modeNotifs },
            clearNow: { type: 'action', symbol: '🧹',
                label: app.msgs.menuLabel_clearNow, helptip: app.msgs.helptip_clearNow }
        },

        load(...keys) {
            keys.flat().forEach(key =>
                app.config[key] = processKey(key, GM_getValue(`${app.configKeyPrefix}_${key}`, undefined)))
            function processKey(key, val) {
                const ctrl = settings.controls?.[key]
                if (val != undefined && ( // validate stored val
                        (ctrl?.type == 'toggle' && typeof val != 'boolean')
                     || (ctrl?.type == 'slider' && isNaN(parseFloat(val)))
                )) val = undefined
                return val ?? (ctrl?.defaultVal ?? (ctrl?.type == 'slider' ? 100 : false))
            }
        },

        save(key, val) { GM_setValue(`${app.configKeyPrefix}_${key}`, val) ; app.config[key] = val },

        typeIsEnabled(key) { // for menu labels + notifs to return ON/OFF
            const reInvertSuffixes = /disabled|hidden/i
            return reInvertSuffixes.test(key) // flag in control key name
                && !reInvertSuffixes.test(this.controls[key]?.label || '') // but not in label msg key name
                    ? !app.config[key] : app.config[key] // so invert since flag reps opposite type state, else don't
        }
    }
    settings.load(Object.keys(settings.controls))

    // Define MENU functions

    const toolbarMenu = {
        state: {
            symbols: ['❌', '✔️'], separator: env.scriptManager.name == 'Tampermonkey' ? ' — ' : ': ',
            words: [app.msgs.state_off.toUpperCase(), app.msgs.state_on.toUpperCase()]
        },

        refresh() {
            if (typeof GM_unregisterMenuCommand == 'undefined') return
            this.entryIDs.forEach(id => GM_unregisterMenuCommand(id))
            this.register()
        },

        register() {

            // Add toggles
            this.entryIDs = Object.keys(settings.controls).map(key => {
                const entryData = settings.controls[key]
                const menuLabel = `${
                    entryData.symbol || this.state.symbols[+settings.typeIsEnabled(key)] } ${entryData.label} ${
                        entryData.type == 'toggle' ? this.state.separator
                                                   + this.state.words[+settings.typeIsEnabled(key)]
                      : entryData.type == 'slider' ? ': ' + app.config[key] + entryData.labelSuffix || ''
                      : entryData.status ? ` — ${entryData.status}` : '' }`
                return GM_registerMenuCommand(menuLabel, () => {
                    if (entryData.type == 'toggle') {
                        settings.save(key, !app.config[key]) ; syncConfigToUI({ updatedKey: key })
                        notify(`${entryData.label}: ${this.state.words[+settings.typeIsEnabled(key)]}`)
                    } else // Clear Now action
                        clearChatsAndGoHome()
                }, env.scriptManager.supportsTooltips ? { title: entryData.helptip || ' ' } : undefined)
            })

            // Add About entry
            this.entryIDs.push(GM_registerMenuCommand(
                `💡 ${app.msgs.menuLabel_about} ${app.msgs.appName}`, () => modals.open('about'),
                env.scriptManager.supportsTooltips ? { title: ' ' } : undefined
            ))
        }
    }

    window.updateCheck = () => {
        xhr({
            method: 'GET', url: `${app.urls.update.gm}?t=${Date.now()}`,
            headers: { 'Cache-Control': 'no-cache' },
            onload: ({ responseText }) => {

                // Compare versions, alert if update found
                app.latestVer = /@version +(.*)/.exec(responseText)?.[1]
                if (app.latestVer) for (let i = 0 ; i < 4 ; i++) { // loop thru subver's
                    const currentSubVer = parseInt(app.version.split('.')[i], 10) || 0,
                          latestSubVer = parseInt(app.latestVer.split('.')[i], 10) || 0
                    if (currentSubVer > latestSubVer) break // out of comparison since not outdated
                    else if (latestSubVer > currentSubVer) // if outdated
                        return modals.open('update', 'available')
                }

                // Alert to no update found, nav back to About
                modals.open('update', 'unavailable') ; modals.open('about')
        }})
    }

    // Define FEEDBACK functions

    function notify(msg, pos = '', notifDuration = '', shadow = '') {
        if (app.config.notifDisabled && !msg.includes(app.msgs.menuLabel_modeNotifs)) return

        // Strip state word to append colored one later
        const foundState = toolbarMenu.state.words.find(word => msg.includes(word))
        if (foundState) msg = msg.replace(foundState, '')

        // Show notification
        chatgpt.notify(`${app.symbol} ${msg}`, pos, notifDuration, shadow || env.ui.scheme == 'light')
        const notif = document.querySelector('.chatgpt-notif:last-child')

        // Append styled state word
        if (foundState) {
            const stateStyles = {
                on: {
                    light: 'color: #5cef48 ; text-shadow: rgba(255,250,169,0.38) 2px 1px 5px',
                    dark:  'color: #5cef48 ; text-shadow: rgb(55,255,0) 3px 0 10px'
                },
                off: {
                    light: 'color: #ef4848 ; text-shadow: rgba(255,169,225,0.44) 2px 1px 5px',
                    dark:  'color: #ef4848 ; text-shadow: rgba(255, 116, 116, 0.87) 3px 0 9px'
                }
            }
            const styledStateSpan = dom.create.elem('span')
            styledStateSpan.style.cssText = stateStyles[
                foundState == toolbarMenu.state.words[0] ? 'off' : 'on'][env.ui.scheme]
            styledStateSpan.append(foundState) ; notif.append(styledStateSpan)
        }
    }

    // Define MODAL functions

    const modals = {
        stack: [], // of types of undismissed modals
        class: `${app.slug}-modal`,

        about() {

            // Show modal
            const labelStyles = 'text-transform: uppercase ; font-size: 17px ; font-weight: bold ;'
                              + `color: ${ env.ui.scheme == 'dark' ? 'white' : '#494141' }`
            const aboutModal = modals.alert(
                `${app.symbol} ${app.msgs.appName}`, // title
                `<span style="${labelStyles}">🧠 ${app.msgs.about_author}:</span> `
                    + `<a href="${app.author.url}" target="_blank" rel="nopener">${app.msgs.appAuthor}</a> `
                    + `${app.msgs.about_and} <a href="${app.urls.contributors}" target="_blank" rel="nopener">`
                    + `${app.msgs.about_contributors}</a>\n`
                + `<span style="${labelStyles}">🏷️ ${app.msgs.about_version}:</span> `
                    + `<span class="about-em">${app.version}</span>\n`
                + `<span style="${labelStyles}">📜 ${app.msgs.about_openSourceCode}:</span> `
                    + `<a href="${app.urls.github}" target="_blank" rel="nopener">`
                        + app.urls.github + '</a>\n'
                + `<span style="${labelStyles}">🚀 ${app.msgs.about_latestChanges}:</span> `
                    + `<a href="${app.urls.github}/commits" target="_blank" rel="nopener">`
                        + `${app.urls.github}/commits</a>\n`
                + `<span style="${labelStyles}">⚡ ${app.msgs.about_poweredBy}:</span> `
                    + `<a href="${app.urls.chatgptjs}" target="_blank" rel="noopener">chatgpt.js</a>`
                        + ` v${app.chatgptjsVer}`,
                [ // buttons
                    function checkForUpdates() { updateCheck() },
                    function getSupport(){},
                    function discuss(){},
                    function moreAIextensions(){}
                ], '', 747 // set width
            )

            // Format text
            aboutModal.querySelector('h2').style.cssText = `
                text-align: center ; font-size: 51px ; line-height: 46px ; padding: 15px 0`
            aboutModal.querySelector('p').style.cssText = `
                text-align: center ; overflow-wrap: anywhere ;
                margin: ${ env.browser.isCompact ? '6px 0 -16px' : '3px 0 29px' }`

            // Hack buttons
            aboutModal.querySelectorAll('button').forEach(btn => {
                btn.style.cssText = 'height: 58px ; min-width: 136px ; text-align: center'

                // Replace link buttons w/ clones that don't dismiss modal
                if (/support|discuss|extensions/i.test(btn.textContent)) {
                    btn.replaceWith(btn = btn.cloneNode(true))
                    btn.onclick = () => modals.safeWinOpen(app.urls[
                        btn.textContent.includes(app.msgs.btnLabel_getSupport) ? 'support'
                      : btn.textContent.includes(app.msgs.btnLabel_discuss) ? 'discuss' : 'relatedExtensions'
                    ])
                }

                // Prepend emoji + localize labels
                if (/updates/i.test(btn.textContent))
                    btn.textContent = `🚀 ${app.msgs.btnLabel_checkForUpdates}`
                else if (/support/i.test(btn.textContent))
                    btn.textContent = `🧠 ${app.msgs.btnLabel_getSupport}`
                else if (/discuss/i.test(btn.textContent))
                    btn.textContent = `⭐ ${app.msgs.btnLabel_discuss}`
                else if (/extensions/i.test(btn.textContent))
                    btn.textContent = `🤖 ${app.msgs.btnLabel_moreAIextensions}`

                // Hide Dismiss button
                else btn.style.display = 'none' // hide Dismiss button
            })

            return aboutModal
        },

        alert(title = '', msg = '', btns = '', checkbox = '', width = '') { // generic one from chatgpt.alert()
            const alertID = chatgpt.alert(title, msg, btns, checkbox, width),
                  alert = document.getElementById(alertID).firstChild
            this.init(alert) // add classes + rising particles bg
            return alert
        },

        init(modal) {
            this.stylize()
            modal.classList.add(this.class) ; modal.parentNode.classList.add(`${this.class}-bg`)
            css.addRisingParticles(modal)
        },

        observeRemoval(modal, modalType, modalSubType) { // to maintain stack for proper nav
            const modalBG = modal.parentNode
            new MutationObserver(([mutation], obs) => {
                mutation.removedNodes.forEach(removedNode => { if (removedNode == modalBG) {
                    if (modals.stack[0].includes(modalSubType || modalType)) { // new modal not launched so nav back
                        modals.stack.shift() // remove this modal type from stack 1st
                        const prevModalType = modals.stack[0]
                        if (prevModalType) { // open it
                            modals.stack.shift() // remove type from stack since re-added on open
                            modals.open(prevModalType)
                        }
                    }
                    obs.disconnect()
                }})
            }).observe(modalBG.parentNode, { childList: true, subtree: true })
        },

        open(modalType, modalSubType) {
            const modal = modalSubType ? this[modalType][modalSubType]() : this[modalType]() // show modal
            if (!modal) return // since no div returned
            this.stack.unshift(modalSubType ? `${modalType}_${modalSubType}` : modalType) // add to stack
            this.init(modal) // add classes + rising particles bg
            this.observeRemoval(modal, modalType, modalSubType) // to maintain stack for proper nav
        },

        safeWinOpen(url) { open(url, '_blank', 'noopener') }, // to prevent backdoor vulnerabilities

        stylize() {
            const { scheme } = env.ui
            if (!this.styles?.isConnected) document.head.append(this.styles ||= dom.create.style())
            this.styles.textContent = `
                .${this.class} { /* modals */
                    user-select: none ; -webkit-user-select: none ; -moz-user-select: none ; -ms-user-select: none ;
                    font-family: -apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto,
                        Oxygen-Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif ;
                    padding: 20px 25px 24px 25px !important ; font-size: 20px ;
                    color: ${ scheme == 'dark' ? 'white' : 'black' } !important ;
                    background-image: linear-gradient(180deg, ${
                       scheme == 'dark' ? '#99a8a6 -200px, black 200px' : '#b6ebff -296px, white 171px' }) }
                .${this.class} [class*=modal-close-btn] {
                    position: absolute !important ; float: right ; top: 14px !important ; right: 16px !important ;
                    cursor: pointer ; width: 33px ; height: 33px ; border-radius: 20px
                }
                .${this.class} [class*=modal-close-btn] svg { height: 10px }
                .${this.class} [class*=modal-close-btn] path {
                    ${ scheme == 'dark' ? 'stroke: white ; fill: white' : 'stroke: #9f9f9f ; fill: #9f9f9f' }}
                ${ scheme == 'dark' ? // invert dark mode hover paths
                    `.${this.class} [class*=modal-close-btn]:hover path { stroke: black ; fill: black }` : '' }
                .${this.class} [class*=modal-close-btn]:hover { background-color: #f2f2f2 } /* hover underlay */
                .${this.class} [class*=modal-close-btn] svg { margin: 11.5px } /* center SVG for hover underlay */
                .${this.class} a { color: #${ scheme == 'dark' ? '00cfff' : '1e9ebb' } !important }
                .${this.class} h2 { font-weight: bold }
                .${this.class} button {
                  --btn-transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out ;
                    font-size: 14px ; text-transform: uppercase ; /* shrink/uppercase labels */
                    border-radius: 0 !important ; /* square borders */
                    transition: var(--btn-transition) ; /* smoothen hover fx */
                       -webkit-transition: var(--btn-transition) ; -moz-transition: var(--btn-transition) ;
                       -o-transition: var(--btn-transition) ; -ms-transition: var(--btn-transition) ;
                    cursor: pointer !important ; /* add finger cursor */
                    border: 1px solid ${ scheme == 'dark' ? 'white' : 'black' } !important ;
                    padding: 8px !important ; min-width: 102px /* resize */
                }
                .${this.class} button:not([class*=primary]) { background: none }
                .${this.class} button:hover {
                    ${ scheme == 'light' ? // reduce intensity of light scheme hover glow
                        '--btn-shadow: 2px 1px 43px #00cfff70 ;' : '' }
                    color: inherit !important ; /* remove color hack */
                    background-color: rgb(${ scheme == 'light' ? '192 223 227 / 5%' : '43 156 171 / 43%' })
                }
                ${ env.browser.isMobile ? '' : `.${this.class} .modal-buttons { margin-left: -13px !important }` }
                .about-em { color: ${ scheme == 'dark' ? 'white' : 'green' } !important }`
        },

        update: {
            width: 377,

            available() {

                // Show modal
                const updateAvailModal = modals.alert(`🚀 ${app.msgs.alert_updateAvail}!`, // title
                    `${app.msgs.alert_newerVer} ${app.msgs.appName} ` // msg
                        + `(v${app.latestVer}) ${app.msgs.alert_isAvail}!  `
                        + '<a target="_blank" rel="noopener" style="font-size: 0.7rem" href="'
                            + `${app.urls.github}/commits/main/greasemonkey/${app.slug}.user.js`
                        + `">${app.msgs.link_viewChanges}</a>`,
                    function update() { // button
                        modals.safeWinOpen(`${app.urls.update.gm}?t=${Date.now()}`)
                    }, '', modals.update.width
                )

                // Localize button labels if needed
                if (!env.browser.language.startsWith('en')) {
                    const updateBtns = updateAvailModal.querySelectorAll('button')
                    updateBtns[1].textContent = app.msgs.btnLabel_update
                    updateBtns[0].textContent = app.msgs.btnLabel_dismiss
                }

                return updateAvailModal
            },

            unavailable() {
                return modals.alert(`${app.msgs.alert_upToDate}!`, // title
                    `${app.msgs.appName} (v${app.version}) ${app.msgs.alert_isUpToDate}!`, // msg
                    '', '', modals.update.width
                )
            }
        }
    }

    // Define UI functions

    function clearChatsAndGoHome() {
        chatgpt.clearChats()

        // Hide history from DOM since chatgpt.clearChats() works back-end only (front-end updates on reload otherwise)
        new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
            document.querySelectorAll('div#history > a').forEach(chatEntry => chatEntry.style.display = 'none')
            if (!clearChatsAndGoHome.historyObserver) { // monitor sidebar to restore temporal headings on new chats
                clearChatsAndGoHome.historyObserver = new MutationObserver(mutations => mutations.forEach(mutation => {
                    if (mutation.type == 'childList') mutation.addedNodes.forEach(node => {
                        if (node.tagName == 'LI') node.closest('ol').previousElementSibling.style.display = 'inherit'
                })}))
                clearChatsAndGoHome.historyObserver.observe(
                    document.querySelector('nav'), { childList: true, subtree: true })
            }
        })

        if (location.pathname != '/') chatgpt.startNewChat() // return home from potential ghost chat
        notify(app.msgs.notif_chatsCleared, 'bottom-right', 2.5)
    }

    function getScheme() {
        return /\b(light|dark)\b/.exec(document.documentElement.className)?.[1]
            || ( window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' )
    }

    function syncConfigToUI({ updatedKey } = {}) {
        if (updatedKey == 'autoclear' && app.config.autoclear) clearChatsAndGoHome()
        if (/autoclear|toggleHidden/.test(updatedKey)) toggles.sidebar.update.state()
        toolbarMenu.refresh() // prefixes/suffixes
    }

    const toggles = {

        sidebar: {
            class: `${app.slug}-sidebar-toggle`,

            create() {

                // Init toggle elems
                this.div = dom.create.elem('div', { class: this.class })
                this.navicon = dom.create.elem('img')
                this.toggleLabel = dom.create.elem('label')
                this.switchSpan = dom.create.elem('span')
                this.knobSpan = dom.create.elem('span')

                // Assemble elems into parent div
                this.switchSpan.append(this.knobSpan)
                this.div.append(this.navicon, this.toggleLabel, this.switchSpan)

                // Stylize elems
                this.stylize() // create/append stylesheet

                // Update scheme/state
                this.update.scheme() ; this.update.state()

                // Add hover/click listeners
                this.div.onmouseover = this.div.onmouseout = ({ type }) => // trigger OpenAI hover overlay
                    this.div.style.setProperty('--item-background-color',
                        `var(--sidebar-surface-${ type == 'mouseover' ? 'secondary' : 'primary' })`)
                this.div.onclick = () => {
                    settings.save('autoclear', !app.config.autoclear) ; syncConfigToUI({ updatedKey: 'autoclear' })
                    notify(`${app.msgs.mode_autoclear}: ${toolbarMenu.state.words[+app.config.autoclear]}`)
                }
            },

            insert() { // requires lib/<chatgpt|dom>.min.js
                const sidebar = document.querySelector(chatgpt.selectors.sidebar)
                if (!sidebar || this.status?.startsWith('insert') || document.querySelector(`.${this.class}`)) return
                this.status = 'inserting' ; if (!this.div) this.create()
                const sidebarHeader = sidebar.querySelector('div#sidebar-header')
                if (sidebarHeader) { sidebarHeader.after(this.div) ; this.status = 'inserted' }
                else {
                    this.status = 'waitingForSidebar'
                    dom.get.loadedElem('div#sidebar-header').then(header => {
                        header.after(this.div) ; this.stylize() ; this.status = 'inserted'
                    }).catch((err) => { this.status = 'failed' ; console.error('toggles.sidebar.insert()', err) })
                }
            },

            stylize() { // requires lib/<chatgpt|dom>.js + env
                const firstLink = chatgpt.getNewChatLink()
                if (firstLink && !this.classesBorrowed) { // borrow/assign classes from sidebar elems
                    const firstIcon = firstLink.querySelector('div:first-child'),
                        firstLabel = firstLink.querySelector('div:nth-child(2)')
                    this.div.classList.add(...firstLink.classList, ...(firstLabel?.classList || []))
                    this.div.querySelector('img')?.classList.add(...(firstIcon?.classList || []))
                    this.classesBorrowed = true
                }
                this.styles ||= dom.create.style(
                    `:root { /* vars */
                      --switch-enabled-bg-color: #ad68ff ; --switch-disabled-bg-color: #ccc ;
                      --switch-enabled-box-shadow: 1px 2px 8px #d8a9ff ;
                      --switch-enabled-hover-box-shadow: 0 1px 10px #9b5ad1 ;
                      --knob-box-shadow: rgba(0,0,0,0.3) 0 1px 2px 0 ;
                      --knob-box-shadow-dark: rgba(0,0,0,0.3) 0 1px 2px 0, rgba(0,0,0,0.15) 0 3px 6px 2px }`

                    // Element styles
                  + `.${this.class} { /* parent div */
                        width: auto ; max-height: 37px ; padding: 0 5px ; user-select: none ; cursor: pointer }
                    .${this.class} > img { /* navicon */
                        width: 1.25rem ; height: 1.25rem ; margin-left: 2px ; margin-right: 4px }
                    .${this.class} > span { /* switch span */
                        position: relative ; width: 30px ; height: 15px ; border-radius: 28px ;
                        background-color: var(--switch-disabled-bg-color) ;
                        bottom: ${ firstLink ? '0.5px' : '-0.15em' } ;
                        transition: 0.4s ; -webkit-transition: 0.4s ; -moz-transition: 0.4s ;
                           -o-transition: 0.4s ; -ms-transition: 0.4s }
                    .${this.class} > span.enabled { /* switch on */
                        background-color: var(--switch-enabled-bg-color) ;
                        box-shadow: var(--switch-enabled-box-shadow) ;
                           -webkit-box-shadow: var(--switch-enabled-box-shadow) ;
                           -moz-box-shadow: var(--switch-enabled-box-shadow) ;
                        transition: 0.15s ; -webkit-transition: 0.15s ; -moz-transition: 0.15s ;
                           -o-transition: 0.15s ; -ms-transition: 0.15s }
                    .${this.class}:hover > span.enabled { /* switch on when hover on parent div */
                        box-shadow: var(--switch-enabled-hover-box-shadow) ;
                       -webkit-box-shadow: var(--switch-enabled-hover-box-shadow) ;
                       -moz-box-shadow: var(--switch-enabled-hover-box-shadow) }
                    .${this.class} > span.disabled { /* switch off */
                        background-color: var(--switch-disabled-bg-color) ; box-shadow: none }
                    .${this.class} > span > span { /* knob span */
                        position: absolute ; width: 12px ; height: 12px ; content: "" ; border-radius: 28px ;
                        background-color: white ; left: 2px ; bottom: 1.25px ;
                        box-shadow: var(--knob-box-shadow) ;
                           -webkit-box-shadow: var(--knob-box-shadow) ; -moz-box-shadow: var(--knob-box-shadow) ;
                        transition: 0.4s ; -webkit-transition: 0.4s ; -moz-transition: 0.4s ;
                           -o-transition: 0.4s ; -ms-transition: 0.4s }
                    .${this.class} > label { /* toggle label */
                        cursor: pointer ; overflow: hidden ; text-overflow: ellipsis ; white-space: nowrap ;
                        color: black ; padding: 0 3px ; flex-grow: 1 ; font-size: var(--text-sm) }`

                    // Dark scheme mods
                  + `.${this.class}.dark > span.enabled { /* switch on */
                        background-color: var(--switch-enabled-bg-color) ;
                        box-shadow: var(--switch-enabled-hover-box-shadow) ; /* use hover style instead */
                           -webkit-box-shadow: var(--switch-enabled-hover-box-shadow) ;
                           -moz-box-shadow: var(--switch-enabled-hover-box-shadow) }
                    .${this.class}.dark:hover > span.enabled { /* switch on when hover on parent div */
                        box-shadow: var(--switch-enabled-box-shadow) ; /* use regular style instead */
                           -webkit-box-shadow: var(--switch-enabled-box-shadow) ;
                           -moz-box-shadow: var(--switch-enabled-box-shadow) }
                    .${this.class}.dark > span > span { /* knob span */
                        box-shadow: var(--knob-box-shadow-dark) ; /* make 3D-er */
                           -webkit-box-shadow: var(--knob-box-shadow-dark) ;
                           -moz-box-shadow: var(--knob-box-shadow-dark) }
                    .${this.class}.dark > label { color: white } /* toggle label */`
                )
                if (!this.styles.isConnected) document.head.append(this.styles)
            },

            update: {

                navicon({ preload } = {}) {
                    const baseURL = `${
                        app.urls.resourceHost.replace(/@\w+/, '@4a52452')}/assets/images/icons/incognito`
                    const schemeMap = { light: 'black', dark: 'white' }, fileName = 'icon32.png'
                    if (preload)
                        Object.keys(schemeMap).forEach(scheme =>
                            new Image().src = `${baseURL}/${schemeMap[scheme]}/${fileName}`)
                    else toggles.sidebar.navicon.src = `${baseURL}/${schemeMap[env.ui.scheme]}/${fileName}`
                },

                scheme() { // to match UI scheme
                    toggles.sidebar.div.classList.remove('dark', 'light')
                    toggles.sidebar.div.classList.add(env.ui.scheme)
                    toggles.sidebar.update.navicon()
                },

                state() {
                    if (!toggles.sidebar.div) return // since toggle never created = sidebar missing
                    toggles.sidebar.div.style.display = app.config.toggleHidden ? 'none' : 'flex'
                    const isOn = app.config.autoclear
                    toggles.sidebar.toggleLabel.textContent = `${app.msgs.mode_autoclear} `
                        + app.msgs[`state_${ isOn ? 'enabled' : 'disabled' }`]
                    requestAnimationFrame(() => {
                        toggles.sidebar.switchSpan.className = isOn ? 'enabled' : 'disabled'
                        toggles.sidebar.knobSpan.style.transform = `translateX(${ isOn ? 13 : 0 }px)`
                    }) // to trigger 1st transition fx
                }
            }
        }
    }

    // Run MAIN routine

    toolbarMenu.register() // create browser toolbar menu
    toggles.sidebar.update.navicon({ preload: true }) // preload sidebar NAVICON variants
    await Promise.race([chatgpt.isLoaded(), new Promise(resolve => setTimeout(resolve, 5000))]) // initial UI loaded
    ;['rpg', 'rpw'].forEach(cssType => // add Rising Particles styles
        document.head.append(dom.create.style(GM_getResourceText(`${cssType}CSS`))))
    toggles.sidebar.insert()

    // AUTO-CLEAR on first visit if enabled
    if (app.config.autoclear) clearChatsAndGoHome()

    // Monitor NODE CHANGES to maintain sidebar toggle visibility
    new MutationObserver(() => {
        if (!app.config.toggleHidden && document.querySelector(chatgpt.selectors.sidebar)
            && !document.querySelector(`.${toggles.sidebar.class}`)
            && toggles.sidebar.status != 'inserting'
        ) { toggles.sidebar.status = 'missing' ; toggles.sidebar.insert() }
    }).observe(document.body, { attributes: true, subtree: true })

    // Monitor SCHEME PREF changes to update sidebar toggle + modal colors
    new MutationObserver(handleSchemePrefChange).observe( // for site scheme pref changes
        document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener( // for browser/system scheme pref changes
        'change', () => requestAnimationFrame(handleSchemePrefChange))
    function handleSchemePrefChange() {
        const displayedScheme = getScheme()
        if (env.ui.scheme != displayedScheme) {
            env.ui.scheme = displayedScheme ; toggles.sidebar.update.scheme() ; modals.stylize() }
    }

})()
