# dsh-deepsleep-progress

> 仓库：https://github.com/xyzYaeMiko/dsh-deepsleep-progress ｜ npm：`dsh-deepsleep-progress`（待发布）


DSH Web 插件：给「会阻塞等待」的工具调用在对话流里加一条 `elapsed / budget` 进度条。
进度条挂在对应工具卡**正下方**（同一 Chat 流内的独立一行），工具返回后自动收起。

- 后端没有进度通道（`defineTool()` 只有一次性的 `execute()`），因此进度条表示的是
  **本地已等时长 ÷ 超时预算**，不是真实完成度。
- 时间基准来自会话日志：`tool/call` 事件的 `time`（epoch ms），不是插件加载时刻。
- 预算来源（优先级从高到低，`inferSleepBudget` 默认开启）：
  1. 命令里字面 `sleep N` / `Start-Sleep …` 的时长（bash 与 pwsh；多个累加；
     `echo "sleep 5"` 这种不作为命中）；
  2. 调用参数里的 `timeout_ms` / `timeoutMs` / `timeout`（毫秒；比 sleep 更小则作为封顶）；
  3. `config.tools[工具名]` 里配置的预算；
  4. 都不存在 → 预算未知（不画进度条，只保留左侧图片 + 文字）。
- 完成判定：`tool/result` 事件到达 → 该行隐藏（`tool/result` 之前会一直显示）。
- 三态：**进行中**（蓝色填充，随 elapsed/预算前进）、**超额**（填充到 100% 转橙）、
  **预算未知**（不画进度条，只保留左侧的图片与文字 `8.0s / —`）。

## 工具白名单与默认预算

| 工具 | 默认预算 | 说明 |
|---|---|---|
| `wait_agent` | 30000 | 工具默认 `timeout_ms: 30000` |
| `job_output` | 60000 | 估算值（`waitDefault`/`waitCap` 前端不可见）；显式传 `timeout_ms` 时以参数为准 |
| `bash` | `null`（不确定） | 命令是字面 `sleep N` 时按 N 走满（可关）；否则只有显式传 `timeoutMs` 才显示确定进度 |
| `ask_user_question` | `null`（不确定） | 隐式无限等待 |

不在 `tools` 里的工具永远不显示进度条。`wait_agent` 在没有活跃 teammate 时会
立即返回 `noProgress`，这时进度条可能来不及出现——这是正常现象
（`showDelayMs` 默认 350ms，短调用不会闪一下）。

## 自定义样式（Config）

样式全部来自插件 Config，用户在 **profile 的 `cordis.patch.yml`** 里覆盖同一行 id
即可。补丁会整体替换该行的 `config`；**没写的键回落到插件内置默认值**，所以可以只写
想改的键：

```yaml
- id: deepsleep-progress           # 覆盖 bundle 里插入的同一行
  config:
    # 白名单 + 预算（毫秒；null = 预算未知，显示流动条）
    tools:
      wait_agent: 120000
      job_output: 90000
      bash: 600000        # Linux/macOS
      pwsh: 600000        # Windows
      ask_user_question: null
    # 外观
    accent: 'rgb(77, 107, 254)'        # 填充色（设置页用取色器/ RGB / 十六进制编辑）
    overrunAccent: 'rgb(240, 169, 58)'  # 超出预算的填充色
    track: 'rgba(148, 158, 190, 0.22)'  # 轨道底色
    height: 4                 # 轨道高度 px
    radius: 2                 # 圆角 px
    inset: 22                 # 距左缩进 px（与工具卡内容对齐）
    gapTop: 2                 # 与工具卡的间距 px
    gapBottom: 6              # 与下一行的间距 px
    fontSize: 11              # 文字大小 px
    labelColor: 'var(--dsw-alias-label-tertiary)'
    clockColor: 'var(--dsw-alias-label-tertiary)'
    # 文案与时钟
    label: deepsleeping       # 前置标签（默认 deepsleeping）；显式空字符串 '' 可隐藏标签
    # 末端图片（跟随进度条移动，支持 GIF/APNG 动图）
    # headImage: 'https://example.com/head.gif'   # 或 data URI；'' 关闭；默认内置测试图
    headSize: 18              # 图片边长 px（轨道与行高会跟着变）
    clockFormat: '{elapsed} / {budget}'   # 支持 {elapsed} {budget} {remaining} {ratio}
    unknownBudgetText: '—'    # 预算未知时占位
    # 行为
    enabled: true
    inferSleepBudget: true    # 命令含字面 sleep N 时按 N 秒走满（启发式）
    showDelayMs: 350          # 调用开始后多久才出现（防止短调用闪烁）
    tickMs: 100               # 走字间隔
```

> Config 通过 Web 首页的 index 注入传到浏览器（`window.__WAIT_PROGRESS_CONFIG__`）。
> **首次安装**后插件立即生效（HMR）；**之后修改 Config 需要刷新页面**才能读到新值。
> 容器与文字默认只用 `--dsw-alias-*` 主题 token，颜色字面值属于插件 artwork 范畴。

## 末端图片（可跟随移动，支持动图）

