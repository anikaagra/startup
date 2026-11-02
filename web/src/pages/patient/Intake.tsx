import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { api } from '../../lib/api';
import { session } from '../../lib/session';

type A = Record<string, string>;
type Step = { id: string; q: string; why: string; when?: (a: A) => boolean; render: (a: A, set: (k: string, v: string) => void) => React.ReactNode; valid: (a: A) => string | null };

function Choices({ name, value, options, onChange }: { name: string; value?: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="rise-choices" role="radiogroup">
      {options.map(([v, label]) => (
        <label className="rise-choice" key={v}>
          <input type="radio" name={name} id={`${name}-${v}`} checked={value === v} onChange={() => onChange(v)} /> {label}
        </label>
      ))}
    </div>
  );
}

const STEPS: Step[] = [
  { id: 'name', q: "What's your first name?", why: 'We use it in your results.', valid: (a) => (a.firstName?.trim() ? null : 'Please enter your first name.'),
    render: (a, s) => <div className="field"><label className="rise-label" htmlFor="firstName">First name</label><input id="firstName" autoComplete="given-name" value={a.firstName ?? ''} onChange={(e) => s('firstName', e.target.value)} /></div> },
  { id: 'age', q: 'How old are you?', why: 'Muscle and strength change with age, so we compare you with people your age.', valid: (a) => (+a.age >= 18 && +a.age <= 110 ? null : 'Please enter an age between 18 and 110.'),
    render: (a, s) => <div className="field"><label className="rise-label" htmlFor="age">Age</label><input id="age" className="rise-num" inputMode="numeric" value={a.age ?? ''} onChange={(e) => s('age', e.target.value.replace(/\D/g, ''))} /></div> },
  { id: 'sex', q: 'What sex were you assigned at birth?', why: 'Strength norms differ by sex.', valid: (a) => (a.sex ? null : 'Please choose an answer.'),
    render: (a, s) => <Choices name="sex" value={a.sex} onChange={(v) => s('sex', v)} options={[['female', 'Female'], ['male', 'Male'], ['other', 'Prefer not to say']]} /> },
  { id: 'menopause', q: 'Have you gone through menopause?', why: 'Muscle loss speeds up after menopause, so we check in more often.', when: (a) => a.sex === 'female', valid: (a) => (a.menopause ? null : 'Please choose an answer.'),
    render: (a, s) => <Choices name="menopause" value={a.menopause} onChange={(v) => s('menopause', v)} options={[['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure'], ['skip', 'Prefer not to say']]} /> },
  { id: 'med', q: 'Which GLP-1 medication do you take?', why: 'Your care team sees this next to your results.', valid: (a) => (a.medication ? (a.startDate ? null : 'Please enter when you started.') : 'Please choose your medication.'),
    render: (a, s) => (
      <div className="stack">
        <Choices name="medication" value={a.medication} onChange={(v) => s('medication', v)} options={[['semaglutide', 'Semaglutide (Ozempic, Wegovy)'], ['tirzepatide', 'Tirzepatide (Mounjaro, Zepbound)'], ['oral semaglutide', 'Oral semaglutide (Rybelsus)'], ['other', 'Other or not sure']]} />
        <div className="two-col">
          <div className="field"><label className="rise-label" htmlFor="dose">Dose (optional)</label><input id="dose" value={a.dose ?? ''} placeholder="e.g. 1 mg" onChange={(e) => s('dose', e.target.value)} /></div>
          <div className="field"><label className="rise-label" htmlFor="startDate">Started</label><input id="startDate" type="date" value={a.startDate ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => s('startDate', e.target.value)} /></div>
        </div>
      </div>) },
  { id: 'weight', q: 'What do you weigh now, and when you started?', why: 'Losing weight quickly raises the chance of losing muscle.', valid: (a) => (+a.currentWeightLb > 60 && +a.startWeightLb > 60 ? null : 'Please enter both weights in pounds.'),
    render: (a, s) => (
      <div className="two-col">
        <div className="field"><label className="rise-label" htmlFor="currentWeightLb">Now (lb)</label><input id="currentWeightLb" className="rise-num" inputMode="decimal" value={a.currentWeightLb ?? ''} onChange={(e) => s('currentWeightLb', e.target.value)} /></div>
        <div className="field"><label className="rise-label" htmlFor="startWeightLb">At start (lb)</label><input id="startWeightLb" className="rise-num" inputMode="decimal" value={a.startWeightLb ?? ''} onChange={(e) => s('startWeightLb', e.target.value)} /></div>
      </div>) },
  { id: 'activity', q: 'How active are you in a typical week?', why: 'We match your exercise suggestions to where you are now.', valid: (a) => (a.activity ? null : 'Please choose an answer.'),
    render: (a, s) => <Choices name="activity" value={a.activity} onChange={(v) => s('activity', v)} options={[['rarely', 'I rarely exercise'], ['some', 'Some walking or light activity'], ['regular', 'Exercise 2 to 3 times a week'], ['very', 'Strength training most weeks']]} /> },
  { id: 'falls', q: 'Have you fallen in the past year?', why: 'This helps us decide how often to check in with you.', valid: (a) => (a.falls ? null : 'Please choose an answer.'),
    render: (a, s) => <Choices name="falls" value={a.falls} onChange={(v) => s('falls', v)} options={[['none', 'No'], ['once', 'Once'], ['more', 'More than once'], ['skip', 'Prefer not to say']]} /> },
  { id: 'pain', q: 'Do knee, hip or back pain make standing up hard?', why: "If so, we'll suggest moves that are gentle on your joints.", valid: (a) => (a.jointPain ? null : 'Please choose an answer.'),
    render: (a, s) => <Choices name="jointPain" value={a.jointPain} onChange={(v) => s('jointPain', v)} options={[['no', 'No'], ['yes', 'Yes'], ['skip', 'Prefer not to say']]} /> },
  { id: 'goal', q: 'What do you want your strength for?', why: 'We remind you of this in your results.', valid: () => null,
    render: (a, s) => <div className="field"><label className="rise-label" htmlFor="goal">In your words (optional)</label><input id="goal" maxLength={120} placeholder="Keep up with my grandkids" value={a.goal ?? ''} onChange={(e) => s('goal', e.target.value)} /></div> },
  { id: 'code', q: "Enter your care team's code", why: 'This connects your results to your care team.', valid: (a) => (a.providerCode?.trim() ? null : 'Please enter the code from your care team.'),
    render: (a, s) => (
      <div className="stack">
        <div className="field"><label className="rise-label" htmlFor="providerCode">Care team code</label><input id="providerCode" className="rise-num" autoCapitalize="characters" value={a.providerCode ?? ''} onChange={(e) => s('providerCode', e.target.value.toUpperCase())} /></div>
        <p className="note">Trying Rise out? Use the demo code <b className="rise-num">DEMO42</b>.</p>
      </div>) },
];

