# How Rise evaluates a check

Every check combines up to three measures into one result: **Steady**, **Watch** or **Check in**. Patients and providers see the same result; providers also see every reason behind it.

All thresholds below are **drafts** from customer discovery and published references. They must be confirmed with clinical advisors before real patients use Rise. They live in `server/src/norms.js` and `server/src/rules.js`, and both the server and the demo run the same code.

## 1. Leg strength: 30-second sit-to-stand (every check)

| Result | Standard tier | Higher-risk tier |
|---|---|---|
| Watch | Down 2+ stands from the first check, or newly below the age and sex norm | Down 1+ stand, or newly below the norm |
| Check in | Down 4+ stands from the first check | Down 3+ stands |

Norm: CDC STEADI 30-Second Chair Stand, "below average" by age and sex (ages 60–94; under 60 uses the 60–64 row and is marked extrapolated).

## 2. Muscle mass: body composition (when the patient enters a scan)

Rise asks for today's weight, lean (fat-free) mass and optionally body fat and arm-and-leg lean mass, plus **which device** they came from (phone body scan app, smart scale, DEXA, clinic scale, other).

- **Lean share of weight lost** = lean mass lost ÷ weight lost, since the first scan from the **same device**. GLP-1 trials report lean mass at about **20–40%** of weight lost (Dubin, Heymsfield, Ravussin & Greenway, 2024).
- Watch at **40%** or more; Check in at **60%** or more.
- Not judged until at least **4 lb and 2%** of body weight has been lost since that first scan, so small readings can't trigger a flag.
- Scans from different devices are **never compared**. Devices disagree with each other much more than one device disagrees with itself (Dubin: bioimpedance is inaccurate but consistent for the same person).
- If arm-and-leg lean mass and height are available: Watch when appendicular lean mass ÷ height² is below the **EWGSOP2** cut-off (7.0 kg/m² men, 5.5 kg/m² women).
- Entry checks: lean mass must be less than weight, a device must be chosen, and lean mass plus fat mass must roughly add up to weight.

### Three ways to add body composition

1. **Rise phone scan (estimate).** Two photos, front and side, taken with a 10-second timer or uploaded. On the phone, MediaPipe's pose model finds the body outline and landmarks. Known height sets the scale. Width and depth at the neck, waist and hips give each circumference (ellipse approximation), and the U.S. Navy equations (Hodgdon & Beckett, 1984) estimate body fat. Lean mass = weight × (1 − body fat). Photos never leave the phone. Stored as method `rise-scan` with the three circumferences, and labeled as an estimate for providers.
2. **Import a file.** CSV or JSON exports from smart scales (Withings, Renpho, Eufy and others), InBody and DEXA services. Rise reads weight, lean (fat-free) mass, body fat % and appendicular lean mass by column name, uses the newest row, converts kg to lb, derives lean mass from weight and fat when needed, and never treats skeletal muscle mass as lean mass. The patient reviews the numbers before saving.
3. **Type the numbers in.**

Whichever way is used, the device is saved with the scan, and comparisons only use scans from the same device.

## 3. Grip strength (optional, home dynamometer, best of 3)

- Watch below the **EWGSOP2** cut-off (27 kg men, 16 kg women) or after a **10%** drop from the first grip.
- Check in after a **20%** drop.

## Combining the measures

1. Start with the most urgent measure.
2. **Check in** if the patient is low on **both strength tests** (below the STEADI norm and below the grip cut-off).
3. **Check in** if **two measures** are on Watch at the same check.
4. **Check in** if the result is Watch at **two checks in a row**.
5. **Readiness:** if the patient reports poor sleep, pain or illness, a non-steady result becomes Watch, the provider is **not** flagged, and the retest is in 7 days.

## What each person sees

- **Patient:** the overall result, one sentence per measure in plain words, one action matched to their tier, limits and the measure that changed (for example, protein first when lean share is high), their own goal, and a retest date. No "below average" language.
- **Provider:** the overall result, every reason with its reference (STEADI, EWGSOP2, trial range), raw values over time, the device used, capture confidence, readiness flags, and what the patient was told. Structured export per check.

## Known limits

- Lean mass includes water, organs and connective tissue, not only muscle.
- Phone sit-to-stand counting is a pilot measure until validated against in-person testing.
- Grip and body composition are patient-entered; a scan SDK and Bluetooth dynamometer would remove typing errors.
