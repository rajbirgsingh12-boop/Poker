/* Heads-up push/fold trainer against the computed Nash equilibrium. */
(function (root) {
  'use strict';
  const { core, pushfold, strategy, ui, store, explain } = root.GTO;
  const { h } = ui;

  const BUCKETS = [
    { id: 'a', label: '2–5.5bb', min: 2, max: 5.5 },
    { id: 'b', label: '6–9.5bb', min: 6, max: 9.5 },
    { id: 'c', label: '10–14.5bb', min: 10, max: 14.5 },
    { id: 'd', label: '15–20bb', min: 15, max: 20 },
  ];
  const ROLES = [
    { id: 'sb', label: 'Small blind: all-in or fold' },
    { id: 'bb', label: 'Big blind: call the all-in?' },
    { id: 'both', label: 'Both' },
  ];

  let st, els;
  const borderCache = new Map();

  function mount(container) {
    st = {
      buckets: store.setting('pff.buckets', ['b', 'c']),
      role: store.setting('pff.role', 'both'),
      close: store.setting('pff.close', true),
      sess: ui.newSession(),
      spot: null,
    };
    els = { spot: h('div', { class: 'card card-pad' }), panel: h('div', { class: 'card card-pad' }) };
    ui.put(container,
      h('div', { class: 'mode-head' },
        h('h1', null, 'Push/fold: short-stack all-ins'),
        h('p', null, 'Two players, few chips. With a short stack the simplest strong strategy is to go all-in ("push" or "shove") or fold. The answers here are calculated exactly by the app, so this is true GTO.')),
      h('div', { class: 'config' },
        ui.chipGroup({ label: 'Stack size', multi: true, selected: st.buckets, options: BUCKETS,
          onChange: (v) => { st.buckets = v; store.setSetting('pff.buckets', v); deal(); } }),
        ui.chipGroup({ label: 'Your seat', selected: st.role, options: ROLES,
          onChange: (v) => { st.role = v; store.setSetting('pff.role', v); deal(); } }),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Options'),
          ui.toggle({ id: 'pff-close', label: 'Skip easy hands', checked: st.close,
            onChange: (v) => { st.close = v; store.setSetting('pff.close', v); deal(); } }))),
      h('div', { class: 'work' }, els.spot, els.panel),
      h('p', { class: 'foot' }, 'Blinds 0.5/1bb, no antes. This is the exact Nash equilibrium of the all-in-or-fold game. Up to about 12bb it is almost identical to perfect play; with deeper stacks, real solvers also use smaller raises, so treat those charts as a solid baseline.'));
    deal();
  }

  function stacksPool() {
    return pushfold.stacks.filter((s) => BUCKETS.some((b) => st.buckets.includes(b.id) && s >= b.min && s <= b.max));
  }

  /** Mixed hands plus hands whose decision differs from a grid neighbour. */
  function borderline(freqs, key) {
    if (borderCache.has(key)) return borderCache.get(key);
    const out = new Uint8Array(169);
    const main = (i) => freqs[i] >= 0.5;
    for (let i = 0; i < 169; i++) {
      if (freqs[i] > 0.02 && freqs[i] < 0.98) { out[i] = 1; continue; }
      const r = Math.floor(i / 13), c = i % 13;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < 13 && cc >= 0 && cc < 13 && main(rr * 13 + cc) !== main(i)) { out[i] = 1; break; }
      }
    }
    borderCache.set(key, out);
    return out;
  }

  function deal() {
    const stacks = stacksPool();
    const role = st.role === 'both' ? (Math.random() < 0.5 ? 'sb' : 'bb') : st.role;
    const stack = stacks[Math.floor(Math.random() * stacks.length)];
    const freqs = role === 'sb' ? pushfold.push[stack] : pushfold.call[stack];
    let idx = core.randomHandIndex();
    if (st.close) {
      const b = borderline(freqs, role + stack);
      for (let k = 0; k < 500 && !b[idx]; k++) idx = core.randomHandIndex();
    }
    st.spot = { role, stack, idx, combo: core.randomCombo(idx), answer: null };
    renderSpot();
    renderPanel();
  }

  function actionsFor(sp) {
    if (sp.role === 'sb') {
      const p = pushfold.push[sp.stack][sp.idx];
      return [{ id: 'allin', label: 'All-in', kind: 'allin', freq: p }, { id: 'fold', label: 'Fold', kind: 'fold', freq: 1 - p }];
    }
    const c = pushfold.call[sp.stack][sp.idx];
    return [{ id: 'call', label: 'Call', kind: 'call', freq: c }, { id: 'fold', label: 'Fold', kind: 'fold', freq: 1 - c }];
  }

  /** EV gain (bb) of the aggressive/continue option over folding. */
  function evEdge(sp) {
    return sp.role === 'sb' ? pushfold.pushEV[sp.stack][sp.idx] + 0.5 : pushfold.callEV[sp.stack][sp.idx];
  }

  function renderSpot() {
    const sp = st.spot;
    const { role, stack, idx, combo, answer } = sp;
    const seats = role === 'sb'
      ? [{ pos: 'SB', state: 'hero', bet: 0.5, blind: true, note: `You · ${stack}bb` }, { pos: 'BB', state: 'waiting', bet: 1, blind: true, note: `${stack}bb` }]
      : [{ pos: 'BB', state: 'hero', bet: 1, blind: true, note: `You · ${stack}bb` }, { pos: 'SB', state: 'villain', bet: stack, note: 'All-in' }];
    const pot = role === 'sb' ? 1.5 : stack + 1;
    const actions = actionsFor(sp).slice().reverse();
    const keys = { allin: 'A', call: 'C', fold: 'F' };
    ui.put(els.spot,
      h('div', { class: 'spot-head' }, h('div', null,
        h('div', { class: 'eyebrow' }, 'Heads-up · ', stack, 'bb effective'),
        h('h2', { class: 'spot-title' }, role === 'sb' ? 'Shove or fold?' : 'Call the shove?'),
        h('p', { class: 'spot-sub' }, role === 'sb'
          ? `You are in the small blind (on the button) with ${stack}bb. The big blind has you covered.`
          : `The small blind moves all-in for ${stack}bb. You are in the big blind.`))),
      ui.pokerTable({ seats, dealer: 'SB', pot }),
      answer ? null : h('p', { class: 'story' }, h('b', null, 'What\u2019s happening: '), role === 'sb'
        ? `You have ${stack} big blinds. If you go all-in, the big blind must risk their whole stack to call, so they fold a lot and you often win the blinds without a fight. Strong hands and hands with an ace or high cards are worth the risk.`
        : `Calling costs ${ui.fmtBB(stack - 1)} more to win a pot of ${ui.fmtBB(2 * stack)}, so you need to win about ${Math.round(((stack - 1) / (2 * stack)) * 100)}% of the time against the hands they go all-in with. Their range is wide, so you can call with more than just premium hands.`),
      h('div', { class: 'hero-row' },
        ui.handCards(combo, { deal: !answer }),
        h('div', { class: 'hand-label' }, core.HAND_NAMES[idx], h('small', null, ui.describeHand(idx)))),
      h('div', { class: 'actions' }, actions.map((a, k) => h('button', {
        class: `act k-${a.kind}` + (answer && answer.id === a.id ? ' picked' : ''), type: 'button',
        disabled: !!answer, onClick: () => answerWith(a.id),
      }, a.label, h('small', null, explain.actionHint(a.id, a.label)), h('kbd', null, keys[a.id] || String(k + 1))))),
      answer ? verdict() : null,
      ui.sessionStrip(st.sess));
  }

  function verdict() {
    const sp = st.spot;
    const actions = actionsFor(sp);
    const edge = evEdge(sp);
    const name = core.HAND_NAMES[sp.idx];
    const g = sp.answer.grade;
    const act = sp.role === 'sb' ? 'Shoving' : 'Calling';
    const evLine = sp.role === 'sb'
      ? `On average, going all-in with ${name} wins ${ui.signed(pushfold.pushEV[sp.stack][sp.idx])}bb, while folding loses your 0.5bb small blind.`
      : `On average, calling with ${name} gains ${ui.signed(edge)}bb compared with folding, against the hands a GTO opponent goes all-in with.`;
    let msg;
    if (g.result === 'correct') msg = Math.abs(edge) < 0.05 ? `Right, though it is nearly break-even.` : `${act} is ${edge > 0 ? 'clearly' : 'clearly not'} profitable here.`;
    else if (g.result === 'inaccurate') msg = `Close call: the wrong side, but it only costs ${Math.abs(edge).toFixed(2)}bb on average.`;
    else msg = `That loses about ${Math.abs(edge).toFixed(2)}bb on average compared with the GTO play.`;
    return h('div', { class: 'verdict ' + g.result, role: 'status' },
      h('div', { class: 'verdict-top' },
        h('span', { class: 'verdict-tag' }, g.result === 'inaccurate' ? 'Small mistake' : ui.verdictLabel(g.result)),
        h('button', { class: 'btn', type: 'button', onClick: deal }, 'Next hand', h('kbd', null, 'Space'))),
      h('p', { class: 'verdict-msg' }, msg, ' ', h('span', { class: 'muted' }, evLine)),
      ui.strategyBar(actions),
      h('p', { class: 'why' }, h('b', null, `Why: ${explain.handFamily(sp.idx).name}. `), explain.handFamily(sp.idx).why));
  }

  function renderPanel() {
    const sp = st.spot;
    const isSB = sp.role === 'sb';
    const freqs = isSB ? pushfold.push[sp.stack] : pushfold.call[sp.stack];
    const kind = isSB ? 'allin' : 'call';
    const label = isSB ? 'All-in' : 'Call';
    const locked = !sp.answer;
    let share = 0;
    for (let i = 0; i < 169; i++) share += freqs[i] * core.comboCount(i);
    share /= 1326;
    const grid = ui.rangeGrid({
      label: 'Nash range',
      fill: locked ? () => [] : (i) => [{ kind, f: freqs[i] }, { kind: 'fold', f: 1 - freqs[i] }],
      highlight: locked ? null : sp.idx,
      title: (i) => (locked ? core.HAND_NAMES[i] : `${core.HAND_NAMES[i]}: ${label} ${ui.pct(freqs[i])}`),
    });
    ui.put(els.panel,
      h('div', { class: 'panel-title' },
        h('h2', null, locked ? 'Nash range' : `${isSB ? 'SB shoves' : 'BB calls'} at ${sp.stack}bb`),
        locked ? null : h('span', { class: 'muted' }, `${ui.pct(share, 1)} of hands`)),
      h('div', { class: 'grid-wrap' }, grid,
        locked ? h('div', { class: 'grid-lock' }, h('div', null, h('b', null, 'Act first'), 'The full chart for this stack appears after you answer.')) : null),
      locked ? null : ui.legend([{ kind, label, share }, { kind: 'fold', label: 'Fold', share: 1 - share }]),
      h('p', { class: 'grid-key' }, 'Diagonal: pairs · top-right: suited · bottom-left: offsuit. Strongest hands are top-left.'));
  }

  function answerWith(id) {
    const sp = st.spot;
    if (!sp || sp.answer) return;
    const actions = actionsFor(sp);
    let grade = strategy.grade(actions, id);
    if (grade.result === 'wrong' && Math.abs(evEdge(sp)) < 0.05) grade = { result: 'inaccurate', score: 0.5 };
    sp.answer = { id, grade };
    ui.bumpSession(st.sess, grade.score);
    const bucket = BUCKETS.find((b) => sp.stack >= b.min && sp.stack <= b.max) || { label: sp.stack + 'bb' };
    const spotLabel = `${sp.role === 'sb' ? 'SB shove' : 'BB call'} · ${bucket.label}`;
    store.record('pushfold', spotLabel, grade.score, `${sp.role === 'sb' ? 'SB' : 'BB'} ${sp.stack}bb · ${core.HAND_NAMES[sp.idx]}`);
    renderSpot();
    renderPanel();
  }

  function onKey(e) {
    if (!st.spot) return;
    const k = e.key.toLowerCase();
    if (st.spot.answer) {
      if (k === ' ' || k === 'enter' || k === 'n') { e.preventDefault(); deal(); }
      return;
    }
    const map = st.spot.role === 'sb' ? { f: 'fold', a: 'allin', r: 'allin', 1: 'fold', 2: 'allin' } : { f: 'fold', c: 'call', 1: 'fold', 2: 'call' };
    if (map[k]) { e.preventDefault(); answerWith(map[k]); }
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.pushfold = { id: 'pushfold', label: 'Push/Fold', mount, onKey };
})(typeof window !== 'undefined' ? window : globalThis);
