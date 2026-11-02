// Record-ready export: one entry per check with its observations. Shared by the server and the web demo build.
export function toExport(p) {
  return {
      patient: { id: p.id, firstName: p.firstName, age: p.age, sex: p.sex, tier: p.tier, tierReasons: p.tierReasons },
      checks: p.checks.map((c) => ({
        date: c.createdAt.slice(0, 10), overallState: c.state, readinessFlag: c.flagged, reasons: c.reasons, actionGiven: c.action,
        observations: [
          { measure: '30-second chair stand', value: c.stands, unit: 'repetitions', method: c.method, captureConfidence: c.confidence,
            state: c.domains?.function?.state ?? c.state, belowAgeSexNorm: c.belowNorm, normCutoff: c.normCutoff, normReference: `CDC STEADI ${c.normBand}` },
          ...(c.weightLb != null ? [{ measure: 'Body weight', value: c.weightLb, unit: 'lb' }] : []),
          ...(c.leanMassLb != null ? [{ measure: 'Lean (fat-free) mass', value: c.leanMassLb, unit: 'lb', method: c.bodyCompMethod,
            state: c.domains?.mass?.state ?? null, leanShareOfWeightLost: c.domains?.mass?.leanShare ?? null }] : []),
          ...(c.bodyFatPct != null ? [{ measure: 'Body fat', value: c.bodyFatPct, unit: '%', method: c.bodyCompMethod }] : []),
          ...(c.asmKg != null ? [{ measure: 'Appendicular lean mass', value: c.asmKg, unit: 'kg', method: c.bodyCompMethod }] : []),
          ...(c.gripKg != null ? [{ measure: 'Handgrip strength', value: c.gripKg, unit: 'kg', state: c.domains?.grip?.state ?? null,
            belowCutoff: c.domains?.grip?.low ?? null, cutoffReference: 'EWGSOP2' }] : []),
        ],
      })),
  };
}
