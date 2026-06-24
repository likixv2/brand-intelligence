# Brand Intelligence — AI Content System
> Full 4-layer personal brand system. Completely free to deploy.

## What this does
- **Layer 1 · Persona** — journals your voice, AI extracts tone/style/themes
- **Layer 2 · Monitor** — high-signal X feed, no scrolling needed
- **Layer 3 · Compose** — writes tweets in your voice via Groq (free LLM)
- **Layer 4 · Stories** — curates tweets into Instagram Story cards

---

## Deploy in 5 minutes (100% free)

### Step 1 — Get your free Groq API key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free, no credit card)
3. Click **API Keys → Create API Key**
4. Copy it — looks like `gsk_...`

### Step 2 — Put the code on GitHub
1. Go to [github.com/new](https://github.com/new)
2. Create a new repo (e.g. `brand-intelligence`)
3. Upload these files: drag and drop the whole folder
4. Click **Commit changes**

### Step 3 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → sign up with GitHub (free)
2. Click **Add New Project**
3. Import your `brand-intelligence` repo
4. Click **Deploy** — done in ~30 seconds
5. You get a live URL like `brand-intelligence.vercel.app`

### Step 4 — Use it
1. Open your live URL
2. Paste your Groq API key in the sidebar (bottom left)
3. Start with Layer 1 — journal something
4. Move through the layers

---

## Free stack used
| What | Tool | Cost |
|------|------|------|
| Hosting | Vercel | Free |
| LLM (AI calls) | Groq — Llama 3.3 70B | Free |
| Code storage | GitHub | Free |
| Delivery (optional) | Telegram Bot API | Free |

---

## Optional: Real X monitoring (also free)
The feed is currently curated examples. To make it pull real tweets:

### Option A — Nitter RSS (easiest, zero code)
1. Go to `https://nitter.net/USERNAME/rss` for any account
2. Use a free RSS reader like [Feedly](https://feedly.com) to monitor
3. Paste interesting tweets into Layer 2 manually

### Option B — Apify (5 free runs/month)
1. Sign up at [apify.com](https://apify.com)
2. Use the free **Twitter Scraper** actor
3. Schedule it to run daily and output to a webhook

---

## Optional: Telegram delivery bot (free)
To get Story cards sent to your phone automatically:

1. Message `@BotFather` on Telegram → `/newbot`
2. Copy your bot token
3. Message your bot once, then get your chat ID from:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Add this to `index.html` in the "Approve" button handler:

```javascript
async function sendToTelegram(storyText) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: YOUR_CHAT_ID,
      text: storyText,
      parse_mode: 'HTML'
    })
  });
}
```

---

## File structure
```
brand-intelligence/
├── public/
│   └── index.html    ← entire app, one file
├── vercel.json       ← deploy config
└── README.md
```

---

## Upgrade path (when you have budget)
- Replace Groq with Claude API for better voice matching
- Add X API ($100/mo) for real-time monitoring  
- Add a database (Supabase free tier) to save your journal entries
- Add auth (Clerk free tier) for multi-user support
