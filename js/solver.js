/*
 * Heads-up push/fold Nash equilibrium solver.
 *
 * Game: blinds 0.5/1bb, both players have `stack` bb (effective). The small
 * blind either moves all-in or folds; facing the shove the big blind calls
 * or folds. Hands are the 169 classes, dealt with probability proportional to
 * the number of non-conflicting combo pairs, so card removal is exact.
 *
 * Solved with CFR+ (alternating updates, linear averaging). The returned
 * `exploitability` is how much a perfect counter-strategy would gain on
 * average, in bb per hand, summed over both players.
 */
(function (root) {
  'use strict';

  function buildWeights(core) {
    const w = Array.from({ length: 169 }, () => new Float64Array(169));
    for (let a = 0; a < 169; a++)
      for (let b = a; b < 169; b++) {
        const n = core.comboPairs(a, b);
        w[a][b] = n;
        w[b][a] = n;
      }
    return w;
  }

  function solvePushFold({ stack, eq, weights, iterations = 4000 }) {
    const N = 169, S = stack;
    // Precompute payoffs (SB perspective) when the shove is called.
    const calledSB = Array.from({ length: N }, (_, i) => {
      const row = new Float64Array(N);
      for (let j = 0; j < N; j++) row[j] = S * (2 * eq[i][j] - 1);
      return row;
    });
    const rowW = new Float64Array(N);
    let totalW = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) rowW[i] += weights[i][j];
      totalW += rowW[i];
    }

    const rPush = new Float64Array(N), rFold = new Float64Array(N);
    const rCall = new Float64Array(N), rPass = new Float64Array(N);
    const push = new Float64Array(N).fill(0.5), call = new Float64Array(N).fill(0.5);
    const avgPush = new Float64Array(N), avgCall = new Float64Array(N);
    let avgNorm = 0;

    for (let t = 1; t <= iterations; t++) {
      // Small blind update against the current big blind strategy.
      for (let i = 0; i < N; i++) {
        const wi = weights[i], ci = calledSB[i];
        let vp = 0;
        for (let j = 0; j < N; j++) vp += wi[j] * (call[j] * ci[j] + (1 - call[j]));
        const vf = -0.5 * rowW[i];
        const v = push[i] * vp + (1 - push[i]) * vf;
        rPush[i] = Math.max(0, rPush[i] + vp - v);
        rFold[i] = Math.max(0, rFold[i] + vf - v);
        const s = rPush[i] + rFold[i];
        push[i] = s > 0 ? rPush[i] / s : 0.5;
      }
      // Big blind update against the updated small blind strategy.
      for (let j = 0; j < N; j++) {
        let vc = 0, vf = 0;
        for (let i = 0; i < N; i++) {
          const reach = weights[i][j] * push[i];
          if (reach === 0) continue;
          vc -= reach * calledSB[i][j];
          vf -= reach;
        }
        const v = call[j] * vc + (1 - call[j]) * vf;
        rCall[j] = Math.max(0, rCall[j] + vc - v);
        rPass[j] = Math.max(0, rPass[j] + vf - v);
        const s = rCall[j] + rPass[j];
        call[j] = s > 0 ? rCall[j] / s : 0.5;
      }
      for (let k = 0; k < N; k++) {
        avgPush[k] += t * push[k];
        avgCall[k] += t * call[k];
      }
      avgNorm += t;
    }
    for (let k = 0; k < N; k++) {
      avgPush[k] /= avgNorm;
      avgCall[k] /= avgNorm;
    }

    const stats = evaluate(avgPush, avgCall, weights, calledSB, rowW, totalW);
    return { stack, push: avgPush, call: avgCall, ...stats };
  }

  /** Value of a strategy profile and each side's best-response gain. */
  function evaluate(push, call, weights, calledSB, rowW, totalW) {
    const N = 169;
    let value = 0, brSB = 0;
    const pushEV = new Float64Array(N); // SB EV of shoving hand i, bb
    for (let i = 0; i < N; i++) {
      let vp = 0;
      for (let j = 0; j < N; j++) vp += weights[i][j] * (call[j] * calledSB[i][j] + (1 - call[j]));
      const vf = -0.5 * rowW[i];
      value += push[i] * vp + (1 - push[i]) * vf;
      brSB += Math.max(vp, vf);
      pushEV[i] = vp / rowW[i];
    }
    let brBB = 0;
    const callEV = new Float64Array(N); // BB EV of calling vs folding facing a shove, bb
    for (let j = 0; j < N; j++) {
      let vc = 0, vf = 0, reach = 0, foldPart = 0;
      for (let i = 0; i < N; i++) {
        const w = weights[i][j];
        const r = w * push[i];
        vc -= r * calledSB[i][j];
        vf -= r;
        reach += r;
        foldPart += w * (1 - push[i]) * 0.5;
      }
      brBB += Math.max(vc, vf) + foldPart;
      callEV[j] = reach > 0 ? (vc - vf) / reach : 0;
    }
    value /= totalW;
    const exploitability = (brSB / totalW - value) + (brBB / totalW + value);
    return { value, exploitability, pushEV, callEV };
  }

  function rangeShare(freqs, core) {
    let combos = 0;
    for (let i = 0; i < 169; i++) combos += freqs[i] * core.comboCount(i);
    return combos / 1326;
  }

  root.GTO = root.GTO || {};
  root.GTO.solver = { buildWeights, solvePushFold, rangeShare };
})(typeof window !== 'undefined' ? window : globalThis);
