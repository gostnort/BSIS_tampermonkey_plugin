// ==UserScript==
// @name         BCheckWeb UI Toolset
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  公共工具集（含统一 Z-Index 层级）
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
    const TOOLSET_GLOBAL_KEY = '__tmkUiToolset';
    const BASE_Z = 0;
    const DEFAULT_Z_LAYERS = Object.freeze({
        basePage: BASE_Z + 0,
        backgroundCover: BASE_Z + 1000,
        mainFunctionView: BASE_Z + 5000,
        functionButton: BASE_Z + 6000,
        searchControls: BASE_Z + 9000,
        floatingButton: BASE_Z + 10000
    });
    const STARTMENU_THEME_FALLBACK_COLORS = Object.freeze({
        overlayBackdrop: '0.4',
        majorFocus: '#3f89d0',
        minorFocus: '#8fb1cc',
        minorFont: '#FFFFFF',
        majorFont: '#111111',
        majorButton: '#dfe6ee',
        inputBackground: '#f8f9fa',
        minorButton: '#8cc7e8'
    });
    function zLayerCssVarFromKey(key) {
        return '--tmk-z-' + String(key).replace(/([A-Z])/g, '-$1').toLowerCase();
    }
    function resolveZLayers(raw) {
        const out = Object.assign({}, DEFAULT_Z_LAYERS);
        if (!raw || typeof raw !== 'object') return out;
        Object.keys(DEFAULT_Z_LAYERS).forEach(function(k) {
            const v = Number(raw[k]);
            if (Number.isFinite(v)) out[k] = v;
        });
        return out;
    }
    function publishZLayers(raw) {
        const payload = resolveZLayers(raw);
        try {
            if (window.top) window.top.__tmkZLayers = payload;
        } catch (e) {}
        window.__tmkZLayers = payload;
        return payload;
    }
    function getSharedZLayers() {
        try {
            if (window.top && window.top.__tmkZLayers) return resolveZLayers(window.top.__tmkZLayers);
        } catch (e) {}
        if (window.__tmkZLayers) return resolveZLayers(window.__tmkZLayers);
        return resolveZLayers(null);
    }
    class ThemeVarToolset {
        static themeColorVarFromKey(key) {
            return '--tmk-c-' + String(key).replace(/([A-Z])/g, '-$1').toLowerCase();
        }
        static readThemeColors() {
            let colors = null;
            try {
                if (window.top && window.top.__tmkTheme && window.top.__tmkTheme.colors) {
                    colors = window.top.__tmkTheme.colors;
                }
            } catch (e) {}
            if (!colors) {
                try {
                    if (window.__tmkTheme && window.__tmkTheme.colors) {
                        colors = window.__tmkTheme.colors;
                    }
                } catch (e2) {}
            }
            return colors && typeof colors === 'object' ? colors : null;
        }
        static applyThemeVars(doc, colors) {
            const d = doc || document;
            if (!d || !d.documentElement || !colors || typeof colors !== 'object') return;
            Object.keys(colors).forEach(function(k) {
                const v = colors[k];
                if (v === undefined || v === null || String(v) === '') return;
                d.documentElement.style.setProperty(ThemeVarToolset.themeColorVarFromKey(k), String(v));
            });
        }
        static ensureCanonicalThemeVarsFallback(doc, colors) {
            const d = doc || document;
            if (!d || !d.documentElement || !colors || typeof colors !== 'object') return;
            const canonicalFromExpand = {
                majorFocus: 'lv1Bg',
                majorFont: 'lv3Fg',
                minorFont: 'lv1Fg',
                minorFocus: 'searchInputBorder',
                majorButton: 'fabBg',
                inputBackground: 'searchInputBg',
                minorButton: 'lv4Bg'
            };
            Object.keys(canonicalFromExpand).forEach(function(canonicalKey) {
                const cur = colors[canonicalKey];
                if (cur !== undefined && cur !== null && String(cur) !== '') return;
                const srcKey = canonicalFromExpand[canonicalKey];
                const src = colors[srcKey];
                if (src === undefined || src === null || String(src) === '') return;
                d.documentElement.style.setProperty(ThemeVarToolset.themeColorVarFromKey(canonicalKey), String(src));
            });
        }
    }
    class StartMenuThemeController {
        static themeColorVarFromKey(key) {
            return ThemeVarToolset.themeColorVarFromKey(key);
        }
        static pickColor(c, keys, fallback) {
            for (let i = 0; i < keys.length; i += 1) {
                const k = keys[i];
                if (c[k] !== undefined && c[k] !== null && String(c[k]) !== '') return c[k];
            }
            return fallback;
        }
        static expandThemeColors(raw, defaultThemePack) {
            const base = defaultThemePack.themes[0].colors;
            const c = Object.assign({}, base, raw || {});
            const majorFocus = StartMenuThemeController.pickColor(c, ['majorFocus']);
            const minorFocus = StartMenuThemeController.pickColor(c, ['minorFocus']);
            const minorFont = StartMenuThemeController.pickColor(c, ['minorFont']);
            const majorFont = StartMenuThemeController.pickColor(c, ['majorFont']);
            const majorButton = StartMenuThemeController.pickColor(c, ['majorButton']);
            const inputBg = StartMenuThemeController.pickColor(c, ['inputBackground']);
            const minorButton = StartMenuThemeController.pickColor(c, ['minorButton']);
            const overlayOpacityRaw = StartMenuThemeController.pickColor(c, ['overlayBackdrop'], '0.4');
            let overlayOpacity = parseFloat(String(overlayOpacityRaw).replace(/[^\d.]/g, ''));
            if (!Number.isFinite(overlayOpacity)) overlayOpacity = 0.4;
            overlayOpacity = Math.max(0, Math.min(1, overlayOpacity));
            const overlayPercent = Math.max(0, Math.min(100, Math.round(overlayOpacity * 100)));
            return {
                overlayBackdrop: 'color-mix(in srgb, ' + minorButton + ' ' + overlayPercent + '%, transparent)',
                majorFocus: majorFocus,
                majorFont: majorFont,
                minorFont: minorFont,
                minorFocus: minorFocus,
                majorButton: majorButton,
                inputBackground: inputBg,
                minorButton: minorButton,
                lv1Bg: StartMenuThemeController.pickColor(c, ['lv1Bg'], majorFocus),
                kvToolFg: StartMenuThemeController.pickColor(c, ['kvToolFg'], majorFocus),
                lv2Bg: StartMenuThemeController.pickColor(c, ['lv2Bg'], minorFocus),
                fabHoverBorder: StartMenuThemeController.pickColor(c, ['fabHoverBorder'], minorFocus),
                searchInputBorder: StartMenuThemeController.pickColor(c, ['searchInputBorder'], minorFocus),
                kvToolBorder: StartMenuThemeController.pickColor(c, ['kvToolBorder'], minorFocus),
                tileHoverBorder: StartMenuThemeController.pickColor(c, ['tileHoverBorder'], minorFocus),
                h1: StartMenuThemeController.pickColor(c, ['h1'], minorFont),
                lv1Fg: StartMenuThemeController.pickColor(c, ['lv1Fg'], minorFont),
                lv2Fg: StartMenuThemeController.pickColor(c, ['lv2Fg'], minorFont),
                lv4Fg: StartMenuThemeController.pickColor(c, ['lv4Fg'], majorFont),
                lv3Fg: StartMenuThemeController.pickColor(c, ['lv3Fg'], majorFont),
                fabFg: StartMenuThemeController.pickColor(c, ['fabFg'], majorFont),
                searchInputFg: StartMenuThemeController.pickColor(c, ['searchInputFg'], majorFont),
                lv5Fg: StartMenuThemeController.pickColor(c, ['lv5Fg'], majorFont),
                searchPlaceholder: StartMenuThemeController.pickColor(c, ['searchPlaceholder'], majorFont),
                fabBg: StartMenuThemeController.pickColor(c, ['fabBg'], majorButton),
                searchBg: StartMenuThemeController.pickColor(c, ['searchBg'], majorButton),
                lv5Bg: StartMenuThemeController.pickColor(c, ['lv5Bg'], majorButton),
                searchActiveBg: StartMenuThemeController.pickColor(c, ['searchActiveBg'], majorButton),
                lv4Bg: StartMenuThemeController.pickColor(c, ['lv4Bg'], minorButton),
                searchInputBg: StartMenuThemeController.pickColor(c, ['searchInputBg'], inputBg),
                fabBorder: StartMenuThemeController.pickColor(c, ['fabBorder'], minorFocus),
                searchBorder: StartMenuThemeController.pickColor(c, ['searchBorder'], minorFocus),
                searchActiveBorder: minorFocus,
                lv3Bg: StartMenuThemeController.pickColor(c, ['lv3Bg'], majorButton),
                searchLoadingBg: StartMenuThemeController.pickColor(c, ['searchLoadingBg'], majorButton),
                searchLoadingFg: StartMenuThemeController.pickColor(c, ['searchLoadingFg'], majorFont)
            };
        }
        static readThemeIndex(themeStorageKey) {
            try {
                const v = parseInt(localStorage.getItem(themeStorageKey), 10);
                return Number.isFinite(v) ? v : 1;
            } catch (e) {
                return 1;
            }
        }
        static saveThemeIndex(themeStorageKey, i) {
            try {
                localStorage.setItem(themeStorageKey, String(i));
            } catch (e) {}
        }
        static getCurrentThemeId() {
            try {
                const t = window.__tmkTheme;
                if (t && t.id !== undefined && t.id !== null) return t.id;
            } catch (e) {}
            return 2;
        }
        static sortThemesById(arr) {
            return arr.slice().sort(function(a, b) {
                return Number(a.id) - Number(b.id);
            });
        }
        static async fetchThemesPackOnline(themeJsonUrl) {
            try {
                const r = await fetch(themeJsonUrl, { cache: 'no-store' });
                if (!r.ok) return null;
                const data = await r.json();
                if (!data || !Array.isArray(data.themes) || !data.themes.length) return null;
                return data;
            } catch (e) {
                return null;
            }
        }
        static applyThemeCss(doc, theme) {
            if (!doc || !doc.head || !theme || !theme.colors) return;
            let el = doc.getElementById('tmk-theme-vars');
            if (!el) {
                el = doc.createElement('style');
                el.id = 'tmk-theme-vars';
                doc.head.insertBefore(el, doc.head.firstChild);
            }
            const lines = [];
            Object.keys(theme.colors).forEach(function(k) {
                const v = theme.colors[k];
                if (v === undefined || v === null || String(v) === '') return;
                lines.push('  ' + StartMenuThemeController.themeColorVarFromKey(k) + ': ' + v + ';');
            });
            el.textContent = ':root {\n' + lines.join('\n') + '\n}';
            try {
                window.__tmkTheme = { id: theme.id, name: theme.name, colors: theme.colors };
                if (window.top) window.top.__tmkTheme = window.__tmkTheme;
            } catch (e) {}
        }
        static async bootstrapTheme(doc, options) {
            const online = await StartMenuThemeController.fetchThemesPackOnline(options.themeJsonUrl);
            const themes = online && online.themes && online.themes.length
                ? StartMenuThemeController.sortThemesById(online.themes)
                : StartMenuThemeController.sortThemesById(options.defaultThemePack.themes);
            const n = themes.length;
            let idx = StartMenuThemeController.readThemeIndex(options.themeStorageKey) % n;
            if (idx < 0) idx += n;
            const th = themes[idx];
            StartMenuThemeController.applyThemeCss(doc, {
                id: th.id,
                name: th.name,
                colors: StartMenuThemeController.expandThemeColors(th.colors, options.defaultThemePack)
            });
            if (options.onThemeApplied) options.onThemeApplied();
        }
        static async cycleTheme(doc, options) {
            const online = await StartMenuThemeController.fetchThemesPackOnline(options.themeJsonUrl);
            const themes = online && online.themes && online.themes.length
                ? StartMenuThemeController.sortThemesById(online.themes)
                : StartMenuThemeController.sortThemesById(options.defaultThemePack.themes);
            const n = themes.length;
            if (!n) return;
            let idx = StartMenuThemeController.readThemeIndex(options.themeStorageKey) + 1;
            if (idx >= n) idx = 0;
            StartMenuThemeController.saveThemeIndex(options.themeStorageKey, idx);
            const th = themes[idx];
            StartMenuThemeController.applyThemeCss(doc, {
                id: th.id,
                name: th.name,
                colors: StartMenuThemeController.expandThemeColors(th.colors, options.defaultThemePack)
            });
            if (options.onThemeApplied) options.onThemeApplied();
        }
        static getMergedThemeColors(fallbackColors) {
            const base = fallbackColors && typeof fallbackColors === 'object' ? fallbackColors : {};
            const uiColors = ThemeVarToolset.readThemeColors();
            return Object.assign({}, base, uiColors || {});
        }
        static getDefaultFallbackColors() {
            return Object.assign({}, STARTMENU_THEME_FALLBACK_COLORS);
        }
    }
    class OverlayButtonStyleToolset {
        static getVars() {
            return {
                '--tmk-btn-primary-radius': '10px',
                '--tmk-btn-primary-border-color': 'var(--tmk-c-major-focus)',
                '--tmk-btn-primary-bg': 'var(--tmk-c-major-focus)',
                '--tmk-btn-primary-fg': 'var(--tmk-c-lv1-fg)',
                '--tmk-btn-secondary-border-color': 'var(--tmk-c-major-focus)',
                '--tmk-btn-secondary-bg': 'var(--tmk-c-major-button)',
                '--tmk-btn-secondary-fg': 'var(--tmk-c-major-font)',
                '--tmk-btn-font-size': '20px',
                '--tmk-btn-font-weight': '700',
                '--tmk-btn-shadow': '0 3px 10px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.06)',
                '--tmk-btn-hover-shadow': '0 4px 8px rgba(0, 0, 0, 0.5)',
                '--tmk-toolbar-btn-padding': '0px 12px',
                '--tmk-toolbar-btn-min-height': '30px',
                '--tmk-toolbar-btn-radius': '999px',
                '--tmk-toolbar-btn-font-size': '14px'
            };
        }
        static getToolbarButtonCss() {
            return `
                .tmk-toolbar-btn {
                    display: block;
                    padding: var(--tmk-toolbar-btn-padding, 0px 12px);
                    min-height: var(--tmk-toolbar-btn-min-height, 30px);
                    border-radius: var(--tmk-toolbar-btn-radius, 999px);
                    border: 1px solid var(--tmk-c-minor-focus, #8fb1cc);
                    background: var(--tmk-c-major-button, #dfe6ee);
                    color: var(--tmk-c-major-font, #111111);
                    font-size: var(--tmk-toolbar-btn-font-size, 14px);
                    cursor: pointer;
                    font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
                }
                .tmk-toolbar-btn.tmk-active {
                    background: var(--tmk-c-major-focus, #3f89d0);
                    border-color: var(--tmk-c-major-focus, #3f89d0);
                    color: var(--tmk-c-lv1-fg, #ffffff);
                }
                .tmk-toolbar-btn:hover:not(.tmk-active) {
                    background: var(--tmk-c-minor-focus, #8fb1cc);
                }
            `;
        }
        static applyVars(doc) {
            const d = doc || document;
            if (!d || !d.documentElement) return;
            const vars = OverlayButtonStyleToolset.getVars();
            Object.keys(vars).forEach(function(k) {
                d.documentElement.style.setProperty(k, vars[k]);
            });
        }
    }
    class OverlayInputStyleToolset {
        static getVars() {
            return {
                '--tmk-ctl-border-color': 'var(--tmk-c-search-input-border)',
                '--tmk-ctl-bg': 'var(--tmk-c-input-background)',
                '--tmk-ctl-fg': 'var(--tmk-c-major-font)',
                '--tmk-ctl-radius': '8px',
                '--tmk-ctl-min-h': '34px',
                '--tmk-ctl-pad-x': '10px',
                '--tmk-ctl-pad-y': '6px'
            };
        }
        // 生成指定 scope 选择器下的 input/select/textarea CSS 规则
        // scopes: 字符串数组，每个元素是外层选择器前缀，如 ['#myWrap', '#myShell']
        static getCss(scopes) {
            const arr = Array.isArray(scopes) ? scopes : [scopes];
            const tags = ['input', 'select', 'textarea'];
            const parts = [];
            for (let i = 0; i < arr.length; i += 1) {
                const s = arr[i];
                for (let j = 0; j < tags.length; j += 1) {
                    parts.push(s + ' ' + tags[j]);
                }
            }
            const selectors = parts.join(',\n            ');
            return selectors + ' {\n' + OverlayInputStyleToolset.getPropertiesBlock() + '\n            }';
        }
        // 仅返回属性字符串（不含选择器），供特殊 selector 场景嵌入
        static getPropertiesBlock() {
            return (
                '                border: 1px solid var(--tmk-ctl-border-color, var(--tmk-c-search-input-border)) !important;\n' +
                '                border-radius: var(--tmk-ctl-radius, 8px) !important;\n' +
                '                background: var(--tmk-ctl-bg, var(--tmk-c-input-background)) !important;\n' +
                '                color: var(--tmk-ctl-fg, var(--tmk-c-major-font)) !important;\n' +
                '                min-height: var(--tmk-ctl-min-h, 34px) !important;\n' +
                '                padding: var(--tmk-ctl-pad-y, 6px) var(--tmk-ctl-pad-x, 10px) !important;\n' +
                '                box-sizing: border-box !important;\n' +
                '                font-family: inherit !important;'
            );
        }
        static applyVars(doc) {
            const d = doc || document;
            if (!d || !d.documentElement) return;
            const vars = OverlayInputStyleToolset.getVars();
            Object.keys(vars).forEach(function(k) {
                d.documentElement.style.setProperty(k, vars[k]);
            });
        }
    }
    function buildToolset() {
        return {
            BASE_Z: BASE_Z,
            DEFAULT_Z_LAYERS: DEFAULT_Z_LAYERS,
            zLayerCssVarFromKey: zLayerCssVarFromKey,
            resolveZLayers: resolveZLayers,
            publishZLayers: publishZLayers,
            getSharedZLayers: getSharedZLayers,
            ThemeVarToolset: ThemeVarToolset,
            StartMenuThemeController: StartMenuThemeController,
            OverlayButtonStyleToolset: OverlayButtonStyleToolset,
            OverlayInputStyleToolset: OverlayInputStyleToolset
        };
    }
    function installToolsetGlobal() {
        const existing = window[TOOLSET_GLOBAL_KEY];
        if (existing && typeof existing === 'object') return existing;
        const toolset = buildToolset();
        window[TOOLSET_GLOBAL_KEY] = toolset;
        try {
            if (window.top && !window.top[TOOLSET_GLOBAL_KEY]) {
                window.top[TOOLSET_GLOBAL_KEY] = toolset;
            }
        } catch (e) {}
        return toolset;
    }
    installToolsetGlobal();
})();