进度条填充的最前沿会挂一个图片，随进度一起移动（像浮标/小人骑在进度头上）：

- **默认**：内置一张透明背景的「睡觉鲸鱼 + zzz」图（96px，data URI 内嵌在 `client.js`，无需联网）。
- **换成自己的图**：`headImage` 填 http(s) URL 或 data URI；GIF / APNG / WebP 会自己动。
  - 外链示例：`headImage: 'https://example.com/head.gif'`（页面无 CSP 限制，外链需网络可达）。
  - 本地 GIF 用 data URI（推荐，离线可用、无外链依赖）：

    ```bash
    # Linux
    base64 -w0 head.gif        # 把输出接在 data:image/gif;base64, 后面
    # macOS
    base64 -i head.gif
    ```

    ```yaml
    - id: deepsleep-progress
      config:
        headImage: 'data:image/gif;base64,R0lGODlh...'
    ```

    大 GIF 会让 profile 的 `cordis.patch.yml` 变大、每帧解码也有开销，建议 ≤ 200KB、边长 ≤ 128px。
- **位置**：图片中心对准填充前沿，并在轨道内做 clamp，半张图不会溢出轨道两端。
- **未知预算**：不画进度条，图片和文字（`elapsed / —`）停在左侧，只走时钟。
- **关闭**：`headImage: ''`（行高会回落到 14px）。
- **替换默认图**：把 `plugin/assets/head-default.png` 换掉并重新生成 data URI 贴到
  `client.js` 的 `DEFAULT_HEAD_IMAGE`，或直接在 profile 的 patch 里用 `headImage` 覆盖（更简单）。

## 图形化设置页

DSH **设置 → 等待进度条**（英文界面：Settings → Wait progress）是本插件贡献的独立设置页，
改动**立即生效**（聊天里正在显示的进度条会同步变），并带实时预览。

页面能力：

- **通用**：总开关、前置文案、时钟格式（`{elapsed} {budget} {remaining} {ratio}`）、
  工具白名单与预算（每行 `工具名: 毫秒` 或 `工具名: unknown`）。
- **末端图片**：开/关、用内置图、恢复默认图、**从本机选择图片（PNG/GIF/WebP，GIF 会动）**、
  填 URL 或 data URI、大小、未知预算时浮动与单程时长。
- **尺寸与间距**：轨道高度、圆角、左缩进、上下间距、文字大小。
- **颜色与背景**：填充、超额填充、轨道底色、文案颜色、时钟颜色。每个颜色有**系统取色器色块 + RGB 输入框**（`rgb(…)` / `#rrggbb` 都可；清空恢复默认）。
- **时序**：出现延迟、走字间隔。
- **清空本机覆盖**：一键回到插件 Config 的默认值。

持久化约定（重要）：

- 页面改动存在**当前浏览器**的 `localStorage`（键 `wait-progress:settings:v1`），作为插件
  Config 的**本机覆盖**；`cordis.patch.yml` 里的 Config 仍然是默认值，两者叠加时本机覆盖优先。
- 因此设置不会跨浏览器/跨设备同步；换机器或清浏览器数据后会回到 Config 默认值。
- 图片用 data URI 存在本地存储里，单张限制 2 MB；超限会提示且不保存。
- UI 只写本地覆盖，不改 profile 文件、不写会话事件。


## 安装

发布到 npm 后（市场收录后可在插件市场一键安装）：

```js
plugin_manager({ action: 'install_bundle', target: 'dsh-deepsleep-progress@0.1.0' })
```

本地开发（把包目录直接链进 profile）：

```js
plugin_manager({
  action: 'install_bundle',
  target: '/absolute/path/to/this/repo',   # 本仓库根目录（含 package.json）
})
```

> 市场（dshmarket）只允许安装精选索引 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
> 里列出的来源；未收录前可用上面的本地目录方式安装。

看返回的 `application`：`applied` 即已生效（HMR），`restart-required` 才需要重启。

## 实现要点（合规性）

- 挂载点：`conversation.chat.node`（keyed slot，key = `wait-progress`）+ 用
  `ctx.uiConversation.events.register()` 注册同名 `kind` 的 Conversation Definition。
  `ChatNodeDataMap` 是 Harness 明确公开的 merge 扩展面，Chat 层自己负责行位置、分页与
  增量装配。
- 不写组件外的 DOM、不 append 到 `document.body`、不读别的插件 DOM、不 require
  Harness Client 包；只 `require('react')`。
- 计时器全部在组件内用 `useEffect` 创建/清理；Definition 注册用 `ctx.effect()` 绑定
  插件生命周期。
- 数据只从会话事件派生，不追加任何会话事件、不写存储。

## 已知限制

- 进度 = 已等待 / 预算，不是真实完成度。
- `job_output` 的默认等待上限前端不可见，60s 是估算。
- 首次安装后如果页面已打开，Config 的 global 要等下一次刷新才注入；插件本身仍会以
  内置默认值立即渲染。
- 未做自动化浏览器截图（Web GUI 需要 token，外部脚本拿不到）；视觉需在页面上人工确认。
