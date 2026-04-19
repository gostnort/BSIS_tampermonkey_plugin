// ==UserScript==
// @name         BCheckWeb 新建少收查询
// @namespace    http://tampermonkey.net/
// @version      3.1.0
// @description  新建少收查询壳
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
    // 契约：仅在 id=content_frame 的 iframe 内文档执行；URL 二选一分支。
    // （1）newBaggageLostSearch_menuAction.action — 第一步现代表单。
    // （2）baggageLostSearch_newBaggageLostAction.action — 第二步 lgDisplay 壳层。
    // 与 BCheckWeb_UI.js 一致：优先读取 window.top.__tmkUiMetrics（小方块尺寸等），用于左侧留白与 Step2 瓦片尺寸。
    // 启用本脚本后请关闭旧版「2.1」与「step2」两个独立脚本，避免重复注入。
    // Step2 行为与 BCheckWeb 新建少收查询-step2.user.js v1.4.5 对齐（独立脚本更新时请同步本文件对应段落）。
    const MENU_PATH = /newBaggageLostSearch_menuAction\.action/i;
    const STEP2_PATH = /baggageLostSearch_newBaggageLostAction\.action/i;
    const STYLE_ID = 'tmk-lqv2-style';
    const STEP2_STYLE_ID = 'tmk-step2-style';
    const WRAP_ID = 'tmk-lqv2-wrap';
    const SHELL_ID = 'tmk-step2-shell';
    const TOOLBAR_ID = 'tmk-lqv2-toolbar';
    const GLASS_ID = 'tmk-lqv2-glass';
    const MODE_CLASS = 'tmk-step2-modern';
    const MODERN_LOST_QUERY_KEY = 'tmk-modern-lost-query-v2-launch';
    const FORCE_CLOSE_VIEWS_KEY = 'tmk-force-close-views-ts';
    const LAX_DEST = 'LAX';
    const BAGGAGE_TRIPLE_TO_AIRLINE = Object.freeze({
        '999': 'CA',
        '784': 'CZ',
        '479': 'ZH',
        '324': 'SC'
    });
    const MONTH_EN3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const DEFAULT_Z_LAYERS = Object.freeze({
        basePage: 0,
        backgroundCover: 100,
        mainFunctionView: 500,
        functionButton: 600,
        searchControls: 900,
        floatingButton: 1000
    });
    const THEME2_FALLBACK_COLORS = Object.freeze({
        overlayBackdrop: '0.4',
        majorFocus: '#3f89d0',
        minorFocus: '#8fb1cc',
        minorFont: '#FFFFFF',
        majorFont: '#111111',
        majorButton: '#dfe6ee',
        inputBackground: '#f8f9fa',
        minorButton: '#8cc7e8'
    });
    const state = {
        page: null,
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
        glass: null,
        shell: null,
        observer: null,
        observerRoot: null,
        pollId: null,
        syncTimer: null,
        laxAutoDoneByBlock: null,
        lastForceCloseTs: 0
    };


    function isContentFrame() {
        try {
            return window.frameElement && window.frameElement.id === 'content_frame';
        } catch (e) {
            return false;
        }
    }


    function resolvePage() {
        if (!isContentFrame()) return null;
        const href = String(window.location.href || '');
        if (MENU_PATH.test(href)) return 'menu';
        if (STEP2_PATH.test(href)) return 'step2';
        return null;
    }


    function normalizeText(text) {
        return String(text || '').replace(/\s+/g, '').trim();
    }


    function themeColorVarFromKey(key) {
        return '--tmk-c-' + String(key).replace(/([A-Z])/g, '-$1').toLowerCase();
    }


    function pickColor(c, keys, fallback) {
        for (let i = 0; i < keys.length; i += 1) {
            const k = keys[i];
            if (c[k] !== undefined && c[k] !== null && String(c[k]) !== '') return c[k];
        }
        return fallback;
    }


    function expandThemeColors(raw) {
        const base = THEME2_FALLBACK_COLORS;
        const c = Object.assign({}, base, raw || {});
        const majorFocus = pickColor(c, ['majorFocus'], base.majorFocus);
        const minorFocus = pickColor(c, ['minorFocus'], base.minorFocus);
        const minorFont = pickColor(c, ['minorFont'], base.minorFont);
        const majorFont = pickColor(c, ['majorFont'], base.majorFont);
        const majorButton = pickColor(c, ['majorButton'], base.majorButton);
        const inputBg = pickColor(c, ['inputBackground'], base.inputBackground);
        const minorButton = pickColor(c, ['minorButton'], base.minorButton);
        const overlayOpacityRaw = pickColor(c, ['overlayBackdrop'], '0.4');
        let overlayOpacity = parseFloat(String(overlayOpacityRaw).replace(/[^\d.]/g, ''));
        if (!Number.isFinite(overlayOpacity)) overlayOpacity = 0.4;
        overlayOpacity = Math.max(0, Math.min(1, overlayOpacity));
        const overlayPercent = Math.max(0, Math.min(100, Math.round(overlayOpacity * 100)));
        return {
            overlayBackdrop: 'color-mix(in srgb, ' + minorButton + ' ' + overlayPercent + '%, transparent)',
            majorFocus: majorFocus,
            majorFont: majorFont,
            minorFont: minorFont,
            minorFocus: minorFocus,
            majorButton: majorButton,
            inputBackground: inputBg,
            minorButton: minorButton,
            lv1Bg: pickColor(c, ['lv1Bg'], majorFocus),
            kvToolFg: pickColor(c, ['kvToolFg'], majorFocus),
            lv2Bg: pickColor(c, ['lv2Bg'], minorFocus),
            fabHoverBorder: pickColor(c, ['fabHoverBorder'], minorFocus),
            searchInputBorder: pickColor(c, ['searchInputBorder'], minorFocus),
            kvToolBorder: pickColor(c, ['kvToolBorder'], minorFocus),
            tileHoverBorder: pickColor(c, ['tileHoverBorder'], minorFocus),
            h1: pickColor(c, ['h1'], minorFont),
            lv1Fg: pickColor(c, ['lv1Fg'], minorFont),
            lv2Fg: pickColor(c, ['lv2Fg'], minorFont),
            lv4Fg: pickColor(c, ['lv4Fg'], majorFont),
            lv3Fg: pickColor(c, ['lv3Fg'], majorFont),
            fabFg: pickColor(c, ['fabFg'], majorFont),
            searchInputFg: pickColor(c, ['searchInputFg'], majorFont),
            lv5Fg: pickColor(c, ['lv5Fg'], majorFont),
            searchPlaceholder: pickColor(c, ['searchPlaceholder'], majorFont),
            fabBg: pickColor(c, ['fabBg'], majorButton),
            searchBg: pickColor(c, ['searchBg'], majorButton),
            lv5Bg: pickColor(c, ['lv5Bg'], majorButton),
            searchActiveBg: pickColor(c, ['searchActiveBg'], majorButton),
            lv4Bg: pickColor(c, ['lv4Bg'], minorButton),
            searchInputBg: pickColor(c, ['searchInputBg'], inputBg),
            fabBorder: pickColor(c, ['fabBorder'], minorFocus),
            searchBorder: pickColor(c, ['searchBorder'], minorFocus),
            searchActiveBorder: minorFocus,
            lv3Bg: pickColor(c, ['lv3Bg'], majorButton),
            searchLoadingBg: pickColor(c, ['searchLoadingBg'], majorButton),
            searchLoadingFg: pickColor(c, ['searchLoadingFg'], majorFont)
        };
    }


    function applyThemeVars(colors) {
        if (!document.documentElement || !colors) return;
        Object.keys(colors).forEach((k) => {
            const v = colors[k];
            if (v === undefined || v === null || String(v) === '') return;
            document.documentElement.style.setProperty(themeColorVarFromKey(k), String(v));
        });
    }


    function ensureTheme2Applied() {
        let uiColors = null;
        try {
            if (window.top && window.top.__tmkTheme && window.top.__tmkTheme.colors) {
                uiColors = window.top.__tmkTheme.colors;
            }
        } catch (e) {}
        if (!uiColors) {
            try {
                if (window.__tmkTheme && window.__tmkTheme.colors) {
                    uiColors = window.__tmkTheme.colors;
                }
            } catch (e) {}
        }
        applyThemeVars(expandThemeColors(uiColors || THEME2_FALLBACK_COLORS));
    }


    function normalizeZLayers(raw) {
        const out = Object.assign({}, DEFAULT_Z_LAYERS);
        if (!raw || typeof raw !== 'object') return out;
        Object.keys(DEFAULT_Z_LAYERS).forEach((k) => {
            const v = Number(raw[k]);
            if (Number.isFinite(v)) out[k] = v;
        });
        return out;
    }


    function getSharedZLayers() {
        try {
            if (window.top && window.top.__tmkZLayers) return normalizeZLayers(window.top.__tmkZLayers);
        } catch (e) {}
        if (window.__tmkZLayers) return normalizeZLayers(window.__tmkZLayers);
        return normalizeZLayers(null);
    }


    function getScopedZLayers() {
        const ui = getSharedZLayers();
        const cap = {
            backgroundCover: 80,
            mainFunctionView: 300,
            functionButton: 320,
            searchControls: 330,
            floatingButton: 340
        };
        const out = {
            basePage: 0,
            backgroundCover: Math.min(Number(ui.backgroundCover) || 100, cap.backgroundCover),
            mainFunctionView: Math.min(Number(ui.mainFunctionView) || 500, cap.mainFunctionView),
            functionButton: Math.min(Number(ui.functionButton) || 600, cap.functionButton),
            searchControls: Math.min(Number(ui.searchControls) || 900, cap.searchControls),
            floatingButton: Math.min(Number(ui.floatingButton) || 1000, cap.floatingButton)
        };
        if (out.mainFunctionView <= out.backgroundCover) out.mainFunctionView = out.backgroundCover + 1;
        if (out.functionButton <= out.mainFunctionView) out.functionButton = out.mainFunctionView + 1;
        if (out.searchControls <= out.functionButton) out.searchControls = out.functionButton + 1;
        if (out.floatingButton <= out.searchControls) out.floatingButton = out.searchControls + 1;
        return out;
    }


    function readForceCloseViewsTs() {
        let ts = 0;
        try {
            if (window.top && Number.isFinite(Number(window.top.__tmkForceCloseViewsTs))) {
                ts = Number(window.top.__tmkForceCloseViewsTs);
            }
        } catch (e) {}
        try {
            const raw = window.sessionStorage.getItem(FORCE_CLOSE_VIEWS_KEY);
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) ts = Math.max(ts, parsed);
        } catch (e) {}
        return ts;
    }


    function shouldCloseForUiOverlay() {
        try {
            if (window.top && window.top.__tmkUiOverlayOpen === true) return true;
        } catch (e) {}
        return window.__tmkUiOverlayOpen === true;
    }


    function consumeModernLostQueryLaunchMark() {
        try {
            const raw = window.sessionStorage.getItem(MODERN_LOST_QUERY_KEY);
            const ts = Number(raw);
            if (!Number.isFinite(ts)) return false;
            if (Date.now() - ts > 5 * 60 * 1000) return false;
            window.sessionStorage.removeItem(MODERN_LOST_QUERY_KEY);
            return true;
        } catch (e) {
            return false;
        }
    }


    function getUiMetrics() {
        try {
            const topM = window.top && window.top.__tmkUiMetrics;
            if (topM && typeof topM.small === 'number') return normalizeMetrics(topM);
        } catch (e) {}
        if (window.__tmkUiMetrics && typeof window.__tmkUiMetrics.small === 'number') {
            return normalizeMetrics(window.__tmkUiMetrics);
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const shortSide = Math.min(vw, vh);
        const small = Math.max(46, Math.min(78, Math.round(shortSide * 0.07)));
        const gap = Math.max(8, Math.min(16, Math.round(small * 0.22)));
        const medium = small * 2;
        return {
            small: small,
            gap: gap,
            medium: medium,
            bigTile: medium * 2 + gap,
            h1Size: Math.max(30, Math.min(48, Math.floor(vw * 0.035)))
        };
    }


    function normalizeMetrics(m) {
        if (!m || typeof m.small !== 'number') return getUiMetrics();
        const gap = Number(m.gap) || 8;
        const med = Number(m.medium) || 92;
        const bigTile = Number.isFinite(m.bigTile) ? Number(m.bigTile) : med * 2 + gap;
        return {
            small: m.small,
            gap: gap,
            medium: med,
            bigTile: bigTile,
            h1Size: Number.isFinite(m.h1Size) ? m.h1Size : 30
        };
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


    function triggerJqChange(inputEl) {
        if (!inputEl) return;
        try {
            const $ = window.jQuery || window.$;
            if ($ && $.fn && $.fn.trigger) {
                $(inputEl).trigger('change');
            }
        } catch (e) {}
    }


    function injectSharedLqv2Style() {
        if (!document.head || document.getElementById(STYLE_ID)) return;
        const z = getScopedZLayers();
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html,
            body {
                background: transparent !important;
                color: var(--tmk-c-major-font) !important;
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
                z-index: ${z.backgroundCover};
                display: none;
                background: var(--tmk-c-overlay-backdrop);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            #${TOOLBAR_ID} {
                position: fixed;
                top: 10px;
                right: 12px;
                z-index: ${z.floatingButton};
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px;
                border-radius: 999px;
                background: var(--tmk-c-search-bg);
                border: 1px solid var(--tmk-c-search-input-border);
                box-shadow: 0 6px 16px rgba(23, 52, 86, 0.16);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
            .tmk-lqv2-btn {
                min-height: 30px;
                padding: 0 12px;
                border-radius: 999px;
                border: 1px solid var(--tmk-c-search-input-border);
                background: var(--tmk-c-search-bg);
                color: var(--tmk-c-major-font);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .tmk-lqv2-btn.tmk-active {
                background: var(--tmk-c-major-focus);
                border-color: var(--tmk-c-major-focus);
                color: var(--tmk-c-lv1-fg);
            }
            #${WRAP_ID} {
                width: calc(100vw - var(--tmk-left-gap, 16px) - 24px);
                max-width: calc(100vw - var(--tmk-left-gap, 16px) - 24px);
                margin: 0;
                padding: 10px 12px 14px 12px;
                box-sizing: border-box;
                position: fixed;
                top: 72px;
                left: var(--tmk-left-gap, 16px);
                z-index: ${z.mainFunctionView};
                max-height: calc(100vh - 92px);
                overflow: auto;
                background: color-mix(in srgb, var(--tmk-c-major-button) 40%, transparent);
                border: 1px solid var(--tmk-c-search-input-border);
                border-radius: 12px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: 0 10px 24px rgba(37, 64, 92, 0.16);
            }
            #${WRAP_ID} h2 {
                margin: 0 0 18px 0;
                color: var(--tmk-c-major-font);
                font-size: 34px;
                font-weight: 700;
                line-height: 1.15;
            }
            #${WRAP_ID} h4 {
                margin: 18px 0 8px 0;
                color: var(--tmk-c-major-font);
                font-size: 18px;
                font-weight: 600;
                line-height: 1.3;
            }
            #${WRAP_ID} .tmk-input {
                width: 100%;
                min-height: 42px;
                border: 0;
                border-bottom: 2px solid var(--tmk-c-search-input-border);
                border-radius: 0;
                background: transparent;
                color: var(--tmk-c-major-font);
                font-size: 20px;
                padding: 6px 2px;
                box-sizing: border-box;
                outline: none;
            }
            #${WRAP_ID} .tmk-input:focus {
                border-bottom-color: var(--tmk-c-major-focus);
            }
            #${WRAP_ID} .tmk-radio-row {
                display: flex;
                align-items: center;
                gap: 18px;
                margin: 8px 0 4px 0;
            }
            #${WRAP_ID} .tmk-radio-row label {
                color: var(--tmk-c-major-font);
                font-size: 17px;
                cursor: pointer;
            }
            #${WRAP_ID} .tmk-submit {
                margin-top: 22px;
                width: 100%;
                min-height: 46px;
                border: 1px solid var(--tmk-c-major-focus);
                border-radius: 10px;
                background: var(--tmk-c-major-focus);
                color: var(--tmk-c-lv1-fg);
                font-size: 20px;
                font-weight: 600;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }


    function injectStep2ShellStyle(metrics) {
        if (!document.head) return;
        const m = metrics || getUiMetrics();
        const z = getScopedZLayers();
        if (document.documentElement) {
            document.documentElement.style.setProperty('--tmk-big-tile', `${m.bigTile}px`);
        }
        let style = document.getElementById(STEP2_STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STEP2_STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent = `
            :root {
                --tmk-step2-medium: ${m.medium}px;
                --tmk-step2-small: ${m.small}px;
                --tmk-step2-gap: ${m.gap}px;
                --tmk-step2-big-tile: ${m.bigTile}px;
            }
            html.${MODE_CLASS} #content_1 {
                min-height: 100vh;
                box-sizing: border-box;
            }
            button.tmk-step2-big-tile,
            button.tmk-step2-med-tile {
                -webkit-appearance: none;
                appearance: none;
                font: inherit;
                margin: 0;
                cursor: pointer;
            }
            button.tmk-step2-big-tile {
                text-align: left;
            }
            button.tmk-step2-big-tile:disabled,
            button.tmk-step2-med-tile:disabled {
                cursor: not-allowed;
            }
            .${MODE_CLASS} #wtAjaxSearch {
                display: none !important;
            }
            .${MODE_CLASS} .tmk-step2-lg-origin {
                position: absolute !important;
                left: -9999px !important;
                width: 1px !important;
                height: 1px !important;
                overflow: hidden !important;
                clip: rect(0,0,0,0) !important;
            }
            .${MODE_CLASS} .l_footer {
                display: none !important;
            }
            .${MODE_CLASS} #${GLASS_ID} {
                display: block;
            }
            #${SHELL_ID} {
                box-sizing: border-box;
                position: fixed;
                top: 72px;
                left: var(--tmk-left-gap, 16px);
                z-index: ${z.mainFunctionView};
                width: calc(100vw - var(--tmk-left-gap, 16px) - 24px);
                max-width: calc(100vw - var(--tmk-left-gap, 16px) - 24px);
                max-height: calc(100vh - 92px);
                overflow: auto;
                padding: ${m.gap}px;
                border-radius: 12px;
                background: color-mix(in srgb, var(--tmk-c-major-button) 40%, transparent);
                border: 1px solid rgba(151, 177, 203, 0.45);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: 0 10px 24px rgba(37, 64, 92, 0.16);
            }
            #tmk-step2-rows {
                display: flex;
                flex-direction: column;
                gap: ${m.gap}px;
            }
            .tmk-step2-seg-row {
                display: flex;
                flex-direction: row;
                align-items: flex-start;
                gap: ${m.gap}px;
                flex-wrap: wrap;
            }
            .tmk-step2-big-tile {
                width: var(--tmk-step2-big-tile);
                height: var(--tmk-step2-medium);
                min-width: var(--tmk-step2-big-tile);
                min-height: var(--tmk-step2-medium);
                max-width: 100%;
                box-sizing: border-box;
                border-radius: 8px;
                border: 2px solid rgba(0,0,0,0.12);
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                gap: 6px;
                padding: 8px;
                font-size: ${Math.max(10, Math.round(m.small * 0.22))}px;
                line-height: 1.25;
                overflow: hidden;
                transition: box-shadow 0.15s ease, transform 0.15s ease, outline 0.15s ease;
            }
            .tmk-step2-big-tile:not(.tmk-step2-tile--pressed):not(:disabled) {
                box-shadow:
                    0 0 0 1px rgba(0, 0, 0, 0.28),
                    0 8px 0 rgba(0, 0, 0, 0.22),
                    0 8px 0 rgba(0, 0, 0, 0.12),
                    0 18px 22px rgba(15, 23, 42, 0.38);
                transform: translateY(-4px);
            }
            .tmk-step2-big-tile.tmk-step2-tile--pressed {
                box-shadow: none;
                transform: translateY(0);
            }
            .tmk-step2-big-tile.tmk-step2-tile--detail.tmk-step2-tile--pressed {
                outline: 2px solid #2563eb;
                outline-offset: 1px;
            }
            .tmk-step2-big-tile--lax {
                background: rgba(40, 167, 69, 0.18);
                border-color: rgba(25, 135, 84, 0.55);
            }
            .tmk-step2-big-tile--nolax {
                background: rgba(255, 193, 7, 0.22);
                border-color: rgba(200, 150, 0, 0.55);
            }
            .tmk-step2-big-tile--gray {
                background: rgba(108, 117, 125, 0.28);
                border-color: rgba(73, 80, 87, 0.5);
                opacity: 0.9;
            }
            .tmk-step2-big-tile--bs {
                box-shadow: 0 0 0 2px rgba(253, 126, 20, 0.85) inset;
            }
            .tmk-step2-flight-title {
                font-weight: 700;
                color: #0d1b2a;
                margin-bottom: 0;
                word-break: break-all;
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .tmk-step2-flight-line {
                font-weight: 700;
                line-height: 1.2;
            }
            .tmk-step2-small-wrap {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: ${m.gap}px;
                align-items: flex-start;
                flex: 1;
                min-width: 0;
            }
            .tmk-step2-med-tile {
                width: var(--tmk-step2-medium);
                height: var(--tmk-step2-medium);
                min-width: var(--tmk-step2-medium);
                min-height: var(--tmk-step2-medium);
                box-sizing: border-box;
                border-radius: 8px;
                border: 2px solid rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 6px;
                font-size: ${Math.max(10, Math.round(m.small * 0.22))}px;
                line-height: 1.2;
                transition: box-shadow 0.15s ease, transform 0.15s ease;
            }
            .tmk-step2-med-tile:not(.tmk-step2-tile--pressed):not(:disabled) {
                box-shadow:
                    0 0 0 1px rgba(0, 0, 0, 0.26),
                    0 6px 0 rgba(0, 0, 0, 0.2),
                    0 6px 0 rgba(0, 0, 0, 0.1),
                    0 14px 20px rgba(15, 23, 42, 0.36);
                transform: translateY(-2px);
            }
            .tmk-step2-med-tile.tmk-step2-tile--pressed {
                box-shadow: none;
                transform: translateY(0);
            }
            .tmk-step2-med-tile--lax {
                background: rgba(25, 135, 84, 0.42);
                border-color: rgba(15, 90, 50, 0.65);
                color: #fff;
            }
            .tmk-step2-med-tile--nolax {
                background: rgba(200, 140, 0, 0.45);
                border-color: rgba(160, 100, 0, 0.6);
                color: #1a1200;
            }
            .tmk-step2-med-tile--gray {
                background: rgba(108, 117, 125, 0.45);
                border-color: rgba(73, 80, 87, 0.55);
                color: #f8f9fa;
            }
            #tmk-step2-selection-summary {
                margin-top: ${m.gap}px;
                padding: 4px 0;
                border: none;
                background: transparent;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            #tmk-step2-summary-flights {
                text-align: left;
                font-size: ${Math.max(12, Math.round(m.small * 0.26))}px;
                line-height: 1.45;
                color: #111111;
                word-break: break-all;
            }
            #tmk-step2-summary-baggage {
                text-align: left;
                font-size: ${Math.max(12, Math.round(m.small * 0.26))}px;
                line-height: 1.45;
                color: #111111;
                word-break: break-all;
            }
            .tmk-step2-footer-bar {
                margin-top: ${m.gap}px;
                display: flex;
                gap: ${m.gap}px;
                flex-wrap: wrap;
            }
            .tmk-step2-footer-new {
                min-height: ${Math.max(36, Math.round(m.small * 0.65))}px;
                padding: 8px 20px;
                border-radius: 8px;
                border: none;
                background: #28a745;
                color: #fff;
                font-size: ${Math.max(14, Math.round(m.small * 0.34))}px;
                font-weight: 700;
                cursor: pointer;
            }
            .tmk-step2-h2-dep {
                margin: 0 0 ${Math.round(m.gap * 0.75)}px 0;
                font-size: ${Math.max(16, Math.round(m.small * 0.36))}px;
                font-weight: 700;
                color: #111;
            }
            #tmk-step2-passenger-tags {
                display: flex;
                flex-wrap: wrap;
                gap: ${Math.round(m.gap * 0.75)}px ${Math.round(m.gap * 1.25)}px;
                margin: 0 0 ${m.gap}px 0;
                align-items: baseline;
            }
            .tmk-step2-tag {
                display: inline-flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 4px 6px;
                max-width: 100%;
                font-size: ${Math.max(13, Math.round(m.small * 0.28))}px;
                line-height: 1.35;
                color: #1e293b;
            }
            .tmk-step2-tag-k {
                color: #64748b;
                font-weight: 600;
            }
            .tmk-step2-tag-v {
                font-weight: 500;
                word-break: break-all;
            }
            #tmk-step2-passenger-tags.tmk-step2-tag-warn {
                outline: 2px dashed rgba(253, 126, 20, 0.75);
                outline-offset: 4px;
                border-radius: 6px;
                padding: 4px;
            }
        `;
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


    function updateToolbar() {
        const toolbar = document.getElementById(TOOLBAR_ID);
        if (!toolbar) return;
        toolbar.querySelectorAll('.tmk-lqv2-btn').forEach((btn) => {
            const active = btn.getAttribute('data-mode') === state.mode;
            btn.classList.toggle('tmk-active', active);
        });
    }


    function applyMenuModeUI() {
        if (state.form) state.form.style.display = '';
        if (state.wrap) state.wrap.style.display = state.mode === 'legacy' ? 'none' : 'block';
        if (state.glass) state.glass.style.display = state.mode === 'legacy' ? 'none' : 'block';
    }


    function applyStep2ModeUI() {
        const shell = document.getElementById(SHELL_ID);
        const glass = document.getElementById(GLASS_ID);
        if (state.mode === 'modern') {
            document.documentElement.classList.add(MODE_CLASS);
            if (shell) shell.style.display = '';
            if (glass) glass.style.display = 'block';
        } else {
            document.documentElement.classList.remove(MODE_CLASS);
            if (shell) shell.style.display = 'none';
            if (glass) glass.style.display = 'none';
        }
    }


    function enforceUiGlobalControl() {
        const forceTs = readForceCloseViewsTs();
        if (forceTs > state.lastForceCloseTs) {
            state.lastForceCloseTs = forceTs;
            if (state.mode === 'modern') setMode('legacy');
        }
    }


    function setMode(mode) {
        state.mode = mode === 'legacy' ? 'legacy' : 'modern';
        if (state.page === 'menu') {
            applyMenuModeUI();
        } else if (state.page === 'step2') {
            applyStep2ModeUI();
            if (state.shell) syncMirrorsFromDom(state.shell);
        }
        updateToolbar();
    }


    function renderToolbar() {
        if (!document.body || document.getElementById(TOOLBAR_ID)) return;
        const toolbar = document.createElement('div');
        toolbar.id = TOOLBAR_ID;
        toolbar.innerHTML = `
            <button class="tmk-lqv2-btn tmk-active" data-mode="modern" type="button">我的视图</button>
            <button class="tmk-lqv2-btn" data-mode="legacy" type="button">原版页面</button>
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


    function bootstrapMenu() {
        if (!findLegacyControls()) return;
        state.page = 'menu';
        ensureTheme2Applied();
        console.info('[LQ unified] menu legacy controls found', {
            receiveCompany: state.receiveCompanyInputs.length,
            bagnum: state.bagnumInputs.length,
            idnum: state.idnumInputs.length,
            ticketNum: state.ticketNumInputs.length
        });
        injectSharedLqv2Style();
        applyLeftGap();
        ensureGlassLayer();
        buildModernUI();
        renderToolbar();
        syncFromLegacy();
        bindModernEvents();
        consumeModernLostQueryLaunchMark();
        state.lastForceCloseTs = readForceCloseViewsTs();
        setMode('modern');
        window.setInterval(function() {
            enforceUiGlobalControl();
            ensureTheme2Applied();
        }, 500);
        window.addEventListener('resize', applyLeftGap);
    }


    function parseYyyyMmDd(ymd) {
        const s = String(ymd || '').replace(/\D/g, '');
        if (s.length !== 8) return null;
        const y = parseInt(s.slice(0, 4), 10);
        const mo = parseInt(s.slice(4, 6), 10);
        const d = parseInt(s.slice(6, 8), 10);
        if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        return { y: y, mo: mo, d: d };
    }


    function formatFlightDateDdmMmmYyyy(ymd) {
        const p = parseYyyyMmDd(ymd);
        if (!p) return String(ymd || '');
        const dk = p.d < 10 ? '0' + p.d : String(p.d);
        return dk + MONTH_EN3[p.mo - 1] + String(p.y);
    }


    function formatFlightDateDdmMmm(ymd) {
        const p = parseYyyyMmDd(ymd);
        if (!p) return String(ymd || '');
        const dk = p.d < 10 ? '0' + p.d : String(p.d);
        return dk + MONTH_EN3[p.mo - 1];
    }


    function formatBaggageTagDisplay(raw) {
        const s = String(raw || '').replace(/\s+/g, '');
        if (s.length < 4) return s;
        const triple = s.slice(1, 4);
        const code = BAGGAGE_TRIPLE_TO_AIRLINE[triple];
        if (!code) return s;
        let out = s.slice(0, 1) + code + s.slice(4);
        out = out.replace(/^0(?=[A-Z]{2})/, '');
        return out;
    }


    function parseTwoAirportSegment(area) {
        const s = normalizeText(area);
        if (!s || s === '—') return null;
        const parts = s.split('-');
        if (parts.length !== 2) return null;
        const from = parts[0].toUpperCase();
        const to = parts[1].toUpperCase();
        if (!from || !to) return null;
        return { from: from, to: to };
    }


    function mergeOrderedRouteStrings(routeStrs) {
        const out = [];
        let chain = null;
        for (let i = 0; i < routeStrs.length; i++) {
            const raw = routeStrs[i];
            const seg = parseTwoAirportSegment(raw);
            if (!seg) {
                if (chain) {
                    out.push(chain.join('-'));
                    chain = null;
                }
                out.push(raw);
                continue;
            }
            if (!chain) {
                chain = [seg.from, seg.to];
                continue;
            }
            if (chain[chain.length - 1] === seg.from) {
                chain.push(seg.to);
            } else {
                out.push(chain.join('-'));
                chain = [seg.from, seg.to];
            }
        }
        if (chain) {
            out.push(chain.join('-'));
        }
        return out.join('; ');
    }


    function fillFlightTitleBlock(container, fl) {
        container.innerHTML = '';
        const l1 = document.createElement('div');
        l1.className = 'tmk-step2-flight-line';
        const dateLong = formatFlightDateDdmMmmYyyy(fl.date);
        l1.textContent = [fl.num, dateLong].filter(Boolean).join(' ');
        container.appendChild(l1);
        if (fl.area) {
            const l2 = document.createElement('div');
            l2.className = 'tmk-step2-flight-line';
            l2.textContent = fl.area;
            container.appendChild(l2);
        }
        if (fl.seat) {
            const l3 = document.createElement('div');
            l3.className = 'tmk-step2-flight-line';
            l3.textContent = fl.seat;
            container.appendChild(l3);
        }
        if (fl.room) {
            const l4 = document.createElement('div');
            l4.className = 'tmk-step2-flight-line';
            l4.textContent = fl.room;
            container.appendChild(l4);
        }
    }


    function renderSelectionSummary() {
        const sumFl = el('tmk-step2-summary-flights');
        const sumBag = el('tmk-step2-summary-baggage');
        if (!sumFl || !sumBag) return;
        const blocks = getLgBlocks();
        const segParts = [];
        const tagOrder = [];
        const tagToRoutes = {};
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const bi = getBlockIndex(block);
            const blockCb = block.querySelector('input[name="eXLgSelect"]');
            const fl = readFlightLine(bi);
            if (blockCb && blockCb.checked && !isFlightDelY(block, bi)) {
                const dShort = formatFlightDateDdmMmm(fl.date);
                segParts.push(fl.num + '/' + dShort);
            }
            const bagRows = getBaggageRows(block, bi);
            for (let r = 0; r < bagRows.length; r++) {
                const item = bagRows[r];
                if (!item.checkbox.checked) continue;
                const numEl = el('lgInfo_baggageInfoList_' + bi + '_baggageNum_' + item.index);
                const raw = numEl ? normalizeText(numEl.textContent) : '';
                const tag = formatBaggageTagDisplay(raw);
                const area = normalizeText(fl.area) || '—';
                if (!tagToRoutes[tag]) {
                    tagToRoutes[tag] = [];
                    tagOrder.push(tag);
                }
                const arr = tagToRoutes[tag];
                if (!arr.length || arr[arr.length - 1] !== area) {
                    arr.push(area);
                }
            }
        }
        const bagParts = [];
        for (let t = 0; t < tagOrder.length; t++) {
            const tag = tagOrder[t];
            const routes = tagToRoutes[tag] || [];
            const merged = mergeOrderedRouteStrings(routes);
            bagParts.push(tag + '/' + merged);
        }
        const a = segParts.join('/');
        const b = bagParts.join('; ');
        sumFl.textContent = '已选择航班：' + (a || '—');
        sumBag.textContent = '已选择行李：' + (b || '—');
    }


    function segmentContainsLax(flightArea) {
        return /\bLAX\b/i.test(String(flightArea || ''));
    }


    function isFlightDelY(block, idx) {
        const delNode = block.querySelector('#lgInfo_flightDel_' + idx) || document.getElementById('lgInfo_flightDel_' + idx);
        return normalizeText(delNode && delNode.textContent).toUpperCase() === 'Y';
    }


    function isDestNotLax(destEl) {
        return normalizeText(destEl && destEl.textContent).toUpperCase() !== LAX_DEST;
    }


    function getFirstBaggageDestEl(idx) {
        const n = el('lgInfo_baggageInfoList_' + idx + '_baggageDest_0');
        return n || null;
    }


    function isRowLaxByFirstBaggageDest(idx) {
        const d = getFirstBaggageDestEl(idx);
        if (!d) return false;
        return !isDestNotLax(d);
    }


    function ensureLaxRowAutoSelect(block, bi) {
        if (!state.laxAutoDoneByBlock) state.laxAutoDoneByBlock = new WeakMap();
        if (isFlightDelY(block, bi)) return;
        if (!isRowLaxByFirstBaggageDest(bi)) return;
        if (state.laxAutoDoneByBlock.get(block)) return;
        const blockCb = block.querySelector('input[name="eXLgSelect"]');
        const rows = getBaggageRows(block, bi);
        if (blockCb && !blockCb.checked) {
            blockCb.click();
            triggerJqChange(blockCb);
        }
        for (let r = 0; r < rows.length; r++) {
            if (!rows[r].checkbox.checked) {
                rows[r].checkbox.click();
                triggerJqChange(rows[r].checkbox);
            }
        }
        state.laxAutoDoneByBlock.set(block, true);
    }


    function applyAutoLgSelectForSubmission() {
        const blocks = getLgBlocks();
        const checkedBlocks = [];
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const bi = getBlockIndex(block);
            if (isFlightDelY(block, bi)) continue;
            const ex = block.querySelector('input[name="eXLgSelect"]');
            if (ex && ex.checked) checkedBlocks.push(block);
        }
        if (!checkedBlocks.length) return;
        const allRads = document.querySelectorAll('input[name="lgSelect"]');
        let detailOk = false;
        for (let r = 0; r < allRads.length; r++) {
            if (!allRads[r].checked) continue;
            const host = allRads[r].closest('div[id="lgDisplay"]');
            if (!host) continue;
            const ex = host.querySelector('input[name="eXLgSelect"]');
            if (ex && ex.checked) {
                detailOk = true;
                break;
            }
        }
        if (detailOk) return;
        const targetBlock = checkedBlocks[checkedBlocks.length - 1];
        const rad = targetBlock.querySelector('input[name="lgSelect"]');
        if (!rad) return;
        for (let j = 0; j < allRads.length; j++) allRads[j].checked = false;
        rad.click();
        triggerJqChange(rad);
    }


    function getLgBlocks() {
        return Array.prototype.slice.call(document.querySelectorAll('div[id="lgDisplay"]'));
    }


    function getBlockIndex(block) {
        const ex = block.querySelector('input[name="eXLgSelect"]');
        if (ex && ex.value !== '') {
            const v = parseInt(ex.value, 10);
            if (!isNaN(v)) return v;
        }
        const attr = block.getAttribute('data-tmk-idx');
        if (attr !== null && attr !== '') return parseInt(attr, 10) || 0;
        return 0;
    }


    function getBaggageRows(block, idx) {
        const rows = [];
        const destNodes = block.querySelectorAll('[id^="lgInfo_baggageInfoList_' + idx + '_baggageDest_"]');
        for (let d = 0; d < destNodes.length; d++) {
            const destEl = destNodes[d];
            const id = destEl.id || '';
            const m = id.match(/baggageDest_(\d+)$/);
            if (!m) continue;
            const j = m[1];
            const cb = block.querySelector('input[name="lgInfo_baggageInfoList_' + idx + '_baggageIndex_' + j + '_check"]');
            if (cb) rows.push({ index: j, destEl: destEl, checkbox: cb });
        }
        return rows;
    }


    function applyFlightDelBlockOnly(block, idx) {
        const blockCb = block.querySelector('input[name="eXLgSelect"]');
        const rows = getBaggageRows(block, idx);
        const delY = isFlightDelY(block, idx);
        if (!delY) {
            if (blockCb) blockCb.disabled = false;
            rows.forEach(function(r) {
                r.checkbox.disabled = false;
            });
            return;
        }
        if (blockCb) {
            blockCb.checked = false;
            blockCb.disabled = true;
        }
        rows.forEach(function(r) {
            r.checkbox.checked = false;
            r.checkbox.disabled = true;
        });
        const rad = block.querySelector('input[name="lgSelect"]');
        if (rad && rad.checked) rad.checked = false;
    }


    function applyFlightDelRulesAll() {
        getLgBlocks().forEach(function(block) {
            applyFlightDelBlockOnly(block, getBlockIndex(block));
        });
    }


    function el(id) {
        return document.getElementById(id);
    }


    function readFlightLine(idx) {
        const g = function(suffix) {
            const n = el('lgInfo_' + suffix + '_' + idx);
            return n ? normalizeText(n.textContent) : '';
        };
        return {
            num: g('flightNum'),
            date: g('flightDate'),
            area: g('flightArea'),
            seat: g('seatNum'),
            room: g('flightRoom')
        };
    }


    function readPassengerSubject(idx) {
        const pick = function(id) {
            const n = el(id);
            return n ? normalizeText(n.textContent) : '';
        };
        const cardNum = pick('lgInfo_cardNum_' + idx);
        const cardLv = pick('lgInfo_cardLevel_' + idx);
        const ff = [cardNum, cardLv].filter(Boolean).join(' / ');
        return {
            name: pick('lgInfo_name_' + idx),
            sex: pick('lgInfo_sex_' + idx),
            idNum: pick('lgInfo_idNum_' + idx),
            ffLine: ff
        };
    }


    function isCardLevelWarn(idx) {
        const lv = normalizeText(el('lgInfo_cardLevel_' + idx) && el('lgInfo_cardLevel_' + idx).textContent);
        if (!lv) return false;
        return !/^(B|S)$/i.test(lv);
    }


    function renderPassengerTags() {
        const wrap = el('tmk-step2-passenger-tags');
        if (!wrap) return;
        const blocks = getLgBlocks();
        if (!blocks.length) {
            wrap.innerHTML = '';
            wrap.classList.remove('tmk-step2-tag-warn');
            return;
        }
        const idx = getBlockIndex(blocks[0]);
        const subj = readPassengerSubject(idx);
        wrap.classList.toggle('tmk-step2-tag-warn', isCardLevelWarn(idx));
        wrap.innerHTML = '';
        const pairs = [
            ['旅客姓名', subj.name],
            ['性别', subj.sex],
            ['证件号', subj.idNum],
            ['常客卡号/级别', subj.ffLine]
        ];
        for (let p = 0; p < pairs.length; p++) {
            const span = document.createElement('span');
            span.className = 'tmk-step2-tag';
            const k = document.createElement('span');
            k.className = 'tmk-step2-tag-k';
            k.textContent = pairs[p][0] + ' ';
            const v = document.createElement('span');
            v.className = 'tmk-step2-tag-v';
            v.textContent = pairs[p][1] || '—';
            span.appendChild(k);
            span.appendChild(v);
            wrap.appendChild(span);
        }
    }


    function renderSegmentRows(shell) {
        const rowsRoot = el('tmk-step2-rows');
        if (!rowsRoot) return;
        if (state.observer) state.observer.disconnect();
        renderPassengerTags();
        applyFlightDelRulesAll();
        const blocksPre = getLgBlocks();
        for (let p = 0; p < blocksPre.length; p++) {
            ensureLaxRowAutoSelect(blocksPre[p], getBlockIndex(blocksPre[p]));
        }
        applyAutoLgSelectForSubmission();
        rowsRoot.innerHTML = '';
        const blocks = getLgBlocks();
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const bi = getBlockIndex(block);
            const fl = readFlightLine(bi);
            const delY = isFlightDelY(block, bi);
            const rowLaxDest = isRowLaxByFirstBaggageDest(bi);
            const hasLaxSeg = segmentContainsLax(fl.area);
            const row = document.createElement('div');
            row.className = 'tmk-step2-seg-row';
            const blockCb = block.querySelector('input[name="eXLgSelect"]');
            const rad = block.querySelector('input[name="lgSelect"]');
            const big = document.createElement('button');
            big.type = 'button';
            big.className = 'tmk-step2-big-tile';
            if (delY || !rowLaxDest) {
                big.classList.add('tmk-step2-big-tile--gray');
            } else if (hasLaxSeg) {
                big.classList.add('tmk-step2-big-tile--lax');
            } else {
                big.classList.add('tmk-step2-big-tile--nolax');
            }
            big.classList.toggle('tmk-step2-tile--pressed', !!(blockCb && blockCb.checked));
            big.classList.toggle('tmk-step2-tile--detail', !!(rad && rad.checked));
            big.disabled = !!delY;
            const ft = document.createElement('div');
            ft.className = 'tmk-step2-flight-title';
            fillFlightTitleBlock(ft, fl);
            big.appendChild(ft);
            (function() {
                let timer = null;
                big.addEventListener('click', function(e) {
                    if (delY || !blockCb) return;
                    if (e.detail >= 2) {
                        if (timer) {
                            clearTimeout(timer);
                            timer = null;
                        }
                        return;
                    }
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(function() {
                        timer = null;
                        blockCb.click();
                        triggerJqChange(blockCb);
                        if (state.shell) scheduleSync(state.shell);
                    }, 280);
                });
                big.addEventListener('dblclick', function(e) {
                    e.preventDefault();
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    if (delY || !blockCb || !rad) return;
                    const all = document.querySelectorAll('input[name="lgSelect"]');
                    for (let j = 0; j < all.length; j++) all[j].checked = false;
                    if (!blockCb.checked) {
                        blockCb.click();
                        triggerJqChange(blockCb);
                    }
                    rad.click();
                    triggerJqChange(rad);
                    if (state.shell) scheduleSync(state.shell);
                });
            })();
            const swrap = document.createElement('div');
            swrap.className = 'tmk-step2-small-wrap';
            const bagRows = getBaggageRows(block, bi);
            for (let r = 0; r < bagRows.length; r++) {
                const item = bagRows[r];
                const st = document.createElement('button');
                st.type = 'button';
                st.className = 'tmk-step2-med-tile';
                if (delY || !rowLaxDest) {
                    st.classList.add('tmk-step2-med-tile--gray');
                } else if (hasLaxSeg) {
                    st.classList.add('tmk-step2-med-tile--lax');
                } else {
                    st.classList.add('tmk-step2-med-tile--nolax');
                }
                st.classList.toggle('tmk-step2-tile--pressed', !!item.checkbox.checked);
                st.disabled = !!delY;
                const numEl = el('lgInfo_baggageInfoList_' + bi + '_baggageNum_' + item.index);
                const lineA = document.createElement('div');
                lineA.style.fontWeight = '700';
                lineA.textContent = normalizeText(item.destEl.textContent) || '—';
                const lineB = document.createElement('div');
                lineB.textContent = numEl ? formatBaggageTagDisplay(normalizeText(numEl.textContent)) : '';
                st.appendChild(lineA);
                st.appendChild(lineB);
                st.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (delY) return;
                    item.checkbox.click();
                    triggerJqChange(item.checkbox);
                    if (state.shell) scheduleSync(state.shell);
                });
                swrap.appendChild(st);
            }
            row.appendChild(big);
            row.appendChild(swrap);
            rowsRoot.appendChild(row);
        }
        renderSelectionSummary();
        if (state.observer && state.observerRoot) {
            state.observer.observe(state.observerRoot, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['checked', 'disabled'] });
        }
    }


    function syncMirrorsFromDom(shell) {
        if (state.mode !== 'modern' || !shell) return;
        renderSegmentRows(shell);
    }


    function scheduleSync(shell) {
        if (state.syncTimer) clearTimeout(state.syncTimer);
        state.syncTimer = setTimeout(function() {
            state.syncTimer = null;
            syncMirrorsFromDom(shell);
        }, 280);
    }


    function mountShell() {
        const blocks = getLgBlocks();
        if (!blocks.length) return false;
        const first = blocks[0];
        const parent = first.parentNode;
        if (!parent) return false;
        state.page = 'step2';
        ensureTheme2Applied();
        applyLeftGap();
        injectSharedLqv2Style();
        injectStep2ShellStyle(getUiMetrics());
        ensureGlassLayer();
        renderToolbar();
        const shell = document.createElement('div');
        shell.id = SHELL_ID;
        const h2 = document.createElement('h2');
        h2.className = 'tmk-step2-h2-dep';
        h2.textContent = '离港信息';
        const tags = document.createElement('div');
        tags.id = 'tmk-step2-passenger-tags';
        const rows = document.createElement('div');
        rows.id = 'tmk-step2-rows';
        const summary = document.createElement('div');
        summary.id = 'tmk-step2-selection-summary';
        const sumFlights = document.createElement('div');
        sumFlights.id = 'tmk-step2-summary-flights';
        const sumBaggage = document.createElement('div');
        sumBaggage.id = 'tmk-step2-summary-baggage';
        summary.appendChild(sumFlights);
        summary.appendChild(sumBaggage);
        const foot = document.createElement('div');
        foot.className = 'tmk-step2-footer-bar';
        const newOrig = el('newBaggageLostBtn');
        if (newOrig) {
            const bn = document.createElement('button');
            bn.type = 'button';
            bn.className = 'tmk-step2-footer-new';
            bn.textContent = normalizeText(newOrig.textContent) || '新建';
            bn.addEventListener('click', function() {
                newOrig.click();
            });
            foot.appendChild(bn);
        }
        shell.appendChild(h2);
        shell.appendChild(tags);
        shell.appendChild(rows);
        shell.appendChild(summary);
        shell.appendChild(foot);
        parent.insertBefore(shell, first);
        for (let i = 0; i < blocks.length; i++) {
            blocks[i].classList.add('tmk-step2-lg-origin');
            blocks[i].setAttribute('data-tmk-idx', String(i));
        }
        state.shell = shell;
        consumeModernLostQueryLaunchMark();
        state.lastForceCloseTs = readForceCloseViewsTs();
        setMode('modern');
        window.setInterval(function() {
            enforceUiGlobalControl();
            ensureTheme2Applied();
        }, 500);
        window.addEventListener('resize', function() {
            applyLeftGap();
            injectStep2ShellStyle(getUiMetrics());
        });
        return true;
    }


    function startObserver() {
        const root = el('content_1') || document.body;
        if (!root) return;
        state.observerRoot = root;
        if (state.observer) state.observer.disconnect();
        state.observer = new MutationObserver(function(mutations) {
            let need = false;
            for (let i = 0; i < mutations.length; i++) {
                let t = mutations[i].target;
                if (t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
                if (!(t instanceof Element)) continue;
                if (t.id === SHELL_ID || (t.closest && t.closest('#' + SHELL_ID))) continue;
                if (t.id === TOOLBAR_ID || (t.closest && t.closest('#' + TOOLBAR_ID))) continue;
                if (t.id === GLASS_ID || (t.closest && t.closest('#' + GLASS_ID))) continue;
                need = true;
                break;
            }
            if (need) scheduleSync(state.shell);
        });
        state.observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['checked', 'disabled'] });
        if (state.pollId) clearInterval(state.pollId);
        state.pollId = setInterval(function() {
            if (state.mode === 'modern' && state.shell) scheduleSync(state.shell);
        }, 2000);
    }


    function bootstrapStep2() {
        if (document.getElementById(SHELL_ID)) return;
        const tryMount = function() {
            if (document.getElementById(SHELL_ID)) return;
            if (mountShell()) startObserver();
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryMount);
        } else {
            tryMount();
        }
        setTimeout(tryMount, 500);
        setTimeout(tryMount, 2000);
    }


    function main() {
        const page = resolvePage();
        if (!page) return;
        if (page === 'menu') {
            bootstrapMenu();
        } else if (page === 'step2') {
            bootstrapStep2();
        }
    }


    main();
})();
