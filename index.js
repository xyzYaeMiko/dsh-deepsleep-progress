/**
 * Host half of the deepsleep-progress bundle.
 *
 * The browser half owns the rendering; this half only bridges the row config
 * from `cordis.patch.yml` into the page. The Web shell renders index.html on
 * every load, and `webserver/index-inject` is its structured injection table,
 * so the resolved config reaches the Client as one `window` global before the
 * Client plugin boots.
 *
 * No core package is imported and no route is registered; the row config is
 * passed through verbatim, and the Client half normalizes it with the same
 * defaults it would use when the global is absent.
 */

export const name = 'deepsleep-progress';

/** Wait for the web carrier so the injection event has its emitter. */
export const inject = ['webServer'];

/** Global read by `client.js`; change both halves together. */
const GLOBAL_NAME = '__WAIT_PROGRESS_CONFIG__';

/** Keep only JSON-serializable config; a YAML `!!js` value cannot ride the wire. */
function wireConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return {};
  try {
    return JSON.parse(JSON.stringify(config));
  } catch {
    return {};
  }
}

/**
 * Publish the row config through the Web shell's index injection table.
 * @param ctx - owning Host context.
 * @param config - row config from `cordis.patch.yml`.
 */
export function apply(ctx, config) {
  const value = wireConfig(config);
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: GLOBAL_NAME, value });
  });
}
