# GTO Poker Trainer

A browser-based trainer for game theory optimal (GTO) No-Limit Hold'em. It's built for newer players: the **Learn** tab explains the basics, and every drill tells you what's happening and why a hand is played the way it is.

## Run it

Open `index.html` in any modern browser. There's nothing to install and no server to run.

To get a single file you can copy anywhere or use offline, run `npm run build` and open `dist/gto-trainer.html`.

## What's inside

| Tab | What you practise | Where the answers come from |
| --- | --- | --- |
| **Learn** | Blinds, seats, hand notation (AKs / AKo / 77), reading the 13×13 hand chart, a glossary and a step-by-step learning path | – |
| **Preflop** | 6-player cash game, 100bb deep, 34 spots: open-raise, limpers, facing a raise, raise-and-call squeezes, 3-bets and 4-bets. Three strategy styles (pure GTO, exploitative vs typical players, and a middle blend), a side-by-side comparison with the reason they differ, and a deeper analysis of equity, pot odds and opponent ranges after every hand | GTO: simplified versions of rake-free solver results (approximate). Exploitative: rule-based adjustments documented in `js/strategy.js` |
| **Push/Fold** | Heads-up short stacks (2–20bb): small blind all-in or fold, big blind call or fold. Shows the EV of every decision | **Computed exactly** by this project's Nash solver |
| **Equity** | Estimate how often one hand beats another, all-in before the flop | **Computed** 169×169 equity table |
| **GTO Math** | Pot odds, minimum defense frequency, bluff break-even, river bluff share | Exact formulas |
| **Ranges** | Browse every chart, including a classic Nash push/fold chart view | – |
| **Stats** | Accuracy per spot and your most-missed hands, saved in your browser | – |

Keyboard shortcuts: **F** fold, **C** call, **R** raise / re-raise, **A** all-in, **1–4** pick an option, **Space** next hand. In the equity drill use the arrow keys (hold Shift for steps of 5) and **Enter**.

## How the GTO numbers are produced

- **Equity table** (`tools/equity.c`): a 7-card hand evaluator plus Monte Carlo simulation, 1,000,000 boards for each of the 14,196 hand-class matchups (standard error under 0.05%). Spot checks against standard equity calculators: AA vs KK 81.9%, QQ vs AKo 56.8%, 22 vs AKo 52.7%.
- **Push/fold equilibrium** (`js/solver.js`, `tools/solve-pushfold.mjs`): CFR+ over all 169 hand classes, with exact card-removal weights, for stacks from 1bb to 25bb in half-big-blind steps. Every solution has exploitability below 1e-6 bb per hand. At 10bb the small blind shoves 58.3% of hands and the big blind calls 37.4%, which matches published Nash charts.
- **6-max preflop charts** (`js/data/preflop.js`): hand-built approximations of solver output for 2.5bb opens (3bb from the small blind). The tests check they stay coherent: no hand's frequencies add up to more than 100%, opening ranges widen by position, and 3-bet defence only uses hands from the opening range.

## Development

```sh
npm test                     # data, solver, grading and explanation tests (node:test, no dependencies)
npm run build                # dist/gto-trainer.html
npm run solve                # re-solve push/fold into js/data/pushfold.js (about a minute)

# regenerate the equity table (a few minutes on 4 cores)
gcc -O3 -march=native -fopenmp -o equity tools/equity.c
./equity 1000000 > equity.txt
node tools/build-equity.mjs equity.txt
```

The app is plain HTML, CSS and JavaScript with no dependencies or build step. Scripts attach to a global `GTO` namespace, so the same files run in the browser and in the Node tests.

```
index.html            app shell
css/styles.css        all styling, light and dark themes
js/core.js            hand classes, combos, range notation parser
js/strategy.js        per-hand strategies, dealing, grading rules
js/solver.js          push/fold CFR+ solver
js/explain.js         plain-English explanations for beginners
js/ui.js, store.js    DOM helpers, cards, range grid, table; saved history
js/modes/*.js         one file per tab
js/data/*.js          preflop charts, equity table, push/fold solutions
tools/                generators and the single-file bundler
tests/                node:test suites
```
