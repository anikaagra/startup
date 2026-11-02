export type State = 'steady' | 'watch' | 'checkin';
export type Tier = 'higher' | 'standard';

export type Check = {
  id: number; createdAt: string; stands: number; durationSec: number; confidence: number | null;
  sleptPoorly: boolean; painOrIll: boolean; leanMassLb: number | null; bodyFatPct: number | null; method: string;
  state: State; flagged: boolean; providerFlag: boolean; verdict: string; action: string; reason: string;
  retestDate: string; belowNorm: boolean; normCutoff: number; normBand: string;
  weightLb: number | null; bodyCompMethod: BodyCompMethod | null; asmKg: number | null; gripKg: number | null;
  bodyCompDetail: Record<string, unknown> | null;
  domains: Domains | null; reasons: string[];
};

export type BodyCompMethod = 'rise-scan' | 'scan-app' | 'smart-scale' | 'dexa' | 'clinic-bia' | 'other';
export type Domain = { state: State | null; measured: boolean; patientLine: string; reasons: string[] };
export type Domains = {
  function: Domain & { value: number; baseline: number; change: number | null; belowNorm: boolean; normCutoff: number; normBand: string; normText: string };
  mass: Domain & { method?: BodyCompMethod; methodLabel?: string; leanMassLb?: number; weightLb?: number; leanShare?: number | null; weightLost?: number; leanLost?: number; lowMuscle?: boolean; baselineDate?: string | null };
  grip: Domain & { value?: number; baseline?: number; low?: boolean; cutoff?: number };
};

export type Patient = {
  id: string; providerCode: string; firstName: string; age: number; sex: 'female' | 'male' | 'other';
  menopause: string | null; medication: string | null; dose: string | null; startDate: string | null;
  startWeightLb: number | null; currentWeightLb: number | null; activity: string | null; falls: string | null;
  jointPain: string | null; goal: string | null; heightIn: number | null; tier: Tier; tierReasons: string[]; createdAt: string;
  checks: Check[]; nextDue: string; checkEveryDays: number;
};

export type CheckResult = Pick<Check, 'createdAt' | 'stands' | 'state' | 'flagged' | 'providerFlag' | 'verdict' | 'action' | 'reason' | 'retestDate' | 'belowNorm' | 'normCutoff' | 'normBand' | 'reasons'> & {
  domains: Domains;
  changeSinceLast: number | null; changeSinceBaseline: number | null; patient: Patient;
};

export type ProviderPatient = {
  id: string; firstName: string; age: number; sex: string; medication: string | null; startDate: string | null;
  tier: Tier; state: State | null; flagged: boolean; lastCheck: string | null; recent: number[]; latest: number | null;
  belowNorm: boolean; normCutoff: number | null; normBand: string | null; overdue: boolean;
  massState: State | null; leanShare: number | null; gripState: State | null; gripKg: number | null; reasons: string[];
};
export type ProviderList = { code: string; name: string; patients: ProviderPatient[] };
