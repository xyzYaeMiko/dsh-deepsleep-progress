/**
 * Offline logic test for the wait-progress browser half.
 * Loads the real bundle registration, stubs the browser module table + React,
 * and exercises the Conversation Definition state machine (no rendering).
 * Run: node _dsh/wait-progress/dev/logic-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(here, '../client.js');

function loadBundle(globalConfig) {
  let registration;
  const window = {
    __ModuleLoader__: { load: (reg) => { registration = reg; } },
    __WAIT_PROGRESS_CONFIG__: globalConfig,
  };
  globalThis.window = window;
  globalThis.__PROBE_WINDOW__ = window;
  const source = readFileSync(bundlePath, 'utf8');
  // Evaluate the real bundle file body with the same globals the page provides.
  new Function('window', source)(window);
  assert.equal(registration.id, 'dsh-deepsleep-progress');
  return registration;
}

const ReactStub = {
  createElement: () => ({}),
  useState: () => [false, () => {}],
  useEffect: () => {},
  Fragment: 'fragment',
};

function boot(globalConfig, locale = 'zh') {
  const registration = loadBundle(globalConfig);
  const captured = { definition: undefined, slots: [], registrations: [], effectDisposed: false };
  const ctx = {
    locale: { getSnapshot: () => ({ active: locale, locales: [], revision: 0 }) },
    effect(fn) {
      const dispose = fn();
      return () => { captured.effectDisposed = true; if (typeof dispose === 'function') dispose(); };
    },
    uiConversation: {
      events: {
        register(definition) { captured.definition = definition; return () => { captured.definition = undefined; }; },
      },
    },
    slots: {
      inject(key, cb) { captured.slots.push({ key, effect: cb }); return () => {}; },
      register(options, component) { captured.registrations.push({ options, component }); return () => {}; },
    },
  };
  const plugin = registration.factory((name) => {
    if (name === 'react') return ReactStub;
    throw new Error('unexpected require: ' + name);
  });
  assert.deepEqual(plugin.inject, ["slots", "uiConversation", "locale"]);
  plugin.apply(ctx);
  for (const slot of captured.slots) slot.effect();
  return { plugin, captured, ctx };
}

const event = (type, data, seq, time = 1700000000000) => ({ type, seq, time, data });
const toolCall = (callId, name, args = {}, seq = 10, time) =>
  event('tool/call', { turn: 1, step: 1, callId, name, arguments: JSON.stringify(args) }, seq, time);
const toolResult = (callId, seq = 20) =>
  event('tool/result', { turn: 1, step: 1, message: { role: 'tool', source: { kind: 'tool', callId }, content: [] } }, seq);

const contextFor = (def, state, extra = {}) => ({
  key: 'ctx:' + (extra.callId || 'x'),
  kind: def.kind,
  id: extra.callId || 'x',
  definition: def,
  start: { event: extra.startEvent, location: { kind: 'step' } },
  matches: [{ event: extra.startEvent, location: { kind: 'step' } }],
  state,
  current: extra.current || new Map(),
});

// --- config + locale label ---
{
  const { captured } = boot(undefined, 'zh');
  const def = captured.definition;
  assert.equal(def.kind, 'wait-progress');
  assert.equal(def.target, 'chat');
  // Config defaults fill in from the patch defaults inside the bundle.
  const call = toolCall('c1', 'wait_agent', {});
  const match = def.match['tool/call'](call);
  assert.deepEqual(match, { id: 'c1', role: 'start' });
  const state = def.start(contextFor(def, undefined, { callId: 'c1', startEvent: call }), { event: call, location: { kind: 'step' } });
  assert.equal(state.toolName, 'wait_agent');
  assert.equal(state.explicitBudget, null, 'no timeout argument -> the Config budget applies at render time');
  assert.equal(state.startTime, 1700000000000);
  assert.equal(state.settled, false);

  // Label falls back to the active locale.
  const rendered = def.buildViewNode(contextFor(def, state, { callId: 'c1', startEvent: call }));
  assert.ok(rendered, 'expected a running node');
  assert.equal(rendered.kind, 'wait-progress');
  assert.equal(rendered.target, 'chat');
  assert.equal(rendered.visibility, 'visible');
  assert.equal(rendered.anchorSeq, 10.5);
  console.log('ok: defaults + zh locale + running node');
}

// --- per-call timeout argument wins; unknown budget stays unknown ---
{
  const { captured } = boot(undefined, 'en');
  const def = captured.definition;
  const run = (name, args, seq = 10) => {
    const call = toolCall('c-' + name, name, args, seq);
    assert.ok(def.match['tool/call'](call));
    return def.start(contextFor(def, undefined, { callId: 'c-' + name, startEvent: call }), { event: call, location: { kind: 'step' } });
  };
  assert.equal(run('wait_agent', { timeout_ms: 120000 }).explicitBudget, 120000);
  assert.equal(run('job_output', { job_id: 'j', wait: true, timeout_ms: 15000 }).explicitBudget, 15000);
  assert.equal(run('bash', { command: 'sleep 1', timeoutMs: 600000 }).explicitBudget, 600000);
  assert.equal(run('bash', { command: 'sleep 1' }).explicitBudget, null);
  assert.equal(run('ask_user_question', { questions: [] }).explicitBudget, null);

  // literal sleep inference: only command-position `sleep N` counts
  assert.equal(run('bash', { command: 'sleep 5' }).inferredBudget, 5000);
  assert.equal(run('bash', { command: 'sleep 2; sleep 3' }).inferredBudget, 5000);
  assert.equal(run('bash', { command: 'cd /tmp && sleep 1.5m' }).inferredBudget, 90000);
  assert.equal(run('bash', { command: 'true && sleep 0.5' }).inferredBudget, 500);
  assert.equal(run('bash', { command: 'echo "sleep 5"' }).inferredBudget, null);
  assert.equal(run('bash', { command: 'npm install' }).inferredBudget, null);
  assert.equal(run('bash', { command: 'ps aux | grep sleep 5' }).inferredBudget, null, 'quoted/trailing sleep is not command-position');
  assert.equal(run('wait_agent', { timeout_ms: 30000 }).inferredBudget, null);

  // Non-whitelisted tools and unparsable arguments.
  assert.equal(def.match['tool/call'](toolCall('x', 'read', { file_path: '/x' })), null);
  const badJson = event('tool/call', { turn: 1, step: 1, callId: 'c9', name: 'bash', arguments: '{not json' }, 11);
  assert.ok(def.match['tool/call'](badJson));
  assert.equal(def.start(contextFor(def, undefined, { callId: 'c9', startEvent: badJson }), { event: badJson, location: { kind: 'step' } }).explicitBudget, null);
  console.log('ok: budget precedence and whitelist');
}

// --- result retires the row; engine contract respected ---
{
  const { captured } = boot(undefined, 'zh');
  const def = captured.definition;
  const call = toolCall('c2', 'wait_agent', {}, 30);
  assert.deepEqual(def.match['tool/call'](call), { id: 'c2', role: 'start' });
  const started = def.start(contextFor(def, undefined, { callId: 'c2', startEvent: call }), { event: call, location: { kind: 'step' } });

  // Every result is matched, so out-of-order history still settles correctly.
  assert.deepEqual(def.match['tool/result'](toolResult('c2', 31)), { id: 'c2', role: 'update' });
  // A result whose start is outside the loaded window is still matched; its
  // Context has no state and materializes nothing.
  assert.deepEqual(def.match['tool/result'](toolResult('never-seen', 32)), { id: 'never-seen', role: 'update' });

  const ctx = contextFor(def, started, { callId: 'c2', startEvent: call });
  const running = def.buildViewNode(ctx);
  ctx.current.set('chat', running);
  const settled = def.update(ctx, { event: toolResult('c2', 31), location: { kind: 'step' } });
  assert.equal(settled.settled, true);
  ctx.state = settled;
  const hidden = def.buildViewNode(ctx);
  assert.ok(hidden, 'a materialized node may not be withdrawn');
  assert.equal(hidden.visibility, 'hidden');
  assert.equal(def.buildViewNode(ctx).visibility, 'hidden');

  // No prior node -> null is allowed.
  const fresh = contextFor(def, settled, { callId: 'c2', startEvent: call });
  assert.equal(def.buildViewNode(fresh), null);
  console.log('ok: settle hides, never withdraws');
}

// --- config overrides + disabled + registration wiring ---
{
  const { captured } = boot({ enabled: false }, 'zh');
  assert.ok(captured.definition, 'disabled config still registers the Definition so Settings can re-enable it');
  assert.equal(captured.definition.match['tool/call'](toolCall('off-1', 'wait_agent', {})), null, 'disabled config matches nothing');
  assert.ok(
    captured.registrations.some((entry) => entry.options.name === 'settings.section' && entry.options.id === 'deepsleep-progress'),
    'the settings page stays registered while disabled',
  );
  console.log('ok: enabled=false');
}
{
  const { captured, ctx } = boot(
    {
      tools: { bash: 5000, job_output: null, wait_agent: false, unknown_tool: 1000 },
      height: 8,
      radius: 4,
      inset: 0,
      clockFormat: '{remaining} left / {budget}',
      label: '',
      showDelayMs: 0,
      tickMs: 0,
    },
    'zh',
  );
  assert.deepEqual(captured.definition.match['tool/call'](toolCall('k1', 'wait_agent', {})), null, 'false removes a tool');
  assert.ok(captured.definition.match['tool/call'](toolCall('k2', 'bash', {}, 11)));
  const bashCall = toolCall('k2', 'bash', {}, 11);
  const bashState = captured.definition.start(contextFor(captured.definition, undefined, { callId: 'k2', startEvent: bashCall }), { event: bashCall, location: { kind: 'step' } });
  assert.equal(bashState.explicitBudget, null, 'no timeout argument -> explicit budget stays null');
  const node = captured.definition.buildViewNode(contextFor(captured.definition, bashState, { callId: 'k2', startEvent: bashCall }));
  assert.equal(node.data.toolName, 'bash');
  const jobCall = toolCall('k3', 'job_output', { job_id: 'j', wait: true, timeout_ms: 15000 }, 12);
  assert.ok(captured.definition.match['tool/call'](jobCall));
  const jobState = captured.definition.start(
    contextFor(captured.definition, undefined, { callId: 'k3', startEvent: jobCall }),
    { event: jobCall, location: { kind: 'step' } },
  );
  assert.equal(jobState.explicitBudget, 15000, 'an explicit timeout argument is captured');
  const chatRegistration = captured.registrations.find((entry) => entry.options.name === 'conversation.chat.node');
  assert.deepEqual(chatRegistration.options, { name: 'conversation.chat.node', key: 'wait-progress' });
  const settingsRegistration = captured.registrations.find((entry) => entry.options.name === 'settings.section');
  assert.equal(settingsRegistration.options.id, 'deepsleep-progress');
  assert.equal(settingsRegistration.options.order, 25);
  assert.equal(typeof settingsRegistration.options.label, 'function');
  assert.equal(typeof settingsRegistration.options.inject, 'function');
  const injected = settingsRegistration.options.inject();
  assert.equal(typeof injected.t, 'function');
  assert.equal(typeof injected.store.getSnapshot, 'function');
  assert.equal(typeof injected.store.set, 'function');
  assert.equal(injected.locale, ctx.locale);
  console.log('ok: config overrides + slot/settings wiring');
}

console.log('\nall logic tests passed');
