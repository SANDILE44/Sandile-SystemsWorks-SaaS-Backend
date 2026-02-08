export async function fetchUrl(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  const headers = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const text = await res.text().catch(() => '');
  return { status: res.status, url: res.url, headers, body: text };
}
