import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';
import '../js/data/equity.js';

const { core, equityUpper } = globalThis.GTO;
const eq = core.decodeEquity(equityUpper);
const e = (a, b) => eq[core.handIndex(a)][core.handIndex(b)] * 100;

test('table has every matchup', () => {
  assert.equal(equityUpper.length, (169 * 168) / 2);
  for (let a = 0; a < 169; a++)
    for (let b = 0; b < 169; b++) assert.ok(Math.abs(eq[a][b] + eq[b][a] - 1) < 1e-9);
});

// Reference values from standard equity calculators (class vs class, all suits).
const known = [
  ['AA', 'KK', 81.9],
  ['QQ', 'AKo', 56.9],
  ['QQ', 'AKs', 54.0],
  ['22', 'AKo', 52.8],
  ['AKo', 'AQo', 74.0],
  ['KK', 'AKo', 69.8],
  ['AA', '72o', 88.2],
  ['JJ', 'TT', 81.6],
];

for (const [a, b, ref] of known) {
  test(`${a} vs ${b} is about ${ref}%`, () => {
    assert.ok(Math.abs(e(a, b) - ref) < 0.6, `${a} vs ${b}: got ${e(a, b).toFixed(2)}%`);
  });
}
