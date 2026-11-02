// Reference values Rise compares against. All thresholds are drafts to be confirmed with clinical advisors.

// CDC STEADI 30-Second Chair Stand: a score BELOW these numbers is below average for age and sex (ages 60-94).
// Rise uses the 60-64 row for patients under 60 and marks the comparison as extrapolated.
const BELOW_AVERAGE = {
  male:   [[60, 64, 14], [65, 69, 12], [70, 74, 12], [75, 79, 11], [80, 84, 10], [85, 89, 8], [90, 94, 7]],
  female: [[60, 64, 12], [65, 69, 11], [70, 74, 10], [75, 79, 10], [80, 84, 9], [85, 89, 8], [90, 94, 4]],
};

export function normFor(age, sex) {
  const rows = BELOW_AVERAGE[sex === 'male' ? 'male' : 'female'];
  const a = Math.max(60, Math.min(94, Math.round(age)));
  const row = rows.find(([lo, hi]) => a >= lo && a <= hi);
  return {
    cutoff: row[2],
    band: `${row[0]}–${row[1]}`,
    extrapolated: age < 60,
    // When sex is "other" or unspecified, Rise uses the female table, which flags earlier.
    table: sex === 'male' ? 'male' : 'female',
  };
}

// EWGSOP2 (Cruz-Jentoft et al., Age and Ageing 2019) cut-offs for low strength and low muscle quantity.
export const EWGSOP2 = {
  gripKg: { male: 27, female: 16 },
  asmIndex: { male: 7.0, female: 5.5 }, // appendicular skeletal muscle mass / height² (kg/m²)
};
export const gripCutoff = (sex) => EWGSOP2.gripKg[sex === 'male' ? 'male' : 'female'];
export const asmCutoff = (sex) => EWGSOP2.asmIndex[sex === 'male' ? 'male' : 'female'];

// Share of weight lost that is lean (fat-free) mass. Across 28 GLP-1 trials it ranged from about 20% to 40%
// (Dubin, Heymsfield, Ravussin & Greenway, 2024). Above the top of that range is Watch; far above is Check in.
export const LEAN_SHARE = { watch: 0.4, checkin: 0.6 };

// A lean-share figure is only meaningful once enough weight has come off to be larger than measurement noise.
export const MIN_WEIGHT_CHANGE = { lb: 4, fraction: 0.02 };

// Grip: change from the patient's own first grip. Draft; typical test-retest variation is roughly 5-10%.
export const GRIP_DROP = { watch: 0.1, checkin: 0.2 };
