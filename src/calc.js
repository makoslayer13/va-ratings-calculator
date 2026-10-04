// VA Disability Ratings Calculator — core math.
// Every rule here is sourced; see SOURCES.md and data/sources.json.
//
// 38 CFR § 4.25 (Combined ratings table):
//   https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A/section-4.25
// 38 CFR § 4.26 (Bilateral factor):
//   https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A/section-4.26

/** Round half up (Table I values are whole numbers; "combined values ending in 5 will be adjusted upward"). */
function roundHalfUp(x) {
  return Math.floor(x + 0.5 + 1e-9);
}

/**
 * Combine two values per § 4.25: efficiency left after A is (100 - A);
 * B removes B% of that. Equivalent to Table I. Result is a whole number,
 * matching the Table I cell (verified against every cell of Table I — see tests).
 */
export function combinePair(a, b) {
  return roundHalfUp(a + b - (a * b) / 100);
}

/** Combine a list of values in order of severity (§ 4.25(a)), no final rounding. */
export function combineRaw(values) {
  const sorted = values.filter((v) => v > 0).sort((x, y) => y - x);
  if (sorted.length === 0) return 0;
  let acc = sorted[0];
  const steps = [];
  for (let i = 1; i < sorted.length; i++) {
    const next = combinePair(acc, sorted[i]);
    steps.push({ a: acc, b: sorted[i], result: next });
    acc = next;
  }
  return { value: acc, steps, order: sorted };
}

/** § 4.25(a)/(b): convert to nearest degree divisible by 10, 5s round up; done once, last. */
export function toNearestTen(v) {
  return Math.floor((v + 5) / 10) * 10;
}

const ARMS = new Set(["left-arm", "right-arm"]);
const LEGS = new Set(["left-leg", "right-leg"]);

/**
 * Bilateral factor (§ 4.26).
 * A rating is eligible when it is compensable (> 0) and on an extremity.
 * Applies only if both arms, or both legs, have a compensable rating (§ 4.26(c)).
 * Paired skeletal muscles are not modeled — flagged in the UI.
 * Eligible extremity ratings are combined, then 10% of that value is ADDED
 * (not combined), and the result is treated as one disability (§ 4.26, (b)).
 */
function bilateralGroupValue(group) {
  const c = combineRaw(group.map((d) => d.rating));
  const raw = c.value;
  const factor = raw * 0.1;
  return { combined: raw, factor, value: roundHalfUp(raw + factor), steps: c.steps };
}

function bilateralApplies(group) {
  const sides = new Set(group.map((d) => d.side));
  const arms = sides.has("left-arm") && sides.has("right-arm");
  const legs = sides.has("left-leg") && sides.has("right-leg");
  return arms || legs;
}

function evaluateWithGroup(disabilities, groupIdx) {
  const group = groupIdx.map((i) => disabilities[i]);
  const others = disabilities.filter((_, i) => !groupIdx.includes(i)).map((d) => d.rating);
  let bilateral = null;
  let values = others.slice();
  if (group.length > 0 && bilateralApplies(group)) {
    bilateral = bilateralGroupValue(group);
    values.push(bilateral.value);
  } else {
    values = values.concat(group.map((d) => d.rating));
  }
  const c = combineRaw(values);
  const combinedValue = typeof c === "number" ? c : c.value;
  return {
    bilateral,
    bilateralMembers: bilateral ? groupIdx : [],
    combined: combinedValue,
    steps: c.steps || [],
    order: c.order || [],
    final: toNearestTen(combinedValue),
  };
}

/**
 * Main entry point.
 * disabilities: [{ rating: number (0-100, multiple of 10 typical), side: "none"|"left-arm"|"right-arm"|"left-leg"|"right-leg" }]
 *
 * § 4.26(d): if leaving one or more bilateral disabilities out of the bilateral
 * calculation gives a higher result, they are removed "to achieve the combined
 * evaluation most favorable to the veteran." We evaluate every subset of
 * extremity ratings and keep the highest final result.
 */
export function calculate(disabilities) {
  const clean = disabilities
    .filter((d) => Number.isFinite(d.rating) && d.rating > 0 && d.rating <= 100)
    .map((d) => ({ rating: d.rating, side: d.side || "none" }));

  const extremityIdx = clean
    .map((d, i) => (ARMS.has(d.side) || LEGS.has(d.side) ? i : -1))
    .filter((i) => i >= 0);

  let best = evaluateWithGroup(clean, []);
  const n = extremityIdx.length;
  if (n >= 2 && n <= 16) {
    for (let mask = 1; mask < 1 << n; mask++) {
      const idx = extremityIdx.filter((_, k) => mask & (1 << k));
      if (idx.length < 2) continue;
      const r = evaluateWithGroup(clean, idx);
      if (r.final > best.final || (r.final === best.final && r.combined > best.combined)) best = r;
    }
  }
  // Default (no exception needed): prefer using ALL extremity ratings when it ties the best result.
  if (n >= 2) {
    const all = evaluateWithGroup(clean, extremityIdx);
    if (all.final === best.final && all.combined === best.combined) best = all;
  }
  return { ...best, inputs: clean };
}

/**
 * Next tier: smallest single additional rating (10–100) that moves the final
 * VA rating up one 10% step. Uses the same official math as calculate().
 * Also reports how close the current combined value is to rounding up
 * (§ 4.25: a combined value ending in 5 rounds up, so tier T+10 starts at T+5).
 */
export function nextTier(disabilities) {
  const current = calculate(disabilities);
  if (current.final >= 100) return { current, nextRating: null };
  const target = current.final + 10;
  const roundsUpAt = target - 5;
  for (let r = 10; r <= 100; r += 10) {
    const trial = calculate([...disabilities, { rating: r, side: "none" }]);
    if (trial.final >= target) {
      return { current, nextRating: target, roundsUpAt, pointsNeeded: roundsUpAt - current.combined, additionalRatingNeeded: r, trial };
    }
  }
  return { current, nextRating: target, roundsUpAt, pointsNeeded: roundsUpAt - current.combined, additionalRatingNeeded: null };
}
