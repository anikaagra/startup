import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export function openDb(file = process.env.RISE_DB ?? 'rise.db') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS providers (code TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY, provider_code TEXT NOT NULL REFERENCES providers(code),
      first_name TEXT NOT NULL, age INTEGER NOT NULL, sex TEXT NOT NULL, menopause TEXT,
      medication TEXT, dose TEXT, start_date TEXT, start_weight_lb REAL, current_weight_lb REAL,
      activity TEXT, falls TEXT, joint_pain TEXT, goal TEXT,
      height_in REAL, tier TEXT NOT NULL, tier_reasons TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL REFERENCES patients(id),
      created_at TEXT NOT NULL, stands INTEGER NOT NULL, duration_sec REAL NOT NULL, confidence REAL,
      slept_poorly INTEGER NOT NULL DEFAULT 0, pain_or_ill INTEGER NOT NULL DEFAULT 0,
      lean_mass_lb REAL, body_fat_pct REAL, method TEXT NOT NULL DEFAULT 'phone-video',
      state TEXT NOT NULL, flagged INTEGER NOT NULL, provider_flag INTEGER NOT NULL,
      verdict TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, retest_date TEXT NOT NULL,
      below_norm INTEGER NOT NULL, norm_cutoff INTEGER NOT NULL, norm_band TEXT NOT NULL,
      weight_lb REAL, body_comp_method TEXT, asm_kg REAL, grip_kg REAL, domains TEXT, reasons TEXT, body_comp_detail TEXT
    );
  `);
  // Add columns introduced after the first release to existing databases.
  const add = (table, col, type) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  };
  add('patients', 'height_in', 'REAL');
  for (const [c, t] of [['weight_lb', 'REAL'], ['body_comp_method', 'TEXT'], ['asm_kg', 'REAL'], ['grip_kg', 'REAL'], ['domains', 'TEXT'], ['reasons', 'TEXT'], ['body_comp_detail', 'TEXT']]) add('checks', c, t);
  return db;
}

export const newId = () => randomUUID();

export function patientFromRow(r) {
  if (!r) return null;
  return {
    id: r.id, providerCode: r.provider_code, firstName: r.first_name, age: r.age, sex: r.sex,
    menopause: r.menopause, medication: r.medication, dose: r.dose, startDate: r.start_date,
    startWeightLb: r.start_weight_lb, currentWeightLb: r.current_weight_lb, activity: r.activity,
    falls: r.falls, jointPain: r.joint_pain, goal: r.goal, heightIn: r.height_in, tier: r.tier,
    tierReasons: JSON.parse(r.tier_reasons), createdAt: r.created_at,
  };
}

export function checkFromRow(r) {
  return {
    id: r.id, createdAt: r.created_at, stands: r.stands, durationSec: r.duration_sec, confidence: r.confidence,
    sleptPoorly: !!r.slept_poorly, painOrIll: !!r.pain_or_ill, leanMassLb: r.lean_mass_lb, bodyFatPct: r.body_fat_pct,
    method: r.method, state: r.state, flagged: !!r.flagged, providerFlag: !!r.provider_flag, verdict: r.verdict,
    action: r.action, reason: r.reason, retestDate: r.retest_date, belowNorm: !!r.below_norm,
    normCutoff: r.norm_cutoff, normBand: r.norm_band, weightLb: r.weight_lb, bodyCompMethod: r.body_comp_method,
    asmKg: r.asm_kg, gripKg: r.grip_kg, domains: r.domains ? JSON.parse(r.domains) : null, reasons: r.reasons ? JSON.parse(r.reasons) : [],
    bodyCompDetail: r.body_comp_detail ? JSON.parse(r.body_comp_detail) : null,
  };
}

export function insertCheck(db, patientId, c, r) {
  db.prepare(`INSERT INTO checks (patient_id, created_at, stands, duration_sec, confidence, slept_poorly, pain_or_ill, lean_mass_lb,
    body_fat_pct, method, state, flagged, provider_flag, verdict, action, reason, retest_date, below_norm, norm_cutoff, norm_band,
    weight_lb, body_comp_method, asm_kg, grip_kg, domains, reasons, body_comp_detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    patientId, r.createdAt, c.stands, c.durationSec ?? 30, c.confidence ?? null, c.sleptPoorly ? 1 : 0, c.painOrIll ? 1 : 0,
    c.leanMassLb ?? null, c.bodyFatPct ?? null, c.method ?? 'phone-video', r.state, r.flagged ? 1 : 0, r.providerFlag ? 1 : 0,
    r.verdict, r.action, r.reason, r.retestDate, r.belowNorm ? 1 : 0, r.normCutoff, r.normBand,
    c.weightLb ?? null, c.bodyCompMethod ?? null, c.asmKg ?? null, c.gripKg ?? null, JSON.stringify(r.domains), JSON.stringify(r.reasons),
    c.bodyCompDetail ? JSON.stringify(c.bodyCompDetail) : null);
}
