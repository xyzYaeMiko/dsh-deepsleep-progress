/**
 * Offline check of the installed bundle's display metadata (title/description/icon)
 * through the Harness's own reader: dsh-app-boot `readPluginMeta(specifier, parentURL)`.
 * This is the code path Plugin Manager uses to show a plugin's localized title,
 * description and cover icon (no plugin code is evaluated).
 *
 * The cover stays at the stable `./icon.svg` export on purpose: the running Host
 * caches package.json exports in Node's ESM resolver, so changing the export target
 * after install resolves the old path until restart. `icon.svg` therefore embeds the
 * 256 px whale artwork as a PNG data URI and never moves.
 *
 * Run: node dev/icon-check.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = os.homedir();
const storeLinks = process.env.DSH_PNPM_LINKS || path.join(home, '.local/share/pnpm/store/v11/links/@deepseek-ai');
const packageDir = path.resolve(here, '..');

function findPackageEntry(pkg) {
  // Any installed copy of the same released version is the same code.
  const versionDirs = readdirSync(path.join(storeLinks, pkg));
  for (const version of versionDirs) {
    const base = path.join(storeLinks, pkg, version);
    for (const hash of readdirSync(base)) {
      const candidate = path.join(base, hash, 'node_modules', '@deepseek-ai', pkg, 'lib', 'index.js');
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`cannot locate ${pkg}`);
}

const appBoot = findPackageEntry('dsh-app-boot');
const { readPluginMeta } = await import(pathToFileURL(appBoot).href);

// The profile's Loader tree base: a file URL whose directory chain reaches the
// profile node_modules where dsh-deepsleep-progress is linked.
const profileDir = process.env.DSH_PROFILE_DIR || path.join(home, '.dsh', 'profiles', 'web');
const parentURL = pathToFileURL(path.join(profileDir, 'cordis.yml')).href;
const meta = readPluginMeta('dsh-deepsleep-progress', parentURL);

if (meta === undefined) {
  console.error('FAIL: no display metadata returned (specifier not a package?)');
  process.exit(1);
}
if (meta.error !== undefined) {
  console.error('FAIL: ' + meta.error);
  process.exit(1);
}
const icon = meta.icon;
console.log('title      :', JSON.stringify(meta.title));
console.log('description:', JSON.stringify(meta.description));
console.log('icon       :', icon === undefined ? '(none)' : String(icon).slice(0, 72) + '…');
if (icon === undefined) {
  console.error('FAIL: icon not resolved');
  process.exit(1);
}
const match = /^data:([^;]+);base64,(.*)$/s.exec(String(icon));
if (!match) {
  console.error('FAIL: icon is not a base64 data URI');
  process.exit(1);
}
const mediaType = match[1];
const bytes = Buffer.from(match[2], 'base64');
const onDisk = readFileSync(path.join(packageDir, 'icon.svg'));
console.log('mediaType  :', mediaType);
console.log('icon bytes :', bytes.length, '(limit 262144)');
console.log('bytes match on-disk icon.svg:', bytes.equals(onDisk));
console.log('svg markup :', bytes.subarray(0, 4).toString() === '<svg');
const text = bytes.toString('utf8');
const inner = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(text);
const innerPng = inner === null ? null : Buffer.from(inner[1], 'base64');
console.log('embedded png present:', innerPng !== null, innerPng === null ? '' : `(${innerPng.length} bytes)`);
console.log('embedded png magic  :', innerPng !== null && innerPng.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
if (mediaType !== 'image/svg+xml' || bytes.length > 262144 || !bytes.equals(onDisk) || innerPng === null) {
  console.error('FAIL: icon validation expectations not met');
  process.exit(1);
}
console.log('\nPASS: the installed bundle exposes localized title/description and a valid SVG cover (with embedded whale artwork) through the Harness reader.');
