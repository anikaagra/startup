import { openDb } from './db.js';
import { computeTier, evaluateCheck } from './rules.js';
import { newId } from './db.js';

// Example data only. Every seeded patient is fictional.
export function seed(db) {
  if (db.prepare('SELECT 1 FROM providers WHERE code = ?').get('DEMO42')) return false;
  db.prepare('INSERT INTO providers (code, name) VALUES (?, ?)').run('DEMO42', 'Bay Area Weight Care (demo)');
  const ins = db.prepare(`INSERT INTO patients (id, provider_code, first_name, age, sex, menopause, medication, dose, start_date,
    start_weight_lb, current_weight_lb, activity, falls, joint_pain, goal, tier, tier_reasons, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insCheck = db.prepare(`INSERT INTO checks (patient_id, created_at, stands, duration_sec, confidence, slept_poorly, pain_or_ill,
    lean_mass_lb, body_fat_pct, method, state, flagged, provider_flag, verdict, action, reason, retest_date, below_norm, norm_cutoff, norm_band)
    VALUES (?,?,?,30,?,0,0,NULL,NULL,'phone-video',?,?,?,?,?,?,?,?,?,?)`);
  const people = [
    ['Linda', 67, 'female', 'yes', 'semaglutide', '1.7 mg', '2026-05-20', 228, 196, 'some', 'once', 'yes', 'garden again without help', [13, 11, 9]],
    ['Maria', 62, 'female', 'yes', 'semaglutide', '1 mg', '2026-06-02', 205, 182, 'some', 'none', 'yes', 'keep up with my grandkids', [14, 14, 12]],
    ['Dennis', 71, 'male', null, 'tirzepatide', '10 mg', '2026-04-11', 251, 219, 'regular', 'none', 'no', 'keep golfing', [13, 13, 12]],
    ['Priya', 54, 'female', 'no', 'semaglutide', '2.4 mg', '2026-07-01', 190, 176, 'regular', 'none', 'no', 'hike Mission Peak', [16, 17, 17]],
    ['James', 48, 'male', null, 'tirzepatide', '7.5 mg', '2026-06-15', 262, 238, 'very', 'none', 'no', 'play basketball with my son', [18, 19, 19]],
    ['Rosa', 59, 'female', 'yes', 'semaglutide', '1.7 mg', '2026-05-05', 214, 190, 'some', 'none', 'no', 'travel to see my sister', [15, 16, 15]],
  ];
  const dates = ['2026-08-03T17:00:00.000Z', '2026-09-01T17:00:00.000Z', '2026-10-01T17:00:00.000Z'];
  for (const [firstName, age, sex, menopause, medication, dose, startDate, sw, cw, activity, falls, jointPain, goal, stands] of people) {
    const p = { firstName, age, sex, menopause, medication, dose, startDate, startWeightLb: sw, currentWeightLb: cw, activity, falls, jointPain, goal };
    const { tier, reasons } = computeTier(p);
    const id = newId();
    ins.run(id, 'DEMO42', firstName, age, sex, menopause, medication, dose, startDate, sw, cw, activity, falls, jointPain, goal, tier, JSON.stringify(reasons), dates[0]);
    const history = [];
    stands.forEach((s, i) => {
      const r = evaluateCheck({ ...p, tier }, history, { stands: s, createdAt: dates[i] });
      insCheck.run(id, dates[i], s, 0.92, r.state, r.flagged ? 1 : 0, r.providerFlag ? 1 : 0, r.verdict, r.action, r.reason, r.retestDate, r.belowNorm ? 1 : 0, r.normCutoff, r.normBand);
      history.push({ ...r });
    });
  }
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  console.log(seed(db) ? 'Seeded demo provider DEMO42 with 6 example patients.' : 'Demo data already present.');
}
