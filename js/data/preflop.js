/*
 * 6-max, 100bb cash-game preflop strategies.
 *
 * These are hand-built approximations of published solver output for a
 * standard rake-free setup (2.5bb opens, 3bb from the SB). Each action lists
 * the frequency it is taken with every hand. Whatever is left over is a fold.
 * Mixed frequencies such as "KJo:0.6" mean the hand plays that action 60% of
 * the time in equilibrium.
 *
 * Scenario groups:
 *   rfi    - first to act ("raise first in")
 *   vsOpen - facing a single open raise
 *   vs3bet - you opened and got 3-bet; only hands from your opening range
 *            reach this spot (see `from`)
 */
(function (root) {
  'use strict';

  const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

  const scenarios = [
    /* ---------------- raise first in ---------------- */
    {
      id: 'rfi-UTG', group: 'rfi', hero: 'UTG',
      title: 'UTG open',
      setup: 'You are first to act under the gun.',
      actions: [{
        id: 'raise', label: 'Raise 2.5',
        range: '55+,44:0.7,33:0.5,22:0.5,A8s+,A7s:0.8,A6s:0.6,A5s,A4s,A3s:0.7,A2s:0.5,K9s+,K8s:0.3,QTs+,Q9s:0.6,JTs,J9s:0.5,T9s,T8s:0.3,98s:0.7,87s:0.5,76s:0.5,65s:0.4,54s:0.3,AJo+,ATo:0.8,KQo,KJo:0.6,QJo:0.2',
      }],
    },
    {
      id: 'rfi-HJ', group: 'rfi', hero: 'HJ',
      title: 'HJ open',
      setup: 'UTG folds. You are in the hijack.',
      actions: [{
        id: 'raise', label: 'Raise 2.5',
        range: '44+,33:0.8,22:0.7,A2s+,K9s+,K8s:0.8,K7s:0.5,K6s:0.3,K5s:0.3,Q9s+,Q8s:0.4,J9s+,J8s:0.3,T9s,T8s:0.6,98s,97s:0.3,87s:0.8,76s:0.7,65s:0.6,54s:0.5,ATo+,A9o:0.3,KJo+,KTo:0.5,QJo:0.6,QTo:0.2,JTo:0.2',
      }],
    },
    {
      id: 'rfi-CO', group: 'rfi', hero: 'CO',
      title: 'CO open',
      setup: 'Folds to you in the cutoff.',
      actions: [{
        id: 'raise', label: 'Raise 2.5',
        range: '22+,A2s+,K6s+,K5s:0.8,K4s:0.6,K3s:0.4,K2s:0.3,Q8s+,Q7s:0.4,Q6s:0.3,J8s+,J7s:0.4,T8s+,T7s:0.5,97s+,96s:0.2,87s,86s:0.7,76s,75s:0.5,65s,64s:0.3,54s,53s:0.2,A9o+,A8o:0.7,A5o:0.5,KTo+,K9o:0.4,QTo+,Q9o:0.2,JTo,J9o:0.2',
      }],
    },
    {
      id: 'rfi-BTN', group: 'rfi', hero: 'BTN',
      title: 'BTN open',
      setup: 'Folds to you on the button.',
      actions: [{
        id: 'raise', label: 'Raise 2.5',
        range: '22+,A2s+,K2s+,Q3s+,Q2s:0.5,J5s+,J4s:0.3,T6s+,T5s:0.3,96s+,95s:0.2,85s+,75s+,74s:0.4,64s+,63s:0.3,53s+,43s:0.6,A5o+,A4o:0.8,A3o:0.7,A2o:0.4,K8o+,K7o:0.6,K6o:0.3,Q9o+,Q8o:0.3,J9o+,J8o:0.5,T9o,T8o:0.6,98o:0.6,87o:0.3',
      }],
    },
    {
      id: 'rfi-SB', group: 'rfi', hero: 'SB',
      title: 'SB open',
      setup: 'Folds to you in the small blind. This uses a raise-or-fold strategy (no limping).',
      actions: [{
        id: 'raise', label: 'Raise 3',
        range: '22+,A2s+,K2s+,Q4s+,Q3s:0.5,Q2s:0.3,J6s+,J5s:0.5,J4s:0.3,T6s+,T5s:0.3,96s+,85s+,75s+,74s:0.3,64s+,53s+,43s:0.4,A3o+,A2o:0.7,K8o+,K7o:0.6,K6o:0.3,Q9o+,Q8o:0.5,J9o+,J8o:0.3,T9o,T8o:0.4,98o:0.4,87o:0.2',
      }],
    },

    /* ---------------- facing an open ---------------- */
    {
      id: 'HJ-vs-UTG', group: 'vsOpen', hero: 'HJ', villain: 'UTG',
      title: 'HJ vs UTG open',
      setup: 'UTG opens to 2.5bb. You are in the hijack.',
      actions: [
        { id: '3bet', label: '3-bet 7.5', range: 'AA,KK,QQ:0.8,JJ:0.3,AKs:0.8,AKo:0.9,AQs:0.5,AJs:0.3,A5s:0.6,A4s:0.4,KQs:0.3,KJs:0.2,AQo:0.3' },
        { id: 'call', label: 'Call', range: 'QQ:0.2,JJ:0.7,TT,99:0.9,88:0.6,77:0.4,66:0.3,AKs:0.2,AQs:0.5,AJs:0.7,ATs:0.8,KQs:0.7,KJs:0.6,QJs:0.6,JTs:0.5,T9s:0.3,AQo:0.4,AKo:0.1' },
      ],
    },
    {
      id: 'CO-vs-UTG', group: 'vsOpen', hero: 'CO', villain: 'UTG',
      title: 'CO vs UTG open',
      setup: 'UTG opens to 2.5bb, HJ folds. You are in the cutoff.',
      actions: [
        { id: '3bet', label: '3-bet 7.5', range: 'AA,KK,QQ:0.8,JJ:0.3,AKs:0.8,AKo:0.9,AQs:0.5,AJs:0.3,A5s:0.7,A4s:0.5,A3s:0.2,KQs:0.3,KJs:0.2,AQo:0.3' },
        { id: 'call', label: 'Call', range: 'QQ:0.2,JJ:0.7,TT,99,88:0.7,77:0.5,66:0.3,55:0.2,AKs:0.2,AQs:0.5,AJs:0.7,ATs:0.9,A9s:0.3,KQs:0.7,KJs:0.7,KTs:0.4,QJs:0.7,QTs:0.3,JTs:0.6,T9s:0.4,98s:0.2,AQo:0.4,AKo:0.1' },
      ],
    },
    {
      id: 'CO-vs-HJ', group: 'vsOpen', hero: 'CO', villain: 'HJ',
      title: 'CO vs HJ open',
      setup: 'HJ opens to 2.5bb. You are in the cutoff.',
      actions: [
        { id: '3bet', label: '3-bet 7.5', range: 'AA,KK,QQ:0.9,JJ:0.5,TT:0.2,AKs:0.9,AKo,AQs:0.6,AJs:0.4,ATs:0.2,A5s:0.8,A4s:0.6,A3s:0.3,KQs:0.5,KJs:0.3,KTs:0.2,QJs:0.2,AQo:0.5,AJo:0.2,KQo:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.1,JJ:0.5,TT:0.8,99,88:0.8,77:0.6,66:0.4,55:0.3,AKs:0.1,AQs:0.4,AJs:0.6,ATs:0.8,A9s:0.4,KQs:0.5,KJs:0.7,KTs:0.6,QJs:0.8,QTs:0.5,JTs:0.8,T9s:0.6,98s:0.4,87s:0.2,AQo:0.4,AJo:0.2,KQo:0.3' },
      ],
    },
    {
      id: 'BTN-vs-UTG', group: 'vsOpen', hero: 'BTN', villain: 'UTG',
      title: 'BTN vs UTG open',
      setup: 'UTG opens to 2.5bb, HJ and CO fold. You are on the button.',
      actions: [
        { id: '3bet', label: '3-bet 7.5', range: 'AA,KK,QQ:0.7,JJ:0.2,AKs:0.7,AKo:0.8,AQs:0.4,AJs:0.2,A5s:0.6,A4s:0.4,KQs:0.2,AQo:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.3,JJ:0.8,TT,99,88,77:0.8,66:0.6,55:0.5,44:0.3,33:0.2,22:0.2,AKs:0.3,AQs:0.6,AJs:0.8,ATs,A9s:0.5,A8s:0.3,A5s:0.2,A4s:0.2,KQs:0.8,KJs,KTs:0.8,K9s:0.3,QJs,QTs:0.8,Q9s:0.2,JTs,J9s:0.4,T9s:0.8,98s:0.6,87s:0.4,76s:0.3,65s:0.2,AKo:0.2,AQo:0.6,AJo:0.3,KQo:0.4' },
      ],
    },
    {
      id: 'BTN-vs-HJ', group: 'vsOpen', hero: 'BTN', villain: 'HJ',
      title: 'BTN vs HJ open',
      setup: 'HJ opens to 2.5bb, CO folds. You are on the button.',
      actions: [
        { id: '3bet', label: '3-bet 7.5', range: 'AA,KK,QQ:0.8,JJ:0.4,TT:0.2,AKs:0.8,AKo:0.9,AQs:0.5,AJs:0.3,ATs:0.2,A5s:0.7,A4s:0.5,A3s:0.3,KQs:0.4,KJs:0.2,AQo:0.4,AJo:0.2,KQo:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.2,JJ:0.6,TT:0.8,99,88,77:0.9,66:0.7,55:0.6,44:0.4,33:0.3,22:0.3,AKs:0.2,AQs:0.5,AJs:0.7,ATs:0.8,A9s:0.6,A8s:0.4,A7s:0.3,A5s:0.2,A4s:0.2,KQs:0.6,KJs:0.8,KTs,K9s:0.5,QJs,QTs,Q9s:0.4,JTs,J9s:0.6,T9s,T8s:0.3,98s:0.8,87s:0.6,76s:0.5,65s:0.4,54s:0.2,AKo:0.1,AQo:0.6,AJo:0.5,ATo:0.2,KQo:0.6,KJo:0.2' },
      ],
    },
    {
      id: 'BTN-vs-CO', group: 'vsOpen', hero: 'BTN', villain: 'CO',
      title: 'BTN vs CO open',
      setup: 'CO opens to 2.5bb. You are on the button.',
      actions: [
        { id: '3bet', label: '3-bet 7.5', range: 'AA,KK,QQ,JJ:0.6,TT:0.4,99:0.2,AKs,AKo,AQs:0.7,AJs:0.5,ATs:0.4,A9s:0.2,A5s:0.8,A4s:0.7,A3s:0.5,A2s:0.3,KQs:0.6,KJs:0.4,KTs:0.3,K9s:0.2,QJs:0.3,QTs:0.2,JTs:0.2,65s:0.2,54s:0.2,AQo:0.7,AJo:0.4,ATo:0.2,KQo:0.4,KJo:0.2' },
        { id: 'call', label: 'Call', range: 'JJ:0.4,TT:0.6,99:0.8,88,77,66:0.8,55:0.6,44:0.5,33:0.4,22:0.4,AQs:0.3,AJs:0.5,ATs:0.6,A9s:0.6,A8s:0.6,A7s:0.4,A6s:0.3,A5s:0.2,A4s:0.2,KQs:0.4,KJs:0.6,KTs:0.7,K9s:0.6,K8s:0.2,QJs:0.7,QTs:0.8,Q9s:0.6,JTs:0.8,J9s:0.7,T9s:0.9,T8s:0.4,98s:0.9,97s:0.2,87s:0.8,76s:0.7,65s:0.6,54s:0.4,AQo:0.3,AJo:0.5,ATo:0.4,KQo:0.6,KJo:0.4,QJo:0.3' },
      ],
    },
    {
      id: 'SB-vs-UTG', group: 'vsOpen', hero: 'SB', villain: 'UTG',
      title: 'SB vs UTG open',
      setup: 'UTG opens to 2.5bb and it folds to you in the small blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'AA,KK,QQ,JJ:0.8,TT:0.5,99:0.2,AKs,AKo,AQs,AJs:0.7,ATs:0.4,A5s:0.7,A4s:0.5,KQs:0.8,KJs:0.4,QJs:0.2,AQo:0.6,KQo:0.2' },
        { id: 'call', label: 'Call', range: 'JJ:0.2,TT:0.3,99:0.3,88:0.2,AJs:0.2,KJs:0.2,QJs:0.2,JTs:0.2' },
      ],
    },
    {
      id: 'SB-vs-HJ', group: 'vsOpen', hero: 'SB', villain: 'HJ',
      title: 'SB vs HJ open',
      setup: 'HJ opens to 2.5bb and it folds to you in the small blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'AA,KK,QQ,JJ,TT:0.7,99:0.4,88:0.2,AKs,AQs,AJs,ATs:0.8,A9s:0.3,A5s:0.9,A4s:0.7,A3s:0.4,KQs,KJs:0.7,KTs:0.4,QJs:0.5,QTs:0.2,JTs:0.3,AKo,AQo:0.9,AJo:0.5,KQo:0.5' },
        { id: 'call', label: 'Call', range: 'TT:0.3,99:0.3,88:0.3,77:0.2,A9s:0.2,KTs:0.2,QJs:0.2,JTs:0.3,T9s:0.2' },
      ],
    },
    {
      id: 'SB-vs-CO', group: 'vsOpen', hero: 'SB', villain: 'CO',
      title: 'SB vs CO open',
      setup: 'CO opens to 2.5bb and the button folds. You are in the small blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'TT+,99:0.8,88:0.5,77:0.3,ATs+,A9s:0.6,A8s:0.4,A7s:0.2,A5s,A4s:0.9,A3s:0.6,A2s:0.4,KJs+,KTs:0.7,K9s:0.3,QJs:0.8,QTs:0.5,JTs:0.6,T9s:0.3,98s:0.2,AQo+,AJo:0.8,ATo:0.4,KQo:0.8,KJo:0.4,QJo:0.2' },
        { id: 'call', label: 'Call', range: '99:0.2,88:0.3,77:0.3,66:0.2,A9s:0.2,KTs:0.2,QTs:0.2,JTs:0.2,T9s:0.3,98s:0.2,87s:0.2' },
      ],
    },
    {
      id: 'SB-vs-BTN', group: 'vsOpen', hero: 'SB', villain: 'BTN',
      title: 'SB vs BTN open',
      setup: 'The button opens to 2.5bb. You are in the small blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: '88+,77:0.8,66:0.6,55:0.4,44:0.3,A9s+,A8s:0.9,A7s:0.8,A6s:0.7,A5s,A4s,A3s:0.9,A2s:0.8,KTs+,K9s:0.8,K8s:0.5,K7s:0.3,K6s:0.2,QTs+,Q9s:0.7,Q8s:0.3,JTs,J9s:0.7,J8s:0.2,T9s:0.8,T8s:0.4,98s:0.6,87s:0.4,76s:0.3,65s:0.3,54s:0.2,ATo+,A9o:0.6,A8o:0.3,A5o:0.3,KJo+,KTo:0.6,QJo:0.6,QTo:0.3,JTo:0.3' },
        { id: 'call', label: 'Call', range: '77:0.2,66:0.3,55:0.3,44:0.3,33:0.3,22:0.3,98s:0.2,87s:0.3,76s:0.3,65s:0.2' },
      ],
    },
    {
      id: 'BB-vs-UTG', group: 'vsOpen', hero: 'BB', villain: 'UTG',
      title: 'BB vs UTG open',
      setup: 'UTG opens to 2.5bb and everyone folds to you in the big blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'AA,KK,QQ:0.8,JJ:0.4,AKs,AKo:0.8,AQs:0.5,A5s:0.5,A4s:0.4,KQs:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.2,JJ:0.6,TT-44,33:0.9,22:0.8,AKo:0.2,AQs:0.5,AJs-A6s,A5s:0.5,A4s:0.6,A3s,A2s,KQs:0.8,KJs-K8s,K7s:0.8,K6s:0.6,K5s:0.4,K4s:0.3,QJs-Q9s,Q8s:0.7,Q7s:0.3,JTs-J9s,J8s:0.7,J7s:0.3,T9s,T8s,T7s:0.5,98s,97s:0.7,96s:0.2,87s,86s:0.6,76s,75s:0.5,65s,64s:0.4,54s:0.9,53s:0.3,43s:0.2,AQo,AJo,ATo:0.8,A9o:0.3,KQo,KJo:0.8,KTo:0.4,QJo:0.6,QTo:0.3,JTo:0.4' },
      ],
    },
    {
      id: 'BB-vs-HJ', group: 'vsOpen', hero: 'BB', villain: 'HJ',
      title: 'BB vs HJ open',
      setup: 'HJ opens to 2.5bb and everyone folds to you in the big blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'AA,KK,QQ:0.9,JJ:0.5,TT:0.2,AKs,AKo:0.9,AQs:0.6,AJs:0.3,A5s:0.6,A4s:0.5,A3s:0.2,KQs:0.3,KJs:0.2,AQo:0.3' },
        { id: 'call', label: 'Call', range: 'QQ:0.1,JJ:0.5,TT:0.8,99-22,AKo:0.1,AQs:0.4,AJs:0.7,ATs-A6s,A5s:0.4,A4s:0.5,A3s:0.8,A2s,KQs:0.7,KJs:0.8,KTs-K6s,K5s:0.7,K4s:0.5,K3s:0.3,K2s:0.2,QJs-Q8s,Q7s:0.5,Q6s:0.3,JTs-J8s,J7s:0.5,T9s,T8s,T7s:0.7,98s,97s,96s:0.4,87s,86s:0.8,85s:0.2,76s,75s:0.8,65s,64s:0.6,54s,53s:0.5,43s:0.3,AQo:0.7,AJo,ATo,A9o:0.5,A8o:0.2,KQo,KJo,KTo:0.7,K9o:0.2,QJo:0.9,QTo:0.6,JTo:0.7,T9o:0.2' },
      ],
    },
    {
      id: 'BB-vs-CO', group: 'vsOpen', hero: 'BB', villain: 'CO',
      title: 'BB vs CO open',
      setup: 'CO opens to 2.5bb and everyone folds to you in the big blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'QQ+,JJ:0.7,TT:0.4,99:0.2,AKs,AKo,AQs:0.8,AJs:0.5,ATs:0.3,A5s:0.7,A4s:0.6,A3s:0.4,A2s:0.2,KQs:0.5,KJs:0.4,KTs:0.2,QJs:0.2,65s:0.2,54s:0.2,AQo:0.6,AJo:0.3,KQo:0.3' },
        { id: 'call', label: 'Call', range: 'JJ:0.3,TT:0.6,99:0.8,88-22,AQs:0.2,AJs:0.5,ATs:0.7,A9s-A6s,A5s:0.3,A4s:0.4,A3s:0.6,A2s:0.8,KQs:0.5,KJs:0.6,KTs:0.8,K9s-K5s,K4s:0.8,K3s:0.7,K2s:0.6,QJs:0.8,QTs-Q5s,Q4s:0.4,Q3s:0.3,Q2s:0.2,JTs-J7s,J6s:0.4,J5s:0.2,T9s-T7s,T6s:0.5,98s-97s,96s:0.8,95s:0.2,87s,86s,85s:0.5,76s,75s,74s:0.4,65s:0.8,64s:0.9,63s:0.3,54s:0.8,53s:0.7,43s:0.5,AQo:0.4,AJo:0.7,ATo-A8o,A7o:0.7,A6o:0.4,A5o:0.5,A4o:0.3,KQo:0.7,KJo,KTo,K9o:0.7,K8o:0.2,QJo,QTo,Q9o:0.5,JTo,J9o:0.5,T9o:0.6,T8o:0.2,98o:0.3' },
      ],
    },
    {
      id: 'BB-vs-BTN', group: 'vsOpen', hero: 'BB', villain: 'BTN',
      title: 'BB vs BTN open',
      setup: 'The button opens to 2.5bb and the small blind folds. You are in the big blind.',
      actions: [
        { id: '3bet', label: '3-bet 11', range: 'JJ+,TT:0.7,99:0.4,88:0.2,AJs+,ATs:0.6,A9s:0.3,A5s:0.8,A4s:0.7,A3s:0.5,A2s:0.4,KQs,KJs:0.7,KTs:0.5,K9s:0.3,K5s:0.2,QJs:0.5,QTs:0.4,Q9s:0.2,JTs:0.4,J9s:0.2,T9s:0.3,98s:0.2,87s:0.2,76s:0.2,65s:0.3,54s:0.3,AQo+,AJo:0.7,ATo:0.4,A9o:0.2,KQo:0.7,KJo:0.4,KTo:0.2,QJo:0.3' },
        { id: 'call', label: 'Call', range: 'TT:0.3,99:0.6,88:0.8,77-22,ATs:0.4,A9s:0.7,A8s-A6s,A5s:0.2,A4s:0.3,A3s:0.5,A2s:0.6,KJs:0.3,KTs:0.5,K9s:0.7,K8s-K6s,K5s:0.8,K4s-K2s,QJs:0.5,QTs:0.6,Q9s:0.8,Q8s-Q3s,Q2s:0.8,JTs:0.6,J9s:0.8,J8s-J4s,J3s:0.7,J2s:0.5,T9s:0.7,T8s-T5s,T4s:0.6,T3s:0.4,T2s:0.3,98s:0.8,97s-95s,94s:0.4,93s:0.2,87s:0.8,86s-85s,84s:0.7,83s:0.3,76s:0.8,75s,74s,73s:0.5,65s:0.7,64s,63s:0.8,62s:0.2,54s:0.7,53s,52s:0.5,43s:0.9,42s:0.4,32s:0.4,AJo:0.3,ATo:0.6,A9o:0.8,A8o-A2o,KQo:0.3,KJo:0.6,KTo:0.8,K9o-K6o,K5o:0.7,K4o:0.5,K3o:0.3,K2o:0.2,QJo:0.7,QTo-Q8o,Q7o:0.6,Q6o:0.4,Q5o:0.2,JTo-J8o,J7o:0.6,J6o:0.2,T9o,T8o,T7o:0.6,T6o:0.2,98o,97o:0.8,96o:0.3,87o,86o:0.6,85o:0.2,76o:0.8,75o:0.4,65o:0.6,64o:0.2,54o:0.4' },
      ],
    },
    {
      id: 'BB-vs-SB', group: 'vsOpen', hero: 'BB', villain: 'SB',
      title: 'BB vs SB open',
      setup: 'The small blind raises to 3bb. You are in the big blind.',
      actions: [
        { id: '3bet', label: '3-bet 9', range: '99+,88:0.6,77:0.4,66:0.2,ATs+,A9s:0.6,A8s:0.4,A5s:0.7,A4s:0.6,A3s:0.4,A2s:0.3,KTs+,K9s:0.5,K8s:0.3,K5s:0.3,QJs,QTs:0.7,Q9s:0.4,Q6s:0.2,JTs:0.7,J9s:0.4,J7s:0.2,T9s:0.4,98s:0.3,87s:0.2,64s:0.2,53s:0.2,AJo+,ATo:0.7,A9o:0.4,A8o:0.2,A5o:0.3,KQo,KJo:0.8,KTo:0.5,K9o:0.2,QJo:0.6,QTo:0.3,JTo:0.3' },
        { id: 'call', label: 'Call', range: '88:0.4,77:0.6,66:0.8,55-22,A9s:0.4,A8s:0.6,A7s,A6s,A5s:0.3,A4s:0.4,A3s:0.6,A2s:0.7,K9s:0.5,K8s:0.7,K7s,K6s,K5s:0.7,K4s-K2s,QTs:0.3,Q9s:0.6,Q8s-Q7s,Q6s:0.8,Q5s-Q3s,Q2s:0.8,JTs:0.3,J9s:0.6,J8s,J7s:0.8,J6s-J4s,J3s:0.7,J2s:0.5,T9s:0.6,T8s-T6s,T5s:0.8,T4s:0.6,T3s:0.4,T2s:0.3,98s:0.7,97s-95s,94s:0.5,93s:0.2,87s:0.8,86s,85s,84s:0.6,83s:0.2,76s,75s,74s:0.8,73s:0.3,65s,64s:0.8,63s:0.6,54s,53s:0.8,52s:0.4,43s:0.8,42s:0.3,32s:0.3,ATo:0.3,A9o:0.6,A8o:0.8,A7o-A6o,A5o:0.7,A4o-A2o,KJo:0.2,KTo:0.5,K9o:0.8,K8o-K5o,K4o:0.7,K3o:0.5,K2o:0.4,QJo:0.4,QTo:0.7,Q9o,Q8o,Q7o:0.8,Q6o:0.6,Q5o:0.4,Q4o:0.2,JTo:0.7,J9o,J8o,J7o:0.7,J6o:0.3,T9o,T8o,T7o:0.7,T6o:0.3,98o,97o:0.8,96o:0.4,87o,86o:0.6,85o:0.2,76o:0.8,75o:0.4,65o:0.7,64o:0.3,54o:0.5' },
      ],
    },

    /* ---------------- facing a 3-bet ---------------- */
    {
      id: 'UTG-vs-CO-3bet', group: 'vs3bet', hero: 'UTG', villain: 'CO', from: 'rfi-UTG',
      title: 'UTG open vs CO 3-bet',
      setup: 'You opened UTG to 2.5bb, the cutoff 3-bets to 7.5bb and everyone else folds.',
      actions: [
        { id: '4bet', label: '4-bet 22', range: 'AA,KK,QQ:0.5,AKs:0.7,AKo:0.8,A5s:0.3,A4s:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.5,JJ,TT,99:0.8,88:0.5,77:0.4,66:0.3,AKs:0.3,AKo:0.2,AQs,AJs,ATs:0.8,A9s:0.2,A5s:0.4,A4s:0.3,KQs,KJs:0.8,KTs:0.4,QJs:0.6,QTs:0.2,JTs:0.6,T9s:0.4,98s:0.3,87s:0.2,76s:0.2,AQo:0.6,AJo:0.1,KQo:0.3' },
      ],
    },
    {
      id: 'CO-vs-BTN-3bet', group: 'vs3bet', hero: 'CO', villain: 'BTN', from: 'rfi-CO',
      title: 'CO open vs BTN 3-bet',
      setup: 'You opened the cutoff to 2.5bb, the button 3-bets to 7.5bb and the blinds fold.',
      actions: [
        { id: '4bet', label: '4-bet 22', range: 'AA,KK,QQ:0.7,JJ:0.2,AKs:0.8,AKo,AQs:0.3,AQo:0.2,A5s:0.5,A4s:0.4,A3s:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.3,JJ:0.8,TT,99,88:0.8,77:0.6,66:0.5,55:0.4,44:0.3,AKs:0.2,AQs:0.7,AJs,ATs,A9s:0.6,A8s:0.4,A7s:0.3,A5s:0.4,A4s:0.4,KQs,KJs,KTs:0.9,K9s:0.4,QJs,QTs:0.8,Q9s:0.3,JTs,J9s:0.4,T9s:0.8,98s:0.6,87s:0.5,76s:0.5,65s:0.4,54s:0.3,AQo:0.7,AJo:0.4,ATo:0.1,KQo:0.6,KJo:0.2' },
      ],
    },
    {
      id: 'BTN-vs-SB-3bet', group: 'vs3bet', hero: 'BTN', villain: 'SB', from: 'rfi-BTN',
      title: 'BTN open vs SB 3-bet',
      setup: 'You opened the button to 2.5bb, the small blind 3-bets to 11bb and the big blind folds.',
      actions: [
        { id: '4bet', label: '4-bet 25', range: 'AA,KK,QQ:0.6,JJ:0.2,AKs:0.6,AKo:0.8,AQo:0.2,A5s:0.4,A4s:0.4,A3s:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.4,JJ:0.8,TT-66,55:0.8,44:0.6,33:0.5,22:0.4,AKs:0.4,AQs-A9s,A8s:0.8,A7s:0.8,A6s:0.8,A5s:0.6,A4s:0.6,A3s:0.6,A2s:0.5,KQs-K9s,K8s:0.6,K7s:0.4,K6s:0.3,QJs-Q9s,Q8s:0.5,JTs,J9s,J8s:0.5,T9s,T8s:0.7,98s,97s:0.4,87s:0.9,86s:0.3,76s:0.8,65s:0.7,54s:0.5,AKo:0.2,AQo:0.8,AJo:0.8,ATo:0.5,A9o:0.2,KQo:0.8,KJo:0.6,KTo:0.3,QJo:0.5,QTo:0.2,JTo:0.3' },
      ],
    },
    {
      id: 'BTN-vs-BB-3bet', group: 'vs3bet', hero: 'BTN', villain: 'BB', from: 'rfi-BTN',
      title: 'BTN open vs BB 3-bet',
      setup: 'You opened the button to 2.5bb, the small blind folds and the big blind 3-bets to 11bb.',
      actions: [
        { id: '4bet', label: '4-bet 25', range: 'AA,KK,QQ:0.7,JJ:0.2,AKs:0.7,AKo:0.9,AQo:0.1,A5s:0.4,A4s:0.3' },
        { id: 'call', label: 'Call', range: 'QQ:0.3,JJ:0.8,TT-66,55:0.8,44:0.6,33:0.4,22:0.4,AKs:0.3,AQs-ATs,A9s:0.9,A8s:0.7,A7s:0.6,A6s:0.5,A5s:0.6,A4s:0.6,A3s:0.5,A2s:0.4,KQs-KTs,K9s:0.9,K8s:0.5,K7s:0.3,QJs,QTs,Q9s:0.8,Q8s:0.3,JTs,J9s:0.8,J8s:0.3,T9s,T8s:0.6,98s:0.9,97s:0.3,87s:0.8,76s:0.7,65s:0.6,54s:0.4,AKo:0.1,AQo:0.8,AJo:0.7,ATo:0.4,KQo:0.8,KJo:0.5,KTo:0.2,QJo:0.4,JTo:0.2' },
      ],
    },
    {
      id: 'SB-vs-BB-3bet', group: 'vs3bet', hero: 'SB', villain: 'BB', from: 'rfi-SB',
      title: 'SB open vs BB 3-bet',
      setup: 'You raised the small blind to 3bb and the big blind 3-bets to 9bb.',
      actions: [
        { id: '4bet', label: '4-bet 22', range: 'AA,KK,QQ:0.7,JJ:0.3,TT:0.1,AKs:0.8,AKo,AQs:0.3,AQo:0.3,A5s:0.5,A4s:0.4,A3s:0.3,KQs:0.2' },
        { id: 'call', label: 'Call', range: 'QQ:0.3,JJ:0.7,TT:0.9,99-77,66:0.9,55:0.8,44:0.6,33:0.5,22:0.4,AKs:0.2,AQs:0.7,AJs,ATs,A9s,A8s:0.8,A7s:0.7,A6s:0.6,A5s:0.5,A4s:0.5,A3s:0.5,A2s:0.4,KQs:0.8,KJs,KTs,K9s,K8s:0.6,K7s:0.4,K6s:0.3,QJs,QTs,Q9s,Q8s:0.4,JTs,J9s,J8s:0.4,T9s,T8s:0.6,98s:0.9,97s:0.3,87s:0.8,76s:0.7,65s:0.6,54s:0.5,AQo:0.7,AJo:0.8,ATo:0.6,A9o:0.3,KQo:0.8,KJo:0.6,KTo:0.4,QJo:0.5,QTo:0.3,JTo:0.4,T9o:0.1' },
      ],
    },
  ];

  const GROUPS = [
    { id: 'rfi', label: 'Nobody has raised', blurb: 'Everyone before you folded: raise or fold (an "open")' },
    { id: 'vsOpen', label: 'Someone raised', blurb: 'A player raised before you: re-raise (3-bet), call or fold' },
    { id: 'vs3bet', label: 'You got re-raised', blurb: 'You raised and someone re-raised: 4-bet, call or fold' },
  ];

  root.GTO = root.GTO || {};
  root.GTO.preflop = { POSITIONS, GROUPS, scenarios };
})(typeof window !== 'undefined' ? window : globalThis);
