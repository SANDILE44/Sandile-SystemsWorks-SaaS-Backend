export function checkCookies(headers) {
  const findings = [];
  const setCookie = headers['set-cookie'];

  // If no cookies visible in response headers, that's not automatically bad
  if (!setCookie) return findings;

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

  for (const c of cookies) {
    const lower = c.toLowerCase();
    const missing = [];

    if (!lower.includes('secure')) missing.push('Secure');
    if (!lower.includes('httponly')) missing.push('HttpOnly');
    if (!lower.includes('samesite')) missing.push('SameSite');

    if (missing.length) {
      findings.push({
        key: 'cookie_flags_missing',
        title: 'Cookie flags missing',
        severity: 'MEDIUM',
        details: `Some cookies are missing recommended flags: ${missing.join(', ')}.`,
        evidence: c.slice(0, 200),
      });
      break; // keep Phase 1 simple: one finding is enough
    }
  }

  return findings;
}
