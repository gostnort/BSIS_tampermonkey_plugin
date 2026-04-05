// ==UserScript==
// @name         BCheckWeb 新建少收查询
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  新建少收查询卡片化视图
// @author       Gostnort
// @match        http://60.247.100.98/BCheckWeb/*
// @match        https://60.247.100.98/BCheckWeb/*
// @match        http://202.96.17.98/BCheckWeb/*
// @match        https://202.96.17.98/BCheckWeb/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // 检测运行环境
    const inTopWindow = window.top === window.self;
    const inContentFrame = !inTopWindow && window.frameElement && window.frameElement.id === 'content_frame';
    
    // 只在顶层窗口或content_frame运行
    if (!inTopWindow && !inContentFrame) return;
    
    console.log('[TMK] Script starting...', { inTopWindow, inContentFrame });
    
    // 状态管理
    let isCardViewActive = false;
    let renderTimer = null;
    
    function getWorkingDoc() {
        if (inContentFrame) {
            console.log('[TMK] Using content frame document');
            return document;
        }
        try {
            const frame = document.getElementById('content_frame');
            if (frame && frame.contentWindow && frame.contentWindow.document) {
                console.log('[TMK] Using frame document from top window');
                return frame.contentWindow.document;
            }
        } catch (error) {
            console.log('[TMK] Error accessing frame:', error);
        }
        console.log('[TMK] Using top document');
        return document;
    }
    
    // 存储原始页面内容
    let originalBodyContent = '';
    let originalBodyStyle = '';
    
    // 恢复原始页面
    function restoreOriginalPage(doc) {
        console.log('[TMK] Restoring original page');
        doc.body.innerHTML = originalBodyContent;
        doc.body.style.cssText = originalBodyStyle;
        isCardViewActive = false;
    }
    
    // 创建Step1现代化查询表单
    function createModernQueryForm(doc) {
        console.log('[TMK] Creating modern query form for Step1');
        
        // 保存原始内容
        originalBodyContent = doc.body.innerHTML;
        originalBodyStyle = doc.body.style.cssText;
        
        // 设置body样式
        doc.body.style.cssText = `
            margin: 0 !important;
            padding: 0 !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif !important;
            min-height: 100vh !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;
        
        // 清空body并创建现代化查询界面
        doc.body.innerHTML = `
            <div style="
                background: rgba(255,255,255,0.95);
                backdrop-filter: blur(20px);
                border-radius: 24px;
                padding: 48px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 500px;
                width: 90%;
                position: relative;
            ">
                <div style="position: absolute; top: 20px; right: 20px;">
                    <button id="tmk-restore-btn" style="
                        background: rgba(102, 126, 234, 0.1);
                        border: 2px solid rgba(102, 126, 234, 0.3);
                        color: #667eea;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 12px;
                        cursor: pointer;
                    ">🔙 恢复原页面</button>
                </div>
                
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="
                        font-size: 28px;
                        font-weight: 700;
                        color: #2c3e50;
                        margin: 0 0 12px 0;
                        background: linear-gradient(45deg, #667eea, #764ba2);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    ">✈️ 新建少收查询</h1>
                    <p style="
                        color: #7f8c8d;
                        margin: 0;
                        font-size: 16px;
                    ">现代化查询界面</p>
                </div>
                
                <form style="display: flex; flex-direction: column; gap: 24px;">
                    <div>
                        <label style="
                            display: block;
                            margin-bottom: 8px;
                            font-weight: 600;
                            color: #2c3e50;
                            font-size: 14px;
                        ">🏢 受理航站公司</label>
                        <select id="tmk-airline" style="
                            width: 100%;
                            padding: 16px 20px;
                            border: 2px solid rgba(102, 126, 234, 0.2);
                            border-radius: 16px;
                            font-size: 16px;
                            background: white;
                            color: #2c3e50;
                            outline: none;
                            transition: all 0.3s ease;
                        " onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)';" onblur="this.style.borderColor='rgba(102, 126, 234, 0.2)'; this.style.boxShadow='none';">
                            <option value="">请选择航站公司</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="
                            display: block;
                            margin-bottom: 8px;
                            font-weight: 600;
                            color: #2c3e50;
                            font-size: 14px;
                        ">🧳 行李号</label>
                        <input type="text" id="tmk-baggage" placeholder="请输入行李号" style="
                            width: 100%;
                            padding: 16px 20px;
                            border: 2px solid rgba(102, 126, 234, 0.2);
                            border-radius: 16px;
                            font-size: 16px;
                            background: white;
                            color: #2c3e50;
                            outline: none;
                            transition: all 0.3s ease;
                            box-sizing: border-box;
                        " onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)';" onblur="this.style.borderColor='rgba(102, 126, 234, 0.2)'; this.style.boxShadow='none';">
                    </div>
                    
                    <div>
                        <label style="
                            display: block;
                            margin-bottom: 8px;
                            font-weight: 600;
                            color: #2c3e50;
                            font-size: 14px;
                        ">📄 证件号</label>
                        <input type="text" id="tmk-idnum" placeholder="请输入证件号" style="
                            width: 100%;
                            padding: 16px 20px;
                            border: 2px solid rgba(102, 126, 234, 0.2);
                            border-radius: 16px;
                            font-size: 16px;
                            background: white;
                            color: #2c3e50;
                            outline: none;
                            transition: all 0.3s ease;
                            box-sizing: border-box;
                        " onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)';" onblur="this.style.borderColor='rgba(102, 126, 234, 0.2)'; this.style.boxShadow='none';">
                    </div>
                    
                    <button type="button" id="tmk-search-btn" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 18px 32px;
                        border-radius: 16px;
                        font-size: 18px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-top: 12px;
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 35px rgba(102, 126, 234, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.3)';">
                        🔍 开始查询
                    </button>
                </form>
                
                <div style="
                    text-align: center;
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid rgba(102, 126, 234, 0.2);
                    color: #7f8c8d;
                    font-size: 12px;
                ">
                    新建少收查询系统 v1.0 - 现代化界面
                </div>
            </div>
        `;
        
        // 查找原始表单元素并同步值
        const originalInputs = {
            airline: originalBodyContent.match(/<select[^>]*name[^>]*>/i),
            baggage: originalBodyContent.match(/<input[^>]*行李[^>]*>/i),
            idnum: originalBodyContent.match(/<input[^>]*证件[^>]*>/i)
        };
        
        // 绑定事件
        const restoreBtn = doc.getElementById('tmk-restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => restoreOriginalPage(doc));
        }
        
        const searchBtn = doc.getElementById('tmk-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                // 这里应该填入原始表单并提交
                alert('现代化查询功能开发中...\n点击"恢复原页面"使用原始表单');
            });
        }
        
        console.log('[TMK] Modern query form created');
    }
    
    // 简化测试函数 - 直接创建明显的测试界面
    function createTestView(doc) {
        console.log('[TMK] Creating test view for verification');
        
        // 保存原始内容
        originalBodyContent = doc.body.innerHTML;
        originalBodyStyle = doc.body.style.cssText;
        
        // 创建一个非常明显的测试元素
        const testDiv = doc.createElement('div');
        testDiv.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: "Arial", sans-serif !important;
            color: white !important;
            text-align: center !important;
        `;
        
        testDiv.innerHTML = `
            <div style="background: rgba(0,0,0,0.8); padding: 40px; border-radius: 20px; max-width: 600px;">
                <h1 style="font-size: 3em; margin: 0 0 20px 0;">🎉 脚本激活成功！</h1>
                <p style="font-size: 1.5em; margin: 0 0 20px 0;">新建少收查询卡片化视图已启动</p>
                <p style="font-size: 1.2em; opacity: 0.8; margin: 0 0 30px 0;">未检测到旅客/行李数据，显示测试界面</p>
                
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button id="tmk-restore-btn" style="
                        background: linear-gradient(45deg, #6c5ce7, #a29bfe);
                        border: none;
                        color: white;
                        padding: 15px 25px;
                        border-radius: 25px;
                        font-size: 1em;
                        font-weight: 600;
                        cursor: pointer;
                    ">🔙 恢复原页面</button>
                    
                    <button onclick="location.reload()" style="
                        background: linear-gradient(45deg, #ff6b6b, #feca57);
                        border: none;
                        color: white;
                        padding: 15px 25px;
                        border-radius: 25px;
                        font-size: 1em;
                        font-weight: 600;
                        cursor: pointer;
                    ">🔄 刷新页面</button>
                </div>
            </div>
        `;
        
        // 清空body并添加测试界面
        doc.body.innerHTML = '';
        doc.body.appendChild(testDiv);
        
        // 绑定恢复按钮事件
        const restoreBtn = doc.getElementById('tmk-restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => restoreOriginalPage(doc));
        }
        
        console.log('[TMK] Test view created with restore button');
    }
    
    // 简单的页面检测 - 只要有表格和旅客相关信息就认为是目标页面
    function isTargetPage(doc) {
        if (!doc) return false;
        
        const bodyText = (doc.body && doc.body.textContent) || '';
        const hasTables = doc.querySelectorAll('table').length > 0;
        const hasPassengerInfo = bodyText.includes('旅客') || bodyText.includes('行李') || bodyText.includes('姓名');
        
        console.log('[TMK] Page check:', {
            hasTables,
            hasPassengerInfo,
            bodyTextLength: bodyText.length
        });
        
        return hasTables && hasPassengerInfo;
    }
    
    // 解析旅客数据
    function extractPassengerData(doc) {
        const tables = Array.from(doc.querySelectorAll('table'));
        const passengers = [];
        
        tables.forEach(table => {
            const text = table.textContent;
            if (text.includes('旅客姓名') && (text.includes('证件号码') || text.includes('证件号'))) {
                const rows = Array.from(table.querySelectorAll('tr'));
                const data = {};
                
                rows.forEach(row => {
                    const cells = Array.from(row.cells || []);
                    for (let i = 0; i < cells.length - 1; i += 2) {
                        const key = cells[i]?.textContent?.trim() || '';
                        const value = cells[i + 1]?.textContent?.trim() || '';
                        if (key && value) {
                            if (key.includes('姓名')) data.name = value;
                            if (key.includes('性别')) data.gender = value;
                            if (key.includes('证件号')) data.idnum = value;
                            if (key.includes('航班') || key.includes('日期')) data.flight = value;
                            if (key.includes('航节')) data.segment = value;
                            if (key.includes('座位')) data.seat = value;
                            if (key.includes('常旅客')) data.ffp = value;
                        }
                    }
                });
                
                if (data.name) {
                    // 查找相关的checkbox和radio
                    const checkbox = table.parentElement?.querySelector('input[type="checkbox"]');
                    const radio = table.parentElement?.querySelector('input[type="radio"]');
                    
                    passengers.push({
                        ...data,
                        checkbox,
                        radio,
                        isLaxSegment: (data.segment || '').toUpperCase().includes('LAX')
                    });
                }
            }
        });
        
        return passengers;
    }
    
    // 解析行李数据
    function extractBaggageData(doc) {
        const tables = Array.from(doc.querySelectorAll('table'));
        const baggages = [];
        
        tables.forEach(table => {
            const text = table.textContent;
            if (text.includes('行李牌') && text.includes('目的地')) {
                const rows = Array.from(table.querySelectorAll('tr')).slice(1); // 跳过表头
                
                rows.forEach((row, index) => {
                    const cells = Array.from(row.cells || []);
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    
                    if (checkbox && cells.length > 1) {
                        const bagTag = cells.find(cell => {
                            const text = cell.textContent.trim();
                            return /^[A-Z0-9]{2,4}[0-9Xx]{6,}$/.test(text) || /[0-9]{7,}/.test(text);
                        })?.textContent.trim() || `行李${index + 1}`;
                        
                        const destination = cells.find(cell => {
                            const text = cell.textContent.trim();
                            return /^[A-Z]{3}$/.test(text);
                        })?.textContent.trim() || '';
                        
                        baggages.push({
                            bagTag,
                            destination,
                            checkbox,
                            isLaxDest: destination.toUpperCase() === 'LAX'
                        });
                    }
                });
            }
        });
        
        return baggages;
    }
    
    // 创建旅客卡片
    function createPassengerCard(passenger) {
        const card = document.createElement('div');
        const isSelected = passenger.checkbox ? passenger.checkbox.checked : true;
        const level = (passenger.ffp || '').split('/').pop() || '';
        const isLevelWarn = level && !['B', 'S'].includes(level.toUpperCase());
        
        card.style.cssText = `
            background: ${passenger.isLaxSegment ? 
                'linear-gradient(135deg, #a8e6cf 0%, #88d8a3 100%)' : 
                'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)'};
            border: 3px solid ${isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'};
            border-radius: 20px;
            padding: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            min-height: 180px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
            ${isLevelWarn ? 'box-shadow: 0 0 0 3px #ff6b6b, 0 8px 32px rgba(0, 0, 0, 0.2);' : ''}
            ${!isSelected ? 'opacity: 0.8; transform: scale(0.98);' : ''}
        `;
        
        card.innerHTML = `
            <div style="font-size: 16px; font-weight: 700; color: #203246; margin-bottom: 12px;">
                ${passenger.name || '-'} / ${passenger.gender || '-'}
                ${isLevelWarn ? '<span style="position: absolute; right: 10px; top: 10px; background: rgba(240, 160, 61, 0.3); color: #7c4300; padding: 2px 8px; border-radius: 12px; font-size: 11px;">非B/S</span>' : ''}
            </div>
            <div style="font-size: 13px; color: #253a4f; line-height: 1.6;">
                证件号: ${passenger.idnum || '-'}<br>
                航班/日期: ${passenger.flight || '-'}<br>
                航节: ${passenger.segment || '-'}<br>
                座位: ${passenger.seat || '-'}<br>
                常旅客: ${passenger.ffp || '-'}
            </div>
        `;
        
        // 点击切换选择
        card.addEventListener('click', () => {
            if (passenger.checkbox) {
                passenger.checkbox.checked = !passenger.checkbox.checked;
                passenger.checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        
        // 悬浮效果
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-3px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
        
        return card;
    }
    
    // 创建行李卡片
    function createBaggageCard(baggage, isLaxSegment) {
        const card = document.createElement('div');
        const isSelected = baggage.checkbox ? baggage.checkbox.checked : false;
        
        let bgGradient = 'linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%)'; // 默认灰色渐变
        let textColor = '#2c3e50';
        
        if (baggage.isLaxDest) {
            if (isLaxSegment) {
                bgGradient = 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)'; // LAX段绿色渐变
                textColor = '#1e3a1e';
            } else {
                bgGradient = 'linear-gradient(135deg, #f7b733 0%, #fc4a1a 100%)'; // 非LAX段黄橙渐变
                textColor = '#ffffff';
            }
        }
        
        card.style.cssText = `
            background: ${bgGradient};
            color: ${textColor};
            border: 3px solid ${isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'};
            border-radius: 16px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            min-height: 140px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
            ${!isSelected ? 'opacity: 0.85; transform: scale(0.95);' : ''}
        `;
        
        card.innerHTML = `
            <div style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">
                ${baggage.bagTag || '行李'}
            </div>
            <div style="font-size: 12px; opacity: 0.8;">
                目的地: ${baggage.destination || '-'}
            </div>
        `;
        
        // 点击切换选择
        card.addEventListener('click', () => {
            if (baggage.checkbox) {
                baggage.checkbox.checked = !baggage.checkbox.checked;
                baggage.checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        
        // 悬浮效果
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
        
        return card;
    }
    
    // 创建真正的卡片化视图
    function createModernView(doc) {
        if (isCardViewActive) {
            console.log('[TMK] Card view already active, skipping creation');
            return;
        }
        
        console.log('[TMK] Creating card-based view...');
        
        // 设置状态标志，防止重复执行
        isCardViewActive = true;
        
        // 保存原始内容（如果还没保存）
        if (!originalBodyContent) {
            originalBodyContent = doc.body.innerHTML;
            originalBodyStyle = doc.body.style.cssText;
        }
        
        // 解析数据
        const passengers = extractPassengerData(doc);
        const baggages = extractBaggageData(doc);
        
        console.log('[TMK] Found data:', { passengers: passengers.length, baggages: baggages.length });
        
        if (passengers.length === 0 && baggages.length === 0) {
            console.log('[TMK] No passenger/baggage data found, this should not happen in Step2');
            isCardViewActive = false; // 重置标志
            return;
        }
        
        // 强制替换整个页面内容
        console.log('[TMK] Hiding original content and creating modern view');
        
        // 完全清空body内容
        doc.body.innerHTML = '';
        
        // 设置body样式
        doc.body.style.cssText = `
            margin: 0 !important;
            padding: 20px !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif !important;
            min-height: 100vh !important;
            position: relative !important;
            z-index: 999999 !important;
        `;
        
        // 创建页面标题和控制按钮
        const headerDiv = doc.createElement('div');
        headerDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        `;
        
        const pageTitle = doc.createElement('h1');
        pageTitle.textContent = '✨ 新建少收查询 - 现代卡片视图';
        pageTitle.style.cssText = `
            font-size: 28px;
            font-weight: 700;
            color: white;
            margin: 0;
            flex: 1;
            text-align: center;
        `;
        
        const controlButtons = doc.createElement('div');
        controlButtons.style.cssText = `
            display: flex;
            gap: 10px;
        `;
        
        controlButtons.innerHTML = `
            <button id="tmk-restore-btn" style="
                background: rgba(255,255,255,0.3);
                border: 2px solid white;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                backdrop-filter: blur(10px);
            ">🔙 恢复原页面</button>
            
            <button onclick="location.reload()" style="
                background: rgba(255,255,255,0.3);
                border: 2px solid white;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                backdrop-filter: blur(10px);
            ">🔄 刷新</button>
        `;
        
        headerDiv.appendChild(pageTitle);
        headerDiv.appendChild(controlButtons);
        doc.body.appendChild(headerDiv);
        
        // 绑定恢复按钮事件
        const restoreBtn = doc.getElementById('tmk-restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => restoreOriginalPage(doc));
        }
        
        // 创建卡片容器
        const container = doc.createElement('div');
        container.style.cssText = `
            display: grid;
            grid-template-columns: 400px 1fr;
            gap: 24px;
            max-width: 1400px;
            margin: 0 auto;
        `;
        
        // 左侧旅客信息面板
        const passengerPanel = doc.createElement('div');
        passengerPanel.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;
        
        // 添加标题
        const passengerTitle = doc.createElement('h2');
        passengerTitle.textContent = '🧑‍✈️ 旅客信息';
        passengerTitle.style.cssText = `
            margin: 0 0 16px 0;
            color: white;
            font-size: 24px;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        `;
        passengerPanel.appendChild(passengerTitle);
        
        passengers.forEach(passenger => {
            passengerPanel.appendChild(createPassengerCard(passenger));
        });
        
        // 右侧行李信息网格
        const baggagePanel = doc.createElement('div');
        baggagePanel.style.cssText = `
            display: flex;
            flex-direction: column;
        `;
        
        const baggageTitle = doc.createElement('h2');
        baggageTitle.textContent = '🧳 行李信息';
        baggageTitle.style.cssText = `
            margin: 0 0 16px 0;
            color: white;
            font-size: 24px;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        `;
        baggagePanel.appendChild(baggageTitle);
        
        const baggageGrid = doc.createElement('div');
        baggageGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 16px;
        `;
        
        const isLaxSegment = passengers.some(p => p.isLaxSegment);
        baggages.forEach(baggage => {
            baggageGrid.appendChild(createBaggageCard(baggage, isLaxSegment));
        });
        
        baggagePanel.appendChild(baggageGrid);
        
        container.appendChild(passengerPanel);
        container.appendChild(baggagePanel);
        doc.body.appendChild(container);
        
        // 验证DOM是否正确创建
        console.log('[TMK] DOM verification:', {
            bodyChildrenCount: doc.body.children.length,
            containerExists: !!doc.body.querySelector('div'),
            pageTitle: pageTitle.textContent,
            documentTitle: doc.title
        });
        
        // 强制触发重绘
        doc.body.offsetHeight; // 触发重排
        
        console.log('[TMK] ✓ Card-based view created successfully, stopping all checks');
    }
    
    // 检测是否是Step1查询表单页面
    function isStep1QueryFormPage(doc) {
        if (!doc) return false;
        
        const bodyText = (doc.body && doc.body.textContent) || '';
        
        // 检查是否包含查询表单的关键元素
        const hasQueryForm = 
            bodyText.includes('受理航站公司') && 
            bodyText.includes('行李号') && 
            bodyText.includes('证件号') &&
            doc.querySelectorAll('input').length > 0;
            
        console.log('[TMK] Step1 query form check:', {
            hasQueryForm,
            bodyTextIncludes: {
                airline: bodyText.includes('受理航站公司'),
                baggage: bodyText.includes('行李号'),
                id: bodyText.includes('证件号')
            },
            inputCount: doc.querySelectorAll('input').length
        });
        
        return hasQueryForm;
    }
    
    // 检测是否是Step2结果页面（包含旅客/行李数据）
    function isStep2ResultPage(doc) {
        if (!doc) return false;
        
        const tables = doc.querySelectorAll('table');
        if (tables.length === 0) return false;
        
        let hasPassengerData = false;
        let hasBaggageData = false;
        
        Array.from(tables).forEach(table => {
            const text = table.textContent;
            if (text.includes('旅客姓名') && (text.includes('证件号码') || text.includes('证件号'))) {
                hasPassengerData = true;
            }
            if (text.includes('行李牌') && text.includes('目的地')) {
                hasBaggageData = true;
            }
        });
        
        console.log('[TMK] Step2 result page check:', { 
            hasPassengerData, 
            hasBaggageData, 
            tablesCount: tables.length 
        });
        
        return hasPassengerData || hasBaggageData;
    }
    
    // 一次性执行函数 - 等待页面完全加载后执行
    function runOnceAfterLoad() {
        if (isCardViewActive) {
            console.log('[TMK] View already active, skipping');
            return;
        }
        
        const doc = getWorkingDoc();
        console.log('[TMK] Final check - document loaded:', doc.title || 'No title');
        
        // 优先检查Step1查询表单页面
        if (isStep1QueryFormPage(doc)) {
            console.log('[TMK] ✓ Detected Step1 query form page - creating modern form');
            createModernQueryForm(doc);
            isCardViewActive = true;
            return;
        }
        
        // 检查Step2结果页面
        if (isStep2ResultPage(doc)) {
            console.log('[TMK] ✓ Detected Step2 result page - creating card view');
            createModernView(doc);
            isCardViewActive = true;
            return;
        }
        
        console.log('[TMK] Not a recognized query page, script will not activate');
    }
    
    // 等待页面完全加载后执行一次
    if (document.readyState === 'complete') {
        // 页面已经加载完成
        setTimeout(runOnceAfterLoad, 1000);
    } else {
        // 页面还在加载，等待加载完成
        window.addEventListener('load', () => {
            setTimeout(runOnceAfterLoad, 1000);
        });
        
        // 备用方案：DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(runOnceAfterLoad, 2000);
            });
        }
    }
    
    console.log('[TMK] Script initialized - will optimize Step1 query form OR Step2 results after page loads');
})();