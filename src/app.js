import { calculate } from "./calc.js";
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

function render() {
  $("spouseAA").disabled = !$("spouse").checked;
  const { disabilities, deps } = readInputs();
  const out = $("result");
  if (disabilities.filter((d) => d.rating > 0).length === 0) {
    out.innerHTML = `<p class="hint">Add at least one rating above 0%.</p>`;
    return;
  }
  const r = calculate(disabilities);
  const pay = monthlyPayment(r.final, deps);

  const steps = [];
  if (r.bilateral) {
    steps.push(`Bilateral ratings combine to <b>${r.bilateral.combined}</b>. Add 10% (${r.bilateral.factor.toFixed(1)}) and round: <b>${r.bilateral.value}</b>, treated as one rating (§ 4.26).`);
  }
  steps.push(`Order of severity: <b>${r.order.join(", ")}</b>.`);
  r.steps.forEach((s) => steps.push(`${s.a} combined with ${s.b} = <b>${s.result}</b> (§ 4.25 Table I).`));
  steps.push(`Combined value <b>${r.combined}</b>, rounded to the nearest 10: <b>${r.final}%</b>.`);

  out.innerHTML = `
    <div class="big"><span>Estimated combined rating</span><strong>${r.final}%</strong></div>
    <div class="big"><span>Estimated monthly payment</span><strong>${money(pay.total)}</strong></div>
    <details open><summary>Show the math</summary><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <ul class="pay">${pay.lines.map((l) => `<li>${l.label}: ${money(l.amount)}</li>`).join("")}</ul>
    </details>
    ${pay.warnings.map((w) => `<p class="warn">${w}</p>`).join("")}
    <p class="hint">Rates effective ${RATES_META.effective}, from <a href="${RATES_META.sourceUrl}" target="_blank" rel="noopener">VA.gov</a>. This is an estimate, not an official VA decision.</p>`;
}

["spouse", "spouseAA", "u18", "school", "parents"].forEach((id) => {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});
$("add").addEventListener("click", () => addRow());
addRow(10);
