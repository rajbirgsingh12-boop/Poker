/*
 * Training history and settings, kept in this browser's localStorage.
 * Every access is guarded: storage can be unavailable (private windows,
 * blocked site data), in which case the app keeps working without history.
 */
(function (root) {
  'use strict';
  const KEY = 'gto-trainer:v1';

  const blank = () => ({ modules: {}, spots: {}, misses: {}, settings: {} });
  let state = load();

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return blank();
  }

  function save() {
    try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /**
   * Record one answered drill.
   *   module  - 'preflop' | 'pushfold' | 'equity' | 'math'
   *   spot    - finer-grained key (scenario id, stack bucket, question type)
   *   miss    - optional label stored when the answer was not fully correct
   */
  function record(module, spot, score, miss) {
    const m = (state.modules[module] ||= { n: 0, score: 0 });
    m.n++;
    m.score += score;
    const key = module + ':' + spot;
    const s = (state.spots[key] ||= { n: 0, score: 0 });
    s.n++;
    s.score += score;
    if (score < 1 && miss) {
      const mk = module + '|' + miss;
      state.misses[mk] = (state.misses[mk] || 0) + 1;
    }
    save();
  }

  function setting(name, fallback) {
    return name in state.settings ? state.settings[name] : fallback;
  }

  function setSetting(name, value) {
    state.settings[name] = value;
    save();
  }

  function reset() {
    const settings = state.settings;
    state = blank();
    state.settings = settings;
    save();
  }

  root.GTO.store = { record, setting, setSetting, reset, get: () => state };
})(typeof window !== 'undefined' ? window : globalThis);
