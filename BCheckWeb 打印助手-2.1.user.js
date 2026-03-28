// ==UserScript==
// @name         BCheckWeb 打印助手
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  穿透 frameset 架构，精准提取 content_frame 中的 FS 和 RL 数据
// @author       Gemini
// @match        http://60.247.100.98/BCheckWeb/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #print-action-box {
            position: fixed !important; right: 15px !important; bottom: 80px !important;
            z-index: 2147483647 !important; display: none; background: transparent !important;
            border: none !important; padding: 0 !important;
        }
        .print-btn-style {
            display: flex !important; align-items: center !important; justify-content: center !important;
            width: 110px !important; min-height: 45px !important; background-color: #28a745 !important;
            color: #ffffff !important; border: 2px solid #ffffff !important; border-radius: 8px !important;
            font-size: 14px !important; font-weight: bold !important; cursor: pointer !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3) !important; text-align: center !important;
        }
    `);

    // --- 核心逻辑：获取存储数据的子框架 document ---
    function getContentDoc() {
        const frame = document.getElementById('content_frame');
        if (frame && frame.contentWindow) {
            return frame.contentWindow.document;
        }
        return document; // 兜底返回当前文档
    }

    function extractData() {
        const cd = getContentDoc(); // 所有的抓取操作都在 cd (content_document) 上进行
        const fullText = cd.body ? cd.body.innerText : "";

        // --- 1. 姓名抓取 ---
        const nameInputs = Array.from(cd.querySelectorAll('input[name="lbDetail.familyName"]'));
        const lastName = nameInputs[0] ? nameInputs[0].value.trim() : "";
        const firstName = nameInputs[1] ? nameInputs[1].value.trim() : "";

        // --- 2. 数量抓取 ---
        const amountSelect = cd.getElementById('l_baggageSelect');
        const amount = amountSelect ? (amountSelect.options[amountSelect.selectedIndex]?.value || amountSelect.value) : "";

        // --- 3. 日志文本抓取 (用于 FS 和 RL) ---
        const logTextArea = cd.querySelector('textarea.textArea');
        const logText = logTextArea ? logTextArea.value : fullText;

        // --- 4. 责任航站 (FS) 抓取 ---
        // 匹配 FS: 后跟 3 位字母，例如 FS:PEK
        let faultStation = "";
        const fsMatch = logText.match(/FS:\s*([A-Z]{3})/);
        if (fsMatch) {
            faultStation = fsMatch[1].toUpperCase();
        } else {
            const fsInput = cd.getElementById('rStation');
            faultStation = fsInput ? fsInput.value.trim().toUpperCase() : "";
        }

        // --- 5. 事故代码 (RL) 抓取 ---
        // 匹配所有 RL:数字，并取最后一个（最新记录），例如 RL:53
        let reason = "";
        const rlMatches = logText.match(/RL:\s*(\d+)/g);
        if (rlMatches && rlMatches.length > 0) {
            const lastRL = rlMatches[rlMatches.length - 1];
            reason = lastRL.replace(/RL:\s*/, "");
        } else {
            const rlInput = cd.getElementById('rAccCode');
            reason = rlInput ? rlInput.value.trim() : "";
        }

        // --- 6. 航班日期与档案号 ---
        const rawDate = cd.getElementById('pir-flightAndDate')?.textContent.trim() || "";
        const flightDate = rawDate.replace(/\//g, ' / ');
        const refEl = cd.getElementById('wtRecordId');
        const caseNumber = refEl ? refEl.textContent.trim().replace('LAXCA', '') : "";

        return {
            pax_name: lastName && firstName ? `${lastName}/${firstName}` : (lastName || firstName),
            case_number: caseNumber,
            flight_date: flightDate,
            amount: amount,
            reason: reason,
            fault_station: faultStation
        };
    }

    function generatePrintPage(data) {
        return `
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                h3 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                td { border: 1px solid #808080; padding: 8px; font-size: 14px; height: 22px; }
                .title-table td:nth-child(1) { width: 25%; }
                .title-table td:nth-child(2) { width: 75%; font-size: 18px; }
                .info-table td:nth-child(1){ width: 10%; }
                .info-table td:nth-child(2){ width: 10%; }
                .info-table td:nth-child(3){ width: 70%; }
                .info-table td:nth-child(4){ width: 10%; }
                .footer-table td { border: none; border-bottom: 1px solid #ADADAD; }
                .section-bar { border: 1px solid #ADADAD; text-align: center; font-size: 12px; padding: 5px; margin-top: 20px; font-weight: bold; background: #f0f0f0; }
            </style>
        </head>
        <body>
            <h3>Air China Baggage Irregularity Cover Sheet</h3>
            <table class="title-table">
                <tr><td>Passenger:</td><td><b>${data.pax_name}</b></td></tr>
                <tr><td>Flight Num / Date:</td><td>${data.flight_date}</td></tr>
                <tr><td>File Number:</td><td><b>A/LAXCA${data.case_number}</b></td></tr>
            </table>
            <div class="section-bar">Handling Details</div>
            <table class="info-table">
                <tr style="background:#eee; text-align:center;"><td>Date</td><td>Time</td><td>Remarks</td><td>Agent</td></tr>
                ${'<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'.repeat(11)}
            </table>
            <br>
            <table class="footer-table">
                <tr><td>Number of Involved:</td><td>${data.amount}</td><td>Fault Station (FS):</td><td>${data.fault_station}</td></tr>
                <tr><td>Baggage Delivery Order (BDO):</td><td>&nbsp;</td><td>Reason Lost (RL):</td><td>${data.reason}</td></tr>
                <tr><td>Delivery Cost:</td><td>&nbsp;</td><td>Close Date:</td><td>&nbsp;</td></tr>
            </table>
            <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
        </html>`;
    }

    // 初始化按钮
    const container = document.createElement('div');
    container.id = 'print-action-box';
    document.body.appendChild(container);

    const btn = document.createElement('div');
    btn.className = 'print-btn-style';
    btn.innerText = '打印封面';
    container.appendChild(btn);

    btn.onclick = () => {
        const data = extractData();
        console.log("最终提取数据:", data);
        const win = window.open('', '_blank');
        win.document.write(generatePrintPage(data));
        win.document.close();
    };

    function checkDisplay() {
        const cd = getContentDoc();
        const nameInputs = Array.from(cd.querySelectorAll('input[name="lbDetail.familyName"]'));
        const hasNameData = nameInputs.some(input => input.value && input.value.trim() !== "");
        container.style.display = hasNameData ? 'flex' : 'none';
    }

    setInterval(checkDisplay, 2000);
})();