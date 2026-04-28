// ==UserScript==
// @name         BCheckWeb UI 瓷砖菜单
// @namespace    http://tampermonkey.net/
// @version      0.7.10
// @description  增加滑动动画/精简部分代码
// @author       Gostnort
// @match        http://60.247.100.98/BCheckWeb/*
// @match        https://60.247.100.98/BCheckWeb/*
// @match        http://202.96.17.98/BCheckWeb/*
// @match        https://202.96.17.98/BCheckWeb/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function isUnderContentFrame() {
        try {
            let w = window;
            while (w && w !== w.top) {
                const fe = w.frameElement;
                if (fe && fe.id === 'content_frame') return true;
                w = w.parent;
            }
            return false;
        } catch (e) {
            return false;
        }
    }


    const inTopWindow = window.top === window.self;
    const inContentFrame = !inTopWindow && isUnderContentFrame();
    if (!inTopWindow && !inContentFrame) return;
    if (!window.__tmkUiToolset) return;

    const MENU_BUTTON_ID = 'tmk-menu-button';
    const SEARCH_BUTTON_ID = 'tmk-search-button';
    const SEARCH_INPUT_ID = 'tmk-search-input';
    const PENDING_SEARCH_KEY = 'tmk-pending-search';
    const MODERN_LOST_QUERY_KEY = 'tmk-modern-lost-query-v2-launch';
    const ACCEPT_STATION_COMPANY_KEY = 'tmk-accept-station-company';
    const ACCEPT_STATION_INPUT_ID = 'tmk-accept-station-input';
    const DEFAULT_ACCEPT_STATION_COMPANY = 'LAXCA';
    const OVERLAY_ID = 'tmk-overlay';
    const ROOT_GRID_ID = 'tmk-root-grid';
    const SUB_GRID_ID = 'tmk-sub-grid';
    const SYSTEM_GRID_ID = 'tmk-system-grid';
    const THEME_STORAGE_KEY = 'tmk-theme-index';
    const START_BTN_ID = 'tmk-start-theme-btn';
    const THEME_JSON_URL = 'https://raw.githubusercontent.com/Gostnort/BSIS_tampermonkey_plugin/main/BCheckWeb_theme.json';
    const return_icon = 'data:image/png;base64,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';
    const search_icon = 'data:image/png;base64,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';
    const TOOLSET_GLOBAL_KEY = '__tmkUiToolset';

    const state = { overlayOpen: false, showingSub: false, currentGroup: null, searchExpanded: false };


    function resolveToolset() {
        const topToolset = (function() {
            try {
                return window.top && window.top[TOOLSET_GLOBAL_KEY];
            } catch (e) {
                return null;
            }
        })();
        if (topToolset && typeof topToolset === 'object') return topToolset;
        if (window[TOOLSET_GLOBAL_KEY] && typeof window[TOOLSET_GLOBAL_KEY] === 'object') return window[TOOLSET_GLOBAL_KEY];
        return null;
    }


    function themeControllerOptions() {
        const ts = resolveToolset();
        return {
            themeStorageKey: THEME_STORAGE_KEY,
            themeJsonUrl: THEME_JSON_URL,
            defaultThemePack: ts.DEFAULT_THEME_PACK,
            onThemeApplied: function() {
                try {
                    publishUiMetrics(calcUiMetrics());
                } catch (e) {}
            }
        };
    }


    async function bootstrapTheme(doc) {
        await resolveToolset().StartMenuThemeController.bootstrapTheme(doc, themeControllerOptions());
    }


    async function cycleTheme(doc) {
        await resolveToolset().StartMenuThemeController.cycleTheme(doc, themeControllerOptions());
    }

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


    function setUiOverlayState(open) {
        try {
            if (window.top) window.top.__tmkUiOverlayOpen = !!open;
        } catch (e) {}
        window.__tmkUiOverlayOpen = !!open;
    }


    function matchMyViews(linkText) {
        const text = String(linkText || '').replace(/\s+/g, '');
        if (!/新建少收查询|新建少收/.test(text)) return;
        try {
            window.sessionStorage.setItem(MODERN_LOST_QUERY_KEY, String(Date.now()));
        } catch (e) {}
    }

    // --- 2. 启动时默认折叠布局（利用 control_frame 内置方法安全折叠 menu_frame） ---
    function foldOrigMenu() {
        let isFullyApplied = false;
        try {
            const topDoc = window.top && window.top.document ? window.top.document : document;
            const mainFs = topDoc.getElementById('main_frameset');
            const contentFs = topDoc.getElementById('content_frameset');
            
            // 1. 折叠系统自带的头部和底部
            if (mainFs) mainFs.rows = '0,*,0';
            
            // 2. 利用 control_frame 触发展开/折叠逻辑
            if (contentFs) {
                try {
                    const cfWindow = window.top.frames['control_frame'];
                    if (cfWindow && typeof cfWindow.isHidden !== 'undefined') {
                        // 如果尚未折叠，触发原生机制
                        if (cfWindow.isHidden === false) {
                            if (typeof cfWindow.switchSysBar === 'function') {
                                cfWindow.switchSysBar();
                            } else {
                                const td = cfWindow.document.querySelector('.navPoint');
                                if (td) td.click();
                            }
                        }
                        isFullyApplied = true; // 状态处理完毕
                    } else {
                        isFullyApplied = false; // control_frame 未就绪，触发重试
                    }
                } catch(e) {
                    // 跨域或完全意外时兜底硬编码修改
                    contentFs.cols = '0,8,*';
                    contentFs.setAttribute('cols', '0,8,*');
                    isFullyApplied = true;
                }
            }
        } catch (e) {}
        return isFullyApplied;
    }

    // --- 3. 审美布局与 CSS (解决按钮掉到底部问题) ---
    function calcUiMetrics() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const shortSide = Math.min(vw, vh);
        const small = Math.max(46, Math.min(78, Math.round(shortSide * 0.07)));
        const gap = Math.max(8, Math.min(16, Math.round(small * 0.22)));
        const medium = small * 2;
        // 大 tile 宽度：两个 medium 并排 + 间距，供 Step2 等壳层与 --tmk-big-tile 共用
        const bigTile = medium * 2 + gap;
        const smallTileH = (medium - gap) / 2;
        return {
            small: small,
            gap: gap,
            medium: medium,
            bigTile: bigTile,
            smallTileH: smallTileH,
            h1Size: Math.max(30, Math.min(48, Math.floor(vw * 0.035)))
        };
    }


    function publishUiMetrics(metrics) {
        if (!metrics) return;
        const med = Number(metrics.medium) || 92;
        const g = Number(metrics.gap) || 8;
        let themeId = 1;
        try {
            themeId = resolveToolset().StartMenuThemeController.getCurrentThemeId();
        } catch (e) {}
        const payload = {
            small: Number(metrics.small) || 46,
            gap: g,
            medium: med,
            bigTile: Number.isFinite(metrics.bigTile) ? Number(metrics.bigTile) : med * 2 + g,
            smallTileH: Number.isFinite(metrics.smallTileH) ? Number(metrics.smallTileH) : (med - g) / 2,
            h1Size: Number(metrics.h1Size) || 30,
            themeId: themeId,
            ts: Date.now()
        };
        try {
            if (window.top) window.top.__tmkUiMetrics = payload;
        } catch (e) {}
        window.__tmkUiMetrics = payload;
    }


    // 从 sessionStorage 读取受理航站公司（缺省 LAXCA）
    function readStoredAcceptStationCompany() {
        try {
            const raw = window.sessionStorage.getItem(ACCEPT_STATION_COMPANY_KEY);
            if (raw != null && String(raw).trim() !== '') return String(raw).trim();
        } catch (e) {}
        return DEFAULT_ACCEPT_STATION_COMPANY;
    }


    // 同步到 window / top 与 sessionStorage，供其他 userscript 读取
    function publishAcceptStationCompany(value) {
        const v = String(value != null ? value : '').trim() || DEFAULT_ACCEPT_STATION_COMPANY;
        try {
            if (window.top) window.top.__tmkAcceptStationCompany = v;
        } catch (e) {}
        window.__tmkAcceptStationCompany = v;
        try {
            window.sessionStorage.setItem(ACCEPT_STATION_COMPANY_KEY, v);
        } catch (e) {}
    }

    function injectStyle(doc) {
        if (!doc || !doc.head) return;
        const ts = resolveToolset();
        const def = ts.DEFAULT_THEME_PACK.themes[0];
        ts.StartMenuThemeController.saveThemeIndex(THEME_STORAGE_KEY, 1);
        ts.StartMenuThemeController.applyThemeCss(doc, {
            id: def.id,
            name: def.name,
            colors: ts.StartMenuThemeController.expandThemeColors(def.colors, ts.DEFAULT_THEME_PACK)
        });
        const tc = ts.ThemeVarToolset.themeColorVarFromKey;
        const zv = ts.zLayerCssVarFromKey;
        const m = calcUiMetrics();
        const z = ts.publishZLayers();
        publishUiMetrics(m);
        publishAcceptStationCompany(readStoredAcceptStationCompany());
        let style = doc.getElementById('tmk-ui-style');
        if (!style) {
            style = doc.createElement('style');
            style.id = 'tmk-ui-style';
            doc.head.appendChild(style);
        }
        style.textContent = `
            :root {
                --tmk-small: ${m.small}px; --tmk-medium: ${m.medium}px; --tmk-gap: ${m.gap}px;
                --tmk-big-tile: ${m.bigTile}px;
                --tmk-small-tile-h: ${m.smallTileH}px;
                --tmk-toolbar-top: 10px;
                --tmk-toolbar-right: 12px;
                --tmk-toolbar-gap: 6px;
                --tmk-toolbar-padding: 5px;
                --tmk-toolbar-radius: 999px;
                --tmk-toolbar-shadow: 0 6px 16px rgba(23, 52, 86, 0.16);
                --tmk-toolbar-blur: 8px;
                --tmk-toolbar-btn-min-height: 30px;
                --tmk-toolbar-btn-padding-x: 12px;
                --tmk-toolbar-btn-radius: 999px;
                --tmk-toolbar-btn-font-size: 14px;
                ${zv('basePage')}: ${z.basePage};
                ${zv('backgroundCover')}: ${z.backgroundCover};
                ${zv('mainFunctionView')}: ${z.mainFunctionView};
                ${zv('functionButton')}: ${z.functionButton};
                ${zv('searchControls')}: ${z.searchControls};
                ${zv('floatingButton')}: ${z.floatingButton};
            }
            #${OVERLAY_ID} {
                position: fixed!important; inset: 0!important; z-index: var(${zv('mainFunctionView')})!important;
                display: none; background: var(${tc('overlayBackdrop')})!important; backdrop-filter: blur(10px);
            }
            #tmk-panel-viewport {
                position: relative !important;
                z-index: var(${zv('mainFunctionView')}) !important;
                display: flex !important;
                flex-direction: row !important;
                width: 200vw !important;
                overflow: hidden !important;
                transition: transform 0.3s ease !important;
                will-change: transform;
            }
            .tmk-page {
                width: 100vw !important;
                flex-shrink: 0 !important;
                height: 100% !important; overflow-y: auto !important;
                box-sizing: border-box !important;
                /* 修复 Padding 冲突：明确上下左右间距 */
                padding-top: 50px !important;
                padding-bottom: 60px !important;
                padding-right: 40px !important;
                padding-left: clamp(80px, 12vw, 160px) !important;
                position: relative !important;
                z-index: var(${zv('mainFunctionView')}) !important;
            }
            #${SEARCH_INPUT_ID} {
                position: fixed !important; right: 72px !important; top: 26px !important;
                z-index: var(${zv('searchControls')}) !important; width: 340px !important; height: 34px !important;
                box-sizing: border-box !important; border-radius: 6px !important;
                border: 1px solid var(${tc('searchInputBorder')}) !important;
                padding: 0 10px !important; background: var(${tc('searchInputBg')}) !important;
                color: var(${tc('searchInputFg')}) !important; outline: none !important;
            }
            #${SEARCH_INPUT_ID}.tmk-search-loading {
                background: var(${tc('searchLoadingBg')}) !important;
                color: var(${tc('searchLoadingFg')}) !important;
            }
            #${SEARCH_INPUT_ID}::placeholder {
                color: var(${tc('searchPlaceholder')}) !important;
            }
            .tmk-h1 {
                font-size: ${m.h1Size}px !important; font-weight: 100 !important; color: var(${tc('h1')}) !important;
                margin: 0 0 10px 0 !important; letter-spacing: -1px !important;
            }
            .tmk-root-title-row {
                display: flex !important; align-items: center !important; flex-wrap: wrap !important;
                gap: 0.35em 0.55em !important; margin: 0 0 10px 0 !important;
                position: relative !important;
                z-index: var(${zv('functionButton')}) !important;
            }
            .tmk-root-title-row .tmk-h1 { margin: 0 !important; }
            .tmk-root-title-row .tmk-start-btn,
            .tmk-root-title-row #${ACCEPT_STATION_INPUT_ID} {
                height: var(--tmk-small-tile-h) !important;
                min-height: var(--tmk-small-tile-h) !important;
                box-sizing: border-box !important;
                display: inline-flex !important;
                align-items: center !important;
                font-size: min(${m.h1Size}px, calc(var(--tmk-small-tile-h) * 0.85)) !important;
                line-height: 1 !important;
            }
            .tmk-start-btn {
                font-family: inherit !important;
                font-weight: 100 !important;
                letter-spacing: inherit !important;
                background: transparent !important; border: none !important; padding: 0 4px !important; margin: 0 !important;
                cursor: pointer !important; text-align: left !important;
                -webkit-appearance: none !important; appearance: none !important; box-shadow: none !important;
                position: relative !important;
                z-index: var(${zv('functionButton')}) !important;
            }
            #${ACCEPT_STATION_INPUT_ID} {
                flex: 0 1 auto !important; min-width: 3.5em !important; max-width: 18em !important;
                font-family: inherit !important; font-weight: 100 !important;
                color: var(${tc('h1')}) !important; letter-spacing: -1px !important;
                margin: 0 !important; padding: 0 8px !important; border: none !important; background: transparent !important;
                outline: none !important; box-shadow: none !important; -webkit-appearance: none !important;
                appearance: none !important;
            }
            #${ACCEPT_STATION_INPUT_ID}::placeholder { color: inherit !important; opacity: 0.45 !important; }
            .tmk-active-tag { display: none !important; }
            .tmk-grid { display: grid !important; gap: var(--tmk-gap) !important; grid-template-columns: repeat(auto-fill, var(--tmk-medium)) !important; }
            #${ROOT_GRID_ID}, #${SUB_GRID_ID}, #${SYSTEM_GRID_ID}, #tmk-pinned-grid {
                position: relative !important;
                z-index: var(${zv('functionButton')}) !important;
            }

            /* 常驻少收：两侧大磁贴 + 中间标准磁贴 */
            #tmk-pinned-grid.tmk-pinned-grid--wide {
                grid-template-columns: var(--tmk-big-tile) var(--tmk-medium) var(--tmk-big-tile) !important;
                align-items: center !important;
            }

            /* 黄金比例间距：常驻区与主网格、主网格与系统行 */
            #${ROOT_GRID_ID}, #${SYSTEM_GRID_ID} { margin-top: calc(var(--tmk-medium) * 0.618) !important; }

            #${SYSTEM_GRID_ID} {
                grid-template-columns: var(--tmk-medium) !important;
                justify-content: start !important;
            }


        `;
    }

    // --- 4. 标题联动逻辑 ---
    function showRootPage(overlay, menuBtn) {
        const vp = overlay.querySelector('#tmk-panel-viewport');
        if (vp) vp.style.transform = 'translateX(0)';
        const h1 = overlay.querySelector('#tmk-root-page .tmk-start-btn') || overlay.querySelector('#tmk-root-page .tmk-h1');
        if (h1) h1.textContent = '开始';
        state.showingSub = false;
        menuBtn.textContent = '✕';
        menuBtn.style.backgroundImage = '';
        menuBtn.style.backgroundSize = '';
        menuBtn.style.backgroundRepeat = '';
        menuBtn.style.backgroundPosition = '';
    }

    function showSubPage(overlay, menuBtn, titleText) {
        const vp = overlay.querySelector('#tmk-panel-viewport');
        if (vp) vp.style.transform = 'translateX(-100vw)';
        const subH1 = overlay.querySelector('#tmk-sub-page .tmk-h1');
        if (subH1) subH1.textContent = titleText || '业务';
        state.showingSub = true;
        menuBtn.innerHTML = `<img src="${return_icon}" alt="" draggable="false" style="width:30px;height:30px;display:block;object-fit:contain;">`;
    }

    // --- 5. 磁贴等级色（lv1 核心高频 … lv5 系统边缘）---
    function tileLevelClass(title, groupTitle) {
        const t = String(title || '').trim();
        const g = String(groupTitle || '').trim();
        if (/退出系统/.test(t)) return 'tmk-lv5';
        if (/系统维护/.test(t)) return 'tmk-lv5';
        if (/新建少收查询|新建少收|少收查看/.test(t)) return 'tmk-lv1';
        if (/快速查找|信息处理/.test(t)) return 'tmk-lv3';
        if (/业务文件管理|统计查询|航站信息|大批行李核对|打印报销单/.test(t)) return 'tmk-lv4';
        if (/^(多收行李|破损行李|速运行李|速运行行李)$/.test(t)) return 'tmk-lv2';
        if (/^(多收行李|破损行李|速运行李|速运行行李)$/.test(g)) return 'tmk-lv2';
        if (/快速查找|信息处理/.test(g)) return 'tmk-lv3';
        if (/业务文件管理|统计查询|航站信息|大批行李核对|打印报销单/.test(g)) return 'tmk-lv4';
        if (/系统维护/.test(g)) return 'tmk-lv5';
        return 'tmk-lv4';
    }


    // 常驻区第一行：两侧大磁贴（新建少收查询 / 少收查看）
    function tileSizePinnedClass(title) {
        const t = String(title || '').trim();
        if (/新建少收查询/.test(t) || /少收查看/.test(t)) return 'tmk-tile--big';
        return '';
    }


    // 第三级辅助工具：快速查找 / 信息处理区 
    function tileLv3OutlineClass(title) {
        const t = String(title || '').trim();
        if (/快速查找|信息处理/.test(t)) return 'tmk-tile--kv-tool';
        return '';
    }


    // --- 6. 菜单渲染与绑定 ---
    function renderTiles(doc, overlay, menuBtn) {
        const rootGrid = doc.getElementById(ROOT_GRID_ID);
        const pinnedGrid = doc.getElementById('tmk-pinned-grid');
        const systemGrid = doc.getElementById(SYSTEM_GRID_ID);
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

        rootGrid.innerHTML = '';
        pinnedGrid.innerHTML = '';
        pinnedGrid.classList.remove('tmk-pinned-grid--wide');
        if (systemGrid) systemGrid.innerHTML = '';
        const lostG = groups.find(g => /少收/.test(g.title));
        const sysG = groups.find(g => /系统维护/.test(g.title));

        // 常驻区（不含退出；大|中|大 时加宽列模板）
        if (lostG) {
            const row = lostG.links.slice(0, 3);
            if (row.length >= 3) pinnedGrid.classList.add('tmk-pinned-grid--wide');
            row.forEach(l => {
                pinnedGrid.appendChild(buildTile(doc, l.text, 'tmk-lv1', () => {
                    navigateLink(overlay, menuBtn, l.text, l.href);
                }, tileSizePinnedClass(l.text), tileLv3OutlineClass(l.text)));
            });
        }

        // 主菜单（不含少收整组、不含系统维护整组）
        groups.forEach(g => {
            if (lostG && g.title === lostG.title) return;
            if (sysG && g.title === sysG.title) return;
            rootGrid.appendChild(buildSubGroupTile(doc, overlay, menuBtn, g, ''));
        });

        // 第三行：退出系统 + 系统维护（小磁贴）
        if (systemGrid) {
            systemGrid.appendChild(buildTile(doc, '退出系统', 'tmk-lv5', () => {
                window.top.location.href = getLogoutUrl();
            }, 'tmk-tile--small'));
            if (sysG) {
                systemGrid.appendChild(buildSubGroupTile(doc, overlay, menuBtn, sysG, 'tmk-tile--small'));
            }
        }
    }

    function armScriptGateFromNavigation(href, linkText) {
        const toolset = resolveToolset();
        if (!toolset || !toolset.ScriptGate || typeof toolset.ScriptGate.arm !== 'function') return;
        const mk = typeof toolset.ScriptGate.moduleKeyFromHref === 'function'
            ? toolset.ScriptGate.moduleKeyFromHref(String(href || ''), String(linkText || ''))
            : null;
        if (mk) toolset.ScriptGate.arm(mk);
    }


    // 封装磁贴点击后的固定跳转步骤：闸门 → 标记少收入口 → 关菜单 → 页面跳转
    function navigateLink(overlay, menuBtn, linkText, href) {
        armScriptGateFromNavigation(href, linkText);
        matchMyViews(linkText);
        closeStartMenu(overlay, menuBtn);
        navigateToContent(href);
    }


    function buildSubGroupTile(doc, overlay, menuBtn, group, sizeCls) {
        return buildTile(doc, group.title, tileLevelClass(group.title, group.title), () => {
            const subGrid = doc.getElementById(SUB_GRID_ID);
            subGrid.innerHTML = '';
            group.links.forEach(l => {
                subGrid.appendChild(buildTile(doc, l.text, tileLevelClass(l.text, group.title), () => {
                    navigateLink(overlay, menuBtn, l.text, l.href);
                }, '', tileLv3OutlineClass(l.text)));
            });
            showSubPage(overlay, menuBtn, group.title);
        }, sizeCls || '', tileLv3OutlineClass(group.title));
    }


    function buildTile(doc, title, cls, onClick, sizeCls, extraCls) {
        const tsb = resolveToolset();
        let Ctor = tsb.MediumTile;
        if (sizeCls && /tmk-tile--big/.test(sizeCls)) Ctor = tsb.BigTile;
        if (sizeCls && /tmk-tile--small/.test(sizeCls)) Ctor = tsb.SmallTile;
        const inst = new Ctor({
            document: doc,
            title: title,
            levelClass: cls,
            extraClass: extraCls || '',
            onClick: onClick
        });
        return inst.nativeElement;
    }

    function closeStartMenu(overlay, menuBtn) {
        overlay.style.display = 'none'; state.overlayOpen = false;
        menuBtn.textContent = '☰';
        menuBtn.style.backgroundImage = '';
        menuBtn.style.backgroundSize = '';
        menuBtn.style.backgroundRepeat = '';
        menuBtn.style.backgroundPosition = '';
        setUiOverlayState(false);
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

    function collapseSearch(searchBtn, searchInput) {
        state.searchExpanded = false;
        if (searchBtn) searchBtn.classList.remove('tmk-search-active');
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.classList.remove('tmk-search-loading');
            searchInput.style.removeProperty('background');
            searchInput.style.removeProperty('color');
            searchInput.style.display = 'none';
            searchInput.value = '';
        }
    }

    function setSearchLoading(searchBtn, searchInput, loading) {
        if (!searchInput) return;
        if (searchBtn && loading) searchBtn.classList.add('tmk-search-active');
        if (loading) {
            searchInput.disabled = true;
            searchInput.classList.add('tmk-search-loading');
            searchInput.value = '页面加载中……';
            return;
        }
        searchInput.disabled = false;
        searchInput.classList.remove('tmk-search-loading');
        searchInput.style.removeProperty('background');
        searchInput.style.removeProperty('color');
    }

    function setSearchShortcutVisible(visible) {
        const searchBtn = document.getElementById(SEARCH_BUTTON_ID);
        const searchInput = document.getElementById(SEARCH_INPUT_ID);
        if (!searchBtn) return;
        searchBtn.style.setProperty('display', visible ? 'inline-flex' : 'none', 'important');
        if (!visible && searchInput) collapseSearch(searchBtn, searchInput);
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

    function savePendingSearch(value) {
        try {
            const payload = { value: String(value || ''), ts: Date.now() };
            window.sessionStorage.setItem(PENDING_SEARCH_KEY, JSON.stringify(payload));
        } catch (e) {}
    }

    function readPendingSearch() {
        try {
            const raw = window.sessionStorage.getItem(PENDING_SEARCH_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data.value !== 'string') return null;
            if (!data.ts || Date.now() - data.ts > 5 * 60 * 1000) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function clearPendingSearch() {
        try {
            window.sessionStorage.removeItem(PENDING_SEARCH_KEY);
        } catch (e) {}
    }

    function waitUntil(predicate, timeoutMs, intervalMs) {
        const timeout = Number.isFinite(timeoutMs) ? timeoutMs : 4000;
        const interval = Number.isFinite(intervalMs) ? intervalMs : 120;
        return new Promise((resolve) => {
            const startedAt = Date.now();
            const timer = setInterval(() => {
                let ok = false;
                try {
                    ok = !!predicate();
                } catch (e) {
                    ok = false;
                }
                if (ok) {
                    clearInterval(timer);
                    resolve(true);
                    return;
                }
                if (Date.now() - startedAt >= timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, interval);
        });
    }

    async function ensureTrackingTabReady(rounds) {
        for (let i = 0; i < rounds; i += 1) {
            if (isTabActiveByText(document, '行李追踪数据')) return true;
            const clicked = activateTrackingTab(document);
            if (!clicked) {
                await waitUntil(() => !!findVisibleExactTextNode(document, '行李追踪数据'), 2000, 120);
                continue;
            }
            const activated = await waitUntil(
                () => isTabActiveByText(document, '行李追踪数据') || !!findBrsTargets(document),
                2200,
                120
            );
            if (activated) return true;
        }
        return isTabActiveByText(document, '行李追踪数据') || !!findBrsTargets(document);
    }

    function submitSearchWithRetry(value, searchBtn, searchInput, retries) {
        const targets = findBrsTargets(document);
        if (targets) {
            // 同步赋值并触发输入事件，兼容页面监听逻辑
            targets.input.value = value;
            targets.input.dispatchEvent(new Event('input', { bubbles: true }));
            targets.input.dispatchEvent(new Event('change', { bubbles: true }));
            targets.button.click();
            if (searchBtn && searchInput) collapseSearch(searchBtn, searchInput);
            // 查询触发后自动收起开始页，减少手动关闭操作
            const overlay = document.getElementById(OVERLAY_ID);
            const menuBtn = document.getElementById(MENU_BUTTON_ID);
            if (overlay && menuBtn && state.overlayOpen) closeStartMenu(overlay, menuBtn);
            return;
        }
        if (retries <= 0) {
            alert('未找到“查询BRS记录”输入框或按钮。');
            if (searchBtn && searchInput) collapseSearch(searchBtn, searchInput);
            return;
        }
        setTimeout(() => submitSearchWithRetry(value, searchBtn, searchInput, retries - 1), 260);
    }

    async function continuePendingSearchIfNeeded() {
        const pending = readPendingSearch();
        if (!pending) return;
        const value = (pending.value || '').trim();
        if (!value) {
            clearPendingSearch();
            return;
        }
        await waitUntil(
            () => !!findVisibleExactTextNode(document, '行李追踪数据') || !!findBrsTargets(document),
            8000,
            150
        );
        const trackingReady = await ensureTrackingTabReady(10);
        if (!trackingReady) return;
        clearPendingSearch();
        submitSearchWithRetry(value, null, null, 2);
    }

    async function submitSearch(searchBtn, searchInput) {
        const value = (searchInput.value || '').trim();
        if (!value) {
            collapseSearch(searchBtn, searchInput);
            return;
        }
        setSearchLoading(searchBtn, searchInput, true);
        const submitDirect = () => submitSearchWithRetry(value, searchBtn, searchInput, 2);
        // 第一步：优先在当前页面激活“行李追踪数据”标签
        if (isTabActiveByText(document, '行李追踪数据')) {
            submitDirect();
            return;
        }
        const directTrackingOk = await ensureTrackingTabReady(3);
        if (directTrackingOk) {
            submitDirect();
            return;
        }

        // 第二步：当前页失败则切到“新建少收”，等待页面稳定后再激活目标标签
        const pageSwitched = activateTabByText(document, '新建少收');
        if (!pageSwitched) {
            alert('未找到“新建少收”页面或“行李追踪数据”标签页。');
            collapseSearch(searchBtn, searchInput);
            return;
        }
        // 页面切换通常触发导航，当前执行链会中断：先缓存查询值，等待新页面加载后自动续跑
        savePendingSearch(value);
    }

    function bindSearchShortcut(doc) {
        if (!doc || !doc.body || doc.getElementById(SEARCH_BUTTON_ID)) return;
        const tsS = resolveToolset();
        const searchInput = doc.createElement('input');
        searchInput.id = SEARCH_INPUT_ID;
        searchInput.type = 'search';
        searchInput.placeholder = '输入行李号，支持 / 分隔';
        searchInput.style.display = 'none';
        const searchInst = new tsS.SearchButton({
            document: doc,
            title: '查询BRS记录',
            innerHTML: '<img src="' + search_icon + '" alt="搜索" style="width:20px;height:20px;display:block;">',
            onClick: function(evt) {
                const el = evt.currentTarget;
                if (!state.searchExpanded) {
                    state.searchExpanded = true;
                    el.classList.add('tmk-search-active');
                    searchInput.style.display = 'block';
                    searchInput.focus();
                    searchInput.select();
                    return;
                }
                submitSearch(el, searchInput);
            }
        });
        const searchBtn = searchInst.nativeElement;
        searchBtn.style.display = 'none';
        doc.body.appendChild(searchInput);
        doc.body.appendChild(searchBtn);
        searchInput.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                submitSearch(searchBtn, searchInput);
            }
            if (evt.key === 'Escape') {
                evt.preventDefault();
                collapseSearch(searchBtn, searchInput);
            }
        });
    }

    // --- 启动流程 ---
    if (inContentFrame) {
        // 尝试执行一次折叠，如果由于加载延迟尚未就绪，则利用 waitUntil 轮询重试
        if (!foldOrigMenu()) {
            waitUntil(() => foldOrigMenu(), 2000, 100);
        }
        const timer = setInterval(() => {
            if (document.body) {
                injectStyle(document);
                bindSearchShortcut(document);
                setSearchShortcutVisible(false);
                const tsM = resolveToolset();
                const menuInst = new tsM.MenuButton({ document: document, textContent: '☰' });
                const menuBtn = menuInst.nativeElement;
                document.body.appendChild(menuBtn);
                const overlay = document.createElement('div'); overlay.id = OVERLAY_ID;
                overlay.innerHTML = `
                    <div id="tmk-panel-viewport">
                        <section class="tmk-page" id="tmk-root-page">
                            <div class="tmk-root-title-row">
                                <button type="button" id="${START_BTN_ID}" class="tmk-h1 tmk-start-btn">开始</button>
                                <input type="text" id="${ACCEPT_STATION_INPUT_ID}" class="tmk-station-inline"
                                    autocomplete="off" spellcheck="false" aria-label="受理航站公司" />
                            </div>
                            <div class="tmk-grid" id="tmk-pinned-grid"></div>
                            <div class="tmk-grid" id="${ROOT_GRID_ID}"></div>
                            <div class="tmk-grid" id="${SYSTEM_GRID_ID}"></div>
                        </section>
                        <section class="tmk-page" id="tmk-sub-page">
                            <h1 class="tmk-h1">业务</h1>
                            <div class="tmk-grid" id="${SUB_GRID_ID}"></div>
                        </section>
                    </div>`;
                document.body.appendChild(overlay);
                setUiOverlayState(false);

                const stationInput = document.getElementById(ACCEPT_STATION_INPUT_ID);
                if (stationInput) {
                    stationInput.value = readStoredAcceptStationCompany();
                    publishAcceptStationCompany(stationInput.value);
                    stationInput.addEventListener('input', () => publishAcceptStationCompany(stationInput.value));
                    stationInput.addEventListener('change', () => publishAcceptStationCompany(stationInput.value));
                }

                const startThemeBtn = document.getElementById(START_BTN_ID);
                if (startThemeBtn) {
                    startThemeBtn.addEventListener('click', (evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        cycleTheme(document).catch(() => {});
                    });
                }

                // 检查是否需要继续执行之前因跨页跳转而缓存的搜索动作
                continuePendingSearchIfNeeded();

                menuBtn.onclick = () => {
                    if (!state.overlayOpen) {
                        overlay.style.display = 'block'; renderTiles(document, overlay, menuBtn);
                        state.overlayOpen = true; showRootPage(overlay, menuBtn);
                        setUiOverlayState(true);
                        setSearchShortcutVisible(true);
                    } else if (state.showingSub) {
                        showRootPage(overlay, menuBtn);
                    } else {
                        closeStartMenu(overlay, menuBtn);
                    }
                };
                clearInterval(timer);
            }
        }, 500);
    }
})();
