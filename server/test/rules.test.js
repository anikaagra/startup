import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTier, evaluateCheck, evaluateMass, evaluateGrip } from '../src/rules.js';
import { normFor } from '../src/norms.js';

const maria = { firstName: 'Maria', age: 62, sex: 'female', tier: 'standard', goal: 'keep up with my grandkids', jointPain: 'yes', activity: 'some' };
const run = (p, seq, extra = {}) => {
  const h = []; let r;
  seq.forEach((s, i) => { r = evaluateCheck(p, h, { stands: s, createdAt: `2026-0${i + 1}-01T00:00:00Z`, ...(i === seq.length - 1 ? extra : {}) }); h.push(r); });
  return { r, h };
};

test('STEADI norms by age and sex', () => {
  assert.equal(normFor(62, 'female').cutoff, 12);
  assert.equal(normFor(72, 'male').cutoff, 12);
  assert.equal(normFor(50, 'female').extrapolated, true);
  assert.equal(normFor(91, 'female').cutoff, 4);
});

test('tier: postmenopausal woman is higher risk; young man is standard', () => {
  assert.equal(computeTier({ sex: 'female', menopause: 'yes', age: 58 }).tier, 'higher');
  const t = computeTier({ sex: 'male', age: 40, falls: 'none', startDate: '2026-09-01', startWeightLb: 200, currentWeightLb: 196 }, new Date('2026-10-01'));
  assert.equal(t.tier, 'standard');
  assert.deepEqual(t.reasons, []);
});

test('tier: fast weight loss is higher risk', () => {
  const t = computeTier({ sex: 'male', age: 40, startDate: '2026-09-01', startWeightLb: 200, currentWeightLb: 180 }, new Date('2026-10-01'));
  assert.equal(t.tier, 'higher');
  assert.match(t.reasons[0], /Losing weight fast/);
});

test('first check at or above norm is steady with a baseline message', () => {
  const { r } = run(maria, [14]);
  assert.equal(r.state, 'steady');
  assert.match(r.reason, /starting point/);
});

test('standard tier: drop of 1 stays steady, drop of 2 is watch', () => {
  assert.equal(run(maria, [14, 13]).r.state, 'steady');
  assert.equal(run(maria, [14, 12]).r.state, 'watch');
});

test('watch twice in a row becomes check in and flags the provider', () => {
  const { r } = run(maria, [14, 12, 12]);
  assert.equal(r.state, 'checkin');
  assert.equal(r.providerFlag, true);
});

test('drop of 4 from baseline is check in straight away', () => {
  assert.equal(run(maria, [15, 11]).r.state, 'checkin');
});

test('higher tier is more sensitive', () => {
  assert.equal(run({ ...maria, tier: 'higher' }, [14, 13]).r.state, 'watch');
  assert.equal(run({ ...maria, tier: 'higher' }, [14, 11]).r.state, 'checkin');
});

test('readiness flag never flags the provider and retests in a week', () => {
  const { r } = run(maria, [15, 11], { painOrIll: true });
  assert.equal(r.state, 'watch');
  assert.equal(r.flagged, true);
  assert.equal(r.providerFlag, false);
  assert.equal(r.retestDate, '2026-02-08');
});

test('a flagged watch does not count toward two-in-a-row', () => {
  const p = maria; const h = [];
  h.push(evaluateCheck(p, h, { stands: 14, createdAt: '2026-01-01T00:00:00Z' }));
  h.push(evaluateCheck(p, h, { stands: 12, createdAt: '2026-02-01T00:00:00Z', sleptPoorly: true }));
  assert.equal(evaluateCheck(p, h, { stands: 12, createdAt: '2026-03-01T00:00:00Z' }).state, 'watch');
});

test('newly below the norm is watch even with a small drop', () => {
  assert.equal(run(maria, [12, 11]).r.state, 'watch');
});

test('copy is personalized with name, goal and limits', () => {
  const { r } = run(maria, [14, 12]);
  assert.match(r.verdict, /^Maria/);
  assert.match(r.action, /chair strength routine/);
  assert.match(r.reason, /keep up with your grandkids/);
  assert.match(r.reason, /Based on your leg strength/);
});

// ---- Body composition ----
const scan = (stands, weightLb, leanMassLb, extra = {}) => ({ stands, weightLb, leanMassLb, bodyCompMethod: 'smart-scale', ...extra });
const seq = (p, list) => { const h = []; let r; list.forEach((c, i) => { r = evaluateCheck(p, h, { ...c, createdAt: `2026-0${i + 1}-01T00:00:00Z` }); h.push({ ...c, ...r }); }); return r; };

