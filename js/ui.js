/* Small DOM helpers and the shared visual pieces: cards, range grid, table, strategy bar. */
(function (root) {
  'use strict';
  const { core } = root.GTO;

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), sv);
        } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : String(kid));
    }
    return el;
  }

  /** replaceChildren that skips null/false, so conditional pieces can be inlined. */
  function put(el, ...kids) {
    el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  }

  const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
  const signed = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);

  /* ---------- cards ---------- */
  function card(str) {
    const r = str[0] === 'T' ? '10' : str[0];
    const s = str[1];
    return h('div', { class: 'pcard s-' + s, 'aria-label': str },
      h('span', { class: 'r' }, r),
      h('span', { class: 's' }, core.SUIT_SYMBOL[s]));
  }

  function handCards(combo, { small = false, deal = true } = {}) {
    return h('div', { class: 'hand' + (small ? ' small' : '') + (deal ? ' deal' : '') }, card(combo[0]), card(combo[1]));
  }

  function describeHand(idx) {
    const t = core.handType(idx);
    return t === 'pair' ? 'Pocket pair' : t === 'suited' ? 'Suited' : 'Offsuit';
  }

  /* ---------- strategy bar ---------- */
  function strategyBar(actions) {
    const bar = h('div', { class: 'sbar', role: 'img', 'aria-label': actions.map((a) => `${a.label} ${pct(a.freq)}`).join(', ') });
    for (const a of actions) {
      if (a.freq <= 0.001) continue;
      bar.append(h('div', {
        class: `k-${a.kind}-bg`,
        style: { flexBasis: a.freq * 100 + '%' },
        title: `${a.label} ${pct(a.freq)}`,
      }, a.freq >= 0.22 ? `${a.label} ${pct(a.freq)}` : a.freq >= 0.1 ? pct(a.freq) : ''));
    }
    return bar;
  }

  function freqSentence(actions) {
    return actions.filter((a) => a.freq > 0.001).map((a) => `${a.label} ${pct(a.freq)}`).join(' · ');
  }

  /* ---------- range grid ---------- */
  function gradient(parts) {
    let acc = 0;
    const stops = [];
    for (const p of parts) {
      if (p.f <= 0.001) continue;
      const a = acc * 100, b = (acc + p.f) * 100;
      stops.push(`var(--g-${p.kind}) ${a.toFixed(2)}% ${b.toFixed(2)}%`);
      acc += p.f;
    }
    if (!stops.length) return 'var(--g-void)';
    if (acc < 0.999) stops.push(`var(--g-void) ${(acc * 100).toFixed(2)}% 100%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }

  /**
   * opts.fill(idx)   -> [{kind, f}] | { css } | null (hand not in range)
   * opts.note(idx)   -> optional corner text
   * opts.highlight   -> hand index to ring
   * opts.selected    -> hand index with a selection outline
   * opts.onCell(idx) -> makes cells clickable
   */
  function rangeGrid(opts) {
    const grid = h('div', { class: 'grid', role: 'grid', 'aria-label': opts.label || 'Hand range' });
    for (let i = 0; i < 169; i++) {
      const fill = opts.fill(i);
      const cls = ['cell'];
      let bg;
      if (fill == null) { cls.push('void'); bg = 'var(--g-void)'; }
      else if (fill.css) bg = fill.css;
      else bg = gradient(fill);
      if (i === opts.highlight) cls.push('hl');
      if (i === opts.selected) cls.push('sel');
      const tag = opts.onCell ? 'button' : 'div';
      const cell = h(tag, {
        class: cls.join(' '),
        style: { background: bg },
        title: opts.title ? opts.title(i) : core.HAND_NAMES[i],
        type: opts.onCell ? 'button' : null,
        onClick: opts.onCell ? () => opts.onCell(i) : null,
        onMouseenter: opts.onHover ? () => opts.onHover(i) : null,
      }, core.HAND_NAMES[i]);
      const note = opts.note && opts.note(i);
      if (note) cell.append(h('span', { class: 'n' }, note));
      grid.append(cell);
    }
    return grid;
  }

  function legend(items) {
    return h('div', { class: 'legend' }, items.map((it) =>
      h('span', null, h('i', { class: `k-${it.kind}-bg` }), `${it.label} `, h('b', null, pct(it.share, 1)))));
  }

  /* ---------- table ---------- */
  const SIX_MAX = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const SLOT_ANGLES = [90, 150, 210, 270, 330, 30]; // clockwise from the bottom seat

  /**
   * seats: [{ pos, state: 'hero'|'villain'|'folded'|'waiting', bet, note }]
   * Seats are placed clockwise from the hero, who sits at the bottom.
   */
  function pokerTable({ seats, dealer, pot, potLabel = 'Pot' }) {
    const wrap = h('div', { class: 'table' }, h('div', { class: 'felt' }));
    const hero = seats.find((s) => s.state === 'hero');
    const n = seats.length;
    let order;
    let angles;
    if (n === 2) {
      order = [hero, seats.find((s) => s !== hero)];
      angles = [90, 270];
    } else {
      const start = SIX_MAX.indexOf(hero.pos);
      order = SIX_MAX.map((_, k) => seats.find((s) => s.pos === SIX_MAX[(start + k) % 6]));
      angles = SLOT_ANGLES;
    }
    order.forEach((s, k) => {
      const t = (angles[k] * Math.PI) / 180;
      const x = 50 + 43 * Math.cos(t), y = 50 + 41 * Math.sin(t);
      wrap.append(h('div', { class: `seat ${s.state}`, style: { left: x + '%', top: y + '%' } },
        h('span', { class: 'seat-tag' }, s.pos),
        s.note ? h('span', { class: 'seat-note' }, s.note) : null));
      if (s.bet) {
        const bx = 50 + 0.6 * (x - 50), by = 50 + 0.5 * (y - 50);
        wrap.append(h('span', { class: 'bet' + (s.blind ? ' blind' : ''), style: { left: bx + '%', top: by + '%' } }, h('i'), s.bet));
      }
      if (s.pos === dealer) {
        const dx = 50 + 0.72 * (x - 50) + (x < 50 ? 6 : -6), dy = 50 + 0.72 * (y - 50);
        wrap.append(h('span', { class: 'dealer', style: { left: dx + '%', top: dy + '%' } }, 'D'));
      }
    });
    if (pot != null) wrap.append(h('div', { class: 'pot' }, potLabel, h('b', null, fmtBB(pot))));
    return wrap;
  }

  function fmtBB(x) {
    return (Math.round(x * 10) / 10).toString() + 'bb';
  }

  /* ---------- controls ---------- */
  function chipGroup({ label, options, selected, multi = false, onChange }) {
    const sel = new Set(Array.isArray(selected) ? selected : [selected]);
    const box = h('div', { class: 'chips', role: 'group', 'aria-label': label });
    const render = () => {
      box.replaceChildren(...options.map((o) => h('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(sel.has(o.id)), title: o.title || null,
        onClick: () => {
          if (multi) {
            if (sel.has(o.id) && sel.size > 1) sel.delete(o.id);
            else sel.add(o.id);
          } else {
            sel.clear();
            sel.add(o.id);
          }
          render();
          onChange(multi ? options.filter((x) => sel.has(x.id)).map((x) => x.id) : o.id);
        },
      }, o.label)));
    };
    render();
    return h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), box);
  }

  function toggle({ id, label, checked, onChange }) {
    const input = h('input', { type: 'checkbox', id, role: 'switch' });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'switch', for: id }, input, label);
  }

  function verdictLabel(result) {
    return result === 'correct' ? 'Correct' : result === 'inaccurate' ? 'Low-frequency play' : 'Mistake';
  }

  function sessionStrip(sess) {
    const acc = sess.n ? pct(sess.score / sess.n) : '–';
    return h('div', { class: 'session', 'aria-live': 'polite' },
      h('span', null, 'Hands ', h('b', null, sess.n)),
      h('span', null, 'Accuracy ', h('b', null, acc)),
      h('span', null, 'Streak ', h('b', null, sess.streak)),
      h('span', null, 'Best ', h('b', null, sess.best)));
  }

  function newSession() {
    return { n: 0, score: 0, streak: 0, best: 0 };
  }

  function bumpSession(sess, score) {
    sess.n++;
    sess.score += score;
    sess.streak = score === 1 ? sess.streak + 1 : 0;
    sess.best = Math.max(sess.best, sess.streak);
  }

  root.GTO.ui = {
    h, put, pct, signed, card, handCards, describeHand, strategyBar, freqSentence, rangeGrid, gradient, legend,
    pokerTable, fmtBB, chipGroup, toggle, verdictLabel, sessionStrip, newSession, bumpSession, SIX_MAX,
  };
})(typeof window !== 'undefined' ? window : globalThis);
