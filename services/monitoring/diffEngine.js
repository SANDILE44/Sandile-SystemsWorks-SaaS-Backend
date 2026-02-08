function keyMap(findings = []) {
  const map = new Map();
  for (const f of findings) map.set(f.key, f);
  return map;
}

export function diffScans(prevScan, nextScan) {
  const prev = keyMap(prevScan?.findings || []);
  const next = keyMap(nextScan?.findings || []);

  const added = [];
  const resolved = [];
  const severityChanged = [];

  for (const [key, nf] of next.entries()) {
    if (!prev.has(key)) {
      added.push(nf);
      continue;
    }
    const pf = prev.get(key);
    if (pf.severity !== nf.severity) {
      severityChanged.push({
        key,
        before: pf.severity,
        after: nf.severity,
        title: nf.title,
      });
    }
  }

  for (const [key, pf] of prev.entries()) {
    if (!next.has(key)) resolved.push(pf);
  }

  return { added, resolved, severityChanged };
}
