// CDC STEADI 30-Second Chair Stand: a score BELOW these numbers is below average for age and sex.
// Source: CDC STEADI "Assessment: 30-Second Chair Stand" (ages 60-94). Rise uses the 60-64 row for
// patients under 60 and marks the comparison as extrapolated, since STEADI publishes no norms below 60.
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
