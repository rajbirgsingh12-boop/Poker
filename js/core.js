/*
 * Core poker helpers shared by the app, the data generators and the tests.
 *
 * Hand classes use the standard 13x13 grid: index = row * 13 + col with ranks
 * ordered A..2. row === col is a pair, row < col is suited (upper-right),
 * row > col is offsuit (lower-left).
 */
(function (root) {
  'use strict';

  const RANKS = 'AKQJT98765432';
  const SUITS = 'shdc';
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };

  function handName(idx) {
    const r = Math.floor(idx / 13), c = idx % 13;
    if (r === c) return RANKS[r] + RANKS[c];
    if (r < c) return RANKS[r] + RANKS[c] + 's';
    return RANKS[c] + RANKS[r] + 'o';
  }

  const HAND_NAMES = Array.from({ length: 169 }, (_, i) => handName(i));
  const NAME_TO_INDEX = Object.fromEntries(HAND_NAMES.map((n, i) => [n, i]));

  function handIndex(name) {
    const idx = NAME_TO_INDEX[name];
    if (idx === undefined) throw new Error('Unknown hand: ' + name);
    return idx;
  }

  function handType(idx) {
    const r = Math.floor(idx / 13), c = idx % 13;
    return r === c ? 'pair' : r < c ? 'suited' : 'offsuit';
  }

  function comboCount(idx) {
    const t = handType(idx);
    return t === 'pair' ? 6 : t === 'suited' ? 4 : 12;
  }

  /** All concrete combos of a class, as pairs of card strings like 'As'. */
  function combos(idx) {
    const r = Math.floor(idx / 13), c = idx % 13;
    const out = [];
    if (r === c) {
      for (let a = 0; a < 4; a++)
        for (let b = a + 1; b < 4; b++) out.push([RANKS[r] + SUITS[a], RANKS[r] + SUITS[b]]);
    } else if (r < c) {
      for (let s = 0; s < 4; s++) out.push([RANKS[r] + SUITS[s], RANKS[c] + SUITS[s]]);
    } else {
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++) if (a !== b) out.push([RANKS[c] + SUITS[a], RANKS[r] + SUITS[b]]);
    }
    return out;
  }

  /** Number of (combo of a, combo of b) pairs that share no card. */
  function comboPairs(a, b) {
    const A = combos(a), B = combos(b);
    let n = 0;
    for (const x of A)
      for (const y of B)
        if (x[0] !== y[0] && x[0] !== y[1] && x[1] !== y[0] && x[1] !== y[1]) n++;
    return n;
  }

  /** Pick a class with probability proportional to its combo count (i.e. a random dealt hand). */
  function randomHandIndex(rng = Math.random) {
    let x = rng() * 1326;
    for (let i = 0; i < 169; i++) {
      x -= comboCount(i);
      if (x < 0) return i;
    }
    return 168;
  }

  function randomCombo(idx, rng = Math.random) {
    const list = combos(idx);
    return list[Math.floor(rng() * list.length)];
  }

  /* ---------------- range notation ----------------
   * Comma-separated tokens, applied in order (later tokens overwrite):
   *   AA  AKs  AKo  AK (= AKs + AKo)
   *   TT+  (TT..AA)     TT-77
   *   A2s+ (A2s..AKs)   K9o+ (K9o..KQo)   A5s-A2s
   * Optional frequency suffix: "KJo:0.5"
   */
  function rankIdx(ch) {
    const i = RANKS.indexOf(ch);
    if (i < 0) throw new Error('Bad rank: ' + ch);
    return i;
  }

  function classIndex(hi, lo, kind) {
    // hi/lo are grid rank indexes (0 = A); hi < lo for non-pairs
    if (hi === lo) return hi * 13 + hi;
    return kind === 's' ? hi * 13 + lo : lo * 13 + hi;
  }

  function expandToken(tok) {
    const out = [];
    const pairRe = /^([AKQJT2-9])\1$/;
    let m;
    if ((m = tok.match(/^([AKQJT2-9])\1\+$/))) {
      for (let r = rankIdx(m[1]); r >= 0; r--) out.push(r * 13 + r);
      return out;
    }
    if ((m = tok.match(/^([AKQJT2-9])\1-([AKQJT2-9])\2$/))) {
      let a = rankIdx(m[1]), b = rankIdx(m[2]);
      if (a > b) [a, b] = [b, a];
      for (let r = a; r <= b; r++) out.push(r * 13 + r);
      return out;
    }
    if (pairRe.test(tok)) return [rankIdx(tok[0]) * 14];
    if ((m = tok.match(/^([AKQJT2-9])([AKQJT2-9])([so]?)\+$/))) {
      const hi = rankIdx(m[1]), lo = rankIdx(m[2]);
      if (hi >= lo) throw new Error('Bad token: ' + tok);
      for (let r = lo; r > hi; r--) pushKinds(out, hi, r, m[3]);
      return out;
    }
    if ((m = tok.match(/^([AKQJT2-9])([AKQJT2-9])([so]?)-([AKQJT2-9])([AKQJT2-9])([so]?)$/))) {
      const hi = rankIdx(m[1]);
      if (rankIdx(m[4]) !== hi || m[3] !== m[6]) throw new Error('Bad token: ' + tok);
      let a = rankIdx(m[2]), b = rankIdx(m[5]);
      if (a > b) [a, b] = [b, a];
      if (a <= hi) throw new Error('Bad token: ' + tok);
      for (let r = a; r <= b; r++) pushKinds(out, hi, r, m[3]);
      return out;
    }
    if ((m = tok.match(/^([AKQJT2-9])([AKQJT2-9])([so]?)$/))) {
      const hi = rankIdx(m[1]), lo = rankIdx(m[2]);
      if (hi >= lo) throw new Error('Bad token: ' + tok);
      pushKinds(out, hi, lo, m[3]);
      return out;
    }
    throw new Error('Bad token: ' + tok);
  }

  function pushKinds(out, hi, lo, kind) {
    if (kind !== 'o') out.push(classIndex(hi, lo, 's'));
    if (kind !== 's') out.push(classIndex(hi, lo, 'o'));
  }

  /** Parse a range string into a Float64Array(169) of frequencies in [0, 1]. */
  function parseRange(str) {
    const w = new Float64Array(169);
    if (!str) return w;
    for (const raw of str.split(',')) {
      const part = raw.trim();
      if (!part) continue;
      const [tok, freqStr] = part.split(':');
      const f = freqStr === undefined ? 1 : Number(freqStr);
      if (!(f >= 0 && f <= 1)) throw new Error('Bad frequency in: ' + part);
      for (const idx of expandToken(tok.trim())) w[idx] = f;
    }
    return w;
  }

  /** Share of all 1326 combos covered by a weight array. */
  function rangePercent(w) {
    let combosIn = 0;
    for (let i = 0; i < 169; i++) combosIn += w[i] * comboCount(i);
    return (combosIn / 1326) * 100;
  }

  /** Decode the equity table shipped in js/data/equity.js into a 169x169 matrix. */
  function decodeEquity(upper) {
    const m = Array.from({ length: 169 }, () => new Float64Array(169));
    let k = 0;
    for (let a = 0; a < 169; a++) {
      m[a][a] = 0.5;
      for (let b = a + 1; b < 169; b++) {
        const e = upper[k++] / 10000;
        m[a][b] = e;
        m[b][a] = 1 - e;
      }
    }
    return m;
  }

  root.GTO = root.GTO || {};
  root.GTO.core = {
    RANKS, SUITS, SUIT_SYMBOL, HAND_NAMES,
    handName, handIndex, handType, comboCount, combos, comboPairs,
    randomHandIndex, randomCombo, parseRange, rangePercent, decodeEquity,
  };
})(typeof window !== 'undefined' ? window : globalThis);
