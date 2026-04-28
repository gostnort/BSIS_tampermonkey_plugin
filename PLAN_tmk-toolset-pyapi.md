# PLAN：toolset 模块化 + 闸门与子脚本（本分支执行准则）

模块化层级锚定见仓库根目录 **`README.md`**（仅表，无展开）。

本文件约束实现方式，避免实现时习惯性地 **保留旧路径、做多余的兼容层与“防御性设计”**。本 Git 分支专为该计划创建：**不保留旧逻辑**，以完全模块化为准。

与 **`.cursor/skills/ui-overlay-architecture/SKILL.md`** 的关系：宿主页只读、不写回宿主 DOM、Z 索引集中等原则不变；本仓库的具体挂载根、控件名、主题变量以 **本 PLAN 的「分层模型」与 `BCheck_toolset_ui.js` 实现** 为准（ skill 中的示例 id 若与下文冲突，**以下文为准**）。

---

## 抽象分层（编码时应自觉站对层，禁止跨层复制实现）

由下至上，**高层可依赖低层 API，反之不可**。业务脚本只停留在最顶层（L6）。

| 层 | 职责 | 本仓库典型 |
|----|------|------------|
| **L0 宿主** | 只读：取数、探测、不改写节点 | 旧 BCheckWeb 表单/表格 DOM |
| **L1 设计令牌 / 主题** | 颜色与语义键单一真源；运行时 `--tmk-c-*` | `DEFAULT_THEME`（冻结对象）、`ThemeVarToolset`、`StartMenuThemeController.applyThemeCss` → `#tmk-theme-vars`。startmenu 动态主题写入后 **优先于** CSS 中的 `var(--tmk-c-xxx, DEFAULT_THEME.x)` 回退表达式 |
| **L2 层级图式** | `BASE_Z`、`DEFAULT_Z_LAYERS`、`publishZLayers` / `getSharedZLayers` | 禁止业务脚本手写魔法 z-index 数字串 |
| **L3 编排根与 Chrome** | 覆层挂载根、与宿主并排的固定顶栏类控件的几何对齐 | `#tmk-deck`（`Deck.ensure` / `Deck.adopt`）；布局变量如 `--tmk-vsw-top` / `--tmk-vsw-right` 与 startmenu 搜索 FAB 等指标对齐 |
| **L4 原子控件** | 无业务语义：`Control`、`Button`、`Switch` | DOM 仅用 `tmk-*` class；JS 类型名不带 `tmk` |
| **L5 组合控件** | 可复用交互块 + 样式注入入口 | **`ViewSwitch`**（`mount` / `mountForScript`、`SCRIPT_DOM_ID`、`injectStyles`、`injectZRule`）；**`ChromeStack.injectHideWhenClassRule`**（`.tmk-ui-hidden` 组合隐藏，避免业务复制长选择器）；**`Field`**（宿主 input 读写薄封装） |
| **L6 业务脚本** |  orchestrate：闸门、路由、调用 L5 mount | AHL / 少收等：禁止再维护已在 toolset 内的控件 CSS 块或魔法 id 字符串 |

**主题色禁止重复真源**：滑轨、按钮等样式中的 `var(--tmk-c-major-focus, …)` 回退值必须从 **`DEFAULT_THEME`**（经 `ThemeVarToolset.themeColorVarFromKey` 拼出的名）生成，不得在样式字符串里再抄一份十六进制「第二份调色板」。

---

## 命名（再写一遍，防忘）

- 页面里可见的：`id` / `class` / `data-*` 用 `tmk-…` 防撞名。
- JS 类型名**不要**带 `tmk`。
- **基类短、子类长**（例：`Field` → `LostQueryStationField`；`Button` → `LegacyFormSubmitButton`）。
- **不再使用「Toolbar」作为对外控件名**：视图切换条在 toolset 中为 **`ViewSwitch`**（历史文档若写 Toolbar，视为 **ViewSwitch**）。

---

## 控件模块化全流程（每个控件上线前必须按序写清并做到）

缺一即视为「未模块化」或「半拉子」，不得宣称该控件已收敛。

