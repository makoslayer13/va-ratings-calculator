import { nextTier, calculate } from "./calc.js";
import { monthlyPayment, RATES_META, FLAT, BASIC } from "./rates.js";

const SIDES = [
  ["none", "Not an arm/leg"],
  ["left-arm", "Left arm"],
  ["right-arm", "Right arm"],
  ["left-leg", "Left leg"],
  ["right-leg", "Right leg"],
];
// Short codes for shareable links
const SIDE_CODE = { none: "n", "left-arm": "la", "right-arm": "ra", "left-leg": "ll", "right-leg": "rl" };
const CODE_SIDE = Object.fromEntries(Object.entries(SIDE_CODE).map(([k, v]) => [v, k]));
const RATINGS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const list = document.getElementById("ratings");
const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
let ready = false;

function addRow(rating = 10, side = "none") {
  const div = document.createElement("div");
  div.className = "row";
  const n = list.querySelectorAll(".row").length + 1;
  div.innerHTML = `
    <label><span class="rl">Rating ${n}</span>
      <select class="r">${RATINGS.map((r) => `<option value="${r}" ${r === rating ? "selected" : ""}>${r}%</option>`).join("")}</select>
    </label>
    <label>Body part
      <select class="s">${SIDES.map(([v, t]) => `<option value="${v}" ${v === side ? "selected" : ""}>${t}</option>`).join("")}</select>
    </label>
    <button type="button" class="remove" aria-label="Remove this rating">Remove</button>`;
  div.querySelector(".remove").addEventListener("click", () => { div.remove(); renumber(); render(); });
  div.querySelectorAll("select").forEach((el) => el.addEventListener("change", render));
  list.appendChild(div);
  render();
}

