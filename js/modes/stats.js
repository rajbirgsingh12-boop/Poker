/* Training history: accuracy per mode and spot, and the hands you miss most. */
(function (root) {
  'use strict';
  const { ui, store } = root.GTO;
  const { h } = ui;

  const MODULES = [
    { id: 'preflop', label: 'Preflop' },
    { id: 'pushfold', label: 'Push/fold' },
    { id: 'equity', label: 'Equity' },
    { id: 'math', label: 'GTO math' },
  ];

  let container;

  function mount(c) {
    container = c;
    render(false);
  }

  function accBar(x) {
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { class: 'acc-bar', style: { flex: '1' } }, h('i', { style: { width: (x * 100).toFixed(0) + '%' } })),
      h('span', null, ui.pct(x)));
  }

  function render(confirming) {
    const s = store.get();
    const tiles = MODULES.map((m) => {
      const d = s.modules[m.id];
      return h('div', { class: 'card tile' },
        h('span', { class: 'ctl-label' }, m.label),
        h('b', null, d && d.n ? ui.pct(d.score / d.n) : '–'),
        h('small', null, d && d.n ? `${d.n} answered` : 'Not started'));
    });

    const spots = Object.entries(s.spots)
      .map(([key, v]) => {
        const [mod, ...rest] = key.split(':');
        return { mod, spot: rest.join(':'), ...v };
      })
      .sort((a, b) => a.score / a.n - b.score / b.n || b.n - a.n);

    const misses = Object.entries(s.misses).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const modLabel = (id) => (MODULES.find((m) => m.id === id) || { label: id }).label;

    const resetCtl = confirming
      ? h('span', { class: 'confirm-row' },
        h('span', null, 'Erase all training history on this device?'),
        h('button', { class: 'btn', type: 'button', onClick: () => { store.reset(); render(false); } }, 'Erase'),
        h('button', { class: 'btn ghost', type: 'button', onClick: () => render(false) }, 'Keep'))
      : h('button', { class: 'btn ghost', type: 'button', onClick: () => render(true) }, 'Reset history');

    ui.put(container,
      h('div', { class: 'mode-head' },
        h('h1', null, 'Your stats'),
        h('p', null, 'Saved in this browser. Weakest spots are listed first, so you know what to drill next.')),
      h('div', { class: 'tiles' }, tiles),
      h('div', { class: 'work' },
        h('div', { class: 'card card-pad' },
          h('div', { class: 'panel-title' }, h('h2', null, 'By spot')),
          spots.length
            ? h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
              h('thead', null, h('tr', null, h('th', { class: 'col-mode' }, 'Mode'), h('th', null, 'Spot'), h('th', null, 'Hands'), h('th', { style: { width: '40%' } }, 'Accuracy'))),
              h('tbody', null, spots.map((r) => h('tr', null,
                h('td', { class: 'muted col-mode' }, modLabel(r.mod)), h('td', null, r.spot), h('td', null, r.n), h('td', null, accBar(r.score / r.n)))))))
            : h('p', { class: 'empty' }, 'Play a few hands in any trainer and your accuracy per spot shows up here.')),
        h('div', { class: 'card card-pad' },
          h('div', { class: 'panel-title' }, h('h2', null, 'Most missed')),
          misses.length
            ? h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
              h('thead', null, h('tr', null, h('th', { class: 'col-mode' }, 'Mode'), h('th', null, 'Hand'), h('th', null, 'Misses'))),
              h('tbody', null, misses.map(([key, n]) => {
                const [mod, label] = key.split('|');
                return h('tr', null, h('td', { class: 'muted col-mode' }, modLabel(mod)), h('td', null, label), h('td', null, n));
              }))))
            : h('p', { class: 'empty' }, 'No misses yet.'))),
      h('div', { style: { marginTop: '20px' } }, resetCtl));
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.stats = { id: 'stats', label: 'Stats', mount, onKey: () => {} };
})(typeof window !== 'undefined' ? window : globalThis);
