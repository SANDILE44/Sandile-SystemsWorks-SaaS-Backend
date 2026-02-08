import { fetchUrl } from './httpFetch.js';

export async function checkFootprint(baseUrl) {
  const findings = [];

  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString();

  const robots = await fetchUrl(robotsUrl).catch(() => null);
  if (!robots || robots.status >= 400) {
    findings.push({
      key: 'robots_missing',
      title: 'robots.txt not reachable',
      severity: 'LOW',
      details:
        'robots.txt could not be reached. Not always required, but common for public sites.',
      evidence: robotsUrl,
    });
  }

  const sitemap = await fetchUrl(sitemapUrl).catch(() => null);
  if (!sitemap || sitemap.status >= 400) {
    findings.push({
      key: 'sitemap_missing',
      title: 'sitemap.xml not reachable',
      severity: 'LOW',
      details:
        'sitemap.xml could not be reached. Not always required, but helpful for indexing/visibility.',
      evidence: sitemapUrl,
    });
  }

  return findings;
}
