const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACCOUNTS = ['karpathy', 'sama', 'paulg', 'emollick', 'lennysan', 'naval', 'svpino', 'rowancheung'];

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
    // Start Apify actor run
    const runRes = await fetch(
      'https://api.apify.com/v2/acts/apidojo~tweet-scraper/runs?token=' + APIFY_TOKEN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitterHandles: ACCOUNTS,
          maxTweets: 5,
          addUserInfo: false,
          startUrls: []
        }),
        signal: AbortSignal.timeout(25000)
      }
    );

    const runData = await runRes.json();
    const runId = runData?.data?.id;

    if (!runId) {
      return res.status(200).json({ tweets: [], error: 'Could not start Apify run: ' + JSON.stringify(runData) });
    }

    // Wait for run to finish (poll every 3 seconds, max 20 seconds)
    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' && attempts < 7) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(
        `https://api.apify.com/v2/acts/apidojo~tweet-scraper/runs/${runId}?token=${APIFY_TOKEN}`
      );
      const statusData = await statusRes.json();
      status = statusData?.data?.status;
      attempts++;
    }

    // Fetch results from dataset
    const dataRes = await fetch(
      `https://api.apify.com/v2/acts/apidojo~tweet-scraper/runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=50`
    );
    const items = await dataRes.json();

    if (!items || !items.length) {
      return res.status(200).json({ tweets: [], error: 'No tweets returned from Apify.' });
    }

    let tweets = items
      .filter(item => item.text && item.text.length > 20 && !item.text.startsWith('RT @'))
      .map(item => {
        const handle = '@' + (item.author?.userName || item.user?.screen_name || 'unknown');
        const text = item.text || '';
        const url = item.url || item.tweetUrl || `https://x.com/${handle.replace('@', '')}/status/${item.id}`;
        const createdAt = item.createdAt || item.created_at || '';
        const date = new Date(createdAt);
        const hoursAgo = isNaN(date) ? 12 : Math.round((Date.now() - date.getTime()) / 3600000);
        const score = Math.max(0, 100 - hoursAgo * 2) + Math.min(30, text.length / 5);
        return { handle, text, url, hoursAgo, score: Math.round(score), sig: classifyTweet(text) };
      });

    tweets.sort((a, b) => b.score - a.score);

    return res.status(200).json({ tweets: tweets.slice(0, 15) });

  } catch (e) {
    return res.status(500).json({ error: e.message, tweets: [] });
  }
};
