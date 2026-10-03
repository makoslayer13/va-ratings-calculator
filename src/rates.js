// 2026 VA disability compensation rates — EFFECTIVE DECEMBER 1, 2025.
// Source (official): https://www.va.gov/disability/compensation-rates/veteran-rates/
// Fetched and transcribed 2026-10-03; VA.gov page "Last updated: December 2, 2025".
// Every value below is copied verbatim from that page. Re-verify each year
// (rates change every December with the Social Security COLA).

export const RATES_META = {
  effective: "2025-12-01",
  sourceUrl: "https://www.va.gov/disability/compensation-rates/veteran-rates/",
  sourcePageUpdated: "2025-12-02",
  transcribed: "2026-10-03",
};

// 10% and 20%: flat, no added amount for any dependent (VA.gov note).
export const FLAT = { 10: 180.42, 20: 356.66 };

// Basic monthly rates, 30%–100%. Keys: [no child status] and [with 1 child status].
// Column order: 30, 40, 50, 60, 70, 80, 90, 100
const R = [30, 40, 50, 60, 70, 80, 90, 100];
const row = (vals) => Object.fromEntries(R.map((r, i) => [r, vals[i]]));

export const BASIC = {
  // No children
  alone:                row([552.47, 795.84, 1132.90, 1435.02, 1808.45, 2102.15, 2362.30, 3938.58]),
  spouse:               row([617.47, 882.84, 1241.90, 1566.02, 1961.45, 2277.15, 2559.30, 4158.17]),
  spouse_1parent:       row([669.47, 952.84, 1329.90, 1671.02, 2084.45, 2417.15, 2717.30, 4334.41]),
  spouse_2parents:      row([721.47, 1022.84, 1417.90, 1776.02, 2207.45, 2557.15, 2875.30, 4510.65]),
  parent1:              row([604.47, 865.84, 1220.90, 1540.02, 1931.45, 2242.15, 2520.30, 4114.82]),
  parent2:              row([656.47, 935.84, 1308.90, 1645.02, 2054.45, 2382.15, 2678.30, 4291.06]),
  // With 1 child
  child:                row([596.47, 853.84, 1205.90, 1523.02, 1910.45, 2219.15, 2494.30, 4085.43]),
  child_spouse:         row([666.47, 947.84, 1322.90, 1663.02, 2074.45, 2406.15, 2704.30, 4318.99]),
  child_spouse_1parent: row([718.47, 1017.84, 1410.90, 1768.02, 2197.45, 2546.15, 2862.30, 4495.23]),
  child_spouse_2parents:row([770.47, 1087.84, 1498.90, 1873.02, 2320.45, 2686.15, 3020.30, 4671.47]),
  child_1parent:        row([648.47, 923.84, 1293.90, 1628.02, 2033.45, 2359.15, 2652.30, 4261.67]),
  child_2parents:       row([700.47, 993.84, 1381.90, 1733.02, 2156.45, 2499.15, 2810.30, 4437.91]),
};

// Added amounts table.
export const ADDED = {
  child_under18:   row([32.00, 43.00, 54.00, 65.00, 76.00, 87.00, 98.00, 109.11]),
  child_school:    row([105.00, 140.00, 176.00, 211.00, 246.00, 281.00, 317.00, 352.45]),
  spouse_aa:       row([61.00, 81.00, 101.00, 121.00, 141.00, 161.00, 181.00, 201.41]),
};

function statusKey({ spouse, parents, hasChild }) {
  const p = parents === 2 ? "2parents" : parents === 1 ? "1parent" : "";
  if (hasChild) {
    if (spouse) return p ? `child_spouse_${p}` : "child_spouse";
    return p ? `child_${p}` : "child";
  }
  if (spouse) return p ? `spouse_${p}` : "spouse";
  return p === "1parent" ? "parent1" : p === "2parents" ? "parent2" : "alone";
}

/**
 * Monthly payment per the VA.gov "How to use the tables" method:
 * basic rate (covers 1 child if any) + each additional child + spouse A&A.
 * deps: { spouse: bool, spouseAA: bool, parents: 0|1|2, childrenUnder18: int, childrenSchool: int }
 */
export function monthlyPayment(rating, deps) {
  const lines = [];
  const warnings = [];
  if (rating === 0) return { total: 0, lines, warnings: ["A 0% rating has no monthly payment."] };
  if (rating === 10 || rating === 20) {
    lines.push({ label: `Basic rate, ${rating}% (dependents don't change 10%–20%)`, amount: FLAT[rating] });
    return { total: FLAT[rating], lines, warnings };
  }
  const under18 = Math.max(0, deps.childrenUnder18 | 0);
  const school = Math.max(0, deps.childrenSchool | 0);
  const kids = under18 + school;
  const key = statusKey({ spouse: !!deps.spouse, parents: deps.parents | 0, hasChild: kids > 0 });
  const basic = BASIC[key][rating];
  const LABELS = {
    alone: "veteran alone", spouse: "with spouse", spouse_1parent: "with spouse and 1 parent",
    spouse_2parents: "with spouse and 2 parents", parent1: "with 1 parent", parent2: "with 2 parents",
    child: "with 1 child", child_spouse: "with spouse and 1 child", child_spouse_1parent: "with spouse, 1 child, and 1 parent",
    child_spouse_2parents: "with spouse, 1 child, and 2 parents", child_1parent: "with 1 child and 1 parent", child_2parents: "with 1 child and 2 parents",
  };
  lines.push({ label: `Basic rate, ${rating}%, ${LABELS[key]}`, amount: basic });

  // The basic "with 1 child" rate covers the first child. VA.gov's worked example
  // uses an under-18 child for that slot; we fill it with an under-18 child when one exists.
  let addU18 = kids > 0 ? (under18 > 0 ? under18 - 1 : 0) : 0;
  let addSchool = kids > 0 ? (under18 > 0 ? school : school - 1) : 0;
  if (kids > 0 && under18 === 0) {
    warnings.push(
      "All your children are 18+ in school. VA.gov's tables don't spell out how the first school-age child is paid, so this treats them as the child in the basic rate. Confirm the amount with VA."
    );
  }
  if (addU18 > 0) lines.push({ label: `${addU18} additional child(ren) under 18 × $${ADDED.child_under18[rating].toFixed(2)}`, amount: addU18 * ADDED.child_under18[rating] });
  if (addSchool > 0) lines.push({ label: `${addSchool} additional child(ren) 18+ in school × $${ADDED.child_school[rating].toFixed(2)}`, amount: addSchool * ADDED.child_school[rating] });
  if (deps.spouse && deps.spouseAA) lines.push({ label: "Spouse receiving Aid and Attendance", amount: ADDED.spouse_aa[rating] });

  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { total, lines, warnings };
}
