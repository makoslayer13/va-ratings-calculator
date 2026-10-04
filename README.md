# VA Combined Rating & Monthly Pay Calculator (Unofficial)

A free, open-source calculator for VA combined disability ratings and estimated monthly compensation. It runs entirely in your browser: no server, no tracking, and nothing you enter is sent anywhere.

**Not affiliated with the U.S. Department of Veterans Affairs. Estimates only — not legal or medical advice, and not an official VA decision.**

## Accuracy rules (Source-Driven Development)

Every formula and dollar amount traces to an official government source. Nothing comes from third-party sites or memory.

| What | Official source | How it's verified |
|---|---|---|
| Combined ratings | [38 CFR § 4.25](https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A/section-4.25) | The formula is tested against **every cell of Table I** (684 cells) plus all worked examples in the regulation |
| Bilateral factor | [38 CFR § 4.26](https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A/section-4.26) | Tested against the regulation's worked example (60/20/10/10 → 70%); § 4.26(c) and (d) implemented |
| Monthly pay (effective Dec 1, 2025) | [VA.gov compensation rates](https://www.va.gov/disability/compensation-rates/veteran-rates/) | The hand-entered table is tested against a machine-parsed snapshot of the VA.gov page, plus VA.gov's own worked examples ($617.47 and $2,367.45) |

Raw source copies are in `data/`, for auditing.

## Not modeled (shown in the app)
- Paired skeletal muscles under § 4.26
- Special Monthly Compensation (SMC), TDIU, helpless-child rates
- If all children are 18+ in school, the app warns you: VA.gov's tables don't spell out how the first school-age child is paid

## Run tests
```
node --test tests/
```

## Run locally
```
python3 -m http.server 8000   # then open http://localhost:8000
```

## Yearly update (each December)
1. Re-fetch https://www.va.gov/disability/compensation-rates/veteran-rates/
2. Update `src/rates.js` and `data/va_rates_snapshot.json`, along with the dates in `RATES_META` and `index.html`
3. Run the tests. They must all pass before you publish.

## Hosting
Production: **https://saltyandrated.com** (channel home) and **https://saltyandrated.com/calculator/** (the calculator), served by Cloudflare Pages project `va-ratings-calculator` on the free plan (fallback address: https://va-ratings-calculator-2ot.pages.dev). Commercial use (ads/affiliates) is allowed. It deploys automatically on every push to `main`.

GitHub Pages has been turned off. Hosting is Cloudflare only.

If you add affiliate links or ads: disclose them next to the link, keep them out of the results area, and never promote paid VA-claims "consultants." Paid claims help is limited to VA-accredited reps under 38 U.S.C. § 5904.

## License
MIT
