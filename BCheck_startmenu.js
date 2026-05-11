// ==UserScript==
// @name         BCheckWeb UI 瓷砖菜单
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  第一页为首页快捷菜单；第二页为一级菜单；第三页为次级菜单
// @author       Gostnort
// @match        http://*/BCheckWeb/*
// @match        https://*/BCheckWeb/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(async function() {
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
    // 等待同 frame 内工具集就绪；若工具集晚于本脚本执行，原先此处同步 return 会导致菜单永不注入
    async function ensureToolset(timeoutMs) {
        const deadline = Date.now() + (Number.isFinite(timeoutMs) ? timeoutMs : 10000);
        const interval = 40;
        while (Date.now() < deadline) {
            try {
                if (window.__tmkUiToolset && typeof window.__tmkUiToolset === 'object') return true;
                const topTs = window.top && window.top.__tmkUiToolset;
                if (topTs && typeof topTs === 'object') {
                    window.__tmkUiToolset = topTs;
                    return true;
                }
            } catch (e) {}
            await new Promise(function(r) { setTimeout(r, interval); });
        }
        return !!(window.__tmkUiToolset && typeof window.__tmkUiToolset === 'object');
    }
    const toolsetReady = await ensureToolset(1000);
    if (!toolsetReady) return;

    const SEARCH_BUTTON_ID = 'tmk-search-button';
    const SEARCH_INPUT_ID = 'tmk-search-input';
    const PENDING_SEARCH_KEY = 'tmk-pending-search';
    const MODERN_LOST_QUERY_KEY = 'tmk-modern-lost-query-v2-launch';
    const ACCEPT_STATION_COMPANY_KEY = 'tmk-accept-station-company';
    const ACCEPT_STATION_INPUT_ID = 'tmk-accept-station-input';
    const DEFAULT_ACCEPT_STATION_COMPANY = 'LAXCA';
    const MENU_BUTTON_ID = 'tmk-menu-button';
    const OVERLAY_ID = 'tmk-overlay';
    const STARTMENU_ID = 'tmk-startmenu';
    const FRONT_PAGE_ID = 'tmk-front-page';
    const MAIN_PAGE_ID = 'tmk-main-page';
    const SUB_PAGE_ID = 'tmk-sub-page';
    const ROOT_GRID_ID = 'tmk-main-grid';
    const SUB_GRID_ID = 'tmk-sub-grid';
    const FRONT_GRID_ID = 'tmk-front-grid';
    const HEADER_BAR_ID = 'tmk-startmenu-header';
    const NAV_TO_MAIN_ID = 'tmk-nav-to-main';
    const NAV_TO_FRONT_ID = 'tmk-nav-to-front';
    const SLIDE_BTN_SHOW_CLASS = 'tmk-nav-btn--show';
    const SLIDE_BTN_ACTIVE_CLASS = 'tmk-nav-btn--active';
    const CONTEXT_MENU_ID = 'tmk-startmenu-contextmenu';
    const THEME_STORAGE_KEY = 'tmk-theme-index';
    const START_BTN_ID = 'tmk-start-theme-btn';
    const STORE_FRONTPAGE_KEY = 'tmk.startmenu.frontpage';
    const STORE_MAINMENU_KEY = 'tmk.startmenu.mainMenu';
    const STORE_SUBMENU_KEY = 'tmk.startmenu.subMenu';
    const THEME_JSON_URL = 'https://raw.githubusercontent.com/Gostnort/BSIS_tampermonkey_plugin/main/BCheckWeb_theme.json';
    const search_icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAA/CAYAAABQHc7KAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAKSUlEQVRo3u1ba0yU6RWeCzAgyE1uAwgIpa2LiAuItgnIGkUQiGzBRIIVxSsKKiq3wfsdL/uvt2TbtGnTP03T7Lp2bZP+aO1ms902abo/1tq6bbLd3WRt3XhpF3Zgpud58x5y+DoMw/ANMltNvjDOvDPfe57znPv7WU6fPm35f74szwB4BsAzAEy9Tp06pS792nry5EkbXXZ50fs2fGZcH7YACIEtLDBenz171nLhwgXLxYsXLZcvX1YXXp8/f16tp3WWEydOKECeFhhmCq6EhnAQFIIPDg5mHjhwYGV7e3tDU1PT1ubm5raOjo6NBw8eLKX1qViDtQCKgABwcw7ErIWnTYPmVmj23Llzlv3796+uqqq6kpub+7uYmJjHFovF6+uKj4//pKCg4DeNjY3He3t7i4aHhxV4AEKax7wDQG4K9IXQ2HhbW9uL+fn5v/Yh7DhdbqvV+hkuvNbvTayJiooaLS8v/xmxpRJAsCnNBQhBUx7CX7p0yXLkyJEv07+bUmAt7JgWFP93i8v4PkDx4Ls2m81L7HmZTCJFs8EeapMI2tFBU5s3b26Ljo5+iM1roaFdD4QkYVjb3ikut17DYOA1wPE6nc57PT09lfAPEoSnDoDWvA2ar62tHWRhhBZZkAlBY2NjH2dkZNzNy8t7m/zCH1JTU99zOByfyjX6OwDCQ6CM4j0CdnT37t0tuNfx48dDBsKMtI+NXL16FcIPiI2Paa27mcppaWkf19TUfLurq6thaGgoi/xEBCiN68yZM46BgYG8nTt3bl69evWPFyxY8EQDMWb4rXG73e7Zt2/f1zQTQuITAhYeG8BGtm3btkULP8paY62Ttj9taWm5SII6r1y5wgKz2agLr/EeQiDMiELlF6urq1+m32A2MJAKEPxmf39/OUIlos1TYQBujA309fUtIWo+MmhLCU8h7Y7L5aqA4Owkdcb3P9GDM0SsARhgVWdnZ2NCQsJ9CYL+683Ozr5LphCLfZjtEAO1eyu0T97+lrR5Fr6kpOTNa9eupQAkttfp6CrTZfpOhLb1IjKf9w0gKJ9QV1d3HYxhU5gzBkBTSHKI+vUGh6c2SLH/LgmfzNngTOxUahMgwCzIPxTHxcU9FCxT4ZJyhc+IYYXapKxmsWDaDXKWR178DS04Oz432ecIff68ts+gPbV0stDyjh07WjlUysiydu3a78DEzGTBtMLDkVF6W0ab8AiNqA1RHjAM+zUjTBkjTXFx8c8NkWY8MTHxAYG9yEw/4PdDOClohLz0sLBH5fySk5MfEDNSzHRMDDrS60OHDq2iMDhhBpp5XgqfrWCkdrIhZ4AKVzk5OW+x3Qun9F2tfdPoKEKucroUWd4UWabyPaSM75tpBn43A4dDcdpJVd0jEZtVaOru7q6HecBJmhmWOIQCgE2bNg0K5qn7FhYW/pFYaaU1lpAyAIJBQMrEKkSmphIfJCe0JjtU6SnMAMzbs2fPWuEMleklJSV9Qn4g1SyzCyT8NQr6Ky2QSdwjLdihhVAUKJx4HTt27AsRERETdQb+Uuo8Rvf9EucQoQRAlbtEw6+LpEdthkLiO9AQp7ah6isSCBnx8fGPJQMJkHEC5jmzUmO/EQAANDU1tTEA7IioqpsAIBQMYADIB2UsXLhwSgC4lxhSE2hvb681mkBmZubfCZyoUDGATaCnp6eQymO3wQTcdM9CXhdKADgJKhUbUJtArU7hL5fTUrO1z06QMsIagxP0pqSkfEx5QmLInaDIzFIoN/+XoKFKSMhDN4EhZodBmYDV1NSc4zDIxREVZG/pomhOUmGLrgNuc3nKaXBVVdUPQ5EIiWzQ7nQ639HAT/gfAuUbnAiFlAFSExs2bDgtmiDKGVEu8Ig2mkXrrGZUZ7LxAtC3b9++URZEnAh1dnY2aAdsmwsGcF5eRM5ozNDA9K5bt+5bVArPuhgyDlgAAOYKIvyqJCg9Pf1D+izOTOcbSFqq8vKlS5f+UmxI1eiRkZFu8tRV0Eiw3Vu5HkAC0Pr6+iGmvmyKUE4ybHZTJKCGCATcu3fvC4YOrqImeeV/kBB5xj7+TDXPZTDlHd2G+6iKkFLgh3SPLO0n5q4hwq1wOJ6ysrKfGlpiyi6JrndoTT6oC0GmG23J93Vv0AbNNzc3dwvNT+o5btmyZQh7MNPpzqQtDoHQyMxKTEy8LxgwAcKiRYs+IAdVDy3qYadVjsIZTNkQxf95QNrQ0NDvQ3j128XFxbcBkMvlsvtiz5y1xaHhXbt2bdQtbLdxo3ifwuP3+vr6noOtQjCYhk5b1e/AqbLQ+IzyiReoxP2VweN7JP0zMjLuUVlegvsPDQ1FinBpmy0QM21XqZFYW1vbHt6wsY+vh50jK1asuEGU3tvd3f18f39/GgkeS78Rd/To0SwS+it1dXV9ixcvfkNMh9xiziCBGNMMu0/AruApMoEaARANBzJCPxvk3GDr1q27MbnRQ81ROfA0zgEdDsdDEuAjMp+PqJh5YpweCxCNozUJiDchIeHD1tbW/QUFBbcpJP61urr6mwRstKwLZgpCsGNxxQSy+VoS7H1Ok4XnlpPfcV8jczFMHRffVZ/n5+f/noeu7GuYCcarqKjoF8SImGBBCPr8D5igM7LMysrKHxAbJg07MfmVo3DZ52eA9Bq3PDRBsf7k9evX7R0dHfXElhFRg3gMwGECPaJBuEV7cQQDwmxPh6iQhPB0+PDhr5aXl/+EytX/THFIQoIx6XOYx/r1618iH5MHZtFflXzhaI1mwpjwCR5ZHnOStGzZstfJSTo4gw0UBFPOB8Ek4N31sLOgpaWlm8C4Qd77byidcfCBhSWtYoj6JCcn5901a9b8iIRspd9JBogorzmZwqQIoY+cpcswkZoOhKiZMMHME2IqoYEQ0B4EIlBiCJAlvb29ZV1dXasoIqwaGBgoJeGyaaMq80PXiU1KJlDI98m2HZRkvW0Yv/sFAQMVgBAoE0xtZIjJr53LVQCCPIDPB+A13uMjcjxSM7IKFwGYHBcX928SbnwKM5AgjAsQbgbqE0LW05NZpL5sIiv0e0hSFmHLly+/pUPtiLEzNQ0IrxETIqdjwrw9wsrsgbk4nc47oh/h8QeAwRxuTgfCvBWeT5LqMwdZBMK7xvNIfkAAE0YCYcK8ZgAnXYgwGoQ7AYLgMTBhShDm9UluIwhUCC2m0BoUCORLXiXHGGX0O/P+OLuZIJSUlNygSBTNI/2weV5gChDuzgQETptra2svyWN3YfNgwxQg/DlQx8hHdanQ+pOcK4TV0x1BgjDpBOrKlStfkY3VsHvExQiCy+XKJRD+MgUIk/oJSUlJ/6T1RXKkF5bP+fhgQl56evo9XyCw8DhgRTVJhT7VYg37h6Z8MGFJWlrae7JDpU+je3Ggi4qwCl/zi7B+4kuCAM0CBDRQDb2GB8SQCm7Zh00mOBtzKC0tfZ2yxg8o7v+WQCn1N7kKewCMzy+hdoCXJ40vxF+A4u/xm88FAD76EVZuqshH8uasHzAfgAjkxPrnEoCZXv8FvIZIw2SmQw8AAAAASUVORK5CYII=';
    const TOOLSET_GLOBAL_KEY = '__tmkUiToolset';

    const state = { overlayOpen: false, page: 'front', currentGroup: null, searchExpanded: false, groups: [], contextMenuEl: null, suppressFrontClick: false, frontTileMap: {}, mainMenuSignature: '' };


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


    function storageGet(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(key, fallbackValue);
        } catch (e) {}
        try {
            const raw = localStorage.getItem(key);
            if (raw == null || raw === '') return fallbackValue;
            return JSON.parse(raw);
        } catch (e) {
            return fallbackValue;
        }
    }


    function storageSet(key, value) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, value);
                return;
            }
        } catch (e) {}
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
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
        const medium = Math.max(96, Math.min(176, Math.round(shortSide * 0.14)));
        const gap = Math.max(6, Math.round(medium * 0.1));
        // small 宽：medium - gap，使 (small + gap) == medium，保证列步进对齐 medium
        const small = Math.max(28, Math.round(medium - gap));
        // small 高：medium / 2，使 (small_h + gap) == medium/2 + gap，对齐大瓷砖的纵向节拍
        const smallTileH = Math.max(24, Math.round(medium / 2));
        // 大 tile 宽度：两个 medium 并排 + 间距，供 Step2 等壳层与 --tmk-big-tile 共用
        const bigTile = medium * 2 + gap;
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
            #${STARTMENU_ID} {
                position: relative !important;
                z-index: var(${zv('mainFunctionView')}) !important;
                display: flex !important;
                flex-direction: row !important;
                width: 300vw !important;
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
                padding-top: calc(var(--tmk-small-tile-h) + 52px) !important;
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
            .tmk-sub-h2 {
                font-size: max(22px, calc(${m.h1Size}px * 0.72)) !important;
                font-weight: 400 !important;
                color: var(${tc('majorFont')}) !important;
                margin: 0 0 10px 0 !important;
                letter-spacing: 0 !important;
            }
            .tmk-root-title-row {
                display: flex !important; align-items: center !important; flex-wrap: wrap !important;
                gap: 0.35em 0.55em !important; margin: 0 0 10px 0 !important;
                position: relative !important;
                z-index: var(${zv('functionButton')}) !important;
            }
            #${HEADER_BAR_ID} {
                position: fixed !important;
                top: 18px !important;
                left: 0 !important;
                right: 0 !important;
                padding-right: 40px !important;
                padding-left: clamp(80px, 12vw, 160px) !important;
                margin: 0 !important;
                z-index: var(${zv('functionButton')}) !important;
            }
            #${HEADER_BAR_ID} .tmk-h1 { margin: 0 !important; }
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
                background: transparent !important; border: none !important; padding: 0 4px !important; margin: 0 !important;
                cursor: pointer !important; text-align: left !important;
                -webkit-appearance: none !important; appearance: none !important; box-shadow: none !important;
                position: relative !important;
                z-index: var(${zv('functionButton')}) !important;
            }
            #${ACCEPT_STATION_INPUT_ID} {
                flex: 0 1 auto !important; min-width: 3.5em !important; max-width: 18em !important;
                margin: 0 !important; padding: 0 8px !important; border: none !important; background: transparent !important;
                outline: none !important; box-shadow: none !important; -webkit-appearance: none !important;
                appearance: none !important; color: var(${tc('h1')}) !important;
            }
            #${ACCEPT_STATION_INPUT_ID}::placeholder { color: inherit !important; opacity: 0.45 !important; }
            .tmk-active-tag { display: none !important; }
            .tmk-grid { display: grid !important; gap: var(--tmk-gap) !important; grid-template-columns: repeat(auto-fill, var(--tmk-medium)) !important; }
            #${ROOT_GRID_ID}, #${SUB_GRID_ID}, #${FRONT_GRID_ID} {
                position: relative !important;
                z-index: var(${zv('functionButton')}) !important;
            }
            #${FRONT_GRID_ID} {
                display: grid !important;
                grid-auto-flow: dense !important;
                gap: var(--tmk-gap) !important;
                grid-template-columns: repeat(auto-fill, var(--tmk-small-tile-h)) !important;
                grid-auto-rows: var(--tmk-small-tile-h) !important;
                align-content: start !important;
                min-height: calc(var(--tmk-small-tile-h) * 8) !important;
                margin-top: calc(var(--tmk-medium) * 0.618) !important;
            }
            #${FRONT_GRID_ID}.tmk-front-grid-dragging {
                background-image:
                    linear-gradient(to right, rgba(90, 126, 165, 0.22) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(90, 126, 165, 0.22) 1px, transparent 1px);
                background-size: calc(var(--tmk-small-tile-h) + var(--tmk-gap)) calc(var(--tmk-small-tile-h) + var(--tmk-gap));
                background-position: 0 0;
            }
            #${FRONT_GRID_ID} .tmk-drop-preview {
                position: absolute;
                pointer-events: none;
                border: 2px dashed rgba(42, 122, 220, 0.8);
                background: rgba(42, 122, 220, 0.16);
                box-sizing: border-box;
                border-radius: 4px;
                z-index: 20000;
            }
            #${FRONT_GRID_ID} .tmk-drop-preview.tmk-invalid {
                border-color: rgba(220, 42, 42, 0.95);
                background: rgba(220, 42, 42, 0.18);
            }
            .tmk-mainmenu-tile {
                background: var(${tc('minorButton')}) !important;
                color: var(${tc('majorFont')}) !important;
                border: 1px solid var(${tc('minorFocus')}) !important;
            }
            #${ROOT_GRID_ID} { margin-top: calc(var(--tmk-medium) * 0.618) !important; }

            .tmk-nav-btn {
                position: fixed !important;
                top: 0 !important;
                bottom: 0 !important;
                transform: none !important;
                width: 34px !important;
                height: auto !important;
                border-radius: 0 !important;
                background: transparent !important;
                border: none !important;
                color: var(${tc('h1')}) !important;
                font-size: 42px !important;
                line-height: 1 !important;
                cursor: pointer !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                z-index: var(${zv('functionButton')}) !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0 !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                transition: opacity 0.16s ease, filter 0.16s ease, text-shadow 0.16s ease, box-shadow 0.16s ease !important;
            }
            .tmk-nav-btn.${SLIDE_BTN_SHOW_CLASS} {
                display: flex !important;
                opacity: 0.72 !important;
                pointer-events: auto !important;
                background: transparent !important;
                border: none !important;
            }
            .tmk-nav-btn.${SLIDE_BTN_ACTIVE_CLASS} {
                opacity: 1 !important;
                background: transparent !important;
                color: var(${tc('minorButton')}) !important;
                text-shadow: 0 0 1px rgba(255,255,255,0.72), 0 0 14px rgba(120,170,220,0.45) !important;
                box-shadow: none !important;
            }
            .tmk-nav-btn.${SLIDE_BTN_SHOW_CLASS}:hover,
            .tmk-nav-btn.${SLIDE_BTN_SHOW_CLASS}:focus-visible {
                opacity: 1 !important;
                background: transparent !important;
                color: var(${tc('minorButton')}) !important;
                filter: brightness(1.1) !important;
                text-shadow: 0 0 2px rgba(255,255,255,0.82), 0 0 14px color-mix(in srgb, var(${tc('minorButton')}) 72%, transparent) !important;
            }
            .tmk-nav-btn.${SLIDE_BTN_SHOW_CLASS}:focus-visible {
                outline: none !important;
            }
            #${NAV_TO_MAIN_ID} { right: 6px !important; }
            #${NAV_TO_FRONT_ID} { left: 6px !important; }

        `;
    }

    // --- 4. 标题联动逻辑 ---
    function setSlideButtonState(btn, show, active) {
        if (!btn) return;
        const visible = !!show;
        const highlighted = visible && !!active;
        btn.classList.toggle(SLIDE_BTN_SHOW_CLASS, visible);
        btn.classList.toggle(SLIDE_BTN_ACTIVE_CLASS, highlighted);
        btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
        btn.setAttribute('aria-disabled', visible ? 'false' : 'true');
    }


    function getSlideButtonConfig() {
        if (!state.overlayOpen) return { showMain: false, showFront: false, active: '' };
        if (state.page === 'front') return { showMain: true, showFront: false, active: 'main' };
        if (state.page === 'main') return { showMain: false, showFront: true, active: 'front' };
        if (state.page === 'sub') return { showMain: false, showFront: true, active: 'front' };
        return { showMain: false, showFront: false, active: '' };
    }


    function updateSlideButtons(overlay) {
        if (!overlay) return;
        const toMain = overlay.querySelector('#' + NAV_TO_MAIN_ID);
        const toFront = overlay.querySelector('#' + NAV_TO_FRONT_ID);
        if (!toMain || !toFront) return;
        const cfg = getSlideButtonConfig();
        setSlideButtonState(toMain, cfg.showMain, cfg.active === 'main');
        setSlideButtonState(toFront, cfg.showFront, cfg.active === 'front');
    }

    function showFrontPage(overlay, menuBtn) {
        const vp = overlay.querySelector('#' + STARTMENU_ID);
        if (vp) vp.style.transform = 'translateX(0)';
        state.page = 'front';
        menuBtn.textContent = '✕';
        menuBtn.style.backgroundImage = '';
        menuBtn.style.backgroundSize = '';
        menuBtn.style.backgroundRepeat = '';
        menuBtn.style.backgroundPosition = '';
        updateSlideButtons(overlay);
    }


    function showMainPage(overlay, menuBtn) {
        const vp = overlay.querySelector('#' + STARTMENU_ID);
        if (vp) vp.style.transform = 'translateX(-100vw)';
        state.page = 'main';
        menuBtn.textContent = '✕';
        menuBtn.style.backgroundImage = '';
        menuBtn.style.backgroundSize = '';
        menuBtn.style.backgroundRepeat = '';
        menuBtn.style.backgroundPosition = '';
        updateSlideButtons(overlay);
    }


    function showSubPage(overlay, menuBtn, titleText) {
        const vp = overlay.querySelector('#' + STARTMENU_ID);
        if (vp) vp.style.transform = 'translateX(-200vw)';
        const subH2 = overlay.querySelector('#' + SUB_PAGE_ID + ' .tmk-sub-h2');
        if (subH2) subH2.textContent = titleText || '业务';
        state.page = 'sub';
        menuBtn.textContent = '✕';
        menuBtn.style.backgroundImage = '';
        menuBtn.style.backgroundSize = '';
        menuBtn.style.backgroundRepeat = '';
        menuBtn.style.backgroundPosition = '';
        updateSlideButtons(overlay);
    }

    function closeStartMenu(overlay, menuBtn) {
        if (overlay) overlay.style.display = 'none';
        state.overlayOpen = false;
        state.page = 'front';
        try {
            menuBtn.textContent = '☰';
            menuBtn.style.backgroundImage = '';
            menuBtn.style.backgroundSize = '';
            menuBtn.style.backgroundRepeat = '';
            menuBtn.style.backgroundPosition = '';
        } catch (e) {}
        setUiOverlayState(false);
        setSearchShortcutVisible(false);
        updateSlideButtons(overlay);
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


    // 第三级辅助工具：快速查找 / 信息处理区 
    function tileLv3OutlineClass(title) {
        const t = String(title || '').trim();
        if (/快速查找|信息处理/.test(t)) return 'tmk-tile--kv-tool';
        return '';
    }


    function parseMenuGroups() {
        const mf = window.top.frames.menu_frame;
        if (!mf || !mf.document) return [];
        const headers = Array.from(mf.document.querySelectorAll('.menuheaders'));
        const contents = Array.from(mf.document.querySelectorAll('.menucontents'));
        return headers.map((h, i) => ({
            title: h.textContent.trim(),
            links: Array.from(contents[i].querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(), href: extractHref(a)
            })).filter(l => l.href)
        })).filter(g => g.links.length > 0);
    }


    function levelClassFromVariant(variant) {
        const v = String(variant || '').trim();
        if (/^tmk-lv[1-5]$/.test(v)) return v;
        if (/^lv[1-5]$/.test(v)) return 'tmk-' + v;
        return 'tmk-lv4';
    }


    function spanBySize(size) {
        const s = String(size || 'medium').trim();
        if (s === 'small') return { w: 1, h: 1, cls: 'tmk-tile--small' };
        if (s === 'big') return { w: 4, h: 2, cls: 'tmk-tile--big' };
        return { w: 2, h: 2, cls: '' };
    }


    function normalizeFrontItem(item, index) {
        const it = item || {};
        const id = String(it.id || ('front-' + index));
        const kind = String(it.kind || 'link');
        const size = /^(small|medium|big)$/.test(String(it.size || '')) ? String(it.size) : 'big';
        const levelClass = levelClassFromVariant(it.colorVariant || it.levelClass || 'lv1');
        const x = Number.isFinite(Number(it.x)) ? Math.max(0, Math.floor(Number(it.x))) : index * 4;
        const y = Number.isFinite(Number(it.y)) ? Math.max(0, Math.floor(Number(it.y))) : 0;
        return {
            id: id,
            kind: kind === 'group' ? 'group' : 'link',
            title: String(it.title || ''),
            href: String(it.href || ''),
            groupTitle: String(it.groupTitle || ''),
            size: size,
            colorVariant: levelClass.replace(/^tmk-/, ''),
            levelClass: levelClass,
            x: x,
            y: y
        };
    }


    function defaultFrontItemsFromGroups(groups) {
        const lostG = groups.find(g => /少收/.test(g.title));
        const row = lostG ? lostG.links.slice(0, 3) : [];
        return row.map((l, idx) => ({
            id: 'front-' + idx + '-' + String(l.text).replace(/\s+/g, ''),
            kind: 'link',
            title: l.text,
            href: l.href,
            size: 'big',
            colorVariant: 'lv1',
            x: idx * 4,
            y: 0
        }));
    }


    function loadFrontItems(groups) {
        const stored = storageGet(STORE_FRONTPAGE_KEY, null);
        if (stored && Array.isArray(stored.items) && stored.items.length > 0) {
            return stored.items.map((it, idx) => normalizeFrontItem(it, idx));
        }
        const defaults = defaultFrontItemsFromGroups(groups);
        storageSet(STORE_FRONTPAGE_KEY, { items: defaults, updatedAt: Date.now() });
        return defaults.map((it, idx) => normalizeFrontItem(it, idx));
    }


    function saveFrontItems(items) {
        const safe = Array.isArray(items) ? items.map((it, idx) => normalizeFrontItem(it, idx)) : [];
        storageSet(STORE_FRONTPAGE_KEY, { items: safe, updatedAt: Date.now() });
    }


    function persistMenuMirror(groups) {
        const mainItems = [];
        const subItems = {};
        groups.forEach((g, gi) => {
            mainItems.push({
                id: 'main-' + gi,
                title: g.title,
                size: 'medium',
                colorVariant: 'minorButton',
                order: gi
            });
            subItems[g.title] = g.links.map((l, li) => ({
                id: 'sub-' + gi + '-' + li,
                title: l.text,
                href: l.href,
                size: 'medium',
                colorVariant: 'minorButton',
                order: li
            }));
        });
        storageSet(STORE_MAINMENU_KEY, { items: mainItems, updatedAt: Date.now() });
        storageSet(STORE_SUBMENU_KEY, { groups: subItems, updatedAt: Date.now() });
    }


    function ensureContextMenu(doc) {
        let menu = doc.getElementById(CONTEXT_MENU_ID);
        if (menu) return menu;
        menu = doc.createElement('div');
        menu.id = CONTEXT_MENU_ID;
        menu.style.cssText = 'position:fixed;display:none;z-index:2147483647;background:#fff;border:1px solid rgba(0,0,0,.25);border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.25);min-width:180px;padding:4px;';
        doc.body.appendChild(menu);
        doc.addEventListener('click', () => {
            menu.style.display = 'none';
        });
        state.contextMenuEl = menu;
        return menu;
    }


    function openContextMenu(doc, x, y, entries) {
        const menu = ensureContextMenu(doc);
        menu.innerHTML = '';
        entries.forEach((entry) => {
            const btn = doc.createElement('button');
            btn.type = 'button';
            btn.textContent = entry.label;
            btn.style.cssText = 'display:block;width:100%;text-align:left;padding:7px 10px;border:none;background:transparent;cursor:pointer;';
            btn.onmouseenter = () => { btn.style.background = 'rgba(0,0,0,.08)'; };
            btn.onmouseleave = () => { btn.style.background = 'transparent'; };
            btn.onclick = (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                menu.style.display = 'none';
                if (typeof entry.action === 'function') entry.action();
            };
            menu.appendChild(btn);
        });
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
    }


    function addLinkToFrontpage(link) {
        const item = link || {};
        const items = loadFrontItems(state.groups);
        const next = normalizeFrontItem({
            id: 'front-' + Date.now(),
            kind: item.kind || 'link',
            title: String(item.text || item.title || ''),
            href: String(item.href || ''),
            groupTitle: String(item.groupTitle || ''),
            size: 'medium',
            colorVariant: 'lv1',
            x: 0,
            y: 0
        }, items.length);
        // 使用网格占用扫描，避免启发式跳点造成位置漂移和效率不稳定
        const slot = findFirstFrontSlot(items, next.size, -1);
        if (!slot) {
            alert('首页网格已满，无法添加新磁贴。');
            return false;
        }
        next.x = slot.x;
        next.y = slot.y;
        items.push(next);
        saveFrontItems(items);
        return true;
    }


    function getFrontGridMetrics() {
        const m = calcUiMetrics();
        // 首页拖拽/占格统一采用正方网格：单元边长取 smallTileH
        const small = Number(m.smallTileH) || 32;
        const gap = Number(m.gap) || 8;
        const pitch = small + gap;
        return { small, gap, pitch };
    }


    function frontRectFromItem(item) {
        const span = spanBySize(item.size);
        return { x: item.x, y: item.y, w: span.w, h: span.h };
    }


    function isRectOverlap(a, b) {
        return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    }


    function hasFrontCollision(items, targetRect, ignoreIndex) {
        for (let i = 0; i < items.length; i += 1) {
            if (i === ignoreIndex) continue;
            if (isRectOverlap(frontRectFromItem(items[i]), targetRect)) return true;
        }
        return false;
    }


    function getFrontGridColumnCapacity() {
        const { gap, pitch } = getFrontGridMetrics();
        const el = document.getElementById(FRONT_GRID_ID);
        const width = el && el.clientWidth ? el.clientWidth : Math.max(window.innerWidth - 120, 320);
        const cols = Math.max(6, Math.floor((width + gap) / pitch));
        return cols;
    }


    function findFirstFrontSlot(items, size, ignoreIndex) {
        const span = spanBySize(size);
        const cols = getFrontGridColumnCapacity();
        const maxRows = 200;
        for (let y = 0; y < maxRows; y += 1) {
            const maxX = Math.max(0, cols - span.w);
            for (let x = 0; x <= maxX; x += 1) {
                const target = { x, y, w: span.w, h: span.h };
                if (!hasFrontCollision(items, target, ignoreIndex)) {
                    return { x, y };
                }
            }
        }
        return null;
    }


    function findFrontItemIndexById(items, itemId) {
        const id = String(itemId || '');
        return items.findIndex((it) => String(it.id) === id);
    }


    function ensureDropPreview(frontGrid) {
        let preview = frontGrid.querySelector('.tmk-drop-preview');
        if (preview) return preview;
        preview = frontGrid.ownerDocument.createElement('div');
        preview.className = 'tmk-drop-preview';
        preview.style.display = 'none';
        frontGrid.appendChild(preview);
        return preview;
    }


    function mountFrontDrag(tile, frontGrid, itemId, doc, overlay, menuBtn) {
        let startX = 0;
        let startY = 0;
        let dragActivated = false;
        let dropValid = false;
        let nextPos = null;
        const preview = ensureDropPreview(frontGrid);
        let dragItems = [];
        let dragIndex = -1;
        let span = spanBySize('medium');
        const { small, gap, pitch } = getFrontGridMetrics();

        const applyPreview = (x, y, valid) => {
            const width = span.w * small + (span.w - 1) * gap;
            const height = span.h * small + (span.h - 1) * gap;
            preview.style.display = 'block';
            preview.style.left = (x * pitch) + 'px';
            preview.style.top = (y * pitch) + 'px';
            preview.style.width = width + 'px';
            preview.style.height = height + 'px';
            preview.classList.toggle('tmk-invalid', !valid);
        };

        const onMove = (evt) => {
            const dx = evt.clientX - startX;
            const dy = evt.clientY - startY;
            if (!dragActivated) {
                const dist = Math.hypot(dx, dy);
                if (dist < pitch) return;
                dragActivated = true;
                frontGrid.classList.add('tmk-front-grid-dragging');
            }
            const rect = frontGrid.getBoundingClientRect();
            const gx = Math.max(0, Math.floor((evt.clientX - rect.left) / pitch));
            const gy = Math.max(0, Math.floor((evt.clientY - rect.top) / pitch));
            nextPos = { x: gx, y: gy };
            const targetRect = { x: gx, y: gy, w: span.w, h: span.h };
            dropValid = !hasFrontCollision(dragItems, targetRect, dragIndex);
            applyPreview(gx, gy, dropValid);
            evt.preventDefault();
        };

        const onUp = () => {
            doc.removeEventListener('pointermove', onMove);
            doc.removeEventListener('pointerup', onUp);
            frontGrid.classList.remove('tmk-front-grid-dragging');
            preview.style.display = 'none';
            if (!dragActivated) return;
            state.suppressFrontClick = true;
            if (dropValid && nextPos) {
                dragItems[dragIndex].x = nextPos.x;
                dragItems[dragIndex].y = nextPos.y;
                saveFrontItems(dragItems);
            }
            renderFrontPage(doc, overlay, menuBtn);
        };

        tile.addEventListener('pointerdown', (evt) => {
            if (evt.button !== 0) return;
            startX = evt.clientX;
            startY = evt.clientY;
            dragActivated = false;
            dropValid = false;
            nextPos = null;
            dragItems = loadFrontItems(state.groups);
            dragIndex = findFrontItemIndexById(dragItems, itemId);
            if (dragIndex < 0) return;
            span = spanBySize(dragItems[dragIndex].size);
            doc.addEventListener('pointermove', onMove);
            doc.addEventListener('pointerup', onUp);
        });
    }


    function openFrontTileContextMenu(doc, itemId, x, y, overlay, menuBtn) {
        const refreshed = loadFrontItems(state.groups);
        const idx = findFrontItemIndexById(refreshed, itemId);
        if (idx < 0) return;
        const current = refreshed[idx];
        const colorEntries = [
            { label: '配色：lv1', value: 'lv1' },
            { label: '配色：lv2', value: 'lv2' },
            { label: '配色：lv3', value: 'lv3' },
            { label: '配色：lv4', value: 'lv4' }
        ];
        openContextMenu(doc, x, y, [
            { label: '尺寸：小', action: () => { current.size = 'small'; saveFrontItems(refreshed); renderFrontPage(doc, overlay, menuBtn); } },
            { label: '尺寸：中', action: () => { current.size = 'medium'; saveFrontItems(refreshed); renderFrontPage(doc, overlay, menuBtn); } },
            { label: '尺寸：大', action: () => { current.size = 'big'; saveFrontItems(refreshed); renderFrontPage(doc, overlay, menuBtn); } },
            ...colorEntries.map((ce) => ({ label: ce.label, action: () => { current.colorVariant = ce.value; current.levelClass = levelClassFromVariant(ce.value); saveFrontItems(refreshed); renderFrontPage(doc, overlay, menuBtn); } })),
            { label: '从首页移除', action: () => { refreshed.splice(idx, 1); saveFrontItems(refreshed); renderFrontPage(doc, overlay, menuBtn); } }
        ]);
    }


    function handleFrontTileClick(itemId, doc, overlay, menuBtn) {
        if (state.suppressFrontClick) {
            state.suppressFrontClick = false;
            return;
        }
        const items = loadFrontItems(state.groups);
        const idx = findFrontItemIndexById(items, itemId);
        if (idx < 0) return;
        const it = items[idx];
        if (it.kind === 'group') {
            const group = state.groups.find((g) => g.title === it.groupTitle || g.title === it.title);
            if (group) {
                const subGrid = doc.getElementById(SUB_GRID_ID);
                subGrid.innerHTML = '';
                group.links.forEach(l => {
                    subGrid.appendChild(buildTile(doc, l.text, 'tmk-lv4', () => {
                        navigateLink(overlay, menuBtn, l.text, l.href);
                    }, '', 'tmk-mainmenu-tile', {
                        onContextMenu: (evt) => {
                            evt.preventDefault();
                            openContextMenu(doc, evt.clientX, evt.clientY, [
                                {
                                    label: '添加到首页',
                                    action: () => {
                                        addLinkToFrontpage(l);
                                        renderFrontPage(doc, overlay, menuBtn);
                                    }
                                }
                            ]);
                        }
                    }));
                });
                showSubPage(overlay, menuBtn, group.title);
                return;
            }
        }
        navigateLink(overlay, menuBtn, it.title, it.href);
    }


    function ensureFrontTileNode(doc, frontGrid, itemId, overlay, menuBtn) {
        let tile = state.frontTileMap[itemId];
        if (tile && tile.isConnected) return tile;
        tile = buildTile(doc, '', 'tmk-lv4', () => {
            handleFrontTileClick(itemId, doc, overlay, menuBtn);
        }, '', '', {
            onContextMenu: (evt) => {
                evt.preventDefault();
                openFrontTileContextMenu(doc, itemId, evt.clientX, evt.clientY, overlay, menuBtn);
            }
        });
        tile.dataset.frontId = itemId;
        mountFrontDrag(tile, frontGrid, itemId, doc, overlay, menuBtn);
        state.frontTileMap[itemId] = tile;
        return tile;
    }


    function updateFrontTileNode(tile, it) {
        const titleNode = tile.querySelector('.tmk-title');
        if (titleNode) titleNode.textContent = it.title;
        tile.classList.remove('tmk-lv1', 'tmk-lv2', 'tmk-lv3', 'tmk-lv4', 'tmk-lv5', 'tmk-tile--small', 'tmk-tile--big');
        tile.classList.add(it.levelClass);
        const span = spanBySize(it.size);
        if (span.cls) tile.classList.add(span.cls);
        tile.style.gridColumn = String(it.x + 1) + ' / span ' + String(span.w);
        tile.style.gridRow = String(it.y + 1) + ' / span ' + String(span.h);
    }


    function renderFrontPage(doc, overlay, menuBtn) {
        const frontGrid = doc.getElementById(FRONT_GRID_ID);
        if (!frontGrid) return;
        const items = loadFrontItems(state.groups);
        const itemById = {};
        items.forEach((it) => { itemById[String(it.id)] = it; });

        Object.keys(state.frontTileMap).forEach((id) => {
            if (itemById[id]) return;
            const node = state.frontTileMap[id];
            if (node && node.parentNode) node.parentNode.removeChild(node);
            delete state.frontTileMap[id];
        });

        const fragment = doc.createDocumentFragment();
        items.forEach((it) => {
            const tile = ensureFrontTileNode(doc, frontGrid, String(it.id), overlay, menuBtn);
            updateFrontTileNode(tile, it);
            fragment.appendChild(tile);
        });
        frontGrid.replaceChildren(fragment);
    }


    // --- 6. 菜单渲染与绑定 ---
    function renderTiles(doc, overlay, menuBtn) {
        const rootGrid = doc.getElementById(ROOT_GRID_ID);
        if (!rootGrid) return;
        const groups = parseMenuGroups();
        const signature = groups.map((g) => g.title + '|' + g.links.map((l) => l.text + ':' + l.href).join(',')).join('||');
        const menuChanged = state.mainMenuSignature !== signature || rootGrid.children.length === 0;
        state.groups = groups;
        if (menuChanged) {
            persistMenuMirror(groups);
            const fragment = doc.createDocumentFragment();
            groups.forEach(g => {
                fragment.appendChild(buildSubGroupTile(doc, overlay, menuBtn, g, '', {
                    levelClass: 'tmk-lv4',
                    extraClass: 'tmk-mainmenu-tile',
                    linkLevelClass: 'tmk-lv4',
                    linkExtraClass: 'tmk-mainmenu-tile',
                    onContextMenu: (evt) => {
                        evt.preventDefault();
                        openContextMenu(doc, evt.clientX, evt.clientY, [
                            {
                                label: '添加到首页',
                                action: () => {
                                    addLinkToFrontpage({ kind: 'group', text: g.title, groupTitle: g.title });
                                    renderFrontPage(doc, overlay, menuBtn);
                                }
                            }
                        ]);
                    }
                }));
            });
            fragment.appendChild(buildTile(doc, '退出系统', 'tmk-lv4', () => {
                window.top.location.href = getLogoutUrl();
            }, '', 'tmk-mainmenu-tile', {
                onContextMenu: (evt) => {
                    evt.preventDefault();
                    openContextMenu(doc, evt.clientX, evt.clientY, [
                        {
                            label: '添加到首页',
                            action: () => {
                                addLinkToFrontpage({ text: '退出系统', href: getLogoutUrl(), kind: 'link' });
                                renderFrontPage(doc, overlay, menuBtn);
                            }
                        }
                    ]);
                }
            }));
            rootGrid.replaceChildren(fragment);
            state.mainMenuSignature = signature;
        }
        renderFrontPage(doc, overlay, menuBtn);
        assertStartmenuInvariants(doc);
    }


    function assertStartmenuInvariants(doc) {
        if (!doc) return;
        // 断言：旧版容器命名不允许回流；若出现说明逻辑回退，直接移除并报错
        const legacyIds = ['tmk-panel-viewport', 'tmk-root-page', 'tmk-root-grid', 'tmk-pinned-grid', 'tmk-system-grid'];
        let hasLegacy = false;
        legacyIds.forEach((id) => {
            const legacyEl = doc.getElementById(id);
            if (!legacyEl) return;
            hasLegacy = true;
            try {
                if (legacyEl.parentNode) legacyEl.parentNode.removeChild(legacyEl);
            } catch (e) {}
        });
        console.assert(!hasLegacy, '[startmenu] 检测到旧版容器命名，已触发防回退移除');
        if (hasLegacy) {
            throw new Error('[startmenu] 触发防回退断言：旧版容器命名不允许出现');
        }
        // 断言：第二页/第三页只允许 medium 规格，不允许 small/big 样式类混入
        const checkIllegalSize = (gridId, gridName) => {
            const grid = doc.getElementById(gridId);
            if (!grid) return;
            const illegal = grid.querySelectorAll('.tmk-tile--small, .tmk-tile--big');
            const ok = illegal.length === 0;
            console.assert(ok, '[startmenu] ' + gridName + ' 出现非法尺寸类，数量=' + String(illegal.length));
            if (!ok) {
                throw new Error('[startmenu] 触发防回退断言：' + gridName + ' 不允许 small/big tile');
            }
        };
        checkIllegalSize(ROOT_GRID_ID, 'mainMenu');
        checkIllegalSize(SUB_GRID_ID, 'subMenu');
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


    function buildSubGroupTile(doc, overlay, menuBtn, group, sizeCls, opts) {
        const options = opts || {};
        const groupLevelClass = options.levelClass || tileLevelClass(group.title, group.title);
        const groupExtraClass = [tileLv3OutlineClass(group.title), options.extraClass || ''].filter(Boolean).join(' ');
        return buildTile(doc, group.title, groupLevelClass, () => {
            const subGrid = doc.getElementById(SUB_GRID_ID);
            subGrid.innerHTML = '';
            group.links.forEach(l => {
                const linkLevelClass = options.linkLevelClass || tileLevelClass(l.text, group.title);
                const linkExtraClass = [tileLv3OutlineClass(l.text), options.linkExtraClass || ''].filter(Boolean).join(' ');
                subGrid.appendChild(buildTile(doc, l.text, linkLevelClass, () => {
                    navigateLink(overlay, menuBtn, l.text, l.href);
                }, '', linkExtraClass, {
                    onContextMenu: (evt) => {
                        evt.preventDefault();
                        openContextMenu(doc, evt.clientX, evt.clientY, [
                            {
                                label: '添加到首页',
                                action: () => {
                                    addLinkToFrontpage(l);
                                    renderFrontPage(doc, overlay, menuBtn);
                                }
                            }
                        ]);
                    }
                }));
            });
            showSubPage(overlay, menuBtn, group.title);
        }, sizeCls || '', groupExtraClass, options);
    }


    function buildTile(doc, title, cls, onClick, sizeCls, extraCls, opts) {
        const options = opts || {};
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
        if (typeof options.onContextMenu === 'function') {
            inst.nativeElement.addEventListener('contextmenu', options.onContextMenu);
        }
        return inst.nativeElement;
    }

    function closeStartMenu(overlay, menuBtn) {
        overlay.style.display = 'none'; state.overlayOpen = false;
        state.page = 'front';
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
                    <div id="${HEADER_BAR_ID}" class="tmk-root-title-row">
                        <button type="button" id="${START_BTN_ID}" class="tmk-h1 tmk-start-btn">开始</button>
                        <input type="text" id="${ACCEPT_STATION_INPUT_ID}" class="tmk-station-inline"
                            autocomplete="off" spellcheck="false" aria-label="受理航站公司" />
                    </div>
                    <button type="button" id="${NAV_TO_FRONT_ID}" class="tmk-nav-btn" aria-label="返回首页">‹</button>
                    <button type="button" id="${NAV_TO_MAIN_ID}" class="tmk-nav-btn" aria-label="进入全部菜单">›</button>
                    <div id="${STARTMENU_ID}">
                        <section class="tmk-page" id="${FRONT_PAGE_ID}">
                            <div id="${FRONT_GRID_ID}"></div>
                        </section>
                        <section class="tmk-page" id="${MAIN_PAGE_ID}">
                            <div class="tmk-grid" id="${ROOT_GRID_ID}"></div>
                        </section>
                        <section class="tmk-page" id="${SUB_PAGE_ID}">
                            <h2 class="tmk-sub-h2">业务</h2>
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
                        cycleTheme(document).then(() => {
                            if (state.overlayOpen) renderTiles(document, overlay, menuBtn);
                        }).catch(() => {});
                    });
                }
                const toMainBtn = document.getElementById(NAV_TO_MAIN_ID);
                if (toMainBtn) {
                    toMainBtn.addEventListener('click', (evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        showMainPage(overlay, menuBtn);
                    });
                }
                const toFrontBtn = document.getElementById(NAV_TO_FRONT_ID);
                if (toFrontBtn) {
                    toFrontBtn.addEventListener('click', (evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        if (state.page === 'sub') {
                            showMainPage(overlay, menuBtn);
                        } else {
                            showFrontPage(overlay, menuBtn);
                        }
                    });
                }

                // 检查是否需要继续执行之前因跨页跳转而缓存的搜索动作
                continuePendingSearchIfNeeded();

                menuBtn.onclick = () => {
                    if (!state.overlayOpen) {
                        overlay.style.display = 'block'; renderTiles(document, overlay, menuBtn);
                        state.overlayOpen = true; showFrontPage(overlay, menuBtn);
                        setUiOverlayState(true);
                        setSearchShortcutVisible(true);
                        updateSlideButtons(overlay);
                    } else {
                        closeStartMenu(overlay, menuBtn);
                    }
                };
                clearInterval(timer);
            }
        }, 500);
    }
})();
