/* Range explorer: browse every preflop chart and the push/fold equilibrium. */
(function (root) {
  'use strict';
  const { core, preflop, pushfold, strategy, ui, store, explain } = root.GTO;
  const { h } = ui;

  let st, els;

  function mount(container) {
    st = {
      source: store.setting('ex.source', 'preflop'), // 'preflop' | 'push' | 'call'
      scenario: store.setting('ex.scenario', 'rfi-BTN'),
      stack: store.setting('ex.stack', 10),
      chart: store.setting('ex.chart', false),
      style: store.setting('ex.style', 'gto'),
      selected: core.handIndex('AKo'),
    };
    if (!preflop.scenarios.some((s) => s.id === st.scenario)) st.scenario = 'rfi-BTN';
    els = { picker: h('div', { class: 'picker' }), main: h('div', { class: 'card card-pad' }), detail: h('div', { class: 'card card-pad detail' }) };
    ui.put(container,
      h('div', { class: 'mode-head' },
        h('h1', null, 'Ranges'),
        h('p', null, 'Every chart the trainers use. Pick a situation on the left, then click any hand to see how often it raises, calls or folds.')),
      h('div', { class: 'explorer' }, els.picker, els.main, els.detail));
    render();
  }

  function render() {
    renderPicker();
    renderMain();
    renderDetail();
  }

  function pickBtn(label, active, onClick) {
    return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(active), onClick }, label);
  }

  function renderPicker() {
    const groups = preflop.GROUPS.map((g) => h('div', { class: 'picker-group' },
      h('h3', null, g.label),
      h('div', { class: 'picker-list' }, preflop.scenarios.filter((s) => s.group === g.id).map((s) =>
        pickBtn(s.title.replace(' open', '').replace(' 3-bet', ' 3b'), st.source === 'preflop' && st.scenario === s.id, () => {
          st.source = 'preflop'; st.scenario = s.id;
          store.setSetting('ex.source', 'preflop'); store.setSetting('ex.scenario', s.id);
          render();
        })))));
    const hu = h('div', { class: 'picker-group' },
      h('h3', null, 'Heads-up push/fold'),
      h('div', { class: 'picker-list' },
        pickBtn('SB shoves', st.source === 'push', () => { st.source = 'push'; store.setSetting('ex.source', 'push'); render(); }),
        pickBtn('BB calls', st.source === 'call', () => { st.source = 'call'; store.setSetting('ex.source', 'call'); render(); })));
    const styles = h('div', { class: 'picker-group' },
      h('h3', null, 'Strategy'),
      h('div', { class: 'picker-list' }, strategy.STYLES.map((x) => pickBtn(x.label, st.style === x.id, () => {
        st.style = x.id; store.setSetting('ex.style', x.id); render();
      }))));
    ui.put(els.picker, styles, ...groups, hu);
  }

  function nearestStack(s) {
    return pushfold.stacks.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a));
  }

  /** Largest stack (bb) at which a hand still takes the action at least half the time. */
  function maxStack(table, i) {
    let best = 0;
    for (const s of pushfold.stacks) if (table[s][i] >= 0.5) best = s;
    return best;
  }

  function renderMain() {
    if (st.source === 'preflop') {
      const strat = strategy.getStrategy(st.scenario, st.style);
      const scn = strat.scenario;
      ui.put(els.main,
        h('div', { class: 'panel-title' },
          h('div', null, h('div', { class: 'eyebrow' }, preflop.GROUPS.find((g) => g.id === scn.group).label, ' · 6 players · 100bb'), h('h2', null, scn.title)),
          h('span', { class: 'muted' }, scn.setup)),
        ui.rangeGrid({
          label: scn.title,
          fill: (i) => (strat.inRange[i] ? strategy.handStrategy(strat, i).map((a) => ({ kind: a.kind, f: a.freq })) : null),
          selected: st.selected,
          onCell: select,
          title: (i) => (strat.inRange[i] ? `${core.HAND_NAMES[i]}: ${ui.freqSentence(strategy.handStrategy(strat, i))}` : `${core.HAND_NAMES[i]}: not in the opening range`),
        }),
        ui.legend(strategy.actionTotals(strat).filter((t) => t.share > 0).reverse()),
        h('p', { class: 'grid-key' }, 'Diagonal: pairs · top-right: suited · bottom-left: offsuit. Split squares are mixed hands.'));
      return;
    }
    const isPush = st.source === 'push';
    const table = isPush ? pushfold.push : pushfold.call;
    const kind = isPush ? 'allin' : 'call';
    const stack = nearestStack(st.stack);
    const freqs = table[stack];
    const read = h('span', { class: 'stack-read' }, stack + 'bb');
    const slider = h('input', { type: 'range', class: 'slider', id: 'ex-stack', min: '1', max: '25', step: '0.5', value: String(stack), 'aria-label': 'Effective stack in big blinds', disabled: st.chart });
    slider.addEventListener('input', () => {
      st.stack = Number(slider.value);
      store.setSetting('ex.stack', st.stack);
      renderMain();
      renderDetail();
      const again = document.getElementById('ex-stack');
      if (again) again.focus();
    });
    let share = 0;
    for (let i = 0; i < 169; i++) share += freqs[i] * core.comboCount(i);
    share /= 1326;
    const label = isPush ? 'All-in' : 'Call';
    const fill = st.chart
      ? (i) => {
        const m = maxStack(table, i);
        return { css: m ? `color-mix(in srgb, var(--g-${kind}) ${Math.round(25 + (75 * m) / 25)}%, var(--g-void))` : 'var(--g-void)' };
      }
      : (i) => [{ kind, f: freqs[i] }, { kind: 'fold', f: 1 - freqs[i] }];
    ui.put(els.main,
      h('div', { class: 'panel-title' },
        h('div', null, h('div', { class: 'eyebrow' }, 'Heads-up · Nash equilibrium'),
          h('h2', null, st.chart ? (isPush ? 'SB shove chart' : 'BB call chart') : `${isPush ? 'SB shoves' : 'BB calls'} at ${stack}bb`)),
        ui.toggle({ id: 'ex-chart', label: 'Chart view', checked: st.chart, onChange: (v) => { st.chart = v; store.setSetting('ex.chart', v); renderMain(); } })),
      st.chart
        ? h('p', { class: 'muted', style: { marginBottom: '10px' } }, `Each number is the deepest stack (in bb) at which the hand ${isPush ? 'shoves' : 'calls'} at least half the time. "25" means 25bb or more.`)
        : h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' } }, read, slider),
      ui.rangeGrid({
        label: 'Push/fold range',
        fill,
        note: st.chart ? (i) => { const m = maxStack(table, i); return m ? String(m) : ''; } : null,
        selected: st.selected,
        onCell: select,
        title: (i) => (st.chart ? `${core.HAND_NAMES[i]}: up to ${maxStack(table, i)}bb` : `${core.HAND_NAMES[i]}: ${label} ${ui.pct(freqs[i])}`),
      }),
      st.chart ? null : ui.legend([{ kind, label, share }, { kind: 'fold', label: 'Fold', share: 1 - share }]));
  }

  function select(i) {
    st.selected = i;
    renderMain();
    renderDetail();
  }

  function renderDetail() {
    const i = st.selected;
    const name = core.HAND_NAMES[i];
    const head = [
      h('div', { class: 'eyebrow' }, 'Selected hand'),
      h('div', { class: 'detail-hand' }, name),
      h('p', { class: 'muted' }, `${ui.describeHand(i)} · ${core.comboCount(i)} combos`),
      h('p', { class: 'why' }, h('b', null, explain.handFamily(i).name + '. '), explain.handFamily(i).why),
    ];
    if (st.source === 'preflop') {
      const strat = strategy.getStrategy(st.scenario, st.style);
      if (!strat.inRange[i]) {
        ui.put(els.detail, ...head, h('p', null, 'This hand is not in your opening range, so it never reaches this spot.'));
        return;
      }
      const acts = strategy.handStrategy(strat, i);
      ui.put(els.detail, ...head, ui.strategyBar(acts),
        h('dl', { class: 'kv' }, acts.flatMap((a) => [h('dt', null, a.label), h('dd', null, ui.pct(a.freq))])));
      return;
    }
    const isPush = st.source === 'push';
    const stack = nearestStack(st.stack);
    const f = (isPush ? pushfold.push : pushfold.call)[stack][i];
    const acts = [{ label: isPush ? 'All-in' : 'Call', kind: isPush ? 'allin' : 'call', freq: f }, { label: 'Fold', kind: 'fold', freq: 1 - f }];
    const ev = isPush ? pushfold.pushEV[stack][i] : pushfold.callEV[stack][i];
    const table = isPush ? pushfold.push : pushfold.call;
    ui.put(els.detail, ...head, ui.strategyBar(acts),
      h('dl', { class: 'kv' },
        h('dt', null, 'Stack'), h('dd', null, stack + 'bb'),
        h('dt', null, isPush ? 'Shove frequency' : 'Call frequency'), h('dd', null, ui.pct(f)),
        h('dt', null, isPush ? 'EV of shoving' : 'Calling vs folding'), h('dd', null, ui.signed(ev) + 'bb'),
        h('dt', null, isPush ? 'Shoves up to' : 'Calls up to'), h('dd', null, maxStack(table, i) ? maxStack(table, i) + 'bb' : 'never')),
      h('p', { class: 'muted' }, isPush ? 'Folding the small blind loses 0.5bb, so shoving is right whenever its EV is above −0.5bb.' : 'Positive means calling earns more than folding against the equilibrium shoving range.'));
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.explorer = { id: 'explorer', label: 'Ranges', mount, onKey: () => {} };
})(typeof window !== 'undefined' ? window : globalThis);
