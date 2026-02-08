export default function normalizeUrl(url) {
  const u = (url || '').trim();
  if (!u) return '';

  // add scheme if missing
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  return u;
}
