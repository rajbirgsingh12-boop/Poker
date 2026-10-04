import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';

const { core } = globalThis.GTO;

test('hand names round-trip through indexes', () => {
  assert.equal(core.HAND_NAMES.length, 169);
  assert.equal(new Set(core.HAND_NAMES).size, 169);
  for (let i = 0; i < 169; i++) assert.equal(core.handIndex(core.HAND_NAMES[i]), i);
  assert.equal(core.handName(0), 'AA');
  assert.equal(core.handName(1), 'AKs');
  assert.equal(core.handName(13), 'AKo');
  assert.equal(core.handName(168), '22');
});

test('combo counts add up to 1326', () => {
  let total = 0;
  for (let i = 0; i < 169; i++) {
    assert.equal(core.combos(i).length, core.comboCount(i));
    total += core.comboCount(i);
  }
  assert.equal(total, 1326);
});

test('every combo has 1225 non-conflicting opponent combos', () => {
  for (const name of ['AA', 'AKs', 'AKo', '72o', 'T9s']) {
    const i = core.handIndex(name);
    let sum = 0;
    for (let j = 0; j < 169; j++) sum += core.comboPairs(i, j);
    assert.equal(sum, core.comboCount(i) * 1225, name);
  }
  assert.equal(core.comboPairs(core.handIndex('AA'), core.handIndex('AA')), 6); // 6 combos, 1 disjoint each
  assert.equal(core.comboPairs(core.handIndex('AKs'), core.handIndex('AKo')), 4 * 6);
});

test('range parser expands standard notation', () => {
  const names = (str) => {
    const w = core.parseRange(str);
    return core.HAND_NAMES.filter((_, i) => w[i] > 0).sort();
  };
  assert.deepEqual(names('TT+'), ['AA', 'JJ', 'KK', 'QQ', 'TT']);
  assert.deepEqual(names('99-77'), ['77', '88', '99']);
  assert.deepEqual(names('K9s+'), ['K9s', 'KJs', 'KQs', 'KTs']);
  assert.deepEqual(names('ATo+'), ['AJo', 'AKo', 'AQo', 'ATo']);
  assert.deepEqual(names('A5s-A3s'), ['A3s', 'A4s', 'A5s']);
  assert.deepEqual(names('AK'), ['AKo', 'AKs']);
  assert.deepEqual(names('QJo+'), ['QJo']);
});

test('range parser applies frequencies and later tokens win', () => {
  const w = core.parseRange('22+,33:0.5,KJo:0.25');
  assert.equal(w[core.handIndex('AA')], 1);
  assert.equal(w[core.handIndex('33')], 0.5);
  assert.equal(w[core.handIndex('KJo')], 0.25);
  assert.equal(w[core.handIndex('KJs')], 0);
});

test('range parser rejects malformed input', () => {
  assert.throws(() => core.parseRange('KAs'));
  assert.throws(() => core.parseRange('AKx'));
  assert.throws(() => core.parseRange('AA:1.5'));
  assert.throws(() => core.parseRange('A5s-K2s'));
});

test('range percent of all pairs is 78/1326', () => {
  assert.ok(Math.abs(core.rangePercent(core.parseRange('22+')) - (78 / 1326) * 100) < 1e-9);
});