test('lean share in the trial range (20-40%) is steady', () => {
  const r = seq(maria, [scan(14, 200, 110), scan(14, 190, 107)]); // 3 of 10 lb = 30%
  assert.equal(r.domains.mass.leanShare, 0.3);
  assert.equal(r.domains.mass.state, 'steady');
  assert.equal(r.state, 'steady');
});

test('lean share above 40% is watch; above 60% is check in', () => {
  assert.equal(seq(maria, [scan(14, 200, 110), scan(14, 190, 105)]).domains.mass.state, 'watch');
  const r = seq(maria, [scan(14, 200, 110), scan(14, 190, 103)]);
  assert.equal(r.domains.mass.state, 'checkin');
  assert.equal(r.state, 'checkin');
  assert.match(r.reasons.join(' '), /70% of weight lost/);
});

test('lean share is not judged until enough weight is lost', () => {
  const r = seq(maria, [scan(14, 200, 110), scan(14, 197, 108)]); // only 3 lb
  assert.equal(r.domains.mass.leanShare, null);
  assert.equal(r.domains.mass.state, 'steady');
  assert.match(r.domains.mass.patientLine, /Not enough weight change/);
});

test('scans from different methods are never compared', () => {
  const r = seq(maria, [scan(14, 200, 110), { ...scan(14, 190, 100), bodyCompMethod: 'dexa' }]);
  assert.equal(r.domains.mass.leanShare, null);
  assert.match(r.domains.mass.patientLine, /starting point for the DEXA scan/);
});

test('missing body comp leaves the mass domain unmeasured and does not change the result', () => {
  const r = seq(maria, [{ stands: 14 }, { stands: 14 }]);
  assert.equal(r.domains.mass.measured, false);
  assert.equal(r.state, 'steady');
});

test('low appendicular muscle index (EWGSOP2) is watch', () => {
  const p = { ...maria, heightIn: 63 }; // 1.60 m
  const m = evaluateMass(p, [], scan(14, 180, 95, { asmKg: 13 })); // 13 / 2.56 = 5.1 < 5.5
  assert.equal(m.lowMuscle, true);
  assert.equal(m.state, 'watch');
});

// ---- Grip ----
test('grip below the EWGSOP2 cut-off is watch; women 16 kg, men 27 kg', () => {
  assert.equal(evaluateGrip(maria, [], { gripKg: 15 }).state, 'watch');
  assert.equal(evaluateGrip(maria, [], { gripKg: 20 }).state, 'steady');
  assert.equal(evaluateGrip({ ...maria, sex: 'male' }, [], { gripKg: 25 }).state, 'watch');
});

test('grip drop of 10% is watch and 20% is check in', () => {
  assert.equal(evaluateGrip(maria, [{ gripKg: 25 }], { gripKg: 22 }).state, 'watch');
  assert.equal(evaluateGrip(maria, [{ gripKg: 25 }], { gripKg: 19.5 }).state, 'checkin');
  assert.equal(evaluateGrip(maria, [{ gripKg: 25 }], { gripKg: 24 }).state, 'steady');
});

// ---- Combining ----
test('two measures on watch at once escalates to check in', () => {
  const r = seq(maria, [scan(14, 200, 110, { gripKg: 25 }), scan(14, 190, 105.5, { gripKg: 22 })]);
  assert.equal(r.domains.mass.state, 'watch');
  assert.equal(r.domains.grip.state, 'watch');
  assert.equal(r.state, 'checkin');
  assert.ok(r.reasons.includes('Two measures changed at the same check'));
});

test('low on both strength tests is check in', () => {
  const r = seq(maria, [{ stands: 11, gripKg: 15 }]);
  assert.equal(r.state, 'checkin');
  assert.ok(r.reasons.some((x) => /both strength tests/.test(x)));
});

test('a mass-driven watch gives a protein-first action', () => {
  const r = seq(maria, [scan(14, 200, 110), scan(14, 190, 105)]);
  assert.equal(r.state, 'watch');
  assert.match(r.action, /protein at every meal/);
  assert.match(r.reason, /Based on your body scan/);
});

test('readiness flag still overrides a combined check in', () => {
  const r = seq(maria, [scan(14, 200, 110), scan(14, 190, 103, { painOrIll: true })]);
  assert.equal(r.state, 'watch');
  assert.equal(r.providerFlag, false);
});
