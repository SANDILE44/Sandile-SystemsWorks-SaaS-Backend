const REQUIRED_HEADERS = [
  { key: 'strict-transport-security', name: 'HSTS' },
  { key: 'content-security-policy', name: 'CSP (presence only)' },
  { key: 'x-frame-options', name: 'X-Frame-Options' },
  { key: 'x-content-type-options', name: 'X-Content-Type-Options' },
  { key: 'referrer-policy', name: 'Referrer-Policy' },
  { key: 'permissions-policy', name: 'Permissions-Policy' },
];

export function checkSecurityHeaders(headers) {
  const findings = [];

  for (const h of REQUIRED_HEADERS) {
    const present = !!headers[h.key];
    if (!present) {
      findings.push({
        key: `missing_${h.key}`,
        title: `Missing security header: ${h.name}`,
        severity: 'MEDIUM',
        details: `${h.name} header is not present. This can reduce browser-level protection.`,
        evidence: '',
      });
    }
  }

  // info leakage
  if (headers['server']) {
    findings.push({
      key: 'server_header_present',
      title: 'Server header present (info leakage)',
      severity: 'LOW',
      details:
        'The Server header is present and may reveal technology details.',
      evidence: `server: ${headers['server']}`,
    });
  }

  return findings;
}
