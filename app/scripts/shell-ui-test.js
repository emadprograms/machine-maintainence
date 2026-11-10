// Sidebar behavior without browser dependencies; visual/scroll layout is also
// exercised with a real browser in the quick-task verification.
import assert from 'node:assert/strict';
const handlers = {};
let stored = null, storageBlocked = false, markup = '', links = [], toggle, home;
const classes = new Set();
const classList = { contains: (name) => classes.has(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } };
function button(dataset = {}, attrs = {}) {
  const listeners = {}, state = new Set();
  return { dataset, attrs, classList: { toggle: (name, on) => on ? state.add(name) : state.delete(name), contains: (name) => state.has(name) },
    addEventListener: (event, handler) => { listeners[event] = handler; }, click() { listeners.click?.(); },
    setAttribute: (key, value) => { attrs[key] = value; }, removeAttribute: (key) => { delete attrs[key]; } };
}
const sidebar = { classList, set innerHTML(html) {
  markup = html;
  links = [...html.matchAll(/<button class="side-link[^>]*data-page="([^"]+)"/g)].map((m) => button({ page: m[1] }));
  const homeTag = html.match(/<button class="side-home[^>]*>/)[0];
  home = button({}, Object.fromEntries([...homeTag.matchAll(/(aria-current|aria-label|title)="([^"]+)"/g)].map((m) => [m[1], m[2]])));
  const tag = html.match(/<button class="side-toggle"[\s\S]*?>/)[0];
  toggle = button({}, Object.fromEntries([...tag.matchAll(/(aria-expanded|aria-label|title)="([^"]+)"/g)].map((m) => [m[1], m[2]])));
}, get innerHTML() { return markup; }, querySelectorAll: () => links, querySelector: (selector) => selector === '.side-home' ? home : toggle };
globalThis.document = { getElementById: () => sidebar, querySelector: (selector) => selector === '#sidebar .side-home' ? home : toggle, querySelectorAll: () => links,
  addEventListener: (event, handler) => { handlers[event] = handler; } };
globalThis.localStorage = { getItem() { if (storageBlocked) throw Error('denied'); return stored; },
  setItem(_key, value) { if (storageBlocked) throw Error('denied'); stored = value; } };
const shell = await import('../public/shell.js');
const pages = [{ key: 'work', label: 'Work orders' }];
let visited = '';
const render = () => shell.renderShell({ pages, current: 'dashboard', onNavigate: (name) => { visited = name; } });
render();
assert.match(markup, /class="side-home on"/);
assert.match(markup, /aria-label="Machine Maintenance — open dashboard"/);
assert.match(markup, /class="side-mark"[^>]*><svg/);
assert.doesNotMatch(markup, />MM<|data-page="dashboard"/);
assert.equal(home.attrs['aria-current'], 'page');
home.click(); assert.equal(visited, 'dashboard');
assert.ok(markup.indexOf('class="side-brand"') < markup.indexOf('class="side-toggle"'));
assert.ok(markup.indexOf('class="side-toggle"') < markup.indexOf('class="side-nav"'));
assert.match(markup.match(/<div class="side-brand">[\s\S]*?<\/div>/)[0], /class="side-toggle"/);
const buttonMarkup = markup.match(/<button class="side-toggle"[\s\S]*?<\/button>/)[0];
assert.match(buttonMarkup, /<rect /); assert.match(buttonMarkup, /class="side-chevron"/);
assert.equal(buttonMarkup.replace(/<[^>]*>/g, '').trim(), ''); // icon only; name remains accessible
assert.equal(toggle.attrs['aria-expanded'], 'true'); assert.equal(toggle.attrs['aria-label'], 'Collapse sidebar');
toggle.click(); assert.equal(classes.has('collapsed'), true); assert.equal(stored, '1');
assert.equal(toggle.attrs['aria-expanded'], 'false'); assert.equal(toggle.attrs['aria-label'], 'Expand sidebar'); assert.equal(toggle.attrs.title, 'Expand sidebar');
render(); assert.equal(classes.has('collapsed'), true); assert.equal(toggle.attrs['aria-expanded'], 'false');
let prevented = false; handlers.keydown({ ctrlKey: true, metaKey: false, key: 'b', preventDefault() { prevented = true; } });
assert.equal(prevented, true); assert.equal(stored, '0'); assert.equal(toggle.attrs['aria-label'], 'Collapse sidebar');
links[0].click(); assert.equal(visited, 'work'); shell.markCurrent('work');
assert.equal(links[0].classList.contains('on'), true); assert.equal(links[0].attrs['aria-current'], 'page');
assert.equal(home.attrs['aria-current'], undefined);
shell.markCurrent('dashboard'); assert.equal(home.attrs['aria-current'], 'page'); assert.equal(home.classList.contains('on'), true);
assert.equal(links[0].attrs['aria-current'], undefined);
home.click(); assert.equal(visited, 'dashboard');
storageBlocked = true; render(); assert.equal(classes.has('collapsed'), false); toggle.click();
assert.equal(classes.has('collapsed'), true); assert.equal(toggle.attrs['aria-label'], 'Expand sidebar');
home.click(); assert.equal(visited, 'dashboard');
console.log('Sidebar interactions passed');
