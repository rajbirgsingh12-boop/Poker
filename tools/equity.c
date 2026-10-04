/*
 * Preflop hand-class equity table generator.
 *
 * Computes the all-in equity of every one of the 169 starting-hand classes
 * against every other class (heads-up, no folding), averaged over all
 * non-conflicting combo pairs. Uses Monte Carlo sampling of the board.
 *
 * Output: 169 lines of 169 space-separated equities (row hand vs column hand),
 * in grid order: index = row*13 + col, ranks ordered A,K,Q,...,2.
 * row == col -> pair, row < col -> suited, row > col -> offsuit.
 *
 * Build:  gcc -O3 -march=native -fopenmp -o equity tools/equity.c
 * Run:    ./equity [samples_per_matchup] > equity.txt
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define NCLASS 169

/* Card = rank*4 + suit, rank 0 = deuce ... 12 = ace. */
static inline uint64_t card_bit(int c) { return 1ULL << ((c & 3) * 16 + (c >> 2)); }

static inline int popc(uint32_t x) { return __builtin_popcount(x); }
static inline int top_bit(uint32_t x) { return 31 - __builtin_clz(x); }

static inline uint32_t keep_top(uint32_t m, int n) {
    while (popc(m) > n) m &= m - 1;
    return m;
}

/* Returns high-card rank of the best straight in a 13-bit rank mask, or -1. */
static inline int straight_high(uint32_t r) {
    uint32_t r5 = (r << 1) | ((r >> 12) & 1); /* bit 0 = ace-low */
    uint32_t s = r5 & (r5 << 1) & (r5 << 2) & (r5 << 3) & (r5 << 4);
    if (!s) return -1;
    return top_bit(s) - 1;
}

#define MK(cat, major, minor) (((uint32_t)(cat) << 26) | ((uint32_t)(major) << 13) | (uint32_t)(minor))

/* Evaluate a 7-card hand given as a 64-bit mask (16 bits per suit). Higher is better. */
static uint32_t eval7(uint64_t m) {
    uint32_t s0 = m & 0x1FFF, s1 = (m >> 16) & 0x1FFF, s2 = (m >> 32) & 0x1FFF, s3 = (m >> 48) & 0x1FFF;
    uint32_t fl = 0;
    if (popc(s0) >= 5) fl = s0;
    else if (popc(s1) >= 5) fl = s1;
    else if (popc(s2) >= 5) fl = s2;
    else if (popc(s3) >= 5) fl = s3;
    if (fl) {
        int sh = straight_high(fl);
        if (sh >= 0) return MK(8, 1u << sh, 0);
    }
    uint32_t one = 0, two = 0, three = 0;
    three |= two & s0; two |= one & s0; one |= s0;
    three |= two & s1; two |= one & s1; one |= s1;
    three |= two & s2; two |= one & s2; one |= s2;
    three |= two & s3; two |= one & s3; one |= s3;
    uint32_t four = s0 & s1 & s2 & s3;
    uint32_t ranks = one;
    if (four) {
        uint32_t q = 1u << top_bit(four);
        return MK(7, q, keep_top(ranks & ~q, 1));
    }
    if (three) {
        uint32_t t = 1u << top_bit(three);
        uint32_t rest = two & ~t; /* other trips or pairs */
        if (rest) return MK(6, t, 1u << top_bit(rest));
    }
    if (fl) return MK(5, keep_top(fl, 5), 0);
    int sh = straight_high(ranks);
    if (sh >= 0) return MK(4, 1u << sh, 0);
    if (three) {
        uint32_t t = 1u << top_bit(three);
        return MK(3, t, keep_top(ranks & ~t, 2));
    }
    if (two) {
        if (popc(two) >= 2) {
            uint32_t p = keep_top(two, 2);
            return MK(2, p, keep_top(ranks & ~p, 1));
        }
        return MK(1, two, keep_top(ranks & ~two, 3));
    }
    return MK(0, keep_top(ranks, 5), 0);
}

/* ---- hand classes ---- */
typedef struct { int n; int c[12][2]; } ClassCombos;
static ClassCombos classes[NCLASS];

