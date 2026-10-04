import { nextTier } from "./calc.js";
import { monthlyPayment, RATES_META } from "./rates.js";

const SIDES = [
  ["none", "Not an arm/leg"],
  ["left-arm", "Left arm"],
  ["right-arm", "Right arm"],
  ["left-leg", "Left leg"],
  ["right-leg", "Right leg"],
];
const RATINGS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const list = document.getElementById("ratings");
const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function addRow(rating = 10, side = "none") {
  const div = document.createElement("div");
  div.className = "row";
  div.innerHTML = `
    <label>Rating
      <select class="r">${RATINGS.map((r) => `<option value="${r}" ${r === rating ? "selected" : ""}>${r}%</option>`).join("")}</select>
    </label>
    <label>Body part
      <select class="s">${SIDES.map(([v, t]) => `<option value="${v}" ${v === side ? "selected" : ""}>${t}</option>`).join("")}</select>
    </label>
    <button type="button" class="remove" aria-label="Remove this rating">Remove</button>`;
  div.querySelector(".remove").addEventListener("click", () => { div.remove(); render(); });
  div.querySelectorAll("select").forEach((el) => el.addEventListener("change", render));
  list.appendChild(div);
  render();
}

function readInputs() {
  const disabilities = [...list.querySelectorAll(".row")].map((row) => ({
    rating: Number(row.querySelector(".r").value),
    side: row.querySelector(".s").value,
  }));
  const deps = {
    spouse: $("spouse").checked,
    spouseAA: $("spouse").checked && $("spouseAA").checked,
    childrenUnder18: Math.max(0, parseInt($("u18").value, 10) || 0),
    childrenSchool: Math.max(0, parseInt($("school").value, 10) || 0),
    parents: Number($("parents").value),
  };
  return { disabilities, deps };
}

function depsLabel(rating, deps) {
  if (rating < 30) return "Dependents don't change pay below 30%";
  const parts = [];
  if (deps.spouse) parts.push(deps.spouseAA ? "spouse (Aid & Attendance)" : "spouse");
  const kids = deps.childrenUnder18 + deps.childrenSchool;
  if (kids) parts.push(`${kids} child${kids > 1 ? "ren" : ""}`);
  if (deps.parents) parts.push(`${deps.parents} parent${deps.parents > 1 ? "s" : ""}`);
  return parts.length ? "With " + parts.join(", ") : "Veteran alone";
}

function render() {
  $("spouseAA").disabled = !$("spouse").checked;
  if (!$("spouse").checked) $("spouseAA").checked = false;
  const { disabilities, deps } = readInputs();
  const out = $("result");
  if (disabilities.filter((d) => d.rating > 0).length === 0) {
    out.innerHTML = `<p class="hint">Add at least one rating above 0%.</p>`;
    return;
  }
  const tier = nextTier(disabilities);
  const r = tier.current;
  const pay = monthlyPayment(r.final, deps);

  const steps = [];
  if (r.bilateral) {
    steps.push(`Bilateral ratings combine to <b>${r.bilateral.combined}</b>. Add 10% (${r.bilateral.factor.toFixed(1)}) and round: <b>${r.bilateral.value}</b>, treated as one rating (§ 4.26).`);
  }
  steps.push(`Order of severity: <b>${r.order.join(", ")}</b>.`);
  r.steps.forEach((s) => steps.push(`${s.a} combined with ${s.b} = <b>${s.result}</b> (§ 4.25 Table I).`));
  steps.push(`Combined value <b>${r.combined}</b>, rounded to the nearest 10: <b>${r.final}%</b>.`);

  let tierHtml;
  if (tier.nextRating === null) {
    tierHtml = `<p>You're at the top of the schedule (100%).</p>`;
  } else {
    const nextPay = monthlyPayment(tier.nextRating, deps).total;
    const need = tier.additionalRatingNeeded
      ? `Under the § 4.25 math, one more rated condition at <b>${tier.additionalRatingNeeded}%</b> would bring your combined value to <b>${tier.trial.combined}</b>, which rounds to <b>${tier.nextRating}%</b>.`
      : `No single additional rating reaches ${tier.nextRating}% from here.`;
    tierHtml = `
      <p>Your combined value is <b>${r.combined}</b>. ${tier.nextRating}% starts at a combined value of <b>${tier.roundsUpAt}</b>, which is <b>${tier.pointsNeeded} point${tier.pointsNeeded === 1 ? "" : "s"}</b> away.</p>
      <p>${need}</p>
      <p>Estimated pay at ${tier.nextRating}% with the same dependents: <b>${money(nextPay)}</b>/month (<b>+${money(nextPay - pay.total)}</b>).</p>
      <p class="hint">This only shows how the math works. Ratings are based on medical evidence, not on what's needed to reach a number.</p>`;
  }

  out.innerHTML = `
    <div class="cards3">
      <div class="stat"><span class="k">Combined value</span><strong>${r.combined}%</strong><small>Before rounding (§ 4.25 Table I)</small></div>
      <div class="stat va"><span class="k">VA rating</span><strong>${r.final}%</strong><small>Rounded to nearest 10%</small></div>
      <div class="stat"><span class="k">Est. monthly pay</span><strong>${money(pay.total)}</strong><small>${depsLabel(r.final, deps)}</small></div>
    </div>
    <div class="tier"><h3>What it takes to reach the next tier</h3>${tierHtml}</div>
    <details><summary>Show the math</summary><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <ul class="pay">${pay.lines.map((l) => `<li>${l.label}: ${money(l.amount)}</li>`).join("")}</ul>
    </details>
    ${pay.warnings.map((w) => `<p class="warn">${w}</p>`).join("")}
    <p class="hint">Rates effective ${RATES_META.effective}, from <a href="${RATES_META.sourceUrl}" target="_blank" rel="noopener">VA.gov</a>. This is an estimate, not an official VA decision.</p>`;
}

for (const id of ["u18", "school"]) {
  $(id).innerHTML = Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
}

["spouse", "spouseAA", "u18", "school", "parents"].forEach((id) => {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});
$("add").addEventListener("click", () => addRow());
addRow(10);
