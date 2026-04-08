// ==UserScript==
// @name         BCheckWeb UI 瓷砖菜单 - 0.7.9
// @namespace    http://tampermonkey.net/
// @version      0.7.9
// @description  修复按钮位置 | 标题动态联动 | 黄金比例间距 | 链接逻辑修复 | 主题 JSON 线上切换
// @author       Gostnort
// @match        http://60.247.100.98/BCheckWeb/*
// @match        https://60.247.100.98/BCheckWeb/*
// @match        http://202.96.17.98/BCheckWeb/*
// @match        https://202.96.17.98/BCheckWeb/*
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

    const state = { overlayOpen: false, showingSub: false, currentGroup: null, searchExpanded: false };

    // 仅内置 id=1 国航层级；默认色值只定义于此处，expandThemeColors 内不再写死 hex
    const DEFAULT_THEME_PACK = {
        version: 2,
        themes: [
            {
                id: 1,
                name: '国航层级',
                colors: {
                    overlayBackdrop: 'rgba(200, 200, 200, 0.3)',
                    majorFocus: '#BD0000',
                    minorFocus: '#2C3E50',
                    minorFont: '#FFFFFF',
                    majorFont: '#34495E',
                    majorButton: '#f4f6f8',
                    inputBackground: '#f8f9fa',
                    minorButton: '#EDF1F5',
                    stationPlaceholder: 'rgba(255, 255, 255, 0.45)'
                }
            }
        ]
    };


    function themeColorVarFromKey(key) {
        return '--tmk-c-' + String(key).replace(/([A-Z])/g, '-$1').toLowerCase();
    }


    function pickColor(c, keys, fallback) {
        for (let i = 0; i < keys.length; i += 1) {
            const k = keys[i];
            if (c[k] !== undefined && c[k] !== null && String(c[k]) !== '') return c[k];
        }
        return fallback;
    }


    // 主题语义色 → CSS 扁平变量（供 applyThemeCss）
    function expandThemeColors(raw) {
        const base = DEFAULT_THEME_PACK.themes[0].colors;
        const c = Object.assign({}, base, raw || {});
        const majorFocus = pickColor(c, ['majorFocus']);
        const minorFocus = pickColor(c, ['minorFocus']);
        const minorFont = pickColor(c, ['minorFont']);
        const majorFont = pickColor(c, ['majorFont']);
        const majorButton = pickColor(c, ['majorButton']);
        const inputBg = pickColor(c, ['inputBackground']);
        const minorButton = pickColor(c, ['minorButton']);
        const out = {
            overlayBackdrop: pickColor(c, ['overlayBackdrop']),
            lv1Bg: pickColor(c, ['lv1Bg'], majorFocus),
            kvToolFg: pickColor(c, ['kvToolFg'], majorFocus),
            lv2Bg: pickColor(c, ['lv2Bg'], minorFocus),
            fabHoverBorder: pickColor(c, ['fabHoverBorder'], minorFocus),
            searchInputBorder: pickColor(c, ['searchInputBorder'], minorFocus),
            kvToolBorder: pickColor(c, ['kvToolBorder'], minorFocus),
            tileHoverBorder: pickColor(c, ['tileHoverBorder'], minorFocus),
            h1: pickColor(c, ['h1'], minorFont),
            stationInput: pickColor(c, ['stationInput'], minorFont),
            lv1Fg: pickColor(c, ['lv1Fg'], minorFont),
            lv2Fg: pickColor(c, ['lv2Fg'], minorFont),
            lv4Fg: pickColor(c, ['lv4Fg'], majorFont),
            lv3Fg: pickColor(c, ['lv3Fg'], majorFont),
            fabFg: pickColor(c, ['fabFg'], majorFont),
            searchInputFg: pickColor(c, ['searchInputFg'], majorFont),
            lv5Fg: pickColor(c, ['lv5Fg'], majorFont),
            searchPlaceholder: pickColor(c, ['searchPlaceholder'], majorFont),
            fabBg: pickColor(c, ['fabBg'], majorButton),
            searchBg: pickColor(c, ['searchBg'], majorButton),
            lv5Bg: pickColor(c, ['lv5Bg'], majorButton),
            searchActiveBg: pickColor(c, ['searchActiveBg'], majorButton),
            lv4Bg: pickColor(c, ['lv4Bg'], minorButton),
            searchInputBg: pickColor(c, ['searchInputBg'], inputBg),
            fabBorder: pickColor(c, ['fabBorder'], minorFocus),
            searchBorder: pickColor(c, ['searchBorder'], minorFocus),
            searchActiveBorder: minorFocus,
            stationPlaceholder: pickColor(c, ['stationPlaceholder']),
            lv3Bg: pickColor(c, ['lv3Bg'], majorButton),
            searchLoadingBg: pickColor(c, ['searchLoadingBg'], majorButton),
            searchLoadingFg: pickColor(c, ['searchLoadingFg'], majorFont)
        };
        return out;
    }


    function readThemeIndex() {
        try {
            const v = parseInt(localStorage.getItem(THEME_STORAGE_KEY), 10);
            return Number.isFinite(v) ? v : 0;
        } catch (e) {
            return 0;
        }
    }


    function saveThemeIndex(i) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, String(i));
        } catch (e) {}
    }


    function getCurrentThemeId() {
        try {
            const t = window.__tmkTheme;
            if (t && t.id !== undefined && t.id !== null) return t.id;
        } catch (e) {}
        return 1;
    }


    function sortThemesById(arr) {
        return arr.slice().sort((a, b) => Number(a.id) - Number(b.id));
    }


    async function fetchThemesPackOnline() {
        try {
            const r = await fetch(THEME_JSON_URL, { cache: 'no-store' });
            if (!r.ok) return null;
            const data = await r.json();
            if (!data || !Array.isArray(data.themes) || !data.themes.length) return null;
            return data;
        } catch (e) {
            return null;
        }
    }


    function applyThemeCss(doc, theme) {
        if (!doc || !doc.head || !theme || !theme.colors) return;
        let el = doc.getElementById('tmk-theme-vars');
        if (!el) {
            el = doc.createElement('style');
            el.id = 'tmk-theme-vars';
            doc.head.insertBefore(el, doc.head.firstChild);
        }
        const lines = [];
        Object.keys(theme.colors).forEach((k) => {
            const v = theme.colors[k];
            if (v === undefined || v === null || String(v) === '') return;
            lines.push('  ' + themeColorVarFromKey(k) + ': ' + v + ';');
        });
        el.textContent = ':root {\n' + lines.join('\n') + '\n}';
        try {
            window.__tmkTheme = { id: theme.id, name: theme.name, colors: theme.colors };
            if (window.top) window.top.__tmkTheme = window.__tmkTheme;
        } catch (e) {}
    }


    async function bootstrapTheme(doc) {
        const online = await fetchThemesPackOnline();
        const themes = online && online.themes && online.themes.length
            ? sortThemesById(online.themes)
            : sortThemesById(DEFAULT_THEME_PACK.themes);
        const n = themes.length;
        let idx = readThemeIndex() % n;
        if (idx < 0) idx += n;
        const th = themes[idx];
        applyThemeCss(doc, { id: th.id, name: th.name, colors: expandThemeColors(th.colors) });
        try {
            publishUiMetrics(calcUiMetrics());
        } catch (e) {}
    }


    async function cycleTheme(doc) {
        const online = await fetchThemesPackOnline();
        const themes = online && online.themes && online.themes.length
            ? sortThemesById(online.themes)
            : sortThemesById(DEFAULT_THEME_PACK.themes);
        const n = themes.length;
        if (!n) return;
        let idx = readThemeIndex() + 1;
        if (idx >= n) idx = 0;
        saveThemeIndex(idx);
        const th = themes[idx];
        applyThemeCss(doc, { id: th.id, name: th.name, colors: expandThemeColors(th.colors) });
        try {
            publishUiMetrics(calcUiMetrics());
        } catch (e) {}
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


    function markModernLostQueryLaunch(linkText) {
        const text = String(linkText || '').replace(/\s+/g, '');
        if (!/新建少收查询/.test(text)) return;
        try {
            window.sessionStorage.setItem(MODERN_LOST_QUERY_KEY, String(Date.now()));
        } catch (e) {}
    }

    // --- 2. 启动时默认折叠布局（保留 control_frame 可手动展开 menu_frame） ---
    function applyDefaultFrameLayout() {
        try {
            const topDoc = window.top && window.top.document ? window.top.document : document;
            const mainFs = topDoc.getElementById('main_frameset');
            const contentFs = topDoc.getElementById('content_frameset');
            if (mainFs) mainFs.rows = '0,*,0';
            if (contentFs) {
                contentFs.cols = '0,8,*';
                contentFs.setAttribute('cols', '0,8,*');
            }
        } catch (e) {}
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
            themeId = getCurrentThemeId();
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
        const def = DEFAULT_THEME_PACK.themes[0];
        applyThemeCss(doc, { id: def.id, name: def.name, colors: expandThemeColors(def.colors) });
        const m = calcUiMetrics();
        publishUiMetrics(m);
        publishAcceptStationCompany(readStoredAcceptStationCompany());
        setTimeout(() => {
            bootstrapTheme(doc).catch(() => {});
        }, 0);
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
            }
            #${OVERLAY_ID} {
                position: fixed!important; inset: 0!important; z-index: 2147483646!important;
                display: none; background: var(${themeColorVarFromKey('overlayBackdrop')})!important; backdrop-filter: blur(10px);
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
                background: var(${themeColorVarFromKey('fabBg')}) !important; color: var(${themeColorVarFromKey('fabFg')}) !important;
                border: 1px solid var(${themeColorVarFromKey('fabBorder')}) !important; border-radius: 999px !important;
                font-family: "Segoe UI Light", sans-serif !important; font-size: 30px !important;
                font-weight: 100 !important; cursor: pointer !important;
                transition: border-color 0.2s ease !important;
            }
            #${FAB_ID}:hover { background: var(${themeColorVarFromKey('fabBg')}) !important; border-color: var(${themeColorVarFromKey('fabHoverBorder')}) !important; }
            #${SEARCH_FAB_ID} {
                position: fixed !important; right: 20px !important; top: 20px !important;
                z-index: 2147483647 !important; width: 46px !important; height: 46px !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: var(${themeColorVarFromKey('fabFg')}) !important; font-size: 23px !important; line-height: 1 !important;
                background: var(${themeColorVarFromKey('searchBg')}) !important;
                border: 1px solid transparent !important; border-radius: 999px !important;
                box-shadow: none !important; cursor: pointer !important; transition: border-color 0.2s ease !important;
            }
            #${SEARCH_FAB_ID}:hover,
            #${SEARCH_FAB_ID}.tmk-search-active {
                background: var(${themeColorVarFromKey('searchBg')}) !important;
                border-color: var(${themeColorVarFromKey('searchActiveBorder')}) !important;
            }
            #${SEARCH_INPUT_ID} {
                position: fixed !important; right: 72px !important; top: 26px !important;
                z-index: 2147483647 !important; width: 340px !important; height: 34px !important;
                box-sizing: border-box !important; border-radius: 6px !important;
                border: 1px solid var(${themeColorVarFromKey('searchInputBorder')}) !important;
                padding: 0 10px !important; background: var(${themeColorVarFromKey('searchInputBg')}) !important;
                color: var(${themeColorVarFromKey('searchInputFg')}) !important; outline: none !important;
            }
            #${SEARCH_INPUT_ID}.tmk-search-loading {
                background: var(${themeColorVarFromKey('searchLoadingBg')}) !important;
                color: var(${themeColorVarFromKey('searchLoadingFg')}) !important;
            }
            #${SEARCH_INPUT_ID}::placeholder {
                color: var(${themeColorVarFromKey('searchPlaceholder')}) !important;
            }
            .tmk-h1 {
                font-size: ${m.h1Size}px !important; font-weight: 100 !important; color: var(${themeColorVarFromKey('h1')}) !important;
                margin: 0 0 10px 0 !important; letter-spacing: -1px !important;
            }
            .tmk-root-title-row {
                display: flex !important; align-items: center !important; flex-wrap: wrap !important;
                gap: 0.35em 0.55em !important; margin: 0 0 10px 0 !important;
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
            }
            #${ACCEPT_STATION_INPUT_ID} {
                flex: 0 1 auto !important; min-width: 3.5em !important; max-width: 18em !important;
                font-family: inherit !important; font-weight: 100 !important;
                color: var(${themeColorVarFromKey('stationInput')}) !important; letter-spacing: -1px !important;
                margin: 0 !important; padding: 0 8px !important; border: none !important; background: transparent !important;
                outline: none !important; box-shadow: none !important; -webkit-appearance: none !important;
                appearance: none !important;
            }
            #${ACCEPT_STATION_INPUT_ID}::placeholder { color: var(${themeColorVarFromKey('stationPlaceholder')}) !important; }
            .tmk-active-tag { display: none !important; }
            .tmk-grid { display: grid !important; gap: var(--tmk-gap) !important; grid-template-columns: repeat(auto-fill, var(--tmk-medium)) !important; }

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

            .tmk-tile {
                box-sizing: border-box !important;
                width: var(--tmk-medium) !important; height: var(--tmk-medium) !important;
                border: 0 !important; padding: 15px !important; text-align: left !important;
                cursor: pointer !important; transition: transform 0.15s ease, box-shadow 0.15s ease !important;
            }
            .tmk-tile--big {
                width: var(--tmk-big-tile) !important; height: var(--tmk-medium) !important;
            }
            .tmk-tile--small {
                width: var(--tmk-medium) !important; height: var(--tmk-small-tile-h) !important;
                padding: 6px 12px !important;
            }
            .tmk-tile--small .tmk-title { font-size: 12px !important; line-height: 1.15 !important; }
            .tmk-tile:hover {
                transform: scale(1.03);
                filter: none !important;
                box-shadow: inset 0 0 0 2px var(${themeColorVarFromKey('tileHoverBorder')}) !important;
            }
            .tmk-title { font-size: 18px !important; line-height: 1.2 !important; }
            .tmk-lv1 { background: var(${themeColorVarFromKey('lv1Bg')}) !important; color: var(${themeColorVarFromKey('lv1Fg')}) !important; }
            .tmk-lv2 { background: var(${themeColorVarFromKey('lv2Bg')}) !important; color: var(${themeColorVarFromKey('lv2Fg')}) !important; }
            .tmk-lv3 { background: var(${themeColorVarFromKey('lv3Bg')}) !important; color: var(${themeColorVarFromKey('lv3Fg')}) !important; }
            .tmk-tile--kv-tool.tmk-lv3 { border: 2px solid var(${themeColorVarFromKey('kvToolBorder')}) !important; }
            .tmk-tile--kv-tool.tmk-lv3 .tmk-title { color: var(${themeColorVarFromKey('kvToolFg')}) !important; }
            .tmk-lv4 { background: var(${themeColorVarFromKey('lv4Bg')}) !important; color: var(${themeColorVarFromKey('lv4Fg')}) !important; }
            .tmk-lv5 { background: var(${themeColorVarFromKey('lv5Bg')}) !important; color: var(${themeColorVarFromKey('lv5Fg')}) !important; }
            .tmk-tile div:not(.tmk-title) { display: none !important; }
        `;
    }

    // --- 4. 标题联动逻辑 ---
    function showRootPage(overlay, fab) {
        overlay.querySelector('#tmk-root-page').style.display = 'block';
        overlay.querySelector('#tmk-sub-page').style.display = 'none';
        // 首页标题重置为“开始”（隐藏按钮，用于切换主题）
        const h1 = overlay.querySelector('#tmk-root-page .tmk-start-btn') || overlay.querySelector('#tmk-root-page .tmk-h1');
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


    // 第三级辅助工具：快速查找 / 信息处理区 — 红字(#BD0000) + 深碳蓝黑边(#2C3E50)
    function tileLv3OutlineClass(title) {
        const t = String(title || '').trim();
        if (/快速查找|信息处理/.test(t)) return 'tmk-tile--kv-tool';
        return '';
    }


    // --- 6. 菜单渲染与绑定 ---
    function renderTiles(doc, overlay, fab) {
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
                    markModernLostQueryLaunch(l.text);
                    navigateToContent(l.href); closeOverlay(overlay, fab);
                }, tileSizePinnedClass(l.text), tileLv3OutlineClass(l.text)));
            });
        }

        // 主菜单（不含少收整组、不含系统维护整组）
        groups.forEach(g => {
            if (lostG && g.title === lostG.title) return;
            if (sysG && g.title === sysG.title) return;
            rootGrid.appendChild(buildTile(doc, g.title, tileLevelClass(g.title, g.title), () => {
                const subGrid = doc.getElementById(SUB_GRID_ID);
                subGrid.innerHTML = '';
                g.links.forEach(l => {
                    subGrid.appendChild(buildTile(doc, l.text, tileLevelClass(l.text, g.title), () => {
                        markModernLostQueryLaunch(l.text);
                        navigateToContent(l.href); closeOverlay(overlay, fab);
                    }, '', tileLv3OutlineClass(l.text)));
                });
                showSubPage(overlay, fab, g.title);
            }, '', tileLv3OutlineClass(g.title)));
        });

        // 第三行：退出系统 + 系统维护（小磁贴）
        if (systemGrid) {
            systemGrid.appendChild(buildTile(doc, '退出系统', 'tmk-lv5', () => {
                window.top.location.href = getLogoutUrl();
            }, 'tmk-tile--small'));
            if (sysG) {
                systemGrid.appendChild(buildTile(doc, sysG.title, tileLevelClass(sysG.title, sysG.title), () => {
                    const subGrid = doc.getElementById(SUB_GRID_ID);
                    subGrid.innerHTML = '';
                    sysG.links.forEach(l => {
                        subGrid.appendChild(buildTile(doc, l.text, tileLevelClass(l.text, sysG.title), () => {
                            markModernLostQueryLaunch(l.text);
                            navigateToContent(l.href); closeOverlay(overlay, fab);
                        }, '', tileLv3OutlineClass(l.text)));
                    });
                    showSubPage(overlay, fab, sysG.title);
                }, 'tmk-tile--small'));
            }
        }
    }

    function buildTile(doc, title, cls, onClick, sizeCls, extraCls) {
        const btn = doc.createElement('button');
        btn.className = ['tmk-tile', cls, sizeCls || '', extraCls || ''].filter(Boolean).join(' ');
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
        if (searchFab) searchFab.classList.remove('tmk-search-active');
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.classList.remove('tmk-search-loading');
            searchInput.style.removeProperty('background');
            searchInput.style.removeProperty('color');
            searchInput.style.display = 'none';
            searchInput.value = '';
        }
    }

    function setSearchLoading(searchFab, searchInput, loading) {
        if (!searchInput) return;
        if (searchFab && loading) searchFab.classList.add('tmk-search-active');
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

    function submitSearchWithRetry(value, searchFab, searchInput, retries) {
        const targets = findBrsTargets(document);
        if (targets) {
            // 同步赋值并触发输入事件，兼容页面监听逻辑
            targets.input.value = value;
            targets.input.dispatchEvent(new Event('input', { bubbles: true }));
            targets.input.dispatchEvent(new Event('change', { bubbles: true }));
            targets.button.click();
            if (searchFab && searchInput) collapseSearch(searchFab, searchInput);
            // 查询触发后自动收起开始页，减少手动关闭操作
            const overlay = document.getElementById(OVERLAY_ID);
            const fab = document.getElementById(FAB_ID);
            if (overlay && fab && state.overlayOpen) closeOverlay(overlay, fab);
            return;
        }
        if (retries <= 0) {
            alert('未找到“查询BRS记录”输入框或按钮。');
            if (searchFab && searchInput) collapseSearch(searchFab, searchInput);
            return;
        }
        setTimeout(() => submitSearchWithRetry(value, searchFab, searchInput, retries - 1), 260);
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

    async function submitSearch(searchFab, searchInput) {
        const value = (searchInput.value || '').trim();
        if (!value) {
            collapseSearch(searchFab, searchInput);
            return;
        }
        setSearchLoading(searchFab, searchInput, true);
        const submitDirect = () => submitSearchWithRetry(value, searchFab, searchInput, 2);
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
        const pageSwitched = activatePageTab(document, '新建少收');
        if (!pageSwitched) {
            alert('未找到“新建少收”页面或“行李追踪数据”标签页。');
            collapseSearch(searchFab, searchInput);
            return;
        }
        // 页面切换通常触发导航，当前执行链会中断：先缓存查询值，等待新页面加载后自动续跑
        savePendingSearch(value);
    }

    function bindSearchShortcut(doc) {
        if (!doc || !doc.body || doc.getElementById(SEARCH_FAB_ID)) return;

        const searchFab = doc.createElement('button');
        searchFab.id = SEARCH_FAB_ID;
        searchFab.type = 'button';
        searchFab.title = '查询BRS记录';
        searchFab.innerHTML = '<img src="data:image/png;base64,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" alt="搜索" style="width:20px;height:20px;display:block;">';
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
    if (inContentFrame) {
        // 只在启动阶段做几次默认布局，之后交还给 control_frame 按钮控制
        applyDefaultFrameLayout();
        setTimeout(applyDefaultFrameLayout, 300);
        setTimeout(applyDefaultFrameLayout, 1200);
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
                            <div class="tmk-root-title-row">
                                <button type="button" id="${START_BTN_ID}" class="tmk-h1 tmk-start-btn">开始</button>
                                <input type="text" id="${ACCEPT_STATION_INPUT_ID}" class="tmk-station-inline"
                                    autocomplete="off" spellcheck="false" aria-label="受理航站公司" />
                            </div>
                            <div class="tmk-grid" id="tmk-pinned-grid"></div>
                            <div class="tmk-grid" id="${ROOT_GRID_ID}"></div>
                            <div class="tmk-grid" id="${SYSTEM_GRID_ID}"></div>
                        </section>
                        <section class="tmk-page" id="tmk-sub-page" style="display:none;">
                            <h1 class="tmk-h1">业务</h1>
                            <div class="tmk-grid" id="${SUB_GRID_ID}"></div>
                        </section>
                    </div>`;
                document.body.appendChild(overlay);

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

                // 页面局部刷新或脚本重绘时，自动补建搜索按钮，避免依赖菜单按钮交互后才出现
                setInterval(() => {
                    ensureSearchShortcut(document);
                }, 1500);
                continuePendingSearchIfNeeded();

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