static void build_classes(void) {
    for (int r = 0; r < 13; r++) {
        for (int col = 0; col < 13; col++) {
            ClassCombos *cc = &classes[r * 13 + col];
            int ra = 12 - r, rb = 12 - col; /* evaluator ranks */
            cc->n = 0;
            if (r == col) {
                for (int s1 = 0; s1 < 4; s1++)
                    for (int s2 = s1 + 1; s2 < 4; s2++) {
                        cc->c[cc->n][0] = ra * 4 + s1;
                        cc->c[cc->n][1] = ra * 4 + s2;
                        cc->n++;
                    }
            } else if (r < col) { /* suited */
                for (int s = 0; s < 4; s++) {
                    cc->c[cc->n][0] = ra * 4 + s;
                    cc->c[cc->n][1] = rb * 4 + s;
                    cc->n++;
                }
            } else { /* offsuit: row is the lower rank, col the higher */
                for (int s1 = 0; s1 < 4; s1++)
                    for (int s2 = 0; s2 < 4; s2++) {
                        if (s1 == s2) continue;
                        cc->c[cc->n][0] = rb * 4 + s1;
                        cc->c[cc->n][1] = ra * 4 + s2;
                        cc->n++;
                    }
            }
        }
    }
}

/* ---- RNG (xoshiro256**) ---- */
typedef struct { uint64_t s[4]; } Rng;
static inline uint64_t rotl(uint64_t x, int k) { return (x << k) | (x >> (64 - k)); }
static inline uint64_t rng_next(Rng *r) {
    uint64_t *s = r->s;
    uint64_t res = rotl(s[1] * 5, 7) * 9, t = s[1] << 17;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 45);
    return res;
}
static inline uint32_t rng_below(Rng *r, uint32_t n) { return (uint32_t)(((rng_next(r) >> 32) * (uint64_t)n) >> 32); }
static void rng_seed(Rng *r, uint64_t seed) {
    for (int i = 0; i < 4; i++) { /* splitmix64 */
        seed += 0x9E3779B97F4A7C15ULL;
        uint64_t z = seed;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
        r->s[i] = z ^ (z >> 31);
    }
}

/*
 * Equity of class a vs class b. By suit symmetry, averaging over all valid
 * combo pairs equals fixing hero's combo and averaging over villain combos
 * that don't share a card, so we fix hero = first combo of class a.
 */
static double matchup(int a, int b, long samples, uint64_t seed) {
    Rng rng; rng_seed(&rng, seed);
    const ClassCombos *A = &classes[a], *B = &classes[b];
    int h0 = A->c[0][0], h1 = A->c[0][1];
    int vill[12][2], nv = 0;
    for (int i = 0; i < B->n; i++) {
        int v0 = B->c[i][0], v1 = B->c[i][1];
        if (v0 == h0 || v0 == h1 || v1 == h0 || v1 == h1) continue;
        vill[nv][0] = v0; vill[nv][1] = v1; nv++;
    }
    if (nv == 0) return -1.0;
    uint64_t hero_mask = card_bit(h0) | card_bit(h1);
    double total = 0.0;
    long per = samples / nv; /* stratify evenly across villain combos */
    if (per < 1) per = 1;
    for (int v = 0; v < nv; v++) {
        int deck[52], nd = 0;
        for (int c = 0; c < 52; c++)
            if (c != h0 && c != h1 && c != vill[v][0] && c != vill[v][1]) deck[nd++] = c;
        uint64_t vill_mask = card_bit(vill[v][0]) | card_bit(vill[v][1]);
        long wins2 = 0; /* 2 per win, 1 per tie */
        for (long s = 0; s < per; s++) {
            uint64_t board = 0;
            for (int k = 0; k < 5; k++) {
                int j = k + (int)rng_below(&rng, (uint32_t)(nd - k));
                int t = deck[k]; deck[k] = deck[j]; deck[j] = t;
                board |= card_bit(deck[k]);
            }
            uint32_t eh = eval7(board | hero_mask), ev = eval7(board | vill_mask);
            wins2 += (eh > ev) ? 2 : (eh == ev) ? 1 : 0;
        }
        total += (double)wins2 / (2.0 * per);
    }
    return total / nv;
}

