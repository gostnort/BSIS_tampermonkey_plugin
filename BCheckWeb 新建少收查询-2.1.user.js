// ==UserScript==
// @name         BCheckWeb 新建少收查询现代表单 - 2.1
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  新建少收查询展示层重构：H2/H4、下划线输入、纵向布局、字段映射提交
// @author       Gostnort
// @match        http://60.247.100.98/BCheckWeb/*
// @match        https://60.247.100.98/BCheckWeb/*
// @match        http://202.96.17.98/BCheckWeb/*
// @match        https://202.96.17.98/BCheckWeb/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const STYLE_ID = 'tmk-lqv2-style';
    const WRAP_ID = 'tmk-lqv2-wrap';
    const TOOLBAR_ID = 'tmk-lqv2-toolbar';
    const GLASS_ID = 'tmk-lqv2-glass';
    const state = {
        mode: 'modern',
        form: null,
        receiveCompany: null,
        receiveCompanyInputs: [],
        bagnum: null,
        bagnumInputs: [],
        idnum: null,
        idnumInputs: [],
        ticketNum: null,
        ticketNumInputs: [],
        submitButton: null,
        typeSelect: null,
        wrap: null,
        glass: null
    };


    function isTargetPage() {
        return /newBaggageLostSearch_menuAction\.action/i.test(String(window.location.href || ''));
    }


    function normalizeText(text) {
        return String(text || '').replace(/\s+/g, '').trim();
    }


    function injectStyle() {
        if (!document.head || document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html,
            body {
                background: transparent !important;
                color: #111111 !important;
                font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif !important;
            }
            .l_mainContentL1,
            #content_1,
            .ui-page,
            .ui-content {
                background: transparent !important;
            }
            #${GLASS_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483644;
                display: none;
                background: rgba(223, 230, 238, 0.4);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            #${TOOLBAR_ID} {
                position: fixed;
                top: 10px;
                right: 12px;
                z-index: 2147483647;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.75);
                border: 1px solid #9db8d2;
                box-shadow: 0 6px 16px rgba(23, 52, 86, 0.16);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
            .tmk-lqv2-btn {
                min-height: 30px;
                padding: 0 12px;
                border-radius: 999px;
                border: 1px solid #8fb1cc;
                background: #ffffff;
                color: #1a3a5a;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .tmk-lqv2-btn.tmk-active {
                background: #3f89d0;
                border-color: #3f89d0;
                color: #ffffff;
            }
            #${WRAP_ID} {
                width: min(680px, calc(100vw - var(--tmk-left-gap, 16px) - 24px));
                margin: 0;
                padding: 4px 4px 16px 4px;
                box-sizing: border-box;
                position: fixed;
                top: 72px;
                left: var(--tmk-left-gap, 16px);
                z-index: 2147483646;
                max-height: calc(100vh - 92px);
                overflow: auto;
                background: rgba(223, 230, 238, 0.7);
                border: 1px solid rgba(151, 177, 203, 0.45);
                border-radius: 12px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: 0 10px 24px rgba(37, 64, 92, 0.16);
            }
            #${WRAP_ID} h2 {
                margin: 0 0 18px 0;
                color: #111111;
                font-size: 34px;
                font-weight: 700;
                line-height: 1.15;
            }
            #${WRAP_ID} h4 {
                margin: 18px 0 8px 0;
                color: #111111;
                font-size: 18px;
                font-weight: 600;
                line-height: 1.3;
            }
            #${WRAP_ID} .tmk-input {
                width: 100%;
                min-height: 42px;
                border: 0;
                border-bottom: 2px solid #7ea2c1;
                border-radius: 0;
                background: transparent;
                color: #111111;
                font-size: 20px;
                padding: 6px 2px;
                box-sizing: border-box;
                outline: none;
            }
            #${WRAP_ID} .tmk-input:focus {
                border-bottom-color: #3f89d0;
            }
            #${WRAP_ID} .tmk-radio-row {
                display: flex;
                align-items: center;
                gap: 18px;
                margin: 8px 0 4px 0;
            }
            #${WRAP_ID} .tmk-radio-row label {
                color: #111111;
                font-size: 17px;
                cursor: pointer;
            }
            #${WRAP_ID} .tmk-submit {
                margin-top: 22px;
                width: 100%;
                min-height: 46px;
                border: 1px solid #78abd6;
                border-radius: 10px;
                background: #8cc7e8;
                color: #111111;
                font-size: 20px;
                font-weight: 600;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }


    function ensureGlassLayer() {
        if (!document.body) return;
        let glass = document.getElementById(GLASS_ID);
        if (!glass) {
            glass = document.createElement('div');
            glass.id = GLASS_ID;
            document.body.appendChild(glass);
        }
        state.glass = glass;
    }


    function calcLeftGap() {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        const shortSide = Math.min(vw, vh);
        let smallTile = 0;
        try {
            if (window.top && window.top.__tmkUiMetrics && Number.isFinite(window.top.__tmkUiMetrics.small)) {
                smallTile = Number(window.top.__tmkUiMetrics.small);
            }
        } catch (e) {}
        if (!smallTile && window.__tmkUiMetrics && Number.isFinite(window.__tmkUiMetrics.small)) {
            smallTile = Number(window.__tmkUiMetrics.small);
        }
        if (!smallTile) {
            smallTile = Math.max(46, Math.min(78, Math.round(shortSide * 0.07)));
        }
        return Math.max(10, Math.min(20, Math.round(smallTile * 0.4)));
    }


    function applyLeftGap() {
        if (!document.documentElement) return;
        document.documentElement.style.setProperty('--tmk-left-gap', `${calcLeftGap()}px`);
    }


    function findLegacyControls() {
        const form = document.querySelector('#newBaggageLostSearch');
        if (!(form instanceof HTMLElement)) return false;
        const pickInputs = (id, name) => {
            const set = new Set();
            const nodes = [];
            const selectors = [`#${id}`, `input[name="${name}"]`, `textarea[name="${name}"]`];
            selectors.forEach((selector) => {
                Array.from(form.querySelectorAll(selector)).forEach((node) => {
                    if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement)) return;
                    if (set.has(node)) return;
                    set.add(node);
                    nodes.push(node);
                });
            });
            return nodes;
        };
        const pickSubmit = () => {
            const candidates = Array.from(form.querySelectorAll('#l_search, button[id="l_search"], input[id="l_search"], .l_search'));
            const visible = candidates.find((el) => el instanceof HTMLElement && el.offsetParent !== null);
            return visible || candidates[0] || null;
        };
        state.form = form;
        state.receiveCompanyInputs = pickInputs('receiveCompany', 'receiveCompany');
        state.bagnumInputs = pickInputs('bagnum', 'bagnum');
        state.idnumInputs = pickInputs('idnum', 'idnum');
        state.ticketNumInputs = pickInputs('ticketNum', 'ticketNum');
        state.receiveCompany = state.receiveCompanyInputs[0] || null;
        state.bagnum = state.bagnumInputs[0] || null;
        state.idnum = state.idnumInputs[0] || null;
        state.ticketNum = state.ticketNumInputs[0] || null;
        state.submitButton = pickSubmit();
        state.typeSelect = form.querySelector('select[onchange*="changeICKISearch"], select[name*="ick"], select[id*="ick"]');
        return !!(state.receiveCompanyInputs.length && state.bagnumInputs.length && state.idnumInputs.length && state.ticketNumInputs.length && state.submitButton);
    }


    function getTitleText() {
        const titleNode = document.getElementById('menu_1');
        const title = normalizeText(titleNode ? titleNode.textContent : '');
        return title || '新建少收查询';
    }


    function getH4Labels() {
        const sanitizeLabel = (text) => {
            const stripped = normalizeText(text).replace(/[*＊:：]/g, '').trim();
            return stripped;
        };
        const getCommentLabel = (row) => {
            if (!(row instanceof HTMLElement)) return '';
            const html = String(row.innerHTML || '');
            const comments = Array.from(html.matchAll(/<!--\s*([^<>]+?)\s*-->/g)).map((m) => sanitizeLabel(m[1] || ''));
            return comments.find((s) => s && /[\u4e00-\u9fa5A-Za-z]/.test(s)) || '';
        };
        const parseRow = (control) => {
            if (!(control instanceof HTMLElement)) return null;
            const row = control.closest('.l_row, .ui-grid-a, .ui-grid-b, tr, li, div');
            if (!(row instanceof HTMLElement)) return null;
            const labelNode = row.querySelector('.ui-block-a.l_right, label, th, td');
            const rawLabel = sanitizeLabel(labelNode ? labelNode.textContent || '' : '');
            const commentLabel = getCommentLabel(row);
            const label = rawLabel || commentLabel;
            const required = /[*＊]/.test(normalizeText(row.innerText || ''));
            return { label, required };
        };
        const receiveInfo = parseRow(state.receiveCompany);
        const bagInfo = parseRow(state.bagnum);
        const idInfo = parseRow(state.idnum || state.ticketNum);
        return {
            receive: receiveInfo && receiveInfo.label ? receiveInfo : { label: '受理航站公司', required: false },
            bag: bagInfo && bagInfo.label ? bagInfo : { label: '行李号', required: false },
            id: idInfo && idInfo.label ? idInfo : { label: '证件号/客票号', required: true }
        };
    }


    function buildModernUI() {
        if (!document.body || document.getElementById(WRAP_ID)) return;
        const labels = getH4Labels();
        const withRequired = (info) => `${info.label}${info.required ? '：*' : '：'}`;
        const wrap = document.createElement('section');
        wrap.id = WRAP_ID;
        wrap.innerHTML = `
            <h2>${getTitleText()}</h2>
            <h4>${withRequired(labels.receive)}</h4>
            <input id="tmk-lqv2-receive" class="tmk-input" type="text" autocomplete="off" />
            <h4>${withRequired(labels.bag)}</h4>
            <input id="tmk-lqv2-bagnum" class="tmk-input" type="text" autocomplete="off" />
            <h4>查询类型（必填）</h4>
            <div class="tmk-radio-row">
                <label><input type="radio" name="tmk-lqv2-type" value="idnum" checked /> 证件号</label>
                <label><input type="radio" name="tmk-lqv2-type" value="ticketNum" /> 客票号</label>
            </div>
            <input id="tmk-lqv2-idvalue" class="tmk-input" type="text" autocomplete="off" />
            <button id="tmk-lqv2-submit" class="tmk-submit" type="button">查询</button>
        `;
        document.body.appendChild(wrap);
        state.wrap = wrap;
    }


    function setLegacyType(typeValue) {
        if (!state.typeSelect) return;
        state.typeSelect.value = typeValue;
        state.typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.changeICKISearch === 'function') window.changeICKISearch(state.typeSelect);
    }


    function setLegacyValues(inputs, value) {
        const next = String(value || '');
        inputs.forEach((input) => {
            if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return;
            input.value = next;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }


    function syncFromLegacy() {
        const receive = document.getElementById('tmk-lqv2-receive');
        const bagnum = document.getElementById('tmk-lqv2-bagnum');
        const idValue = document.getElementById('tmk-lqv2-idvalue');
        if (!receive || !bagnum || !idValue) return;
        receive.value = state.receiveCompany ? state.receiveCompany.value || '' : '';
        bagnum.value = state.bagnum ? state.bagnum.value || '' : '';
        const idRaw = state.idnum ? state.idnum.value || '' : '';
        const ticketRaw = state.ticketNum ? state.ticketNum.value || '' : '';
        if (idRaw) {
            idValue.value = idRaw;
            const radio = state.wrap.querySelector('input[name="tmk-lqv2-type"][value="idnum"]');
            if (radio) radio.checked = true;
        } else if (ticketRaw) {
            idValue.value = ticketRaw;
            const radio = state.wrap.querySelector('input[name="tmk-lqv2-type"][value="ticketNum"]');
            if (radio) radio.checked = true;
        }
    }


    function getCurrentType() {
        const checked = state.wrap.querySelector('input[name="tmk-lqv2-type"]:checked');
        return checked ? checked.value : 'idnum';
    }


    function bindModernEvents() {
        if (!state.wrap) return;
        const submit = document.getElementById('tmk-lqv2-submit');
        const idInput = document.getElementById('tmk-lqv2-idvalue');
        const receiveInput = document.getElementById('tmk-lqv2-receive');
        const bagInput = document.getElementById('tmk-lqv2-bagnum');
        const forceUpper = (input) => {
            if (!input) return;
            input.addEventListener('input', () => {
                const current = input.value || '';
                const upper = current.toUpperCase();
                if (current === upper) return;
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = upper;
                if (Number.isInteger(start) && Number.isInteger(end)) input.setSelectionRange(start, end);
            });
        };
        forceUpper(receiveInput);
        forceUpper(bagInput);
        forceUpper(idInput);
        state.wrap.querySelectorAll('input[name="tmk-lqv2-type"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                const mode = getCurrentType();
                if (idInput) idInput.placeholder = mode === 'idnum' ? '请输入证件号，支持 / 分隔' : '请输入客票号，支持 / 分隔';
            });
        });
        if (submit) {
            submit.addEventListener('click', () => {
                const receive = document.getElementById('tmk-lqv2-receive');
                const bagnum = document.getElementById('tmk-lqv2-bagnum');
                const idValue = document.getElementById('tmk-lqv2-idvalue');
                const receiveValue = receive ? (receive.value || '').toUpperCase() : '';
                const bagValue = bagnum ? (bagnum.value || '').toUpperCase() : '';
                const idRawValue = idValue ? (idValue.value || '').toUpperCase() : '';
                if (receive) receive.value = receiveValue;
                if (bagnum) bagnum.value = bagValue;
                if (idValue) idValue.value = idRawValue;
                const mode = getCurrentType();
                // 先切换旧页面查询类型，避免 changeICKISearch 把刚写入的值清空
                setLegacyType(mode);
                setLegacyValues(state.receiveCompanyInputs, receiveValue);
                setLegacyValues(state.bagnumInputs, bagValue);
                if (mode === 'idnum') {
                    setLegacyValues(state.idnumInputs, idRawValue);
                    setLegacyValues(state.ticketNumInputs, '');
                } else {
                    setLegacyValues(state.ticketNumInputs, idRawValue);
                    setLegacyValues(state.idnumInputs, '');
                }
                if (state.submitButton) state.submitButton.click();
            });
        }
    }


    function renderToolbar() {
        if (!document.body || document.getElementById(TOOLBAR_ID)) return;
        const toolbar = document.createElement('div');
        toolbar.id = TOOLBAR_ID;
        toolbar.innerHTML = `
            <button class="tmk-lqv2-btn tmk-active" data-mode="modern" type="button">现代视图</button>
            <button class="tmk-lqv2-btn" data-mode="legacy" type="button">旧版页面</button>
        `;
        document.body.appendChild(toolbar);
        toolbar.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const mode = target.getAttribute('data-mode');
            if (!mode) return;
            switchMode(mode);
        });
    }


    function updateToolbar() {
        const toolbar = document.getElementById(TOOLBAR_ID);
        if (!toolbar) return;
        toolbar.querySelectorAll('.tmk-lqv2-btn').forEach((btn) => {
            const active = btn.getAttribute('data-mode') === state.mode;
            btn.classList.toggle('tmk-active', active);
        });
    }


    function switchMode(mode) {
        state.mode = mode === 'legacy' ? 'legacy' : 'modern';
        if (state.form) state.form.style.display = '';
        if (state.wrap) state.wrap.style.display = state.mode === 'legacy' ? 'none' : 'block';
        if (state.glass) state.glass.style.display = state.mode === 'legacy' ? 'none' : 'block';
        updateToolbar();
    }


    function bootstrap() {
        if (!isTargetPage()) return;
        if (!findLegacyControls()) return;
        console.info('[LQ2.1] legacy controls found', {
            receiveCompany: state.receiveCompanyInputs.length,
            bagnum: state.bagnumInputs.length,
            idnum: state.idnumInputs.length,
            ticketNum: state.ticketNumInputs.length
        });
        injectStyle();
        applyLeftGap();
        ensureGlassLayer();
        buildModernUI();
        renderToolbar();
        syncFromLegacy();
        bindModernEvents();
        switchMode('modern');
        window.addEventListener('resize', applyLeftGap);
    }


    bootstrap();
})();
