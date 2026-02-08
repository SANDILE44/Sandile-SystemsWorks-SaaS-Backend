const IMPACT = {
  HIGH: 'High impact: could expose users, sessions, or critical data if combined with other weaknesses.',
  MEDIUM:
    'Medium impact: reduces browser-level protection and increases risk in common real-world scenarios.',
  LOW: 'Low impact: mostly informational or best-practice improvement.',
};

const VERIFY = {
  'missing_strict-transport-security':
    'Open DevTools → Network → reload → click the main request → Response Headers. Look for Strict-Transport-Security.',
  'missing_content-security-policy':
    'Open DevTools → Network → reload → Response Headers. Look for Content-Security-Policy.',
  'missing_x-frame-options':
    'Open DevTools → Network → reload → Response Headers. Look for X-Frame-Options.',
  'missing_x-content-type-options':
    'Open DevTools → Network → reload → Response Headers. Look for X-Content-Type-Options.',
  'missing_referrer-policy':
    'Open DevTools → Network → reload → Response Headers. Look for Referrer-Policy.',
  'missing_permissions-policy':
    'Open DevTools → Network → reload → Response Headers. Look for Permissions-Policy.',
  server_header_present:
    'Open DevTools → Network → reload → Response Headers. Look for Server.',
  cookie_flags_missing:
    'Open DevTools → Application → Cookies. Check Secure / HttpOnly and SameSite attributes.',
  robots_missing:
    'Open https://yourdomain/robots.txt in a browser and confirm if it loads.',
  sitemap_missing:
    'Open https://yourdomain/sitemap.xml in a browser and confirm if it loads.',
  https_missing:
    'Try opening the site with http:// and see if it redirects to https:// automatically.',
};

function bucket(findings) {
  const by = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const f of findings || []) {
    if (by[f.severity]) by[f.severity].push(f);
  }
  return by;
}

function priorityOrder(a, b) {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
}

export function buildPlainEnglishReport({ websiteUrl, scan }) {
  const findings = [...(scan.findings || [])].sort(priorityOrder);
  const grouped = bucket(findings);

  // ✅ Build "whatsGood" OUTSIDE the report object
  const good = [];
  if (findings.length === 0) {
    good.push('No issues detected in this scan.');
  } else {
    if (grouped.HIGH.length === 0)
      good.push('No HIGH-severity issues detected.');
    if (grouped.MEDIUM.length === 0)
      good.push('No MEDIUM-severity issues detected.');
    if (grouped.LOW.length === 0) good.push('No LOW-severity issues detected.');
  }

  // If overall is HIGH but there are no HIGH-severity items, be transparent
  if (scan.level === 'HIGH' && grouped.HIGH.length === 0) {
    good.push(
      'Note: overall risk is HIGH due to multiple medium issues combined.'
    );
  }

  const whatToFixFirst = findings.slice(0, 5).map((f) => ({
    title: f.title,
    severity: f.severity,
    whyItMatters: IMPACT[f.severity] || '',
    howToVerify:
      VERIFY[f.key] ||
      'Check using browser DevTools (Network → Response Headers) or a public header checker.',
  }));

  const report = {
    website: websiteUrl,
    generatedAt: new Date().toISOString(),
    scanId: String(scan._id),
    scannedAt: scan.scannedAt,

    overall: {
      score: scan.score,
      level: scan.level,
      summary: scan.summary,
    },

    // ✅ Correct usage
    whatsGood: good,

    whatsRisky: findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      details: f.details,
      evidence: f.evidence || '',
    })),

    whyItMatters: {
      HIGH: IMPACT.HIGH,
      MEDIUM: IMPACT.MEDIUM,
      LOW: IMPACT.LOW,
    },

    whatToFixFirst,

    verificationGuidance: findings.map((f) => ({
      title: f.title,
      howToVerify:
        VERIFY[f.key] ||
        'Use DevTools (Network → Response Headers) or a public checker to confirm.',
    })),
  };

  return report;
}
