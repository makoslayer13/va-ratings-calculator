// Run: node --test tests/
// Every expected value below comes from an official source, quoted in the test name.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { combinePair, combineRaw, toNearestTen, calculate, nextTier } from "../src/calc.js";
import { monthlyPayment, BASIC } from "../src/rates.js";

const tableI = JSON.parse(readFileSync(new URL("../data/cfr_4_25_table_i.json", import.meta.url)));

test("Formula matches EVERY cell of 38 CFR § 4.25 Table I (rows 19–94 × cols 10–90)", () => {
  let checked = 0;
  for (const [row, vals] of Object.entries(tableI)) {
    vals.forEach((expected, i) => {
      const col = (i + 1) * 10;
      assert.equal(combinePair(Number(row), col), expected, `row ${row}, col ${col}`);
      checked++;
    });
  }
  assert.equal(checked, 76 * 9);
});

test("§ 4.25 Table I caption: 10 combined with 10 is 19", () => {
  assert.equal(combinePair(10, 10), 19);
});

test("§ 4.25 intro: 60% and 30% → 72%", () => {
  assert.equal(combinePair(60, 30), 72);
});

test("§ 4.25(a): 50% and 30% → 65 → converted to 70", () => {
  assert.equal(combinePair(50, 30), 65);
  assert.equal(calculate([{ rating: 50 }, { rating: 30 }]).final, 70);
});

test("§ 4.25(a): 40% and 20% → 52 → converted to 50", () => {
  assert.equal(combinePair(40, 20), 52);
  assert.equal(calculate([{ rating: 40 }, { rating: 20 }]).final, 50);
});

test("§ 4.25(a): 60, 40, 20 → 76 → 81 → converted to 80", () => {
  const r = combineRaw([20, 60, 40]);
  assert.deepEqual(r.steps.map((s) => s.result), [76, 81]);
  assert.equal(calculate([{ rating: 20 }, { rating: 60 }, { rating: 40 }]).final, 80);
});

test("§ 4.25(b): rounding to nearest 10, 5s adjusted upward", () => {
  assert.equal(toNearestTen(65), 70);
  assert.equal(toNearestTen(64), 60);
  assert.equal(toNearestTen(95), 100);
  assert.equal(toNearestTen(94), 90);
});

test("§ 4.26 example: 60, 20, 10, 10 (10s bilateral) → order 60, 21, 20 → 68 → 74 → 70", () => {
  const r = calculate([
    { rating: 60 },
    { rating: 20 },
    { rating: 10, side: "left-leg" },
    { rating: 10, side: "right-leg" },
  ]);
  assert.equal(r.bilateral.value, 21);
  assert.deepEqual(r.order, [60, 21, 20]);
  assert.deepEqual(r.steps.map((s) => s.result), [68, 74]);
  assert.equal(r.combined, 74);
  assert.equal(r.final, 70);
});

test("§ 4.26(c): no bilateral factor when only one side of a pair is rated", () => {
  const r = calculate([{ rating: 30, side: "left-arm" }, { rating: 20, side: "left-leg" }]);
  assert.equal(r.bilateral, null);
});

test("§ 4.26(d): result is never lower than leaving bilateral ratings out", () => {
  for (const set of [
    [{ rating: 10, side: "left-arm" }, { rating: 10, side: "right-arm" }, { rating: 50 }],
    [{ rating: 40, side: "left-leg" }, { rating: 10, side: "right-leg" }, { rating: 70 }],
  ]) {
    const plain = calculate(set.map((d) => ({ rating: d.rating })));
    assert.ok(calculate(set).final >= plain.final);
  }
});

test("Next tier: 50% → 60% starts at combined 55; one more 10% gets there (50 & 10 = 55)", () => {
  const n = nextTier([{ rating: 50 }]);
  assert.equal(n.nextRating, 60);
  assert.equal(n.roundsUpAt, 55);
  assert.equal(n.pointsNeeded, 5);
  assert.equal(n.additionalRatingNeeded, 10);
});

test("Next tier: 60 + 30 = 72 (VA 70%) → 80% needs 3 more points; +10% gives 75 → 80%", () => {
  const n = nextTier([{ rating: 60 }, { rating: 30 }]);
  assert.equal(n.current.combined, 72);
  assert.equal(n.pointsNeeded, 3);
  assert.equal(n.additionalRatingNeeded, 10);
  assert.equal(n.trial.combined, 75);
});

test("Next tier: 90% needs an additional 50% to reach 100% (90 & 50 = 95 per Table I)", () => {
  assert.equal(combinePair(90, 50), 95);
  const n = nextTier([{ rating: 90 }]);
  assert.equal(n.additionalRatingNeeded, 50);
});

test("Next tier: none above 100%", () => {
  assert.equal(nextTier([{ rating: 100 }]).nextRating, null);
});

test("VA.gov example: 30%, spouse, no children/parents → $617.47", () => {
  assert.equal(monthlyPayment(30, { spouse: true }).total, 617.47);
});

test("VA.gov example: 70%, spouse + 3 children under 18 + spouse A&A → $2,367.45", () => {
  const p = monthlyPayment(70, { spouse: true, spouseAA: true, childrenUnder18: 3 });
  assert.equal(p.total, 2367.45);
});

test("VA.gov: 10% and 20% are flat regardless of dependents", () => {
  assert.equal(monthlyPayment(10, { spouse: true, childrenUnder18: 2 }).total, 180.42);
  assert.equal(monthlyPayment(20, { spouse: true, parents: 2 }).total, 356.66);
});

test("Rates file matches the VA.gov snapshot in data/va_rates_snapshot.json", () => {
  const snap = JSON.parse(readFileSync(new URL("../data/va_rates_snapshot.json", import.meta.url)));
  for (const [key, vals] of Object.entries(snap.basic)) {
    for (const [r, v] of Object.entries(vals)) assert.equal(BASIC[key][r], v, `${key} ${r}%`);
  }
});
