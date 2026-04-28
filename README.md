# 模块化层级

启用顺序：先 `BCheck_toolset_ui.js`，再依赖它的脚本（如 `BCheck_startmenu.js`）；列表靠上的先执行。不要用远程 `@require` 拉工具集，避免 GitHub 故障时菜单脚本整块失效；主题包 `DEFAULT_THEME_PACK` 只在工具集定义。

| 层 | 职责 | 本仓库典型 |
|----|------|------------|
| L0 宿主 | 只读：取数、探测、不改写节点 | 旧 BCheckWeb 表单/表格 DOM |
| L1 设计令牌 / 主题 | 颜色与语义键单一真源；运行时 `--tmk-c-*` | `DEFAULT_THEME`、`ThemeVarToolset`、`#tmk-theme-vars` |
| L2 层级图式 | `BASE_Z`、`DEFAULT_Z_LAYERS`、`publishZLayers` / `getSharedZLayers` | 禁止业务脚本手写魔法 z-index |
| L3 编排根与 Chrome | 覆层挂载根、固定顶栏类控件几何对齐 | `#tmk-deck`、`Deck.ensure` / `Deck.adopt`、`--tmk-vsw-top` / `--tmk-vsw-right` |
| L4 原子控件 | 无业务语义 | `Control`、`Button`、`Switch`；DOM 用 `tmk-*`，JS 类型名不带 `tmk` |
| L5 组合控件 | 可复用交互块 + 样式注入 | `ViewSwitch`、`ChromeStack.injectHideWhenClassRule`、`Field` |
| L6 业务脚本 | 编排：闸门、路由、调用 L5 | AHL、少收等 |

## Button 族（模块化实例）

**原则：不做过渡、不保留与旧实现兼容；新代码直接按本族落位。**

**基类 `Button`（L4）** 统一三件事：与 DOM 的**绑定**、**样式注入**（含一次注入与主题变量衔接）、**事件触发**；并提供默认可用样式：随容器宽度、随视口竖向、随 `majorFocus` 等主题色；可设**透明背景**、可设**固定坐标**（与 ViewSwitch 同类顶栏定位方式）。

**派生**

- `MenuButton`：原 fab 定名；继承 `Button`。
- `SearchButton`：继承 `Button`。
- `Tile`：继承 `Button`；完成**基本正方形**构型，并承载**与宿主页面的绑定**抽象（具体业务在 L6 填回调）。
- `BigTile` / `MediumTile` / `SmallTile`：继承 `Tile`；各自风格化（尺寸与 class 组合）。

业务脚本只装配子类与回调，不在页内重复维护与 Button 族已迁入 toolset 的 CSS 块或平行 DOM 模板。
