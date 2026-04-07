// ==UserScript==
// @name         BCheckWeb 少收表 v2 覆盖层
// @namespace    http://tampermonkey.net/
// @version      2.0.8
// @description  新建少收编辑页：玻璃+fixed 壳+步骤条；不搬动 #content_* DOM；第一页对齐快捷表单写回；与少收表 v1 请勿同时启用
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
    const PAGE_RE = /newNullBaggageLost_newBaggageLostAction\.action/i;
    const INIT_FLAG = '__tmkLostFormV2Inited';
    const STYLE_ID = 'tmk-lostform-v2-style';
    const GLASS_ID = 'tmk-lostform-v2-glass';
    const TOOLBAR_ID = 'tmk-lostform-v2-toolbar';
    const SHELL_ID = 'tmk-lostform-v2-shell';
    const MODE_CLASS = 'tmk-lostform-v2-modern';
    const DEFAULT_CP = '3102151188';
    const CT_PATTERN = /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/;
    const state = {
        mode: 'modern',
        mainStep: 1,
        subStep36: 2,
        glass: null,
        shell: null,
        capsLockActive: false,
        observer: null,
        content1FsBound: false
    };
    if (!PAGE_RE.test(String(window.location.href || ''))) return;
    if (!isContentFrame()) return;
    if (window[INIT_FLAG]) return;
    window[INIT_FLAG] = true;


    function isContentFrame() {
        try {
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


    function applyLeftGap() {
        if (!document.documentElement) return;
        document.documentElement.style.setProperty('--tmk-left-gap', `${calcLeftGap()}px`);
        applyTmkTileVars();
        applyQfCols();
        applyNarrowShellVars();
    }


    function applyShellOffset() {
        const shell = document.getElementById(SHELL_ID);
        if (!shell || !document.documentElement) return;
        const h = shell.offsetHeight || 0;
        const top = 72;
        document.documentElement.style.setProperty('--tmk-lostform-v2-shell-h', `${h}px`);
        document.documentElement.style.setProperty('--tmk-lostform-v2-body-pad', `${top + h + 8}px`);
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


    function resolveFieldRefs(cd) {
        const allInputs = collectCandidateInputs(cd);
        const tnBySel = matchBySelectors(cd, [
            'input[data-name*="行李号"]',
            'input[name*="tag"]',
            'input[name*="baggageNum"]',
            'input[id*="tn"]'
        ]);
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
            'input[name*="familyPhone"]',
            'input[name*="fTelNum"]',
            'input[name*="homePhone"]'
        ]);
        const cpBySel = matchBySelectors(cd, [
            'input[name*="mobile"]',
            'input[name*="cell"]',
            'input[name*="cp"]'
        ]);
        const tnFallback = matchByKeywords(allInputs, ['行李号', ' tn']);
        const ctFallback = matchByKeywords(allInputs, ['颜色类型', ' ct']);
        const bwFallback = matchByKeywords(allInputs, ['总件数/重量', ' bw']);
        const nwFallback = matchByKeywords(allInputs, ['丢失件数/重量', ' nw']);
        const paFallback = matchByKeywords(allInputs, ['永久地址', ' pa']);
        const familyFallback = matchByKeywords(allInputs, ['家庭电话', '住宅电话']);
        const cpFallback = matchByKeywords(allInputs, ['移动电话', '手机', ' cp']);
        return {
            tnInputs: uniqueElements([...tnBySel, ...tnFallback]).filter(isVisible).slice(0, 10),
            ctInputs: uniqueElements([...ctBySel, ...ctFallback]).filter(isVisible).slice(0, 10),
            bwInput: uniqueElements([...bwBySel, ...bwFallback]).find(isVisible) || null,
            nwInput: uniqueElements([...nwBySel, ...nwFallback]).find(isVisible) || null,
            paInput: uniqueElements([...paBySel, ...paFallback]).find(isVisible) || null,
            familyInput: uniqueElements([...familyBySel, ...familyFallback]).find(isVisible) || null,
            cpInput: uniqueElements([...cpBySel, ...cpFallback]).find(isVisible) || null
        };
    }


    function getTnCount(cd, refs) {
        const filled = refs.tnInputs.filter((input) => input.value && input.value.trim() !== '');
        if (filled.length > 0) return filled.length;
        const amountSelect = cd.getElementById('l_baggageSelect');
        if (amountSelect) {
            const optionVal = amountSelect.options[amountSelect.selectedIndex] ? amountSelect.options[amountSelect.selectedIndex].value || amountSelect.value : amountSelect.value;
            const parsed = parseInt(optionVal, 10);
            if (!Number.isNaN(parsed) && parsed > 0) return Math.min(parsed, 10);
        }
        return 0;
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


    function getQuickInputs() {
        return {
            ct: document.getElementById('tmk-lostform-v2-qf-ct'),
            pa: document.getElementById('tmk-lostform-v2-qf-pa'),
            family: document.getElementById('tmk-lostform-v2-qf-family'),
            cp: document.getElementById('tmk-lostform-v2-qf-cp'),
            previewBtn: document.getElementById('tmk-lostform-v2-qf-preview')
        };
    }


    function applyQuickFill() {
        const cd = document;
        const refs = resolveFieldRefs(cd);
        const tnCount = getTnCount(cd, refs);
        const qi = getQuickInputs();
        const ctRaw = qi.ct ? qi.ct.value.trim() : '';
        const paRaw = qi.pa ? qi.pa.value.trim() : '';
        const familyRaw = qi.family ? qi.family.value.trim() : '';
        const cpRaw = (qi.cp ? qi.cp.value : DEFAULT_CP) || DEFAULT_CP;
        if (qi.cp) qi.cp.value = cpRaw.trim() || DEFAULT_CP;
        if (ctRaw) {
            if (!state.capsLockActive) return { ok: false, message: '请输入 CT 前请先开启 Caps Lock。' };
            const ctSegments = splitCtValues(ctRaw);
            if (tnCount === 0) return { ok: false, message: '未识别到有效 TN，无法分配 CT。' };
            if (ctSegments.length !== tnCount) return { ok: false, message: 'CT 段数(' + ctSegments.length + ')与 TN 数量(' + tnCount + ')不一致。' };
            if (refs.ctInputs.length < tnCount) return { ok: false, message: 'CT 输入框数量不足，识别到 ' + refs.ctInputs.length + ' 个。' };
            for (let i = 0; i < ctSegments.length; i += 1) {
                if (!CT_PATTERN.test(ctSegments[i])) return { ok: false, message: '第 ' + (i + 1) + ' 段 CT 格式错误：' + ctSegments[i] };
            }
            ctSegments.forEach((segment, idx) => setInputValue(refs.ctInputs[idx], segment));
        }
        if (tnCount > 0) {
            if (!refs.bwInput || !refs.nwInput) return { ok: false, message: '未识别到 BW 或 NW 输入框，无法自动计算 NW。' };
            const bw = parseBwValue(refs.bwInput.value);
            if (!bw) return { ok: false, message: 'BW 格式错误：' + (refs.bwInput.value || '(空)') + '，应为 件数/重量。' };
            const unitWeight = bw.weight / bw.pieces;
            const nwWeight = Math.floor(unitWeight * tnCount);
            setInputValue(refs.nwInput, tnCount + '/' + nwWeight);
        }
        if (paRaw) {
            if (!refs.paInput) return { ok: false, message: '未找到 PA(永久地址) 输入框。' };
            setInputValue(refs.paInput, paRaw);
        }
        if (familyRaw) {
            if (!refs.familyInput) return { ok: false, message: '未找到家庭电话输入框。' };
            setInputValue(refs.familyInput, familyRaw);
        }
        if (refs.cpInput && !refs.cpInput.value.trim()) setInputValue(refs.cpInput, cpRaw.trim() || DEFAULT_CP);
        return { ok: true, message: '快捷填充完成。' };
    }


    function previewQuickFill() {
        const result = applyQuickFill();
        if (!result.ok) window.alert(result.message);
    }


    // 毛玻璃层在底层；壳与当前可见的 #content_* 用更高 z-index 叠在玻璃之上，避免表单被 backdrop-filter 糊住。
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            'html.' + MODE_CLASS + ',',
            'html.' + MODE_CLASS + ' body {',
            '  background: transparent !important;',
            '  color: #111111 !important;',
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
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' .l_header { display: none !important; }',
            'html.' + MODE_CLASS + ' #' + GLASS_ID + ' { display: block !important; }',
            'html.' + MODE_CLASS + ' #' + SHELL_ID + ' { display: block !important; }',
            'html.' + MODE_CLASS + ' #float-action-box { display: none !important; }',
            '#' + GLASS_ID + ' {',
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: 2147483644;',
            '  display: none;',
            '  background: rgba(223, 230, 238, 0.4);',
            '  backdrop-filter: blur(10px);',
            '  -webkit-backdrop-filter: blur(10px);',
            '  pointer-events: none;',
            '}',
            '#' + TOOLBAR_ID + ' {',
            '  position: fixed;',
            '  top: 10px;',
            '  right: 12px;',
            '  z-index: 2147483647;',
            '  display: inline-flex;',
            '  align-items: center;',
            '  gap: 6px;',
            '  padding: 5px;',
            '  border-radius: 999px;',
            '  background: rgba(255, 255, 255, 0.75);',
            '  border: 1px solid #9db8d2;',
            '  box-shadow: 0 6px 16px rgba(23, 52, 86, 0.16);',
            '  backdrop-filter: blur(8px);',
            '  -webkit-backdrop-filter: blur(8px);',
            '}',
            '.tmk-lostform-v2-tb-btn {',
            '  min-height: 30px;',
            '  padding: 0 12px;',
            '  border-radius: 999px;',
            '  border: 1px solid #8fb1cc;',
            '  background: #ffffff;',
            '  color: #1a3a5a;',
            '  font-size: 14px;',
            '  font-weight: 600;',
            '  cursor: pointer;',
            '}',
            '.tmk-lostform-v2-tb-btn.tmk-active {',
            '  background: #3f89d0;',
            '  border-color: #3f89d0;',
            '  color: #ffffff;',
            '}',
            '#' + SHELL_ID + ' {',
            '  display: none;',
            '  position: fixed;',
            '  top: 72px;',
            '  left: var(--tmk-left-gap, 16px);',
            '  z-index: 2147483646;',
            '  width: calc(100vw - var(--tmk-left-gap, 16px) - var(--tmk-lostform-v2-shell-right, 24px));',
            '  max-width: calc(100vw - var(--tmk-left-gap, 16px) - var(--tmk-lostform-v2-shell-right, 24px));',
            '  max-height: calc(100vh - 92px);',
            '  overflow-x: hidden;',
            '  overflow-y: auto;',
            '  box-sizing: border-box;',
            '  padding: var(--tmk-lostform-v2-shell-pad-top, 10px) var(--tmk-lostform-v2-shell-pad-x, 12px) var(--tmk-lostform-v2-shell-pad-bot, 14px) var(--tmk-lostform-v2-shell-pad-x, 12px);',
            '  background: rgba(223, 230, 238, 0.7);',
            '  border: 1px solid rgba(151, 177, 203, 0.45);',
            '  border-radius: 12px;',
            '  backdrop-filter: blur(10px);',
            '  -webkit-backdrop-filter: blur(10px);',
            '  box-shadow: 0 10px 24px rgba(37, 64, 92, 0.16);',
            '  pointer-events: auto;',
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
            '  border-radius: 50%;',
            '  border: 2px solid #1e6fd9;',
            '  background: #fff;',
            '  box-sizing: border-box;',
            '  flex-shrink: 0;',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  position: relative;',
            '}',
            '.tmk-lostform-v2-step-node input:checked + label .tmk-lostform-v2-step-ring::after {',
            '  content: "";',
            '  width: 8px;',
            '  height: 8px;',
            '  border-radius: 50%;',
            '  background: #1e6fd9;',
            '  display: block;',
            '}',
            '.tmk-lostform-v2-step-connector {',
            '  flex: 1 1 12px;',
            '  height: 2px;',
            '  background: #1e6fd9;',
            '  margin: 0 4px;',
            '  min-width: 8px;',
            '  opacity: 0.85;',
            '  align-self: center;',
            '}',
            '.tmk-lostform-v2-step-text {',
            '  margin-left: 6px;',
            '  font-size: 13px;',
            '  color: #1a2b3c;',
            '  white-space: nowrap;',
            '  overflow: hidden;',
            '  text-overflow: ellipsis;',
            '}',
            '.tmk-lostform-v2-step-node input:focus + label .tmk-lostform-v2-step-ring {',
            '  outline: 2px solid rgba(30, 111, 217, 0.45);',
            '  outline-offset: 2px;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-panel {',
            '  margin: 12px var(--tmk-lostform-v2-c1-panel-mx, 15px);',
            '  width: calc(100% - 2 * var(--tmk-lostform-v2-c1-panel-mx, 15px));',
            '  max-width: none;',
            '  box-sizing: border-box;',
            '  border: 1px solid #d7dee7;',
            '  border-radius: 12px;',
            '  overflow: hidden;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-toggle {',
            '  display: block;',
            '  width: 100%;',
            '  min-height: 66px;',
            '  text-align: left;',
            '  border: none;',
            '  background: #eef3f8;',
            '  font-size: 23px;',
            '  font-weight: 600;',
            '  padding: 18px 24px;',
            '  cursor: pointer;',
            '  box-sizing: border-box;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body {',
            '  padding: 12px 0;',
            '  border-top: 1px solid #dde4ec;',
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
            '  grid-template-columns: repeat(var(--tmk-qf-cols, 1), minmax(0, 1fr)) !important;',
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
            '  display: flex !important;',
            '  flex-direction: column !important;',
            '  flex-wrap: nowrap !important;',
            '  align-items: stretch !important;',
            '  gap: 6px !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .ui-grid-a > [class*="ui-block-"] {',
            '  width: 100% !important;',
            '  flex: 0 0 auto !important;',
            '  min-width: 0 !important;',
            '  max-width: 100% !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .l_right {',
            '  text-align: left !important;',
            '  font-size: 18px !important;',
            '  color: #14365f !important;',
            '  line-height: 1.35 !important;',
            '}',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body .l_right .l_notNull {',
            '  font-size: 18px !important;',
            '  color: #c62828 !important;',
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
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body input:not([type]),',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body select,',
            'html.' + MODE_CLASS + ' #content_1 .tmk-lostform-v2-fs-body textarea {',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  min-width: 0 !important;',
            '  min-height: 42px !important;',
            '  height: auto !important;',
            '  padding: 6px 9px !important;',
            '  border-width: 1px !important;',
            '  border-style: solid !important;',
            '  border-color: #9cc0ef !important;',
            '  border-radius: 9px !important;',
            '  background: #fff !important;',
            '  background-clip: padding-box !important;',
            '  color: #111 !important;',
            '  font-size: 18px !important;',
            '  line-height: 1.35 !important;',
            '  box-sizing: border-box !important;',
            '  box-shadow: none !important;',
            '  outline: none !important;',
            '  margin: 0 !important;',
            '  float: none !important;',
            '  -webkit-appearance: none;',
            '  appearance: none;',
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
            '  border-color: #1e6fd9 !important;',
            '  box-shadow: 0 0 0 2px rgba(30, 111, 217, 0.28) !important;',
            '  outline: none !important;',
            '}',
            '#tmk-lostform-v2-quick { margin-top: 4px; }',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-title {',
            '  font-size: 20px;',
            '  font-weight: 700;',
            '  color: #0f3f7f;',
            '  margin: 0 0 12px 0;',
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
            '  flex-direction: column;',
            '  gap: 6px;',
            '  min-width: 0;',
            '}',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-field .tmk-lostform-v2-qf-label {',
            '  margin-top: 0;',
            '}',
            '#tmk-lostform-v2-quick .tmk-lostform-v2-qf-label {',
            '  font-size: 18px;',
            '  color: #14365f;',
            '  display: block;',
            '}',
            '#tmk-lostform-v2-quick input {',
            '  width: 100%;',
            '  min-height: 42px;',
            '  padding: 6px 9px;',
            '  border: 1px solid #9cc0ef;',
            '  border-radius: 9px;',
            '  background: #fff;',
            '  color: #111;',
            '  box-sizing: border-box;',
            '  font-size: 18px;',
            '}',
            '#tmk-lostform-v2-qf-preview {',
            '  margin-top: 12px;',
            '  width: 100%;',
            '  min-height: 45px;',
            '  border: 2px solid rgba(255,255,255,0.4);',
            '  border-radius: 9px;',
            '  background: rgba(0, 123, 255, 0.35);',
            '  color: #fff;',
            '  font-size: 21px;',
            '  font-weight: bold;',
            '  cursor: pointer;',
            '}',
            '#tmk-lostform-v2-qf-hint {',
            '  font-size: 17px;',
            '  color: #4a5d78;',
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
            '  border: 1px solid #7ea2c1;',
            '  border-radius: 6px;',
            '  background: #fff;',
            '  cursor: pointer;',
            '}',
            '.tmk-lostform-v2-sub-btn.is-active {',
            '  background: #3f89d0;',
            '  border-color: #3f89d0;',
            '  color: #fff;',
            '}',
            'html.' + MODE_CLASS + ' .tmk-lostform-v2-pane-hidden { display: none !important; }',
            'html.' + MODE_CLASS + ' #content_1:not(.tmk-lostform-v2-pane-hidden),',
            'html.' + MODE_CLASS + ' #content_2:not(.tmk-lostform-v2-pane-hidden),',
            'html.' + MODE_CLASS + ' #content_3:not(.tmk-lostform-v2-pane-hidden),',
            'html.' + MODE_CLASS + ' #content_4:not(.tmk-lostform-v2-pane-hidden),',
            'html.' + MODE_CLASS + ' #content_5:not(.tmk-lostform-v2-pane-hidden),',
            'html.' + MODE_CLASS + ' #content_6:not(.tmk-lostform-v2-pane-hidden),',
            'html.' + MODE_CLASS + ' #content_7:not(.tmk-lostform-v2-pane-hidden) {',
            '  display: block !important;',
            '  position: relative;',
            '  z-index: 2147483645;',
            '}',
            'html.' + MODE_CLASS + ' .l_footer {',
            '  position: relative;',
            '  z-index: 2147483645;',
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
            '<div id="tmk-lostform-v2-quick">' +
            '<p class="tmk-lostform-v2-qf-title">完成前快捷填充</p>' +
            '<div class="tmk-lostform-v2-qf-grid">' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-ct">CT（用 / 分隔）</label>' +
            '<input id="tmk-lostform-v2-qf-ct" type="text" placeholder="BK22RHW/RD01XXX" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-pa">PA 永久地址</label>' +
            '<input id="tmk-lostform-v2-qf-pa" type="text" placeholder="例如: 123 MAIN ST" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-family">家庭电话</label>' +
            '<input id="tmk-lostform-v2-qf-family" type="text" placeholder="数字" autocomplete="off" />' +
            '</div>' +
            '<div class="tmk-lostform-v2-qf-field">' +
            '<label class="tmk-lostform-v2-qf-label" for="tmk-lostform-v2-qf-cp">CP 移动电话</label>' +
            '<input id="tmk-lostform-v2-qf-cp" type="text" value="' + DEFAULT_CP + '" autocomplete="off" />' +
            '</div>' +
            '</div>' +
            '<button id="tmk-lostform-v2-qf-preview" type="button">内容预览</button>' +
            '<div id="tmk-lostform-v2-qf-hint">点击「内容预览」可先把上方内容填入网页。原版页面下仍可使用右侧快捷悬浮框。</div>' +
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
                panel.classList.toggle('is-collapsed');
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


    function applyPaneVisibility() {
        const ids = ['content_1', 'content_2', 'content_3', 'content_4', 'content_5', 'content_6', 'content_7'];
        const shell = document.getElementById(SHELL_ID);
        const quick = document.getElementById('tmk-lostform-v2-quick');
        const sub36 = document.getElementById('tmk-lostform-v2-sub36');
        if (state.mode !== 'modern') return;
        ids.forEach(function(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('tmk-lostform-v2-pane-hidden');
        });
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
        } else if (state.mainStep === 2) {
            const c = document.getElementById('content_1');
            if (c) c.classList.remove('tmk-lostform-v2-pane-hidden');
            syncMainContentActive('content_1');
            setupCollapsibleFieldsetsV2();
            markContent1HeaderRowHidden();
        } else if (state.mainStep === 3) {
            const c = document.getElementById('content_' + state.subStep36);
            if (c) c.classList.remove('tmk-lostform-v2-pane-hidden');
            syncMainContentActive('content_' + state.subStep36);
        } else if (state.mainStep === 4) {
            const c = document.getElementById('content_7');
            if (c) c.classList.remove('tmk-lostform-v2-pane-hidden');
            syncMainContentActive('content_7');
        }
        applyShellOffset();
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
        if (qi.previewBtn) qi.previewBtn.addEventListener('click', previewQuickFill);
    }


    function setMode(mode) {
        state.mode = mode === 'legacy' ? 'legacy' : 'modern';
        if (state.mode === 'legacy') {
            document.documentElement.classList.remove(MODE_CLASS);
            teardownContent1Collapsible();
            restoreContent1HeaderRowVisible();
            if (state.glass) state.glass.style.display = 'none';
            const shell = document.getElementById(SHELL_ID);
            if (shell) shell.style.display = 'none';
            document.documentElement.style.removeProperty('--tmk-lostform-v2-body-pad');
            ['content_1', 'content_2', 'content_3', 'content_4', 'content_5', 'content_6', 'content_7'].forEach(function(id) {
                const el = document.getElementById(id);
                if (el) el.classList.remove('tmk-lostform-v2-pane-hidden');
            });
        } else {
            document.documentElement.classList.add(MODE_CLASS);
            if (state.glass) state.glass.style.display = 'block';
            const shell = document.getElementById(SHELL_ID);
            if (shell) shell.style.display = 'block';
            applyPaneVisibility();
        }
        updateToolbarButtons();
    }


    function mount() {
        injectStyles();
        ensureGlass();
        renderToolbar();
        applyLeftGap();
        if (document.getElementById(SHELL_ID)) return true;
        const shell = document.createElement('div');
        shell.id = SHELL_ID;
        shell.innerHTML = buildStepperHtml() + buildQuickHtml();
        document.body.appendChild(shell);
        state.shell = shell;
        buildSub36Buttons();
        bindShellEvents();
        syncRadiosFromState();
        applyPaneVisibility();
        setMode('modern');
        window.addEventListener('resize', function() {
            applyLeftGap();
            applyShellOffset();
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
