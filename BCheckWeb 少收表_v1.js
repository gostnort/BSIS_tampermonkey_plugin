// ==UserScript==
// @name         BCheckWeb 少收表 v1
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  新建少收页面重组标签；我的视图/原版页面切换；玻璃背景与查询脚本一致；隐藏 content_1 内 .ui-grid-b.l_low
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
    const PAGE_RE = /newNullBaggageLost_newBaggageLostAction\.action/i;
    const INIT_FLAG = '__tmkLostTabsV1Inited';
    const SHARED_STYLE_ID = 'tmk-lost-table-shared-style';
    const TOOLBAR_ID = 'tmk-lost-table-toolbar';
    const GLASS_ID = 'tmk-lost-table-glass';
    const MODE_CLASS = 'tmk-lost-table-modern';
    const state = { mode: 'modern', glass: null, tabRoot: null, group3: null, headerEl: null, content7: null };
    if (!PAGE_RE.test(String(window.location.href || ''))) return;
    if (window[INIT_FLAG]) return;
    window[INIT_FLAG] = true;


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


    function injectSharedGlassToolbarStyle() {
        if (document.getElementById(SHARED_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = SHARED_STYLE_ID;
        style.textContent = `
            html.${MODE_CLASS},
            html.${MODE_CLASS} body {
                background: transparent !important;
                color: #111111 !important;
                font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif !important;
            }
            html.${MODE_CLASS} .l_mainContentL1,
            html.${MODE_CLASS} #content_1,
            html.${MODE_CLASS} .l_mainContent,
            html.${MODE_CLASS} .ui-page,
            html.${MODE_CLASS} .ui-content {
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
            html.${MODE_CLASS} #${GLASS_ID} {
                display: block;
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
            .tmk-lost-table-btn {
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
            .tmk-lost-table-btn.tmk-active {
                background: #3f89d0;
                border-color: #3f89d0;
                color: #ffffff;
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


    function renderToolbar() {
        if (!document.body || document.getElementById(TOOLBAR_ID)) return;
        const toolbar = document.createElement('div');
        toolbar.id = TOOLBAR_ID;
        toolbar.innerHTML = `
            <button class="tmk-lost-table-btn tmk-active" data-mode="modern" type="button">我的视图</button>
            <button class="tmk-lost-table-btn" data-mode="legacy" type="button">原版页面</button>
        `;
        document.body.appendChild(toolbar);
        toolbar.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const m = target.getAttribute('data-mode');
            if (!m) return;
            setMode(m);
        });
    }


    function updateToolbarButtons() {
        const toolbar = document.getElementById(TOOLBAR_ID);
        if (!toolbar) return;
        toolbar.querySelectorAll('.tmk-lost-table-btn').forEach((btn) => {
            const active = btn.getAttribute('data-mode') === state.mode;
            btn.classList.toggle('tmk-active', active);
        });
    }


    function restoreLegacyDomOrder() {
        const c7 = state.content7;
        const g3 = state.group3;
        if (!c7 || !c7.parentNode || !g3) return;
        const parent = c7.parentNode;
        const ids = ['content_2', 'content_3', 'content_4', 'content_5', 'content_6'];
        ids.forEach((id) => {
            const node = document.getElementById(id);
            if (node && node.parentNode === g3) {
                parent.insertBefore(node, c7);
            }
        });
        if (g3.parentNode) {
            g3.remove();
        }
        state.group3 = null;
    }


    function remountGroup3(parent, beforeNode, nodes) {
        let g3 = state.group3;
        if (!g3 || !document.body.contains(g3)) {
            g3 = document.createElement('div');
            g3.id = 'tmk_content_3_group';
            g3.className = 'l_mainContent tmk-lost-tab-pane';
        }
        nodes.forEach((n) => {
            if (n && n.parentNode) {
                n.classList.add('tmk-group-item');
                g3.appendChild(n);
            }
        });
        parent.insertBefore(g3, beforeNode);
        state.group3 = g3;
    }


    function setMode(mode) {
        state.mode = mode === 'legacy' ? 'legacy' : 'modern';
        const root = state.tabRoot;
        const header = state.headerEl;
        const c0 = document.getElementById('tmk_content_0');
        if (state.mode === 'legacy') {
            document.documentElement.classList.remove(MODE_CLASS);
            if (state.glass) state.glass.style.setProperty('display', 'none', 'important');
            if (root) root.style.display = 'none';
            if (header) header.style.display = '';
            if (c0) c0.style.display = 'none';
            restoreLegacyDomOrder();
        } else {
            document.documentElement.classList.add(MODE_CLASS);
            if (state.glass) state.glass.style.removeProperty('display');
            if (root) root.style.display = '';
            if (header) header.style.display = 'none';
            if (c0) c0.style.display = '';
            const c7 = state.content7;
            const c2 = document.getElementById('content_2');
            const c3 = document.getElementById('content_3');
            const c4 = document.getElementById('content_4');
            const c5 = document.getElementById('content_5');
            const c6 = document.getElementById('content_6');
            if (c7 && c7.parentNode && c2 && c3 && c4 && c5 && c6) {
                const needRemount = [c2, c3, c4, c5, c6].some((n) => n.parentNode && n.parentNode.id !== 'tmk_content_3_group');
                if (needRemount || !document.getElementById('tmk_content_3_group')) {
                    remountGroup3(c7.parentNode, c7, [c2, c3, c4, c5, c6]);
                }
            }
        }
        updateToolbarButtons();
    }


    function injectStyle() {
        if (document.getElementById('tmk-lost-tabs-v1-style')) return;
        const style = document.createElement('style');
        style.id = 'tmk-lost-tabs-v1-style';
        style.textContent = `
            .tmk-lost-tabs-v1 {
                margin: 0 10px 10px 10px;
                border-bottom: 1px solid #d6dbe1;
            }
            .tmk-lost-tabs-v1-head {
                display: flex;
                align-items: center;
                gap: 8px;
                background: transparent;
                border-radius: 8px;
                width: fit-content;
                min-width: 560px;
            }
            .tmk-lost-tabs-v1-btn {
                border: 1px solid #cfd8e2;
                background: #f3f5f8;
                color: #2b3440;
                font-size: 13px;
                padding: 8px 16px 8px 12px;
                cursor: pointer;
                border-radius: 10px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .tmk-lost-tabs-v1-btn.is-active {
                background: #ffffff;
                font-weight: 600;
                border-color: #9eb2c7;
                box-shadow: 0 1px 3px rgba(35, 52, 70, 0.15);
            }
            .tmk-step-dot {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                border: 1px solid #95a8bc;
                background: #ffffff;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                line-height: 1;
            }
            .tmk-step-check {
                font-size: 12px;
                color: #1f9d53;
                visibility: hidden;
            }
            .tmk-lost-tabs-v1-btn.is-done .tmk-step-check {
                visibility: visible;
            }
            .tmk-lost-tab-pane {
                display: none !important;
            }
            .tmk-lost-tab-pane.is-active {
                display: block !important;
            }
            .tmk-lost-simple-table {
                margin: 12px 30px;
                border: 1px solid #d9dee4;
                border-radius: 6px;
                overflow: hidden;
            }
            .tmk-tab1-box {
                margin: 12px 30px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .tmk-tab1-input {
                width: 320px;
                min-height: 34px;
                border: 1px solid #b8c4d1;
                border-radius: 4px;
                padding: 4px 8px;
                box-sizing: border-box;
            }
            .tmk-tab1-btn {
                min-height: 34px;
                border: 1px solid #7fa6c8;
                border-radius: 4px;
                padding: 0 12px;
                background: #e9f2fa;
                cursor: pointer;
            }
            #content_1 .tmk-fs-panel {
                margin: 10px 30px;
                border: 1px solid #d7dee7;
                border-radius: 6px;
                overflow: hidden;
            }
            #content_1 .tmk-fs-toggle {
                width: 100%;
                text-align: left;
                border: none;
                background: #eef3f8;
                font-size: 14px;
                font-weight: 600;
                padding: 8px 12px;
                cursor: pointer;
            }
            #content_1 .tmk-fs-body {
                padding: 8px 0;
                border-top: 1px solid #dde4ec;
            }
            #content_1 .tmk-fs-panel.is-collapsed .tmk-fs-body {
                display: none !important;
            }
            #content_1 .tmk-fs-panel .tmk-fs-body > fieldset {
                margin: 0 !important;
                border: none !important;
                padding: 0 !important;
            }
            #content_1 .tmk-fs-panel .tmk-fs-body > fieldset > legend {
                display: none !important;
            }
            #content_1 .tmk-v-row {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin: 8px 30px;
            }
            #content_1 .tmk-v-field {
                width: min(300px, 100%);
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            #content_1 .tmk-v-label {
                font-size: 13px;
                color: #1f2d3d;
                line-height: 1.3;
            }
            #content_1 input[type="text"],
            #content_1 input[type="search"],
            #content_1 input[type="number"],
            #content_1 input[type="tel"],
            #content_1 input[type="email"],
            #content_1 select,
            #content_1 textarea {
                border: 1px solid #b8c4d1 !important;
                border-radius: 3px !important;
                min-height: 24px;
                box-sizing: border-box;
                width: 100% !important;
            }
            #tmk_content_3_group {
                padding: 6px 12px 12px 12px;
            }
            #tmk_content_3_group .tmk-group-item {
                display: block !important;
                position: static !important;
                float: none !important;
                margin: 0 0 10px 0;
                padding: 8px;
                border: 1px solid #d8e0ea;
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.5);
            }
            html.${MODE_CLASS} #content_1 .ui-grid-b.l_low {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }


    function createSimpleTablePane() {
        const pane = document.createElement('div');
        pane.id = 'tmk_content_0';
        pane.className = 'l_mainContent tmk-lost-tab-pane';
        pane.innerHTML = `
            <div class="tmk-lost-simple-table">
                <div class="tmk-tab1-box">
                    <input class="tmk-tab1-input" type="text" placeholder="请输入内容" />
                    <button class="tmk-tab1-btn" type="button">提交</button>
                </div>
            </div>
        `;
        return pane;
    }


    function setupCollapsibleFieldsets() {
        const c1 = document.getElementById('content_1');
        if (!c1) return;
        const fieldsets = Array.from(c1.querySelectorAll('fieldset')).slice(0, 5);
        fieldsets.forEach((fs, idx) => {
            if (!fs || fs.dataset.tmkFsWrapped === '1') return;
            const legend = fs.querySelector('legend');
            const title = legend ? (legend.textContent || '').trim() : `分组${idx + 1}`;
            const panel = document.createElement('div');
            panel.className = 'tmk-fs-panel is-collapsed';
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'tmk-fs-toggle';
            toggle.textContent = `${title || `分组${idx + 1}`}  ▾`;
            const body = document.createElement('div');
            body.className = 'tmk-fs-body';
            fs.parentNode.insertBefore(panel, fs);
            panel.appendChild(toggle);
            panel.appendChild(body);
            body.appendChild(fs);
            fs.dataset.tmkFsWrapped = '1';
            toggle.addEventListener('click', () => {
                panel.classList.toggle('is-collapsed');
            });
        });
    }


    function buildVerticalFieldsForTab2() {
        const c1 = document.getElementById('content_1');
        if (!c1) return;
        const panels = Array.from(c1.querySelectorAll('.tmk-fs-panel')).slice(0, 5);
        panels.forEach((panel) => {
            if (panel.dataset.tmkVerticalDone === '1') return;
            const fs = panel.querySelector('.tmk-fs-body > fieldset');
            if (!fs) return;
            const controls = Array.from(fs.querySelectorAll('input,select,textarea')).filter((el) => {
                if (!(el instanceof HTMLElement)) return false;
                const t = (el.getAttribute('type') || '').toLowerCase();
                return t !== 'hidden' && t !== 'button' && t !== 'submit' && t !== 'radio' && t !== 'checkbox';
            });
            const row = document.createElement('div');
            row.className = 'tmk-v-row';
            controls.forEach((control, idx) => {
                const hostRow = control.closest('.ui-grid-a,.ui-grid-b,.ui-grid-c,.ui-grid-d');
                const labelNode = hostRow ? hostRow.querySelector('.l_right') : null;
                const labelTextRaw = labelNode ? (labelNode.textContent || '') : '';
                const labelText = labelTextRaw.replace(/\s+/g, ' ').trim() || `字段${idx + 1}`;
                const field = document.createElement('div');
                field.className = 'tmk-v-field';
                const label = document.createElement('div');
                label.className = 'tmk-v-label';
                label.textContent = labelText;
                field.appendChild(label);
                const cloned = control.cloneNode(true);
                field.appendChild(cloned);
                row.appendChild(field);
            });
            fs.innerHTML = '';
            fs.appendChild(row);
            panel.dataset.tmkVerticalDone = '1';
        });
    }


    function updateTabChecks() {
        const tab1Input = document.querySelector('#tmk_content_0 .tmk-tab1-input');
        const tab2Required = Array.from(document.querySelectorAll('#content_1 .tmk-v-field .l_check, #content_1 .tmk-v-field [data-required="1"]'));
        const tab2Fallback = Array.from(document.querySelectorAll('#content_1 .tmk-v-field input, #content_1 .tmk-v-field select, #content_1 .tmk-v-field textarea')).slice(0, 3);
        const tab3Controls = Array.from(document.querySelectorAll('#tmk_content_3_group input, #tmk_content_3_group select, #tmk_content_3_group textarea'));
        const tab4Controls = Array.from(document.querySelectorAll('#content_7 input, #content_7 select, #content_7 textarea'));
        const isFilled = (el) => {
            if (!(el instanceof HTMLElement)) return false;
            const val = 'value' in el ? String(el.value || '').trim() : '';
            return !!val;
        };
        const rules = [
            !!(tab1Input && String(tab1Input.value || '').trim()),
            (tab2Required.length ? tab2Required : tab2Fallback).every(isFilled),
            tab3Controls.some(isFilled),
            tab4Controls.some(isFilled)
        ];
        document.querySelectorAll('.tmk-lost-tabs-v1-btn').forEach((btn, idx) => {
            if (rules[idx]) btn.classList.add('is-done');
            else btn.classList.remove('is-done');
        });
    }


    function mountTabs() {
        const header = document.querySelector('.l_header');
        const content1 = document.getElementById('content_1');
        const content2 = document.getElementById('content_2');
        const content3 = document.getElementById('content_3');
        const content4 = document.getElementById('content_4');
        const content5 = document.getElementById('content_5');
        const content6 = document.getElementById('content_6');
        const content7 = document.getElementById('content_7');
        if (!header || !content1 || !content2 || !content3 || !content4 || !content5 || !content6 || !content7) return false;
        content1.classList.add('tmk-lost-tab-pane');
        content7.classList.add('tmk-lost-tab-pane');

        const content0 = createSimpleTablePane();
        content1.parentNode.insertBefore(content0, content1);

        const group3 = document.createElement('div');
        group3.id = 'tmk_content_3_group';
        group3.className = 'l_mainContent tmk-lost-tab-pane';
        [content2, content3, content4, content5, content6].forEach((node) => {
            node.classList.add('tmk-group-item');
            group3.appendChild(node);
        });
        content1.parentNode.insertBefore(group3, content7);

        const root = document.createElement('div');
        root.className = 'tmk-lost-tabs-v1';
        root.innerHTML = `
            <div class="tmk-lost-tabs-v1-head">
                <button type="button" class="tmk-lost-tabs-v1-btn is-active" data-target="tmk_content_0"><span class="tmk-step-dot">1</span><span>标签1</span><span class="tmk-step-check">✓</span></button>
                <button type="button" class="tmk-lost-tabs-v1-btn" data-target="content_1"><span class="tmk-step-dot">2</span><span>标签2</span><span class="tmk-step-check">✓</span></button>
                <button type="button" class="tmk-lost-tabs-v1-btn" data-target="tmk_content_3_group"><span class="tmk-step-dot">3</span><span>标签3</span><span class="tmk-step-check">✓</span></button>
                <button type="button" class="tmk-lost-tabs-v1-btn" data-target="content_7"><span class="tmk-step-dot">4</span><span>标签4</span><span class="tmk-step-check">✓</span></button>
            </div>
        `;
        header.parentNode.insertBefore(root, header);
        header.style.display = 'none';
        state.tabRoot = root;
        state.headerEl = header;
        state.content7 = content7;
        state.group3 = group3;

        const getPanes = () => {
            return [
                document.getElementById('tmk_content_0'),
                document.getElementById('content_1'),
                document.getElementById('tmk_content_3_group'),
                document.getElementById('content_7')
            ].filter(Boolean);
        };
        getPanes().forEach((pane) => pane.classList.remove('is-active'));
        content0.classList.add('is-active');

        root.addEventListener('click', (event) => {
            const btn = event.target.closest('.tmk-lost-tabs-v1-btn');
            if (!btn) return;
            const targetId = btn.getAttribute('data-target');
            if (!targetId) return;
            const targetPane = document.getElementById(targetId);
            if (!targetPane) return;
            root.querySelectorAll('.tmk-lost-tabs-v1-btn').forEach((b) => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            getPanes().forEach((pane) => pane.classList.remove('is-active'));
            targetPane.classList.add('is-active');
            updateTabChecks();
        });
        document.addEventListener('input', updateTabChecks, true);
        document.addEventListener('change', updateTabChecks, true);
        return true;
    }


    function bootstrap() {
        injectSharedGlassToolbarStyle();
        injectStyle();
        ensureGlassLayer();
        renderToolbar();
        applyLeftGap();
        window.addEventListener('resize', applyLeftGap);
        const ok = mountTabs();
        if (!ok) {
            setTimeout(bootstrap, 600);
            return;
        }
        setMode('modern');
        setupCollapsibleFieldsets();
        buildVerticalFieldsForTab2();
        updateTabChecks();
    }


    bootstrap();
})();

