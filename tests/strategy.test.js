import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';
import '../js/data/preflop.js';
import '../js/strategy.js';

const { core, strategy } = globalThis.GTO;

const mix = [
  { id: 'raise', freq: 0.6 },
  { id: 'call', freq: 0.3 },
  { id: 'fold', freq: 0.1 },
];

test('RNG bands follow aggressive, call, fold order', () => {
  assert.equal(strategy.rngAction(mix, 1), 'raise');
  assert.equal(strategy.rngAction(mix, 60), 'raise');
  assert.equal(strategy.rngAction(mix, 61), 'call');
  assert.equal(strategy.rngAction(mix, 90), 'call');
  assert.equal(strategy.rngAction(mix, 91), 'fold');
  assert.equal(strategy.rngAction(mix, 100), 'fold');
});

test('grading without RNG accepts meaningful mixes', () => {
  assert.equal(strategy.grade(mix, 'raise').result, 'correct');
  assert.equal(strategy.grade(mix, 'call').result, 'correct');
  assert.equal(strategy.grade(mix, 'fold').result, 'inaccurate');
  assert.equal(strategy.grade([{ id: 'raise', freq: 1 }, { id: 'fold', freq: 0 }], 'fold').result, 'wrong');
  // a hand that is mostly fold with a rare raise: the raise is still the minority play
  const rare = [{ id: 'raise', freq: 0.2 }, { id: 'fold', freq: 0.8 }];
  assert.equal(strategy.grade(rare, 'raise').result, 'inaccurate');
  assert.equal(strategy.grade(rare, 'fold').result, 'correct');
});

test('grading with RNG demands the rolled action', () => {
  assert.equal(strategy.grade(mix, 'raise', 30).result, 'correct');
  assert.equal(strategy.grade(mix, 'call', 30).result, 'inaccurate');
  assert.equal(strategy.grade(mix, 'call', 75).result, 'correct');
  assert.equal(strategy.grade([{ id: 'raise', freq: 1 }, { id: 'fold', freq: 0 }], 'fold', 50).result, 'wrong');
});

test('dealing respects the opening range when facing a 3-bet', () => {
  const strat = strategy.getStrategy('UTG-vs-CO-3bet');
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 2000; k++) {
    const idx = strategy.dealHand(strat, { rng });
    assert.ok(strat.inRange[idx] > 0, core.HAND_NAMES[idx]);
  }
});

test('borderline filter keeps mixed hands and drops obvious ones', () => {
  const strat = strategy.getStrategy('rfi-UTG');
  assert.equal(strat.borderline[core.handIndex('KJo')], 1); // mixed
  assert.equal(strat.borderline[core.handIndex('AA')], 0);
  assert.equal(strat.borderline[core.handIndex('72o')], 0);
});

test('action totals sum to 100%', () => {
  for (const id of ['rfi-BTN', 'BB-vs-BTN', 'SB-vs-BB-3bet']) {
    const totals = strategy.actionTotals(strategy.getStrategy(id));
    const sum = totals.reduce((a, t) => a + t.share, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, id);
  }
});
