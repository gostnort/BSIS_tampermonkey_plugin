// ==UserScript==
// @name         BCheckWeb 少收表 v2 覆盖层
// @namespace    http://tampermonkey.net/
// @version      2.2.4
// @description  新建少收：AHL仅壳显示；详情/信息/追踪进 tmk-stage；TN 规则同前；步骤条置顶透明；与少收表 v1 请勿同时启用
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
    const PAGE_RE = /(?:newNull)?BaggageLost_newBaggageLostAction\.action/i;
    const INIT_FLAG = '__tmkPnrInit';
    const STYLE_ID = 'tmk-pnr-style';
    const GLASS_ID = 'tmk-pnr-glass';
    const TOOLBAR_ID = 'tmk-pnr-toolbar';
    const SHELL_ID = 'tmk-pnr-shell';
    const STAGE_ID = 'tmk-pnr-stage';
    const STEPPER_BAR_ID = 'tmk-pnr-stepper-bar';
    const QUICK_FILL_FAB_ID = 'tmk-pnr-qf-fab';
    const DETAIL_QUICK_FILL_FAB_ID = 'tmk-pnr-qf-fab-detail';
    const PREVIEW_BTN_ID = 'tmk-pnr-qf-preview';
    const PREVIEW_SLOT_ID = 'tmk-pnr-qf-preview-slot';
    const ACTION_BAR_ID = 'tmk-pnr-qf-action-bar';
    const INFO_STAGE_ID = 'tmk-pnr-info-stage';
    const STEP2_PAGE_NO = 1;
    const INFO_STAGE_BTN_CLASS = 'tmk-pnr-info-btn';
    const STEP2_OVERLAY_CLASS = 'tmk-pnr-step2-overlay';
    const STEP2_GROUP_CLASS = 'tmk-pnr-fs-group';
    const STEP2_GROUP_TITLE_CLASS = 'tmk-pnr-fs-title';
    const STEP2_GROUP_FIELDS_CLASS = 'tmk-pnr-fs-fields';
    const STEP2_FIELD_CLASS = 'tmk-pnr-field';
    const STEP2_FIELD_WIDE_CLASS = 'tmk-pnr-field--wide';
    const STEP2_FIELD_LABEL_CLASS = 'tmk-pnr-label';
    const STEP2_FIELD_CONTROL_CLASS = 'tmk-pnr-fs-control';
    const MODE_CLASS = 'tmk-pnr-modern';
    const MIRROR_PAGE_CLASS = 'tmk-pnr-mirror-page';
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
        uiVisible: true,
        mainStep: 1,
        infoStep: 2,
        glass: null,
        shell: null,
        capsLockActive: false,
        observer: null,
        quickReady: false,
        detailSyncTimer: null,
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


    // AHL/详细共用：列数按不同阈值计算
    function ahlColsWidth() {
        if (!document.documentElement) return;
        const w = window.innerWidth || 1200;
        const qfCols = Math.max(1, Math.min(8, Math.floor(w / 720)));
        const fsCols = Math.max(1, Math.min(8, Math.floor(w / 360)));
        document.documentElement.style.setProperty('--tmk-qf-cols', String(qfCols));
        document.documentElement.style.setProperty('--tmk-fs-cols', String(fsCols));
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
        ahlColsWidth();
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


    function buildStep2Schema(sourceRoot) {
        const groups = [];
        const fieldsets = Array.from(sourceRoot.querySelectorAll('fieldset')).slice(0, 5);
        fieldsets.forEach(function(fs, idx) {
            const legend = fs.querySelector('legend');
            const title = legend ? String(legend.textContent || '').replace(/\s+/g, ' ').trim() : '分组' + (idx + 1);
            const fields = [];
            const controls = collectBindableControls(fs);
            controls.forEach(function(ctrl) {
                let labelText = '';
                const parentBlock = ctrl.closest('[class*="ui-block-"]');
                if (parentBlock && parentBlock.previousElementSibling) {
                    labelText = String(parentBlock.previousElementSibling.textContent || '').replace(/\s+/g, ' ').trim();
                } else if (ctrl.parentElement && ctrl.parentElement.previousElementSibling) {
                    labelText = String(ctrl.parentElement.previousElementSibling.textContent || '').replace(/\s+/g, ' ').trim();
                }
                if (!labelText) {
                    labelText = String(ctrl.getAttribute('data-name') || ctrl.getAttribute('placeholder') || ctrl.name || '').trim();
                }
                let explicitLabel = '';
                if (ctrl.id) {
                    const labelEl = fs.querySelector('label[for="' + ctrl.id + '"]');
                    if (labelEl) {
                        explicitLabel = String(labelEl.textContent || '').replace(/\s+/g, ' ').trim();
                    }
                }
                if (explicitLabel) labelText = explicitLabel;
                if (!labelText && ctrl.type === 'button') labelText = ctrl.value || '操作';

                fields.push({
                    label: labelText,
                    sourceControl: ctrl
                });
            });
            groups.push({
                title: title,
                fields: fields,
                collapsed: idx > 0
            });
        });
        return groups;
    }


    function renderStep2Overlay(sourceRoot, mirrorRoot) {
        const groups = buildStep2Schema(sourceRoot);
        const overlay = document.createElement('div');
        overlay.className = STEP2_OVERLAY_CLASS;
        groups.forEach(function(g) {
            const panel = document.createElement('div');
            panel.className = STEP2_GROUP_CLASS + (g.collapsed ? ' is-collapsed' : '');
            
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = STEP2_GROUP_TITLE_CLASS;
            toggle.textContent = g.title + '  ▾';
            toggle.addEventListener('click', function() {
                const wasCollapsed = panel.classList.contains('is-collapsed');
                overlay.querySelectorAll('.' + STEP2_GROUP_CLASS).forEach(function(p) {
                    p.classList.add('is-collapsed');
                });
                if (wasCollapsed) panel.classList.remove('is-collapsed');
            });
            
            const body = document.createElement('div');
            body.className = STEP2_GROUP_FIELDS_CLASS;
            
            g.fields.forEach(function(f) {
                const fieldWrap = document.createElement('div');
                fieldWrap.className = STEP2_FIELD_CLASS;
                if (f.sourceControl.tagName.toLowerCase() === 'textarea') {
                    fieldWrap.classList.add(STEP2_FIELD_WIDE_CLASS);
                }
                
                const label = document.createElement('label');
                label.className = STEP2_FIELD_LABEL_CLASS;
                label.textContent = f.label;
                
                const clonedCtrl = f.sourceControl.cloneNode(true);
                removeIdsFromCloneTree(clonedCtrl);
                
                // 去除了 tmk-pnr-fs-control 的包裹，直接 append
                fieldWrap.appendChild(label);
                fieldWrap.appendChild(clonedCtrl);
                body.appendChild(fieldWrap);
            });
            
            panel.appendChild(toggle);
            panel.appendChild(body);
            overlay.appendChild(panel);
        });
        mirrorRoot.appendChild(overlay);
    }


    function renderMirrorPage(pageNo) {
        const stage = document.getElementById(STAGE_ID);
        const source = document.getElementById('content_' + pageNo);
        if (!stage || !source) return;
        let mirror = state.mirrorPageRefs[pageNo];
        if (!mirror || !mirror.parentNode) {
            mirror = document.createElement('div');
            mirror.className = MIRROR_PAGE_CLASS;
            mirror.setAttribute('data-tmk-mirror-page', String(pageNo));
            stage.appendChild(mirror);
            state.mirrorPageRefs[pageNo] = mirror;
        }
        mirror.innerHTML = '';
        if (Number(pageNo) === STEP2_PAGE_NO) {
            renderStep2Overlay(source, mirror);
        } else {
            const clone = source.cloneNode(true);
            removeIdsFromCloneTree(clone);
            mirror.appendChild(clone);
        }
        bindMirrorControls(pageNo, source, mirror);
        syncMirrorFromSource(pageNo);
    }


    // 功能：创建并挂载镜像舞台（只渲染覆盖层，不改原网页）。
    function mountStage() {
        if (document.getElementById(STAGE_ID)) return;
        if (!document.body) return;
        const stage = document.createElement('div');
        stage.id = STAGE_ID;
        stage.className = 'tmk-pnr-stage';
        document.body.appendChild(stage);
        [1, 2, 3, 4, 5, 6, 7].forEach(function(pageNo) {
            renderMirrorPage(pageNo);
        });
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
        if (el.id === 'tmk-pnr-qf-nw') return;
        function up() {
            const u = el.value.toUpperCase();
            if (u !== el.value) el.value = u;
        }
        el.addEventListener('input', up);
        el.addEventListener('blur', up);
    }


    function cleanRawLabelText(raw) {
        return String(raw || '')
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
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
        applyQuickLabelText('tmk-pnr-qf-label-nmgn', normalizeLabelFromRawList(nmgnRaw));
        applyQuickLabelText('tmk-pnr-qf-label-tn', normalizeLabelFromRawList([getRawLabelByInput(tnInput)]));
        applyQuickLabelText('tmk-pnr-qf-label-ct', normalizeLabelFromRawList([getRawLabelByInput(ctInput)]));
        applyQuickLabelText('tmk-pnr-qf-label-nw', normalizeLabelFromRawList([getRawLabelByInput(nwInput)]));
        applyQuickLabelText('tmk-pnr-qf-label-pa', normalizeLabelFromRawList([getRawLabelByInput(paInput)]));
        const familyLabel = normalizeLabelFromRawList([getRawLabelByInput(familyInput)]);
        applyQuickLabelText('tmk-pnr-qf-label-family', familyLabel || '家庭电话 PN');
        applyQuickLabelText('tmk-pnr-qf-label-cp', normalizeLabelFromRawList([getRawLabelByInput(cpInput)]));
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
        const quick = document.getElementById('tmk-pnr-quick');
        if (!quick) return;
        const grid = quick.querySelector('.tmk-pnr-qf-grid');
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


    // 功能：读取AHL页输入框引用。
    function getQuickInputs() {
        return {
            nmgn: document.getElementById('tmk-pnr-qf-nmgn'),
            tn: document.getElementById('tmk-pnr-qf-tn'),
            nw: document.getElementById('tmk-pnr-qf-nw'),
            ct: document.getElementById('tmk-pnr-qf-ct'),
            pa: document.getElementById('tmk-pnr-qf-pa'),
            family: document.getElementById('tmk-pnr-qf-family'),
            cp: document.getElementById('tmk-pnr-qf-cp')
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


    // 复用基页“完成”按钮的校验逻辑：在AHL页点击预览时同步触发一次
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
        return { ok: true, message: 'AHL填充完成。' };
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
        if (!state.quickReady || !state.uiVisible || state.mainStep !== 1) return;
        const refs = resolveFieldRefs(document);
        const qi = getQuickInputs();
        const nmgnFromRefs = buildNmGnDisplayFromRefs(refs);
        const tnFromRefs = buildTnStringFromRefs(refs);
        // 仅在基页有有效值时回填，避免失焦后把AHL区已有内容清空或污染
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
        const quick = document.getElementById('tmk-pnr-quick');
        if (quick) quick.classList.remove('tmk-pnr-quick--pending');
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
            if (!state.uiVisible || state.mainStep !== 1) return;
            syncQuickFromDetail();
        }, 1200);
    }


    // 功能：注入覆盖层专用样式（不改动原网页元素）。
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const z = getSharedZLayers();
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            'html.' + MODE_CLASS + ' #' + GLASS_ID + ' { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + SHELL_ID + ' { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + SHELL_ID + '.tmk-pnr-shell--quick { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + '.tmk-pnr-stage--on { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + STEPPER_BAR_ID + ' { display: block !important; }',
            '#' + GLASS_ID + ' {',
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: ' + z.backgroundCover + ';',
            '  display: none;',
            '  background: color-mix(in srgb, var(--tmk-c-minor-button) 40%, transparent);',
            '  backdrop-filter: blur(12px);',
            '  -webkit-backdrop-filter: blur(12px);',
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
            '.tmk-pnr-tb-btn {',
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
            '.tmk-pnr-tb-btn:hover {',
            '  border-color: var(--tmk-c-search-active-border, var(--tmk-c-search-input-border));',
            '}',
            '.tmk-pnr-tb-btn.tmk-active {',
            '  background: var(--tmk-c-major-focus);',
            '  border-color: var(--tmk-c-major-focus);',
            '  color: var(--tmk-c-lv1-fg);',
            '}',
            '#' + STEPPER_BAR_ID + ' {',
            '  display: none;',
            '  position: fixed;',
            '  left: var(--tmk-left-gap, 16px);',
            '  right: var(--tmk-pnr-shell-right, 24px);',
            '  top: 72px;',
            '  bottom: auto;',
            '  z-index: ' + z.mainFunctionView + ';',
            '  padding: 6px 12px 8px;',
            '  box-sizing: border-box;',
            '  background: transparent;',
            '  border: none;',
            '  box-shadow: none;',
            '  pointer-events: auto;',
            '}',
            '#' + STEPPER_BAR_ID + ' .tmk-pnr-stepper {',
            '  margin-top: 0;',
            '  margin-bottom: 0;',
            '}',
            '#' + SHELL_ID + ',',
            '#' + STAGE_ID + ' {',
            '  display: none;',
            '  position: fixed;',
            '  top: calc(72px + var(--tmk-pnr-stepper-h, 56px));',
            '  bottom: 12px;',
            '  left: var(--tmk-left-gap, 16px);',
            '  z-index: ' + z.mainFunctionView + ';',
            '  width: calc(100vw - var(--tmk-left-gap, 16px) - var(--tmk-pnr-shell-right, 24px));',
            '  max-width: calc(100vw - var(--tmk-left-gap, 16px) - var(--tmk-pnr-shell-right, 24px));',
            '  max-height: none;',
            '  overflow-x: hidden;',
            '  overflow-y: auto;',
            '  box-sizing: border-box;',
            '  padding: var(--tmk-pnr-shell-pad-top, 10px) var(--tmk-pnr-shell-pad-x, 12px) calc(var(--tmk-pnr-shell-pad-bot, 14px) + var(--tmk-medium, 92px) * 0.382 + 18px) var(--tmk-pnr-shell-pad-x, 12px);',
            '  background: color-mix(in srgb, var(--tmk-c-major-button) 12%, transparent);',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 12px;',
            '  backdrop-filter: none;',
            '  -webkit-backdrop-filter: none;',
            '  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);',
            '  pointer-events: auto;',
            '  color: var(--tmk-c-major-font);',
            '}',
            '.tmk-pnr-stepper {',
            '  display: flex;',
            '  align-items: center;',
            '  flex-wrap: nowrap;',
            '  gap: 0;',
            '  margin-bottom: 10px;',
            '}',
            '.tmk-pnr-step-node {',
            '  position: relative;',
            '  display: flex;',
            '  align-items: center;',
            '  flex: 0 0 auto;',
            '  min-width: 0;',
            '}',
            '.tmk-pnr-step-node input[type="radio"] {',
            '  position: absolute;',
            '  opacity: 0;',
            '  width: 0;',
            '  height: 0;',
            '  pointer-events: none;',
            '}',
            '.tmk-pnr-step-visual {',
            '  display: flex;',
            '  align-items: center;',
            '  min-width: 0;',
            '  cursor: pointer;',
            '}',
            '.tmk-pnr-step-ring {',
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
            '.tmk-pnr-step-node input:checked + label .tmk-pnr-step-ring::after {',
            '  content: "";',
            '  width: 10px;',
            '  height: 10px;',
            '  border-radius: 0;',
            '  background: var(--tmk-c-major-focus);',
            '  display: block;',
            '}',
            '.tmk-pnr-step-connector {',
            '  flex: 1 1 12px;',
            '  height: 2px;',
            '  background: var(--tmk-c-major-focus);',
            '  margin: 0 4px;',
            '  min-width: 8px;',
            '  opacity: 0.85;',
            '  align-self: center;',
            '}',
            '.tmk-pnr-step-text {',
            '  margin-left: 6px;',
            '  font-size: 13px;',
            '  color: var(--tmk-c-major-font);',
            '  white-space: nowrap;',
            '  overflow: hidden;',
            '  text-overflow: ellipsis;',
            '}',
            '.tmk-pnr-step-node input:focus + label .tmk-pnr-step-ring {',
            '  outline: 2px solid var(--tmk-c-major-focus);',
            '  outline-offset: 2px;',
            '}',
            '#tmk-pnr-quick { margin-top: 4px; color: var(--tmk-c-major-font); position: relative; }',
            '.tmk-pnr-qf-loading { display: none; margin: 0 0 10px 0; font-size: 15px; color: var(--tmk-c-major-font); opacity: 0.75; }',
            '#tmk-pnr-quick.tmk-pnr-quick--pending .tmk-pnr-qf-loading { display: block; }',
            '#tmk-pnr-quick.tmk-pnr-quick--pending .tmk-pnr-qf-grid { opacity: 0.45; pointer-events: none; }',
            '#tmk-pnr-quick .tmk-pnr-qf-title {',
            '  font-size: 34px;',
            '  font-weight: 700;',
            '  color: var(--tmk-c-major-font);',
            '  margin: 0 0 18px 0;',
            '}',
            '#tmk-pnr-quick .tmk-pnr-qf-grid {',
            '  display: grid;',
            '  grid-template-columns: repeat(var(--tmk-qf-cols, 1), minmax(0, 1fr));',
            '  gap: calc(var(--tmk-gap, 10px) * 1.2);',
            '  align-items: start;',
            '  width: 100%;',
            '  box-sizing: border-box;',
            '}',
            '.tmk-pnr-field {',
            '  display: flex;',
            '  flex-direction: row;',
            '  align-items: center;',
            '  gap: 10px;',
            '  min-width: 0;',
            '  max-width: none;',
            '  width: 100%;',
            '  box-sizing: border-box;',
            '}',
            '.tmk-pnr-field .tmk-pnr-label {',
            '  margin-top: 0;',
            '}',
            '.tmk-pnr-label {',
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
            '.tmk-pnr-field input, .tmk-pnr-field select, .tmk-pnr-field textarea {',
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
            '.tmk-pnr-field input::placeholder, .tmk-pnr-field textarea::placeholder {',
            '  color: color-mix(in srgb, var(--tmk-c-minor-focus) 50%, transparent) !important;',
            '}',
            '.tmk-pnr-field input:focus, .tmk-pnr-field select:focus, .tmk-pnr-field textarea:focus {',
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
            '#' + PREVIEW_SLOT_ID + '.tmk-pnr-qf-preview--on {',
            '  display: block;',
            '}',
            '#' + ACTION_BAR_ID + '.tmk-pnr-qf-action-bar--on {',
            '  display: flex;',
            '}',
            '.tmk-pnr-qf-action {',
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
            '#' + PREVIEW_BTN_ID + '.tmk-pnr-qf-preview-btn {',
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
            'html.' + MODE_CLASS + ' .tmk-pnr-qf-fab--on {',
            '  display: inline-flex !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + PREVIEW_BTN_ID + '.tmk-pnr-qf-preview--on {',
            '  display: inline-flex !important;',
            '}',
            'html.' + MODE_CLASS + ' #' + DETAIL_QUICK_FILL_FAB_ID + '.tmk-pnr-qf-fab-detail--on {',
            '  display: inline-flex !important;',
            '}',
            '#' + INFO_STAGE_ID + ' {',
            '  display: none;',
            '  margin-top: 8px;',
            '  flex-wrap: wrap;',
            '  gap: 6px;',
            '}',
            '#' + INFO_STAGE_ID + '.tmk-pnr-info-stage--on { display: flex !important; }',
            '.' + INFO_STAGE_BTN_CLASS + ' {',
            '  padding: 4px 8px;',
            '  font-size: 12px;',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 0;',
            '  background: var(--tmk-c-input-background);',
            '  color: var(--tmk-c-major-font);',
            '  cursor: pointer;',
            '}',
            '.' + INFO_STAGE_BTN_CLASS + '.is-active {',
            '  background: var(--tmk-c-major-focus);',
            '  border-color: var(--tmk-c-major-focus);',
            '  color: var(--tmk-c-lv1-fg);',
            '}',
            'html.' + MODE_CLASS + ' .tmk-pnr-pane-hidden { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' {',
            '  display: none;',
            '  width: 100%;',
            '  max-width: 100%;',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + '.tmk-pnr-mirror-page--on {',
            '  display: block;',
            '}',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .l_mainContentL1,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .l_mainContent,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .ui-page,',
            'html.' + MODE_CLASS + ' #' + STAGE_ID + ' .' + MIRROR_PAGE_CLASS + ' .ui-content {',
            '  background: transparent !important;',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_OVERLAY_CLASS + ' {',
            '  padding: 12px var(--tmk-pnr-c1-panel-mx, 15px);',
            '  width: 100%;',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_GROUP_CLASS + ' {',
            '  margin-bottom: 12px;',
            '  border: 1px solid var(--tmk-c-search-input-border);',
            '  border-radius: 10px;',
            '  overflow: hidden;',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_GROUP_TITLE_CLASS + ' {',
            '  display: block;',
            '  width: 100%;',
            '  min-height: 48px;',
            '  text-align: left;',
            '  border: 0;',
            '  border-bottom: 1px solid var(--tmk-c-search-input-border);',
            '  background: var(--tmk-c-major-button);',
            '  font-size: 18px;',
            '  font-weight: 600;',
            '  padding: 10px 16px;',
            '  cursor: pointer;',
            '  box-sizing: border-box;',
            '  color: var(--tmk-c-major-font);',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_GROUP_CLASS + '.is-collapsed .' + STEP2_GROUP_TITLE_CLASS + ' {',
            '  border-bottom: 0;',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_GROUP_FIELDS_CLASS + ' {',
            '  padding: 16px;',
            '  display: grid;',
            '  grid-template-columns: repeat(var(--tmk-fs-cols, 2), minmax(0, 1fr));',
            '  gap: 16px;',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_GROUP_CLASS + '.is-collapsed .' + STEP2_GROUP_FIELDS_CLASS + ' {',
            '  display: none;',
            '}',
            'html.' + MODE_CLASS + ' .' + STEP2_FIELD_WIDE_CLASS + ' {',
            '  grid-column: 1 / -1;',
            '}',
            '#' + TOOLBAR_ID + '.tmk-ui-hidden,',
            '#' + STEPPER_BAR_ID + '.tmk-ui-hidden,',
            '#' + SHELL_ID + '.tmk-ui-hidden,',
            '#' + STAGE_ID + '.tmk-ui-hidden,',
            '#' + GLASS_ID + '.tmk-ui-hidden {',
            '  display: none !important;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }


    // 功能：创建并挂载背景毛玻璃层。
    function mountGlassLayer() {
        if (!document.body) return;
        let el = document.getElementById(GLASS_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = GLASS_ID;
            document.body.appendChild(el);
        }
        state.glass = el;
    }


    // 功能：渲染覆盖层显示/隐藏切换入口。
    function renderToolbar() {
        if (!document.body || document.getElementById(TOOLBAR_ID)) return;
        const bar = document.createElement('div');
        bar.id = TOOLBAR_ID;
        bar.innerHTML =
            '<button type="button" class="tmk-pnr-tb-btn tmk-active" data-tmk-ui="on">我的视图</button>' +
            '<button type="button" class="tmk-pnr-tb-btn" data-tmk-ui="off">原版页面</button>';
        document.body.appendChild(bar);
        bar.addEventListener('click', function(ev) {
            const t = ev.target;
            if (!t || !t.getAttribute) return;
            const v = t.getAttribute('data-tmk-ui');
            if (!v) return;
            setUiVisible(v === 'on');
        });
    }


    // 功能：同步工具栏按钮选中态。
    function updateToolbarButtons() {
        const bar = document.getElementById(TOOLBAR_ID);
        if (!bar) return;
        bar.querySelectorAll('.tmk-pnr-tb-btn').forEach(function(btn) {
            const on = btn.getAttribute('data-tmk-ui') === (state.uiVisible ? 'on' : 'off');
            btn.classList.toggle('tmk-active', on);
        });
    }


    // 功能：生成覆盖层步骤条HTML。
    function buildStepperHtml() {
        const steps = [
            { id: 'tmk-pnr-s1', value: '1', label: 'AHL' },
            { id: 'tmk-pnr-s2', value: '2', label: '详细' },
            { id: 'tmk-pnr-s3', value: '3', label: '信息' },
            { id: 'tmk-pnr-s4', value: '4', label: '追踪' }
        ];
        const parts = [];
        parts.push('<div class="tmk-pnr-stepper" role="radiogroup" aria-label="步骤">');
        steps.forEach(function(s, idx) {
            parts.push(
                '<div class="tmk-pnr-step-node">' +
                '<input type="radio" name="tmk-pnr-step" id="' + s.id + '" value="' + s.value + '"' + (s.value === '1' ? ' checked' : '') + ' />' +
                '<label for="' + s.id + '" class="tmk-pnr-step-visual">' +
                '<span class="tmk-pnr-step-ring"></span>' +
                '<span class="tmk-pnr-step-text">' + s.label + '</span>' +
                '</label>' +
                '</div>'
            );
            if (idx < steps.length - 1) {
                parts.push('<span class="tmk-pnr-step-connector" aria-hidden="true"></span>');
            }
        });
        parts.push('</div>');
        return parts.join('');
    }


    // 功能：生成AHL页HTML骨架。
    function buildQuickHtml() {
        return (
            '<div id="tmk-pnr-quick" class="tmk-pnr-quick--pending">' +
            '<p id="tmk-pnr-qf-loading" class="tmk-pnr-qf-loading">正在等待详细页字段加载...</p>' +
            '<p class="tmk-pnr-qf-title">WT AHL</p>' +
            '<div class="tmk-pnr-qf-grid">' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-nmgn" class="tmk-pnr-label" for="tmk-pnr-qf-nmgn">NMs/GNs</label>' +
            '<input id="tmk-pnr-qf-nmgn" type="text" placeholder="LIU/GOSTNORT/LIANG/GORDON" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-tn" class="tmk-pnr-label" for="tmk-pnr-qf-tn">TNs</label>' +
            '<input id="tmk-pnr-qf-tn" type="text" placeholder="CA654321/CA123456" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-ct" class="tmk-pnr-label" for="tmk-pnr-qf-ct">CTs</label>' +
            '<input id="tmk-pnr-qf-ct" type="text" placeholder="BK22RHW/RD01XXX" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-nw" class="tmk-pnr-label" for="tmk-pnr-qf-nw">NW</label>' +
            '<input id="tmk-pnr-qf-nw" type="text" inputmode="numeric" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-pa" class="tmk-pnr-label" for="tmk-pnr-qf-pa">PA</label>' +
            '<input id="tmk-pnr-qf-pa" type="text" placeholder="123 MAIN ST, LA, CA 90001" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-family" class="tmk-pnr-label" for="tmk-pnr-qf-family">PN</label>' +
            '<input id="tmk-pnr-qf-family" type="text" placeholder="数字" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-pnr-field">' +
            '<label id="tmk-pnr-qf-label-cp" class="tmk-pnr-label" for="tmk-pnr-qf-cp">CP</label>' +
            '<input id="tmk-pnr-qf-cp" type="text" value="' + DEFAULT_CP + '" autocomplete="off" />' +
            '</div>' +
            '<div id="' + PREVIEW_SLOT_ID + '"></div>' +
            '<div id="' + ACTION_BAR_ID + '"></div>' +
            '</div>' +
            '<div id="' + INFO_STAGE_ID + '" aria-label="子区块"></div>'
        );
    }


    // 功能：保留空操作接口，避免修改原网页激活态。
    function syncMainContentActive(activeId) {
        return activeId;
    }




    // 功能：构建信息页子区块切换按钮。
    function buildInfoStageButtons() {
        const wrap = document.getElementById(INFO_STAGE_ID);
        if (!wrap) return;
        wrap.innerHTML = '';
        [2, 3, 4, 5, 6].forEach(function(n) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = INFO_STAGE_BTN_CLASS + (state.infoStep === n ? ' is-active' : '');
            b.textContent = '区块' + n;
            b.setAttribute('data-tmk-info-stage', String(n));
            b.addEventListener('click', function() {
                state.infoStep = n;
                wrap.querySelectorAll('.' + INFO_STAGE_BTN_CLASS).forEach(function(x) {
                    x.classList.toggle('is-active', x.getAttribute('data-tmk-info-stage') === String(n));
                });
                applyPaneVisibility();
            });
            wrap.appendChild(b);
        });
    }


    // 功能：切换当前显示的镜像页面。
    function setActiveMirrorPage(pageNo) {
        mountStage();
        renderMirrorPage(pageNo);
        const stage = document.getElementById(STAGE_ID);
        if (!stage) return;
        Object.keys(state.mirrorPageRefs).forEach(function(k) {
            const page = state.mirrorPageRefs[k];
            if (!page) return;
            const on = Number(k) === Number(pageNo);
            page.classList.toggle('tmk-pnr-mirror-page--on', on);
            if (on) syncMirrorFromSource(Number(k));
        });
    }


    // 功能：根据步骤与可见状态切换覆盖层面板显示。
    function applyPaneVisibility() {
        const shell = document.getElementById(SHELL_ID);
        const quick = document.getElementById('tmk-pnr-quick');
        const infoStage = document.getElementById(INFO_STAGE_ID);
        if (!state.uiVisible) {
            if (shell) shell.classList.remove('tmk-pnr-shell--quick');
            const stageHidden = document.getElementById(STAGE_ID);
            if (stageHidden) stageHidden.classList.remove('tmk-pnr-stage--on');
            if (quick) quick.style.display = 'none';
            if (infoStage) infoStage.classList.remove('tmk-pnr-info-stage--on');
            updateNativeNavUi();
            updateQuickFillFab();
            return;
        }
        mountStage();
        if (shell) shell.classList.toggle('tmk-pnr-shell--quick', state.mainStep === 1);
        const stageEl = document.getElementById(STAGE_ID);
        if (stageEl) stageEl.classList.toggle('tmk-pnr-stage--on', state.mainStep === 2 || state.mainStep === 3 || state.mainStep === 4);
        if (quick) quick.style.display = state.mainStep === 1 ? 'block' : 'none';
        if (infoStage) {
            infoStage.classList.toggle('tmk-pnr-info-stage--on', state.mainStep === 3);
            if (state.mainStep === 3) {
                infoStage.querySelectorAll('.' + INFO_STAGE_BTN_CLASS).forEach(function(x) {
                    x.classList.toggle('is-active', x.getAttribute('data-tmk-info-stage') === String(state.infoStep));
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
            syncMainContentActive('content_' + state.infoStep);
            setActiveMirrorPage(state.infoStep);
        } else if (state.mainStep === 4) {
            syncMainContentActive('content_7');
            setActiveMirrorPage(7);
        }
        applyShellOffset();
        updateNativeNavUi();
        updateQuickFillFab();
    }


    // 功能：在新UI可见时隐藏原生翻页按钮。
    function updateNativeNavUi() {
        const on = state.uiVisible && (state.mainStep === 1 || state.mainStep === 2);
        document.documentElement.classList.toggle('tmk-pnr-hide-native-nav', on);
    }


    // 功能：按当前步骤控制AHL/详细 “完成” 按钮显示。
    function updateQuickFillFab() {
        const fab = document.getElementById(QUICK_FILL_FAB_ID);
        const detailFab = document.getElementById(DETAIL_QUICK_FILL_FAB_ID);
        const prev = document.getElementById(PREVIEW_BTN_ID);
        const slot = document.getElementById(PREVIEW_SLOT_ID);
        const actionBar = document.getElementById(ACTION_BAR_ID);
        const on = state.uiVisible && (state.mainStep === 1 || state.mainStep === 2);
        const quickOn = on && state.quickReady && state.mainStep === 1;
        const detailOn = on && state.mainStep === 2;
        if (fab) fab.classList.toggle('tmk-pnr-qf-fab--on', quickOn);
        if (detailFab) detailFab.classList.toggle('tmk-pnr-qf-fab-detail--on', detailOn);
        if (prev) prev.classList.toggle('tmk-pnr-qf-preview--on', quickOn);
        if (slot) slot.classList.toggle('tmk-pnr-qf-preview--on', quickOn);
        if (actionBar) actionBar.classList.toggle('tmk-pnr-qf-action-bar--on', quickOn);
    }


    function syncRadiosFromState() {
        const v = String(state.mainStep);
        const radio = document.querySelector('input[name="tmk-pnr-step"][value="' + v + '"]');
        if (radio) radio.checked = true;
    }


    // 功能：绑定覆盖层步骤与AHL输入事件。
    function bindShellEvents() {
        document.querySelectorAll('input[name="tmk-pnr-step"]').forEach(function(r) {
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


    // 功能：读取全局关闭时间戳，仅做状态消费不切换视图。
    function enforceUiGlobalControl() {
        const forceTs = readForceCloseViewsTs();
        if (forceTs > state.lastForceCloseTs) {
            state.lastForceCloseTs = forceTs;
        }
    }


    // 功能：切换新UI显示状态（仅隐藏/显示覆盖层）。
    function setUiVisible(visible) {
        state.uiVisible = visible !== false;
        function readOverlayRefs() {
            return [
                document.getElementById(TOOLBAR_ID),
                document.getElementById(STEPPER_BAR_ID),
                document.getElementById(SHELL_ID),
                document.getElementById(STAGE_ID),
                document.getElementById(GLASS_ID)
            ];
        }
        if (state.uiVisible) {
            document.documentElement.classList.add(MODE_CLASS);
            mountStage();
            mountDetailQuickFillFab();
            if (state.glass) state.glass.style.display = 'block';
            readOverlayRefs().forEach(function(el) {
                if (el) el.classList.remove('tmk-ui-hidden');
            });
            applyPaneVisibility();
        } else {
            document.documentElement.classList.remove(MODE_CLASS);
            document.documentElement.classList.remove('tmk-pnr-hide-native-nav');
            if (state.glass) state.glass.style.display = 'none';
            readOverlayRefs().forEach(function(el) {
                if (el && el.id !== TOOLBAR_ID) el.classList.add('tmk-ui-hidden');
            });
            applyPaneVisibility();
        }
        updateToolbarButtons();
    }


    // 功能：挂载详细页“完成”按钮到覆盖层舞台。
    function mountDetailQuickFillFab() {
        let detailFab = document.getElementById(DETAIL_QUICK_FILL_FAB_ID);
        if (!detailFab) {
            detailFab = document.createElement('button');
            detailFab.id = DETAIL_QUICK_FILL_FAB_ID;
            detailFab.type = 'button';
            detailFab.className = 'tmk-pnr-qf-action';
            detailFab.setAttribute('title', '完成');
            detailFab.textContent = '新增AHL';
            detailFab.addEventListener('click', function() {
                runFabSubmit();
            });
        }
        const stageForFab = document.getElementById(STAGE_ID);
        if (stageForFab && detailFab.parentNode !== stageForFab) stageForFab.appendChild(detailFab);
    }


    // 功能：挂载覆盖层UI并初始化事件。
    function mount() {
        injectStyles();
        mountGlassLayer();
        renderToolbar();
        applyLeftGap();
        if (document.getElementById(SHELL_ID)) {
            mountStage();
            return true;
        }
        const stepBar = document.createElement('div');
        stepBar.id = STEPPER_BAR_ID;
        stepBar.className = 'tmk-pnr-stepper-bar';
        stepBar.innerHTML = buildStepperHtml();
        document.body.appendChild(stepBar);
        const shell = document.createElement('div');
        shell.id = SHELL_ID;
        shell.innerHTML = buildQuickHtml();
        document.body.appendChild(shell);
        state.shell = shell;
        mountStage();
        if (!document.getElementById(QUICK_FILL_FAB_ID)) {
            const fab = document.createElement('button');
            fab.id = QUICK_FILL_FAB_ID;
            fab.type = 'button';
            fab.className = 'tmk-pnr-qf-action';
            fab.setAttribute('title', '颜色类型 CT 段数 = 行李牌 TN 数量；NW 总件数 = TN 数量。「预览」校验并写入后进入「详细」。');
            fab.textContent = '新增';
            fab.addEventListener('click', function() {
                runFabSubmit();
            });
            const actionBar = document.getElementById(ACTION_BAR_ID);
            if (actionBar) actionBar.appendChild(fab);
            else shell.appendChild(fab);
        }
        mountDetailQuickFillFab();
        if (!document.getElementById(PREVIEW_BTN_ID)) {
            const prev = document.createElement('button');
            prev.id = PREVIEW_BTN_ID;
            prev.type = 'button';
            prev.className = 'tmk-pnr-qf-action tmk-pnr-qf-preview-btn';
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
        buildInfoStageButtons();
        bindShellEvents();
        syncRadiosFromState();
        applyPaneVisibility();
        state.lastForceCloseTs = readForceCloseViewsTs();
        setUiVisible(true);
        window.setInterval(function() {
            enforceUiGlobalControl();
            tryMarkQuickReady();
        }, 400);
        setTimeout(tryMarkQuickReady, 0);
        setTimeout(syncFabLabelFromDom, 500);
        setTimeout(syncThemeVarsFromUi, 0);
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


    // 功能：检测页面就绪后触发挂载。
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


    // 功能：启动入口轮询，直到挂载成功。
    function bootstrap() {
        applyLeftGap();
        if (tryBootstrap()) return;
        setTimeout(bootstrap, 600);
    }


    bootstrap();
})();