function renumber() {
  list.querySelectorAll(".row .rl").forEach((el, i) => { el.textContent = `Rating ${i + 1}`; });
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

// ---- Shareable link: ?r=50,30&s=n,la&spouse=1&aa=1&u18=2&school=0&parents=1
function writeUrl(disabilities, deps) {
  const p = new URLSearchParams();
  p.set("r", disabilities.map((d) => d.rating).join(","));
  if (disabilities.some((d) => d.side !== "none")) p.set("s", disabilities.map((d) => SIDE_CODE[d.side]).join(","));
  if (deps.spouse) p.set("spouse", "1");
  if (deps.spouseAA) p.set("aa", "1");
  if (deps.childrenUnder18) p.set("u18", deps.childrenUnder18);
  if (deps.childrenSchool) p.set("school", deps.childrenSchool);
  if (deps.parents) p.set("parents", deps.parents);
  history.replaceState(null, "", `${location.pathname}?${p.toString().replace(/%2C/g, ",")}`);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  const rs = (p.get("r") || "").split(",").filter((x) => x !== "").map(Number).filter((n) => RATINGS.includes(n));
  const ss = (p.get("s") || "").split(",");
  const setSel = (id, v, max) => { const n = Math.min(max, Math.max(0, parseInt(v, 10) || 0)); $(id).value = String(n); };
  $("spouse").checked = p.get("spouse") === "1";
  $("spouseAA").checked = p.get("spouse") === "1" && p.get("aa") === "1";
  setSel("u18", p.get("u18"), 10);
  setSel("school", p.get("school"), 10);
  setSel("parents", p.get("parents"), 2);
  return rs.map((r, i) => ({ rating: r, side: CODE_SIDE[ss[i]] || "none" }));
}

function render() {
  if (!ready) return;
  $("spouseAA").disabled = !$("spouse").checked;
  if (!$("spouse").checked) $("spouseAA").checked = false;
  const { disabilities, deps } = readInputs();
  writeUrl(disabilities, deps);
  const out = $("result");
  if (disabilities.filter((d) => d.rating > 0).length === 0) {
    out.innerHTML = `<p class="hint">Add at least one rating above 0%.</p>`;
    $("sticky").hidden = true;
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
  steps.push(`Combined value <b>${r.combined}</b>, rounded to the nearest 10: <b>${r.final}%</b> (§ 4.25(a)).`);

  const rulesApplied = ["38 CFR § 4.25 (combined ratings)"];
  if (r.bilateral) rulesApplied.push("38 CFR § 4.26 (bilateral factor)");
  rulesApplied.push("VA.gov compensation rates, effective Dec 1, 2025");

  let tierHtml;
  if (tier.nextRating === null) {
    tierHtml = `<p>You're at the top of the schedule (100%).</p>`;
  } else {
    const nextPay = monthlyPayment(tier.nextRating, deps).total;
    const need = tier.additionalRatingNeeded
      ? `Under the § 4.25 math, one more rated condition at <b>${tier.additionalRatingNeeded}%</b> would bring your combined value to <b>${tier.trial.combined}</b>, which rounds to <b>${tier.nextRating}%</b>.`
      : `No single additional rating reaches ${tier.nextRating}% from here.`;
    let videoCta = "";
    if (r.final >= 80 && r.final < 100) {
      videoCta = `
        <div class="video-cta" style="background:#fff8e6;border:1px solid var(--gold);border-radius:6px;padding:14px 18px;margin:16px 0;">
          <strong style="color:var(--navy);font-family:'Oswald',sans-serif;font-size:1.1rem;display:block;margin-bottom:4px;">Stuck at ${r.final}%? Here's why the math gets harder:</strong>
          <p style="margin:0 0 10px;font-size:.9rem;">When your rating reaches 80% or 90%, each additional 10% condition only adds a tiny fraction toward your combined total. Watch how 38 CFR § 4.25 calculates "efficiency left":</p>
          <a class="btn-secondary yt" href="https://www.youtube.com/watch?v=fNjjJ0Ez4wQ" target="_blank" rel="noopener" style="font-size:.85rem;padding:6px 14px;display:inline-block;text-decoration:none;">▶ Watch: The VA Trick Nobody Explains</a>
          <a class="btn-subscribe" href="https://www.youtube.com/@SaltyandRated?sub_confirmation=1" target="_blank" rel="noopener" style="font-size:.85rem;padding:6px 14px;margin-left:8px;display:inline-block;text-decoration:none;">Subscribe</a>
        </div>`;
    } else if (r.bilateral) {
      videoCta = `
        <div class="video-cta" style="background:#fff8e6;border:1px solid var(--gold);border-radius:6px;padding:14px 18px;margin:16px 0;">
          <strong style="color:var(--navy);font-family:'Oswald',sans-serif;font-size:1.1rem;display:block;margin-bottom:4px;">Bilateral Factor Applied (§ 4.26)</strong>
          <p style="margin:0 0 10px;font-size:.9rem;">Because you have qualifying disabilities affecting both limbs, the VA adds an extra 10% boost to those conditions before combining them with the rest of your body.</p>
          <a class="btn-secondary yt" href="https://www.youtube.com/@SaltyandRated" target="_blank" rel="noopener" style="font-size:.85rem;padding:6px 14px;display:inline-block;text-decoration:none;">▶ Watch More VA Explanations on YouTube</a>
        </div>`;
    }

    tierHtml = `
      <p>Your combined value is <b>${r.combined}</b>. ${tier.nextRating}% starts at a combined value of <b>${tier.roundsUpAt}</b>, which is <b>${tier.pointsNeeded} point${tier.pointsNeeded === 1 ? "" : "s"}</b> away.</p>
      <p>${need}</p>
      <p>Estimated pay at ${tier.nextRating}% with the same dependents: <b>${money(nextPay)}</b>/month (<b>+${money(nextPay - pay.total)}</b>).</p>
      ${videoCta}
      <p class="hint">This only shows how the math works. Ratings are based on medical evidence, not on what's needed to reach a number.</p>`;
  }

  out.innerHTML = `
    <div class="cards3">
      <div class="stat"><span class="k">Combined value</span><strong>${r.combined}%</strong><small>Before rounding (§ 4.25 Table I)</small></div>
      <div class="stat va"><span class="k">VA rating</span><strong>${r.final}%</strong><small>Rounded to nearest 10%</small></div>
      <div class="stat"><span class="k">Est. monthly pay</span><strong>${money(pay.total)}</strong><small>${depsLabel(r.final, deps)}</small></div>
    </div>
    <p class="applied"><b>Rules applied:</b> ${rulesApplied.join(" · ")}</p>
    <div class="tier"><h3>What it takes to reach the next tier</h3>${tierHtml}</div>
    <details><summary>Show the math, step by step</summary><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <ul class="pay">${pay.lines.map((l) => `<li>${l.label}: ${money(l.amount)}</li>`).join("")}</ul>
    </details>
    ${pay.warnings.map((w) => `<p class="warn">${w}</p>`).join("")}
    <p class="share"><button type="button" class="btn-secondary" id="copyLink">Copy link to these results</button> <span id="copied" class="hint" aria-live="polite"></span></p>
    <p class="hint">This is not legal or medical advice. It's an estimate from public information, not an official VA decision.</p>`;

  $("copyLink").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); $("copied").textContent = "Link copied."; }
    catch { $("copied").textContent = "Copy the address from your browser's address bar."; }
  });

  $("sticky").hidden = false;
  $("stickyRating").textContent = `${r.final}%`;
  $("stickyPay").textContent = money(pay.total);
}

function fillReferenceTables() {
  const levels = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  $("ratesTable").querySelector("tbody").innerHTML = levels.map((lvl) => {
    const m = lvl <= 20 ? FLAT[lvl] : BASIC.alone[lvl];
    return `<tr><td>${lvl}%</td><td>${money(m)}</td><td>${money(Math.round(m * 12 * 100) / 100)}</td></tr>`;
  }).join("");

  const examples = [[50, 50], [50, 30], [70, 50], [60, 40, 20], [70, 30, 20], [80, 50, 30], [90, 50], [70, 50, 30, 20]];
  $("examplesTable").querySelector("tbody").innerHTML = examples.map((set) => {
    const res = calculate(set.map((rating) => ({ rating })));
    return `<tr><td><a href="?r=${set.join(",")}">${set.map((x) => x + "%").join(" + ")}</a></td><td>${res.combined}</td><td>${res.final}%</td></tr>`;
  }).join("");
}

for (const id of ["u18", "school"]) {
  $(id).innerHTML = Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
}
["spouse", "spouseAA", "u18", "school", "parents"].forEach((id) => {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});
$("add").addEventListener("click", () => addRow());

fillReferenceTables();
const fromUrl = readUrl();
(fromUrl.length ? fromUrl : [{ rating: 10, side: "none" }]).forEach((d) => addRow(d.rating, d.side));
ready = true;
render();
