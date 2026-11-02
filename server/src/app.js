import express from 'express';
import { computeTier, evaluateCheck, STATE_RANK, TIERS } from './rules.js';
import { newId, patientFromRow, checkFromRow } from './db.js';

const SEX = ['female', 'male', 'other'];
const YES_NO = ['yes', 'no', 'unsure', 'skip'];
const ACTIVITY = ['rarely', 'some', 'regular', 'very'];
const FALLS = ['none', 'once', 'more', 'skip'];

class Bad extends Error { constructor(m) { super(m); this.status = 400; } }
const need = (cond, msg) => { if (!cond) throw new Bad(msg); };
const num = (v) => (v === '' || v == null ? null : Number(v));

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  const q = {
    provider: db.prepare('SELECT * FROM providers WHERE code = ?'),
    patient: db.prepare('SELECT * FROM patients WHERE id = ?'),
    checks: db.prepare('SELECT * FROM checks WHERE patient_id = ? ORDER BY created_at ASC, id ASC'),
    patientsFor: db.prepare('SELECT * FROM patients WHERE provider_code = ?'),
    insertPatient: db.prepare(`INSERT INTO patients (id, provider_code, first_name, age, sex, menopause, medication, dose,
      start_date, start_weight_lb, current_weight_lb, activity, falls, joint_pain, goal, tier, tier_reasons, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
    insertCheck: db.prepare(`INSERT INTO checks (patient_id, created_at, stands, duration_sec, confidence, slept_poorly,
      pain_or_ill, lean_mass_lb, body_fat_pct, method, state, flagged, provider_flag, verdict, action, reason, retest_date,
      below_norm, norm_cutoff, norm_band) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  };

  const loadPatient = (id) => {
    const p = patientFromRow(q.patient.get(id));
    if (!p) { const e = new Error('Patient not found'); e.status = 404; throw e; }
    return p;
  };
  const withChecks = (p) => {
    const checks = q.checks.all(p.id).map(checkFromRow);
    const last = checks[checks.length - 1];
    return { ...p, checks, nextDue: last ? last.retestDate : new Date().toISOString().slice(0, 10), checkEveryDays: TIERS[p.tier].checkEveryDays };
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/patients', (req, res) => {
    const b = req.body ?? {};
    const code = String(b.providerCode ?? '').trim().toUpperCase();
    need(q.provider.get(code), 'That provider code was not found. Check the code your care team gave you.');
    const firstName = String(b.firstName ?? '').trim().slice(0, 40);
    need(firstName, 'Please enter your first name.');
    const age = num(b.age);
    need(Number.isInteger(age) && age >= 18 && age <= 110, 'Please enter an age between 18 and 110.');
    need(SEX.includes(b.sex), 'Please choose an answer for sex.');
    const p = {
      firstName, age, sex: b.sex,
      menopause: b.sex === 'female' && YES_NO.includes(b.menopause) ? b.menopause : null,
      medication: String(b.medication ?? '').slice(0, 60) || null,
      dose: String(b.dose ?? '').slice(0, 30) || null,
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(b.startDate ?? '') ? b.startDate : null,
      startWeightLb: num(b.startWeightLb), currentWeightLb: num(b.currentWeightLb),
      activity: ACTIVITY.includes(b.activity) ? b.activity : null,
      falls: FALLS.includes(b.falls) ? b.falls : null,
      jointPain: YES_NO.includes(b.jointPain) ? b.jointPain : null,
      goal: String(b.goal ?? '').trim().slice(0, 120) || null,
    };
    const { tier, reasons } = computeTier(p);
    const id = newId();
    q.insertPatient.run(id, code, p.firstName, p.age, p.sex, p.menopause, p.medication, p.dose, p.startDate,
      p.startWeightLb, p.currentWeightLb, p.activity, p.falls, p.jointPain, p.goal, tier, JSON.stringify(reasons), new Date().toISOString());
    res.status(201).json(withChecks(loadPatient(id)));
  });

  app.get('/api/patients/:id', (req, res) => res.json(withChecks(loadPatient(req.params.id))));

  app.post('/api/patients/:id/checks', (req, res) => {
    const p = loadPatient(req.params.id);
    const b = req.body ?? {};
    const stands = num(b.stands);
    need(Number.isInteger(stands) && stands >= 0 && stands <= 40, 'Stands must be a whole number from 0 to 40.');
    const confidence = num(b.confidence);
    need(confidence == null || (confidence >= 0 && confidence <= 1), 'Confidence must be between 0 and 1.');
    const history = q.checks.all(p.id).map(checkFromRow);
    const r = evaluateCheck(p, history, { stands, sleptPoorly: !!b.sleptPoorly, painOrIll: !!b.painOrIll, createdAt: b.createdAt });
    q.insertCheck.run(p.id, r.createdAt, stands, num(b.durationSec) ?? 30, confidence, b.sleptPoorly ? 1 : 0, b.painOrIll ? 1 : 0,
      num(b.leanMassLb), num(b.bodyFatPct), b.method === 'demo' ? 'demo' : 'phone-video', r.state, r.flagged ? 1 : 0,
      r.providerFlag ? 1 : 0, r.verdict, r.action, r.reason, r.retestDate, r.belowNorm ? 1 : 0, r.normCutoff, r.normBand);
    res.status(201).json({ ...r, patient: withChecks(p) });
  });

  // Provider endpoints. MVP: access by provider code only. Replace with real sign-in before any real patient data.
  const loadProvider = (code) => {
    const pr = q.provider.get(String(code).toUpperCase());
    if (!pr) { const e = new Error('Provider code not found'); e.status = 404; throw e; }
    return pr;
  };

  app.get('/api/providers/:code', (req, res) => {
    const pr = loadProvider(req.params.code);
    const patients = q.patientsFor.all(pr.code).map((r) => withChecks(patientFromRow(r))).map((p) => {
      const last = p.checks[p.checks.length - 1];
      return {
        id: p.id, firstName: p.firstName, age: p.age, sex: p.sex, medication: p.medication, startDate: p.startDate,
        tier: p.tier, state: last?.state ?? null, flagged: last?.flagged ?? false, lastCheck: last?.createdAt ?? null,
        recent: p.checks.slice(-3).map((c) => c.stands), latest: last?.stands ?? null,
        belowNorm: last?.belowNorm ?? false, normCutoff: last?.normCutoff ?? null, normBand: last?.normBand ?? null,
        overdue: last ? last.retestDate < new Date().toISOString().slice(0, 10) : true,
      };
    });
    patients.sort((a, b) =>
      (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3) ||
      (a.tier === 'higher' ? 0 : 1) - (b.tier === 'higher' ? 0 : 1) ||
      String(b.lastCheck).localeCompare(String(a.lastCheck)));
    res.json({ code: pr.code, name: pr.name, patients });
  });

  const providerPatient = (req) => {
    const pr = loadProvider(req.params.code);
    const p = loadPatient(req.params.id);
    if (p.providerCode !== pr.code) { const e = new Error('Patient not found'); e.status = 404; throw e; }
    return withChecks(p);
  };

  app.get('/api/providers/:code/patients/:id', (req, res) => res.json(providerPatient(req)));

  // Structured, record-ready export: one row per check.
  app.get('/api/providers/:code/patients/:id/export', (req, res) => {
    const p = providerPatient(req);
    res.json({
      patient: { id: p.id, firstName: p.firstName, age: p.age, sex: p.sex, tier: p.tier, tierReasons: p.tierReasons },
      observations: p.checks.map((c) => ({
        date: c.createdAt.slice(0, 10), measure: '30-second chair stand', value: c.stands, unit: 'repetitions',
        method: c.method, captureConfidence: c.confidence, state: c.state, readinessFlag: c.flagged,
        belowAgeSexNorm: c.belowNorm, normCutoff: c.normCutoff, normReference: `CDC STEADI ${c.normBand}`,
        leanMassLb: c.leanMassLb, bodyFatPct: c.bodyFatPct, actionGiven: c.action,
      })),
    });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong on our side. Please try again.' : err.message });
  });
  return app;
}