/* ---- self-test of the evaluator on known orderings ---- */
static int cardp(const char *s) {
    const char *R = "23456789TJQKA", *S = "shdc";
    int r = 0, su = 0;
    while (R[r] != s[0]) r++;
    while (S[su] != s[1]) su++;
    return r * 4 + su;
}
static uint32_t ev_str(const char *s) {
    uint64_t m = 0;
    for (int i = 0; i < 7; i++) m |= card_bit(cardp(s + i * 3));
    return eval7(m);
}
static int self_test(void) {
    const char *ordered[] = {
        "2s 3h 4d 5c 7s 8h 9d", /* high card */
        "2s 2h 4d 5c 7s 8h 9d", /* pair */
        "2s 2h 4d 4c 7s 8h 9d", /* two pair */
        "2s 2h 2d 5c 7s 8h 9d", /* trips */
        "As 2h 3d 4c 5s 8h 9d", /* wheel */
        "2s 3h 4d 5c 6s 8h 9d", /* six-high straight */
        "2s 4s 6s 8s Ts Jh Qd", /* flush */
        "2s 2h 2d 5c 5s 8h 9d", /* full house */
        "2s 2h 2d 2c 5s 8h 9d", /* quads */
        "As 2s 3s 4s 5s 8h 9d", /* steel wheel */
        "Ts Js Qs Ks As 8h 9d", /* royal */
    };
    int n = sizeof(ordered) / sizeof(ordered[0]);
    for (int i = 1; i < n; i++) {
        if (!(ev_str(ordered[i]) > ev_str(ordered[i - 1]))) {
            fprintf(stderr, "self-test failed: '%s' should beat '%s'\n", ordered[i], ordered[i - 1]);
            return 0;
        }
    }
    /* kicker and tie checks */
    if (!(ev_str("As Ah Kd 5c 7s 8h 9d") > ev_str("As Ah Qd 5c 7s 8h 9d"))) return 0;
    if (ev_str("As Ah Kd Qc Js 3h 2d") != ev_str("Ac Ad Kh Qs Jd 4h 2c")) return 0; /* 5th kicker irrelevant beyond J */
    if (!(ev_str("Ks Kh Qd Qc 2s 2h Ad") > ev_str("Ks Kh Qd Qc 3s 3h 2d"))) return 0; /* two pair kicker */
    if (!(ev_str("Ks Kh Kd Ac Ad 2h 2d") > ev_str("Ks Kh Kd Qc Qs Jh Jd"))) return 0; /* KKKAA > KKKQQ */
    if (!(ev_str("2s 2h 2d 3c 3s 3h Ad") > ev_str("2s 2h 2d Ac As Kh Qd"))) return 0; /* 33322 > 222AA */
    return 1;
}

int main(int argc, char **argv) {
    long samples = argc > 1 ? atol(argv[1]) : 400000;
    if (!self_test()) { fprintf(stderr, "evaluator self-test FAILED\n"); return 1; }
    build_classes();
    static double eq[NCLASS][NCLASS];
    int pairs[NCLASS * NCLASS][2], np = 0;
    for (int a = 0; a < NCLASS; a++) {
        eq[a][a] = 0.5; /* swapping players is a symmetry of the deal */
        for (int b = a + 1; b < NCLASS; b++) { pairs[np][0] = a; pairs[np][1] = b; np++; }
    }
    int done = 0;
    #pragma omp parallel for schedule(dynamic, 8)
    for (int k = 0; k < np; k++) {
        int a = pairs[k][0], b = pairs[k][1];
        double e = matchup(a, b, samples, 0xC0FFEEULL * (uint64_t)(k + 1));
        eq[a][b] = e;
        eq[b][a] = 1.0 - e;
        #pragma omp atomic
        done++;
        if (done % 1000 == 0) {
            #pragma omp critical
            fprintf(stderr, "%d / %d matchups\n", done, np);
        }
    }
    for (int a = 0; a < NCLASS; a++) {
        for (int b = 0; b < NCLASS; b++) printf(b ? " %.5f" : "%.5f", eq[a][b]);
        printf("\n");
    }
    return 0;
}
