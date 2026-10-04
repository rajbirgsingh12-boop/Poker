import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';
import '../js/data/preflop.js';
import '../js/explain.js';

const { core, preflop, explain } = globalThis.GTO;

test('every starting hand gets a family and a reason', () => {
  for (let i = 0; i < 169; i++) {
    const f = explain.handFamily(i);
    assert.ok(f.name && f.why, core.HAND_NAMES[i]);
  }
  assert.equal(explain.handFamily(core.handIndex('AA')).name, 'Big pair');
  assert.equal(explain.handFamily(core.handIndex('A5s')).name, 'Suited ace');
  assert.equal(explain.handFamily(core.handIndex('76s')).name, 'Suited connector');
  assert.equal(explain.handFamily(core.handIndex('72o')).name, 'Weak hand');
});

test('every scenario has a plain-English story and every action a hint', () => {
  for (const s of preflop.scenarios) {
    assert.ok(explain.spotStory(s).length > 40, s.id);
    for (const a of s.actions) assert.ok(explain.actionHint(a.id, a.label).length > 0, `${s.id} ${a.id}`);
  }
  assert.equal(explain.actionHint('raise', 'Raise 2.5'), 'bet 2.5 big blinds');
  assert.equal(explain.actionHint('3bet', '3-bet 11'), 're-raise to 11bb');
});

test('every position is described', () => {
  for (const p of preflop.POSITIONS) assert.ok(explain.POSITIONS[p].name, p);
});
