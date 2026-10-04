import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';
import '../js/solver.js';
import '../js/data/equity.js';
import '../js/data/pushfold.js';

const { core, solver, pushfold, equityUpper } = globalThis.GTO;
const share = (arr) => solver.rangeShare(arr, core) * 100;
const H = (n) => core.handIndex(n);

test('data covers 1bb to 25bb in half-bb steps', () => {
  assert.equal(pushfold.stacks[0], 1);
  assert.equal(pushfold.stacks.at(-1), 25);
  for (const s of pushfold.stacks) {
    assert.equal(pushfold.push[s].length, 169);
    assert.equal(pushfold.call[s].length, 169);
  }
});

test('premiums always shove and call; ranges tighten as stacks grow', () => {
  for (const s of pushfold.stacks) {
    assert.equal(pushfold.push[s][H('AA')], 1);
    assert.equal(pushfold.call[s][H('AA')], 1);
    assert.equal(pushfold.call[s][H('KK')], 1);
  }
  assert.ok(share(pushfold.push[5]) > share(pushfold.push[10]));
  assert.ok(share(pushfold.push[10]) > share(pushfold.push[20]));
  assert.ok(share(pushfold.call[5]) > share(pushfold.call[10]));
});

test('10bb matches published Nash charts (about 58% shove, 37% call)', () => {
  assert.ok(Math.abs(share(pushfold.push[10]) - 58) < 1.5, share(pushfold.push[10]).toFixed(1));
  assert.ok(Math.abs(share(pushfold.call[10]) - 37) < 1.5, share(pushfold.call[10]).toFixed(1));
});

test('re-solving a stack reproduces a near-zero-exploitability equilibrium', () => {
  const eq = core.decodeEquity(equityUpper);
  const weights = solver.buildWeights(core);
  const res = solver.solvePushFold({ stack: 8, eq, weights, iterations: 1500 });
  assert.ok(res.exploitability < 1e-4, `exploitability ${res.exploitability}`);
  let diff = 0;
  for (let i = 0; i < 169; i++) diff += Math.abs(res.push[i] - pushfold.push[8][i]) * core.comboCount(i);
  assert.ok(diff / 1326 < 0.01, 'solution drifted from shipped data');
});
