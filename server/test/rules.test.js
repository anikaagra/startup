import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTier, evaluateCheck } from '../src/rules.js';
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
});
