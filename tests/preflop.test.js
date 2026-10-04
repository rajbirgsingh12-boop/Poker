import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';
import '../js/data/preflop.js';
import '../js/strategy.js';

const { core, preflop, strategy } = globalThis.GTO;

test('scenario ids are unique and reference valid positions', () => {
  const ids = preflop.scenarios.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of preflop.scenarios) {
    assert.ok(preflop.POSITIONS.includes(s.hero), s.id);
    assert.ok(preflop.GROUPS.some((g) => g.id === s.group), s.id);
    if (s.from) assert.ok(ids.includes(s.from), s.id);
  }
});

test('every hand has action frequencies summing to at most 100%', () => {
  for (const s of preflop.scenarios) {
    const ranges = s.actions.map((a) => core.parseRange(a.range));
    for (let i = 0; i < 169; i++) {
      const sum = ranges.reduce((acc, r) => acc + r[i], 0);
      assert.ok(sum <= 1 + 1e-9, `${s.id}: ${core.HAND_NAMES[i]} sums to ${sum}`);
    }
  }
});

test('re-raise defence only uses hands that reach the spot', () => {
  for (const s of preflop.scenarios.filter((x) => x.from)) {
    const strat = strategy.getStrategy(s.id);
    for (let i = 0; i < 169; i++) {
      const cont = strat.actions.filter((a) => a.id !== 'fold').reduce((acc, a) => acc + a.freq[i], 0);
      if (cont > 0) assert.ok(strat.inRange[i] > 0, `${s.id}: ${core.HAND_NAMES[i]} continues but is never opened`);
    }
  }
});

test('opening ranges widen with position and sit in solver-like bands', () => {
  const pct = (id) => core.rangePercent(strategy.getStrategy(id).actions[0].freq);
  const bands = { UTG: [14, 20], HJ: [18, 24], CO: [25, 32], BTN: [40, 50], SB: [35, 50] };
  let prev = 0;
  for (const pos of ['UTG', 'HJ', 'CO', 'BTN']) {
    const p = pct('rfi-' + pos);
    assert.ok(p >= bands[pos][0] && p <= bands[pos][1], `${pos} opens ${p.toFixed(1)}%`);
    assert.ok(p > prev, `${pos} should open wider than the previous seat`);
    prev = p;
  }
  const sb = pct('rfi-SB');
  assert.ok(sb >= bands.SB[0] && sb <= bands.SB[1], `SB opens ${sb.toFixed(1)}%`);
});

test('premium hands never fold and trash never continues', () => {
  for (const s of preflop.scenarios) {
    const strat = strategy.getStrategy(s.id);
    const rest = strat.actions.find((a) => a.id === 'fold' || a.id === 'check');
    if (rest.id === 'check') continue; // nobody folds when checking is free
    const fold = rest.freq;
    assert.equal(fold[core.handIndex('AA')], 0, `${s.id} folds AA`);
    assert.equal(fold[core.handIndex('KK')], 0, `${s.id} folds KK`);
    if (s.hero !== 'BB' && s.hero !== 'SB' && s.hero !== 'BTN')
      assert.equal(fold[core.handIndex('72o')], 1, `${s.id} plays 72o`);
  }
});

test('big blind defends wider against later positions', () => {
  const defend = (id) => {
    const strat = strategy.getStrategy(id);
    return 100 - core.rangePercent(strat.actions.find((a) => a.id === 'fold').freq);
  };
  const order = ['BB-vs-UTG', 'BB-vs-HJ', 'BB-vs-CO', 'BB-vs-BTN'].map(defend);
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], order.join(' < '));
});

test('every style gives every hand frequencies that sum to exactly 100%', () => {
  for (const s of preflop.scenarios) {
    for (const style of ['gto', 'blend', 'exploit']) {
      const strat = strategy.getStrategy(s.id, style);
      for (let i = 0; i < 169; i++) {
        const sum = strat.actions.reduce((a, x) => a + x.freq[i], 0);
        assert.ok(Math.abs(sum - 1) < 1e-9, `${s.id}/${style}: ${core.HAND_NAMES[i]} sums to ${sum}`);
        assert.ok(strat.actions.every((x) => x.freq[i] >= -1e-12), `${s.id}/${style}: negative frequency`);
      }
    }
  }
});

test('the middle strategy is halfway between GTO and the exploitative one', () => {
  const g = strategy.getStrategy('BB-vs-BTN', 'gto'), b = strategy.getStrategy('BB-vs-BTN', 'blend'), e = strategy.getStrategy('BB-vs-BTN', 'exploit');
  for (let k = 0; k < g.actions.length; k++)
    for (let i = 0; i < 169; i++) assert.ok(Math.abs(b.actions[k].freq[i] - (g.actions[k].freq[i] + e.actions[k].freq[i]) / 2) < 1e-12);
});

test('exploitative adjustments follow the stated rules and explain themselves', () => {
  const H = core.handIndex;
  const e = strategy.getStrategy('BB-vs-BTN', 'exploit');
  assert.equal(e.actions.find((a) => a.id === '3bet').freq[H('A5s')], 0); // no light 3-bet bluffs
  assert.ok(e.reasons[H('A5s')]);
  const v = strategy.getStrategy('UTG-vs-CO-3bet', 'exploit');
  assert.equal(v.actions.find((a) => a.id === '4bet').freq[H('A5s')], 0); // no 4-bet bluffs
  assert.equal(v.actions.find((a) => a.id === '4bet').freq[H('AA')], 1);
  const free = strategy.getStrategy('BB-vs-SB-limp', 'gto');
  assert.ok(!free.actions.some((a) => a.id === 'fold'));
  assert.equal(strategy.getStrategy('BB-vs-BTN', 'gto').reasons[H('A5s')], null);
});
