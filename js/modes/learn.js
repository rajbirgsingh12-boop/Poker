/* Start-here guide for newer players: the basics, how to read charts, a learning path. */
(function (root) {
  'use strict';
  const { core, explain, ui, store } = root.GTO;
  const { h } = ui;

  const STEPS = [
    {
      title: 'Feel which hands are strong',
      body: 'Guess how often one hand beats another. This builds the instinct everything else rests on.',
      go: 'equity', cta: 'Start equity drill',
      preset: { 'eq.cats': ['flip', 'pairs', 'dominated'] },
    },
    {
      title: 'Open-raise from the late seats',
      body: 'Everyone folds to you on the button or in the cutoff. Raise or fold? The easiest spot to learn first.',
      go: 'preflop', cta: 'Practise late opens',
      preset: { 'pf.groups': ['rfi'], 'pf.positions': ['CO', 'BTN'], 'pf.borderline': false, 'pf.rng': false },
    },
    {
      title: 'Open-raise from every seat',
      body: 'Same decision from all positions. Notice how much tighter you play when more players are left to act.',
      go: 'preflop', cta: 'Practise all opens',
      preset: { 'pf.groups': ['rfi'], 'pf.positions': ['UTG', 'HJ', 'CO', 'BTN', 'SB'], 'pf.borderline': true, 'pf.rng': false },
    },
    {
      title: 'Short stacks: all-in or fold',
      body: 'With 10bb or less, going all-in or folding is close to perfect play, and this tab knows the exact answer.',
      go: 'pushfold', cta: 'Practise push/fold',
      preset: { 'pff.role': 'sb', 'pff.buckets': ['b', 'c'], 'pff.close': false },
    },
    {
      title: 'When someone raised before you',
      body: 'Re-raise, call or fold from the big blind and the button, the two seats that face raises most.',
      go: 'preflop', cta: 'Practise defending',
      preset: { 'pf.groups': ['vsOpen'], 'pf.positions': ['BTN', 'BB'], 'pf.borderline': true, 'pf.rng': false },
    },
    {
      title: 'Learn the bet-size maths',
      body: 'Pot odds tell you when a call is worth it. Three or four numbers cover most of poker maths.',
      go: 'math', cta: 'Start with pot odds',
      preset: { 'math.types': ['potodds'] },
    },
  ];

  function startStep(step) {
    for (const [k, v] of Object.entries(step.preset)) store.setSetting(k, v);
    root.GTO.app.go(step.go);
    window.scrollTo(0, 0);
  }

  function zoneGrid() {
    return ui.rangeGrid({
      label: 'How the hand chart is laid out',
      fill: (i) => ({ css: `var(--z-${core.handType(i)})` }),
      highlight: core.handIndex('AKs'),
    });
  }

  function lesson(title, text, visual) {
    return h('section', { class: 'card card-pad lesson' + (visual ? '' : ' solo') },
      h('div', { class: 'lesson-text' }, h('h2', null, title), text),
      visual ? h('div', { class: 'lesson-visual' }, visual) : null);
  }

  function mount(container) {
    const seats = ui.SIX_MAX.map((pos) => ({
      pos, state: pos === 'BTN' ? 'hero' : 'waiting',
      bet: pos === 'SB' ? 0.5 : pos === 'BB' ? 1 : 0, blind: true,
    }));
    ui.put(container,
      h('div', { class: 'learn-hero' },
        h('div', { class: 'eyebrow' }, 'Start here'),
        h('h1', null, 'New to poker? Read this first.'),
        h('p', null, 'This trainer teaches GTO ("game theory optimal") poker: the way a perfect, unbeatable player would play. You do not need any maths. Skim this page once, then work through the steps at the bottom.')),
      h('div', { class: 'learn' },
        lesson('How a hand starts', [
          h('p', null, 'Six players sit at the table. Each gets two private cards. Before any cards are dealt, two players post forced bets called the ', h('b', null, 'blinds'), ': the small blind puts in half a big blind and the big blind puts in one.'),
          h('p', null, 'Chips are counted in ', h('b', null, 'big blinds (bb)'), '. Everyone here starts with 100bb.'),
          h('p', null, 'Players act one at a time, going clockwise. On your turn you can ', h('b', null, 'fold'), ' (give up), ', h('b', null, 'call'), ' (match the current bet) or ', h('b', null, 'raise'), ' (bet more). Then come the flop, turn and river, with more betting. The trainers focus on the first decision, before the flop, because it sets up everything after.'),
        ], ui.pokerTable({ seats, dealer: 'BTN', pot: 1.5 })),
        lesson('The six seats', [
          h('p', null, 'Seats are named by when they act. The later you act, the more you know about what others did, so the more hands you can play.'),
          h('dl', { class: 'kv seats-list' }, Object.entries(explain.POSITIONS).flatMap(([pos, p]) => [
            h('dt', null, h('b', null, pos)), h('dd', null, `${p.name}: ${p.short}`)])),
          h('p', { class: 'muted' }, 'The order before the flop is UTG, HJ, CO, BTN, SB, BB. After the flop the blinds act first and the button acts last.'),
        ], null),
        lesson('Reading hands', [
          h('p', null, 'Hands are written with two ranks and a letter. ', h('b', null, 's'), ' means suited (same suit), ', h('b', null, 'o'), ' means offsuit. Pairs have no letter. ', h('b', null, 'T'), ' means 10.'),
          h('p', null, 'Suit does not matter before the flop, only whether the two cards match. That is why there are just 169 different starting hands.'),
        ], h('div', { class: 'examples' },
          h('div', null, ui.handCards(['As', 'Ks'], { small: true, deal: false }), h('b', null, 'AKs')),
          h('div', null, ui.handCards(['Ah', 'Kd'], { small: true, deal: false }), h('b', null, 'AKo')),
          h('div', null, ui.handCards(['7c', '7d'], { small: true, deal: false }), h('b', null, '77')),
          h('div', null, ui.handCards(['Th', '9h'], { small: true, deal: false }), h('b', null, 'T9s')))),
        lesson('Reading the hand chart', [
          h('p', null, 'All 169 hands fit in a 13 × 13 grid. The strongest hands are in the top-left corner.'),
          h('ul', { class: 'zones' },
            h('li', null, h('i', { style: { background: 'var(--z-pair)' } }), h('span', null, h('b', null, 'Diagonal: pairs'), ' (AA, KK … 22)')),
            h('li', null, h('i', { style: { background: 'var(--z-suited)' } }), h('span', null, h('b', null, 'Top-right: suited hands'), ' (AKs, T9s …)')),
            h('li', null, h('i', { style: { background: 'var(--z-offsuit)' } }), h('span', null, h('b', null, 'Bottom-left: offsuit hands'), ' (AKo, T9o …)'))),
          h('p', null, 'In the trainers each square is coloured by what to do: ', h('b', { class: 'txt-aggr' }, 'red = raise'), ', ', h('b', { class: 'txt-call' }, 'green = call'), ', ', h('b', { class: 'txt-fold' }, 'blue = fold'), '. A square split between colours is a mixed hand.'),
        ], zoneGrid()),
        lesson('Why are some hands "mixed"?', [
          h('p', null, 'Sometimes the best strategy plays a hand two ways, for example raising it 60% of the time and folding 40%. That happens when both choices are worth about the same. Mixing keeps opponents guessing.'),
          h('p', null, 'You do not need to be exact. In the trainers, any action used at least a quarter of the time counts as correct. If you want to practise mixing precisely, turn on ', h('b', null, 'Random number'), ': you get a number from 1 to 100, and low numbers mean the aggressive play.'),
        ], null),
        h('section', { class: 'card card-pad' },
          h('div', { class: 'panel-title' }, h('h2', null, 'Your learning path')),
          h('ol', { class: 'steps' }, STEPS.map((s, k) => h('li', { class: 'step' },
            h('span', { class: 'step-n' }, k + 1),
            h('div', { class: 'step-body' }, h('h3', null, s.title), h('p', null, s.body)),
            h('button', { class: 'btn', type: 'button', onClick: () => startStep(s) }, s.cta))))),
        h('section', { class: 'card card-pad' },
          h('div', { class: 'panel-title' }, h('h2', null, 'Glossary')),
          h('dl', { class: 'gloss' }, explain.GLOSSARY.flatMap(([t, d]) => [h('dt', null, t), h('dd', null, d)]))),
        h('p', { class: 'foot' }, 'What is exact and what is approximate: push/fold answers and equities are calculated exactly by this app. The 6-max charts are simplified versions of professional solver results, which is how most players study.')));
  }

  root.GTO.modes = root.GTO.modes || {};
  root.GTO.modes.learn = { id: 'learn', label: 'Learn', mount, onKey: () => {} };
})(typeof window !== 'undefined' ? window : globalThis);
