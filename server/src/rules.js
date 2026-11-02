import { normFor, gripCutoff, asmCutoff, LEAN_SHARE, MIN_WEIGHT_CHANGE, GRIP_DROP } from './norms.js';

// Draft clinical rules. Thresholds must be set with clinical advisors before launch.
export const TIERS = {
  higher: { checkEveryDays: 14, watchDrop: 1, checkinDrop: 3 },
  standard: { checkEveryDays: 28, watchDrop: 2, checkinDrop: 4 },
};
export const STATE_RANK = { checkin: 0, watch: 1, steady: 2 };
const worst = (...s) => s.filter(Boolean).sort((a, b) => STATE_RANK[a] - STATE_RANK[b])[0] ?? 'steady';

export const METHOD_LABEL = {
  'rise-scan': 'Rise phone scan', 'scan-app': 'phone body scan app', 'smart-scale': 'smart scale', dexa: 'DEXA scan', 'clinic-bia': 'clinic body composition scale', other: 'other device',
};

export function computeTier(p, today = new Date()) {
  const reasons = [];
  if (p.sex === 'female' && p.menopause === 'yes') reasons.push('Woman past menopause');
  if (p.age >= 65) reasons.push('Age 65 or older');
  if (p.falls === 'once' || p.falls === 'more') reasons.push(p.falls === 'more' ? 'More than one fall in the past year' : 'A fall in the past year');
  const weeks = (today - new Date(p.startDate)) / (7 * 864e5);
  if (p.startWeightLb > 0 && p.currentWeightLb > 0 && weeks >= 1) {
    const pctPerWeek = ((p.startWeightLb - p.currentWeightLb) / p.startWeightLb / weeks) * 100;
    if (pctPerWeek > 1) reasons.push(`Losing weight fast (${pctPerWeek.toFixed(1)}% a week)`);
  }
  return { tier: reasons.length ? 'higher' : 'standard', reasons };
}

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const monthName = (iso) => new Date(iso).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
const r1 = (n) => Math.round(n * 10) / 10;
const pct = (f) => `${Math.round(f * 100)}%`;
const sexWord = (sex) => (sex === 'male' ? 'men' : 'women');

function goalPhrase(goal) {
  if (!goal) return '';
  const g = goal.trim().replace(/\.$/, '').replace(/\bmy\b/gi, 'your').replace(/\bI\b/g, 'you').replace(/\bme\b/gi, 'you');
  return g.charAt(0).toLowerCase() + g.slice(1);
}

/** Leg strength: 30-second sit-to-stand against the patient's baseline and CDC STEADI norms. */
export function evaluateFunction(p, history, c) {
  const t = TIERS[p.tier] ?? TIERS.standard;
  const norm = normFor(p.age, p.sex);
  const first = history[0];
  const last = history[history.length - 1];
  const baseline = first ? first.stands : c.stands;
  const drop = baseline - c.stands;
  const belowNorm = c.stands < norm.cutoff;
  const newlyBelow = belowNorm && !(last && last.stands < norm.cutoff);
  const state = drop >= t.checkinDrop ? 'checkin' : drop >= t.watchDrop || newlyBelow ? 'watch' : 'steady';
  const normText = `CDC STEADI norm for ${sexWord(p.sex)} ${norm.band}: ${norm.cutoff} or more${norm.extrapolated ? ' (extrapolated; STEADI starts at 60)' : ''}`;
  const reasons = [];
  if (drop >= t.watchDrop) reasons.push(`Stands fell from ${baseline} to ${c.stands} since ${monthName(first.createdAt)}`);
  if (newlyBelow) reasons.push(`Newly below the ${normText}`);
  return {
    state, measured: true, value: c.stands, baseline, change: first ? c.stands - baseline : null,
    belowNorm, normCutoff: norm.cutoff, normBand: norm.band, normText, reasons,
    patientLine: !first ? `${c.stands} stands. This is your starting point.`
      : c.stands === baseline ? `${c.stands} stands, the same as when you started.`
      : `${c.stands} stands, ${c.stands > baseline ? 'up' : 'down'} ${Math.abs(c.stands - baseline)} since you started.`,
  };
}

/**
 * Muscle mass: what share of the weight lost since the first scan was lean mass. Only compares scans from
 * the same method, because devices disagree with each other far more than one device disagrees with itself.
 */
