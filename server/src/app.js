import express from 'express';
import { computeTier, evaluateCheck, STATE_RANK, TIERS } from './rules.js';
import { newId, patientFromRow, checkFromRow, insertCheck } from './db.js';
import { METHOD_LABEL } from './rules.js';
import { toExport } from './exportShape.js';

const SEX = ['female', 'male', 'other'];
const YES_NO = ['yes', 'no', 'unsure', 'skip'];
const ACTIVITY = ['rarely', 'some', 'regular', 'very'];
const FALLS = ['none', 'once', 'more', 'skip'];
const METHODS = Object.keys(METHOD_LABEL);

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
      start_date, start_weight_lb, current_weight_lb, activity, falls, joint_pain, goal, height_in, tier, tier_reasons, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
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
      heightIn: num(b.heightIn),
    };
    need(p.heightIn == null || (p.heightIn >= 48 && p.heightIn <= 90), 'Please enter a height between 4 and 7.5 feet.');
    const { tier, reasons } = computeTier(p);
    const id = newId();
    q.insertPatient.run(id, code, p.firstName, p.age, p.sex, p.menopause, p.medication, p.dose, p.startDate,
      p.startWeightLb, p.currentWeightLb, p.activity, p.falls, p.jointPain, p.goal, p.heightIn, tier, JSON.stringify(reasons), new Date().toISOString());
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
    const c = {
      stands, confidence, durationSec: num(b.durationSec) ?? 30, sleptPoorly: !!b.sleptPoorly, painOrIll: !!b.painOrIll,
      method: b.method === 'demo' ? 'demo' : 'phone-video', createdAt: b.createdAt,
      weightLb: num(b.weightLb), leanMassLb: num(b.leanMassLb), bodyFatPct: num(b.bodyFatPct), asmKg: num(b.asmKg),
      bodyCompMethod: METHODS.includes(b.bodyCompMethod) ? b.bodyCompMethod : null, gripKg: num(b.gripKg),
    };
    need(c.weightLb == null || (c.weightLb >= 60 && c.weightLb <= 800), 'Weight must be between 60 and 800 lb.');
    need(c.leanMassLb == null || (c.leanMassLb >= 30 && c.leanMassLb <= 300), 'Lean mass must be between 30 and 300 lb.');
    need(c.leanMassLb == null || c.weightLb == null || c.leanMassLb < c.weightLb, 'Lean mass must be less than your weight. Check the numbers from your scan.');
    need(c.leanMassLb == null || c.bodyCompMethod, 'Please choose where your body composition numbers came from.');
    need(c.bodyFatPct == null || (c.bodyFatPct >= 3 && c.bodyFatPct <= 75), 'Body fat must be between 3% and 75%.');
    need(c.gripKg == null || (c.gripKg >= 2 && c.gripKg <= 90), 'Grip must be between 2 and 90 kg.');
    need(c.asmKg == null || (c.asmKg >= 5 && c.asmKg <= 60), 'Appendicular lean mass must be between 5 and 60 kg.');
    const history = q.checks.all(p.id).map(checkFromRow);
    const r = evaluateCheck(p, history, c);
    insertCheck(db, p.id, c, r);
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
        massState: last?.domains?.mass?.state ?? null, leanShare: last?.domains?.mass?.leanShare ?? null,
        gripState: last?.domains?.grip?.state ?? null, gripKg: last?.gripKg ?? null, reasons: last?.reasons ?? [],
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
    res.json(toExport(p));
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
