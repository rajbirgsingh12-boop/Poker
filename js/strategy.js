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

  /*
   * Strategy styles:
   *   gto     - the equilibrium charts in js/data/preflop.js
   *   exploit - adjusted for typical low-stakes opponents, who call too much,
   *             rarely fold to 3-bets, rarely bluff with 3-bets and 4-bets,
   *             and limp with weak hands
   *   blend   - halfway between the two, the default "middle" strategy
   */
  const STYLES = [
    { id: 'gto', label: 'Pure GTO', blurb: 'The unbeatable equilibrium strategy, the same against everyone.' },
    { id: 'blend', label: 'Middle', blurb: 'Halfway between GTO and the exploitative strategy. A solid default for real games.' },
    { id: 'exploit', label: 'Vs typical players', blurb: 'Adjusted for how most low-stakes players actually play: they call too much and rarely bluff with re-raises.' },
  ];

  /**
   * Parsed strategy for a scenario:
   *   actions: [{ id, label, kind, freq: Float64Array(169) }] in RNG order
   *            (aggressive first, then call, then fold or check)
   *   inRange: Float64Array(169) - how often each hand reaches the spot (0..1)
   *   reasons: per hand, why the exploitative strategy differs from GTO (or null)
   */
  function getStrategy(id, style = 'gto') {
    const key = id + '|' + style;
    if (cache.has(key)) return cache.get(key);
    const scn = preflop.scenarios.find((s) => s.id === id);
    if (!scn) throw new Error('Unknown scenario ' + id);

    let actions, reasons = new Array(169).fill(null);
    if (style === 'gto') {
      actions = scn.actions.map((a) => ({ id: a.id, label: a.label, kind: kindOf(a.id), freq: core.parseRange(a.range) }));
      const rest = new Float64Array(169);
      for (let i = 0; i < 169; i++) rest[i] = Math.max(0, 1 - actions.reduce((acc, a) => acc + a.freq[i], 0));
      // Calling when nobody has raised ("limping") is offered so players can try it; GTO never does it here.
      if (scn.group === 'rfi') actions.push({ id: 'limp', label: 'Call 1', kind: 'call', freq: new Float64Array(169) });
      if (scn.rest === 'check') actions.push({ id: 'check', label: 'Check', kind: 'call', freq: rest });
      else actions.push({ id: 'fold', label: 'Fold', kind: 'fold', freq: rest });
    } else {
      const gto = getStrategy(id, 'gto');
      const ex = exploitAdjust(scn, gto);
      reasons = ex.reasons;
      actions = gto.actions.map((a) => {
        const f = ex.freqs[a.id];
        return { ...a, freq: style === 'exploit' ? f : f.map((x, i) => (x + a.freq[i]) / 2) };
      });
    }

    const inRange = scn.from ? getStrategy(scn.from, style).actions[0].freq : new Float64Array(169).fill(1);
    const strat = { scenario: scn, style, actions, inRange, reasons };
    strat.borderline = computeBorderline(strat);
    cache.set(key, strat);
    return strat;
  }

  /* ---------- exploitative adjustments ---------- */
  const R = (str) => core.parseRange(str);
  const VALUE = R('TT+,AQs+,AKo,AQo');
  const PREMIUM = R('QQ+,AKs,AKo');
  const GOOD_CALL_3BET = R('JJ-77,AQs-ATs,KQs,KJs,QJs,JTs,T9s,AQo');
  const GOOD_CALL_4BET = R('QQ-JJ,AKs,AKo');
  const ISO_VALUE = R('66+,A9s+,KTs+,QTs+,JTs,ATo+,KJo+,QJo');
  const BB_RAISE_VALUE = R('77+,A9s+,KTs+,QJs,ATo+,KJo+');
  const isOffsuitJunk = (i) => {
    const r = Math.floor(i / 13), c = i % 13;
    return r > c && Math.max(r, c) > 4; // offsuit with a card below ten
  };

  const WHY = {
    rfiTight: 'At low stakes more players call your raises, so pots go multiway. From early seats, skip the marginal mixed hands.',
    rfiSteal: 'Typical players in the blinds fold too often, so steal with all of your borderline hands from late position.',
    value3: 'Typical opponents call 3-bets with too many hands, so re-raise your strong hands for value instead of just calling.',
    noBluff3: 'GTO uses this hand as a 3-bet bluff, but typical opponents rarely fold to 3-bets, so the bluff loses value. Call or fold instead.',
    junkDefend: 'Weak offsuit hands are hard to play after the flop. Against players who rarely bluff, defend a little less with them.',
    isoValue: 'Limpers usually hold weak hands and call raises too often, so raise your good hands for value instead of limping behind.',
    isoJunk: 'Limpers rarely fold, so isolating with weak offsuit hands just plays a big pot with a weak hand.',
    bbValue: 'Small-blind limpers at low stakes call raises with weak hands, so raise your good hands for value.',
    bbNoBluff: 'They rarely fold after limping, so check your bluffs and see a free flop.',
    noBluffRe: 'Typical players almost never bluff with re-raises this big, so bluff re-raising back is lighting money on fire. Call or fold instead.',
    foldMore: 'Re-raises from typical players are stronger than GTO assumes (very few bluffs), so fold more of your marginal hands.',
  };

  function exploitAdjust(scn, gto) {
    const ids = gto.actions.map((a) => a.id);
    const aggrId = ids[0];
    const restId = ids.includes('check') ? 'check' : 'fold';
    const freqs = Object.fromEntries(gto.actions.map((a) => [a.id, Float64Array.from(a.freq)]));
    const reasons = new Array(169).fill(null);
    const A = freqs[aggrId], C = freqs.call, F = freqs[restId];
    const move = (from, to, i, amt) => { if (amt > 0) { from[i] -= amt; to[i] += amt; } };

    for (let i = 0; i < 169; i++) {
      const before = A[i] + ',' + (C ? C[i] : '');
      switch (scn.group) {
        case 'rfi':
          if (A[i] > 0 && A[i] < 1) {
            if (scn.hero === 'UTG' || scn.hero === 'HJ') { move(A, F, i, A[i] * 0.5); reasons[i] = WHY.rfiTight; }
            else if ((scn.hero === 'BTN' || scn.hero === 'SB') && A[i] >= 0.3) { move(F, A, i, F[i]); reasons[i] = WHY.rfiSteal; }
          }
          break;
        case 'vsOpen':
        case 'squeeze':
          if (VALUE[i]) {
            if (C[i] > 0) { move(C, A, i, C[i] * 0.8); reasons[i] = WHY.value3; }
          } else if (A[i] > 0) {
            const a = A[i];
            A[i] = 0; C[i] += a / 2; F[i] += a / 2;
            reasons[i] = WHY.noBluff3;
          } else if (isOffsuitJunk(i) && C[i] > 0 && C[i] < 1) {
            move(C, F, i, C[i] * 0.4); reasons[i] = WHY.junkDefend;
          }
          break;
        case 'vsLimp':
          if (restId === 'check') {
            if (BB_RAISE_VALUE[i] && F[i] > 0) { move(F, A, i, F[i]); reasons[i] = WHY.bbValue; }
            else if (!BB_RAISE_VALUE[i] && A[i] > 0) { move(A, F, i, A[i]); reasons[i] = WHY.bbNoBluff; }
          } else if (ISO_VALUE[i] && C[i] + F[i] > 0) {
            move(C, A, i, C[i]); move(F, A, i, F[i]); reasons[i] = WHY.isoValue;
          } else if (isOffsuitJunk(i) && A[i] > 0) {
            move(A, F, i, A[i] * 0.6); reasons[i] = WHY.isoJunk;
          }
          break;
        case 'vs3bet':
        case 'vs4bet': {
          const goodCall = scn.group === 'vs3bet' ? GOOD_CALL_3BET : GOOD_CALL_4BET;
          if (!PREMIUM[i] && A[i] > 0) {
            const a = A[i];
            A[i] = 0;
            if (goodCall[i]) C[i] += a; else F[i] += a;
            reasons[i] = WHY.noBluffRe;
          }
          if (!goodCall[i] && !PREMIUM[i] && C[i] > 0) { move(C, F, i, C[i] * 0.6); reasons[i] = reasons[i] || WHY.foldMore; }
          break;
        }
      }
      if (before === A[i] + ',' + (C ? C[i] : '')) reasons[i] = null;
    }
    return { freqs, reasons };
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

  root.GTO.strategy = { STYLES, getStrategy, handStrategy, primaryAction, dealHand, rngAction, grade, actionTotals, kindOf };
})(typeof window !== 'undefined' ? window : globalThis);
