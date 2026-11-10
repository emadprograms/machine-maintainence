// Settings navigation, roles and delayed lookup interactions without browser dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const elements = new Map();
let focused, navigated = [], shellPages, settingsResponse = { time_zone: 'UTC' }, resolveOld;
const $ = (key) => {
  if (!elements.has(key)) elements.set(key, { hidden: false, disabled: false, value: '', dataset: {}, children: [], append(e) { this.children.push(e); }, focus() { focused = key; } });
  return elements.get(key);
};
const ctx = vm.createContext({ $, window: { me: { role: 'admin' } }, Intl,
  shellReady: Promise.resolve({ renderShell({ pages }) { shellPages = pages; } }),
  document: { createElement() { return {}; } },
  openForm: () => { $('#app-settings').open = true; },
  closeForm: () => { $('#app-settings').open = false; },
  syncTimeZone: async () => settingsResponse, timeKit: { getDisplayZone: () => 'UTC' },
  navigatePage: (key) => { navigated.push(key); },
  showPage: (key) => { navigated.push(key); },
  formError: (_, msg) => { throw new Error(msg); },
});
vm.runInContext(extract('const PAGES = [', 'function navigatePage('), ctx);
vm.runInContext(extract('let settingsLoad = 0;', 'async function saveSettings()'), ctx);
ctx.buildTabs(ctx.window.me); await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(Array.from(shellPages, (p) => p.key), ['equipment','work','pm','parts']);
await ctx.openSettings(); assert.equal($('#settings-admin').hidden, false); assert.equal($('#settings-save').hidden, false);
ctx.openSettingsPage('users'); assert.equal($('#app-settings').open, false); assert.equal(navigated.at(-1), 'users');
await ctx.openSettings(); ctx.openSettingsPage('backup'); assert.equal(navigated.at(-1), 'backup');
ctx.openSettingsPage('work'); assert.equal(navigated.length, 2);
ctx.window.me = { role: 'tech' }; ctx.buildTabs(ctx.window.me); await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(Array.from(shellPages, (p) => p.key), ['equipment','work','pm','parts']);
await ctx.openSettings(); assert.equal($('#settings-admin').hidden, true); assert.equal($('#settings-time-zone').readOnly, true); assert.equal($('#settings-save').hidden, true);
ctx.openSettingsPage('users'); ctx.openSettingsPage('backup'); assert.equal(navigated.length, 2);
ctx.window.me = { role: 'admin' }; focused = undefined;
settingsResponse = new Promise((resolve) => { resolveOld = resolve; });
const delayed = ctx.openSettings(); ctx.openSettingsPage('users'); resolveOld({ time_zone: 'Asia/Bahrain' }); await delayed;
assert.equal(focused, undefined); assert.equal($('#app-settings').open, false);
console.log('Settings navigation, roles and stale lookup interactions passed');
