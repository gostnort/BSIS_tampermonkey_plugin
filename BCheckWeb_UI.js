// ==UserScript==
// @name         BCheckWeb UI 瓷砖菜单 - 0.7.1
// @namespace    http://tampermonkey.net/
// @version      0.7.1
// @description  修复按钮位置 | 标题动态联动 | 黄金比例间距 | 链接逻辑修复
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

    const inTopWindow = window.top === window.self;
    const inContentFrame = !inTopWindow && window.frameElement && window.frameElement.id === 'content_frame';
    if (!inTopWindow && !inContentFrame) return;

    const FAB_ID = 'tmk-fab';
    const SEARCH_FAB_ID = 'tmk-search-fab';
    const SEARCH_INPUT_ID = 'tmk-search-input';
    const OVERLAY_ID = 'tmk-overlay';
    const ROOT_GRID_ID = 'tmk-root-grid';
    const SUB_GRID_ID = 'tmk-sub-grid';

    const state = { overlayOpen: false, showingSub: false, currentGroup: null, searchExpanded: false };

    // --- 1. 链接提取：使用 a.href DOM属性（浏览器已按 frame 自身 baseURI 解析好的绝对URL）---
    function extractHref(anchor) {
        if (!anchor) return '';
        // a.href 是 DOM 属性，浏览器已自动解析为绝对 URL，不依赖手动拼接
        const abs = (anchor.href || '').trim();
        if (abs && !abs.endsWith('#') && !abs.startsWith('javascript:')) return abs;
        return '';
    }

    // 从 header_frame 取退出系统链接（特化处理）
    function getLogoutUrl() {
        try {
            const hf = window.top.frames.header_frame;
            if (hf && hf.document) {
                const a = hf.document.querySelector('a[href*="execute_logout"]')
                       || hf.document.querySelector('a[href*="logout"]');
                if (a && a.href) return a.href;
            }
        } catch (e) {}
        try {
            return window.top.location.origin + '/BCheckWeb/execute_logout.action';
        } catch (e) { return '/BCheckWeb/execute_logout.action'; }
    }

    function navigateToContent(url) {
        if (url) window.location.href = url;
    }

    // --- 2. 框架折叠 (锁定 0,8,*) ---
    function hideLegacyChrome() {
        if (!inTopWindow) return;
        try {
            const topDoc = document;
            const apply = () => {
                const mainFs = topDoc.getElementById('main_frameset');
                const contentFs = topDoc.getElementById('content_frameset');
                if (mainFs) mainFs.rows = "0,*,0";
                if (contentFs && contentFs.cols !== "0,8,*") {
                    contentFs.cols = "0,8,*";
                    contentFs.setAttribute('cols', "0,8,*");
                }
            };
            apply();
            if (!window.tmkGuard) window.tmkGuard = setInterval(apply, 1000);
        } catch (e) {}
    }

    // --- 3. 审美布局与 CSS (解决按钮掉到底部问题) ---
    function calcUiMetrics() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const shortSide = Math.min(vw, vh);
        const small = Math.max(46, Math.min(78, Math.round(shortSide * 0.07)));
        return {
            small, gap: Math.max(8, Math.min(16, Math.round(small * 0.22))),
            medium: small * 2,
            h1Size: Math.max(30, Math.min(48, Math.floor(vw * 0.035)))
        };
    }

    function injectStyle(doc) {
        if (!doc || !doc.head) return;
        const m = calcUiMetrics();
        let style = doc.getElementById('tmk-ui-style');
        if (!style) {
            style = doc.createElement('style');
            style.id = 'tmk-ui-style';
            doc.head.appendChild(style);
        }
        style.textContent = `
            :root {
                --tmk-blue: 0, 90, 158; --tmk-teal: 0, 120, 120;
                --tmk-purple: 81, 43, 129; --tmk-slate: 45, 125, 154;
                --tmk-medium: ${m.medium}px; --tmk-gap: ${m.gap}px;
            }
            #${OVERLAY_ID} {
                position: fixed!important; inset: 0!important; z-index: 2147483646!important;
                display: none; background: rgba(200, 200, 200, 0.3)!important; backdrop-filter: blur(10px);
            }
            .tmk-page {
                width: 100vw!important; height: 100%!important; overflow-y: auto!important;
                box-sizing: border-box!important;
                /* 修复 Padding 冲突：明确上下左右间距 */
                padding-top: 50px !important;
                padding-bottom: 60px !important;
                padding-right: 40px !important;
                padding-left: clamp(80px, 12vw, 160px) !important;
            }
            #${FAB_ID} {
                position: fixed !important; left: 30px !important; top: 20px !important;
                z-index: 2147483647 !important; width: 46px !important; height: 46px !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: #f4f6f8 !important; color: #4f5d70 !important;
                border: 1px solid #cfd7df !important; border-radius: 999px !important;
                font-family: "Segoe UI Light", sans-serif !important; font-size: 30px !important;
                font-weight: 100 !important; cursor: pointer !important;
                transition: background 0.2s ease, border-color 0.2s ease !important;
            }
            #${FAB_ID}:hover { background: #eef3f8 !important; border-color: #aebac8 !important; }
            #${SEARCH_FAB_ID} {
                position: fixed !important; right: 20px !important; top: 20px !important;
                z-index: 2147483647 !important; width: 46px !important; height: 46px !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #4f5d70 !important; font-size: 23px !important; line-height: 1 !important;
                background: #f4f6f8 !important;
                border: 1px solid #cfd7df !important; border-radius: 999px !important;
                box-shadow: none !important; cursor: pointer !important; transition: background 0.2s ease, border-color 0.2s ease !important;
            }
            #${SEARCH_FAB_ID}.tmk-search-active {
                background: #eef3f8 !important;
                border-color: #aebac8 !important;
            }
            #${SEARCH_INPUT_ID} {
                position: fixed !important; right: 72px !important; top: 26px !important;
                z-index: 2147483647 !important; width: 340px !important; height: 34px !important;
                box-sizing: border-box !important; border-radius: 6px !important;
                border: 1px solid #b8c5d4 !important;
                padding: 0 10px !important; background: #ffffff !important;
                color: #1d2a38 !important; outline: none !important;
            }
            #${SEARCH_INPUT_ID}::placeholder {
                color: #8a97a6 !important;
            }
            .tmk-h1 {
                font-size: ${m.h1Size}px !important; font-weight: 100 !important; color: #fff !important;
                margin: 0 0 10px 0 !important; letter-spacing: -1px !important;
            }
            .tmk-active-tag { display: none !important; }
            .tmk-grid { display: grid !important; gap: var(--tmk-gap) !important; grid-template-columns: repeat(auto-fill, var(--tmk-medium)) !important; }

            /* 黄金比例间距：常驻区与主网格之间 */
            #${ROOT_GRID_ID} { margin-top: calc(var(--tmk-medium) * 0.618) !important; }

            .tmk-tile {
                width: var(--tmk-medium) !important; height: var(--tmk-medium) !important;
                border: 0 !important; color: #fff !important; padding: 15px !important; text-align: left !important;
                cursor: pointer !important; transition: transform 0.15s !important;
            }
            .tmk-tile:hover { transform: scale(1.03); filter: brightness(1.15); }
            .tmk-title { font-size: 18px !important; line-height: 1.2 !important; }
            .tmk-core { background: rgba(var(--tmk-blue), 0.7) !important; }
            .tmk-data { background: rgba(var(--tmk-teal), 0.7) !important; }
            .tmk-system { background: rgba(var(--tmk-purple), 0.7) !important; }
            .tmk-aux { background: rgba(var(--tmk-slate), 0.7) !important; }
            .tmk-tile div:not(.tmk-title) { display: none !important; }
        `;
    }

    // --- 4. 标题联动逻辑 ---
    function showRootPage(overlay, fab) {
        overlay.querySelector('#tmk-root-page').style.display = 'block';
        overlay.querySelector('#tmk-sub-page').style.display = 'none';
        // 首页标题重置为“开始”
        const h1 = overlay.querySelector('#tmk-root-page .tmk-h1');
        if (h1) h1.textContent = '开始';
        state.showingSub = false; fab.textContent = '✕';
    }

    function showSubPage(overlay, fab, titleText) {
        overlay.querySelector('#tmk-root-page').style.display = 'none';
        overlay.querySelector('#tmk-sub-page').style.display = 'block';
        // 二级页标题变为选中的磁贴名
        const subH1 = overlay.querySelector('#tmk-sub-page .tmk-h1');
        if (subH1) subH1.textContent = titleText || '业务';
        state.showingSub = true; fab.textContent = '‹';
    }

    // --- 5. 颜色分类 ---
    function classForGroup(title) {
        if (/少收|多收|破损|速运行李/.test(title)) return 'tmk-core';
        if (/信息|核对|文件|报销/.test(title)) return 'tmk-data';
        if (/统计|查询|维护|系统/.test(title)) return 'tmk-system';
        return 'tmk-aux';
    }


    function classForTile(title, groupTitle) {
        if (/退出系统/.test(title)) return 'tmk-system';
        if (/快速查找|信息处理/.test(title)) return 'tmk-aux';
        if (/统计查询/.test(title)) return 'tmk-data';
        return classForGroup(groupTitle || title);
    }


    // --- 6. 菜单渲染与绑定 ---
    function renderTiles(doc, overlay, fab) {
        const rootGrid = doc.getElementById(ROOT_GRID_ID);
        const pinnedGrid = doc.getElementById('tmk-pinned-grid');
        const mf = window.top.frames.menu_frame;
        if (!mf || !mf.document || !rootGrid) return;

        const headers = Array.from(mf.document.querySelectorAll('.menuheaders'));
        const contents = Array.from(mf.document.querySelectorAll('.menucontents'));
        const groups = headers.map((h, i) => ({
            title: h.textContent.trim(),
            links: Array.from(contents[i].querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(), href: extractHref(a)
            })).filter(l => l.href)
        })).filter(g => g.links.length > 0);

        rootGrid.innerHTML = ''; pinnedGrid.innerHTML = '';
        const lostG = groups.find(g => /少收/.test(g.title));

        // 常驻区
        if (lostG) {
            lostG.links.slice(0, 3).forEach(l => {
                pinnedGrid.appendChild(buildTile(doc, l.text, classForTile(l.text, lostG.title), () => {
                    navigateToContent(l.href); closeOverlay(overlay, fab);
                }));
            });
        }
        pinnedGrid.appendChild(buildTile(doc, '退出系统', 'tmk-system', () => {
            window.top.location.href = getLogoutUrl();
        }));

        // 主菜单
        groups.forEach(g => {
            if (lostG && g.title === lostG.title) return;
            rootGrid.appendChild(buildTile(doc, g.title, classForTile(g.title, g.title), () => {
                const subGrid = doc.getElementById(SUB_GRID_ID);
                subGrid.innerHTML = '';
                g.links.forEach(l => {
                    subGrid.appendChild(buildTile(doc, l.text, classForTile(l.text, g.title), () => {
                        navigateToContent(l.href); closeOverlay(overlay, fab);
                    }));
                });
                showSubPage(overlay, fab, g.title);
            }));
        });
    }

    function buildTile(doc, title, cls, onClick) {
        const btn = doc.createElement('button');
        btn.className = `tmk-tile ${cls}`;
        btn.innerHTML = `<div class="tmk-title">${title}</div>`;
        btn.onclick = onClick;
        return btn;
    }

    function closeOverlay(overlay, fab) {
        overlay.style.display = 'none'; state.overlayOpen = false; fab.textContent = '☰';
        setSearchShortcutVisible(false);
    }

    function isVisibleElement(el) {
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const style = window.getComputedStyle(el);
        if (!style) return false;
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function findBrsTargets(doc) {
        if (!doc) return null;
        const inputs = Array.from(doc.querySelectorAll('#brsBagNumSearch')).filter(isVisibleElement);
        const buttons = Array.from(doc.querySelectorAll('#brsButton')).filter(isVisibleElement);
        if (!inputs.length || !buttons.length) return null;
        for (const input of inputs) {
            const host = input.closest('form, .ui-grid-b, .tab-pane, .panel, div') || doc.body;
            const matchedBtn = buttons.find((btn) => host.contains(btn));
            if (matchedBtn) return { input, button: matchedBtn };
        }
        return { input: inputs[0], button: buttons[0] };
    }

    function collapseSearch(searchFab, searchInput) {
        state.searchExpanded = false;
        searchFab.classList.remove('tmk-search-active');
        searchInput.style.display = 'none';
        searchInput.value = '';
    }

    function setSearchShortcutVisible(visible) {
        const searchFab = document.getElementById(SEARCH_FAB_ID);
        const searchInput = document.getElementById(SEARCH_INPUT_ID);
        if (!searchFab) return;
        searchFab.style.setProperty('display', visible ? 'inline-flex' : 'none', 'important');
        if (!visible && searchInput) collapseSearch(searchFab, searchInput);
    }

    function findVisibleExactTextNode(doc, targetText) {
        if (!doc || !targetText) return null;
        const selectors = [
            'a',
            'button',
            'input[type="button"]',
            'input[type="submit"]',
            'li',
            'label',
            'span'
        ];
        const candidates = Array.from(doc.querySelectorAll(selectors.join(',')));
        return candidates.find((el) => {
            if (el.offsetParent === null) return false;
            const text = (el.textContent || el.value || '').replace(/\s+/g, '').trim();
            return text === targetText;
        }) || null;
    }

    function getTabHandleByText(doc, targetText) {
        const node = findVisibleExactTextNode(doc, targetText);
        if (!node) return null;
        const clickable = node.closest('a, button, li, label') || node;
        return { node, clickable };
    }

    function isTabActiveByText(doc, targetText) {
        const handle = getTabHandleByText(doc, targetText);
        if (!handle) return false;
        const className = String(handle.clickable.className || '').toLowerCase();
        const ariaSelected = handle.clickable.getAttribute('aria-selected') === 'true';
        const ariaPressed = handle.clickable.getAttribute('aria-pressed') === 'true';
        const byClass = /active|selected|current|focus|on/.test(className);
        return ariaSelected || ariaPressed || byClass;
    }

    function activateTabByText(doc, targetText) {
        const handle = getTabHandleByText(doc, targetText);
        if (!handle) return false;
        if (isTabActiveByText(doc, targetText)) return true;
        handle.clickable.click();
        return true;
    }

    function activateTrackingTab(doc) {
        return activateTabByText(doc, '行李追踪数据');
    }

    function activatePageTab(doc, targetText) {
        return activateTabByText(doc, targetText);
    }

    function submitSearchWithRetry(value, searchFab, searchInput, retries) {
        const targets = findBrsTargets(document);
        if (targets) {
            // 同步赋值并触发输入事件，兼容页面监听逻辑
            targets.input.value = value;
            targets.input.dispatchEvent(new Event('input', { bubbles: true }));
            targets.input.dispatchEvent(new Event('change', { bubbles: true }));
            targets.button.click();
            collapseSearch(searchFab, searchInput);
            // 查询触发后自动收起开始页，减少手动关闭操作
            const overlay = document.getElementById(OVERLAY_ID);
            const fab = document.getElementById(FAB_ID);
            if (overlay && fab && state.overlayOpen) closeOverlay(overlay, fab);
            return;
        }
        if (retries <= 0) {
            alert('未找到“查询BRS记录”输入框或按钮。');
            collapseSearch(searchFab, searchInput);
            return;
        }
        setTimeout(() => submitSearchWithRetry(value, searchFab, searchInput, retries - 1), 260);
    }

    function submitSearch(searchFab, searchInput) {
        const value = (searchInput.value || '').trim();
        if (!value) {
            collapseSearch(searchFab, searchInput);
            return;
        }
        // 仅处理“行李追踪数据”标签：不切换页面。
        // 这里不把“激活态判断”作为硬门槛，避免页面样式差异导致误报。
        if (isTabActiveByText(document, '行李追踪数据')) {
            submitSearchWithRetry(value, searchFab, searchInput, 2);
            return;
        }

        const clicked = activateTrackingTab(document);
        if (!clicked) {
            alert('未找到“行李追踪数据”标签页。');
            collapseSearch(searchFab, searchInput);
            return;
        }

        // 点击标签后直接进入提交重试链路，是否真的切到目标区由元素匹配决定
        setTimeout(() => submitSearchWithRetry(value, searchFab, searchInput, 2), 700);
    }

    function bindSearchShortcut(doc) {
        if (!doc || !doc.body || doc.getElementById(SEARCH_FAB_ID)) return;

        const searchFab = doc.createElement('button');
        searchFab.id = SEARCH_FAB_ID;
        searchFab.type = 'button';
        searchFab.title = '查询BRS记录';
        searchFab.innerHTML = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAvCAYAAAB30kORAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHOSURBVGhD7ZbBrcMgDEDd/6+5swVbIHWIbBGp554jZQu2YAsG6N1T5F9q5Fg0BcInisSTeghBzQOM7du6ritcjB85cAW6dCu6dCu6dCu6dCu6dCu6dCsuKX072poiIjjnABEBEUEpBUop0FqD1lpOr0KxNCLCsizgvZevAkopmKapunyRtHMOlmWRwx8ZxxHGcZTDxWRLW2vBWhuelVJgjAkh4b3fhAxRUzxL2nsPj8cjPGutYZ7nzRyCxPkC53muEipZ2YML7AnD+wTk7uaE1B7J0oi4uXR7whwKHYj8RynJ0vxjxpjNuz0o5onTpHPjks9vKs0zQa40hUctkqX5h/kCUuC7W2MBRdJHjjj3lGIkS/PL5JzbvPsGn998p2mXqO9IwVobTqZWE5UsDe9STMhqF0OW/FPKOEREqPJRS0oFRPYe3ypoDtnSEBH/hjEmxLUxBqZpklOyKJKGdwbh8RqD99P3+z2MHxUvlia89+EHLKXJSydP54j4YelUYq1qqXhW9jgCNU4yA6WmTk4zaago/vt8Pp9y8D8ZhgGUUjAMQ7gHr9cLIKPEN91pIrbje1lI0uwifoLSZk7hOV26hFPC4yhduhVduhWXlP4DZ5EWwrVS8ToAAAAASUVORK5CYII=" alt="搜索" style="width:20px;height:20px;display:block;">';
        searchFab.style.display = 'none';

        const searchInput = doc.createElement('input');
        searchInput.id = SEARCH_INPUT_ID;
        searchInput.type = 'search';
        searchInput.placeholder = '输入行李号，支持 / 分隔';
        searchInput.style.display = 'none';

        doc.body.appendChild(searchInput);
        doc.body.appendChild(searchFab);

        searchFab.onclick = () => {
            if (!state.searchExpanded) {
                state.searchExpanded = true;
                searchFab.classList.add('tmk-search-active');
                searchInput.style.display = 'block';
                searchInput.focus();
                searchInput.select();
                return;
            }
            submitSearch(searchFab, searchInput);
        };

        searchInput.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                submitSearch(searchFab, searchInput);
            }
            if (evt.key === 'Escape') {
                evt.preventDefault();
                collapseSearch(searchFab, searchInput);
            }
        });
    }

    function ensureSearchShortcut(doc) {
        if (!doc || !doc.body) return;
        bindSearchShortcut(doc);
    }

    // --- 启动流程 ---
    hideLegacyChrome();
    if (inContentFrame) {
        const timer = setInterval(() => {
            if (document.body) {
                injectStyle(document);
                ensureSearchShortcut(document);
                setSearchShortcutVisible(false);
                const fab = document.createElement('button'); fab.id = FAB_ID; fab.textContent = '☰';
                document.body.appendChild(fab);
                const overlay = document.createElement('div'); overlay.id = OVERLAY_ID;
                overlay.innerHTML = `
                    <div id="tmk-panel-viewport">
                        <section class="tmk-page" id="tmk-root-page">
                            <h1 class="tmk-h1">开始</h1>
                            <div class="tmk-grid" id="tmk-pinned-grid"></div>
                            <div class="tmk-grid" id="${ROOT_GRID_ID}"></div>
                        </section>
                        <section class="tmk-page" id="tmk-sub-page" style="display:none;">
                            <h1 class="tmk-h1">业务</h1>
                            <div class="tmk-grid" id="${SUB_GRID_ID}"></div>
                        </section>
                    </div>`;
                document.body.appendChild(overlay);

                // 页面局部刷新或脚本重绘时，自动补建搜索按钮，避免依赖菜单按钮交互后才出现
                setInterval(() => {
                    ensureSearchShortcut(document);
                }, 1500);

                fab.onclick = () => {
                    if (!state.overlayOpen) {
                        overlay.style.display = 'block'; renderTiles(document, overlay, fab);
                        state.overlayOpen = true; showRootPage(overlay, fab);
                        setSearchShortcutVisible(true);
                    } else if (state.showingSub) {
                        showRootPage(overlay, fab);
                    } else {
                        closeOverlay(overlay, fab);
                    }
                };
                clearInterval(timer);
            }
        }, 500);
    }
})();