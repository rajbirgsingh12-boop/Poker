/* App shell: tabs, hash routing, theme toggle and keyboard dispatch. */
(function (root) {
  'use strict';
  const { modes, store } = root.GTO;

  const ROUTES = [
    { hash: 'learn', mode: modes.learn, label: 'Learn' },
    { hash: 'preflop', mode: modes.preflop, label: 'Preflop' },
    { hash: 'pushfold', mode: modes.pushfold, label: 'Push/Fold' },
    { hash: 'equity', mode: modes.equity, label: 'Equity' },
    { hash: 'math', mode: modes.math, label: 'GTO Math' },
    { hash: 'ranges', mode: modes.explorer, label: 'Ranges' },
    { hash: 'stats', mode: modes.stats, label: 'Stats' },
  ];

  const view = document.getElementById('view');
  const tabs = document.getElementById('tabs');
  let current = null;

  function show(hash) {
    const route = ROUTES.find((r) => r.hash === hash) || ROUTES[0];
    current = route;
    for (const btn of tabs.children) {
      const on = btn.dataset.hash === route.hash;
      btn.setAttribute('aria-selected', String(on));
      if (on && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = btn.offsetLeft - (tabs.clientWidth - btn.offsetWidth) / 2;
    }
    route.mode.mount(view);
    if (location.hash.slice(1) !== route.hash) {
      try { history.replaceState(null, '', '#' + route.hash); } catch (e) { /* sandboxed */ }
    }
  }

  tabs.replaceChildren(...ROUTES.map((r) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.hash = r.hash;
    b.textContent = r.label;
    b.addEventListener('click', () => { show(r.hash); window.scrollTo(0, 0); });
    return b;
  }));

  window.addEventListener('hashchange', () => {
    const hsh = location.hash.slice(1);
    if (!current || hsh !== current.hash) show(hsh);
  });

  document.addEventListener('keydown', (e) => {
    if (!current || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (tag === 'INPUT' && t.type !== 'range') {
      if (e.key === ' ' || e.key === 'Enter') return; // let switches toggle normally
    }
    if ((tag === 'BUTTON' || tag === 'A') && (e.key === ' ' || e.key === 'Enter')) return; // native click
    current.mode.onKey(e);
  });

  /* theme toggle: follows the system until the viewer picks one */
  const THEME_KEY = 'gto-trainer:theme';
  const docEl = document.documentElement;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') docEl.dataset.theme = saved;
  } catch (e) { /* storage unavailable */ }
  const themeBtn = document.getElementById('theme');
  themeBtn.addEventListener('click', () => {
    const dark = docEl.dataset.theme ? docEl.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    docEl.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, docEl.dataset.theme); } catch (e) { /* ignore */ }
  });

  root.GTO.app = { go: show };

  // First visit: open the guide. Afterwards, pick up where the hash says.
  const first = !store.setting('visited', false);
  store.setSetting('visited', true);
  show(location.hash.slice(1) || (first ? 'learn' : 'preflop'));
})(window);
