// scoring.js
// Phase 1 scoring: simple, explainable, avoids hitting 0 too easily.

const PENALTY = {
  HIGH: 30,
  MEDIUM: 10,
  LOW: 3,
};

// Cap penalties so score stays meaningful (progress feels real)
const MAX_TOTAL_DEDUCTION = 70; // score won't go below 30

export function scoreFindings(findings = []) {
  let deduction = 0;

  for (const f of findings) {
    deduction += PENALTY[f.severity] ?? 0;
  }

  if (deduction > MAX_TOTAL_DEDUCTION) deduction = MAX_TOTAL_DEDUCTION;

  const score = Math.max(100 - deduction, 0);

  // Level thresholds (simple + consistent)
  // 80-100 LOW, 50-79 MEDIUM, 0-49 HIGH
  let level = 'LOW';
  if (score < 50) level = 'HIGH';
  else if (score < 80) level = 'MEDIUM';

  return { score, level };
}
