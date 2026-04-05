---
name: LAX新建少收卡片化改造
overview: 新增一个用于“新建少收查询/step2+step3”的 Tampermonkey 脚本，复用现有 tile 尺寸逻辑并改为圆角标签卡片视图，且保留原页面按钮与表单提交链路。并在 BCheckWeb_UI 入口处联动该脚本加载后的页面行为。
todos:
  - id: mount-detection
    content: 实现 step2/step3 页面识别、挂载生命周期与重绘监听
    status: completed
  - id: card-render-step2
    content: 实现左大右小圆角卡片布局、颜色策略、hover详情浮层
    status: completed
  - id: state-sync
    content: 实现卡片与原 checkbox/radio 双向同步及 LAX 默认策略
    status: completed
  - id: step3-migration
    content: 迁移旧脚本中的快捷填充与按钮代理能力到新脚本
    status: completed
  - id: ui-linkage
    content: 在 BCheckWeb_UI 中增加“新建少收查询”联动钩子并完成联调
    status: completed
  - id: validation
    content: 按关键场景执行验收并记录可回退点
    status: completed
isProject: false
---

# LAX 新建少收卡片化替换计划

## 目标

将当前“表格 + 复选框/radio”的旧视图替换为“左大右小圆角卡片”交互，同时保留原系统真实输入控件与按钮提交逻辑（零后端改动风险）。

## 变更范围

- 新增脚本：`[/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb 新建少收查询-1.0.user.js](/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb 新建少收查询-1.0.user.js)`
- 联动入口：`[/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb_UI.js](/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb_UI.js)`
- 兼容继承：`[/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb 按钮悬浮-2.8.user.js](/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb 按钮悬浮-2.8.user.js)`

## 实现步骤

1. 页面识别与挂载

- 在新脚本中实现 `top/content_frame` 双环境检测（沿用现有脚本的 `inTopWindow/inContentFrame` 模式）。
- 仅在“新建少收查询结果页 + step3录入页”挂载对应模块，避免干扰其它业务页面。
- 使用 `MutationObserver + 低频兜底轮询`，处理旧页面局部重绘。

1. 卡片视图渲染（step2 结果页）

- 复用 `[BCheckWeb_UI.js](/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb_UI.js)` 的尺寸计算思路（`calcUiMetrics`）确定大/小卡片尺寸。
- 结构：左侧大卡片（旅客信息），右侧小卡片网格（每个“行李牌 + 目的地”）。
- 视觉规则：
  - 大卡片默认可选，支持取消；悬停 1 秒显示详情浮层。
  - 小卡片支持多选；未选中保留轻微阴影与微动效。
  - `目的地 != LAX`：默认灰色、默认不选。
  - `航节含LAX`：大卡浅绿，小卡深绿；`航节不含LAX`：大卡浅黄，小卡深黄。

1. 选择同步与业务控件映射

- 卡片与原页面 checkbox/radio 建立双向同步：
  - 点卡片 -> 改原控件并触发 `input/change/click`。
  - 原控件变化 -> 回写卡片状态。
- 已确认行为：大卡取消选中时，保留小卡当前选择（`keep-small`）。
- `选取作为详情数据` 的 radio：初次按 LAX 规则预选；用户改选后以用户为准。

1. 旅客信息标题与级别高亮

- 大卡标题字段固定展示：`旅客姓名 / 性别 / 证件号 / 常旅客卡号-级别`。
- 当级别不为 `B/S`：采用橙色警示描边 + 角标“非B/S”（你已确认的样式）。

1. 继承 step3 快捷填充与按钮链路

- 将 `[BCheckWeb 按钮悬浮-2.8.user.js](/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb 按钮悬浮-2.8.user.js)` 中 step3 必需能力迁移到新脚本：
  - 快捷填充（CT/PA/家庭电话/CP）
  - 完成前校验与自动计算 NW
  - `完成/清空/下一步/返回/新建/查询` 等原按钮代理点击
- 保留原按钮为真实提交源，新 UI 仅做交互壳层。

1. 与主菜单联动

- 在 `[BCheckWeb_UI.js](/home/gostnort/Documents/github/BSIS_tampermonkey_plugin/BCheckWeb_UI.js)` 中保持“新建少收查询”入口不变，只增加兼容钩子（事件或状态标记），使新脚本在目标页面稳定接管渲染。

1. 回退与验收

- 首版采用“非破坏替换”：原表格只隐藏不删除，便于快速回退。
- 验收用例：
  - 单旅客单行李、单旅客多行李、多航节（含/不含 LAX）、目的地混合（LAX/非LAX）
  - 手动切换 radio + 多选小卡 + step3 完成提交
  - 页面跳转“新建/返回/下一步”后的状态一致性

