/* Equity estimation drill: guess your all-in equity preflop, hand against hand. */
(function (root) {
  'use strict';
  const { core, ui, store } = root.GTO;
  const { h } = ui;

  let EQ = null; // decoded lazily
  const eqTable = () => (EQ ||= core.decodeEquity(root.GTO.equityUpper));

  const rankOf = (idx) => {
    const r = Math.floor(idx / 13), c = idx % 13;
    return r === c ? [r, r] : [Math.min(r, c), Math.max(r, c)]; // grid ranks, 0 = ace; [high, low]
  };
  const isPair = (i) => core.handType(i) === 'pair';

  const CATEGORIES = [
    {
      id: 'flip', label: 'Pair vs overcards',
      test: (a, b) => isPair(a) && !isPair(b) && rankOf(b)[1] < rankOf(a)[0],
      tip: 'A pair against two overcards is the classic coin flip: usually 50–57% for the pair. Suited, connected overcards close the gap.',
    },
    {
      id: 'pairs', label: 'Pair vs pair',
      test: (a, b) => isPair(a) && isPair(b) && a !== b,
      tip: 'A bigger pair against a smaller pair is roughly 80/20. The underpair mostly needs to hit a set (about 1 in 8.5 by the river).',
    },
    {
      id: 'dominated', label: 'Dominated hands',
      test: (a, b) => {
        if (isPair(a) || isPair(b)) return false;
        const ra = rankOf(a), rb = rankOf(b);
        const shared = ra.filter((r) => rb.includes(r));
        return shared.length === 1 && shared[0] <= 4; // share an ace through ten: AK vs AQ, KQ vs KJ
      },
      tip: 'When two hands share a card, the better kicker usually wins 65–75%. Being dominated is why weak aces and kings lose money.',
    },
    {
      id: 'overunder', label: 'Overs vs unders',
      test: (a, b) => !isPair(a) && !isPair(b) && rankOf(a)[1] < rankOf(b)[0],
      tip: 'Two overcards against two undercards are usually 60–70% favourites. Suited connectors are the strongest underdogs because they make straights and flushes.',
    },
    {
      id: 'pairmix', label: 'Pair vs one over',
      test: (a, b) => isPair(a) && !isPair(b) && rankOf(b)[0] < rankOf(a)[0] && rankOf(b)[1] > rankOf(a)[0],
      tip: 'A pair against one overcard and one undercard is around 70/30 for the pair: the other hand has only three outs to pair its big card.',
    },
    {
      id: 'any', label: 'Anything',
      test: () => true,
      tip: 'Rough guide: a pair vs two unders is about 85%, pair vs overcards is a flip, a dominating hand is about 70%, and suited adds roughly 2–3%.',
    },
  ];

  let st, els;

  function mount(container) {
    st = {
      cats: store.setting('eq.cats', ['flip', 'pairs', 'dominated', 'overunder', 'pairmix']),
      sess: ui.newSession(),
      spot: null,
      guess: 50,
    };
    els = { spot: h('div', { class: 'card card-pad' }), panel: h('div', { class: 'card card-pad' }) };
    ui.put(container,
      h('div', { class: 'mode-head' },
        h('h1', null, 'Equity: how often do you win?'),
        h('p', null, 'Two players are all-in before the flop, so all five cards get dealt. Guess how often your hand wins. Knowing these numbers by feel makes every other decision easier.')),
      h('div', { class: 'config' },
        ui.chipGroup({ label: 'Matchups', multi: true, selected: st.cats, options: CATEGORIES,
          onChange: (v) => { st.cats = v; store.setSetting('eq.cats', v); deal(); } })),
      h('div', { class: 'work' }, els.spot, els.panel),
      h('p', { class: 'foot' }, 'Equities come from a 169×169 table computed by Monte Carlo simulation (1,000,000 boards per matchup) and are averaged over every suit combination.'));
    deal();
  }

  function deal() {
    const cats = CATEGORIES.filter((c) => st.cats.includes(c.id));
    const cat = cats[Math.floor(Math.random() * cats.length)];
    let a, b;
    for (let k = 0; k < 5000; k++) {
      a = core.randomHandIndex();
      b = core.randomHandIndex();
      if (a === b) continue;
      if (cat.test(a, b)) break;
      if (cat.test(b, a)) { [a, b] = [b, a]; break; }
    }
    if (Math.random() < 0.5 && cat.id !== 'any') [a, b] = [b, a]; // you are not always the favourite
    const ca = core.randomCombo(a);
    let cb;
    do { cb = core.randomCombo(b); } while (cb.some((x) => ca.includes(x)));
    st.spot = { cat, a, b, ca, cb, answer: null };
    st.guess = 50;
    renderSpot();
    renderPanel();
  }

  function renderSpot() {
    const sp = st.spot;
    const { a, b, ca, cb, answer } = sp;
    const read = h('b', null, st.guess);
    const slider = h('input', { type: 'range', class: 'slider', id: 'eq-guess', min: '0', max: '100', step: '1', value: String(st.guess), disabled: !!answer, 'aria-label': 'Your equity estimate in percent' });
    slider.addEventListener('input', () => { st.guess = Number(slider.value); read.textContent = st.guess; });
    ui.put(els.spot,
      h('div', { class: 'spot-head' }, h('div', null,
        h('div', { class: 'eyebrow' }, sp.cat.label),
        h('h2', { class: 'spot-title' }, `${core.HAND_NAMES[a]} vs ${core.HAND_NAMES[b]}`),
        h('p', { class: 'spot-sub' }, 'All-in preflop. What is your equity?'))),
      h('div', { class: 'versus' },
        h('div', { class: 'side' }, h('span', { class: 'side-label' }, 'You'), ui.handCards(ca, { deal: !answer }), h('span', { class: 'hand-label' }, core.HAND_NAMES[a])),
        h('span', { class: 'vs' }, 'vs'),
        h('div', { class: 'side' }, h('span', { class: 'side-label' }, 'Opponent'), ui.handCards(cb, { deal: !answer }), h('span', { class: 'hand-label' }, core.HAND_NAMES[b]))),
      answer ? null : h('p', { class: 'story' }, h('b', null, 'How to answer: '), 'drag the slider (or use the arrow keys) to your guess. 50% is a coin flip, 80% means you win 4 times out of 5. Ties count as half a win.'),
      h('div', { class: 'guess' },
        h('div', { class: 'guess-read' }, read, h('span', null, '%')),
        slider,
        answer ? null : h('button', { class: 'btn', type: 'button', onClick: submit }, 'Lock in', h('kbd', null, 'Enter'))),
      answer ? verdict() : null,
      ui.sessionStrip(st.sess));
  }

  function verdict() {
    const sp = st.spot;
    const actual = eqTable()[sp.a][sp.b] * 100;
    const err = st.guess - actual;
    const res = sp.answer.result;
    const tag = res === 'correct' ? 'Spot on' : res === 'inaccurate' ? 'Close' : 'Off target';
    return h('div', { class: 'verdict ' + res, role: 'status' },
      h('div', { class: 'verdict-top' },
        h('span', { class: 'verdict-tag' }, tag),
        h('button', { class: 'btn', type: 'button', onClick: deal }, 'Next', h('kbd', null, 'Space'))),
      h('p', { class: 'verdict-msg' }, `${core.HAND_NAMES[sp.a]} has `, h('b', null, actual.toFixed(1) + '%'),
        ` against ${core.HAND_NAMES[sp.b]}. You said ${st.guess}% (${err > 0 ? '+' : ''}${err.toFixed(1)} points).`),
      h('div', { class: 'eqbar', role: 'img', 'aria-label': `Actual ${actual.toFixed(1)}%, your guess ${st.guess}%` },
        h('div', { class: 'fill', style: { width: actual + '%' } }),
        h('div', { class: 'mark', style: { left: st.guess + '%' }, title: 'Your guess' }),
        h('span', { class: 'lbl', style: { left: '10px' } }, core.HAND_NAMES[sp.a] + ' ' + actual.toFixed(1) + '%'),
        h('span', { class: 'lbl', style: { right: '10px' } }, core.HAND_NAMES[sp.b] + ' ' + (100 - actual).toFixed(1) + '%')),
      h('p', { class: 'muted' }, sp.cat.tip));
  }

  function heat(e) {
    // 0.5 is neutral; push toward call colour above and raise colour below
    const d = Math.min(1, Math.abs(e - 0.5) / 0.4);
    const tone = e >= 0.5 ? 'var(--g-call)' : 'var(--g-aggr)';
    return `color-mix(in srgb, ${tone} ${Math.round(15 + d * 85)}%, var(--g-void))`;
  }

  function renderPanel() {
    const sp = st.spot;
    const locked = !sp.answer;
    const eq = locked ? null : eqTable();
    const readout = h('p', { class: 'muted' }, locked ? '' : `Hover a hand to see ${core.HAND_NAMES[sp.a]}'s equity against it.`);
    const grid = ui.rangeGrid({
      label: 'Equity against every hand',
      fill: locked ? () => [] : (i) => ({ css: heat(eq[sp.a][i]) }),
      highlight: locked ? null : sp.b,
      title: (i) => (locked ? core.HAND_NAMES[i] : `vs ${core.HAND_NAMES[i]}: ${(eq[sp.a][i] * 100).toFixed(1)}%`),
      onHover: locked ? null : (i) => { readout.textContent = `${core.HAND_NAMES[sp.a]} vs ${core.HAND_NAMES[i]}: ${(eq[sp.a][i] * 100).toFixed(1)}%`; },
    });
    ui.put(els.panel,
      h('div', { class: 'panel-title' }, h('h2', null, locked ? 'Against every hand' : `${core.HAND_NAMES[sp.a]} against every hand`)),
      h('div', { class: 'grid-wrap' }, grid,
        locked ? h('div', { class: 'grid-lock' }, h('div', null, h('b', null, 'Guess first'), 'Then see how your hand does against all 169 starting hands.')) : null),
      locked ? null : h('div', { class: 'legend' },
        h('span', null, h('i', { style: { background: heat(0.1) } }), 'Big underdog'),
        h('span', null, h('i', { style: { background: heat(0.5) } }), 'Coin flip'),
        h('span', null, h('i', { style: { background: heat(0.9) } }), 'Big favourite')),
      readout);
  }

  function submit() {
    const sp = st.spot;
    if (!sp || sp.answer) return;
    const actual = eqTable()[sp.a][sp.b] * 100;
    const err = Math.abs(st.guess - actual);
    const result = err <= 3 ? 'correct' : err <= 7 ? 'inaccurate' : 'wrong';
    const score = result === 'correct' ? 1 : result === 'inaccurate' ? 0.5 : 0;
    sp.answer = { result };
    ui.bumpSession(st.sess, score);
    store.record('equity', sp.cat.label, score, `${core.HAND_NAMES[sp.a]} vs ${core.HAND_NAMES[sp.b]}`);
    renderSpot();
    renderPanel();
  }

  function onKey(e) {
    if (!st.spot) return;
    const k = e.key;
    if (st.spot.answer) {
      if (k === ' ' || k === 'Enter' || k === 'n') { e.preventDefault(); deal(); }
      return;
    }
    if (k === 'Enter') { e.preventDefault(); submit(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      if (document.activeElement && document.activeElement.id === 'eq-guess') return; // native slider handles it
      e.preventDefault();
      const step = (e.shiftKey ? 5 : 1) * (k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 1);
      st.guess = Math.max(0, Math.min(100, st.guess + step));
      const slider = document.getElementById('eq-guess');
      if (slider) slider.value = String(st.guess);
      const read = els.spot.querySelector('.guess-read b');
      if (read) read.textContent = st.guess;
    }
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.equity = { id: 'equity', label: 'Equity', mount, onKey, CATEGORIES };
})(typeof window !== 'undefined' ? window : globalThis);
