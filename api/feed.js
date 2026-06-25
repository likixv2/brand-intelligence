const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACCOUNTS = ['karpathy','sama','paulg','emollick','naval','svpino'];

function classifyTweet(text) {
  const t = text.toLowerCase();
  if (t.includes('launch') || t.includes('ship') || t.includes('release') || t.includes('announc') || t.includes('introducing')) return 'launch';
  if (t.includes('study') || t.includes('research') || t.includes('paper') || t.includes('found that')) return 'insight';
  if (t.includes('wrong') || t.includes('unpopular') || t.includes('hot take') || t.includes('disagree')) return 'debate';
  return 'viral';
}

function processTweets(items) {
  return items
    .filter(item => {
      const text = item.text || item.full_text || item.tweetText || '';
      return text.length > 20 && !text.startsWith('RT @');
    })
    .map(item => {
      const text = item.text || item.full_text || item.tweetText || '';
      const handle = '@' + (item.author?.userName || item.author?.username || item.user?.screen_name || item.screenName || 'unknown');
      const tweetId = item.id || item.tweetId || item.id_str || '';
      const url = item.url || item.tweetUrl ||
        (tweetId ? `https://x.com/${handle.replace('@','')}/status/${tweetId}` : `https://x.com/${handle.replace('@','')}`);
      const createdAt = item.createdAt || item.created_at || item.timestamp_ms || '';
      const date = new Date(createdAt);
      const hoursAgo = isNaN(date.getTime()) ? 12 : Math.round((Date.now() - date.getTime()) / 3600000);
      const score = Math.max(0, 100 - hoursAgo * 2) + Math.min(30, text.length / 5);
      return { handle, text, url, hoursAgo, score: Math.round(score), sig: classifyTweet(text) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  if (!APIFY_TOKEN) {
    return res.status(200).json({ tweets: [], error: 'APIFY_TOKEN not set.' });
  }

  try {
    // Check for recent successful run (within 3 hours)
    const runsRes = await fetch(
      `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/runs?token=${APIFY_TOKEN}&limit=1&status=SUCCEEDED`,
      { signal: AbortSignal.timeout(8000) }
    );
    const runsData = await runsRes.json();
    const lastRun = runsData?.data?.items?.[0];

    if (lastRun) {
      const runAge = (Date.now() - new Date(lastRun.finishedAt).getTime()) / 3600000;
      if (runAge < 3) {
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${lastRun.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=100`,
          { signal: AbortSignal.timeout(8000) }
        );
        const items = await itemsRes.json();
        if (Array.isArray(items) && items.length > 0) {
          const tweets = processTweets(items);
          if (tweets.length > 0) {
            return res.status(200).json({ tweets, cached: true });
          }
        }
      }
    }

    // Start fresh run using startUrls (profile URLs)
    const startUrls = ACCOUNTS.map(a => ({ url: `https://x.com/${a}` }));
    await fetch(
      `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls,
          maxTweets: 5,
          queryType: 'Latest'
        }),
        signal: AbortSignal.timeout(8000)
      }
    );

    return res.status(200).json({
      tweets: [],
      error: 'Fetching fresh tweets from X — click Refresh in 1 minute!'
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, tweets: [] });
  }
};
