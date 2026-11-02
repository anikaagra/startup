import { normFor } from './norms.js';

// Draft clinical rules from screens.md. Thresholds must be set with clinical advisors before launch.
export const TIERS = {
  higher: { checkEveryDays: 14, watchDrop: 1, checkinDrop: 3 },
  standard: { checkEveryDays: 28, watchDrop: 2, checkinDrop: 4 },
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

function goalPhrase(goal) {
  if (!goal) return '';
  const g = goal.trim().replace(/\.$/, '')
    .replace(/\bmy\b/gi, 'your').replace(/\bI\b/g, 'you').replace(/\bme\b/gi, 'you');
  return g.charAt(0).toLowerCase() + g.slice(1);
}

function actionFor(state, p, flagged) {
  if (flagged) return 'Rest up and check again in a week. One tired or sore day can lower your count.';
  const knees = p.jointPain === 'yes';
  const low = p.activity === 'rarely' || p.activity === 'some';
  if (state === 'steady') {
    return knees
      ? 'Keep going: protein at every meal and your chair strength routine twice a week.'
      : 'Keep going: protein at every meal and two strength sessions a week.';
  }
  if (state === 'watch') {
    if (knees) return `${p.firstName}, try the chair strength routine twice a week. It's gentle on your knees. Add protein at every meal.`;
    if (low) return `${p.firstName}, start with two 15-minute strength sessions a week, and add protein at every meal.`;
    return `${p.firstName}, add a third strength session each week, and aim for protein at every meal.`;
  }
  return 'Your care team will reach out this week. Until then, keep up gentle strength moves and protein at every meal.';
}

/**
 * Evaluate one sit-to-stand check against the patient's history.
 * @param {object} p patient (camelCase)
 * @param {Array<{stands:number,createdAt:string,state:string,flagged:boolean}>} history prior checks, oldest first
 * @param {{stands:number,createdAt?:string,sleptPoorly?:boolean,painOrIll?:boolean,confidence?:number}} c this check
 */
export function evaluateCheck(p, history, c) {
  const t = TIERS[p.tier] ?? TIERS.standard;
  const createdAt = c.createdAt ?? new Date().toISOString();
  const norm = normFor(p.age, p.sex);
  const first = history[0];
  const last = history[history.length - 1];
  const baseline = first ? first.stands : c.stands;
  const drop = baseline - c.stands;
  const belowNorm = c.stands < norm.cutoff;
  const lastBelow = last ? last.stands < norm.cutoff : false;
  const newlyBelow = belowNorm && !lastBelow;

  let state = 'steady';
  if (drop >= t.checkinDrop) state = 'checkin';
  else if (drop >= t.watchDrop || newlyBelow) {
    state = last && last.state === 'watch' && !last.flagged ? 'checkin' : 'watch';
  }

  const flagged = Boolean(c.sleptPoorly || c.painOrIll) && state !== 'steady';
  if (flagged) state = 'watch';
  const providerFlag = state === 'checkin';

  const retestDays = flagged ? 7 : t.checkEveryDays;
  const name = p.firstName;
  const verdict = flagged ? `${name}, let's try again soon.`
    : state === 'steady' ? `${name}, you're steady.`
    : state === 'watch' ? `${name}, let's adjust your plan.`
    : `${name}, your care team will check in.`;

  let reason;
  if (!first) reason = `This is your starting point: ${c.stands} stands in 30 seconds.`;
  else if (c.stands === baseline) reason = `${c.stands} stands, the same as when you started in ${monthName(first.createdAt)}.`;
  else reason = `Your stands went from ${baseline} to ${c.stands} since ${monthName(first.createdAt)}.`;
  const goal = goalPhrase(p.goal);
  if (goal && !flagged) reason += state === 'steady' ? ` That strength helps you ${goal}.` : ` Building strength now helps you ${goal}.`;

  return {
    stands: c.stands, createdAt, state, flagged, providerFlag,
    verdict, action: actionFor(state, p, flagged), reason,
    retestDate: addDays(createdAt, retestDays),
    belowNorm, normCutoff: norm.cutoff, normBand: norm.band, normTable: norm.table, normExtrapolated: norm.extrapolated,
    changeSinceLast: last ? c.stands - last.stands : null,
    changeSinceBaseline: first ? c.stands - baseline : null,
  };
}

export const STATE_RANK = { checkin: 0, watch: 1, steady: 2 };
