// ==UserScript==
// @name         BCheckWeb 新建少收查询 Step2 离港结果壳层
// @namespace    http://tampermonkey.net/
// @version      1.4.5
// @description  第二步：无详情单选时自动选最后已勾选航段（含仅一段）
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
    // 仅在 content_frame + 离港结果 URL 挂载；原生 lgDisplay 移出视口保留事件；工具栏 ID/样式与 2.1 脚本一致便于日后合并。
    const STEP2_PATH = /baggageLostSearch_newBaggageLostAction\.action/i;
    const STYLE_ID = 'tmk-step2-style';
    const SHELL_ID = 'tmk-step2-shell';
    const TOOLBAR_ID = 'tmk-lqv2-toolbar';
    const GLASS_ID = 'tmk-lqv2-glass';
    const MODE_CLASS = 'tmk-step2-modern';
    const LAX_DEST = 'LAX';
    // 行李牌第 2–4 位（三位数字）→ 航空公司二字码（可扩充）
    const BAGGAGE_TRIPLE_TO_AIRLINE = Object.freeze({
        '999': 'CA',
        '784': 'CZ',
        '479': 'ZH',
        '324': 'SC'
    });
    const MONTH_EN3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const state = {
        mode: 'modern',
        shell: null,
        observer: null,
        observerRoot: null,
        pollId: null,
        syncTimer: null,
        laxAutoDoneByBlock: null
    };


    function isStep2Url() {
        return STEP2_PATH.test(String(window.location.href || ''));
    }


    function isContentFrame() {
        try {
            return window.frameElement && window.frameElement.id === 'content_frame';
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


    function textNorm(s) {
        return String(s || '').replace(/\s+/g, '').trim();
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
        const s = textNorm(area);
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
                const raw = numEl ? textNorm(numEl.textContent) : '';
                const tag = formatBaggageTagDisplay(raw);
                const area = textNorm(fl.area) || '—';
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
        const el = block.querySelector('#lgInfo_flightDel_' + idx) || document.getElementById('lgInfo_flightDel_' + idx);
        return textNorm(el && el.textContent).toUpperCase() === 'Y';
    }


    function isDestNotLax(destEl) {
        return textNorm(destEl && destEl.textContent).toUpperCase() !== LAX_DEST;
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
            return n ? textNorm(n.textContent) : '';
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
            return n ? textNorm(n.textContent) : '';
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
        const lv = textNorm(el('lgInfo_cardLevel_' + idx) && el('lgInfo_cardLevel_' + idx).textContent);
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


    function injectStyle(metrics) {
        if (!document.head) return;
        const m = metrics || getUiMetrics();
        if (document.documentElement) {
            document.documentElement.style.setProperty('--tmk-big-tile', `${m.bigTile}px`);
        }
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent = `
            :root {
                --tmk-step2-medium: ${m.medium}px;
                --tmk-step2-small: ${m.small}px;
                --tmk-step2-gap: ${m.gap}px;
                --tmk-step2-big-tile: ${m.bigTile}px;
            }
            html.${MODE_CLASS},
            html.${MODE_CLASS} body {
                background: transparent !important;
                color: #111111 !important;
                font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif !important;
            }
            html.${MODE_CLASS} .l_mainContentL1,
            html.${MODE_CLASS} #content_1,
            html.${MODE_CLASS} .ui-page,
            html.${MODE_CLASS} .ui-content {
                background: transparent !important;
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
            #${GLASS_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483644;
                display: none;
                pointer-events: none;
                background: rgba(223, 230, 238, 0.4);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            .${MODE_CLASS} #${GLASS_ID} {
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
            #${SHELL_ID} {
                box-sizing: border-box;
                position: fixed;
                top: 72px;
                left: var(--tmk-left-gap, 16px);
                z-index: 2147483646;
                width: calc(100vw - var(--tmk-left-gap, 16px) - 24px);
                max-width: calc(100vw - var(--tmk-left-gap, 16px) - 24px);
                max-height: calc(100vh - 92px);
                overflow: auto;
                padding: ${m.gap}px;
                border-radius: 12px;
                background: rgba(223, 230, 238, 0.7);
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
                lineA.textContent = textNorm(item.destEl.textContent) || '—';
                const lineB = document.createElement('div');
                lineB.textContent = numEl ? formatBaggageTagDisplay(textNorm(numEl.textContent)) : '';
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


    function ensureGlassLayer() {
        if (!document.body || document.getElementById(GLASS_ID)) return;
        const glass = document.createElement('div');
        glass.id = GLASS_ID;
        document.body.appendChild(glass);
    }


    function renderToolbar() {
        if (!document.body || document.getElementById(TOOLBAR_ID)) return;
        const toolbar = document.createElement('div');
        toolbar.id = TOOLBAR_ID;
        toolbar.innerHTML = '<button class="tmk-lqv2-btn tmk-active" data-mode="modern" type="button">现代视图</button>' +
            '<button class="tmk-lqv2-btn" data-mode="legacy" type="button">旧版页面</button>';
        document.body.appendChild(toolbar);
        toolbar.addEventListener('click', function(event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const mode = target.getAttribute('data-mode');
            if (!mode) return;
            state.mode = mode === 'legacy' ? 'legacy' : 'modern';
            applyModeUI();
            if (state.shell) syncMirrorsFromDom(state.shell);
        });
    }


    function updateToolbar() {
        const toolbar = document.getElementById(TOOLBAR_ID);
        if (!toolbar) return;
        toolbar.querySelectorAll('.tmk-lqv2-btn').forEach(function(btn) {
            const active = btn.getAttribute('data-mode') === state.mode;
            btn.classList.toggle('tmk-active', active);
        });
    }


    function applyModeUI() {
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
        updateToolbar();
    }


    function mountShell() {
        const blocks = getLgBlocks();
        if (!blocks.length) return false;
        const first = blocks[0];
        const parent = first.parentNode;
        if (!parent) return false;
        applyLeftGap();
        injectStyle(getUiMetrics());
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
            bn.textContent = textNorm(newOrig.textContent) || '新建';
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
        state.mode = 'modern';
        applyModeUI();
        renderSegmentRows(shell);
        window.addEventListener('resize', function() {
            applyLeftGap();
            injectStyle(getUiMetrics());
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


    function init() {
        if (!isStep2Url() || !isContentFrame()) return;
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


    init();
})();
