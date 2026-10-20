/**
 * Wait-progress browser half.
 *
 * Adds one Chat renderer kind (`wait-progress`) through the Conversation
 * extension point the Harness documents for plugin-owned Chat rows: an event
 * Definition registered with `ctx.uiConversation.events.register()` plus its
 * view in the `conversation.chat.node` slot. The Chat layer owns row placement,
 * paging and incremental assembly; this module owns only the bar itself.
 *
 * Data source: the session log. `tool/call` supplies the tool name, the raw
 * argument JSON and the call start time (`event.time`); `tool/result` retires
 * the row. There is no backend progress channel, so the bar is always
 * "elapsed local time / budget"; with no budget at all it degrades to a quiet
 * row (picture + text, no track) instead.
 * no budget is known.
 *
 * Config: the Host half publishes the row config as
 * `window.__WAIT_PROGRESS_CONFIG__`; absent that global the defaults below
 * apply. No Harness Client package is imported and no DOM outside this
 * component is touched.
 */

window.__ModuleLoader__.load({
  id: 'dsh-deepsleep-progress',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Chat renderer kind; also the `conversation.chat.node` key and node data tag. */
    const KIND = 'wait-progress';
    const GLOBAL_NAME = '__WAIT_PROGRESS_CONFIG__';

    const DEFAULT_TOOLS = {
      wait_agent: 30000,
      job_output: 60000,
      ask_user_question: null,
      // Shell tools by platform: bash on Linux/macOS, pwsh on Windows.
      // The two aliases are defensive for older or third-party Windows builds.
      bash: null,
      pwsh: null,
      powershell: null,
      cmd: null,
    };

    /** Default head picture riding the leading edge: the bundled sleeping whale (96 px RGBA data URI). */
    const DEFAULT_HEAD_IMAGE = 'data:image/png;base64,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';

    const DEFAULT_CONFIG = {
      enabled: true,
      showDelayMs: 350,
      tickMs: 100,
      tools: DEFAULT_TOOLS,
      label: 'deepsleeping',
      inferSleepBudget: true,
      headImage: DEFAULT_HEAD_IMAGE,
      headSize: 18,
      clockFormat: '{elapsed} / {budget}',
      unknownBudgetText: '—',
      height: 3,
      radius: 2,
      inset: 22,
      gapTop: 2,
      gapBottom: 6,
      fontSize: 11,
      track: 'rgba(148, 158, 190, 0.22)',
      accent: 'rgb(77, 107, 254)',
      overrunAccent: 'rgb(240, 169, 58)',
      labelColor: 'rgb(138, 143, 153)',
      clockColor: 'rgb(138, 143, 153)',
    };

    const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

    function numberOr(value, fallback, min, max) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
      return Math.min(max, Math.max(min, value));
    }

    /** The pre-RGB default color values; a stored/patched legacy value maps to the new default. */
    const LEGACY_COLORS = {
      accent: 'linear-gradient(90deg, #6f86ff, var(--dsw-alias-brand-primary, #4d6bfe))',
      overrunAccent: 'linear-gradient(90deg, #f0a93a, #d98324)',
      track: 'color-mix(in srgb, var(--dsw-alias-border-l1, #e8e8ef) 70%, transparent)',
      labelColor: 'var(--dsw-alias-label-tertiary, #9a9aa6)',
      clockColor: 'var(--dsw-alias-label-tertiary, #9a9aa6)',
    };

    function colorOr(value, fallback, legacy) {
      if (typeof value !== 'string' || value.length === 0) return fallback;
      if (legacy !== undefined && value === legacy) return fallback;
      return value;
    }

    function stringOr(value, fallback) {
      return typeof value === 'string' && value.length > 0 ? value : fallback;
    }

    /**
     * Whitelist normalized into `tool name -> budget ms | null`.
     * The cross-platform defaults stay enabled unless the config overrides them:
     * a positive number sets a budget, `null`/`0`/`true` means "budget unknown",
     * `false` removes a default entry, and an unseen name is added.
     */
    function normalizeTools(value) {
      const tools = {};
      for (const toolName of Object.keys(DEFAULT_TOOLS)) tools[toolName] = DEFAULT_TOOLS[toolName];
      const source = isRecord(value) ? value : {};
      for (const toolName of Object.keys(source)) {
        const budget = source[toolName];
        if (budget === false) {
          delete tools[toolName];
          continue;
        }
        if (typeof budget === 'number' && Number.isFinite(budget) && budget > 0) tools[toolName] = budget;
        else if (budget === null || budget === 0 || budget === true) tools[toolName] = null;
        // negative / malformed values are ignored: defaults survive, unknown names are not added.
      }
      return tools;
    }

    function normalize(input) {
      const source = isRecord(input) ? input : {};
      return {
        enabled: source.enabled === undefined ? DEFAULT_CONFIG.enabled : source.enabled !== false,
        showDelayMs: numberOr(source.showDelayMs, DEFAULT_CONFIG.showDelayMs, 0, 10000),
        tickMs: numberOr(source.tickMs, DEFAULT_CONFIG.tickMs, 50, 2000),
        tools: normalizeTools(source.tools),
        label: source.label === undefined ? DEFAULT_CONFIG.label : typeof source.label === 'string' ? source.label : DEFAULT_CONFIG.label,
        inferSleepBudget: source.inferSleepBudget === undefined ? DEFAULT_CONFIG.inferSleepBudget : source.inferSleepBudget !== false,
        // An empty string is meaningful here: it turns the head picture off, so
        // only `undefined` falls back to the bundled default.
        headImage: source.headImage === undefined ? DEFAULT_CONFIG.headImage : typeof source.headImage === 'string' ? source.headImage : DEFAULT_CONFIG.headImage,
        headSize: numberOr(source.headSize, DEFAULT_CONFIG.headSize, 0, 48),
        clockFormat: stringOr(source.clockFormat, DEFAULT_CONFIG.clockFormat),
        unknownBudgetText: stringOr(source.unknownBudgetText, DEFAULT_CONFIG.unknownBudgetText),
        height: numberOr(source.height, DEFAULT_CONFIG.height, 1, 24),
        radius: numberOr(source.radius, DEFAULT_CONFIG.radius, 0, 24),
        inset: numberOr(source.inset, DEFAULT_CONFIG.inset, 0, 400),
        gapTop: numberOr(source.gapTop, DEFAULT_CONFIG.gapTop, 0, 64),
        gapBottom: numberOr(source.gapBottom, DEFAULT_CONFIG.gapBottom, 0, 64),
        fontSize: numberOr(source.fontSize, DEFAULT_CONFIG.fontSize, 8, 24),
        track: colorOr(source.track, DEFAULT_CONFIG.track, LEGACY_COLORS.track),
        accent: colorOr(source.accent, DEFAULT_CONFIG.accent, LEGACY_COLORS.accent),
        overrunAccent: colorOr(source.overrunAccent, DEFAULT_CONFIG.overrunAccent, LEGACY_COLORS.overrunAccent),
        labelColor: colorOr(source.labelColor, DEFAULT_CONFIG.labelColor, LEGACY_COLORS.labelColor),
        clockColor: colorOr(source.clockColor, DEFAULT_CONFIG.clockColor, LEGACY_COLORS.clockColor),
      };
    }


    /** Parse the model-produced argument JSON and read an explicit timeout only. */
    function budgetFromArguments(rawArguments) {
      if (typeof rawArguments !== 'string' || rawArguments.length === 0) return null;
      let args;
      try {
        args = JSON.parse(rawArguments);
      } catch {
        return null;
      }
      if (!isRecord(args)) return null;
      const candidates = [args.timeout_ms, args.timeoutMs, args.timeout];
      for (const candidate of candidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) return candidate;
      }
      return null;
    }

    /**
     * Heuristic expected duration for a shell command that literally sleeps.
     * Only a `sleep N` in command position counts (after `^`, `;`, `&&`, `||`,
     * `|`, `(`, newline, `then` or `do`), so `echo "sleep 5"` does not match.
     * Several literal sleeps accumulate. Anything implausible is ignored.
     * @param rawArguments - the tool call's raw arguments JSON string.
     * @returns expected milliseconds, or null when the command is not a literal sleep.
     */
    function sleepBudgetFromCommand(rawArguments) {
      if (typeof rawArguments !== 'string' || rawArguments.length === 0) return null;
      let args;
      try {
        args = JSON.parse(rawArguments);
      } catch {
        return null;
      }
      if (!isRecord(args) || typeof args.command !== 'string') return null;
      const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      // Unix `sleep N[unit]` and PowerShell `Start-Sleep [-Seconds|-Milliseconds] N`
      // (plus the `sleep` alias). Only command-position occurrences count.
      const switchUnits = {
        seconds: 1000,
        second: 1000,
        milliseconds: 1,
        millisecond: 1,
        s: 1000,
        m: 1,
      };
      const pattern =
        /(?:^|[;&|(\n]|\bthen\b|\bdo\b)\s*(start-sleep|sleep)\s+(?:-(seconds?|milliseconds?|s|m)\s+)?([0-9]+(?:\.[0-9]+)?)\s*([smhd]?)(?=[\s;&|)\n]|$)/gi;
      let total = 0;
      let found = false;
      let match;
      while ((match = pattern.exec(args.command)) !== null) {
        const amount = Number(match[3]);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const switchUnit = match[2] === undefined ? null : match[2].toLowerCase();
        const suffix = (match[4] || '').toLowerCase();
        const unitMs =
          switchUnit !== null
            ? switchUnits[switchUnit] === undefined
              ? 1000
              : switchUnits[switchUnit]
            : units[suffix] === undefined
              ? 1000
              : units[suffix];
        const ms = amount * unitMs;
        if (!Number.isFinite(ms) || ms <= 0) continue;
        total += ms;
        found = true;
        if (total > 6 * 3600000) return null;
      }
      if (!found || total < 50) return null;
      return total;
    }

    function formatDuration(ms) {
      const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
      const seconds = safe / 1000;
      if (seconds < 10) return seconds.toFixed(1) + 's';
      return Math.round(seconds) + 's';
    }

    function formatClock(elapsedMs, budgetMs, config) {
      const hasBudget = typeof budgetMs === 'number' && budgetMs > 0;
      const values = {
        elapsed: formatDuration(elapsedMs),
        budget: hasBudget ? formatDuration(budgetMs) : config.unknownBudgetText,
        remaining: hasBudget ? formatDuration(Math.max(0, budgetMs - elapsedMs)) : config.unknownBudgetText,
        ratio: hasBudget ? Math.round(Math.min(1, elapsedMs / budgetMs) * 100) + '%' : config.unknownBudgetText,
      };
      return config.clockFormat.replace(/\{(elapsed|budget|remaining|ratio)\}/g, (whole, token) => values[token]);
    }

    // ── local settings store ────────────────────────────────────────────────
    // The plugin Config (Host row config from cordis.patch.yml) stays the
    // default. Overrides made in the graphical settings page live in this
    // browser's localStorage and are merged over the Config; clearing them
    // returns to the Config. Nothing here writes session data or Host state.

    const STORAGE_KEY = 'wait-progress:settings:v1';
    const KNOWN_KEYS = new Set(Object.keys(DEFAULT_CONFIG));

    function readOverrides() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (typeof raw !== 'string' || raw === '') return {};
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) return {};
        const overrides = {};
        for (const key of Object.keys(parsed)) {
          if (!KNOWN_KEYS.has(key)) continue;
          if (parsed[key] === undefined) continue;
          overrides[key] = parsed[key];
        }
        return overrides;
      } catch {
        return {};
      }
    }

    function writeOverrides(overrides) {
      try {
        if (Object.keys(overrides).length === 0) window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
        return true;
      } catch {
        return false;
      }
    }

    function mergeRaw(base, overrides) {
      const merged = { ...base };
      for (const key of Object.keys(overrides)) merged[key] = overrides[key];
      return merged;
    }

    function createSettingsStore(baseRaw) {
      let overrides = readOverrides();
      let snapshot = normalize(mergeRaw(baseRaw, overrides));
      const listeners = new Set();
      const publish = () => {
        snapshot = normalize(mergeRaw(baseRaw, overrides));
        for (const listener of Array.from(listeners)) {
          try {
            listener();
          } catch {
            /* a subscriber must not break the rest of the page */
          }
        }
      };
      const commit = (next) => {
        overrides = next;
        const saved = writeOverrides(overrides);
        publish();
        return saved;
      };
      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot() {
          return snapshot;
        },
        getDefaults() {
          return normalize(baseRaw);
        },
        getOverrides() {
          return { ...overrides };
        },
        set(patch) {
          const next = { ...overrides };
          for (const key of Object.keys(patch)) {
            if (patch[key] === undefined) delete next[key];
            else next[key] = patch[key];
          }
          return commit(next);
        },
        resetKey(key) {
          const next = { ...overrides };
          delete next[key];
          return commit(next);
        },
        reset() {
          return commit({});
        },
      };
    }

    function serializeTools(tools) {
      return Object.keys(tools)
        .sort()
        .map((name) => name + ': ' + (tools[name] === null ? 'unknown' : String(tools[name])))
        .join('\n');
    }

    function parseToolsText(text) {
      const tools = {};
      const lines = String(text).split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (line === '' || line.startsWith('#')) continue;
        const match = /^([A-Za-z0-9_.-]+)\s*(?::\s*(.*))?$/.exec(line);
        if (match === null) return { error: lines[index].trim() };
        const name = match[1];
        const raw = (match[2] === undefined ? '' : match[2]).trim().toLowerCase();
        if (raw === '' || raw === 'unknown' || raw === 'null' || raw === '?' || raw === '-') {
          tools[name] = null;
          continue;
        }
        if (!/^[0-9]+(?:\.[0-9]+)?$/.test(raw)) return { error: lines[index].trim() };
        const budget = Number(raw);
        if (!Number.isFinite(budget) || budget <= 0) return { error: lines[index].trim() };
        tools[name] = budget;
      }
      return { tools };
    }

    // ── settings page copy (own dictionary, resolved through ctx.locale) ────
    const MESSAGES = {
      en: {
        nav: 'Wait progress',
        title: 'Wait progress bars',
        subtitle: 'An elapsed/budget bar under blocking tool calls. Changes here apply immediately and are stored in this browser as local overrides; the plugin Config stays the default.',
        preview: 'Preview',
        groupGeneral: 'General',
        groupGeneralDesc: 'Turn the feature off, rename the leading label, or choose how the clock reads.',
        enabled: 'Show progress bars',
        inferSleepBudget: 'Estimate from a literal sleep command',
        inferSleepBudgetHint: 'A bash command starting with `sleep N` fills the bar over N; a smaller timeout still caps it.',
        enabledHint: 'Off hides every bar, including running ones.',
        label: 'Leading label',
        labelHint: "An empty string hides the label.",
        clockFormat: 'Clock format',
        clockFormatHint: 'Tokens: {elapsed} {budget} {remaining} {ratio}',
        tools: 'Watched tools and budgets',
        toolsHint: 'One tool per line: name: budget-ms, or name: unknown. The defaults cover bash (Linux/macOS) and pwsh (Windows); remove a line to disable that tool.',
        applyTools: 'Apply tool list',
        toolsInvalid: 'Not a valid line: {line}. Use "name: 30000" or "name: unknown".',
        groupHead: 'Head picture',
        groupHeadDesc: 'A picture riding the leading edge of the fill. Animated GIF/WebP images play.',
        headEnabled: 'Show head picture',
        headDefault: 'Use bundled picture',
        headOff: 'No picture',
        headPick: 'Choose image…',
        headUrl: 'Image URL or data URI',
        headUrlApply: 'Use URL',
        headSize: 'Head size',
        groupSize: 'Size and spacing',
        height: 'Track height',
        radius: 'Corner radius',
        inset: 'Left inset',
        gapTop: 'Gap above',
        gapBottom: 'Gap below',
        fontSize: 'Label/clock size',
        groupColor: 'Colors and backgrounds',
        groupColorDesc: 'Click the swatch for the system picker, or type rgb(…) / #rrggbb. Leave empty to reset the default.',
        accent: 'Fill',
        overrunAccent: 'Over-budget fill',
        track: 'Track',
        labelColor: 'Label color',
        clockColor: 'Clock color',
        resetKey: 'Reset',
        groupTiming: 'Timing',
        showDelayMs: 'Show delay',
        tickMs: 'Tick interval',
        resetAll: 'Reset all local overrides',
        overrides: '{count} local override(s) active',
        noOverrides: 'No local overrides; values come from the plugin Config.',
        saveFailed: 'This browser refused to store the change; it applies to this page only.',
        imageTooLarge: 'That image is too large to keep in browser storage (limit 2 MB).',
        imageReadFailed: 'Could not read that image file.',
      },
      zh: {
        nav: '等待进度条',
        title: '等待型工具进度条',
        subtitle: '阻塞型工具调用下方的「已等待 / 预算」进度条。此页修改立即生效，并保存在当前浏览器的本机覆盖里；插件 Config 仍是默认值。',
        preview: '预览',
        groupGeneral: '通用',
        groupGeneralDesc: '总开关、前置文案与时钟格式。',
        enabled: '显示进度条',
        inferSleepBudget: '按 sleep 命令估算时长',
        inferSleepBudgetHint: 'bash 命令里字面 `sleep N` 会让进度条在 N 秒内走满；更小的 timeout 仍会封顶。',
        enabledHint: '关闭后不渲染任何进度条（包括正在运行的）。',
        label: '前置文案',
        labelHint: '填空字符串可隐藏文案。',
        clockFormat: '时钟格式',
        clockFormatHint: '可用 {elapsed} {budget} {remaining} {ratio}',
        tools: '监控的工具与预算',
        toolsHint: '每行一个：工具名: 预算毫秒，或 工具名: unknown。默认已含 bash（Linux/macOS）与 pwsh（Windows）；删掉某行即禁用该工具。',
        applyTools: '应用工具列表',
        toolsInvalid: '无法识别这一行：{line}。请写成「工具名: 30000」或「工具名: unknown」。',
        groupHead: '末端图片',
        groupHeadDesc: '挂在填充前沿、随进度移动的图片；GIF/WebP 动图会自动播放。',
        headEnabled: '显示末端图片',
        headDefault: '使用内置图片',
        headOff: '不显示图片',
        headPick: '选择图片…',
        headUrl: '图片 URL 或 data URI',
        headUrlApply: '使用该 URL',
        headSize: '图片大小',
        groupSize: '尺寸与间距',
        height: '轨道高度',
        radius: '圆角',
        inset: '左侧缩进',
        gapTop: '上方间距',
        gapBottom: '下方间距',
        fontSize: '文字大小',
        groupColor: '颜色与背景',
        groupColorDesc: '点色块用系统取色器，或直接输入 rgb(…) / #rrggbb；留空即恢复默认。',
        accent: '填充色',
        overrunAccent: '超额填充色',
        track: '轨道底色',
        labelColor: '前置文案颜色',
        clockColor: '时钟颜色',
        resetKey: '恢复默认',
        groupTiming: '时序',
        showDelayMs: '出现延迟',
        tickMs: '走字间隔',
        resetAll: '清空本机覆盖',
        overrides: '当前有 {count} 项本机覆盖',
        noOverrides: '没有本机覆盖，全部使用插件 Config 的默认值。',
        saveFailed: '浏览器拒绝保存该设置，本次仅对当前页面生效。',
        imageTooLarge: '图片太大，无法存入浏览器本地存储（上限 2 MB）。',
        imageReadFailed: '读取图片文件失败。',
      },
    };

    function translate(ctx, key, vars) {
      let active = '';
      try {
        active = String(ctx.locale.getSnapshot().active || '');
      } catch {
        active = '';
      }
      const dict = active.toLowerCase().startsWith('zh') ? MESSAGES.zh : MESSAGES.en;
      let text = dict[key] !== undefined ? dict[key] : MESSAGES.en[key] !== undefined ? MESSAGES.en[key] : key;
      if (vars !== undefined) {
        text = text.replace(/\{(\w+)\}/g, (whole, name) => (vars[name] === undefined ? whole : String(vars[name])));
      }
      return text;
    }

    // ── conversation Definition (data from the session log only) ───────────

    const ANCHOR_OFFSET = 0.5;

    function createDefinition(store) {
      const definition = {
        kind: KIND,
        target: 'chat',
        match: {
          'tool/call': (event) => {
            const config = store.getSnapshot();
            if (!config.enabled) return null;
            const data = event && event.data;
            if (!isRecord(data) || typeof data.name !== 'string') return null;
            if (!Object.prototype.hasOwnProperty.call(config.tools, data.name)) return null;
            return { id: String(data.callId), role: 'start' };
          },
          'tool/result': (event) => {
            if (!store.getSnapshot().enabled) return null;
            const message = event && event.data && event.data.message;
            const source = message && message.source;
            const callId = source && typeof source.callId === 'string' ? source.callId : undefined;
            return callId === undefined ? null : { id: callId, role: 'update' };
          },
        },
        start(_context, match) {
          const event = match.event;
          const data = event.data;
          const toolName = String(data.name);
          const startTime = typeof event.time === 'number' ? event.time : Date.now();
          const explicitBudget = budgetFromArguments(data.arguments);
          const inferredBudget = sleepBudgetFromCommand(data.arguments);
          return {
            toolName,
            startTime,
            explicitBudget,
            inferredBudget,
            anchorSeq: event.seq + ANCHOR_OFFSET,
            settled: false,
            data: { toolName, startTime, explicitBudget, inferredBudget },
          };
        },
        update(context) {
          const state = context && context.state;
          return state === undefined ? { settled: true } : { ...state, settled: true };
        },
        buildViewNode(context) {
          const state = context && context.state;
          const current = context.current && context.current.get('chat');
          if (!state || typeof state.anchorSeq !== 'number') {
            return current == null ? null : { ...current, visibility: 'hidden' };
          }
          if (state.settled) {
            if (current == null) return null;
            return current.visibility === 'hidden' ? current : { ...current, visibility: 'hidden' };
          }
          if (
            current != null &&
            current.kind === KIND &&
            current.data === state.data &&
            current.visibility === 'visible' &&
            current.anchorSeq === state.anchorSeq
          ) {
            return current;
          }
          const location =
            (context.start && context.start.location) ||
            (context.matches && context.matches[0] && context.matches[0].location) ||
            { kind: 'unresolved' };
          return {
            key: context.key,
            kind: KIND,
            id: context.id,
            target: 'chat',
            anchorSeq: state.anchorSeq,
            location,
            visibility: 'visible',
            data: state.data,
          };
        },
      };
      return definition;
    }

    // ── bar renderer shared by the chat row and the settings preview ───────

    function budgetFor(config, data) {
      if (!isRecord(data)) return null;
      const name = typeof data.toolName === 'string' ? data.toolName : '';
      if (!Object.prototype.hasOwnProperty.call(config.tools, name)) return null;
      const explicit = typeof data.explicitBudget === 'number' && data.explicitBudget > 0 ? data.explicitBudget : null;
      const inferred =
        config.inferSleepBudget && typeof data.inferredBudget === 'number' && data.inferredBudget > 0
          ? data.inferredBudget
          : null;
      // A literal `sleep N` drives the fill; a smaller explicit timeout still
      // caps it because the executor returns (and moves to background) at that
      // timeout. Everything else falls back to the configured tool budget.
      if (inferred !== null) return explicit === null ? inferred : Math.min(inferred, explicit);
      return explicit === null ? config.tools[name] : explicit;
    }

    const PULSE_KEYFRAMES =
      '@keyframes dwp-wait-head-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}' +
      '@media (prefers-reduced-motion:reduce){.dwp-wait-head,.dwp-wait-head-wrap{animation:none!important}}';

    function renderBar(config, options) {
      const toolName = options.toolName;
      const elapsed = Math.max(0, options.elapsed);
      const budgetMs = options.budgetMs;
      const hasBudget = typeof budgetMs === 'number' && budgetMs > 0;
      const over = hasBudget && elapsed > budgetMs;
      const state = hasBudget ? (over ? 'over' : 'running') : 'indeterminate';
      const ratio = hasBudget ? Math.min(1, elapsed / budgetMs) : 0;
      const clockText = formatClock(elapsed, hasBudget ? budgetMs : null, config);
      const headSize = config.headSize;
      const headEnabled = config.headImage !== '' && headSize > 0 && options.headBroken !== true;
      const rowHeight = headEnabled ? Math.max(14, headSize + 2) : 14;
      const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

      const labelNode =
        config.label === ''
          ? null
          : h(
              'span',
              {
                key: 'label',
                className: 'dwp-wait-label',
                style: {
                  flex: 'none',
                  fontSize: config.fontSize + 'px',
                  lineHeight: '14px',
                  color: config.labelColor,
                  whiteSpace: 'nowrap',
                },
              },
              config.label,
            );

      const rowStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: rowHeight + 'px',
        margin: config.gapTop + 'px 0 ' + config.gapBottom + 'px ' + config.inset + 'px',
        overflow: 'visible',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      };
      const common = {
        className: 'dwp-wait-row',
        'data-dwp-tool': toolName,
        'data-dwp-state': state,
        style: rowStyle,
      };

      // Unknown budget: no track at all. Only the head picture and the text stay,
      // parked at the left; the elapsed clock keeps ticking.
      if (!hasBudget) {
        return h(
          'div',
          { ...common, 'data-dwp-variant': 'quiet' },
          [
            headEnabled ? h('style', { key: 'dwp-quiet-keyframes' }, PULSE_KEYFRAMES) : null,
            headEnabled
              ? h('img', {
                  key: 'head',
                  className: 'dwp-wait-head',
                  src: config.headImage,
                  alt: '',
                  draggable: false,
                  onError: options.onHeadError,
                  style: {
                    display: 'block',
                    flex: 'none',
                    width: headSize + 'px',
                    height: headSize + 'px',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))',
                    animation: 'dwp-wait-head-pulse 1.6s ease-in-out infinite',
                  },
                })
              : null,
            labelNode,
            h(
              'span',
              {
                key: 'clock',
                className: 'dwp-wait-clock',
                style: {
                  flex: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: mono,
                  fontSize: config.fontSize + 'px',
                  lineHeight: '14px',
                  color: config.clockColor,
                  whiteSpace: 'nowrap',
                },
              },
              clockText,
            ),
          ],
        );
      }

      // Determinate: label | track with the head riding the leading edge | clock.
      const railStyle = {
        position: 'relative',
        flex: '1 1 auto',
        minWidth: '0',
        height: rowHeight + 'px',
        display: 'flex',
        alignItems: 'center',
      };
      const trackStyle = {
        position: 'relative',
        width: '100%',
        height: config.height + 'px',
        borderRadius: config.radius + 'px',
        backgroundColor: config.track,
        overflow: 'hidden',
      };
      const fillStyle = {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '0',
        width: (ratio * 100).toFixed(2) + '%',
        borderRadius: config.radius + 'px',
        background: over ? config.overrunAccent : config.accent,
        transition: 'width 120ms linear, background 300ms ease',
      };
      let head = null;
      if (headEnabled) {
        const headHalf = headSize / 2;
        head = h(
          'span',
          {
            key: 'head',
            className: 'dwp-wait-head-wrap',
            'data-dwp-head': '',
            'aria-hidden': true,
            style: {
              position: 'absolute',
              top: '50%',
              left:
                'clamp(0px, calc(' +
                (ratio * 100).toFixed(2) +
                '% - ' +
                headHalf +
                'px), calc(100% - ' +
                headSize +
                'px))',
              width: headSize + 'px',
              height: headSize + 'px',
              marginTop: -headHalf + 'px',
              zIndex: 1,
              pointerEvents: 'none',
              willChange: 'left',
              transition: 'left 120ms linear',
            },
          },
          h('img', {
            className: 'dwp-wait-head',
            src: config.headImage,
            alt: '',
            draggable: false,
            onError: options.onHeadError,
            style: {
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))',
              animation: 'dwp-wait-head-pulse 1.6s ease-in-out infinite',
            },
          }),
        );
      }
      return h(
        'div',
        {
          ...common,
          role: 'progressbar',
          'aria-label': (config.label === '' ? '' : config.label + ' ') + clockText,
          'aria-valuemin': 0,
          'aria-valuemax': Math.round(budgetMs),
          'aria-valuenow': Math.round(Math.min(elapsed, budgetMs)),
        },
        [
          h('style', { key: 'dwp-keyframes' }, PULSE_KEYFRAMES),
          labelNode,
          h(
            'span',
            { key: 'rail', className: 'dwp-wait-rail', style: railStyle },
            h(
              'span',
              { className: 'dwp-wait-track', style: trackStyle },
              h('span', { className: 'dwp-wait-fill', style: fillStyle }),
            ),
            head,
          ),
          h(
            'span',
            {
              key: 'clock',
              className: 'dwp-wait-clock',
              style: {
                flex: 'none',
                minWidth: '84px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: mono,
                fontSize: config.fontSize + 'px',
                lineHeight: '14px',
                color: config.clockColor,
                whiteSpace: 'nowrap',
              },
            },
            clockText,
          ),
        ],
      );
    }

    // ── chat row ────────────────────────────────────────────────────────────

    function WaitProgressRow(props) {
      const node = props && props.node;
      const data = node && node.data;
      const toolName = data && typeof data.toolName === 'string' ? data.toolName : '';
      const startTime = data && typeof data.startTime === 'number' ? data.startTime : null;
      const config = React.useSyncExternalStore(
        (listener) => waitProgressStore.subscribe(listener),
        () => waitProgressStore.getSnapshot(),
      );

      const [visible, setVisible] = React.useState(() => config.showDelayMs <= 0);
      const [now, setNow] = React.useState(() => Date.now());
      const [headBroken, setHeadBroken] = React.useState(false);

      React.useEffect(() => {
        setHeadBroken(false);
      }, [config.headImage]);

      React.useEffect(() => {
        if (config.showDelayMs <= 0) {
          setVisible(true);
          return undefined;
        }
        setVisible(false);
        const delay = setTimeout(() => setVisible(true), config.showDelayMs);
        return () => clearTimeout(delay);
      }, [config.showDelayMs]);

      React.useEffect(() => {
        if (!visible || !config.enabled) return undefined;
        const ticker = setInterval(() => setNow(Date.now()), config.tickMs);
        return () => clearInterval(ticker);
      }, [visible, config.enabled, config.tickMs]);

      if (!config.enabled || !visible || toolName === '' || startTime === null) return null;
      return renderBar(config, {
        elapsed: Math.max(0, now - startTime),
        budgetMs: budgetFor(config, { toolName, explicitBudget: data.explicitBudget, inferredBudget: data.inferredBudget }),
        toolName,
        headBroken,
        onHeadError: () => setHeadBroken(true),
      });
    }

    // ── settings page UI ───────────────────────────────────────────────────

    function Switch(props) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked === true,
          className: 'dwp-set-switch' + (props.checked === true ? ' is-on' : ''),
          onClick: () => props.onChange(props.checked !== true),
          title: props.title,
        },
        h('span', { className: 'dwp-set-switch-knob' }),
      );
    }

    function Slider(props) {
      return h(
        'div',
        { className: 'dwp-set-slider' },
        h('input', {
          type: 'range',
          min: props.min,
          max: props.max,
          step: props.step === undefined ? 1 : props.step,
          value: props.value,
          className: 'dwp-set-range',
          onChange: (event) => props.onChange(Number(event.currentTarget.value)),
        }),
        h('span', { className: 'dwp-set-value' }, String(props.value) + (props.unit === undefined ? '' : props.unit)),
      );
    }

    function TextField(props) {
      return h('input', {
        type: 'text',
        className: 'dwp-set-input',
        value: props.value,
        placeholder: props.placeholder === undefined ? '' : props.placeholder,
        spellCheck: false,
        onChange: (event) => props.onChange(event.currentTarget.value),
      });
    }

    function Row(props) {
      return h(
        'div',
        { className: 'dwp-set-row' },
        h(
          'div',
          { className: 'dwp-set-row-text' },
          h('div', { className: 'dwp-set-row-title' }, props.title),
          props.hint === undefined ? null : h('div', { className: 'dwp-set-row-hint' }, props.hint),
        ),
        h('div', { className: 'dwp-set-row-control' }, props.children),
      );
    }

    function Group(props) {
      return h(
        'section',
        { className: 'dwp-set-group' },
        h('h3', { className: 'dwp-set-group-title' }, props.title),
        props.description === undefined ? null : h('p', { className: 'dwp-set-group-desc' }, props.description),
        props.children,
      );
    }

    function PreviewBar(props) {
      const config = React.useSyncExternalStore(waitProgressStore.subscribe, waitProgressStore.getSnapshot);
      const [broken, setBroken] = React.useState(false);
      React.useEffect(() => {
        setBroken(false);
      }, [config.headImage]);
      return renderBar(config, {
        elapsed: props.elapsed,
        budgetMs: props.budgetMs,
        toolName: props.toolName,
        headBroken: broken,
        onHeadError: () => setBroken(true),
      });
    }

    const SETTINGS_CSS =
      '.dwp-set{display:flex;flex-direction:column;width:100%;padding-bottom:24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}' +
      '.dwp-set-head{padding:8px 0 2px}' +
      '.dwp-set-title{margin:0 0 4px;font-size:16px;line-height:24px;font-weight:600}' +
      '.dwp-set-sub{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}' +
      '.dwp-set-preview{margin:14px 0 2px;padding:14px 16px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}' +
      '.dwp-set-preview-label{margin-bottom:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.dwp-set-group{padding:4px 0 0}' +
      '.dwp-set-group-title{margin:18px 0 0;font-size:14px;line-height:22px;font-weight:600}' +
      '.dwp-set-group-desc{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.dwp-set-row{display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}' +
      '.dwp-set-row-text{flex:1;min-width:0}' +
      '.dwp-set-row-title{font-size:14px;line-height:22px}' +
      '.dwp-set-row-hint{margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}' +
      '.dwp-set-row-control{flex:none;display:flex;align-items:center;justify-content:flex-end;max-width:58%;min-width:0}' +
      '.dwp-set-block{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}' +
      '.dwp-set-switch{position:relative;width:36px;height:20px;flex:none;padding:0;border:0;border-radius:99px;background:var(--dsw-alias-border-l2);cursor:pointer;transition:background .15s}' +
      '.dwp-set-switch.is-on{background:var(--dsw-alias-brand-primary)}' +
      '.dwp-set-switch-knob{position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);transition:transform .15s}' +
      '.dwp-set-switch.is-on .dwp-set-switch-knob{transform:translateX(16px)}' +
      '.dwp-set-input{width:220px;max-width:100%;height:32px;box-sizing:border-box;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}' +
      '.dwp-set-input:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}' +
      '.dwp-set-textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;resize:vertical}' +
      '.dwp-set-btn{height:32px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}' +
      '.dwp-set-btn:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dwp-set-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
      '.dwp-set-mini{width:32px;height:32px;flex:none;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;cursor:pointer}' +
      '.dwp-set-mini:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dwp-set-slider{display:flex;align-items:center;gap:10px}' +
      '.dwp-set-range{width:170px;accent-color:var(--dsw-alias-brand-primary)}' +
      '.dwp-set-value{min-width:52px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}' +
      '.dwp-set-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.dwp-set-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}' +
      '.dwp-set-note{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.dwp-set-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:20px 0 8px}' +
      '.dwp-set-color{width:32px;height:32px;flex:none;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;cursor:pointer}' +
      '.dwp-set-color-text{width:182px}';

    function parseCssColor(value) {
      if (typeof value !== 'string') return null;
      const text = value.trim().toLowerCase();
      const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
      if (hex !== null) {
        const digits = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
        return {
          r: parseInt(digits.slice(0, 2), 16),
          g: parseInt(digits.slice(2, 4), 16),
          b: parseInt(digits.slice(4, 6), 16),
          a: 1,
        };
      }
      const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([0-9.]+)\s*)?\)$/.exec(text);
      if (rgb === null) return null;
      const clampChannel = (value) => Math.min(255, Math.max(0, Number(value)));
      const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
      return {
        r: clampChannel(rgb[1]),
        g: clampChannel(rgb[2]),
        b: clampChannel(rgb[3]),
        a: Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1,
      };
    }

    function formatCssColor(value) {
      const parsed = parseCssColor(value);
      if (parsed === null) return typeof value === 'string' ? value : '';
      if (parsed.a < 1) {
        return 'rgba(' + parsed.r + ', ' + parsed.g + ', ' + parsed.b + ', ' + Number(parsed.a.toFixed(2)) + ')';
      }
      return 'rgb(' + parsed.r + ', ' + parsed.g + ', ' + parsed.b + ')';
    }

    function hexCssColor(value, fallback) {
      const parsed = parseCssColor(value);
      if (parsed === null) return fallback;
      const two = (channel) => channel.toString(16).padStart(2, '0');
      return '#' + two(parsed.r) + two(parsed.g) + two(parsed.b);
    }

    function ColorField(props) {
      const [draft, setDraft] = React.useState(() => formatCssColor(props.value));
      const [focused, setFocused] = React.useState(false);
      React.useEffect(() => {
        if (focused) return;
        setDraft(formatCssColor(props.value));
      }, [props.value, focused]);
      const commit = () => {
        const text = draft.trim();
        props.onCommit(text === '' ? undefined : text);
      };
      return h(
        'div',
        { className: 'dwp-set-inline' },
        h('input', {
          type: 'color',
          className: 'dwp-set-color',
          value: hexCssColor(props.value, '#4d6bfe'),
          onChange: (event) => props.onCommit(event.currentTarget.value),
          'aria-label': props.resetLabel,
        }),
        h('input', {
          type: 'text',
          className: 'dwp-set-input dwp-set-color-text',
          value: draft,
          placeholder: formatCssColor(props.fallback),
          spellCheck: false,
          onFocus: () => setFocused(true),
          onBlur: () => {
            setFocused(false);
            commit();
          },
          onChange: (event) => setDraft(event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          },
        }),
        h('button', { type: 'button', className: 'dwp-set-mini', title: props.resetLabel, onClick: props.onReset }, '↺'),
      );
    }

    function SettingsPage(props) {
      const store = props.store;
      const t = props.t;
      const locale = props.locale;
      const config = React.useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
      );
      const overrides = store.getOverrides();
      const defaults = store.getDefaults();

      // Re-render on locale change so the page copy follows the app language.
      React.useSyncExternalStore(
        (listener) => locale.subscribe(listener),
        () => locale.getSnapshot(),
      );

      const [toolsText, setToolsText] = React.useState(() => serializeTools(config.tools));
      const [toolsError, setToolsError] = React.useState('');
      const [headUrl, setHeadUrl] = React.useState('');
      const [saveError, setSaveError] = React.useState('');
      const fileInput = React.useRef(null);

      const update = (patch) => {
        const saved = store.set(patch);
        setSaveError(saved ? '' : t('saveFailed'));
      };

      const resetKey = (key) => {
        const saved = store.resetKey(key);
        setSaveError(saved ? '' : t('saveFailed'));
      };

      const resetAll = () => {
        const saved = store.reset();
        setToolsText(serializeTools(store.getSnapshot().tools));
        setToolsError('');
        setSaveError(saved ? '' : t('saveFailed'));
      };

      const applyTools = () => {
        const parsed = parseToolsText(toolsText);
        if (parsed.error !== undefined) {
          setToolsError(t('toolsInvalid', { line: parsed.error === '' ? '(empty)' : parsed.error }));
          return;
        }
        // The list shows the effective whitelist, so a removed default line must
        // become an explicit `false` override instead of silently falling back.
        for (const name of Object.keys(DEFAULT_TOOLS)) {
          if (!Object.prototype.hasOwnProperty.call(parsed.tools, name)) parsed.tools[name] = false;
        }
        setToolsError('');
        update({ tools: parsed.tools });
      };

      const onPickImage = (event) => {
        const input = event.currentTarget;
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          setSaveError(t('imageTooLarge'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          if (result === '') {
            setSaveError(t('imageReadFailed'));
            return;
          }
          update({ headImage: result });
        };
        reader.onerror = () => setSaveError(t('imageReadFailed'));
        reader.readAsDataURL(file);
      };

      const colorRow = (key) =>
        h(
          Row,
          { title: t(key) },
          h(ColorField, {
            value: config[key],
            fallback: String(defaults[key]),
            onCommit: (value) => update({ [key]: value }),
            onReset: () => resetKey(key),
            resetLabel: t('resetKey'),
          }),
        );

      return h(
        React.Fragment,
        null,
        h('style', { key: 'settings-style' }, SETTINGS_CSS),
        h(
          'div',
          { className: 'dwp-set' },
          h(
            'header',
            { className: 'dwp-set-head' },
            h('h2', { className: 'dwp-set-title' }, t('title')),
            h('p', { className: 'dwp-set-sub' }, t('subtitle')),
          ),
          h(
            'div',
            { className: 'dwp-set-preview' },
            h('div', { className: 'dwp-set-preview-label' }, t('preview')),
            h(PreviewBar, { elapsed: 14800, budgetMs: 45000, toolName: 'wait_agent' }),
            h(PreviewBar, { elapsed: 8200, budgetMs: null, toolName: 'ask_user_question' }),
          ),
          h(
            Group,
            { title: t('groupGeneral'), description: t('groupGeneralDesc') },
            h(
              Row,
              { title: t('enabled'), hint: t('enabledHint') },
              h(Switch, { checked: config.enabled, onChange: (value) => update({ enabled: value }) }),
            ),
            h(
              Row,
              { title: t('inferSleepBudget'), hint: t('inferSleepBudgetHint') },
              h(Switch, {
                checked: config.inferSleepBudget,
                onChange: (value) => update({ inferSleepBudget: value }),
              }),
            ),
            h(
              Row,
              { title: t('label'), hint: t('labelHint') },
              h(TextField, { value: config.label, placeholder: String(defaults.label), onChange: (value) => update({ label: value }) }),
            ),
            h(
              Row,
              { title: t('clockFormat'), hint: t('clockFormatHint') },
              h(TextField, {
                value: config.clockFormat,
                placeholder: String(defaults.clockFormat),
                onChange: (value) => update({ clockFormat: value }),
              }),
            ),
            h(
              'div',
              { className: 'dwp-set-block' },
              h('div', { className: 'dwp-set-row-title' }, t('tools')),
              h('div', { className: 'dwp-set-row-hint' }, t('toolsHint')),
              h('textarea', {
                className: 'dwp-set-textarea',
                rows: 4,
                spellCheck: false,
                value: toolsText,
                onChange: (event) => setToolsText(event.currentTarget.value),
              }),
              h(
                'div',
                { className: 'dwp-set-inline' },
                h('button', { type: 'button', className: 'dwp-set-btn', onClick: applyTools }, t('applyTools')),
                toolsError === '' ? null : h('span', { className: 'dwp-set-error' }, toolsError),
              ),
            ),
          ),
          h(
            Group,
            { title: t('groupHead'), description: t('groupHeadDesc') },
            h(
              Row,
              { title: t('headEnabled') },
              h(Switch, {
                checked: config.headImage !== '',
                onChange: (value) => update({ headImage: value ? defaults.headImage : '' }),
              }),
            ),
            h(
              Row,
              { title: t('headDefault') },
              h(
                'div',
                { className: 'dwp-set-inline' },
                h('button', { type: 'button', className: 'dwp-set-btn', onClick: () => update({ headImage: defaults.headImage }) }, t('headDefault')),
                h('button', { type: 'button', className: 'dwp-set-btn', onClick: () => update({ headImage: '' }) }, t('headOff')),
                h('button', { type: 'button', className: 'dwp-set-btn', onClick: () => fileInput.current && fileInput.current.click() }, t('headPick')),
                h('input', {
                  ref: fileInput,
                  type: 'file',
                  accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml',
                  style: { display: 'none' },
                  onChange: onPickImage,
                }),
              ),
            ),
            h(
              Row,
              { title: t('headUrl') },
              h(
                'div',
                { className: 'dwp-set-inline' },
                h(TextField, { value: headUrl, placeholder: 'https://…', onChange: (value) => setHeadUrl(value) }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dwp-set-btn',
                    onClick: () => {
                      const value = headUrl.trim();
                      if (value === '') return;
                      update({ headImage: value });
                      setHeadUrl('');
                    },
                  },
                  t('headUrlApply'),
                ),
              ),
            ),
            h(
              Row,
              { title: t('headSize'), hint: 'px' },
              h(Slider, { min: 4, max: 48, value: config.headSize, onChange: (value) => update({ headSize: value }) }),
            ),
          ),
          h(
            Group,
            { title: t('groupSize') },
            h(Row, { title: t('height'), hint: 'px' }, h(Slider, { min: 1, max: 12, value: config.height, onChange: (value) => update({ height: value }) })),
            h(Row, { title: t('radius'), hint: 'px' }, h(Slider, { min: 0, max: 12, value: config.radius, onChange: (value) => update({ radius: value }) })),
            h(Row, { title: t('inset'), hint: 'px' }, h(Slider, { min: 0, max: 80, value: config.inset, onChange: (value) => update({ inset: value }) })),
            h(Row, { title: t('gapTop'), hint: 'px' }, h(Slider, { min: 0, max: 24, value: config.gapTop, onChange: (value) => update({ gapTop: value }) })),
            h(Row, { title: t('gapBottom'), hint: 'px' }, h(Slider, { min: 0, max: 24, value: config.gapBottom, onChange: (value) => update({ gapBottom: value }) })),
            h(Row, { title: t('fontSize'), hint: 'px' }, h(Slider, { min: 8, max: 18, value: config.fontSize, onChange: (value) => update({ fontSize: value }) })),
          ),
          h(
            Group,
            { title: t('groupColor'), description: t('groupColorDesc') },
            colorRow('accent'),
            colorRow('overrunAccent'),
            colorRow('track'),
            colorRow('labelColor'),
            colorRow('clockColor'),
          ),
          h(
            Group,
            { title: t('groupTiming') },
            h(Row, { title: t('showDelayMs'), hint: 'ms' }, h(Slider, { min: 0, max: 3000, step: 50, value: config.showDelayMs, onChange: (value) => update({ showDelayMs: value }) })),
            h(Row, { title: t('tickMs'), hint: 'ms' }, h(Slider, { min: 50, max: 500, step: 10, value: config.tickMs, onChange: (value) => update({ tickMs: value }) })),
          ),
          h(
            'footer',
            { className: 'dwp-set-foot' },
            h('button', { type: 'button', className: 'dwp-set-btn', onClick: resetAll }, t('resetAll')),
            h(
              'span',
              { className: 'dwp-set-note' },
              Object.keys(overrides).length === 0 ? t('noOverrides') : t('overrides', { count: Object.keys(overrides).length }),
            ),
            saveError === '' ? null : h('span', { className: 'dwp-set-error' }, saveError),
          ),
        ),
      );
    }

    // ── plugin entry ───────────────────────────────────────────────────────

    let waitProgressStore = null;

    return {
      inject: ['slots', 'uiConversation', 'locale'],
      apply(ctx) {
        const baseRaw = isRecord(window[GLOBAL_NAME]) ? window[GLOBAL_NAME] : {};
        const store = createSettingsStore(baseRaw);
        waitProgressStore = store;
        const t = (key, vars) => translate(ctx, key, vars);

        ctx.effect(() => ctx.uiConversation.events.register(createDefinition(store)));
        ctx.slots.inject('conversation.chat.node', () =>
          ctx.slots.register({ name: 'conversation.chat.node', key: KIND }, WaitProgressRow),
        );
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'deepsleep-progress',
              order: 25,
              label: () => t('nav'),
              inject: () => ({ t, locale: ctx.locale, store }),
            },
            SettingsPage,
          ),
        );
      },
    };
  },
});
