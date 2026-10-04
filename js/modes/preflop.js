/* Preflop trainer: deal a spot and a hand, pick an action, compare to the strategy. */
(function (root) {
  'use strict';
  const { core, preflop, strategy, ui, store, explain } = root.GTO;
  const { h } = ui;

  const KEYS = { aggr: 'R', allin: 'A', call: 'C', fold: 'F' };
  let st, els;

  function mount(container) {
    st = {
      groups: store.setting('pf.groups', ['rfi']),
      positions: store.setting('pf.positions', preflop.POSITIONS.slice()),
      borderline: store.setting('pf.borderline', true),
      rng: store.setting('pf.rng', false),
      sess: ui.newSession(),
      spot: null,
    };
    els = {
      spot: h('div', { class: 'card card-pad' }),
      panel: h('div', { class: 'card card-pad' }),
      notice: h('p', { class: 'empty', hidden: true }, 'No spots match these filters. "You got re-raised" is only practised from UTG, CO, BTN and SB, and the big blind is never the first to raise.'),
    };
    ui.put(container,
      h('div', { class: 'mode-head' },
        h('h1', null, 'Preflop: which hands to play'),
        h('p', null, 'You get a seat and two cards before the flop. Pick what a GTO player would do. Six players, everyone starts with 100 big blinds.')),
      config(),
      els.notice,
      h('div', { class: 'work' }, els.spot, els.panel),
      h('p', { class: 'foot' }, 'These charts are simplified versions of professional solver results for 6-player games (raises to 2.5bb, or 3bb from the small blind). Real solutions shift a little with the rake, bet sizes and stack depth.'));
    deal();
  }

  function config() {
    return h('div', { class: 'config' },
      ui.chipGroup({
        label: 'Situation', multi: true, selected: st.groups,
        options: preflop.GROUPS.map((g) => ({ id: g.id, label: g.label, title: g.blurb })),
        onChange: (v) => { st.groups = v; store.setSetting('pf.groups', v); deal(); },
      }),
      ui.chipGroup({
        label: 'Your seat', multi: true, selected: st.positions,
        options: preflop.POSITIONS.map((p) => ({ id: p, label: p, title: `${explain.POSITIONS[p].name}: ${explain.POSITIONS[p].short}` })),
        onChange: (v) => { st.positions = v; store.setSetting('pf.positions', v); deal(); },
      }),
      h('div', { class: 'ctl' },
        h('span', { class: 'ctl-label' }, 'Options'),
        h('div', { class: 'chips' },
          ui.toggle({ id: 'pf-borderline', label: 'Skip easy hands', checked: st.borderline, onChange: (v) => { st.borderline = v; store.setSetting('pf.borderline', v); deal(); } }),
          ui.toggle({ id: 'pf-rng', label: 'Random number (advanced)', checked: st.rng, onChange: (v) => { st.rng = v; store.setSetting('pf.rng', v); deal(); } }))));
  }

  function pool() {
    return preflop.scenarios.filter((s) => st.groups.includes(s.group) && st.positions.includes(s.hero));
  }

  function deal() {
    const list = pool();
    els.notice.hidden = list.length > 0;
    if (!list.length) {
      ui.put(els.spot, h('p', { class: 'empty' }, 'Pick at least one spot type that exists for the selected positions.'));
      ui.put(els.panel, );
      st.spot = null;
      return;
    }
    const scn = list[Math.floor(Math.random() * list.length)];
    const strat = strategy.getStrategy(scn.id);
    const idx = strategy.dealHand(strat, { borderlineOnly: st.borderline });
    st.spot = {
      scn, strat, idx,
      combo: core.randomCombo(idx),
      roll: st.rng ? 1 + Math.floor(Math.random() * 100) : null,
      answer: null,
    };
    renderSpot();
    renderPanel();
  }

  function seats(scn) {
    const P = ui.SIX_MAX;
    const openSize = (pos) => (pos === 'SB' ? 3 : 2.5);
    const order = (pos) => P.indexOf(pos);
    const out = P.map((pos) => ({ pos, state: 'waiting', bet: 0 }));
    const get = (pos) => out[order(pos)];
    get('SB').bet = 0.5; get('SB').blind = true;
    get('BB').bet = 1; get('BB').blind = true;
    let dead = 0;
    const fold = (s) => { dead += s.bet; s.bet = 0; s.state = 'folded'; };
    if (scn.group === 'rfi') {
      out.forEach((s) => { if (order(s.pos) < order(scn.hero)) fold(s); });
    } else if (scn.group === 'vsOpen') {
      const v = get(scn.villain);
      v.state = 'villain'; v.bet = openSize(scn.villain); v.blind = false; v.note = 'Raise';
      out.forEach((s) => { if (s !== v && order(s.pos) < order(scn.hero)) fold(s); });
    } else {
      const v = get(scn.villain);
      const hero = get(scn.hero);
      hero.bet = openSize(scn.hero); hero.blind = false;
      v.state = 'villain'; v.bet = threeBetSize(scn); v.blind = false; v.note = '3-bet';
      out.forEach((s) => { if (s !== v && s !== hero) fold(s); });
    }
    const hero = get(scn.hero);
    hero.state = 'hero'; hero.note = 'You';
    const pot = out.reduce((a, s) => a + s.bet, 0) + dead;
    return { seats: out, pot };
  }

  function threeBetSize(scn) {
    const m = scn.setup.match(/3-bets to ([\d.]+)bb/);
    return m ? parseFloat(m[1]) : 7.5;
  }

  function groupLabel(id) {
    return preflop.GROUPS.find((g) => g.id === id).label;
  }

  function renderSpot() {
    const { scn, strat, idx, combo, roll, answer } = st.spot;
    const { seats: s, pot } = seats(scn);
    const buttons = strat.actions.slice().reverse().map((a, k) => h('button', {
      class: `act k-${a.kind}` + (answer && answer.id === a.id ? ' picked' : ''),
      type: 'button', disabled: !!answer, 'data-action': a.id,
      onClick: () => answerWith(a.id),
    }, a.label, h('small', null, explain.actionHint(a.id, a.label)), h('kbd', null, KEYS[a.kind] || String(k + 1))));

    ui.put(els.spot,
      h('div', { class: 'spot-head' },
        h('div', null,
          h('div', { class: 'eyebrow' }, groupLabel(scn.group), ' · 6 players · 100bb'),
          h('h2', { class: 'spot-title' }, scn.title),
          h('p', { class: 'spot-sub' }, scn.setup))),
      ui.pokerTable({ seats: s, dealer: 'BTN', pot }),
      answer ? null : h('p', { class: 'story' }, h('b', null, 'What\u2019s happening: '), explain.spotStory(scn)),
      h('div', { class: 'hero-row' },
        ui.handCards(combo, { deal: !answer }),
        h('div', { class: 'hand-label' }, core.HAND_NAMES[idx], h('small', null, ui.describeHand(idx))),
        roll != null ? h('div', { class: 'rng', title: 'Random number for mixed hands: low numbers take the aggressive action, then call, then fold.' }, h('b', null, roll), h('span', null, '1–100')) : null),
      h('div', { class: 'actions' }, buttons),
      answer ? verdict() : null,
      ui.sessionStrip(st.sess));
  }

  function verdict() {
    const { scn, strat, idx, roll, answer } = st.spot;
    const actions = strategy.handStrategy(strat, idx);
    const chosen = actions.find((a) => a.id === answer.id);
    const name = core.HAND_NAMES[idx];
    const family = explain.handFamily(idx);
    const mixed = Math.max(...actions.map((a) => a.freq)) < 0.9;
    let msg;
    if (roll != null) {
      const target = actions.find((a) => a.id === answer.grade.target);
      msg = answer.grade.result === 'correct'
        ? `Your number ${roll} lands in the ${target.label} band.`
        : `Your number ${roll} lands in the ${target.label} band. ${chosen.freq > 0 ? `${chosen.label} is still part of the mix (${ui.pct(chosen.freq)}).` : `${chosen.label} is never played with ${name} here.`}`;
    } else if (answer.id === 'limp') {
      msg = scn.hero === 'SB'
        ? 'Calling here is called limping. Real solvers do limp quite a few hands from the small blind, but this trainer uses a simpler raise-or-fold plan, so it gets half credit.'
        : 'Calling when nobody has raised is called limping, and GTO never does it from this seat. Raising can win the blinds straight away and gives you the lead; limping invites the players behind to raise you, and you win nothing up front. If a hand is good enough to play, raise it. Otherwise fold.';
    } else if (answer.grade.result === 'correct') {
      msg = chosen.freq >= 0.9 ? `${chosen.label} is the GTO play with ${name}.` : `${name} mixes here, and ${chosen.label.toLowerCase()} is a regular part of it.`;
    } else if (answer.grade.result === 'inaccurate') {
      msg = `${chosen.label} is only played ${ui.pct(chosen.freq)} of the time with ${name} here.`;
    } else {
      const best = actions.reduce((a, b) => (b.freq > a.freq ? b : a));
      msg = `${chosen.label} is never played with ${name} here. The main play is ${best.label.toLowerCase()} (${ui.pct(best.freq)}).`;
    }
    return h('div', { class: 'verdict ' + answer.grade.result, role: 'status' },
      h('div', { class: 'verdict-top' },
        h('span', { class: 'verdict-tag' }, ui.verdictLabel(answer.grade.result)),
        h('button', { class: 'btn', type: 'button', onClick: deal }, 'Next hand', h('kbd', null, 'Space'))),
      h('p', { class: 'verdict-msg' }, msg),
      ui.strategyBar(actions),
      h('p', { class: 'why' }, h('b', null, `Why: ${family.name}. `), family.why, mixed ? ' ' + explain.MIX_NOTE : ''),
      deepDive());
  }

  function renderPanel() {
    const { scn, strat, idx, answer } = st.spot;
    const fill = (i) => (strat.inRange[i] ? strategy.handStrategy(strat, i).map((a) => ({ kind: a.kind, f: a.freq })) : null);
    const locked = !answer;
    const grid = ui.rangeGrid({
      label: scn.title + ' range',
      fill: locked ? () => [] : fill,
      highlight: locked ? null : idx,
      title: (i) => {
        if (locked) return core.HAND_NAMES[i];
        if (!strat.inRange[i]) return `${core.HAND_NAMES[i]}: not in your opening range`;
        return `${core.HAND_NAMES[i]}: ${ui.freqSentence(strategy.handStrategy(strat, i))}`;
      },
    });
    ui.put(els.panel,
      h('div', { class: 'panel-title' },
        h('h2', null, locked ? 'Range' : scn.title),
        h('span', { class: 'muted' }, scn.group === 'vs3bet' ? 'Greyed hands are not in your opening range' : '')),
      h('div', { class: 'grid-wrap' }, grid,
        locked ? h('div', { class: 'grid-lock' }, h('div', null, h('b', null, 'Act first'), 'The full strategy for this spot appears here after you answer.')) : null),
      locked ? null : ui.legend(strategy.actionTotals(strat).filter((t) => t.share > 0).reverse()),
      h('p', { class: 'grid-key' }, 'Diagonal: pairs · top-right: suited · bottom-left: offsuit. Strongest hands are top-left.'));
  }

  /* ---------- deeper analysis ---------- */
  let EQ = null;
  const eqTable = () => (EQ ||= core.decodeEquity(root.GTO.equityUpper));
  const pairW = new Map();
  function comboPairs(i, j) {
    const k = i * 169 + j;
    if (!pairW.has(k)) pairW.set(k, core.comboPairs(i, j));
    return pairW.get(k);
  }

  /** Equity of hand i against a weighted range, with exact card removal. */
  function eqVsRange(i, w) {
    const eq = eqTable();
    let num = 0, den = 0;
    for (let j = 0; j < 169; j++) {
      if (!w[j]) continue;
      const n = w[j] * comboPairs(i, j);
      num += n * eq[i][j];
      den += n;
    }
    return den ? num / den : 0.5;
  }

  let rankCache = null;
  /** Share of all starting hands that have more equity than hand i against a random hand. */
  function strengthTop(i) {
    if (!rankCache) {
      const all = new Float64Array(169).fill(1);
      rankCache = Array.from({ length: 169 }, (_, k) => eqVsRange(k, all));
    }
    let better = 0;
    for (let k = 0; k < 169; k++) if (rankCache[k] > rankCache[i]) better += core.comboCount(k);
    return { eq: rankCache[i], top: (better + core.comboCount(i)) / 1326 };
  }

  /** The range the opponent is representing in this spot. */
  function villainRange(scn) {
    if (scn.group === 'vsOpen') return { w: strategy.getStrategy('rfi-' + scn.villain).actions[0].freq, what: `${scn.villain}'s opening range` };
    if (scn.group === 'vs3bet') {
      const src = preflop.scenarios.find((s) => s.group === 'vsOpen' && s.hero === scn.villain && s.villain === scn.hero);
      if (src) return { w: strategy.getStrategy(src.id).actions[0].freq, what: `${scn.villain}'s 3-bet range` };
    }
    return null;
  }

  function deepDive() {
    const { scn, strat, idx } = st.spot;
    const name = core.HAND_NAMES[idx];
    const rows = [];
    const s = strengthTop(idx);
    rows.push(['Hand strength', `${name} wins ${ui.pct(s.eq, 1)} against a random hand, which puts it in the top ${ui.pct(s.top, 0)} of starting hands. It has ${core.comboCount(idx)} combos.`]);

    const totals = strategy.actionTotals(strat).filter((t) => t.share > 0 && t.id !== 'fold');
    rows.push(['This spot', `${scn.title}: ${totals.map((t) => `${t.label.toLowerCase()} ${ui.pct(t.share, 1)}`).join(', ')} of ${scn.group === 'vs3bet' ? 'the hands you opened' : 'all hands'}, fold the rest.`]);

    if (scn.group === 'rfi') {
      const left = explain.POSITIONS[scn.hero].behind;
      // chance at least one player behind holds a hand in the top ~15% (a strong hand), ignoring card removal
      const strong = 1 - Math.pow(1 - 0.15, left);
      rows.push(['Players behind', `${left} player${left === 1 ? '' : 's'} still act after you. The chance at least one of them holds a top-15% hand is about ${ui.pct(strong)}. That is why early seats open fewer hands.`]);
    }

    const vr = villainRange(scn);
    if (vr) {
      const e = eqVsRange(idx, vr.w);
      rows.push(['Vs their range', `Against ${vr.what} (${ui.pct(core.rangePercent(vr.w) / 100, 1)} of hands), ${name} has ${ui.pct(e, 1)} equity if all the cards are dealt.`]);
      const { seats: seatList, pot } = seats(scn);
      const hero = seatList.find((x) => x.state === 'hero');
      const vil = seatList.find((x) => x.state === 'villain');
      const cost = vil.bet - hero.bet;
      const need = cost / (pot + cost);
      const verdictTxt = e > need + 0.08 ? 'comfortably more than the price'
        : e > need ? 'a little more than the price, but being out of position or facing more raises can still make it a fold'
          : 'less than the price, so calling only works with good position or implied odds';
      rows.push(['Price to call', `Calling costs ${ui.fmtBB(cost)} to win a pot of ${ui.fmtBB(pot + cost)}, so you need ${ui.pct(need, 1)} equity. ${name} has ${ui.pct(e, 1)}: ${verdictTxt}.`]);
    }

    const r = Math.floor(idx / 13), c = idx % 13;
    const near = [[r, c + 1], [r + 1, c], [r, c - 1], [r - 1, c]]
      .filter(([a, b]) => a >= 0 && a < 13 && b >= 0 && b < 13)
      .map(([a, b]) => a * 13 + b)
      .filter((j) => strat.inRange[j])
      .map((j) => {
        const acts = strategy.handStrategy(strat, j).filter((a) => a.freq > 0.001);
        return `${core.HAND_NAMES[j]}: ${acts.map((a) => `${a.label.toLowerCase()} ${ui.pct(a.freq)}`).join(' / ')}`;
      });
    if (near.length) rows.push(['Nearby hands', near.join(' · ') + '. Hands right next to each other on the chart play similarly, so learn the borders.']);

    return h('details', { class: 'deep', open: true },
      h('summary', null, 'Deeper analysis'),
      h('dl', { class: 'deep-list' }, rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
  }

  function answerWith(id) {
    const sp = st.spot;
    if (!sp || sp.answer) return;
    const actions = strategy.handStrategy(sp.strat, sp.idx);
    let grade = strategy.grade(actions, id, sp.roll);
    // Real solvers do limp some hands from the small blind; this chart simplifies to raise-or-fold.
    if (id === 'limp' && sp.scn.hero === 'SB') grade = { ...grade, result: 'inaccurate', score: 0.5 };
    sp.answer = { id, grade };
    ui.bumpSession(st.sess, grade.score);
    store.record('preflop', sp.scn.title, grade.score, `${sp.scn.title} · ${core.HAND_NAMES[sp.idx]}`);
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
    const acts = st.spot.strat.actions.slice().reverse();
    const byKey = acts.find((a) => (KEYS[a.kind] || '').toLowerCase() === k);
    const byNum = /^[1-9]$/.test(k) ? acts[Number(k) - 1] : null;
    const a = byKey || byNum;
    if (a) { e.preventDefault(); answerWith(a.id); }
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.preflop = { id: 'preflop', label: 'Preflop', mount, onKey };
})(typeof window !== 'undefined' ? window : globalThis);
