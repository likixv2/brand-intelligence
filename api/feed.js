const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACCOUNTS = ['karpathy','sama','paulg','emollick','lennysan','naval','svpino','rowancheung'];

function classifyTweet(text) {
  const t = text.toLowerCase();
  if (t.includes('launch') || t.includes('ship') || t.includes('release') || t.includes('announc') || t.includes('introducing') || t.includes('new model')) return 'launch';
  if (t.includes('study') || t.includes('research') || t.includes('paper') || t.includes('found that') || t.includes('data shows')) return 'insight';
  if (t.includes('wrong') || t.includes('unpopular') || t.includes('hot take') || t.includes('disagree') || t.includes('controversial')) return 'debate';
  return 'viral';
}

async function runActor(actorId, input) {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=25`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(28000)
    }
  );
  if (!runRes.ok) return [];
  return await runRes.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600');

  if (!APIFY_TOKEN) {
    return res.status(200).json({ tweets: [], error: 'APIFY_TOKEN env variable not set.' });
  }

  try {
    // Use twitter-profile-scraper — first 40 tweets free per profile
    const items = await runActor('apidojo~twitter-profile-scraper', {
      twitterHandles: ACCOUNTS,
      maxTweets: 5
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      // fallback: try tweet-scraper with search queries
      const searchItems = await runActor('apidojo~tweet-scraper', {
        searchTerms: ACCOUNTS.map(a => 'from:' + a),
        maxTweets: 3,
        queryType: 'Latest'
      });
      if (!searchItems || searchItems.length === 0) {
        return res.status(200).json({ tweets: [], error: 'No tweets returned. Apify credits may be exhausted or actor input mismatch.' });
      }
      return processTweets(searchItems, res);
    }

    return processTweets(items, res);
  } catch (e) {
    return res.status(500).json({ error: e.message, tweets: [] });
  }
};

function processTweets(items, res) {
  let tweets = items
    .filter(item => {
      const text = item.text || item.full_text || item.tweetText || '';
      return text.length > 20 && !text.startsWith('RT @');
    })
    .map(item => {
      const text = item.text || item.full_text || item.tweetText || '';
      const handle = '@' + (item.author?.userName || item.user?.screen_name || item.screenName || item.authorScreenName || 'unknown');
      const tweetId = item.id || item.tweetId || item.id_str || '';
      const url = item.url || item.tweetUrl || (tweetId ? `https://x.com/${handle.replace('@','')}/status/${tweetId}` : `https://x.com/${handle.replace('@','')}`);
      const createdAt = item.createdAt || item.created_at || item.timestamp || '';
      const date = new Date(createdAt);
      const hoursAgo = isNaN(date.getTime()) ? 12 : Math.round((Date.now() - date.getTime()) / 3600000);
      const score = Math.max(0, 100 - hoursAgo * 2) + Math.min(30, text.length / 5);
      return { handle, text, url, hoursAgo, score: Math.round(score), sig: classifyTweet(text) };
    });

  tweets.sort((a, b) => b.score - a.score);
  return res.status(200).json({ tweets: tweets.slice(0, 15) });
}
