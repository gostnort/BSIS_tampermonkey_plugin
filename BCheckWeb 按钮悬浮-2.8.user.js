// ==UserScript==
// @name         BCheckWeb 按钮悬浮
// @namespace    http://tampermonkey.net/
// @version      2.8
// @description  保留原始按钮，抓取成功才显示悬浮框，集成所有特调 ID
// @author       Gostnort & Gemini
// @match        http://60.247.100.98/BCheckWeb/*
// @match        http://202.96.17.98/BCheckWeb/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    const inTopWindow = window.top === window.self;
    const inContentFrame = !inTopWindow && window.frameElement && window.frameElement.id === 'content_frame';
    if (!inTopWindow && !inContentFrame) return;
    const DEFAULT_CP = '3102151188';
    const CT_PATTERN = /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/;

    GM_addStyle(`
        #float-action-box {
            position: fixed !important;
            right: 10px !important;
            top: 40px !important;
            z-index: 2147483647 !important;
            display: none;
            flex-direction: column !important;
            gap: 8px !important;
            width: 140px !important;
            max-height: calc(100vh - 48px) !important;
            overflow-y: auto !important;
            background: rgba(255, 255, 255, 0.4) !important;
            padding: 8px !important;
            border: 1px solid #007bff !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
            box-sizing: border-box !important;
        }
        #quick-fill-panel {
            display: none;
            flex-direction: column !important;
            gap: 6px !important;
            padding: 6px !important;
            border: 1px solid #d6e6ff !important;
            border-radius: 8px !important;
            background: rgba(238, 246, 255, 0.4) !important;
        }
        #quick-fill-panel .qf-title {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #0f3f7f !important;
            margin: 0 !important;
        }
        #quick-fill-panel .qf-label {
            font-size: 12px !important;
            color: #14365f !important;
            margin-top: 2px !important;
        }
        #quick-fill-panel input {
            width: 100% !important;
            min-height: 28px !important;
            padding: 4px 6px !important;
            border: 1px solid #9cc0ef !important;
            border-radius: 6px !important;
            background: #ffffff !important;
            color: #111 !important;
            box-sizing: border-box !important;
            font-size: 12px !important;
        }
        #quick-fill-hint {
            font-size: 11px !important;
            color: #4a5d78 !important;
            line-height: 1.35 !important;
        }
        .qf-action-row {
            display: flex !important;
            gap: 6px !important;
            margin-top: 4px !important;
        }
        #qf-preview-btn {
            width: 100% !important;
            min-height: 30px !important;
            border: 2px solid rgba(255, 255, 255, 0.4) !important;
            border-radius: 6px !important;
            background-color: rgba(0, 123, 255, 0.4) !important;
            color: #ffffff !important;
            font-size: 14px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            padding: 5px !important;
            box-sizing: border-box !important;
        }
        #clone-btn-host {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
        }
        .my-clone-btn {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            min-height: 40px !important;
            background-color: rgba(0, 123, 255, 0.4) !important;
            color: #ffffff !important;
            border: 2px solid rgba(255, 255, 255, 0.4) !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            margin: 0 !important;
            padding: 5px !important;
            list-style: none !important;
            text-align: center !important;
            box-sizing: border-box !important;
        }
        .my-clone-btn:hover {
            background-color: #0056b3 !important;
            border-color: #ffffff !important;
        }
        #qf-preview-btn:hover {
            border-color: #ffffff !important;
            background-color: #0056b3 !important;
        }
        .my-clone-btn.finish-clone {
            background-color: rgba(40, 167, 69, 0.4) !important;
        }
        .my-clone-btn.finish-clone:hover {
            background-color: #28a745 !important;
            border-color: #ffffff !important;
        }
    `);

    const container = document.createElement('div');
    container.id = 'float-action-box';
    const quickPanel = document.createElement('div');
    quickPanel.id = 'quick-fill-panel';
    quickPanel.innerHTML = `
        <p class="qf-title">完成前快捷填充</p>
        <label class="qf-label" for="qf-ct">CT（用 / 分隔）</label>
        <input id="qf-ct" type="text" placeholder="BK22RHW/RD01XXX">
        <label class="qf-label" for="qf-pa">PA 永久地址</label>
        <input id="qf-pa" type="text" placeholder="例如: 123 MAIN ST">
        <label class="qf-label" for="qf-family">家庭电话</label>
        <input id="qf-family" type="text" placeholder="数字">
        <label class="qf-label" for="qf-cp">CP 移动电话</label>
        <input id="qf-cp" type="text" value="${DEFAULT_CP}">
        <div class="qf-action-row">
            <button id="qf-preview-btn" type="button">内容预览</button>
        </div>
        <div id="quick-fill-hint">点击“内容预览”可先把上方内容填入网页；点击“完成”时会再次执行填充后再提交。</div>
    `;
    const cloneHost = document.createElement('div');
    cloneHost.id = 'clone-btn-host';
    container.appendChild(quickPanel);
    container.appendChild(cloneHost);
    document.body.appendChild(container);
    const quickInputs = {
        ct: quickPanel.querySelector('#qf-ct'),
        pa: quickPanel.querySelector('#qf-pa'),
        family: quickPanel.querySelector('#qf-family'),
        cp: quickPanel.querySelector('#qf-cp'),
        previewBtn: quickPanel.querySelector('#qf-preview-btn')
    };
    let capsLockActive = false;

    function getWorkingDoc() {
        if (inContentFrame) return document;
        try {
            const frame = document.getElementById('content_frame');
            if (frame && frame.contentWindow && frame.contentWindow.document) return frame.contentWindow.document;
        } catch (error) {}
        return document;
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
            input.parentElement?.previousElementSibling?.textContent || '',
            input.closest('.ui-grid-a, .ui-grid-b, .ui-grid-c, tr, td, div')?.textContent || ''
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
            const optionVal = amountSelect.options[amountSelect.selectedIndex]?.value || amountSelect.value;
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
        return { pieces, weight };
    }


    function splitCtValues(raw) {
        return raw.split('/').map((part) => part.trim().toUpperCase()).filter(Boolean);
    }


    function previewQuickFill() {
        const result = applyQuickFill();
        if (!result.ok) {
            window.alert(result.message);
            return;
        }
    }


    function applyQuickFill() {
        const cd = getWorkingDoc();
        const refs = resolveFieldRefs(cd);
        const tnCount = getTnCount(cd, refs);
        const ctRaw = quickInputs.ct.value.trim();
        const paRaw = quickInputs.pa.value.trim();
        const familyRaw = quickInputs.family.value.trim();
        const cpRaw = (quickInputs.cp.value || DEFAULT_CP).trim();
        quickInputs.cp.value = cpRaw || DEFAULT_CP;
        if (ctRaw) {
            if (!capsLockActive) return { ok: false, message: '请输入 CT 前请先开启 Caps Lock。' };
            const ctSegments = splitCtValues(ctRaw);
            if (tnCount === 0) return { ok: false, message: '未识别到有效 TN，无法分配 CT。' };
            if (ctSegments.length !== tnCount) return { ok: false, message: `CT 段数(${ctSegments.length})与 TN 数量(${tnCount})不一致。` };
            if (refs.ctInputs.length < tnCount) return { ok: false, message: `CT 输入框数量不足，识别到 ${refs.ctInputs.length} 个。` };
            for (let i = 0; i < ctSegments.length; i += 1) {
                if (!CT_PATTERN.test(ctSegments[i])) return { ok: false, message: `第 ${i + 1} 段 CT 格式错误：${ctSegments[i]}` };
            }
            ctSegments.forEach((segment, idx) => setInputValue(refs.ctInputs[idx], segment));
        }
        if (tnCount > 0) {
            if (!refs.bwInput || !refs.nwInput) return { ok: false, message: '未识别到 BW 或 NW 输入框，无法自动计算 NW。' };
            const bw = parseBwValue(refs.bwInput.value);
            if (!bw) return { ok: false, message: `BW 格式错误：${refs.bwInput.value || '(空)'}，应为 件数/重量。` };
            const unitWeight = bw.weight / bw.pieces;
            const nwWeight = Math.floor(unitWeight * tnCount);
            setInputValue(refs.nwInput, `${tnCount}/${nwWeight}`);
        }
        if (paRaw) {
            if (!refs.paInput) return { ok: false, message: '未找到 PA(永久地址) 输入框。' };
            setInputValue(refs.paInput, paRaw);
        }
        if (familyRaw) {
            if (!refs.familyInput) return { ok: false, message: '未找到家庭电话输入框。' };
            setInputValue(refs.familyInput, familyRaw);
        }
        if (refs.cpInput && !refs.cpInput.value.trim()) setInputValue(refs.cpInput, cpRaw || DEFAULT_CP);
        return { ok: true, message: '快捷填充完成。' };
    }


    function createClone(originalEl) {
        const clone = document.createElement('div');
        const text = (originalEl.innerText || originalEl.value || '按钮').trim();
        const isFinish = originalEl.id === 'finish' || text.includes('完成');
        clone.className = 'my-clone-btn';
        clone.innerText = text;
        if (isFinish) clone.classList.add('finish-clone');
        clone.onclick = () => {
            if (!isFinish) {
                originalEl.click();
                return;
            }
            const result = applyQuickFill();
            if (!result.ok) {
                window.alert(result.message);
                return;
            }
            originalEl.click();
        };
        cloneHost.appendChild(clone);
        return isFinish;
    }


    quickInputs.ct.addEventListener('input', () => {
        quickInputs.ct.value = quickInputs.ct.value.toUpperCase();
    });
    quickInputs.ct.addEventListener('keydown', (event) => {
        capsLockActive = !!event.getModifierState && event.getModifierState('CapsLock');
    });
    quickInputs.ct.addEventListener('keyup', (event) => {
        capsLockActive = !!event.getModifierState && event.getModifierState('CapsLock');
    });
    quickInputs.previewBtn.addEventListener('click', previewQuickFill);


    function snatch() {
        const cd = getWorkingDoc();
        const targetIds = ['l_search', 'newBaggageLostBtn', 'back', 'finish', 'clear', 'next', 'pre'];
        const fromIds = targetIds.map((id) => cd.getElementById(id)).filter((el) => el && isVisible(el));
        const bottomBtns = Array.from(cd.querySelectorAll('.l_bottom .l_btn, .l_bottom button')).filter(isVisible);
        const controlBtns = Array.from(cd.querySelectorAll('.ui-controlgroup-controls label.ui-btn')).filter((lbl) => {
            const text = lbl.innerText.trim();
            return isVisible(lbl) && (/^\d+%$/.test(text) || /^[A-Z]$/.test(text));
        });
        const targets = uniqueElements([...fromIds, ...bottomBtns, ...controlBtns]);
        cloneHost.innerHTML = '';
        let hasFinish = false;
        targets.forEach((target) => {
            if (createClone(target)) hasFinish = true;
        });
        quickPanel.style.display = hasFinish ? 'flex' : 'none';
        container.style.display = targets.length > 0 ? 'flex' : 'none';
    }


    setInterval(snatch, 1500);
    snatch();
})();