/*
 * Plain-English explanations for newer players: what a spot means, what each
 * action does, and why a hand is played the way it is.
 */
(function (root) {
  'use strict';
  const { core } = root.GTO;

  const POSITIONS = {
    UTG: { name: 'Under the gun', short: 'first to act', behind: 5 },
    HJ: { name: 'Hijack', short: 'second to act', behind: 4 },
    CO: { name: 'Cutoff', short: 'just before the button', behind: 3 },
    BTN: { name: 'Button', short: 'the dealer, acts last after the flop', behind: 2 },
    SB: { name: 'Small blind', short: 'posts 0.5bb, acts first after the flop', behind: 1 },
    BB: { name: 'Big blind', short: 'posts 1bb, acts last before the flop', behind: 0 },
  };

  /** Short explanation shown under each action button. */
  function actionHint(id, label) {
    const size = (label.match(/[\d.]+$/) || [])[0];
    switch (id) {
      case 'fold': return 'give up the hand';
      case 'call': return 'match the bet';
      case 'raise': return `bet ${size} big blinds`;
      case '3bet': return `re-raise to ${size}bb`;
      case '4bet': return `re-raise again to ${size}bb`;
      case 'allin': return 'bet all your chips';
      default: return '';
    }
  }

  /** What is going on in a preflop spot, in plain words. */
  function spotStory(scn) {
    if (scn.group === 'rfi') {
      const blurb = {
        UTG: 'Five players still act after you, and any of them could wake up with a strong hand, so you only play good hands (about 1 in 6).',
        HJ: 'Four players are left behind you, so you can play a few more hands than under the gun (about 1 in 5).',
        CO: 'Only the button and the blinds are left, so you can open about 30% of hands.',
        BTN: 'Only the two blinds are left, and you will act last on every later betting round. That advantage lets you raise almost half your hands.',
        SB: 'Only the big blind is left, but you will act first on later betting rounds. This trainer uses a simple raise-or-fold plan here.',
      }[scn.hero];
      return `Everyone before you folded, so you can be the first to raise ("open") or fold. ${blurb}`;
    }
    if (scn.group === 'vsOpen') {
      const early = scn.villain === 'UTG' || scn.villain === 'HJ';
      const vil = early
        ? `A raise from ${scn.villain} (${POSITIONS[scn.villain].name.toLowerCase()}) usually means a strong hand, so you continue with fewer hands.`
        : `Players in ${scn.villain} raise with lots of hands, so you can fight back more often.`;
      const you = {
        BB: 'You already put 1bb in, so calling is cheap. The big blind continues with more hands than anyone.',
        SB: 'From the small blind you would have to act first for the rest of the hand, so the strategy mostly re-raises or folds instead of calling.',
      }[scn.hero] || 'You will act after the raiser for the rest of the hand ("in position"), which makes calling more attractive.';
      return `${scn.villain} raised. You can re-raise (a "3-bet"), call to see the flop, or fold. ${vil} ${you}`;
    }
    return `You raised and ${scn.villain} raised again (a "3-bet"). You can re-raise once more (a "4-bet"), call, or fold. Re-raises are strong, so folding a good share of your hands here is normal.`;
  }

  /** Which family a starting hand belongs to, and why that matters. */
  function handFamily(idx) {
    const r = Math.floor(idx / 13), c = idx % 13;
    const type = core.handType(idx);
    if (type === 'pair') {
      if (r <= 4) return { name: 'Big pair', why: 'Big pairs are some of the best starting hands. You usually want to put more chips in with them.' };
      if (r <= 8) return { name: 'Medium pair', why: 'Medium pairs start ahead of most hands but are scared of higher cards on the board. They often win by making three of a kind.' };
      return { name: 'Small pair', why: 'Small pairs mostly win by hitting three of a kind (about 1 time in 8 by the flop), so they want a cheap price or a chance to win a big pot.' };
    }
    const hi = Math.min(r, c), lo = Math.max(r, c); // grid ranks: 0 = ace, 12 = deuce
    const suited = type === 'suited';
    const gap = lo - hi;
    if (hi === 0 && lo <= 2) return { name: 'Big ace', why: 'Big aces make top pair with a strong kicker and beat the weaker aces your opponents play.' };
    if (hi === 0 && lo <= 4) return { name: 'Ace with a good kicker', why: 'These make top pair often, but can lose to a bigger ace, so they get weaker when someone has already raised.' };
    if (hi === 0) {
      return suited
        ? { name: 'Suited ace', why: 'A suited ace can make the best possible flush, and A5s to A2s can also make a straight. Holding an ace also makes it less likely your opponent has AA or AK.' }
        : { name: 'Weak offsuit ace', why: 'Weak aces make top pair with a bad kicker and often lose to better aces ("domination"). They are mainly played from late position.' };
    }
    if (lo <= 4) {
      return suited
        ? { name: 'Suited high cards', why: 'Two high cards make strong pairs and straights, and being suited adds flush chances. These play well in most spots.' }
        : { name: 'Offsuit high cards', why: 'Two high cards make good pairs, but without the flush potential they are easily dominated by stronger high cards.' };
    }
    if (suited && gap === 1) return { name: 'Suited connector', why: 'Suited connectors rarely make the best pair, but they make straights and flushes that can win big pots. They need good position or a cheap price.' };
    if (suited && gap === 2) return { name: 'Suited one-gapper', why: 'Like suited connectors but with fewer straight possibilities, so they are played a bit less often.' };
    if (suited && hi <= 2) return { name: 'Suited king or queen', why: 'Suited kings and queens have some flush value and a high card, which makes them playable from late position.' };
    if (!suited && gap === 1 && lo <= 9) return { name: 'Offsuit connector', why: 'Connected cards can make straights, but without a flush draw they lose a lot of value. Mostly a late-position hand.' };
    return { name: 'Weak hand', why: 'Low, unconnected cards rarely make a strong hand. These are the hands you fold most often.' };
  }

  /** Extra sentence after a mixed result. */
  const MIX_NOTE = 'When a hand is mixed, its options are worth about the same. Splitting between them keeps opponents from reading you.';

  const GLOSSARY = [
    ['bb (big blind)', 'Chip amounts are measured in big blinds. "100bb deep" means everyone starts with 100 times the big blind.'],
    ['Blinds', 'The two forced bets that start every hand: the small blind posts 0.5bb and the big blind posts 1bb.'],
    ['Open / open-raise', 'Being the first player to raise. Also called RFI, "raise first in".'],
    ['3-bet', 'A re-raise after someone has already raised (the blind counts as the first bet, the raise as the second).'],
    ['4-bet', 'A re-raise of a 3-bet.'],
    ['All-in / shove', 'Betting all your chips.'],
    ['Range', 'All the hands a player would play a certain way. GTO thinks in ranges, not single hands.'],
    ['Suited (s) / offsuit (o)', 'AKs means ace-king of the same suit, AKo means different suits. Pairs like 77 have no letter. T means 10.'],
    ['Combo', 'One exact two-card hand. AKs has 4 combos (one per suit), AKo has 12, and each pair has 6.'],
    ['In position / out of position', 'Being in position means you act after your opponent on later betting rounds, which is a big advantage.'],
    ['Equity', 'How often your hand would win if all the cards were dealt out with no more betting. Ties count as half.'],
    ['EV (expected value)', 'How much a play wins or loses on average, if you repeated it thousands of times.'],
    ['GTO (game theory optimal)', 'A strategy that cannot be beaten in the long run, even by an opponent who knows exactly what you do.'],
    ['Nash equilibrium', 'A pair of strategies where neither player can gain by changing theirs. It is the mathematical idea behind GTO.'],
    ['Mixed strategy', 'Playing the same hand in different ways a set share of the time, like raising 60% and folding 40%.'],
    ['Pot odds', 'The price you are getting: what you must pay compared with what you can win.'],
    ['MDF', 'Minimum defense frequency: how often you must keep playing against a bet so that bluffs cannot win automatically.'],
    ['Solver', 'Software that calculates GTO strategies by playing against itself billions of times.'],
  ];

  root.GTO.explain = { POSITIONS, actionHint, spotStory, handFamily, MIX_NOTE, GLOSSARY };
})(typeof window !== 'undefined' ? window : globalThis);
