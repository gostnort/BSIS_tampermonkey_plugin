// ==UserScript==
// @name         BCheckWeb 少收表 v2 覆盖层
// @namespace    http://tampermonkey.net/
// @version      2.2.4
// @description  新建少收：快捷仅壳显示；详情/信息/追踪进 tmk-stage；TN 规则同前；步骤条置顶透明；与少收表 v1 请勿同时启用
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
    // 与 BCheckWeb 少收表_v1.js 互斥：请勿同时启用两套少收表 UI 脚本。
    const PAGE_RE = /(?:newNull)?BaggageLost_newBaggageLostAction\.action/i;
    const INIT_FLAG = '__tmkLostFormV2Inited';
    const STYLE_ID = 'tmk-lostform-v2-style';
    const GLASS_ID = 'tmk-lostform-v2-glass';
    const TOOLBAR_ID = 'tmk-lostform-v2-toolbar';
    const SHELL_ID = 'tmk-lostform-v2-shell';
    const STAGE_ID = 'tmk-lostform-v2-stage';
    const STEPPER_BAR_ID = 'tmk-lostform-v2-stepper-bar';
    const QUICK_FILL_FAB_ID = 'tmk-lostform-v2-qf-fab';
    const DETAIL_QUICK_FILL_FAB_ID = 'tmk-lostform-v2-qf-fab-detail';
    const PREVIEW_BTN_ID = 'tmk-lostform-v2-qf-preview';
    const PREVIEW_SLOT_ID = 'tmk-lostform-v2-qf-preview-slot';
    const ACTION_BAR_ID = 'tmk-lostform-v2-qf-action-bar';
    const MODE_CLASS = 'tmk-lostform-v2-modern';
    const MIRROR_PAGE_CLASS = 'tmk-lostform-v2-mirror-page';
    const FORCE_CLOSE_VIEWS_KEY = 'tmk-force-close-views-ts';
    const DEFAULT_CP = '3102151188';
    const CT_PATTERN = /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/;
    const DEFAULT_Z_LAYERS = Object.freeze({
        basePage: 0,
        backgroundCover: 100,
        mainFunctionView: 500,
        functionButton: 600,
        searchControls: 900,
        floatingButton: 1000
    });
    const state = {
        mode: 'modern',
        mainStep: 1,
        subStep36: 2,
        glass: null,
        shell: null,
        capsLockActive: false,
        observer: null,
        content1FsBound: false,
        quickReady: false,
        detailSyncTimer: null,
        stageInsertBeforeRef: null,
        mirrorPageRefs: {},
        mirrorControlPairs: {},
        lastForceCloseTs: 0
    };
    if (!PAGE_RE.test(String(window.location.href || ''))) return;
    if (!isContentFrame()) return;
    if (window[INIT_FLAG]) return;
    window[INIT_FLAG] = true;


    function normalizeZLayers(raw) {
        const out = Object.assign({}, DEFAULT_Z_LAYERS);
        if (!raw || typeof raw !== 'object') return out;
        Object.keys(DEFAULT_Z_LAYERS).forEach(function(k) {
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


    // v2 覆盖层必须在 BCheckWeb_UI 之下：统一压低 z-index，避免挡住 UI 浮层
    function getV2ZLayers() {
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


    function isContentFrame() {
        try {
            if (window.top === window.self) return true;
            return window.frameElement && window.frameElement.id === 'content_frame';
        } catch (e) {
            return false;
        }
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


    // 与 BCheckWeb_UI.js calcUiMetrics 一致，供 --tmk-medium / --tmk-gap 回退
    function calcUiMetricsLike() {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        const shortSide = Math.min(vw, vh);
        const small = Math.max(46, Math.min(78, Math.round(shortSide * 0.07)));
        const gap = Math.max(8, Math.min(16, Math.round(small * 0.22)));
        const medium = small * 2;
        const bigTile = medium * 2 + gap;
        return { small: small, gap: gap, medium: medium, bigTile: bigTile };
    }


    // 优先使用 top.__tmkUiMetrics（BCheckWeb_UI 发布），否则本地计算
    function applyTmkTileVars() {
        if (!document.documentElement) return;
        let m = null;
        try {
            if (window.top && window.top.__tmkUiMetrics && Number.isFinite(window.top.__tmkUiMetrics.medium)) {
                m = window.top.__tmkUiMetrics;
            }
        } catch (e) {}
        if (!m && window.__tmkUiMetrics && Number.isFinite(window.__tmkUiMetrics.medium)) {
            m = window.__tmkUiMetrics;
        }
        const g0 = m && Number.isFinite(m.gap) ? Number(m.gap) : null;
        const payload = m
            ? {
                small: Number.isFinite(m.small) ? Number(m.small) : 46,
                gap: g0 != null ? g0 : 8,
                medium: Number(m.medium) || 92,
                bigTile: Number.isFinite(m.bigTile) ? Number(m.bigTile) : Number(m.medium) * 2 + (g0 != null ? g0 : 8)
            }
            : calcUiMetricsLike();
        const root = document.documentElement;
        root.style.setProperty('--tmk-medium', `${payload.medium}px`);
        root.style.setProperty('--tmk-gap', `${payload.gap}px`);
        root.style.setProperty('--tmk-big-tile', `${payload.bigTile}px`);
        root.style.setProperty('--tmk-small-tile', `${payload.small}px`);
    }


    // 快捷/详细共用：列数 = floor(视口宽/720)，至少 1 列，至多 8 列
    function applyQfCols() {
        if (!document.documentElement) return;
        const w = window.innerWidth || 1200;
        const cols = Math.max(1, Math.min(8, Math.floor(w / 720)));
        document.documentElement.style.setProperty('--tmk-qf-cols', String(cols));
    }


    // 窄屏（<720）缩小壳与详细面板的左右留白，避免横向滚动条
    function applyNarrowShellVars() {
        if (!document.documentElement) return;
        const w = window.innerWidth || 800;
        const narrow = w < 720;
        const shellPadX = narrow ? Math.max(6, Math.min(12, Math.round(w * 0.02))) : 12;
        const shellPadTop = narrow ? 8 : 10;
        const shellPadBot = narrow ? 10 : 14;
        const panelMx = narrow ? Math.max(4, Math.min(10, Math.round(w * 0.015))) : 15;
        const shellRight = narrow ? Math.max(8, Math.min(16, Math.round(w * 0.02))) : 24;
        const root = document.documentElement;
        root.style.setProperty('--tmk-lostform-v2-shell-pad-x', `${shellPadX}px`);
        root.style.setProperty('--tmk-lostform-v2-shell-pad-top', `${shellPadTop}px`);
        root.style.setProperty('--tmk-lostform-v2-shell-pad-bot', `${shellPadBot}px`);
        root.style.setProperty('--tmk-lostform-v2-c1-panel-mx', `${panelMx}px`);
        root.style.setProperty('--tmk-lostform-v2-shell-right', `${shellRight}px`);
    }


    // 与 BCheckWeb_UI.js themeColorVarFromKey 一致：语义色 → --tmk-c-*
    function themeColorVarFromKey(key) {
        return '--tmk-c-' + String(key).replace(/([A-Z])/g, '-$1').toLowerCase();
    }


    // 将 UI 脚本发布的 __tmkTheme.colors 同步到本帧 :root（与 applyThemeCss 写入的变量名一致）
    function syncThemeVarsFromUi() {
        if (!document.documentElement) return;
        let colors = null;
        try {
            if (window.__tmkTheme && window.__tmkTheme.colors) {
                colors = window.__tmkTheme.colors;
            }
        } catch (e) {}
        if (!colors) {
            try {
                if (window.top && window.top.__tmkTheme && window.top.__tmkTheme.colors) {
                    colors = window.top.__tmkTheme.colors;
                }
            } catch (e2) {}
        }
        if (!colors || typeof colors !== 'object') return;
        Object.keys(colors).forEach(function(k) {
            const v = colors[k];
            if (v === undefined || v === null || String(v) === '') return;
            try {
                document.documentElement.style.setProperty(themeColorVarFromKey(k), String(v));
            } catch (e3) {}
        });
        // 部分环境下 __tmkTheme.colors 仅有展开键、缺基底键名；少收表样式用 --tmk-c-major-focus 等。此处每个基底键只从一个展开键取值（与 BCheckWeb_UI.js expandThemeColors 中对应链条一致，改分布时只改 UI 一处或改下表一对一映射）
        ensureCanonicalThemeVarsFallback(colors);
    }


    // 基底键缺失时：canonicalKey → 唯一展开键（每个语义色只绑一个 BCheckWeb_UI 色键，无多键备选链）
    function ensureCanonicalThemeVarsFallback(colors) {
        if (!colors || typeof colors !== 'object' || !document.documentElement) return;
        const root = document.documentElement;
        const canonicalFromExpand = {
            majorFocus: 'lv1Bg',
            majorFont: 'lv3Fg',
            minorFont: 'lv1Fg',
            minorFocus: 'searchInputBorder',
            majorButton: 'fabBg',
            inputBackground: 'searchInputBg',
            minorButton: 'lv4Bg'
        };
        Object.keys(canonicalFromExpand).forEach(function(canonicalKey) {
            const cur = colors[canonicalKey];
            if (cur !== undefined && cur !== null && String(cur) !== '') return;
            const srcKey = canonicalFromExpand[canonicalKey];
            const src = colors[srcKey];
            if (src === undefined || src === null || String(src) === '') return;
            try {
                root.style.setProperty(themeColorVarFromKey(canonicalKey), String(src));
            } catch (e) {}
        });
    }


    function applyLeftGap() {
        if (!document.documentElement) return;
        document.documentElement.style.setProperty('--tmk-left-gap', `${calcLeftGap()}px`);
        applyTmkTileVars();
        applyQfCols();
        applyNarrowShellVars();
        syncThemeVarsFromUi();
    }


    function applyStepperBarVars() {
        const sb = document.getElementById(STEPPER_BAR_ID);
        if (!sb || !document.documentElement) return;
        const h = sb.offsetHeight || 56;
        document.documentElement.style.setProperty('--tmk-lostform-v2-stepper-h', `${h}px`);
    }


    function applyShellOffset() {
        const shell = document.getElementById(SHELL_ID);
        const stage = document.getElementById(STAGE_ID);
        if (!document.documentElement) return;
        applyStepperBarVars();
        let h = 0;
        if (state.mainStep === 1 && shell) h = shell.offsetHeight || 0;
        else if (state.mainStep >= 2 && state.mainStep <= 4 && stage) h = stage.offsetHeight || 0;
        const top = 72;
        const sb = document.getElementById(STEPPER_BAR_ID);
        let sh = sb ? sb.offsetHeight || 0 : 0;
        if (!sh) {
            const raw = String(getComputedStyle(document.documentElement).getPropertyValue('--tmk-lostform-v2-stepper-h') || '56').replace(/px/gi, '').trim();
            const parsed = parseFloat(raw);
            sh = Number.isFinite(parsed) ? parsed : 56;
        }
        if (shell) document.documentElement.style.setProperty('--tmk-lostform-v2-shell-h', `${h}px`);
        document.documentElement.style.setProperty('--tmk-lostform-v2-body-pad', `${top + sh + h + 8}px`);
        document.documentElement.style.setProperty('--tmk-lostform-v2-body-pad-bottom', '8px');
    }


    function getControlSignature(el) {
        if (!el) return '';
        const tag = String(el.tagName || '').toLowerCase();
        const type = String(el.getAttribute('type') || '').toLowerCase();
        const name = String(el.getAttribute('name') || '');
        const dataName = String(el.getAttribute('data-name') || '');
        return [tag, type, name, dataName].join('|');
    }


    function collectBindableControls(root) {
        if (!root) return [];
        return Array.from(root.querySelectorAll('input, select, textarea')).filter(function(el) {
            if (!el || !el.tagName) return false;
            const tag = String(el.tagName).toLowerCase();
            if (tag === 'select' || tag === 'textarea') return true;
            const type = String(el.getAttribute('type') || 'text').toLowerCase();
            if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset' || type === 'image' || type === 'file') return false;
            return true;
        });
    }


    function removeIdsFromCloneTree(root) {
        if (!root) return;
        if (root.id) root.removeAttribute('id');
        root.querySelectorAll('[id]').forEach(function(el) {
            el.removeAttribute('id');
        });
    }


    function syncControlValue(src, dst) {
        if (!src || !dst) return;
        const tag = String(src.tagName || '').toLowerCase();
        const type = String(src.getAttribute('type') || '').toLowerCase();
        if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
            dst.checked = !!src.checked;
            return;
        }
        if (tag === 'select') {
            dst.value = src.value;
            return;
        }
        dst.value = src.value;
    }


    function dispatchMirrorEvents(el) {
        if (!el) return;
        try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
    }


    function bindMirrorControls(pageNo, sourceRoot, mirrorRoot) {
        const src = collectBindableControls(sourceRoot);
        const dst = collectBindableControls(mirrorRoot);
        const pairs = [];
        const used = new Set();
        src.forEach(function(srcEl) {
            const sig = getControlSignature(srcEl);
            let idx = -1;
            for (let i = 0; i < dst.length; i += 1) {
                if (used.has(i)) continue;
                if (getControlSignature(dst[i]) === sig) {
                    idx = i;
                    break;
                }
            }
            if (idx < 0) {
                for (let i = 0; i < dst.length; i += 1) {
                    if (!used.has(i)) {
                        idx = i;
                        break;
                    }
                }
            }
            if (idx < 0) return;
            used.add(idx);
            pairs.push({ source: srcEl, mirror: dst[idx] });
        });
        state.mirrorControlPairs[pageNo] = pairs;
        pairs.forEach(function(pair) {
            const mirrorEl = pair.mirror;
            mirrorEl.addEventListener('input', function() {
                const sourceEl = pair.source;
                if (!sourceEl) return;
                const tag = String(mirrorEl.tagName || '').toLowerCase();
                const type = String(mirrorEl.getAttribute('type') || '').toLowerCase();
                if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
                    sourceEl.checked = !!mirrorEl.checked;
                } else {
                    sourceEl.value = mirrorEl.value;
                }
                dispatchMirrorEvents(sourceEl);
            });
            mirrorEl.addEventListener('change', function() {
                const sourceEl = pair.source;
                if (!sourceEl) return;
                const tag = String(mirrorEl.tagName || '').toLowerCase();
                const type = String(mirrorEl.getAttribute('type') || '').toLowerCase();
                if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
                    sourceEl.checked = !!mirrorEl.checked;
                } else {
                    sourceEl.value = mirrorEl.value;
                }
                dispatchMirrorEvents(sourceEl);
            });
        });
    }


    function syncMirrorFromSource(pageNo) {
        const pairs = state.mirrorControlPairs[pageNo] || [];
        pairs.forEach(function(pair) {
            syncControlValue(pair.source, pair.mirror);
        });
    }


    function bindMirrorDetailPanels(mirror) {
        if (!mirror) return;
        mirror.querySelectorAll('.tmk-lostform-v2-fs-toggle').forEach(function(toggle) {
            if (toggle.getAttribute('data-tmk-mirror-bound') === '1') return;
            toggle.setAttribute('data-tmk-mirror-bound', '1');
            toggle.addEventListener('click', function() {
                const panel = toggle.closest('.tmk-lostform-v2-fs-panel');
                if (!panel) return;
                const wasCollapsed = panel.classList.contains('is-collapsed');
                mirror.querySelectorAll('.tmk-lostform-v2-fs-panel').forEach(function(p) {
                    p.classList.add('is-collapsed');
                });
                if (wasCollapsed) panel.classList.remove('is-collapsed');
            });
        });
    }


    function renderMirrorPage(pageNo) {
        const stage = document.getElementById(STAGE_ID);
        const source = document.getElementById('content_' + pageNo);
        if (!stage || !source) return;
        if (Number(pageNo) === 1) {
            setupCollapsibleFieldsetsV2();
            markContent1HeaderRowHidden();
        }
        let mirror = state.mirrorPageRefs[pageNo];
        if (!mirror || !mirror.parentNode) {
            mirror = document.createElement('div');
            mirror.className = MIRROR_PAGE_CLASS;
            mirror.setAttribute('data-tmk-mirror-page', String(pageNo));
            stage.appendChild(mirror);
            state.mirrorPageRefs[pageNo] = mirror;
        }
        mirror.innerHTML = '';
        const clone = source.cloneNode(true);
        removeIdsFromCloneTree(clone);
        mirror.appendChild(clone);
        if (Number(pageNo) === 1) bindMirrorDetailPanels(mirror);
        bindMirrorControls(pageNo, source, mirror);
        syncMirrorFromSource(pageNo);
    }


    // stage 仅承载镜像页面，不再搬运原始 content_1~7
    function ensureStage() {
        if (document.getElementById(STAGE_ID)) return;
        if (!document.body) return;
        const stage = document.createElement('div');
        stage.id = STAGE_ID;
        stage.className = 'tmk-lostform-v2-stage';
        document.body.appendChild(stage);
        [1, 2, 3, 4, 5, 6, 7].forEach(function(pageNo) {
            renderMirrorPage(pageNo);
        });
    }


    function restoreStageContentsToForm() {
        const stage = document.getElementById(STAGE_ID);
        if (!stage) return;
        stage.remove();
        state.mirrorPageRefs = {};
        state.mirrorControlPairs = {};
    }


    function isVisible(el) {
        return !!(el && el.offsetParent !== null);
    }


    function uniqueElements(elements) {
        const result = [];
        const seen = new Set();
        elements.forEach((el) => {
            if (!el || seen.has(el)) return;
            seen.add(el);
            result.push(el);
        });
        return result;
    }


    function fireInputEvents(input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }


    function setInputValue(input, value) {
        if (!input) return;
        input.value = value;
        fireInputEvents(input);
    }


    function getHintText(input) {
        const attrs = [
            input.name || '',
            input.id || '',
            input.getAttribute('data-name') || '',
            input.className || '',
            input.placeholder || ''
        ].join(' ');
        const near = [
            input.parentElement && input.parentElement.previousElementSibling ? input.parentElement.previousElementSibling.textContent || '' : '',
            input.closest('.ui-grid-a, .ui-grid-b, .ui-grid-c, tr, td, div') ? input.closest('.ui-grid-a, .ui-grid-b, .ui-grid-c, tr, td, div').textContent || '' : ''
        ].join(' ');
        return `${attrs} ${near}`.replace(/\s+/g, ' ').toLowerCase();
    }


    function collectCandidateInputs(cd) {
        return Array.from(cd.querySelectorAll('input, textarea')).filter((input) => {
            const type = (input.getAttribute('type') || 'text').toLowerCase();
            return type !== 'hidden';
        });
    }


    function matchByKeywords(inputs, keywords) {
        return inputs.filter((input) => keywords.some((word) => getHintText(input).includes(word)));
    }


    function matchBySelectors(cd, selectors) {
        return uniqueElements(selectors.flatMap((selector) => Array.from(cd.querySelectorAll(selector))));
    }


    // 行李牌 TN：排除 file/button 及非文本类型，避免「上传」等文案进入拼接
    function isTnEligibleTextInput(input) {
        const t = (input.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'file', 'button', 'submit', 'reset', 'image'].indexOf(t) >= 0) return false;
        if (t === 'checkbox' || t === 'radio') return false;
        return true;
    }


    // 须与 data-name/name/邻近文案中的「行李号」一致，避免误选丢失件数字段
    function isTnBaggageSemantic(input) {
        const dn = String(input.getAttribute('data-name') || '');
        const nm = String(input.getAttribute('name') || '').toLowerCase();
        const pl = String(input.getAttribute('placeholder') || '');
        if (dn.indexOf('行李号') >= 0) return true;
        if (nm.indexOf('baggagenum') >= 0) return true;
        if (pl.indexOf('行李号') >= 0) return true;
        const hint = getHintText(input);
        if (hint.indexOf('行李号') >= 0) return true;
        if (hint.indexOf('上传') >= 0 && hint.indexOf('行李') < 0) return false;
        return false;
    }


    function filterTnInputs(list) {
        return list.filter(isTnEligibleTextInput).filter(isTnBaggageSemantic);
    }


    function sortInputsByNameSuffix(list, fieldPrefix) {
        return uniqueElements(list).slice().sort(function(a, b) {
            const an = String((a && a.name) || '');
            const bn = String((b && b.name) || '');
            const am = an.match(new RegExp('^' + fieldPrefix.replace('.', '\\.') + '(\\d*)$', 'i'));
            const bm = bn.match(new RegExp('^' + fieldPrefix.replace('.', '\\.') + '(\\d*)$', 'i'));
            const ai = am ? parseInt(am[1] || '1', 10) : Number.MAX_SAFE_INTEGER;
            const bi = bm ? parseInt(bm[1] || '1', 10) : Number.MAX_SAFE_INTEGER;
            if (ai !== bi) return ai - bi;
            return an.localeCompare(bn);
        });
    }


    function pickNameField(cd, allInputs, hint) {
        const sel = 'input[data-name*="' + hint + '"]';
        try {
            const a = cd.querySelector(sel);
            if (a) return a;
        } catch (e) {}
        const b = matchByKeywords(allInputs, [hint]);
        return b.find(isVisible) || b[0] || null;
    }


    function resolveFieldRefs(cd) {
        const allInputs = collectCandidateInputs(cd);
        const tnBySel = matchBySelectors(cd, [
            'input[name="lbDetail.baggageNum"]',
            'input[name^="lbDetail.baggageNum"]',
            'input[data-name^="行李号"]'
        ]).filter(isTnEligibleTextInput).filter(function(input) {
            const name = String(input.name || '');
            const dataName = String(input.getAttribute('data-name') || '');
            if (/^lbDetail\.baggageNum\d*$/i.test(name)) return true;
            if (/^行李号\d*$/i.test(dataName)) return true;
            return false;
        });
        const ctBySel = matchBySelectors(cd, [
            'input[data-name*="颜色类型"]',
            'input[name*="colorType"]',
            'input[name*="color"]'
        ]);
        const bwBySel = matchBySelectors(cd, [
            'input[data-name*="总件数/重量"]',
            'input[name*="totalBaggageAmountWithWeight"]',
            'input[name*="total"]'
        ]);
        const nwBySel = matchBySelectors(cd, [
            'input[data-name*="丢失件数/重量"]',
            'input[name*="lostBaggageAmountWithWeight"]',
            'input[name*="lost"]'
        ]);
        const paBySel = matchBySelectors(cd, [
            'textarea[name*="foreverAddr"]',
            'input[name*="foreverAddr"]',
            'input[name*="fAddress"]'
        ]);
        const familyBySel = matchBySelectors(cd, [
            'input[name="lbDetail.foreverTel"]',
            'input[name*="familyPhone"]',
            'input[name*="fTelNum"]',
            'input[name*="homePhone"]'
        ]);
        const cpBySel = matchBySelectors(cd, [
            'input[name="lbDetail.phone"]',
            'input[name*="mobile"]',
            'input[name*="cell"]',
            'input[name*="cp"]'
        ]);
        const tnFallback = filterTnInputs(matchByKeywords(allInputs, ['行李号'])).filter(function(input) {
            const name = String(input.name || '');
            return /^lbDetail\.baggageNum\d*$/i.test(name);
        });
        const ctFallback = matchByKeywords(allInputs, ['颜色类型', ' ct']);
        const bwFallback = matchByKeywords(allInputs, ['总件数/重量', ' bw']);
        const nwFallback = matchByKeywords(allInputs, ['丢失件数/重量', ' nw']);
        const paFallback = matchByKeywords(allInputs, ['永久地址', ' pa']);
        const familyFallback = matchByKeywords(allInputs, ['家庭电话', '住宅电话']);
        const cpFallback = matchByKeywords(allInputs, ['移动电话', '手机', ' cp']);
        return {
            tnInputs: sortInputsByNameSuffix([...tnBySel, ...tnFallback], 'lbDetail.baggageNum').slice(0, 10),
            ctInputs: uniqueElements([...ctBySel, ...ctFallback]).slice(0, 10),
            bwInput: uniqueElements([...bwBySel, ...bwFallback]).find(isVisible) || uniqueElements([...bwBySel, ...bwFallback])[0] || null,
            nwInput: uniqueElements([...nwBySel, ...nwFallback]).find(isVisible) || uniqueElements([...nwBySel, ...nwFallback])[0] || null,
            paInput: uniqueElements([...paBySel, ...paFallback]).find(isVisible) || uniqueElements([...paBySel, ...paFallback])[0] || null,
            familyInput: uniqueElements([...familyBySel, ...familyFallback]).find(isVisible) || uniqueElements([...familyBySel, ...familyFallback])[0] || null,
            cpInput: uniqueElements([...cpBySel, ...cpFallback]).find(isVisible) || uniqueElements([...cpBySel, ...cpFallback])[0] || null,
            nameSn1: pickNameField(cd, allInputs, '旅客姓氏1'),
            nameGn1: pickNameField(cd, allInputs, '旅客名字1'),
            nameSn2: pickNameField(cd, allInputs, '旅客姓氏2'),
            nameGn2: pickNameField(cd, allInputs, '旅客名字2'),
            nameSn3: pickNameField(cd, allInputs, '旅客姓氏3'),
            nameGn3: pickNameField(cd, allInputs, '旅客名字3')
        };
    }


    function getBaggageSelectCount(cd) {
        const amountSelect = cd.getElementById('l_baggageSelect');
        if (!amountSelect) return 0;
        const optionVal = amountSelect.options[amountSelect.selectedIndex] ? amountSelect.options[amountSelect.selectedIndex].value || amountSelect.value : amountSelect.value;
        const parsed = parseInt(optionVal, 10);
        if (!Number.isNaN(parsed) && parsed > 0) return Math.min(parsed, 10);
        return 0;
    }


    function getTnCount(cd, refs) {
        const filled = refs.tnInputs.filter((input) => input.value && input.value.trim() !== '');
        if (filled.length > 0) return filled.length;
        const sel = getBaggageSelectCount(cd);
        if (sel > 0) return sel;
        return 0;
    }


    function getMaxTnSlots(cd, refs) {
        const bag = getBaggageSelectCount(cd);
        const dom = refs.tnInputs ? refs.tnInputs.length : 0;
        return Math.min(10, Math.max(dom, bag, 1));
    }


    function setBaggageSelectCount(cd, count) {
        const sel = cd.getElementById('l_baggageSelect');
        if (!sel) return false;
        const target = Math.max(1, Math.min(10, parseInt(count, 10) || 1));
        const targetStr = String(target);
        const hasTarget = Array.from(sel.options || []).some(function(opt) {
            return String(opt.value) === targetStr;
        });
        if (!hasTarget) return false;
        if (String(sel.value) === targetStr) return true;
        sel.value = targetStr;
        try {
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            sel.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) {}
        return true;
    }


    function parseBwValue(raw) {
        const normalized = (raw || '').trim().replace(/\s+/g, '');
        const match = normalized.match(/^(\d+)\/(\d+(?:\.\d+)?)$/);
        if (!match) return null;
        const pieces = parseInt(match[1], 10);
        const weight = parseFloat(match[2]);
        if (!Number.isFinite(pieces) || !Number.isFinite(weight) || pieces <= 0 || weight < 0) return null;
        return { pieces: pieces, weight: weight };
    }


    function splitCtValues(raw) {
        return raw.split('/').map((part) => part.trim().toUpperCase()).filter(Boolean);
    }


    function parseNmgnParts(raw) {
        const segs = String(raw || '').split('/');
        const parts = [];
        for (let i = 0; i < segs.length; i += 1) parts.push(String(segs[i] || '').trim());
        while (parts.length < 6) parts.push('');
        return parts.slice(0, 6);
    }


    function buildNmGnDisplayFromRefs(refs) {
        const p = [
            refs.nameSn1,
            refs.nameGn1,
            refs.nameSn2,
            refs.nameGn2,
            refs.nameSn3,
            refs.nameGn3
        ].map(function(inp) {
            return inp && inp.value ? String(inp.value).trim().toUpperCase() : '';
        });
        const out = [];
        if (p[0]) out.push(p[0]);
        if (p[1]) out.push(p[1]);
        if (p[2] || p[3]) {
            if (p[0] === p[2] && !p[3]) {
                // 旅客姓氏2 与姓氏1 相同且无旅客名字2 时不展示第二组
            } else {
                if (p[2]) out.push(p[2]);
                if (p[3]) out.push(p[3]);
            }
        }
        if (p[4]) out.push(p[4]);
        if (p[5]) out.push(p[5]);
        return out.join('/');
    }


    function applyNmgnStringToRefs(refs, raw) {
        const parts = parseNmgnParts(raw).map(function(p) {
            return String(p || '').toUpperCase();
        });
        const pairs = [
            [refs.nameSn1, parts[0]],
            [refs.nameGn1, parts[1]],
            [refs.nameSn2, parts[2]],
            [refs.nameGn2, parts[3]],
            [refs.nameSn3, parts[4]],
            [refs.nameGn3, parts[5]]
        ];
        pairs.forEach(function(pair) {
            if (pair[0]) setInputValue(pair[0], pair[1]);
        });
    }


    function buildTnStringFromRefs(refs) {
        const parts = [];
        for (let i = 0; i < refs.tnInputs.length; i += 1) {
            const v = refs.tnInputs[i] && refs.tnInputs[i].value ? String(refs.tnInputs[i].value).trim().toUpperCase() : '';
            if (v) parts.push(v);
        }
        return parts.join('/');
    }


    function sanitizeNwInput(raw) {
        return String(raw || '').replace(/[^0-9/]/g, '');
    }


    function filterNwInputEl(el) {
        if (!el) return;
        el.addEventListener('input', function() {
            const s = sanitizeNwInput(el.value);
            if (s !== el.value) el.value = s;
        });
    }


    function bindQuickUppercase(el) {
        if (!el) return;
        if (el.id === 'tmk-lostform-v2-qf-nw') return;
        function up() {
            const u = el.value.toUpperCase();
            if (u !== el.value) el.value = u;
        }
        el.addEventListener('input', up);
        el.addEventListener('blur', up);
    }


    function cleanRawLabelText(raw) {
        return String(raw || '')
            .replace(/[0-9]/g, '')
            .replace(/\*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }


    function getCommonPrefix(items) {
        if (!items || !items.length) return '';
        let prefix = String(items[0] || '');
        for (let i = 1; i < items.length; i += 1) {
            const cur = String(items[i] || '');
            while (prefix && cur.indexOf(prefix) !== 0) {
                prefix = prefix.slice(0, -1);
            }
            if (!prefix) break;
        }
        return prefix;
    }


    function normalizeZhTokens(tokens) {
        const uniq = Array.from(new Set((tokens || []).filter(Boolean)));
        if (uniq.length <= 1) return uniq;
        const prefix = getCommonPrefix(uniq);
        if (!prefix || prefix.length < 2) return uniq;
        return uniq.map(function(x) {
            return x.indexOf(prefix) === 0 ? x.slice(prefix.length) || x : x;
        });
    }


    function normalizeLabelFromRawList(rawList) {
        const cleanedLines = Array.from(new Set((rawList || []).map(cleanRawLabelText).filter(Boolean)));
        const zhTokens = [];
        const enTokens = [];
        cleanedLines.forEach(function(cleaned) {
            (cleaned.match(/[\u4e00-\u9fff]+/g) || []).forEach(function(x) {
                const t = String(x || '').trim();
                if (t) zhTokens.push(t);
            });
            (cleaned.match(/[A-Za-z]+/g) || []).forEach(function(x) {
                const t = String(x || '').trim().toUpperCase();
                if (t) enTokens.push(t);
            });
        });
        const zh = normalizeZhTokens(zhTokens).join('');
        const en = Array.from(new Set(enTokens)).join('/');
        if (zh && en) return zh + ' ' + en;
        return zh || en || '';
    }


    function findLabelRowByInput(input) {
        if (!input) return null;
        let node = input;
        while (node && node !== document.body) {
            const cl = node.classList;
            const isGrid = !!(cl && (cl.contains('ui-grid-a') || cl.contains('ui-grid-b') || cl.contains('ui-grid-c') || cl.contains('ui-grid-d')));
            if (isGrid) {
                const labelCell = node.querySelector('.ui-block-a .l_right, .ui-block-a.l_right, .l_right');
                if (labelCell) return node;
            }
            node = node.parentElement;
        }
        return input.closest('.ui-grid-a, .ui-grid-b, .ui-grid-c, .ui-grid-d');
    }


    function getRawLabelByInput(input) {
        const row = findLabelRowByInput(input);
        if (!row) return '';
        const labelEl = row.querySelector('.ui-block-a .l_right, .ui-block-a.l_right, .l_right, label');
        if (!labelEl) return '';
        return String(labelEl.textContent || '').trim();
    }


    function applyQuickLabelText(id, text) {
        const label = document.getElementById(id);
        if (!label || !text) return;
        label.textContent = text;
        try {
            console.log('[tmk-lostform-v2] newLabel', id, '=>', text);
        } catch (e) {}
    }


    function pickBaseInput(selectors) {
        for (let i = 0; i < selectors.length; i += 1) {
            try {
                const el = document.querySelector(selectors[i]);
                if (el) return el;
            } catch (e) {}
        }
        return null;
    }


    function collectNmGnRawLabels() {
        const out = [];
        const nodes = document.querySelectorAll('#content_1 .l_right, #content_1 label');
        nodes.forEach(function(el) {
            const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!t) return;
            if ((t.indexOf('NM') >= 0 || t.indexOf('GN') >= 0) && (t.indexOf('姓氏') >= 0 || t.indexOf('名字') >= 0)) {
                out.push(t);
            }
        });
        return out;
    }


    function applyNormalizedQuickLabels() {
        const nmgnRaw = collectNmGnRawLabels();
        const tnInput = pickBaseInput(['#content_1 input[data-name*="行李号"]', '#content_1 input[name*="baggageNum"]']);
        const ctInput = pickBaseInput(['#content_1 input[data-name*="颜色类型"]', '#content_1 input[name*="colorType"]', '#content_1 input[name*="color"]']);
        const nwInput = pickBaseInput(['#content_1 input[data-name*="丢失件数/重量"]', '#content_1 input[name*="lostBaggageAmountWithWeight"]', '#content_1 input[name*="lost"]']);
        const paInput = pickBaseInput(['#content_1 textarea[name*="foreverAddr"]', '#content_1 input[name*="foreverAddr"]', '#content_1 input[name*="fAddress"]']);
        const familyInput = pickBaseInput(['#content_1 input[name="lbDetail.foreverTel"]', '#content_1 input[name*="familyPhone"]', '#content_1 input[name*="fTelNum"]', '#content_1 input[name*="homePhone"]']);
        const cpInput = pickBaseInput(['#content_1 input[name="lbDetail.phone"]', '#content_1 input[name*="mobile"]', '#content_1 input[name*="cell"]', '#content_1 input[name*="cp"]']);
        applyQuickLabelText('tmk-lostform-v2-qf-label-nmgn', normalizeLabelFromRawList(nmgnRaw));
        applyQuickLabelText('tmk-lostform-v2-qf-label-tn', normalizeLabelFromRawList([getRawLabelByInput(tnInput)]));
        applyQuickLabelText('tmk-lostform-v2-qf-label-ct', normalizeLabelFromRawList([getRawLabelByInput(ctInput)]));
        applyQuickLabelText('tmk-lostform-v2-qf-label-nw', normalizeLabelFromRawList([getRawLabelByInput(nwInput)]));
        applyQuickLabelText('tmk-lostform-v2-qf-label-pa', normalizeLabelFromRawList([getRawLabelByInput(paInput)]));
        const familyLabel = normalizeLabelFromRawList([getRawLabelByInput(familyInput)]);
        applyQuickLabelText('tmk-lostform-v2-qf-label-family', familyLabel || '家庭电话 PN');
        applyQuickLabelText('tmk-lostform-v2-qf-label-cp', normalizeLabelFromRawList([getRawLabelByInput(cpInput)]));
    }


    function collectTextboxElements(container) {
        if (!container) return [];
        return Array.from(container.querySelectorAll('input[type="text"], input[type="search"], input[type="tel"], input:not([type]), textarea')).filter(function(el) {
            if (!el || !isVisible(el)) return false;
            const t = String(el.getAttribute('type') || 'text').toLowerCase();
            return t !== 'hidden' && t !== 'button' && t !== 'submit' && t !== 'reset' && t !== 'image';
        });
    }


    function normalizeTextboxWidthsInContainer(container) {
        const textboxes = collectTextboxElements(container);
        if (!textboxes.length) return;
        // 输入框改为占满可用空间：移除历史“最短宽度右对齐”内联样式
        textboxes.forEach(function(el) {
            el.style.removeProperty('width');
            el.style.removeProperty('min-width');
            el.style.removeProperty('max-width');
            el.style.removeProperty('margin-left');
            el.style.setProperty('flex', '1 1 auto');
        });
    }


    function normalizeQuickTextboxWidths() {
        const quick = document.getElementById('tmk-lostform-v2-quick');
        if (!quick) return;
        const grid = quick.querySelector('.tmk-lostform-v2-qf-grid');
        normalizeTextboxWidthsInContainer(grid || quick);
    }


    function isQuickDetailReady() {
        const c1 = document.getElementById('content_1');
        if (!c1) return false;
        const refs = resolveFieldRefs(document);
        if (refs.tnInputs.length >= 1) return true;
        if (document.getElementById('l_baggageSelect')) return true;
        if (c1.querySelector('fieldset')) return true;
        return false;
    }


    function findNewBaggageLostButton() {
        const byId = document.getElementById('newBaggageLostBtn');
        if (byId && isVisible(byId)) return byId;
        const q = document.querySelector('input#newBaggageLostBtn, button#newBaggageLostBtn, button[name*="newBaggage"], input[value*="新增"]');
        return q && isVisible(q) ? q : null;
    }


    function syncFabLabelFromDom() {
        const fab = document.getElementById(QUICK_FILL_FAB_ID);
        const addBtn = findNewBaggageLostButton();
        if (!fab || !addBtn) return;
        const t = String(addBtn.textContent || addBtn.value || '').trim();
        if (t) fab.textContent = t;
    }


    function getQuickInputs() {
        return {
            nmgn: document.getElementById('tmk-lostform-v2-qf-nmgn'),
            tn: document.getElementById('tmk-lostform-v2-qf-tn'),
            nw: document.getElementById('tmk-lostform-v2-qf-nw'),
            ct: document.getElementById('tmk-lostform-v2-qf-ct'),
            pa: document.getElementById('tmk-lostform-v2-qf-pa'),
            family: document.getElementById('tmk-lostform-v2-qf-family'),
            cp: document.getElementById('tmk-lostform-v2-qf-cp')
        };
    }


    function applyQuickFill() {
        const r = validateAndApplyQuick(false);
        return r;
    }


    function focusSelectQuickField(fieldKey) {
        const qi = getQuickInputs();
        const el = qi && fieldKey ? qi[fieldKey] : null;
        if (!el || typeof el.focus !== 'function') return;
        try {
            el.focus();
            if (typeof el.select === 'function') el.select();
        } catch (e) {}
    }


    function mapBaseValidationMessageToField(message) {
        const msg = String(message || '');
        if (!msg) return 'tn';
        if (msg.indexOf('颜色') >= 0 || msg.indexOf('CT') >= 0) return 'ct';
        if (msg.indexOf('行李牌') >= 0 || msg.indexOf('TN') >= 0) return 'tn';
        if (msg.indexOf('件数') >= 0 || msg.indexOf('NW') >= 0 || msg.indexOf('重量') >= 0) return 'nw';
        if (msg.indexOf('地址') >= 0 || msg.indexOf('PA') >= 0) return 'pa';
        if (msg.indexOf('家庭电话') >= 0 || msg.indexOf('PN') >= 0) return 'family';
        if (msg.indexOf('移动电话') >= 0 || msg.indexOf('CP') >= 0) return 'cp';
        if (msg.indexOf('姓名') >= 0 || msg.indexOf('NM') >= 0 || msg.indexOf('GN') >= 0) return 'nmgn';
        return 'tn';
    }


    // 复用基页“完成”按钮的校验逻辑：在快捷页点击预览时同步触发一次
    function runBaseFinishValidation() {
        const finish = document.getElementById('finish');
        if (!finish) return { ok: true };
        let capturedMsg = '';
        const rawAlert = window.alert;
        window.alert = function(msg) {
            capturedMsg = String(msg || '');
        };
        try {
            finish.click();
        } catch (e) {
            return { ok: true };
        } finally {
            window.alert = rawAlert;
        }
        if (!capturedMsg) return { ok: true };
        return { ok: false, message: capturedMsg, field: mapBaseValidationMessageToField(capturedMsg) };
    }


    function validateAndApplyQuick(clickAddAfter) {
        const cd = document;
        let refs = resolveFieldRefs(cd);
        const qi = getQuickInputs();
        const ctRaw = qi.ct ? qi.ct.value.trim().toUpperCase() : '';
        if (qi.ct && ctRaw !== qi.ct.value) qi.ct.value = ctRaw;
        const paRaw = qi.pa ? qi.pa.value.trim().toUpperCase() : '';
        if (qi.pa && paRaw !== qi.pa.value) qi.pa.value = paRaw;
        const familyRaw = qi.family ? qi.family.value.trim().toUpperCase() : '';
        if (qi.family && familyRaw !== qi.family.value) qi.family.value = familyRaw;
        let cpRaw = (qi.cp ? qi.cp.value : DEFAULT_CP) || DEFAULT_CP;
        cpRaw = String(cpRaw).trim().toUpperCase();
        if (qi.cp) qi.cp.value = cpRaw || DEFAULT_CP;
        let tnQuick = qi.tn ? qi.tn.value.trim().toUpperCase() : '';
        if (qi.tn && tnQuick !== qi.tn.value) qi.tn.value = tnQuick;
        let nmgnRaw = qi.nmgn ? qi.nmgn.value.trim().toUpperCase() : '';
        if (qi.nmgn && nmgnRaw !== qi.nmgn.value) qi.nmgn.value = nmgnRaw;
        const nwRaw = qi.nw ? sanitizeNwInput(qi.nw.value.trim()) : '';
        if (qi.nw && nwRaw !== qi.nw.value) qi.nw.value = nwRaw;
        let tnCount = getTnCount(cd, refs);
        if (tnQuick) {
            const tnSegs = tnQuick.split('/').map((s) => s.trim()).filter(Boolean);
            tnCount = tnSegs.length;
            // TN 段数优先驱动“少收件数”下拉，以便基页自动展开对应数量的 TN/CT 输入框
            if (tnCount > 0) {
                setBaggageSelectCount(cd, tnCount);
                refs = resolveFieldRefs(cd);
            }
            const maxSlot = getMaxTnSlots(cd, refs);
            if (tnSegs.length > maxSlot) {
                return { ok: false, message: '行李牌 TN 段数(' + tnSegs.length + ')超过可用档位数(' + maxSlot + ')。', field: 'tn' };
            }
            tnSegs.forEach(function(seg, idx) {
                if (refs.tnInputs[idx]) setInputValue(refs.tnInputs[idx], String(seg).toUpperCase());
            });
        }
        if (nmgnRaw) {
            applyNmgnStringToRefs(refs, nmgnRaw);
        }
        // 非 TN/CT 字段先镜像到基页，避免后续校验报错时被中断
        if (paRaw) {
            if (!refs.paInput) return { ok: false, message: '未找到 PA(永久地址) 输入框。', field: 'pa' };
            setInputValue(refs.paInput, paRaw);
        }
        if (familyRaw) {
            if (!refs.familyInput) return { ok: false, message: '未找到家庭电话输入框。', field: 'family' };
            setInputValue(refs.familyInput, familyRaw);
        }
        if (refs.cpInput) setInputValue(refs.cpInput, cpRaw.trim() || DEFAULT_CP);
        if (tnCount > 0 && !ctRaw) {
            return { ok: false, message: '请填写颜色类型 CT（段数须等于行李牌 TN 数量）。', field: 'ct' };
        }
        if (ctRaw) {
            if (!state.capsLockActive) return { ok: false, message: '请输入 CT 前请先开启 Caps Lock。', field: 'ct' };
            const ctSegments = splitCtValues(ctRaw);
            if (tnCount === 0) return { ok: false, message: '未识别到有效 TN 数量，无法校验 CT。', field: 'tn' };
            if (ctSegments.length !== tnCount) return { ok: false, message: '颜色类型 CT 段数(' + ctSegments.length + ')须等于行李牌 TN 数量(' + tnCount + ')。', field: 'ct' };
            if (refs.ctInputs.length < tnCount) {
                return { ok: false, message: 'CT 输入框数量不足，识别到 ' + refs.ctInputs.length + ' 个（需要 ' + tnCount + ' 个）。', field: 'ct' };
            }
            for (let i = 0; i < ctSegments.length; i += 1) {
                if (!CT_PATTERN.test(ctSegments[i])) return { ok: false, message: '第 ' + (i + 1) + ' 段 CT 格式错误：' + ctSegments[i], field: 'ct' };
            }
            ctSegments.forEach(function(segment, idx) {
                setInputValue(refs.ctInputs[idx], segment);
            });
        }
        if (nwRaw) {
            if (!refs.nwInput) return { ok: false, message: '未找到丢失件数/重量 NW 输入框。', field: 'nw' };
            const nwp = parseBwValue(nwRaw);
            if (!nwp) return { ok: false, message: 'NW 格式错误，应为 件数/重量。', field: 'nw' };
            const pieceCount = nwp.pieces;
            if (tnCount > 0 && pieceCount !== tnCount) {
                return { ok: false, message: 'NW 总件数(' + pieceCount + ')须等于行李牌 TN 数量(' + tnCount + ')。', field: 'nw' };
            }
            setInputValue(refs.nwInput, nwRaw);
        } else if (tnCount > 0 && refs.bwInput && refs.nwInput) {
            const bw = parseBwValue(refs.bwInput.value);
            if (bw) {
                const unitWeight = bw.weight / bw.pieces;
                const nwWeight = Math.floor(unitWeight * tnCount);
                setInputValue(refs.nwInput, tnCount + '/' + nwWeight);
            }
        }
        if (clickAddAfter) {
            const btn = findNewBaggageLostButton();
            if (!btn) return { ok: false, message: '未找到网页「新增」按钮。', field: 'tn' };
            try {
                btn.click();
            } catch (e) {
                return { ok: false, message: '无法触发新增按钮。', field: 'tn' };
            }
        }
        return { ok: true, message: '快捷填充完成。' };
    }


    function previewQuickFill() {
        runPreviewPipeline();
    }


    function runPreviewPipeline() {
        const r = validateAndApplyQuick(false);
        if (!r.ok) {
            focusSelectQuickField(r.field);
            window.alert(r.message);
        }
        else {
            const baseCheck = runBaseFinishValidation();
            if (!baseCheck.ok) {
                focusSelectQuickField(baseCheck.field);
                window.alert(baseCheck.message);
                return;
            }
            state.mainStep = 2;
            syncRadiosFromState();
            applyPaneVisibility();
        }
    }


    function runFabSubmit() {
        const r = validateAndApplyQuick(true);
        if (!r.ok) {
            focusSelectQuickField(r.field);
            window.alert(r.message);
        }
    }


    function syncQuickFromDetail() {
        if (!state.quickReady || state.mode !== 'modern' || state.mainStep !== 1) return;
        const refs = resolveFieldRefs(document);
        const qi = getQuickInputs();
        const nmgnFromRefs = buildNmGnDisplayFromRefs(refs);
        const tnFromRefs = buildTnStringFromRefs(refs);
        // 仅在基页有有效值时回填，避免失焦后把快捷区已有内容清空或污染
        if (qi.nmgn && !qi.nmgn.matches(':focus') && nmgnFromRefs) qi.nmgn.value = nmgnFromRefs;
        if (qi.tn && !qi.tn.matches(':focus') && tnFromRefs) qi.tn.value = tnFromRefs;
        if (qi.nw && !qi.nw.matches(':focus') && refs.bwInput && refs.bwInput.value) {
            const bw = parseBwValue(refs.bwInput.value);
            if (bw && !qi.nw.value.trim()) qi.nw.value = String(refs.bwInput.value).trim();
        }
    }


    function tryMarkQuickReady() {
        if (state.quickReady) return;
        if (!isQuickDetailReady()) return;
        state.quickReady = true;
        const quick = document.getElementById('tmk-lostform-v2-quick');
        if (quick) quick.classList.remove('tmk-lostform-v2-quick--pending');
        syncQuickFromDetail();
        syncFabLabelFromDom();
        applyNormalizedQuickLabels();
        normalizeQuickTextboxWidths();
        applyPaneVisibility();
        startDetailSync();
    }


    function startDetailSync() {
        if (state.detailSyncTimer) return;
        state.detailSyncTimer = window.setInterval(function() {
            if (state.mode !== 'modern' || state.mainStep !== 1) return;
            syncQuickFromDetail();
        }, 1200);
    }


    // 毛玻璃层在底层；壳与当前可见的 #content_* 用更高 z-index 叠在玻璃之上，避免表单被 backdrop-filter 糊住。
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const z = getV2ZLayers();
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            'html.' + MODE_CLASS + ',',
            'html.' + MODE_CLASS + ' body {',
            '  background: transparent !important;',
            '  color: var(--tmk-c-major-font) !important;',
            '  font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif !important;',
            '}',
            'html.' + MODE_CLASS + ' .l_mainContentL1,',
            'html.' + MODE_CLASS + ' #content_1,',
            'html.' + MODE_CLASS + ' .l_mainContent,',
            'html.' + MODE_CLASS + ' .ui-page,',
            'html.' + MODE_CLASS + ' .ui-content {',
            '  background: transparent !important;',
            '}',
            'html.' + MODE_CLASS + ' #l_body {',
            '  padding-top: var(--tmk-lostform-v2-body-pad, 120px);',
            '  padding-bottom: var(--tmk-lostform-v2-body-pad-bottom, 8px);',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' .l_header { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + GLASS_ID + ' { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + SHELL_ID + ' { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + SHELL_ID + '.tmk-lostform-v2-shell--quick { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + '.tmk-lostform-v2-stage--on { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + STEPPER_BAR_ID + ' { display: block !important; }',
            'html.' + MODE_CLASS + ' #float-action-box { display: none !important; }',
            '#' + GLASS_ID + ' {',
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: ' + z.backgroundCover + ';',
            '  display: none;',
            '  background: color-mix(in srgb, var(--tmk-c-minor-button) 55%, transparent);',
            '  backdrop-filter: blur(10px);',
            '  -webkit-backdrop-filter: blur(10px);',
            '  pointer-events: none;',
            '}',
            '#' + TOOLBAR_ID + ' {',
            '  position: fixed;',
            '  top: 10px;',
            '  right: 12px;',
            '  z-index: ' + z.floatingButton + ';',
            '  display: inline-flex;',
            '  align-items: center;',
            '  gap: 4px;',
            '  padding: 4px 6px;',
            '  border-radius: 999px;',
            '  background: var(--tmk-c-search-bg, var(--tmk-c-major-button));',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  box-shadow: none;',
            '  backdrop-filter: blur(8px);',
            '  -webkit-backdrop-filter: blur(8px);',
            '}',
            '.tmk-lostform-v2-tb-btn {',
            '  min-height: 32px;',
            '  padding: 0 14px;',
            '  border-radius: 999px;',
            '  border: 1px solid transparent;',
            '  background: transparent;',
            '  color: var(--tmk-c-search-input-fg, var(--tmk-c-major-font));',
            '  font-size: 14px;',
            '  font-weight: 600;',
            '  cursor: pointer;',
            '  font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;',
            '  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;',
            '}',
            '.tmk-lostform-v2-tb-btn:hover {',
            '  border-color: var(--tmk-c-search-active-border, var(--tmk-c-search-input-border));',
            '}',
            '.tmk-lostform-v2-tb-btn.tmk-active {',
            '  background: var(--tmk-c-major-focus);',
            '  border-color: var(--tmk-c-major-focus);',
            '  color: var(--tmk-c-lv1-fg);',
            '}',
            '#' + STEPPER_BAR_ID + ' {',
            '  display: none;',
            '  position: fixed;',
            '  left: var(--tmk-left-gap, 16px);',
            '  right: var(--tmk-lostform-v2-shell-right, 24px);',
            '  top: 72px;',
            '  bottom: auto;',
            '  z-index: ' + z.floatingButton + ';',
            '  padding: 6px 12px 8px;',
            '  box-sizing: border-box;',
            '  background: transparent;',
            '  border: none;',
            '  box-shadow: none;',
            '  pointer-events: auto;',
            '}',
            '#' + STEPPER_BAR_ID + ' .tmk-lostform-v2-stepper {',
            '  margin-top: 0;',
            '  margin-bottom: 0;',
            '}',
            '#' + SHELL_ID + ',',
            '#' + STAGE_ID + ' {',
            '  display: none;',
            '  position: fixed;',
            '  top: calc(72px + var(--tmk-lostform-v2-stepper-h, 56px));',
            '  bottom: 12px;',
            '  left: var(--tmk-left-gap, 16px);',
            '  z-index: ' + z.mainFunctionView + ';',
            '  width: calc(100vw - var(--tmk-left-gap, 16px) - var(--tmk-lostform-v2-shell-right, 24px));',
            '  max-width: calc(100vw - var(--tmk-left-gap, 16px) - var(--tmk-lostform-v2-shell-right, 24px));',
            '  max-height: none;',
            '  overflow-x: hidden;',
            '  overflow-y: auto;',
            '  box-sizing: border-box;',
            '  padding: var(--tmk-lostform-v2-shell-pad-top, 10px) var(--tmk-lostform-v2-shell-pad-x, 12px) calc(var(--tmk-lostform-v2-shell-pad-bot, 14px) + var(--tmk-medium, 92px) * 0.382 + 18px) var(--tmk-lostform-v2-shell-pad-x, 12px);',
            '  background: color-mix(in srgb, var(--tmk-c-major-button) 40%, transparent);',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 12px;',
            '  backdrop-filter: blur(10px);',
            '  -webkit-backdrop-filter: blur(10px);',
            '  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);',
            '  pointer-events: auto;',
            '  color: var(--tmk-c-major-font);',
            '}',
            '.tmk-lostform-v2-stepper {',
            '  display: flex;',
            '  align-items: center;',
            '  flex-wrap: nowrap;',
            '  gap: 0;',
            '  margin-bottom: 10px;',
            '}',
            '.tmk-lostform-v2-step-node {',
            '  position: relative;',
            '  display: flex;',
            '  align-items: center;',
            '  flex: 0 0 auto;',
            '  min-width: 0;',
            '}',
            '.tmk-lostform-v2-step-node input[type="radio"] {',
            '  position: absolute;',
            '  opacity: 0;',
            '  width: 0;',
            '  height: 0;',
            '  pointer-events: none;',
            '}',
            '.tmk-lostform-v2-step-visual {',
            '  display: flex;',
            '  align-items: center;',
            '  min-width: 0;',
            '  cursor: pointer;',
            '}',
            '.tmk-lostform-v2-step-ring {',
            '  width: 18px;',
            '  height: 18px;',
            '  border-radius: 0;',
            '  border: 2px solid var(--tmk-c-major-focus);',
            '  background: var(--tmk-c-input-background);',
            '  box-sizing: border-box;',
            '  flex-shrink: 0;',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  position: relative;',
            '}',
            '.tmk-lostform-v2-step-node input:checked + label .tmk-lostform-v2-step-ring::after {',
            '  content: "";',
            '  width: 10px;',
            '  height: 10px;',
            '  border-radius: 0;',
            '  background: var(--tmk-c-major-focus);',
            '  display: block;',
            '}',
            '.tmk-lostform-v2-step-connector {',
            '  flex: 1 1 12px;',
            '  height: 2px;',
            '  background: var(--tmk-c-major-focus);',
            '  margin: 0 4px;',
            '  min-width: 8px;',
            '  opacity: 0.85;',
            '  align-self: center;',
            '}',
            '.tmk-lostform-v2-step-text {',
            '  margin-left: 6px;',
            '  font-size: 13px;',
            '  color: var(--tmk-c-major-font);',
            '  white-space: nowrap;',
            '  overflow: hidden;',
            '  text-overflow: ellipsis;',
            '}',
            '.tmk-lostform-v2-step-node input:focus + label .tmk-lostform-v2-step-ring {',
            '  outline: 2px solid var(--tmk-c-major-focus);',
            '  outline-offset: 2px;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-panel {',
            '  margin: 12px var(--tmk-lostform-v2-c1-panel-mx, 15px);',
            '  width: calc(100% - 2 * var(--tmk-lostform-v2-c1-panel-mx, 15px));',
            '  max-width: none;',
            '  box-sizing: border-box;',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 10px;',
            '  overflow: hidden;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-toggle {',
            '  display: block;',
            '  width: 100%;',
            '  min-height: 66px;',
            '  text-align: left;',
            '  border: 0;',
            '  border-bottom: 2px solid var(--tmk-c-search-input-border);',
            '  background: var(--tmk-c-major-button);',
            '  font-size: 20px;',
            '  font-weight: 600;',
            '  padding: 10px 2px;',
            '  cursor: pointer;',
            '  box-sizing: border-box;',
            '  color: var(--tmk-c-major-font);',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body {',
            '  padding: 12px 0;',
            '  border-top: 1px solid var(--tmk-c-search-input-border);',
            '  overflow-x: hidden;',
            '  max-width: 100%;',
            '  min-width: 0;',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' #content_1:not(.tmk-lostform-v2-pane-hidden) {',
            '  overflow-x: hidden;',
            '  max-width: 100%;',
            '  min-width: 0;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-panel.is-collapsed .tmk-lostform-v2-fs-body {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-panel .tmk-lostform-v2-fs-body > fieldset {',
            '  margin: 0 !important;',
            '  border: none !important;',
            '  padding: 0 !important;',
            '  min-width: 0 !important;',
            '  max-width: 100% !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-panel .tmk-lostform-v2-fs-body > fieldset > legend {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-c1-hide {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .ui-grid-b.l_low {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-c.l_row,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-b.l_row,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-d.l_row {',
            '  display: grid !important;',
            '  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;',
            '  align-items: start !important;',
            '  gap: var(--tmk-gap, 10px) !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-c.l_row > [class*="ui-block-"],',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-b.l_row > [class*="ui-block-"],',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-d.l_row > [class*="ui-block-"] {',
            '  width: 100% !important;',
            '  min-width: 0 !important;',
            '  max-width: 100% !important;',
            '  float: none !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body [class*="ui-block-"] {',
            '  float: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-a {',
            '  display: grid !important;',
            '  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;',
            '  align-items: start !important;',
            '  column-gap: 0 !important;',
            '  row-gap: 8px !important;',
            '  width: min(100%, 720px) !important;',
            '  max-width: 720px !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-a > [class*="ui-block-"] {',
            '  width: 100% !important;',
            '  max-width: 360px !important;',
            '  min-width: 0 !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .l_right {',
            '  text-align: left !important;',
            '  font-size: 18px !important;',
            '  color: var(--tmk-c-major-font) !important;',
            '  line-height: 1.35 !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .l_right .l_notNull {',
            '  font-size: 18px !important;',
            '  color: var(--tmk-c-major-focus) !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .l_wtCode {',
            '  font-size: 15px !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .l_left {',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  min-width: 0 !important;',
            '  float: none !important;',
            '  clear: both !important;',
            '  display: block !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .ui-block-c > .ui-grid-b,',
            'html.' + MODE_CLASS + ' #content_2 .ui-block-c > .ui-grid-b,',
            'html.' + MODE_CLASS + ' #content_3 .ui-block-c > .ui-grid-b,',
            'html.' + MODE_CLASS + ' #content_4 .ui-block-c > .ui-grid-b,',
            'html.' + MODE_CLASS + ' #content_5 .ui-block-c > .ui-grid-b,',
            'html.' + MODE_CLASS + ' #content_6 .ui-block-c > .ui-grid-b,',
            'html.' + MODE_CLASS + ' #content_7 .ui-block-c > .ui-grid-b {',
            '  display: flex !important;',
            '  flex-direction: row !important;',
            '  flex-wrap: nowrap !important;',
            '  align-items: flex-start !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  min-width: 0 !important;',
            '  box-sizing: border-box !important;',
            '  float: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .ui-block-c > .ui-grid-b > .ui-block-a,',
            'html.' + MODE_CLASS + ' #content_2 .ui-block-c > .ui-grid-b > .ui-block-a,',
            'html.' + MODE_CLASS + ' #content_3 .ui-block-c > .ui-grid-b > .ui-block-a,',
            'html.' + MODE_CLASS + ' #content_4 .ui-block-c > .ui-grid-b > .ui-block-a,',
            'html.' + MODE_CLASS + ' #content_5 .ui-block-c > .ui-grid-b > .ui-block-a,',
            'html.' + MODE_CLASS + ' #content_6 .ui-block-c > .ui-grid-b > .ui-block-a,',
            'html.' + MODE_CLASS + ' #content_7 .ui-block-c > .ui-grid-b > .ui-block-a {',
            '  flex: 6 1 0% !important;',
            '  min-width: 0 !important;',
            '  max-width: 100% !important;',
            '  width: auto !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .ui-block-c > .ui-grid-b > .ui-block-b,',
            'html.' + MODE_CLASS + ' #content_2 .ui-block-c > .ui-grid-b > .ui-block-b,',
            'html.' + MODE_CLASS + ' #content_3 .ui-block-c > .ui-grid-b > .ui-block-b,',
            'html.' + MODE_CLASS + ' #content_4 .ui-block-c > .ui-grid-b > .ui-block-b,',
            'html.' + MODE_CLASS + ' #content_5 .ui-block-c > .ui-grid-b > .ui-block-b,',
            'html.' + MODE_CLASS + ' #content_6 .ui-block-c > .ui-grid-b > .ui-block-b,',
            'html.' + MODE_CLASS + ' #content_7 .ui-block-c > .ui-grid-b > .ui-block-b {',
            '  flex: 4 1 0% !important;',
            '  min-width: 0 !important;',
            '  max-width: 100% !important;',
            '  width: auto !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .ui-block-c > .ui-grid-b > .ui-block-c,',
            'html.' + MODE_CLASS + ' #content_2 .ui-block-c > .ui-grid-b > .ui-block-c,',
            'html.' + MODE_CLASS + ' #content_3 .ui-block-c > .ui-grid-b > .ui-block-c,',
            'html.' + MODE_CLASS + ' #content_4 .ui-block-c > .ui-grid-b > .ui-block-c,',
            'html.' + MODE_CLASS + ' #content_5 .ui-block-c > .ui-grid-b > .ui-block-c,',
            'html.' + MODE_CLASS + ' #content_6 .ui-block-c > .ui-grid-b > .ui-block-c,',
            'html.' + MODE_CLASS + ' #content_7 .ui-block-c > .ui-grid-b > .ui-block-c {',
            '  flex: 2 1 0% !important;',
            '  min-width: 0 !important;',
            '  max-width: 100% !important;',
            '  width: auto !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body input:not([type]),',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body select,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body textarea {',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  min-width: 0 !important;',
            '  min-height: 42px !important;',
            '  height: auto !important;',
            '  padding: 6px 2px !important;',
            '  border: 0 !important;',
            '  border-bottom: 2px solid var(--tmk-c-search-input-border) !important;',
            '  border-radius: 0 !important;',
            '  background: transparent !important;',
            '  background-clip: padding-box !important;',
            '  color: var(--tmk-c-major-font) !important;',
            '  font-size: 20px !important;',
            '  line-height: 1.35 !important;',
            '  box-sizing: border-box !important;',
            '  box-shadow: none !important;',
            '  outline: none !important;',
            '  margin: 0 !important;',
            '  float: none !important;',
            '  -webkit-appearance: none;',
            '  appearance: none;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body input::placeholder,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body textarea::placeholder {',
            '  color: color-mix(in srgb, var(--tmk-c-minor-focus) 50%, transparent) !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body select {',
            '  -webkit-appearance: menulist;',
            '  appearance: auto;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body textarea {',
            '  min-height: 84px !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body input:not([type="checkbox"]):not([type="radio"]):focus,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body select:focus,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body textarea:focus {',
            '  border-bottom-color: var(--tmk-c-major-focus) !important;',
            '  box-shadow: none !important;',
            '  outline: none !important;',
            '}',
            '#tmk-lostform-v2-quick { margin-top: 4px; color: var(--tmk-c-major-font); position: relative; }',
            '.tmk-lostform-v2-qf-loading { display: none; margin: 0 0 10px 0; font-size: 15px; color: var(--tmk-c-major-font); opacity: 0.75; }',
            '#tmk-lostform-v2-quick.tmk-lostform-v2-quick--pending .tmk-lostform-v2-qf-loading { display: block; }',
            '#tmk-lostform-v2-quick.tmk-lostform-v2-quick--pending .tmk-lostform-v2-qf-grid { opacity: 0.45; pointer-events: none; }',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-title {',
            '  font-size: 34px;',
            '  font-weight: 700;',
            '  color: var(--tmk-c-major-font);',
            '  margin: 0 0 18px 0;',
            '}',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-grid {',
            '  display: grid;',
            '  grid-template-columns: repeat(var(--tmk-qf-cols, 1), minmax(0, 1fr));',
            '  gap: calc(var(--tmk-gap, 10px) * 1.2);',
            '  align-items: start;',
            '  width: 100%;',
            '  box-sizing: border-box;',
            '}',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-field {',
            '  display: flex;',
            '  flex-direction: row;',
            '  align-items: center;',
            '  gap: 10px;',
            '  min-width: 0;',
            '  max-width: none;',
            '  width: 100%;',
            '  box-sizing: border-box;',
            '}',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-field .tmk-lostform-v2-qf-label {',
            '  margin-top: 0;',
            '}',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-label {',
            '  font-size: 18px;',
            '  color: var(--tmk-c-major-font);',
            '  display: block;',
            '  flex: 0 0 auto;',
            '  max-width: none;',
            '  white-space: normal;',
            '  overflow: visible;',
            '  text-overflow: clip;',
            '  line-height: 1.3;',
            '}',
            '#tmk-lostform-v2-quick input {',
            '  flex: 1 1 auto;',
            '  min-width: 0;',
            '  min-height: 42px;',
            '  padding: 6px 2px;',
            '  border: 0;',
            '  border-bottom: 2px solid var(--tmk-c-search-input-border);',
            '  border-radius: 0;',
            '  background: transparent;',
            '  color: var(--tmk-c-major-font);',
            '  box-sizing: border-box;',
            '  font-size: 20px;',
            '}',
            '#tmk-lostform-v2-quick input::placeholder {',
            '  color: color-mix(in srgb, var(--tmk-c-minor-focus) 50%, transparent) !important;',
            '}',
            '#tmk-lostform-v2-quick input:focus {',
            '  border-bottom-color: var(--tmk-c-major-focus);',
            '  outline: none;',
            '  box-shadow: none;',
            '}',
            '#' + PREVIEW_SLOT_ID + ' {',
            '  display: none;',
            '  margin-top: 6px;',
            '  width: 100%;',
            '  max-width: none;',
            '  margin-left: 0;',
            '}',
            '#' + ACTION_BAR_ID + ' {',
            '  display: none;',
            '  margin-top: 4px;',
            '  width: 100%;',
            '  max-width: none;',
            '  margin-left: 0;',
            '  grid-column: 1 / -1;',
            '  gap: 4px;',
            '  align-items: stretch;',
            '}',
            '#' + PREVIEW_SLOT_ID + '.tmk-lostform-v2-qf-preview--on {',
            '  display: block;',
            '}',
            '#' + ACTION_BAR_ID + '.tmk-lostform-v2-qf-action-bar--on {',
            '  display: flex;',
            '}',
            '.tmk-lostform-v2-qf-action {',
            '  position: static;',
            '  z-index: ' + z.functionButton + ';',
            '  width: 100%;',
            '  min-width: 0;',
            '  height: calc(var(--tmk-medium, 92px) * 0.382);',
            '  padding: 0 10px;',
            '  border-radius: 12px;',
            '  border: 1px solid var(--tmk-c-major-focus);',
            '  background: var(--tmk-c-major-button);',
            '  color: var(--tmk-c-major-font);',
            '  font-size: 20px;',
            '  font-weight: 700;',
            '  cursor: pointer;',
            '  opacity: 0.4;',
            '  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.06);',
            '  transition: opacity 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;',
            '  display: none;',
            '  align-items: center;',
            '  justify-content: center;',
            '  line-height: 1.1;',
            '  text-align: center;',
            '  font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;',
            '  box-sizing: border-box;',
            '}',
            '#' + QUICK_FILL_FAB_ID + ' {',
            '  position: static !important;',
            '  flex: 1 1 0;',
            '  min-width: 0;',
            '  border: none;',
            '  background: var(--tmk-c-major-focus);',
            '  color: var(--tmk-c-lv1-fg);',
            '  opacity: 1;',
            '  box-shadow: none;',
            '}',
            '#' + PREVIEW_BTN_ID + '.tmk-lostform-v2-qf-preview-btn {',
            '  position: static !important;',
            '  width: 100%;',
            '  flex: 1 1 0;',
            '  min-width: 0;',
            '  height: calc(var(--tmk-medium, 92px) * 0.382);',
            '  padding: 0 14px;',
            '  border: 1px solid var(--tmk-c-major-focus);',
            '  background: var(--tmk-c-major-button);',
            '  color: var(--tmk-c-major-font);',
            '  opacity: 0.4;',
            '  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.06);',
            '  z-index: ' + z.functionButton + ';',
            '}',
            '#' + QUICK_FILL_FAB_ID + ':hover,',
            '#' + QUICK_FILL_FAB_ID + ':focus-visible,',
            '#' + PREVIEW_BTN_ID + ':hover,',
            '#' + PREVIEW_BTN_ID + ':focus-visible {',
            '  opacity: 1;',
            '  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);',
            '  outline: none;',
            '}',
            '#' + DETAIL_QUICK_FILL_FAB_ID + ' {',
            '  position: absolute !important;',
            '  right: 12px;',
            '  top: 12px;',
            '  z-index: ' + z.functionButton + ';',
            '  width: var(--tmk-medium, 92px);',
            '  min-width: var(--tmk-medium, 92px);',
            '  height: calc(var(--tmk-medium, 92px) * 0.382);',
            '  border: none;',
            '  background: var(--tmk-c-major-focus);',
            '  color: var(--tmk-c-lv1-fg);',
            '  font-size: 20px;',
            '  font-weight: 700;',
            '  opacity: 0.5;',
            '  transition: opacity 0.2s ease, box-shadow 0.2s ease;',
            '  box-shadow: none;',
            '  display: none;',
            '}',
            '#' + DETAIL_QUICK_FILL_FAB_ID + ':hover,',
            '#' + DETAIL_QUICK_FILL_FAB_ID + ':focus-visible {',
            '  opacity: 1;',
            '  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);',
            '  outline: none;',
            '}',
            'html.' + MODE_CLASS + ' .tmk-lostform-v2-qf-fab--on {',
            '  display: inline-flex !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + PREVIEW_BTN_ID + '.tmk-lostform-v2-qf-preview--on {',
            '  display: inline-flex !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + DETAIL_QUICK_FILL_FAB_ID + '.tmk-lostform-v2-qf-fab-detail--on {',
            '  display: inline-flex !important;',
            '}',
            'html.' + MODE_CLASS + '.tmk-lostform-v2-hide-native-nav #clear,',
            'html.' + MODE_CLASS + '.tmk-lostform-v2-hide-native-nav #pre,',
            'html.' + MODE_CLASS + '.tmk-lostform-v2-hide-native-nav #next {',
            '  display: none !important;',
            '}',
            '#tmk-lostform-v2-qf-hint {',
            '  font-size: 17px;',
            '  color: var(--tmk-c-minor-button);',
            '  margin-top: 9px;',
            '  line-height: 1.35;',
            '}',
            '#tmk-lostform-v2-sub36 {',
            '  display: none;',
            '  margin-top: 8px;',
            '  flex-wrap: wrap;',
            '  gap: 6px;',
            '}',
            '#tmk-lostform-v2-sub36.tmk-lostform-v2-sub--on { display: flex !important; }',
            '.tmk-lostform-v2-sub-btn {',
            '  padding: 4px 8px;',
            '  font-size: 12px;',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 0;',
            '  background: var(--tmk-c-input-background);',
            '  color: var(--tmk-c-major-font);',
            '  cursor: pointer;',
            '}',
            '.tmk-lostform-v2-sub-btn.is-active {',
            '  background: var(--tmk-c-major-focus);',
            '  border-color: var(--tmk-c-major-focus);',
            '  color: var(--tmk-c-lv1-fg);',
            '}',
            'html.' + MODE_CLASS + ' .tmk-lostform-v2-pane-hidden { display: none !important; }',
            'html.' + MODE_CLASS + ' #content_1,',
            'html.' + MODE_CLASS + ' #content_2,',
            'html.' + MODE_CLASS + ' #content_3,',
            'html.' + MODE_CLASS + ' #content_4,',
            'html.' + MODE_CLASS + ' #content_5,',
            'html.' + MODE_CLASS + ' #content_6,',
            'html.' + MODE_CLASS + ' #content_7 {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' {',
            '  display: none;',
            '  width: 100%;',
            '  max-width: 100%;',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '.tmk-lostform-v2-mirror-page--on {',
            '  display: block;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .l_mainContentL1,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .l_mainContent,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .ui-page,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .ui-content {',
            '  background: transparent !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-panel {',
            '  margin: 12px var(--tmk-lostform-v2-c1-panel-mx, 15px);',
            '  width: calc(100% - 2 * var(--tmk-lostform-v2-c1-panel-mx, 15px));',
            '  max-width: none;',
            '  box-sizing: border-box;',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 10px;',
            '  overflow: hidden;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-toggle {',
            '  display: block;',
            '  width: 100%;',
            '  min-height: 66px;',
            '  text-align: left;',
            '  border: 0;',
            '  border-bottom: 2px solid var(--tmk-c-search-input-border);',
            '  background: var(--tmk-c-major-button);',
            '  font-size: 20px;',
            '  font-weight: 600;',
            '  padding: 10px 2px;',
            '  cursor: pointer;',
            '  box-sizing: border-box;',
            '  color: var(--tmk-c-major-font);',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body {',
            '  padding: 12px 0;',
            '  border-top: 1px solid var(--tmk-c-search-input-border);',
            '  overflow-x: hidden;',
            '  max-width: 100%;',
            '  min-width: 0;',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-panel.is-collapsed .tmk-lostform-v2-fs-body {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body > fieldset > legend {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-c1-hide,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .ui-grid-b.l_low {',
            '  display: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body .ui-grid-a {',
            '  display: grid !important;',
            '  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;',
            '  align-items: start !important;',
            '  column-gap: 0 !important;',
            '  row-gap: 8px !important;',
            '  width: min(100%, 720px) !important;',
            '  max-width: 720px !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body .ui-grid-a > [class*="ui-block-"] {',
            '  width: 100% !important;',
            '  max-width: 360px !important;',
            '  min-width: 0 !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .ui-block-c > .ui-grid-b {',
            '  display: grid !important;',
            '  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;',
            '  align-items: start !important;',
            '  column-gap: 0 !important;',
            '  row-gap: 8px !important;',
            '  width: min(100%, 720px) !important;',
            '  max-width: 720px !important;',
            '  min-width: 0 !important;',
            '  box-sizing: border-box !important;',
            '  float: none !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .ui-block-c > .ui-grid-b > [class*="ui-block-"] {',
            '  width: 100% !important;',
            '  max-width: 360px !important;',
            '  min-width: 0 !important;',
            '  float: none !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body input:not([type]),',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body select,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '[data-tmk-mirror-page="1"] .tmk-lostform-v2-fs-body textarea {',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  min-width: 0 !important;',
            '  min-height: 42px !important;',
            '  border: 0 !important;',
            '  border-bottom: 2px solid var(--tmk-c-search-input-border) !important;',
            '  border-radius: 0 !important;',
            '  background: transparent !important;',
            '  color: var(--tmk-c-major-font) !important;',
            '  font-size: 20px !important;',
            '  line-height: 1.35 !important;',
            '  box-sizing: border-box !important;',
            '  box-shadow: none !important;',
            '  outline: none !important;',
            '}',
            'html.' + MODE_CLASS + ' .l_footer {',
            '  position: relative;',
            '  z-index: ' + z.basePage + ';',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }


    function ensureGlass() {
        if (!document.body) return;
        let el = document.getElementById(GLASS_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = GLASS_ID;
            document.body.appendChild(el);
        }
        state.glass = el;
    }


    function renderToolbar() {
        if (!document.body || document.getElementById(TOOLBAR_ID)) return;
        const bar = document.createElement('div');
        bar.id = TOOLBAR_ID;
        bar.innerHTML =
            '<button type="button" class="tmk-lostform-v2-tb-btn tmk-active" data-tmk-mode="modern">我的视图</button>' +
            '<button type="button" class="tmk-lostform-v2-tb-btn" data-tmk-mode="legacy">原版页面</button>';
        document.body.appendChild(bar);
        bar.addEventListener('click', function(ev) {
            const t = ev.target;
            if (!t || !t.getAttribute) return;
            const m = t.getAttribute('data-tmk-mode');
            if (!m) return;
            setMode(m);
        });
    }


    function updateToolbarButtons() {
        const bar = document.getElementById(TOOLBAR_ID);
        if (!bar) return;
        bar.querySelectorAll('.tmk-lostform-v2-tb-btn').forEach(function(btn) {
            btn.classList.toggle('tmk-active', btn.getAttribute('data-tmk-mode') === state.mode);
        });
    }


    function buildStepperHtml() {
        const steps = [
            { id: 'tmk-lostform-v2-s1', value: '1', label: '快捷' },
            { id: 'tmk-lostform-v2-s2', value: '2', label: '详细' },
            { id: 'tmk-lostform-v2-s3', value: '3', label: '信息' },
            { id: 'tmk-lostform-v2-s4', value: '4', label: '追踪' }
        ];
        const parts = [];
        parts.push('<div class="tmk-lostform-v2-stepper" role="radiogroup" aria-label="步骤">');
        steps.forEach(function(s, idx) {
            parts.push(
                '<div class="tmk-lostform-v2-step-node">' +
                '<input type="radio" name="tmk-lostform-v2-step" id="' + s.id + '" value="' + s.value + '"' + (s.value === '1' ? ' checked' : '') + ' />' +
                '<label for="' + s.id + '" class="tmk-lostform-v2-step-visual">' +
                '<span class="tmk-lostform-v2-step-ring"></span>' +
                '<span class="tmk-lostform-v2-step-text">' + s.label + '</span>' +
                '</label>' +
                '</div>'
            );
            if (idx < steps.length - 1) {
                parts.push('<span class="tmk-lostform-v2-step-connector" aria-hidden="true"></span>');
            }
        });
        parts.push('</div>');
        return parts.join('');
    }


    function buildQuickHtml() {
        return (
            '<div id="tmk-lostform-v2-quick" class="tmk-lostform-v2-quick--pending">' +
            '<p id="tmk-lostform-v2-qf-loading" class="tmk-lostform-v2-qf-loading">正在等待详细页字段加载...</p>' +
            '<p class="tmk-lostform-v2-qf-title">完成前快捷填充</p>' +
            '<div class="tmk-lostform-v2-qf-grid">' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-nmgn" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-nmgn">NMs/GNs</label>' +
            '<input id="tmk-lostform-v2-qf-nmgn" type="text" placeholder="LIU/GOSTNORT/LIANG/GORDON" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-tn" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-tn">TNs</label>' +
            '<input id="tmk-lostform-v2-qf-tn" type="text" placeholder="CA654321/CA123456" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-ct" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-ct">CTs</label>' +
            '<input id="tmk-lostform-v2-qf-ct" type="text" placeholder="BK22RHW/RD01XXX" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-nw" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-nw">NW</label>' +
            '<input id="tmk-lostform-v2-qf-nw" type="text" inputmode="numeric" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-pa" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-pa">PA</label>' +
            '<input id="tmk-lostform-v2-qf-pa" type="text" placeholder="123 MAIN ST, LA, CA 90001" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-family" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-family">PN</label>' +
            '<input id="tmk-lostform-v2-qf-family" type="text" placeholder="数字" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label id="tmk-lostform-v2-qf-label-cp" class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-cp">CP</label>' +
            '<input id="tmk-lostform-v2-qf-cp" type="text" value="' + DEFAULT_CP + '" autocomplete="off" />' +
            '</div>' +
            '<div id="' + PREVIEW_SLOT_ID + '"></div>' +
            '<div id="' + ACTION_BAR_ID + '"></div>' +
            '</div>' +
            '<div id="tmk-lostform-v2-qf-hint">颜色类型 CT 段数须等于行李牌 TN 数量；NW 总件数须等于 TN 数量。CP 下方「预览」校验并写入后进入「详细」；右侧浮动钮与网页「新增」一致，校验写入后触发新增。</div>' +
            '</div>' +
            '<div id="tmk-lostform-v2-sub36" aria-label="子区块"></div>'
        );
    }


    function syncMainContentActive(activeId) {
        const ids = ['content_1', 'content_2', 'content_3', 'content_4', 'content_5', 'content_6', 'content_7'];
        ids.forEach(function(id) {
            const el = document.getElementById(id);
            if (!el) return;
            if (activeId && id === activeId) {
                el.classList.add('l_active');
            } else {
                el.classList.remove('l_active');
            }
        });
    }


    // 对齐少收表 v1：面板 + 全宽折叠条包 fieldset；首块默认展开，折叠条加宽加高
    function setupCollapsibleFieldsetsV2() {
        const c1 = document.getElementById('content_1');
        if (!c1) return;
        const fieldsets = Array.from(c1.querySelectorAll('fieldset')).slice(0, 5);
        fieldsets.forEach(function(fs, idx) {
            if (!fs || fs.getAttribute('data-tmk-fs-v2-wrapped') === '1') return;
            const legend = fs.querySelector('legend');
            const title = legend ? String(legend.textContent || '').replace(/\s+/g, ' ').trim() : '';
            const panel = document.createElement('div');
            panel.className = 'tmk-lostform-v2-fs-panel' + (idx === 0 ? '' : ' is-collapsed');
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'tmk-lostform-v2-fs-toggle';
            toggle.textContent = (title || '分组' + (idx + 1)) + '  ▾';
            const body = document.createElement('div');
            body.className = 'tmk-lostform-v2-fs-body';
            fs.parentNode.insertBefore(panel, fs);
            panel.appendChild(toggle);
            panel.appendChild(body);
            body.appendChild(fs);
            fs.setAttribute('data-tmk-fs-v2-wrapped', '1');
            toggle.addEventListener('click', function() {
                const wasCollapsed = panel.classList.contains('is-collapsed');
                const panels = c1.querySelectorAll('.tmk-lostform-v2-fs-panel');
                panels.forEach(function(p) {
                    p.classList.add('is-collapsed');
                });
                if (wasCollapsed) panel.classList.remove('is-collapsed');
            });
        });
        state.content1FsBound = true;
    }


    function teardownContent1Collapsible() {
        const c1 = document.getElementById('content_1');
        if (!c1) return;
        Array.from(c1.querySelectorAll('.tmk-lostform-v2-fs-panel')).forEach(function(panel) {
            const body = panel.querySelector('.tmk-lostform-v2-fs-body');
            const fs = body ? body.querySelector('fieldset') : null;
            if (fs && panel.parentNode) {
                panel.parentNode.insertBefore(fs, panel);
            }
            panel.remove();
        });
        c1.querySelectorAll('fieldset[data-tmk-fs-v2-wrapped="1"]').forEach(function(fs) {
            fs.removeAttribute('data-tmk-fs-v2-wrapped');
        });
        state.content1FsBound = false;
    }


    // 详细页顶行（受理航站/卷宗/日期等）在「我的视图」下隐藏；原版恢复显示
    function markContent1HeaderRowHidden() {
        const c1 = document.getElementById('content_1');
        if (!c1 || c1.getAttribute('data-tmk-c1-header-v2') === '1') return;
        const childs = Array.from(c1.children);
        for (let i = 0; i < childs.length; i += 1) {
            const el = childs[i];
            if (el.classList && el.classList.contains('tmk-lostform-v2-fs-panel')) break;
            if (el.tagName === 'FIELDSET') break;
            if (el.classList && el.classList.contains('ui-grid-b') && el.classList.contains('l_row')) {
                el.classList.add('tmk-lostform-v2-c1-hide');
                c1.setAttribute('data-tmk-c1-header-v2', '1');
                break;
            }
        }
    }


    function restoreContent1HeaderRowVisible() {
        const c1 = document.getElementById('content_1');
        if (!c1) return;
        c1.querySelectorAll('.tmk-lostform-v2-c1-hide').forEach(function(el) {
            el.classList.remove('tmk-lostform-v2-c1-hide');
        });
        c1.removeAttribute('data-tmk-c1-header-v2');
    }


    function buildSub36Buttons() {
        const wrap = document.getElementById('tmk-lostform-v2-sub36');
        if (!wrap) return;
        wrap.innerHTML = '';
        [2, 3, 4, 5, 6].forEach(function(n) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tmk-lostform-v2-sub-btn' + (state.subStep36 === n ? ' is-active' : '');
            b.textContent = '区块' + n;
            b.setAttribute('data-tmk-sub', String(n));
            b.addEventListener('click', function() {
                state.subStep36 = n;
                wrap.querySelectorAll('.tmk-lostform-v2-sub-btn').forEach(function(x) {
                    x.classList.toggle('is-active', x.getAttribute('data-tmk-sub') === String(n));
                });
                applyPaneVisibility();
            });
            wrap.appendChild(b);
        });
    }


    function setActiveMirrorPage(pageNo) {
        ensureStage();
        renderMirrorPage(pageNo);
        const stage = document.getElementById(STAGE_ID);
        if (!stage) return;
        Object.keys(state.mirrorPageRefs).forEach(function(k) {
            const page = state.mirrorPageRefs[k];
            if (!page) return;
            const on = Number(k) === Number(pageNo);
            page.classList.toggle('tmk-lostform-v2-mirror-page--on', on);
            if (on) syncMirrorFromSource(Number(k));
        });
    }


    function applyPaneVisibility() {
        const shell = document.getElementById(SHELL_ID);
        const quick = document.getElementById('tmk-lostform-v2-quick');
        const sub36 = document.getElementById('tmk-lostform-v2-sub36');
        if (state.mode !== 'modern') return;
        ensureStage();
        if (shell) shell.classList.toggle('tmk-lostform-v2-shell--quick', state.mainStep === 1);
        const stageEl = document.getElementById(STAGE_ID);
        if (stageEl) stageEl.classList.toggle('tmk-lostform-v2-stage--on', state.mainStep === 2 || state.mainStep === 3 || state.mainStep === 4);
        if (quick) quick.style.display = state.mainStep === 1 ? 'block' : 'none';
        if (sub36) {
            sub36.classList.toggle('tmk-lostform-v2-sub--on', state.mainStep === 3);
            if (state.mainStep === 3) {
                sub36.querySelectorAll('.tmk-lostform-v2-sub-btn').forEach(function(x) {
                    x.classList.toggle('is-active', x.getAttribute('data-tmk-sub') === String(state.subStep36));
                });
            }
        }
        if (state.mainStep === 1) {
            syncMainContentActive(null);
            applyNormalizedQuickLabels();
            normalizeQuickTextboxWidths();
        } else if (state.mainStep === 2) {
            syncMainContentActive('content_1');
            setActiveMirrorPage(1);
        } else if (state.mainStep === 3) {
            syncMainContentActive('content_' + state.subStep36);
            setActiveMirrorPage(state.subStep36);
        } else if (state.mainStep === 4) {
            syncMainContentActive('content_7');
            setActiveMirrorPage(7);
        }
        applyShellOffset();
        updateNativeNavUi();
        updateQuickFillFab();
    }


    function updateNativeNavUi() {
        const on = state.mode === 'modern' && (state.mainStep === 1 || state.mainStep === 2);
        document.documentElement.classList.toggle('tmk-lostform-v2-hide-native-nav', on);
    }


    function updateQuickFillFab() {
        const fab = document.getElementById(QUICK_FILL_FAB_ID);
        const detailFab = document.getElementById(DETAIL_QUICK_FILL_FAB_ID);
        const prev = document.getElementById(PREVIEW_BTN_ID);
        const slot = document.getElementById(PREVIEW_SLOT_ID);
        const actionBar = document.getElementById(ACTION_BAR_ID);
        const on = state.mode === 'modern' && (state.mainStep === 1 || state.mainStep === 2);
        const quickOn = on && state.quickReady && state.mainStep === 1;
        const detailOn = on && state.mainStep === 2;
        if (fab) fab.classList.toggle('tmk-lostform-v2-qf-fab--on', quickOn);
        if (detailFab) detailFab.classList.toggle('tmk-lostform-v2-qf-fab-detail--on', detailOn);
        if (prev) prev.classList.toggle('tmk-lostform-v2-qf-preview--on', quickOn);
        if (slot) slot.classList.toggle('tmk-lostform-v2-qf-preview--on', quickOn);
        if (actionBar) actionBar.classList.toggle('tmk-lostform-v2-qf-action-bar--on', quickOn);
    }


    function syncRadiosFromState() {
        const v = String(state.mainStep);
        const radio = document.querySelector('input[name="tmk-lostform-v2-step"][value="' + v + '"]');
        if (radio) radio.checked = true;
    }


    function bindShellEvents() {
        document.querySelectorAll('input[name="tmk-lostform-v2-step"]').forEach(function(r) {
            r.addEventListener('change', function() {
                if (!r.checked) return;
                state.mainStep = parseInt(r.value, 10) || 1;
                applyPaneVisibility();
            });
        });
        const qi = getQuickInputs();
        if (qi.ct) {
            qi.ct.addEventListener('input', function() {
                qi.ct.value = qi.ct.value.toUpperCase();
            });
            qi.ct.addEventListener('keydown', function(ev) {
                state.capsLockActive = ev.getModifierState && ev.getModifierState('CapsLock');
            });
            qi.ct.addEventListener('keyup', function(ev) {
                state.capsLockActive = ev.getModifierState && ev.getModifierState('CapsLock');
            });
        }
        filterNwInputEl(qi.nw);
        bindQuickUppercase(qi.nmgn);
        bindQuickUppercase(qi.tn);
        bindQuickUppercase(qi.pa);
        bindQuickUppercase(qi.family);
        bindQuickUppercase(qi.cp);
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
        if (state.mode === 'legacy') {
            document.documentElement.classList.remove(MODE_CLASS);
            document.documentElement.classList.remove('tmk-lostform-v2-hide-native-nav');
            if (state.detailSyncTimer) {
                try {
                    window.clearInterval(state.detailSyncTimer);
                } catch (e) {}
                state.detailSyncTimer = null;
            }
            const fabLegacy = document.getElementById(QUICK_FILL_FAB_ID);
            if (fabLegacy) fabLegacy.classList.remove('tmk-lostform-v2-qf-fab--on');
            const prevLegacy = document.getElementById(PREVIEW_BTN_ID);
            if (prevLegacy) prevLegacy.classList.remove('tmk-lostform-v2-qf-preview--on');
            restoreStageContentsToForm();
            teardownContent1Collapsible();
            restoreContent1HeaderRowVisible();
            if (state.glass) state.glass.style.display = 'none';
            document.documentElement.style.removeProperty('--tmk-lostform-v2-body-pad');
            document.documentElement.style.removeProperty('--tmk-lostform-v2-body-pad-bottom');
        } else {
            document.documentElement.classList.add(MODE_CLASS);
            setupCollapsibleFieldsetsV2();
            markContent1HeaderRowHidden();
            ensureStage();
            ensureDetailQuickFillFab();
            if (state.glass) state.glass.style.display = 'block';
            applyPaneVisibility();
        }
        updateToolbarButtons();
    }


    function ensureDetailQuickFillFab() {
        let detailFab = document.getElementById(DETAIL_QUICK_FILL_FAB_ID);
        if (!detailFab) {
            detailFab = document.createElement('button');
            detailFab.id = DETAIL_QUICK_FILL_FAB_ID;
            detailFab.type = 'button';
            detailFab.className = 'tmk-lostform-v2-qf-action';
            detailFab.setAttribute('title', '新增');
            detailFab.setAttribute('aria-label', '新增');
            detailFab.textContent = '新增';
            detailFab.addEventListener('click', function() {
                runFabSubmit();
            });
        }
        const stageForFab = document.getElementById(STAGE_ID);
        if (stageForFab && detailFab.parentNode !== stageForFab) stageForFab.appendChild(detailFab);
    }


    function mount() {
        injectStyles();
        ensureGlass();
        renderToolbar();
        applyLeftGap();
        if (document.getElementById(SHELL_ID)) {
            ensureStage();
            return true;
        }
        const stepBar = document.createElement('div');
        stepBar.id = STEPPER_BAR_ID;
        stepBar.className = 'tmk-lostform-v2-stepper-bar';
        stepBar.innerHTML = buildStepperHtml();
        document.body.appendChild(stepBar);
        const shell = document.createElement('div');
        shell.id = SHELL_ID;
        shell.innerHTML = buildQuickHtml();
        document.body.appendChild(shell);
        state.shell = shell;
        ensureStage();
        if (!document.getElementById(QUICK_FILL_FAB_ID)) {
            const fab = document.createElement('button');
            fab.id = QUICK_FILL_FAB_ID;
            fab.type = 'button';
            fab.className = 'tmk-lostform-v2-qf-action';
            fab.setAttribute('title', '新增');
            fab.setAttribute('aria-label', '新增');
            fab.textContent = '新增';
            fab.addEventListener('click', function() {
                runFabSubmit();
            });
            const actionBar = document.getElementById(ACTION_BAR_ID);
            if (actionBar) actionBar.appendChild(fab);
            else shell.appendChild(fab);
        }
        ensureDetailQuickFillFab();
        if (!document.getElementById(PREVIEW_BTN_ID)) {
            const prev = document.createElement('button');
            prev.id = PREVIEW_BTN_ID;
            prev.type = 'button';
            prev.className = 'tmk-lostform-v2-qf-action tmk-lostform-v2-qf-preview-btn';
            prev.setAttribute('title', '预览');
            prev.setAttribute('aria-label', '预览');
            prev.textContent = '预览';
            prev.addEventListener('click', function() {
                runPreviewPipeline();
            });
            const slot = document.getElementById(PREVIEW_SLOT_ID);
            if (slot) slot.appendChild(prev);
            else shell.appendChild(prev);
        } else {
            const prevEx = document.getElementById(PREVIEW_BTN_ID);
            const slot = document.getElementById(PREVIEW_SLOT_ID);
            if (prevEx && slot && prevEx.parentNode !== slot) slot.appendChild(prevEx);
        }
        const fabEx = document.getElementById(QUICK_FILL_FAB_ID);
        const actionBar = document.getElementById(ACTION_BAR_ID);
        if (fabEx && actionBar && fabEx.parentNode !== actionBar) actionBar.appendChild(fabEx);
        const detailFabEx = document.getElementById(DETAIL_QUICK_FILL_FAB_ID);
        const stageForFab = document.getElementById(STAGE_ID);
        if (detailFabEx && stageForFab && detailFabEx.parentNode !== stageForFab) stageForFab.appendChild(detailFabEx);
        buildSub36Buttons();
        bindShellEvents();
        syncRadiosFromState();
        applyPaneVisibility();
        state.lastForceCloseTs = readForceCloseViewsTs();
        setMode('modern');
        window.setInterval(function() {
            enforceUiGlobalControl();
            tryMarkQuickReady();
        }, 400);
        setTimeout(tryMarkQuickReady, 0);
        setTimeout(syncFabLabelFromDom, 800);
        setTimeout(syncFabLabelFromDom, 2000);
        setTimeout(syncThemeVarsFromUi, 0);
        setTimeout(syncThemeVarsFromUi, 500);
        setTimeout(syncThemeVarsFromUi, 1500);
        window.addEventListener('resize', function() {
            applyLeftGap();
            applyShellOffset();
            normalizeQuickTextboxWidths();
        });
        window.addEventListener('load', applyShellOffset);
        setTimeout(applyShellOffset, 100);
        setTimeout(applyShellOffset, 600);
        return true;
    }


    function tryBootstrap() {
        const form = document.querySelector('#form');
        if (!form) return false;
        const need = ['content_1', 'content_2', 'content_3', 'content_4', 'content_5', 'content_6', 'content_7'];
        for (let i = 0; i < need.length; i += 1) {
            if (!document.getElementById(need[i])) return false;
        }
        mount();
        if (state.observer) return true;
        state.observer = new MutationObserver(function() {
            if (!document.getElementById('content_1')) {
                state.observer.disconnect();
                state.observer = null;
            }
        });
        try {
            state.observer.observe(form, { childList: true, subtree: true });
        } catch (e) {}
        return true;
    }


    function bootstrap() {
        applyLeftGap();
        if (tryBootstrap()) return;
        setTimeout(bootstrap, 600);
    }


    bootstrap();
})();