1. **功能契约（先写清）**  
   对外可见行为、状态语义、与宿主页面/双根的边界；文案与交互列表；哪些由控件包掉、哪些留给页面编排。可写在控件文件头注释 + 本 PLAN 控件清单里一行摘要。

2. **函数实现（再拆步骤）**  
   样式一次性注入、DOM 构建、事件、与 Z/主题变量的衔接，拆成具名函数或模块内私有步骤，避免「一大坨 mount」不可读。

3. **类 / 控件对象封装（对外 API）**  
   只暴露必要属性与方法（如 `mount` / `myView` / `dispose`）；内部持有 DOM；**唯一**使用 `tmk-*` 作为 id/class/data；JS 类型名不带 `tmk`。

4. **业务脚本接入（只剩调用）**  
   业务文件只能通过 `resolveToolset().某控件` 的工厂或 `mountFor*` 装配；**禁止**在业务文件里再维护该控件专属的字符串 id、CSS 片段、平行 DOM 模板或与 toolset 重复的样式规则。

---

## 控件「收敛完成」判定（刚性）

满足下列全部条目，才允许在控件清单里把该控件标为 **已收敛**：

- 所有引用该控件的 Tampermonkey 脚本中，**不得**出现该控件专属 **固定 id 字符串**（例如已废弃的 `tmk-*-toolbar`）；若必须区分页面，只能使用 **toolset 内注册的 scriptKey**（如 `ahlPnr`、`lostQueryV2`，见 `ViewSwitch.SCRIPT_DOM_ID`）交给 `ViewSwitch.mountForScript` 等入口解析。  
- **不得**复制该控件已迁入 toolset 的 **CSS 规则块**（含 z-index、`.tmk-sw` 等）；若页面仍需组合选择器（如多个盖层统一加 `.tmk-ui-hidden`），优先用 **`ChromeStack.injectHideWhenClassRule`** 生成规则；选择器里的 id **须**来自 `ViewSwitch.domIdForScript` 或控件返回的 `root.id`，不得手写死 id。  
- **不得**保留「半套」：业务里既调 toolset 又留下旧版 innerHTML / 旧类名。

允许保留的仅限：**Which 控件在本页启用**（对应 scriptKey）、**与本页状态绑定的回调**（如 `onMyViewChange`）、以及 **Deck 容器**等编排参数——且不得与控件内部契约重复定义同一事实。

---

## 控件清单与收敛状态（维护本表）

| 控件 | 契约 / 入口 | 收敛状态 | 备注 |
|------|-------------|----------|------|
| **ViewSwitch**（视图切换） | `ViewSwitch.mount` / `mountForScript`；`SCRIPT_DOM_ID`（`ahlPnr` / `lostQueryV2`）；`injectStyles`、`injectZRule` | 按上文持续推进 | 业务仅用 scriptKey，禁用本地魔法 `tmk-*` id 常量 |
| **ChromeStack** | `injectHideWhenClassRule({ viewSwitchScriptKey, otherElementIds })` | 已集中 | 与 `.tmk-ui-hidden` 配合隐藏现代壳 |
| Deck | `Deck.ensure` / `Deck.adopt` | 部分 | 仅根节点约定；不涉及具体业务控件 |
| ScriptGate | `ScriptGate.*` | 已集中 | 业务只调闸门 API |
| Field | `Field.text` | 迁移中 | 逐页替换手写 value 同步后再标已收敛 |
| 步骤条 / Shell / 毛玻璃等 | 仍随 AHL / 少收页内实现 | **未收敛** | 下一步按本节四步与完成判定迁入 toolset，迁完删净页内重复样式与 DOM 模板 |

---

## 架构决议（已定，除非你有新输入再改）

**双顶层根（可接受）**

- 一层：**新前端 + ViewSwitch**（modern，约定 z 层）。
- 一层：**原版页面**（legacy / 宿主 DOM，**z-index 为 0 或等价“压在底下”**），ViewSwitch 可在「我的视图 / 原版」之间切换。
- 不要求强行压成单一 `#tmk-deck` 若与双根策略冲突；要求的是 **根的数量可数、职责清晰**，禁止无限往 `body` 平级塞节点。

