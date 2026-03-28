// ==UserScript==
// @name         BCheckWeb 按钮悬浮
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  保留原始按钮，抓取成功才显示悬浮框，集成所有特调 ID
// @author       Gemini
// @match        http://60.247.100.98/BCheckWeb/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 1. 样式定义：初始状态 display: none (隐藏)
    GM_addStyle(`
        #float-action-box {
            position: fixed !important;
            right: 10px !important;
            top: 40px !important;
            z-index: 2147483647 !important;
            display: none; /* 默认隐藏，有按钮时 JS 会改为 flex */
            flex-direction: column !important;
            gap: 8px !important;
            width: 110px !important;
            background: rgba(255, 255, 255, 0.5) !important;
            padding: 8px !important;
            border: 1px solid #007bff !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        }

        /* 统一分身按钮的外观 */
        .my-clone-btn {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            min-height: 40px !important;
            background-color: #007bff !important;
            color: #ffffff !important;
            border: 2px solid #ffffff !important;
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
        .my-clone-btn:hover { background-color: #0056b3 !important; }
    `);

    // 创建容器
    const container = document.createElement('div');
    container.id = 'float-action-box';
    document.body.appendChild(container);

    // 核心函数：创建点击同步的分身
    function createClone(originalEl) {
        if (originalEl.dataset.hasClone) return; // 防止重复克隆

        // 创建分身按钮
        const clone = document.createElement('div');
        clone.className = 'my-clone-btn';
        clone.innerText = (originalEl.innerText || originalEl.value || "按钮").trim();

        // 点击分身时，触发原始按钮的点击动作
        clone.onclick = () => {
            originalEl.click();
        };

        container.appendChild(clone);
        originalEl.dataset.hasClone = "true"; // 标记已克隆
        console.log("【同步成功】已为 ID:" + originalEl.id + " 创建悬浮分身");
    }

    function snatch() {
        // --- 目标特调清单 ---

        // 1. 查询页：查询(#l_search), 新建(#newBaggageLostBtn), 返回(#back)
        // 2. 详情页：下一步(#next), 上一步(#pre), 完成(#finish), 清空(#clear)
        const targetIds = ['l_search', 'newBaggageLostBtn', 'back', 'finish', 'clear', 'next', 'pre'];

        targetIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.offsetParent !== null) {
                createClone(el);
            }
        });

        // 3. 详情页底部通用按钮 (.l_bottom 里的按钮)
        const bottomBtns = document.querySelectorAll('.l_bottom .l_btn, .l_bottom button');
        bottomBtns.forEach(btn => {
            if (btn.offsetParent !== null) createClone(btn);
        });

        // 4. 比例和字母按键 (100%, A, B...)
        const controlBtns = document.querySelectorAll('.ui-controlgroup-controls label.ui-btn');
        controlBtns.forEach(lbl => {
            const text = lbl.innerText.trim();
            if ((/^\d+%$/.test(text) || /^[A-Z]$/.test(text)) && lbl.offsetParent !== null) {
                createClone(lbl);
            }
        });

        // --- 容器显示逻辑 ---
        // 如果容器里有分身按钮，显示框；否则彻底隐藏
        if (container.children.length > 0) {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }
    }

    // 每 1.5 秒同步一次（应对动态生成的 JS 按钮）
    setInterval(snatch, 1500);

})();