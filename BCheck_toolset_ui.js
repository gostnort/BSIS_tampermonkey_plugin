// ==UserScript==
// @name         BCheckWeb UI Toolset
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  公共工具集（须在瓷砖菜单等脚本之前启用；勿用远程 @require，以免外网故障）
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
    // 默认调色板（唯一色值来源）；startmenu 注入 #tmk-theme-vars 后 --tmk-c-* 优先，CSS 里 var(..., DEFAULT_THEME.x) 仅作未定义时的回退
    const DEFAULT_THEME = Object.freeze({
        overlayBackdrop: '0.4',
        majorFocus: '#3f89d0',
        minorFocus: '#8fb1cc',
        minorFont: '#FFFFFF',
        majorFont: '#111111',
        majorButton: '#dfe6ee',
        inputBackground: '#f8f9fa',
        minorButton: '#8cc7e8'
    });
    const DEFAULT_THEME_PACK = Object.freeze({
        version: 2,
        themes: [
            {
                id: 2,
                name: '新建少收查询默认',
                colors: Object.assign({}, DEFAULT_THEME)
            }
        ]
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
            return Object.assign({}, DEFAULT_THEME);
        }
    }
    const DECK_STYLE_ID = 'tmk-deck-base-style';
    const DECK_DOM_ID = 'tmk-deck';
    const Deck = {
        DOM_ID: DECK_DOM_ID,
        injectBaseStyle: function(doc) {
            const d = doc || document;
            if (!d.head || d.getElementById(DECK_STYLE_ID)) return;
            const st = d.createElement('style');
            st.id = DECK_STYLE_ID;
            st.textContent =
                '#' + DECK_DOM_ID + ' { position: relative; z-index: 1; }\n';
            d.head.appendChild(st);
        },
        // 现代覆层统一父节点：毛玻璃、工具栏、shell 等全部挂在此根下，避免散落在 body 第一层
        ensure: function(doc) {
            const d = doc || document;
            Deck.injectBaseStyle(d);
            if (!d.body) return null;
            let root = d.getElementById(DECK_DOM_ID);
            if (root) return root;
            root = d.createElement('div');
            root.id = DECK_DOM_ID;
            root.className = 'tmk-deck';
            root.setAttribute('data-tmk-role', 'modern-stack');
            d.body.appendChild(root);
            return root;
        },
        adopt: function(doc, elementId) {
            const d = doc || document;
            const el = d.getElementById(elementId);
            const root = Deck.ensure(d);
            if (!el || !root) return el;
            if (el.parentNode !== root) root.appendChild(el);
            return el;
        }
    };


    const StyleInjector = {
        inject: function(doc, id, cssString) {
            const d = doc || document;
            if (!d.head || d.getElementById(id)) return;
            const st = d.createElement('style');
            st.id = id;
            st.textContent = cssString;
            d.head.appendChild(st);
        }
    };

    class Control {
        constructor(nativeElement) {
            if (!nativeElement || !nativeElement.nodeType) {
                throw new Error('Control 需要有效的挂载点 nativeElement');
            }
            this.nativeElement = nativeElement;
        }

        widget() {
            return this.nativeElement;
        }

        get el() {
            return this.nativeElement;
        }

        appendTo(parent) {
            if (parent && parent.appendChild && this.nativeElement) parent.appendChild(this.nativeElement);
            return this;
        }

        setStyle(styles) {
            if (!styles || typeof styles !== 'object' || !this.nativeElement) return;
            Object.assign(this.nativeElement.style, styles);
        }

        setVisible(visible) {
            if (!this.nativeElement) return;
            this.nativeElement.style.display = visible !== false ? '' : 'none';
        }

        setEnabled(enabled) {
            const el = this.nativeElement;
            if (!el) return;
            const en = enabled !== false;
            if (typeof el.disabled === 'boolean') {
                el.disabled = !en;
                el.style.opacity = '';
                el.style.pointerEvents = '';
            } else {
                el.setAttribute('aria-disabled', en ? 'false' : 'true');
                el.style.pointerEvents = en ? '' : 'none';
                el.style.opacity = en ? '1' : '0.5';
            }
        }

        setCssVar(name, value) {
            if (!this.nativeElement || value === undefined || value === null) return;
            let n = String(name || '').trim();
            if (n.indexOf('--') !== 0) n = '--tmk-' + n.replace(/^\-+/, '');
            this.nativeElement.style.setProperty(n, String(value));
        }
    }

    const BUTTON_CHROME_STYLE_ID = 'tmk-btn-chrome-family';

    class Button extends Control {
        constructor(options) {
            options = options || {};
            const docRef = options.document || document;
            let el = options.nativeElement;
            if (!el) {
                el = docRef.createElement('button');
                el.type = options.type != null ? options.type : 'button';
                const useBase = options.useTmkBtn !== false;
                let cls = useBase ? 'tmk-btn' : '';
                if (options.className) cls = cls ? cls + ' ' + options.className : options.className;
                el.className = String(cls).trim();
                if (options.id) el.id = options.id;
                if (options.textContent != null) el.textContent = options.textContent;
                if (options.innerHTML != null) el.innerHTML = options.innerHTML;
                if (options.title) el.setAttribute('title', options.title);
                if (options.ariaLabel) el.setAttribute('aria-label', options.ariaLabel);
            } else if (options.className) {
                el.className = (el.className ? el.className + ' ' : '') + options.className;
            }
            super(el);
            if (typeof options.onClick === 'function') {
                el.addEventListener('click', options.onClick);
            }
            // Self-inject base style
            if (this.constructor.ensureStyles) {
                this.constructor.ensureStyles(docRef);
            }
        }

        static ensureStyles(doc) {
            const tc = ThemeVarToolset.themeColorVarFromKey;
            const css = `
                .tmk-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 6px 16px;
                    box-sizing: border-box;
                    font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(${tc('majorFont')}, #111111);
                    background: var(${tc('searchBg')}, #dfe6ee);
                    border: 1px solid var(${tc('searchInputBorder')}, #8fb1cc);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                .tmk-btn:hover {
                    background: var(${tc('searchActiveBg')}, #dfe6ee);
                    border-color: var(${tc('majorFocus')}, #3f89d0);
                }
                .tmk-btn:active {
                    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .tmk-btn[disabled], .tmk-btn[aria-disabled="true"] {
                    opacity: 0.6;
                    cursor: not-allowed;
                    pointer-events: none;
                }
                .tmk-btn--block { display: block; width: 100%; box-sizing: border-box; }
                .tmk-btn--transparent { background: transparent !important; border: none; box-shadow: none; }
            `;
            StyleInjector.inject(doc, 'tmk-btn-base-style', css);
        }

        static injectChromeStyles(doc) {
            // Obsolete: managed by specific classes
        }
    }

    class PrimarySubmitButton extends Button {
        constructor(options) {
            options = options || {};
            options.className = ('tmk-submit tmk-btn--block ' + (options.className || '')).trim();
            super(options);
        }

        static ensureStyles(doc) {
            Button.ensureStyles(doc);
            const css = 
                '.tmk-submit.tmk-btn, button.tmk-submit.tmk-btn {\n' +
                '  margin-top: 22px; width: 100%; min-height: 46px;\n' +
                '  border: 1px solid var(--tmk-btn-primary-border-color, var(--tmk-c-major-focus));\n' +
                '  border-radius: var(--tmk-btn-primary-radius, 10px);\n' +
                '  background: var(--tmk-btn-primary-bg, var(--tmk-c-major-focus));\n' +
                '  color: var(--tmk-btn-primary-fg, var(--tmk-c-lv1-fg));\n' +
                '  font-size: var(--tmk-btn-font-size, 20px); font-weight: var(--tmk-btn-font-weight, 700);\n' +
                '  cursor: pointer;\n' +
                '  box-shadow: var(--tmk-btn-shadow, 0 3px 10px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.06));\n' +
                '}\n';
            StyleInjector.inject(doc, 'tmk-btn-primary-submit', css);
        }
    }

    class MenuButton extends Button {
        constructor(options) {
            options = options || {};
            options.id = options.id || 'tmk-menu-button';
            options.className = ('tmk-menu-btn ' + (options.className || '')).trim();
            super(options);
        }

        static ensureStyles(doc) {
            Button.ensureStyles(doc);
            const zFl = zLayerCssVarFromKey('floatingButton');
            const vfabBg = ThemeVarToolset.themeColorVarFromKey('fabBg');
            const vfabFg = ThemeVarToolset.themeColorVarFromKey('fabFg');
            const vfabBorder = ThemeVarToolset.themeColorVarFromKey('fabBorder');
            const vfabHoverBd = ThemeVarToolset.themeColorVarFromKey('fabHoverBorder');
            const css = 
                '.tmk-menu-btn.tmk-btn {\n' +
                '  position: fixed !important; left: 30px !important; top: 20px !important;\n' +
                '  z-index: var(' + zFl + ') !important; width: 46px !important; height: 46px !important;\n' +
                '  display: flex !important; align-items: center !important; justify-content: center !important;\n' +
                '  background: var(' + vfabBg + ') !important; color: var(' + vfabFg + ') !important;\n' +
                '  border: 1px solid var(' + vfabBorder + ') !important; border-radius: 999px !important;\n' +
                '  font-family: "Segoe UI Light", sans-serif !important; font-size: 30px !important;\n' +
                '  font-weight: 100 !important; cursor: pointer !important;\n' +
                '  transition: border-color 0.2s ease !important;\n' +
                '}\n' +
                '.tmk-menu-btn.tmk-btn:hover {\n' +
                '  background: var(' + vfabBg + ') !important; border-color: var(' + vfabHoverBd + ') !important;\n' +
                '}\n';
            StyleInjector.inject(doc, 'tmk-btn-menu-chrome', css);
        }
    }

    class SearchButton extends Button {
        constructor(options) {
            options = options || {};
            options.id = options.id || 'tmk-search-button';
            options.className = ('tmk-search-btn ' + (options.className || '')).trim();
            super(options);
        }

        static ensureStyles(doc) {
            Button.ensureStyles(doc);
            const zSc = zLayerCssVarFromKey('searchControls');
            const vfabFg = ThemeVarToolset.themeColorVarFromKey('fabFg');
            const vSearchBg = ThemeVarToolset.themeColorVarFromKey('searchBg');
            const vSearchActBd = ThemeVarToolset.themeColorVarFromKey('searchActiveBorder');
            const css = 
                '.tmk-search-btn.tmk-btn {\n' +
                '  position: fixed !important; right: 20px !important; top: 20px !important;\n' +
                '  z-index: var(' + zSc + ') !important; width: 46px !important; height: 46px !important;\n' +
                '  display: inline-flex !important; align-items: center !important; justify-content: center !important;\n' +
                '  color: var(' + vfabFg + ') !important; font-size: 23px !important; line-height: 1 !important;\n' +
                '  background: var(' + vSearchBg + ') !important;\n' +
                '  border: 1px solid transparent !important; border-radius: 999px !important;\n' +
                '  box-shadow: none !important; cursor: pointer !important;\n' +
                '  transition: border-color 0.2s ease !important;\n' +
                '}\n' +
                '.tmk-search-btn.tmk-btn:hover,\n' +
                '.tmk-search-btn.tmk-btn.tmk-search-active {\n' +
                '  background: var(' + vSearchBg + ') !important;\n' +
                '  border-color: var(' + vSearchActBd + ') !important;\n' +
                '}\n';
            StyleInjector.inject(doc, 'tmk-btn-search-chrome', css);
        }
    }

    class Tile extends Button {
        constructor(options) {
            options = options || {};
            const title = options.title != null ? String(options.title) : '';
            const parts = ['tmk-tile'];
            if (options.levelClass) parts.push(String(options.levelClass));
            if (options.sizeClass) parts.push(String(options.sizeClass));
            if (options.extraClass) parts.push(String(options.extraClass));
            options.className = (parts.join(' ') + ' ' + (options.className || '')).trim();
            const esc = function(s) {
                const n = document.createElement('span');
                n.textContent = s;
                return n.innerHTML;
            };
            if (options.innerHTML === undefined) {
                options.innerHTML = '<div class="tmk-title">' + esc(title) + '</div>';
            }
            super(options);
            
            if (this.constructor.ensureStyles) {
                this.constructor.ensureStyles(options.document || document);
            }
        }

        static ensureStyles(doc) {
            const tc = ThemeVarToolset.themeColorVarFromKey;
            const css = `
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
                    box-shadow: inset 0 0 0 2px var(${tc('tileHoverBorder')}) !important;
                }
                .tmk-title { font-size: 18px !important; line-height: 1.2 !important; }
                .tmk-lv1 { background: var(${tc('lv1Bg')}) !important; color: var(${tc('lv1Fg')}) !important; }
                .tmk-lv2 { background: var(${tc('lv2Bg')}) !important; color: var(${tc('lv2Fg')}) !important; }
                .tmk-lv3 { background: var(${tc('lv3Bg')}) !important; color: var(${tc('lv3Fg')}) !important; }
                .tmk-tile--kv-tool.tmk-lv3 { border: 2px solid var(${tc('kvToolBorder')}) !important; }
                .tmk-tile--kv-tool.tmk-lv3 .tmk-title { color: var(${tc('kvToolFg')}) !important; }
                .tmk-lv4 { background: var(${tc('lv4Bg')}) !important; color: var(${tc('lv4Fg')}) !important; }
                .tmk-lv5 { background: var(${tc('lv5Bg')}) !important; color: var(${tc('lv5Fg')}) !important; }
                .tmk-tile div:not(.tmk-title) { display: none !important; }
            `;
            StyleInjector.inject(doc, 'tmk-tile-base-style', css);
        }
    }

    class MediumTile extends Tile {
        constructor(options) {
            super(options || {});
        }
    }

    class BigTile extends Tile {
        constructor(options) {
            options = options || {};
            options.sizeClass = 'tmk-tile--big';
            super(options);
        }
    }

    class SmallTile extends Tile {
        constructor(options) {
            options = options || {};
            options.sizeClass = 'tmk-tile--small';
            super(options);
        }
    }

    class Switch extends Control {
        constructor(options) {
            options = options || {};
            const el = document.createElement('div');
            el.className = 'tmk-sw' + (options.className ? ' ' + String(options.className).trim() : '');
            const esc = function(s) {
                const n = document.createElement('span');
                n.textContent = s;
                return n.innerHTML;
            };
            const l = options.left != null ? '<span class="tmk-l">' + esc(String(options.left)) + '</span>' : '';
            const r = options.right != null ? '<span class="tmk-r">' + esc(String(options.right)) + '</span>' : '';
            el.innerHTML = l + '<div class="tmk-tr"><div class="tmk-th"></div></div>' + r;
            el.setAttribute('role', 'group');
            super(el);
            this._checked = options.checked !== undefined ? !!options.checked : true;
            this._onToggled = typeof options.onToggled === 'function' ? options.onToggled : null;
            this._suppress = false;
            const self = this;
            el.addEventListener('click', function(ev) {
                ev.preventDefault();
                self.checked = !self._checked;
            });
            this._updateUi();
            
            if (this.constructor.ensureStyles) {
                this.constructor.ensureStyles(options.document || document);
            }
        }

        static ensureStyles(doc) {
            const vMajorFocus = ThemeVarToolset.themeColorVarFromKey('majorFocus');
            const vMinorButton = ThemeVarToolset.themeColorVarFromKey('minorButton');
            const vMajorFont = ThemeVarToolset.themeColorVarFromKey('majorFont');
            const css = `
                .tmk-sw {
                    position: fixed;
                    right: var(--tmk-vsw-right, 20px);
                    left: auto;
                    top: var(--tmk-vsw-top, 20px);
                    display: inline-flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 14px;
                    background: rgba(255, 255, 255, 0.5);
                    border: none;
                    border-radius: 12px;
                    box-sizing: border-box;
                    cursor: pointer;
                    user-select: none;
                    font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
                }
                .tmk-sw .tmk-l,
                .tmk-sw .tmk-r {
                    margin: 0;
                    padding: 0;
                    background: transparent;
                    border: none;
                    font-size: 14px;
                    color: var(${vMajorFont}, ${DEFAULT_THEME.majorFont});
                    white-space: nowrap;
                    opacity: 0.55;
                    pointer-events: none;
                }
                .tmk-sw.tmk-modern .tmk-l {
                    opacity: 1;
                    font-weight: 700;
                }
                .tmk-sw.tmk-legacy .tmk-r {
                    opacity: 1;
                    font-weight: 700;
                }
                .tmk-sw .tmk-tr {
                    position: relative;
                    width: 44px;
                    height: 22px;
                    flex-shrink: 0;
                    border-radius: 11px;
                    pointer-events: none;
                }
                .tmk-sw.tmk-modern .tmk-tr {
                    background: var(${vMajorFocus}, ${DEFAULT_THEME.majorFocus});
                }
                .tmk-sw.tmk-legacy .tmk-tr {
                    background: var(${vMinorButton}, ${DEFAULT_THEME.minorButton});
                }
                .tmk-sw .tmk-th {
                    position: absolute;
                    left: 2px;
                    top: 50%;
                    width: 18px;
                    height: 18px;
                    margin-top: -9px;
                    border-radius: 50%;
                    background: #ffffff;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
                    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .tmk-sw.tmk-modern .tmk-th {
                    transform: translateX(0);
                }
                .tmk-sw.tmk-legacy .tmk-th {
                    transform: translateX(22px);
                }
            `;
            StyleInjector.inject(doc, 'tmk-sw-widget-css', css);
        }

        _updateUi() {
            const el = this.nativeElement;
            if (!el) return;
            const mv = this._checked;
            el.classList.toggle('tmk-modern', mv);
            el.classList.toggle('tmk-legacy', !mv);
        }

        get checked() {
            return this._checked;
        }

        set checked(val) {
            const next = !!val;
            if (this._checked === next) return;
            this._checked = next;
            this._updateUi();
            if (this._onToggled && !this._suppress) {
                this._onToggled(next);
            }
        }

        setCheckedQuiet(val) {
            this._suppress = true;
            this.checked = !!val;
            this._suppress = false;
        }
    }

    class ViewSwitchCtl {
        constructor(swInstance, options) {
            this._sw = swInstance;
            this.root = swInstance.nativeElement;
            this._opts = options || {};
        }

        get myView() {
            return this._sw.checked;
        }

        set myView(v) {
            const next = !!v;
            if (this._sw.checked === next) return;
            this._sw.setCheckedQuiet(next);
        }
    }


    const VIEW_SWITCH_WIDGET_STYLE_ID = 'tmk-vsw-widget-css';
    const ViewSwitch = {
        SCRIPT_DOM_ID: Object.freeze({
            ahlPnr: 'tmk-pnr-vsw',
            lostQueryV2: 'tmk-lqv2-vsw'
        }),
        domIdForScript: function(scriptKey) {
            const k = String(scriptKey || '');
            const map = ViewSwitch.SCRIPT_DOM_ID;
            return map[k] || null;
        },
        mountForScript: function(doc, scriptKey, options) {
            const vsId = ViewSwitch.domIdForScript(scriptKey);
            if (!vsId) return null;
            options = options || {};
            return ViewSwitch.mount(doc, Object.assign({}, options, { viewSwitchId: vsId }));
        },
        injectZRule: function(doc, elementId, layerKey) {
            const d = doc || document;
            if (!d.head || !elementId) return;
            const lk = layerKey !== undefined && layerKey !== null && layerKey !== '' ? String(layerKey) : 'mainFunctionView';
            const layers = getSharedZLayers();
            const zi = Number(layers[lk]);
            if (!Number.isFinite(zi)) return;
            const sid = 'tmk-z-' + String(elementId).replace(/[^a-zA-Z0-9_-]/g, '');
            let st = d.getElementById(sid);
            const css = '#' + elementId + ' { z-index: ' + zi + '; }\n';
            if (!st) {
                st = d.createElement('style');
                st.id = sid;
                d.head.appendChild(st);
            }
            st.textContent = css;
        },
        injectStyles: function(doc) {
            // Obsolete: managed by specific classes
        },
        _createController: function(hostEl, options) {
            const inst = hostEl && hostEl.__tmkSwitchInstance;
            if (!inst) return null;
            return new ViewSwitchCtl(inst, options);
        },
        _ensureController: function(hostEl, options) {
            if (hostEl.__tmkViewSwitchCtl) return hostEl.__tmkViewSwitchCtl;
            const ctl = ViewSwitch._createController(hostEl, options);
            hostEl.__tmkViewSwitchCtl = ctl;
            return ctl;
        },
        mount: function(doc, options) {
            options = options || {};
            const d = doc || document;
            const container = options.container;
            const vsId = options.viewSwitchId || options.id || 'tmk-vsw';
            if (!container || !d.body) return null;
            ViewSwitch.injectStyles(d);
            let host = d.getElementById(vsId);
            if (!host) {
                const initialMv =
                    options.initialMyView !== undefined && options.initialMyView !== null ? !!options.initialMyView : true;
                const cb = options.onMyViewChange;
                const sw = new Switch({
                    left: '我的视图',
                    right: '原版',
                    checked: initialMv,
                    onToggled: function(mv) {
                        if (typeof cb === 'function') cb(mv);
                    }
                });
                host = sw.nativeElement;
                host.id = vsId;
                host.__tmkSwitchInstance = sw;
                container.appendChild(host);
                const ctl = ViewSwitch._ensureController(host, options);
                if (options.zLayer !== false) {
                    ViewSwitch.injectZRule(d, vsId, options.zLayer);
                }
                return ctl;
            }
            if (typeof Deck.adopt === 'function') {
                try {
                    Deck.adopt(d, vsId);
                } catch (e) {}
            }
            const ctl = ViewSwitch._ensureController(host, options);
            if (options.zLayer !== false) {
                ViewSwitch.injectZRule(d, vsId, options.zLayer);
            }
            return ctl;
        }
    };
    const TMK_UI_HIDDEN_CLASS = 'tmk-ui-hidden';
    // 现代覆层与宿主混排：统一注入「带 tmk-ui-hidden 类则隐藏」的组合选择器，避免业务手写一长串 #id
    const ChromeStack = {
        injectHideWhenClassRule: function(doc, options) {
            options = options || {};
            const d = doc || document;
            if (!d.head) return;
            const styleId = options.styleId || 'tmk-chrome-ui-hidden-bundle';
            if (d.getElementById(styleId)) return;
            const ids = [];
            const vk = options.viewSwitchScriptKey;
            if (vk) {
                const vid = ViewSwitch.domIdForScript(String(vk));
                if (vid) ids.push(vid);
            }
            const extras = options.otherElementIds || options.extraElementIds || [];
            if (extras && extras.length) {
                for (let i = 0; i < extras.length; i += 1) {
                    const eid = extras[i];
                    if (eid != null && String(eid) !== '') ids.push(String(eid));
                }
            }
            if (!ids.length) return;
            let sel = '';
            for (let j = 0; j < ids.length; j += 1) {
                if (j > 0) sel += ',\n';
                sel += '#' + ids[j] + '.' + TMK_UI_HIDDEN_CLASS;
            }
            const st = d.createElement('style');
            st.id = styleId;
            st.textContent = sel + ' {\n  display: none !important;\n}\n';
            d.head.appendChild(st);
        }
    };
    // 与宿主 input/textarea 的轻量绑定，供少收等页逐段迁出 get/set
    const Field = {
        ensureSharedStyles: function(doc) {
            const css = `
            /* --- Shared Form Fields --- */
            .tmk-glass-backdrop {
                position: fixed;
                inset: 0;
                display: none;
                background: var(--tmk-c-overlay-backdrop);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                pointer-events: none;
            }
            .tmk-shared-toolbar {
                position: fixed;
                top: var(--tmk-toolbar-top, 10px);
                right: var(--tmk-toolbar-right, 12px);
                z-index: var(--tmk-z-main-function-view);
                display: inline-flex;
                align-items: center;
                gap: var(--tmk-toolbar-gap, 6px);
                padding: var(--tmk-toolbar-padding, 5px);
                border-radius: var(--tmk-toolbar-radius, 999px);
                background: var(--tmk-c-search-bg);
                border: 1px solid var(--tmk-c-search-input-border);
                box-shadow: var(--tmk-toolbar-shadow, 0 6px 16px rgba(23, 52, 86, 0.16));
                backdrop-filter: blur(var(--tmk-toolbar-blur, 8px));
                -webkit-backdrop-filter: blur(var(--tmk-toolbar-blur, 8px));
            }
            .tmk-shared-toolbar-btn {
                min-height: var(--tmk-toolbar-btn-min-height, 30px);
                padding: 0 var(--tmk-toolbar-btn-padding-x, 12px);
                border-radius: var(--tmk-toolbar-btn-radius, 999px);
                border: 1px solid var(--tmk-c-search-input-border);
                background: var(--tmk-c-search-bg);
                color: var(--tmk-c-major-font);
                font-size: var(--tmk-toolbar-btn-font-size, 14px);
                font-weight: 600;
                cursor: pointer;
                font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
                transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
            }
            .tmk-shared-toolbar-btn:hover {
                border-color: var(--tmk-c-search-active-border, var(--tmk-c-search-input-border));
            }
            .tmk-shared-toolbar-btn.tmk-active {
                background: var(--tmk-c-major-focus);
                border-color: var(--tmk-c-major-focus);
                color: var(--tmk-c-lv1-fg);
            }
            .tmk-pnr-field {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 10px;
                min-width: 0;
                max-width: none;
                width: 100%;
                box-sizing: border-box;
            }
            .tmk-pnr-field .tmk-pnr-label {
                margin-top: 0;
            }
            .tmk-pnr-label {
                font-size: 18px;
                font-weight: 600;
                color: var(--tmk-c-major-font);
                display: block;
                flex: 0 0 auto;
                max-width: none;
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
                line-height: 1.3;
            }
            .tmk-pnr-field input, .tmk-pnr-field select, .tmk-pnr-field textarea {
                flex: 1 1 auto;
                min-width: 0;
                min-height: 42px;
                padding: 6px 2px;
                border: 0;
                border-bottom: 2px solid var(--tmk-c-search-input-border);
                border-radius: 0;
                background: transparent;
                color: var(--tmk-c-major-font);
                box-sizing: border-box;
                font-size: 20px;
                outline: none;
            }
            .tmk-pnr-field input::placeholder, .tmk-pnr-field textarea::placeholder {
                color: color-mix(in srgb, var(--tmk-c-minor-focus) 50%, transparent) !important;
            }
            .tmk-pnr-field input:focus, .tmk-pnr-field select:focus, .tmk-pnr-field textarea:focus {
                border-bottom-color: var(--tmk-c-major-focus);
                outline: none;
                box-shadow: none;
            }
            `;
            StyleInjector.inject(doc, 'tmk-shared-form-fields', css);
        },
        text: function(hostInput) {
            if (!hostInput) return null;
            return {
                pull: function() {
                    return String(hostInput.value != null ? hostInput.value : '');
                },
                push: function(value) {
                    hostInput.value = String(value != null ? value : '');
                    hostInput.dispatchEvent(new Event('input', { bubbles: true }));
                    hostInput.dispatchEvent(new Event('change', { bubbles: true }));
                },
                el: hostInput
            };
        }
    };
    const GATE_PENDING_KEY = '__tmkGatePending';
    const SESSION_LOST_QUERY_FLOW = 'tmk-flow-lost-query';
    const SESSION_AHL_FLOW = 'tmk-flow-ahl';
    const MODULE_LOST_QUERY = 'lostQuery';
    const MODULE_AHL = 'ahl';
    const ScriptGate = {
        MODULE_LOST_QUERY: MODULE_LOST_QUERY,
        MODULE_AHL: MODULE_AHL,
        TTL_MS: 180000,
        arm: function(moduleKey) {
            if (!moduleKey) return;
            try {
                if (window.top) window.top[GATE_PENDING_KEY] = { module: String(moduleKey), ts: Date.now() };
            } catch (e) {}
        },
        peekPending: function(moduleKey) {
            try {
                const p = window.top && window.top[GATE_PENDING_KEY];
                if (!p || p.module !== moduleKey) return false;
                if (Date.now() - Number(p.ts || 0) > ScriptGate.TTL_MS) return false;
                return true;
            } catch (e) {
                return false;
            }
        },
        consumePending: function(moduleKey) {
            if (!ScriptGate.peekPending(moduleKey)) return false;
            try {
                if (window.top && window.top[GATE_PENDING_KEY]) delete window.top[GATE_PENDING_KEY];
            } catch (e) {}
            return true;
        },
        lostQueryFlowActive: function() {
            try {
                return sessionStorage.getItem(SESSION_LOST_QUERY_FLOW) === '1';
            } catch (e) {
                return false;
            }
        },
        setLostQueryFlow: function() {
            try {
                sessionStorage.setItem(SESSION_LOST_QUERY_FLOW, '1');
            } catch (e) {}
        },
        ahlFlowActive: function() {
            try {
                return sessionStorage.getItem(SESSION_AHL_FLOW) === '1';
            } catch (e) {
                return false;
            }
        },
        setAhlFlow: function() {
            try {
                sessionStorage.setItem(SESSION_AHL_FLOW, '1');
            } catch (e) {}
        },
        mayRunLostQueryMenu: function() {
            return ScriptGate.peekPending(MODULE_LOST_QUERY);
        },
        mayRunLostQueryStep2: function() {
            return ScriptGate.lostQueryFlowActive();
        },
        mayRunAhl: function() {
            return ScriptGate.peekPending(MODULE_AHL) || ScriptGate.ahlFlowActive();
        },
        finishLostQueryMenuEnter: function() {
            ScriptGate.consumePending(MODULE_LOST_QUERY);
            ScriptGate.setLostQueryFlow();
        },
        finishAhlEnter: function() {
            ScriptGate.consumePending(MODULE_AHL);
            ScriptGate.setAhlFlow();
        },
        moduleKeyFromHref: function(href, linkText) {
            const u = String(href || '');
            if (/newBaggageLostSearch_menuAction/i.test(u)) return MODULE_LOST_QUERY;
            if (/(?:newNull)?BaggageLost_newBaggageLostAction/i.test(u)) return MODULE_AHL;
            const t = String(linkText || '').replace(/\s+/g, '');
            if (/新建少收查询/.test(t)) return MODULE_LOST_QUERY;
            return null;
        }
    };
    function buildToolset() {
        return {
            BASE_Z: BASE_Z,
            DEFAULT_THEME: DEFAULT_THEME,
            DEFAULT_THEME_PACK: DEFAULT_THEME_PACK,
            DEFAULT_Z_LAYERS: DEFAULT_Z_LAYERS,
            zLayerCssVarFromKey: zLayerCssVarFromKey,
            resolveZLayers: resolveZLayers,
            publishZLayers: publishZLayers,
            getSharedZLayers: getSharedZLayers,
            ThemeVarToolset: ThemeVarToolset,
            StartMenuThemeController: StartMenuThemeController,
            StyleInjector: StyleInjector,
            ScriptGate: ScriptGate,
            Deck: Deck,
            Control: Control,
            Button: Button,
            PrimarySubmitButton: PrimarySubmitButton,
            MenuButton: MenuButton,
            SearchButton: SearchButton,
            Tile: Tile,
            MediumTile: MediumTile,
            BigTile: BigTile,
            SmallTile: SmallTile,
            Switch: Switch,
            ViewSwitch: ViewSwitch,
            ChromeStack: ChromeStack,
            Field: Field
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
