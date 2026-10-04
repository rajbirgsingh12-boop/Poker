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
    const { strat, idx, roll, answer } = st.spot;
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
      h('p', { class: 'why' }, h('b', null, `Why: ${family.name}. `), family.why, mixed ? ' ' + explain.MIX_NOTE : ''));
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
      locked ? null : ui.legend(strategy.actionTotals(strat).slice().reverse()),
      h('p', { class: 'grid-key' }, 'Diagonal: pairs · top-right: suited · bottom-left: offsuit. Strongest hands are top-left.'));
  }

  function answerWith(id) {
    const sp = st.spot;
    if (!sp || sp.answer) return;
    const actions = strategy.handStrategy(sp.strat, sp.idx);
    const grade = strategy.grade(actions, id, sp.roll);
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
