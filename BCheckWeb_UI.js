// ==UserScript==
// @name         BCheckWeb UI 瓷砖菜单 - 0.7.0 最终版
// @namespace    http://tampermonkey.net/
// @version      0.7.0
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
    const OVERLAY_ID = 'tmk-overlay';
    const ROOT_GRID_ID = 'tmk-root-grid';
    const SUB_GRID_ID = 'tmk-sub-grid';

    const state = { overlayOpen: false, showingSub: false, currentGroup: null };

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
                display: none; background: rgba(200, 200, 200, 0.4)!important; backdrop-filter: blur(10px);
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
                position: fixed !important; left: 30px !important; top: 30px !important;
                z-index: 2147483647 !important; width: 48px !important; height: 48px !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: rgba(var(--tmk-blue), 0.15) !important; color: #fff !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important; border-radius: 50% !important;
                font-family: "Segoe UI Light", sans-serif !important; font-size: 32px !important;
                font-weight: 100 !important; cursor: pointer !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            #${FAB_ID}:hover { background: rgba(var(--tmk-blue), 0.8) !important; transform: translateX(-5px) !important; }
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

    // --- 5. 菜单渲染与绑定 ---
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
                pinnedGrid.appendChild(buildTile(doc, l.text, 'tmk-core', () => {
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
            rootGrid.appendChild(buildTile(doc, g.title, 'tmk-core', () => {
                const subGrid = doc.getElementById(SUB_GRID_ID);
                subGrid.innerHTML = '';
                g.links.forEach(l => {
                    subGrid.appendChild(buildTile(doc, l.text, 'tmk-data', () => {
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
    }

    // --- 启动流程 ---
    hideLegacyChrome();
    if (inContentFrame) {
        const timer = setInterval(() => {
            if (document.body) {
                injectStyle(document);
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

                fab.onclick = () => {
                    if (!state.overlayOpen) {
                        overlay.style.display = 'block'; renderTiles(document, overlay, fab);
                        state.overlayOpen = true; showRootPage(overlay, fab);
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