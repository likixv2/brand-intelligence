const ACCOUNTS = ['karpathy','sama','paulg','emollick','lennysan','naval','svpino','rowancheung'];

const RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rss.shab.fun',
  'https://rsshub.rssforever.com'
];

async function fetchRSS(account) {
  for (const instance of RSSHUB_INSTANCES) {
    try {
      const url = `${instance}/twitter/user/${account}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandIntel/1.0)' },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (xml.includes('<item>')) return { xml, account };
    } catch (e) {
      continue;
    }
  }
  // fallback: try nitter
  const NITTER = ['https://nitter.privacydev.net','https://nitter.poast.org','https://lightbrd.com','https://nitter.mint.lgbt'];
  for (const n of NITTER) {
    try {
      const res = await fetch(`${n}/${account}/rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (xml.includes('<item>')) return { xml, account };
    } catch(e) { continue; }
  }
  return null;
}

function parseItems(xml, account) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || '';
    const link = (item.match(/<link>([\s\S]*?)<\/link>/) || item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() || '';
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
    if (!title || title.startsWith('RT by') || title.startsWith('R to')) continue;
    const text = title.replace(/^@\w+:\s*/, '').replace(/<[^>]+>/g, '').trim();
    if (!text || text.length < 20) continue;
    // convert any domain to x.com link
    let tweetUrl = link.replace(/https?:\/\/[^/]*(nitter|rsshub)[^/]*\//, 'https://x.com/');
    if (!tweetUrl.includes('x.com') && !tweetUrl.includes('twitter.com')) {
      tweetUrl = `https://x.com/${account}`;
    }
    const date = new Date(pubDate);
    const hoursAgo = isNaN(date) ? 24 : (Date.now() - date.getTime()) / 3600000;
    const score = Math.max(0, 100 - hoursAgo * 2) + Math.min(30, text.length / 5);
    items.push({ handle: '@' + account, text, url: tweetUrl, hoursAgo: Math.round(hoursAgo), score: Math.round(score) });
  }
  return items.slice(0, 3);
}

function classifyTweet(text) {
  const t = text.toLowerCase();
  if (t.includes('launch') || t.includes('ship') || t.includes('release') || t.includes('announc') || t.includes('introducing') || t.includes('new model')) return 'launch';
  if (t.includes('study') || t.includes('research') || t.includes('paper') || t.includes('found that') || t.includes('data shows')) return 'insight';
  if (t.includes('wrong') || t.includes('unpopular') || t.includes('hot take') || t.includes('disagree') || t.includes('controversial')) return 'debate';
  return 'viral';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600');
  try {
    const results = await Promise.allSettled(ACCOUNTS.map(fetchRSS));
    let allTweets = [];
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { xml, account } = result.value;
      allTweets = allTweets.concat(parseItems(xml, account));
    }
    allTweets.sort((a, b) => b.score - a.score);
    allTweets = allTweets.map(t => ({ ...t, sig: classifyTweet(t.text) }));
    if (allTweets.length === 0) {
      return res.status(200).json({ tweets: [], error: 'All RSS sources are temporarily down. Try again in a few minutes.' });
    }
    return res.status(200).json({ tweets: allTweets.slice(0, 15) });
  } catch (e) {
    return res.status(500).json({ error: e.message, tweets: [] });
  }
};