export function evaluateMass(p, history, c) {
  if (c.leanMassLb == null || c.weightLb == null) return { state: null, measured: false, reasons: [], patientLine: 'Not measured this time.' };
  const method = c.bodyCompMethod ?? 'other';
  const base = history.find((h) => h.leanMassLb != null && h.weightLb != null && (h.bodyCompMethod ?? 'other') === method);
  const reasons = [];
  let lowMuscle = false;
  if (c.asmKg != null && p.heightIn) {
    const m = p.heightIn * 0.0254;
    const idx = c.asmKg / (m * m);
    lowMuscle = idx < asmCutoff(p.sex);
    if (lowMuscle) reasons.push(`Appendicular muscle index ${r1(idx)} kg/m², below the EWGSOP2 cut-off for ${sexWord(p.sex)} (${asmCutoff(p.sex)})`);
  }
  const estimate = method === 'rise-scan';
  const out = { measured: true, method, methodLabel: METHOD_LABEL[method] ?? method, estimate, leanMassLb: c.leanMassLb, weightLb: c.weightLb, lowMuscle };
  if (!base) {
    return { ...out, state: lowMuscle ? 'watch' : 'steady', leanShare: null, baselineDate: null, reasons,
      patientLine: `Lean mass ${r1(c.leanMassLb)} lb. This is your starting point for the ${out.methodLabel}.` };
  }
  const dW = base.weightLb - c.weightLb;
  const dL = base.leanMassLb - c.leanMassLb;
  const enough = dW >= Math.max(MIN_WEIGHT_CHANGE.lb, MIN_WEIGHT_CHANGE.fraction * base.weightLb);
  if (!enough) {
    return { ...out, state: lowMuscle ? 'watch' : 'steady', leanShare: null, baselineDate: base.createdAt, weightLost: r1(dW), leanLost: r1(dL), reasons,
      patientLine: `Lean mass ${r1(c.leanMassLb)} lb. Not enough weight change yet to compare.` };
  }
  const share = Math.max(0, dL) / dW;
  const state = worst(share >= LEAN_SHARE.checkin ? 'checkin' : share >= LEAN_SHARE.watch ? 'watch' : 'steady', lowMuscle ? 'watch' : null);
  if (share >= LEAN_SHARE.watch) {
    reasons.push(`Lean mass was ${pct(share)} of weight lost since ${monthName(base.createdAt)} (${r1(dL)} of ${r1(dW)} lb, ${out.methodLabel}${estimate ? ', photo estimate' : ''}); GLP-1 trials report about 20–40%`);
  }
  return { ...out, state, leanShare: r1(share * 100) / 100, baselineDate: base.createdAt, weightLost: r1(dW), leanLost: r1(dL), reasons,
    patientLine: `About ${pct(share)} of the ${r1(dW)} lb you've lost was lean mass (mostly muscle and water). ${share >= LEAN_SHARE.watch ? 'That is more than we would like.' : 'That is in the expected range.'}` };
}

/** Grip strength (optional): EWGSOP2 cut-off and change from the patient's first grip. */
export function evaluateGrip(p, history, c) {
  if (c.gripKg == null) return { state: null, measured: false, reasons: [], patientLine: 'Not measured this time.' };
  const cutoff = gripCutoff(p.sex);
  const base = history.find((h) => h.gripKg != null);
  const low = c.gripKg < cutoff;
  const drop = base ? (base.gripKg - c.gripKg) / base.gripKg : 0;
  const state = worst(drop >= GRIP_DROP.checkin ? 'checkin' : drop >= GRIP_DROP.watch ? 'watch' : 'steady', low ? 'watch' : null);
  const reasons = [];
  if (low) reasons.push(`Grip ${r1(c.gripKg)} kg, below the EWGSOP2 cut-off for ${sexWord(p.sex)} (${cutoff} kg)`);
  if (drop >= GRIP_DROP.watch) reasons.push(`Grip fell ${pct(drop)} from ${r1(base.gripKg)} kg`);
  return {
    state, measured: true, value: c.gripKg, baseline: base?.gripKg ?? c.gripKg, low, cutoff, reasons,
    patientLine: !base ? `${r1(c.gripKg)} kg. This is your starting point.`
      : `${r1(c.gripKg)} kg, ${Math.abs(c.gripKg - base.gripKg) < 0.5 ? 'about the same as when you started' : `${c.gripKg > base.gripKg ? 'up' : 'down'} ${r1(Math.abs(c.gripKg - base.gripKg))} kg since you started`}.`,
  };
}

