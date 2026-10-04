/*
 * Turns the preflop scenario data into per-hand strategies, and holds the
 * grading rules shared by the trainers.
 */
(function (root) {
  'use strict';
  const { core, preflop } = root.GTO;

  const AGGRESSIVE = new Set(['raise', '3bet', '4bet', 'allin']);
  const kindOf = (id) => (AGGRESSIVE.has(id) ? (id === 'allin' ? 'allin' : 'aggr') : id);

  const cache = new Map();

  /**
   * Parsed strategy for a scenario:
   *   actions: [{ id, label, kind, freq: Float64Array(169) }] in RNG order
   *            (aggressive first, then call, then fold)
   *   inRange: Float64Array(169) - how often each hand reaches the spot (0..1)
   */
  function getStrategy(id) {
    if (cache.has(id)) return cache.get(id);
    const scn = preflop.scenarios.find((s) => s.id === id);
    if (!scn) throw new Error('Unknown scenario ' + id);

    const actions = scn.actions.map((a) => ({ id: a.id, label: a.label, kind: kindOf(a.id), freq: core.parseRange(a.range) }));
    const fold = new Float64Array(169);
    for (let i = 0; i < 169; i++) {
      let s = 0;
      for (const a of actions) s += a.freq[i];
      fold[i] = Math.max(0, 1 - s);
    }
    actions.push({ id: 'fold', label: 'Fold', kind: 'fold', freq: fold });

    let inRange;
    if (scn.from) {
      const opener = getStrategy(scn.from);
      inRange = opener.actions[0].freq;
    } else {
      inRange = new Float64Array(169).fill(1);
    }

    const strat = { scenario: scn, actions, inRange };
    strat.borderline = computeBorderline(strat);
    cache.set(id, strat);
    return strat;
  }

  /** Per-hand action list: [{ id, label, kind, freq }]. */
  function handStrategy(strat, idx) {
    return strat.actions.map((a) => ({ id: a.id, label: a.label, kind: a.kind, freq: a.freq[idx] }));
  }

  function primaryAction(strat, idx) {
    let best = null;
    for (const a of strat.actions) if (!best || a.freq[idx] > best.freq[idx]) best = a;
    return best.id;
  }

  /**
   * Hands worth drilling: anything mixed, plus pure hands sitting next to a
   * hand (in the grid) whose main action differs. Skips the obvious folds and
   * the obvious value hands.
   */
  function computeBorderline(strat) {
    const out = new Uint8Array(169);
    for (let i = 0; i < 169; i++) {
      if (!strat.inRange[i]) continue;
      const max = Math.max(...strat.actions.map((a) => a.freq[i]));
      if (max < 0.9) { out[i] = 1; continue; }
      const r = Math.floor(i / 13), c = i % 13, p = primaryAction(strat, i);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 12 || cc < 0 || cc > 12) continue;
        const j = rr * 13 + cc;
        if (strat.inRange[j] && primaryAction(strat, j) !== p) { out[i] = 1; break; }
      }
    }
    return out;
  }

  /** Deal a hand class for a scenario, weighted by combos and how often it reaches the spot. */
  function dealHand(strat, { borderlineOnly = false, rng = Math.random } = {}) {
    let total = 0;
    const w = new Float64Array(169);
    for (let i = 0; i < 169; i++) {
      if (borderlineOnly && !strat.borderline[i]) continue;
      w[i] = core.comboCount(i) * strat.inRange[i];
      total += w[i];
    }
    if (total === 0) return core.randomHandIndex(rng);
    let x = rng() * total;
    for (let i = 0; i < 169; i++) {
      x -= w[i];
      if (x < 0) return i;
    }
    return 168;
  }

  /** Which action a 1-100 random number selects, given frequencies in RNG order. */
  function rngAction(actions, roll) {
    let cum = 0;
    for (const a of actions) {
      cum += a.freq * 100;
      if (roll <= cum + 1e-9) return a.id;
    }
    return actions[actions.length - 1].id;
  }

  /**
   * Grade a chosen action. Without RNG any action played at least 25% of the
   * time (or the most frequent one) is correct; a low-frequency play earns half
   * credit. With RNG the roll decides the single correct action.
   */
  function grade(actions, chosenId, roll) {
    const chosen = actions.find((a) => a.id === chosenId);
    const f = chosen ? chosen.freq : 0;
    const fmax = Math.max(...actions.map((a) => a.freq));
    if (roll != null) {
      const target = rngAction(actions, roll);
      if (target === chosenId) return { result: 'correct', score: 1, target };
      return f > 0 ? { result: 'inaccurate', score: 0.5, target } : { result: 'wrong', score: 0, target };
    }
    if (f >= 0.25 || (f > 0 && f >= fmax - 1e-9)) return { result: 'correct', score: 1 };
    if (f > 0) return { result: 'inaccurate', score: 0.5 };
    return { result: 'wrong', score: 0 };
  }

  /** Share of combos (among hands that reach the spot) taking each action. */
  function actionTotals(strat) {
    let reach = 0;
    const totals = strat.actions.map(() => 0);
    for (let i = 0; i < 169; i++) {
      const w = core.comboCount(i) * strat.inRange[i];
      reach += w;
      strat.actions.forEach((a, k) => { totals[k] += w * a.freq[i]; });
    }
    return strat.actions.map((a, k) => ({ id: a.id, label: a.label, kind: a.kind, share: totals[k] / reach }));
  }

  root.GTO.strategy = { getStrategy, handStrategy, primaryAction, dealHand, rngAction, grade, actionTotals, kindOf };
})(typeof window !== 'undefined' ? window : globalThis);
