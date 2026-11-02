import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';

let base; let server;
before(async () => {
  const db = openDb(':memory:');
  seed(db);
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('intake rejects an unknown provider code with a clear message', async () => {
  const r = await post('/api/patients', { providerCode: 'NOPE', firstName: 'A', age: 60, sex: 'female' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /provider code/);
});

test('full patient flow: intake, two checks, provider sees them', async () => {
  const r = await post('/api/patients', { providerCode: 'demo42', firstName: 'Ana', age: 66, sex: 'female', menopause: 'yes',
    medication: 'semaglutide', startDate: '2026-08-01', startWeightLb: 200, currentWeightLb: 190, activity: 'some', falls: 'none', jointPain: 'no', goal: 'walk my dog' });
  assert.equal(r.status, 201);
  const p = await r.json();
  assert.equal(p.tier, 'higher');
  assert.ok(p.tierReasons.includes('Age 65 or older'));

  const c1 = await (await post(`/api/patients/${p.id}/checks`, { stands: 13, confidence: 0.9 })).json();
  assert.equal(c1.state, 'steady');
  const c2 = await (await post(`/api/patients/${p.id}/checks`, { stands: 12, confidence: 0.9 })).json();
  assert.equal(c2.state, 'watch');
  assert.equal(c2.patient.checks.length, 2);

  const list = await (await fetch(`${base}/api/providers/DEMO42`)).json();
  assert.equal(list.patients[0].state, 'checkin', 'check-in patients sort first');
  assert.ok(list.patients.some((x) => x.id === p.id && x.state === 'watch'));

  const exp = await (await fetch(`${base}/api/providers/DEMO42/patients/${p.id}/export`)).json();
  assert.equal(exp.checks.length, 2);
  assert.equal(exp.checks[1].observations[0].measure, '30-second chair stand');
});

test('check validation', async () => {
  const p = await (await post('/api/patients', { providerCode: 'DEMO42', firstName: 'B', age: 50, sex: 'male' })).json();
  const r = await post(`/api/patients/${p.id}/checks`, { stands: 2.5 });
  assert.equal(r.status, 400);
});

test('provider cannot read another provider\'s patient', async () => {
  const r = await fetch(`${base}/api/providers/NOPE/patients/x`);
  assert.equal(r.status, 404);
});

test('body composition and grip are stored, validated and combined', async () => {
  const p = await (await post('/api/patients', { providerCode: 'DEMO42', firstName: 'Cy', age: 70, sex: 'male', heightIn: 70 })).json();
  const bad = await post(`/api/patients/${p.id}/checks`, { stands: 12, weightLb: 200, leanMassLb: 130 });
  assert.equal(bad.status, 400, 'lean mass needs a method');
  const c1 = await (await post(`/api/patients/${p.id}/checks`, { stands: 12, weightLb: 220, leanMassLb: 140, bodyCompMethod: 'smart-scale', gripKg: 34 })).json();
  assert.equal(c1.domains.mass.measured, true);
  assert.equal(c1.domains.grip.value, 34);
  const c2 = await (await post(`/api/patients/${p.id}/checks`, { stands: 12, weightLb: 210, leanMassLb: 134, bodyCompMethod: 'smart-scale', gripKg: 33 })).json();
  assert.equal(c2.domains.mass.leanShare, 0.6);
  assert.equal(c2.state, 'checkin');
  const exp = await (await fetch(`${base}/api/providers/DEMO42/patients/${p.id}/export`)).json();
  const obs = exp.checks[1].observations.map((o) => o.measure);
  assert.deepEqual(obs, ['30-second chair stand', 'Body weight', 'Lean (fat-free) mass', 'Handgrip strength']);
});
