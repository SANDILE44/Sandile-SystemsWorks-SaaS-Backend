import cron from 'node-cron';
import Website from '../../models/Website.js';
import ScanResult from '../../models/ScanResult.js';

import { fetchUrl } from '../scanner/httpFetch.js';
import { checkSecurityHeaders } from '../scanner/headersCheck.js';
import { checkCookies } from '../scanner/cookieCheck.js';
import { checkFootprint } from '../scanner/footprintCheck.js';
import { scoreFindings } from '../scanner/scoring.js';

import { diffScans } from './diffEngine.js';
import { shouldAlert } from './alertRules.js';
import { sendAlertEmail } from '../email/mailer.js';

export function startScheduler() {
  const hours = Number(process.env.SCAN_INTERVAL_HOURS || 24);

  // Runs every N hours (cron doesn't support "every N hours" directly cleanly),
  // so Phase 1 simple approach: run every hour and only execute if hour % N === 0.
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const h = now.getHours();

      if (hours > 1 && h % hours !== 0) return;

      console.log(
        `[scheduler] Running scheduled scans at ${now.toISOString()}`
      );

      const websites = await Website.find({ status: 'active' }).limit(500);

      for (const website of websites) {
        const prevScan = await ScanResult.findOne({
          websiteId: website._id,
        }).sort({ scannedAt: -1 });

        const main = await fetchUrl(website.url);

        const findings = [];
        findings.push(...checkSecurityHeaders(main.headers));
        findings.push(...checkCookies(main.headers));
        findings.push(...(await checkFootprint(main.url)));

        if (!String(main.url).toLowerCase().startsWith('https://')) {
          findings.push({
            key: 'https_missing',
            title: 'HTTPS not enforced',
            severity: 'HIGH',
            details:
              'Site did not resolve to HTTPS. HTTPS is required to protect traffic in transit.',
            evidence: main.url,
          });
        }

        const { score, level } = scoreFindings(findings);
        const summary =
          level === 'LOW'
            ? 'Low risk based on public checks.'
            : level === 'MEDIUM'
              ? 'Medium risk: improvements recommended.'
              : 'High risk: prioritize fixes.';

        const scan = await ScanResult.create({
          websiteId: website._id,
          scannedAt: new Date(),
          findings,
          score,
          level,
          summary,
        });

        const diff = diffScans(prevScan, scan);

        if (shouldAlert(diff)) {
          const subject = `Risk Monitor update for ${website.url}: ${scan.level} (score ${scan.score})`;
          const text = `Scheduled scan update
Website: ${website.url}
Scanned: ${scan.scannedAt.toISOString()}
Overall: ${scan.level} (score ${scan.score})
New issues: ${diff.added.length}
Resolved issues: ${diff.resolved.length}
Severity changes: ${diff.severityChanged.length}
`;
          await sendAlertEmail({ to: 'dev@local', subject, text });
        }
      }
    } catch (err) {
      console.error('[scheduler] Failed:', err);
    }
  });

  console.log(`[scheduler] Enabled. Interval hours: ${hours}`);
}
