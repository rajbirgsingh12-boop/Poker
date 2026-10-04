/* GTO math drills: the pot-odds and indifference numbers behind every bet size. */
(function (root) {
  'use strict';
  const { ui, store } = root.GTO;
  const { h } = ui;

  const SIZES = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2];
  const POTS = [6, 8, 10, 12, 15, 18, 20, 24, 30, 36, 40, 50, 60, 80];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const p1 = (x) => (x * 100).toFixed(1) + '%';

  const TYPES = [
    {
      id: 'potodds', label: 'Pot odds', plain: 'When to call',
      intro: 'Pot odds compare what you have to pay with what you can win. If your hand wins more often than this number, calling makes money in the long run.',
      ask: (P, B) => [`The pot is `, h('b', null, `${P}bb`), `. Your opponent bets `, h('b', null, `${B}bb`), `. How much equity do you need to call?`],
      answer: (P, B) => B / (P + 2 * B),
      work: (P, B) => `required equity = call ÷ final pot = ${B} ÷ (${P} + ${B} + ${B}) = ${p1(B / (P + 2 * B))}`,
      concept: 'You risk the call to win everything in the middle, including your own call. If your hand wins more often than this, the call makes money.',
      bars: (P, B) => [['Pot', P, 'var(--felt)'], ['Bet', B, 'var(--act-aggr)'], ['Your call', B, 'var(--act-call)']],
    },
    {
      id: 'mdf', label: 'Minimum defense', plain: 'How often to defend',
      intro: 'If you fold too often when someone bets, they can bet with any two cards and make money. This number is how often you need to keep playing.',
      ask: (P, B) => [`Your opponent bets `, h('b', null, `${B}bb`), ` into `, h('b', null, `${P}bb`), `. What share of your range must continue so that a bluff with any two cards cannot profit automatically?`],
      answer: (P, B) => P / (P + B),
      work: (P, B) => `MDF = pot ÷ (pot + bet) = ${P} ÷ (${P} + ${B}) = ${p1(P / (P + B))}`,
      concept: 'Fold more often than this and your opponent can bet every hand at a profit. You defend roughly this often, choosing your best bluff-catchers.',
      bars: (P, B) => [['Pot', P, 'var(--felt)'], ['Bet', B, 'var(--act-aggr)']],
    },
    {
      id: 'alpha', label: 'Bluff break-even', plain: 'When a bluff pays',
      intro: 'A bluff is a bet with a weak hand, hoping your opponent folds. Bigger bets risk more, so they need your opponent to fold more often.',
      ask: (P, B) => [`You bluff `, h('b', null, `${B}bb`), ` into a `, h('b', null, `${P}bb`), ` pot with a hand that never wins at showdown. How often must your opponent fold for the bluff to break even?`],
      answer: (P, B) => B / (P + B),
      work: (P, B) => `break-even fold rate = bet ÷ (pot + bet) = ${B} ÷ (${P} + ${B}) = ${p1(B / (P + B))}`,
      concept: 'This is the mirror image of minimum defense: the two always add up to 100%. Bigger bets need more folds.',
      bars: (P, B) => [['Pot', P, 'var(--felt)'], ['Your bet', B, 'var(--act-aggr)']],
    },
    {
      id: 'bluffs', label: 'River bluff share', plain: 'How many bluffs',
      intro: 'A GTO player bets strong hands and some bluffs. Never bluff and opponents fold everything but their best hands; bluff too much and they call everything.',
      ask: (P, B) => [`On the river you bet `, h('b', null, `${B}bb`), ` into `, h('b', null, `${P}bb`), ` with a polarized range: strong hands and pure bluffs. What share of your bets should be bluffs so your opponent is indifferent to calling?`],
      answer: (P, B) => B / (P + 2 * B),
      work: (P, B) => `bluff share = bet ÷ (pot + 2 × bet) = ${B} ÷ (${P} + 2 × ${B}) = ${p1(B / (P + 2 * B))}`,
      concept: 'Your bluffs match the price you offer. A pot-size bet lays 2:1, so you bluff once for every two value bets (33%). Bigger bets support more bluffs.',
      bars: (P, B) => [['Pot', P, 'var(--felt)'], ['Your bet', B, 'var(--act-aggr)']],
    },
  ];

  let st, els;

  function mount(container) {
    st = { types: store.setting('math.types', TYPES.map((t) => t.id)), sess: ui.newSession(), q: null };
    els = { spot: h('div', { class: 'card card-pad' }), panel: h('div', { class: 'card card-pad' }) };
    ui.put(container,
      h('div', { class: 'mode-head' },
        h('h1', null, 'GTO math: bet sizes made simple'),
        h('p', null, 'A handful of formulas explain most GTO decisions after the flop. No algebra needed: pick the right percentage, then read how it is worked out. "bb" means big blinds.')),
      h('div', { class: 'config' },
        ui.chipGroup({ label: 'Question types', multi: true, selected: st.types, options: TYPES.map((t) => ({ id: t.id, label: t.plain, title: t.label })),
          onChange: (v) => { st.types = v; store.setSetting('math.types', v); next(); } })),
      h('div', { class: 'work' }, els.spot, els.panel));
    renderPanel();
    next();
  }

  function next() {
    const type = pick(TYPES.filter((t) => st.types.includes(t.id)));
    const P = pick(POTS);
    const frac = pick(SIZES);
    const B = Math.max(1, Math.round(P * frac * 2) / 2);
    const correct = type.answer(P, B);
    st.q = { type, P, B, frac: B / P, correct, options: options(P, B, correct), picked: null };
    renderSpot();
    renderPanel();
  }

  /** Correct answer plus three distractors built from the formulas people mix up. */
  function options(P, B, correct) {
    const pool = [B / (P + 2 * B), P / (P + B), B / (P + B), B / P, (P + B) / (P + 2 * B), (2 * B) / (P + 2 * B)]
      .filter((x) => x > 0.02 && x < 0.98);
    const chosen = [correct];
    const far = (x) => chosen.every((c) => Math.abs(c - x) >= 0.03);
    for (const x of pool.sort(() => Math.random() - 0.5)) if (chosen.length < 4 && far(x)) chosen.push(x);
    for (let k = 1; chosen.length < 4 && k < 20; k++) {
      for (const x of [correct + 0.07 * k, correct - 0.07 * k]) if (chosen.length < 4 && x > 0.02 && x < 0.98 && far(x)) chosen.push(x);
    }
    return chosen.sort((a, b) => a - b);
  }

  function renderSpot() {
    const q = st.q;
    const answered = q.picked != null;
    const max = Math.max(...q.type.bars(q.P, q.B).map((b) => b[1]));
    ui.put(els.spot,
      h('div', { class: 'spot-head' }, h('div', null,
        h('div', { class: 'eyebrow' }, q.type.label, ' · bet is ', Math.round(q.frac * 100), '% of the pot'),
        h('h2', { class: 'spot-title' }, `${q.B}bb into ${q.P}bb`))),
      h('div', { class: 'pot-diagram', 'aria-hidden': 'true' }, q.type.bars(q.P, q.B).map(([label, v, color]) =>
        h('div', { class: 'col' },
          h('div', { class: 'stack', style: { height: Math.max(6, (v / max) * 80) + 'px', background: color } }),
          h('span', null, `${label} ${v}bb`)))),
      answered ? null : h('p', { class: 'story' }, h('b', null, q.type.plain + ': '), q.type.intro),
      h('p', { class: 'question' }, q.type.ask(q.P, q.B)),
      h('div', { class: 'options' }, q.options.map((x, k) => {
        const isRight = x === q.correct;
        const cls = 'opt' + (answered && isRight ? ' right' : '') + (answered && q.picked === k && !isRight ? ' miss' : '');
        return h('button', { class: cls, type: 'button', disabled: answered, onClick: () => answer(k) }, h('kbd', null, k + 1), Math.round(x * 100) + '%');
      })),
      answered ? verdict() : null,
      ui.sessionStrip(st.sess));
  }

  function verdict() {
    const q = st.q;
    const ok = q.options[q.picked] === q.correct;
    return h('div', { class: 'verdict ' + (ok ? 'correct' : 'wrong'), role: 'status' },
      h('div', { class: 'verdict-top' },
        h('span', { class: 'verdict-tag' }, ok ? 'Correct' : 'Not quite'),
        h('button', { class: 'btn', type: 'button', onClick: next }, 'Next', h('kbd', null, 'Space'))),
      h('div', { class: 'formula' }, q.type.work(q.P, q.B)),
      h('p', { class: 'muted' }, q.type.concept));
  }

  function renderPanel() {
    const hl = st.q && st.q.picked != null ? SIZES.reduce((a, b) => (Math.abs(b - st.q.frac) < Math.abs(a - st.q.frac) ? b : a)) : null;
    const rows = SIZES.map((f) => h('tr', { style: f === hl ? { background: 'var(--brass-soft)' } : null },
      h('td', null, h('b', null, Math.round(f * 100) + '%')),
      h('td', null, p1(f / (1 + 2 * f))),
      h('td', null, p1(1 / (1 + f))),
      h('td', null, p1(f / (1 + f)))));
    ui.put(els.panel,
      h('div', { class: 'panel-title' }, h('h2', null, 'Bet size cheat sheet')),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, 'Bet'), h('th', null, 'Equity to call'), h('th', null, 'MDF'), h('th', null, 'Bluff needs'))),
          h('tbody', null, rows))),
      h('div', { class: 'concepts', style: { marginTop: '16px' } },
        h('div', { class: 'concept' }, h('h3', null, 'Equity to call = river bluff share'),
          h('p', null, 'Both are bet ÷ (pot + 2 × bet). When your bluffs make up exactly the share of your range that matches the caller’s pot odds, bluff-catchers break even.')),
        h('div', { class: 'concept' }, h('h3', null, 'MDF + bluff break-even = 100%'),
          h('p', null, 'If the bettor needs folds 33% of the time to profit with a bluff, the defender must continue 67% of the time to stop it.')),
        h('div', { class: 'concept' }, h('h3', null, 'Why it matters'),
          h('p', null, 'An equilibrium strategy makes the opponent indifferent with their marginal hands. These ratios are how a solver sizes its value bets, bluffs and defence.'))));
  }

  function answer(k) {
    const q = st.q;
    if (q.picked != null) return;
    q.picked = k;
    const score = q.options[k] === q.correct ? 1 : 0;
    ui.bumpSession(st.sess, score);
    store.record('math', q.type.label, score, `${q.type.label} · ${q.B}bb into ${q.P}bb`);
    renderSpot();
    renderPanel();
  }

  function onKey(e) {
    if (!st.q) return;
    const k = e.key;
    if (st.q.picked != null) {
      if (k === ' ' || k === 'Enter' || k === 'n') { e.preventDefault(); next(); }
      return;
    }
    if (/^[1-4]$/.test(k)) { e.preventDefault(); answer(Number(k) - 1); }
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.math = { id: 'math', label: 'GTO Math', mount, onKey };
})(typeof window !== 'undefined' ? window : globalThis);