export function Intake() {
  const nav = useNavigate();
  const [a, setA] = useState<A>({});
  const [i, setI] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const steps = STEPS.filter((s) => !s.when || s.when(a));
  const step = steps[i];
  const set = (k: string, v: string) => { setErr(null); setA((p) => ({ ...p, [k]: v })); };

  async function next() {
    const e = step.valid(a);
    if (e) return setErr(e);
    if (i < steps.length - 1) { setI(i + 1); window.scrollTo(0, 0); return; }
    setBusy(true);
    try {
      const p = await api.createPatient({ ...a, age: Number(a.age), startWeightLb: Number(a.startWeightLb), currentWeightLb: Number(a.currentWeightLb) });
      session.set(p.id);
      nav('/', { replace: true });
    } catch (ex) { setErr((ex as Error).message); setBusy(false); }
  }

  return (
    <Screen back={i > 0 ? undefined : { to: '/', label: 'Cancel' }}
      footer={<>
        <button className="rise-btn rise-btn--primary rise-btn--block" onClick={next} disabled={busy}>{i === steps.length - 1 ? (busy ? 'Setting up…' : 'Finish setup') : 'Next'}</button>
        {i > 0 && <button className="rise-btn rise-btn--quiet" onClick={() => { setErr(null); setI(i - 1); }}>Back</button>}
      </>}>
      <div className="rise-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label={`Question ${i + 1} of ${steps.length}`}>
        <span style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>
      <div className="stack">
        <div className="rise-label">Question {i + 1} of {steps.length}</div>
        <h1 className="display">{step.q}</h1>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); next(); }} className="stack">
        {step.render(a, set)}
        <button type="submit" hidden />
      </form>
      <p className="rise-caption" style={{ margin: 0 }}>{step.why}</p>
      <ErrorNote message={err} />
    </Screen>
  );
}