function actionFor(state, domains, p, flagged) {
  if (flagged) return 'Rest up and check again in a week. One tired or sore day can lower your results.';
  if (state === 'checkin') return 'Your care team will reach out this week. Until then, keep up gentle strength moves and protein at every meal.';
  const knees = p.jointPain === 'yes';
  const low = p.activity === 'rarely' || p.activity === 'some';
  const strength = knees ? 'the chair strength routine twice a week (gentle on your knees)' : low ? 'two 15-minute strength sessions a week' : 'a third strength session each week';
  if (state === 'steady') return knees ? 'Keep going: protein at every meal and your chair strength routine twice a week.' : 'Keep going: protein at every meal and two strength sessions a week.';
  if (domains.mass.state === 'watch') return `${p.firstName}, add protein at every meal, about a palm-sized portion, and ${strength}. Losing weight more slowly can also help; ask your care team.`;
  if (domains.grip.state === 'watch' && domains.function.state !== 'watch') return `${p.firstName}, add ${strength}, including carrying or pulling moves, and protein at every meal.`;
  return `${p.firstName}, try ${strength}, and aim for protein at every meal.`;
}

/**
 * Combine leg strength, muscle mass and (optional) grip into one result.
 * @param p patient; history: prior checks oldest first; c: this check
 */
export function evaluateCheck(p, history, c) {
  const t = TIERS[p.tier] ?? TIERS.standard;
  const createdAt = c.createdAt ?? new Date().toISOString();
  const domains = {
    function: evaluateFunction(p, history, c),
    mass: evaluateMass(p, history, c),
    grip: evaluateGrip(p, history, c),
  };
  const states = Object.values(domains).map((d) => d.state).filter(Boolean);
  const reasons = Object.values(domains).flatMap((d) => d.reasons);
  const watches = states.filter((s) => s === 'watch').length;
  const last = history[history.length - 1];
  const lowOnTwoStrengthTests = domains.function.belowNorm && domains.grip.low;

  let state = worst(...states);
  if (state !== 'checkin' && lowOnTwoStrengthTests) { state = 'checkin'; reasons.push('Low on both strength tests (chair stand and grip)'); }
  if (state !== 'checkin' && watches >= 2) { state = 'checkin'; reasons.push('Two measures changed at the same check'); }
  if (state === 'watch' && last && last.state === 'watch' && !last.flagged) { state = 'checkin'; reasons.push('Watch at two checks in a row'); }

  const flagged = Boolean(c.sleptPoorly || c.painOrIll) && state !== 'steady';
  if (flagged) state = 'watch';
  const providerFlag = state === 'checkin';

  const name = p.firstName;
  const verdict = flagged ? `${name}, let's try again soon.`
    : state === 'steady' ? `${name}, you're steady.`
    : state === 'watch' ? `${name}, let's adjust your plan.`
    : `${name}, your care team will check in.`;
  const goal = goalPhrase(p.goal);
  const NAMES = { function: 'leg strength', mass: 'body scan', grip: 'grip test' };
  const changed = Object.entries(domains).filter(([, d]) => d.measured && d.state && d.state !== 'steady').map(([k]) => NAMES[k]);
  const list = changed.length > 1 ? `${changed.slice(0, -1).join(', ')} and ${changed[changed.length - 1]}` : changed[0];
  let reason = !history.length ? 'This check sets your starting point. Each check from now on is compared with it.'
    : changed.length ? `Based on your ${list}.` : 'Your strength and muscle are holding steady.';
  if (goal && !flagged) reason += state === 'steady' ? ` That strength helps you ${goal}.` : ` Building strength now helps you ${goal}.`;

  return {
    createdAt, state, flagged, providerFlag, verdict, action: actionFor(state, domains, p, flagged), reason, reasons,
    retestDate: addDays(createdAt, flagged ? 7 : t.checkEveryDays),
    domains,
    // Kept at the top level for list views and exports.
    stands: c.stands, belowNorm: domains.function.belowNorm, normCutoff: domains.function.normCutoff, normBand: domains.function.normBand,
    changeSinceLast: last ? c.stands - last.stands : null, changeSinceBaseline: domains.function.change,
  };
}
