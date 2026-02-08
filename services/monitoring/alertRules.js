export function shouldAlert(diff) {
  // Alert if any new MEDIUM/HIGH appears, or if a severity increases
  const newImportant = diff.added.some(
    (f) => f.severity === 'HIGH' || f.severity === 'MEDIUM'
  );
  const severityUp = diff.severityChanged.some(
    (c) => c.after === 'HIGH' || c.after === 'MEDIUM'
  );
  return newImportant || severityUp || diff.resolved.length > 0;
}