**闸门 + 子脚本**

- Tampermonkey 里：**子脚本仍可安装**，但 **不在未授权时执行初始化**。入口由 **`BCheck_startmenu`**（或约定的 orchestrator）在合适时机：
  - 设置顶层闸门（例如在 `window.top` 上约定的对象/标志），再
  - `postMessage` / 直接调用 `content_frame` 内暴露的 **`init()`**，或让子脚本首部 `if (!gateOpen) return;`。
- 具体全局名、挂载点在实现时统一写在一处（例如 `toolset` 里 `ScriptGate`），**写进代码注释即可**，不必再堆一层“兼容旧全局”。

**已实现：`__tmkUiToolset.Deck`**

- 页面侧根节点 **`#tmk-deck`**（`Deck.ensure(document)`），**AHL、少收查询** 的毛玻璃、视图切换、步骤条、shell、Step2 shell、menu 的 wrap 等均宜挂此根下，不再平铺 `body` 第一层（`Deck.adopt` 负责把已存在节点收进根）。

**已实现：`__tmkUiToolset.ViewSwitch`**（`mount` / `mountForScript(doc, scriptKey, options)`；`domIdForScript(scriptKey)` 与 `SCRIPT_DOM_ID` 为 **id 唯一真源**；控件对象：`myView`、`root`；`onMyViewChange` 仅用户点击触发；轨道色遵循 **L1**：`majorFocus`（我的视图）/ `minorButton`（原版）；布局与 z 规则在 toolset；业务脚本禁止手写魔法 `tmk-*-…` view id）

**已实现：`__tmkUiToolset.Field`**（目前仅 `Field.text(hostInput)` → `pull` / `push`，供后续替换各页手写 value 赋值）

**已实现：`__tmkUiToolset.ScriptGate`**

- `arm(moduleKey)`：磁贴跳转前写入 `window.top.__tmkGatePending`（`startmenu` 里 `armScriptGateFromNavigation` → `moduleKeyFromHref(href, linkText)`）。
- **lostQuery**：菜单页须 `peekPending(lostQuery)`；通过且 `findLegacyControls` 成功后才 `consume` 并 `sessionStorage` 写入 `tmk-flow-lost-query`。Step2 仅凭该 session，不再要求 pending。
- **ahl**：`mayRunAhl` = pending 或已有 `tmk-flow-ahl` session；`mount()` 末尾 `finishAhlEnter`。
- pending **TTL**：180000 ms。

**目标形态**

- 各业务脚本薄到：**一行（一次函数调用）挂载该页的控件树/编排**；排故靠控件边界清晰，**不依赖回滚分支**。
- **不做分阶段“先挪 DOM 再抽类”**；本分支允许一次性重构，用测试拉到稳。

**刻意不做的事**

- 不为“万一旧 DOM 还在”保留双路径——旧路径删干净。
- 不把“稳健”前置成多层 fallback；不稳的地方交给 **后续大量测试** 修到稳。

**日志**

- **删除早期 debug 用的 `console.*`**；需要诊断时临时加，合并前删掉。正式错误若必须上报，以后用单独、可开关的渠道，不默认刷屏。

---

## 已验证事实（MCP / content_frame）

顶栏 frameset 文档无 `tmk-*` 正常。`content_frame` 内 `body` 第一层可见：`tmk-pnr-*` 与 `tmk-fab` / `tmk-overlay` 等 **并列**，曾导致“没人统一管第一层”。重构后应符合上文「双根可数」约定。

探测用（在 `content_frame.contentDocument` 执行）：

```javascript
() => Array.from(document.body.children).map((n) => ({ tag: n.tagName, id: n.id || null }))
```

---

## 进度标尺（相对「toolset 管结构+交互+状态」）

以 **控件清单与收敛状态** 表为准：每迁完一个控件，同步更新表与业务侧删除的本地配置；禁止「toolset 里有一份、业务 CSS 再 copy 一段」。

---

## 备注

内页必须从 `content_frame` 取 `document`；顶栏登录页看不出业务 DOM。
