export type State = 'steady' | 'watch' | 'checkin';
export type Tier = 'higher' | 'standard';

export type Check = {
  id: number; createdAt: string; stands: number; durationSec: number; confidence: number | null;
  sleptPoorly: boolean; painOrIll: boolean; leanMassLb: number | null; bodyFatPct: number | null; method: string;
  state: State; flagged: boolean; providerFlag: boolean; verdict: string; action: string; reason: string;
  retestDate: string; belowNorm: boolean; normCutoff: number; normBand: string;
};

export type Patient = {
  id: string; providerCode: string; firstName: string; age: number; sex: 'female' | 'male' | 'other';
  menopause: string | null; medication: string | null; dose: string | null; startDate: string | null;
  startWeightLb: number | null; currentWeightLb: number | null; activity: string | null; falls: string | null;
  jointPain: string | null; goal: string | null; tier: Tier; tierReasons: string[]; createdAt: string;
  checks: Check[]; nextDue: string; checkEveryDays: number;
};

export type CheckResult = Omit<Check, 'id' | 'durationSec' | 'confidence' | 'sleptPoorly' | 'painOrIll' | 'leanMassLb' | 'bodyFatPct' | 'method'> & {
  changeSinceLast: number | null; changeSinceBaseline: number | null; normTable: string; normExtrapolated: boolean; patient: Patient;
};

export type ProviderPatient = {
  id: string; firstName: string; age: number; sex: string; medication: string | null; startDate: string | null;
  tier: Tier; state: State | null; flagged: boolean; lastCheck: string | null; recent: number[]; latest: number | null;
  belowNorm: boolean; normCutoff: number | null; normBand: string | null; overdue: boolean;
};
export type ProviderList = { code: string; name: string; patients: ProviderPatient[] };
