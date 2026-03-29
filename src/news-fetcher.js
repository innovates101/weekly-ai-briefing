'use strict';

require('dotenv').config();
const RSSParser = require('rss-parser');

// ─── RSS PARSER SETUP ────────────────────────────────────────────────────────

const parser = new RSSParser({
  timeout: 15_000,
  headers: { 'User-Agent': 'AI-Agents-Weekly/1.0' },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
    ],
  },
});

// ─── DATE HELPERS ────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ─── CATEGORY DEFINITIONS ────────────────────────────────────────────────────

const TRACKED_STARTUPS = [
  'MiroFish', 'OpenClaw', 'LangChain', 'CrewAI', 'Composio', 'Relay.app',
  'Dust', 'AgentOps', 'E2B', 'Convergence AI', 'Letta', 'Cognition AI',
  'Sierra', 'Cohere', 'Imbue', 'Factory AI', 'Magic.dev',
];

// Batch companies into OR-query groups for Google News (keep URLs short)
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Some company names are common English words; append " AI" so search engines
// don't pull in unrelated articles (e.g. "Cohere clay with wood", "Dust control").
const COMPANY_SEARCH_OVERRIDES = {
  'Cohere':    'Cohere AI',
  'Dust':      'Dust AI',
  'Sierra':    'Sierra AI',
  'Letta':     'Letta AI',
  'Imbue':     'Imbue AI',
  'Magic.dev': 'Magic.dev AI agent',
};

function searchNameFor(company) {
  return COMPANY_SEARCH_OVERRIDES[company] || company;
}

const STARTUP_BATCHES = chunkArray(TRACKED_STARTUPS, 4)
  .map(batch => batch.map(c => `"${searchNameFor(c)}"`).join(' OR '));

const CATEGORY_DEFS = {
  category1: {
    id: 'category1',
    label: 'Agentic AI Startups — Game-Changing Initiatives',

    // Queries sent to NewsAPI (/everything)
    newsApiQueries: [
      '"agentic AI" startup funding',
      '"AI agent" launch announcement startup',
      'autonomous AI agent company raises',
      '"AI agents" product launch 2025',
    ],

    // Queries turned into Google News RSS URLs
    googleNewsQueries: [
      'agentic AI startup funding round',
      '"AI agent" product launch announcement',
      'autonomous AI startup raises funding',
      ...STARTUP_BATCHES,          // one query per company batch
    ],

    // Keywords used to score articles from static RSS feeds
    scoreKeywords: [
      'agent', 'agentic', 'autonomous', 'startup', 'funding', 'raises',
      'launch', 'series a', 'series b', 'seed round', 'llm', 'langchain',
      'crewai', 'composio', 'cognition', 'factory ai', 'magic.dev',
    ],
  },

  category2: {
    id: 'category2',
    label: 'Agentic AI in Financial Institutions',

    newsApiQueries: [
      '"AI agent" bank OR banking',
      'agentic AI "financial institution"',
      '"AI automation" insurance "asset management"',
      '"AI agent" payments OR fintech',
      'autonomous AI finance regulator',
      'agentic AI "wealth management" OR "capital markets"',
    ],

    googleNewsQueries: [
      '"AI agent" bank',
      'agentic AI banking',
      'autonomous AI finance',
      '"AI agent" insurance',
      '"AI agent" "asset management"',
      'financial institution AI agent automation',
    ],

    scoreKeywords: [
      'bank', 'banking', 'finance', 'financial', 'insurance', 'fintech',
      'payments', 'regulator', 'asset management', 'wealth management',
      'capital markets', 'trading', 'compliance', 'kyc', 'aml',
      'jpmorgan', 'goldman', 'hsbc', 'barclays', 'morgan stanley',
    ],
  },

  category3: {
    id: 'category3',
    label: 'New Model Developments',

    newsApiQueries: [
      'OpenAI new model release',
      'Anthropic Claude model update',
      '"Google DeepMind" OR Gemini model release',
      '"Meta Llama" model release',
      'Mistral OR "xAI" Grok model release',
      '"open source" LLM model release benchmark',
    ],

    googleNewsQueries: [
      'OpenAI model release',
      'Anthropic Claude model',
      'Google Gemini model release',
      'Meta Llama release',
      'Mistral AI model',
      'xAI Grok release',
      'open source LLM benchmark',
    ],

    scoreKeywords: [
      'model', 'release', 'llm', 'gpt', 'claude', 'gemini', 'llama',
      'mistral', 'grok', 'benchmark', 'foundation model', 'openai',
      'anthropic', 'deepmind', 'hugging face', 'weights', 'parameters',
      'context window', 'multimodal', 'reasoning', 'inference',
    ],
  },
};

// ─── STATIC RSS FEEDS ────────────────────────────────────────────────────────
// Broad AI/finance feeds — articles are keyword-categorised after fetching.

const STATIC_RSS_FEEDS = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', label: 'TechCrunch AI' },
  { url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', label: 'The Verge AI' },
  { url: 'https://venturebeat.com/category/ai/feed/', label: 'VentureBeat AI' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', label: 'Ars Technica' },
  { url: 'https://www.fintechfutures.com/feed/', label: 'Fintech Futures' },
  { url: 'https://bankingjournal.aba.com/feed/', label: 'ABA Banking Journal' },
  { url: 'https://www.americanbanker.com/feed', label: 'American Banker' },
  // Note: FT and Bloomberg require subscriptions; their headlines are covered via
  // Google News RSS queries above.
];

// ─── TIMEOUT HELPERS ─────────────────────────────────────────────────────────

/**
 * Race a promise against a hard timeout.
 * rss-parser's own timeout option is unreliable on Windows (stalled TCP
 * connections are never aborted). This wrapper guarantees resolution.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function fetchJson(url, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AI-Agents-Weekly/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── NEWSAPI FETCHER ─────────────────────────────────────────────────────────

async function fetchNewsApi(query, categoryId, since) {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    q: query,
    from: since.toISOString().split('T')[0],
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: '20',
    apiKey: key,
  });

  let data;
  try {
    data = await fetchJson(`https://newsapi.org/v2/everything?${params}`);
  } catch (err) {
    console.warn(`[NewsAPI] query "${query}" failed: ${err.message}`);
    return [];
  }

  if (data.status !== 'ok') {
    console.warn(`[NewsAPI] query "${query}" returned status=${data.status}: ${data.message || ''}`);
    return [];
  }

  return (data.articles || []).map(a =>
    normalizeArticle({
      title: a.title,
      url: a.url,
      source: `NewsAPI:${a.source?.name || 'unknown'}`,
      publishedAt: parseDate(a.publishedAt),
      snippet: a.description || a.content || '',
      category: categoryId,
    })
  );
}

// Small delay to stay well within NewsAPI's rate limits
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllNewsApi(since) {
  const results = [];
  let callCount = 0;

  for (const [catId, def] of Object.entries(CATEGORY_DEFS)) {
    for (const query of def.newsApiQueries) {
      if (callCount > 0) await sleep(300); // ~3 req/s max
      const articles = await fetchNewsApi(query, catId, since);
      results.push(...articles);
      callCount++;
    }
  }

  console.log(`[NewsAPI] fetched ${results.length} raw articles across ${callCount} queries`);
  return results;
}

// ─── GOOGLE NEWS RSS FETCHER ─────────────────────────────────────────────────

function googleNewsUrl(query) {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
}

const GOOGLE_NEWS_TIMEOUT_MS = 12_000;

async function fetchGoogleNewsQuery(query, categoryId) {
  const url = googleNewsUrl(query);
  try {
    // Hard timeout — parser.parseURL can stall indefinitely on Windows
    const feed = await withTimeout(
      parser.parseURL(url),
      GOOGLE_NEWS_TIMEOUT_MS,
      url
    );
    return (feed.items || []).map(item =>
      normalizeArticle({
        title: item.title,
        url: item.link,
        source: 'Google News',
        publishedAt: parseDate(item.pubDate || item.isoDate),
        snippet: item.contentSnippet || item.content || '',
        category: categoryId,
      })
    );
  } catch (err) {
    console.warn(`[GoogleNews] "${query}" failed: ${err.message}`);
    return [];
  }
}

/**
 * Run Google News queries with limited concurrency (5 at a time) to avoid
 * flooding the network and triggering rate limits or hangs.
 */
async function fetchAllGoogleNews(since) {
  const allTasks = [];
  for (const [catId, def] of Object.entries(CATEGORY_DEFS)) {
    for (const query of def.googleNewsQueries) {
      allTasks.push({ query, catId });
    }
  }

  const CONCURRENCY = 5;
  const results = [];

  for (let i = 0; i < allTasks.length; i += CONCURRENCY) {
    const batch = allTasks.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(({ query, catId }) =>
        fetchGoogleNewsQuery(query, catId).then(articles =>
          articles.filter(a => a.publishedAt && a.publishedAt >= since)
        )
      )
    );
    results.push(
      ...settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
    );
  }

  console.log(`[GoogleNews] fetched ${results.length} raw articles across ${allTasks.length} queries`);
  return results;
}

// ─── STATIC RSS FEED FETCHER ─────────────────────────────────────────────────

const STATIC_RSS_TIMEOUT_MS = 12_000;

async function fetchStaticFeed(feed, since) {
  try {
    const parsed = await withTimeout(
      parser.parseURL(feed.url),
      STATIC_RSS_TIMEOUT_MS,
      feed.label
    );
    const articles = (parsed.items || [])
      .map(item => {
        const content = item.contentEncoded || item.content || item.contentSnippet || '';
        const text = `${item.title || ''} ${content}`.toLowerCase();
        return normalizeArticle({
          title: item.title,
          url: item.link || item.guid,
          source: feed.label,
          publishedAt: parseDate(item.pubDate || item.isoDate),
          snippet: (item.contentSnippet || item.summary || '').slice(0, 400),
          category: categorizeByKeywords(text),
        });
      })
      .filter(a => a.category !== null && a.publishedAt && a.publishedAt >= since);

    console.log(`[RSS] ${feed.label}: ${articles.length} relevant articles`);
    return articles;
  } catch (err) {
    console.warn(`[RSS] ${feed.label} failed: ${err.message}`);
    return [];
  }
}

async function fetchAllStaticFeeds(since) {
  const settled = await Promise.allSettled(
    STATIC_RSS_FEEDS.map(feed => fetchStaticFeed(feed, since))
  );
  return settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

// ─── AI RELEVANCE SIGNAL ─────────────────────────────────────────────────────

/**
 * Broad regex that matches any article genuinely about AI.
 * Applied to the title — articles whose title lacks any of these signals are
 * discarded as false positives from company-name queries (e.g. "cohere clay").
 */
const AI_SIGNAL_RE = new RegExp(
  [
    '\\bAI\\b',
    'artificial intelligence',
    'machine learning',
    '\\bLLM\\b',
    '\\bGPT',
    'language model',
    'foundation model',
    'neural network',
    '\\bagentic\\b',
    'ai agent',
    'chatbot',
    'openai',
    'anthropic',
    '\\bclaude\\b',
    'gemini',
    '\\bllama\\b',
    'mistral',
    '\\bgrok\\b',
    'hugging face',
    'deepmind',
    'generative ai',
    'genai',
    'autonomous agent',
    'multi.agent',
    'large language',
    '\\bRAG\\b',
    'copilot',
    'transformer model',
  ].join('|'),
  'i'
);

function hasAISignal(article) {
  return AI_SIGNAL_RE.test(article.title) || AI_SIGNAL_RE.test(article.snippet);
}

// ─── KEYWORD SCORING & CATEGORISATION ────────────────────────────────────────

/**
 * Score a piece of text against a category's keywords.
 * Returns a score 0–1 representing keyword density.
 */
function scoreText(text, keywords) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) hits++;
  }
  return hits / keywords.length;
}

/**
 * Assign an article (from a static feed) to the best-matching category,
 * or null if it scores below threshold on all categories.
 */
function categorizeByKeywords(text, threshold = 0.08) {
  let best = null;
  let bestScore = threshold;

  for (const [catId, def] of Object.entries(CATEGORY_DEFS)) {
    const score = scoreText(text, def.scoreKeywords);
    if (score > bestScore) {
      best = catId;
      bestScore = score;
    }
  }

  return best;
}

// ─── ARTICLE NORMALISATION ───────────────────────────────────────────────────

function normalizeArticle({ title, url, source, publishedAt, snippet, category }) {
  return {
    title: (title || '').trim().replace(/\s+/g, ' '),
    url: (url || '').trim(),
    source: source || 'unknown',
    publishedAt: publishedAt || null,
    snippet: (snippet || '').trim().replace(/\s+/g, ' ').slice(0, 500),
    category,
  };
}

// ─── DEDUPLICATION ───────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'its', 'it', 'this', 'that',
]);

function titleWords(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/**
 * Jaccard similarity on meaningful title words.
 * Returns 0–1; ≥0.8 is treated as a near-duplicate.
 */
function titleSimilarity(titleA, titleB) {
  if (!titleA || !titleB) return 0;
  const setA = titleWords(titleA);
  const setB = titleWords(titleB);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.8;

function deduplicateArticles(articles) {
  const seenUrls = new Set();
  const kept = [];

  for (const article of articles) {
    // Skip articles without a URL
    if (!article.url) continue;

    // Exact URL dedup
    const normalUrl = article.url.replace(/\/$/, '').toLowerCase();
    if (seenUrls.has(normalUrl)) continue;

    // Title similarity dedup against already-kept articles in the same category
    const isDuplicate = kept.some(
      k =>
        k.category === article.category &&
        titleSimilarity(k.title, article.title) >= SIMILARITY_THRESHOLD
    );
    if (isDuplicate) continue;

    seenUrls.add(normalUrl);
    kept.push(article);
  }

  return kept;
}

// ─── GROUPING ────────────────────────────────────────────────────────────────

function groupByCategory(articles) {
  const grouped = { category1: [], category2: [], category3: [] };
  for (const a of articles) {
    if (grouped[a.category]) grouped[a.category].push(a);
  }
  // Sort each category by date descending (most recent first)
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => {
      const ta = a.publishedAt ? a.publishedAt.getTime() : 0;
      const tb = b.publishedAt ? b.publishedAt.getTime() : 0;
      return tb - ta;
    });
  }
  return grouped;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Fetch all articles from the last 7 days across all sources and categories.
 *
 * @returns {{
 *   category1: Article[],
 *   category2: Article[],
 *   category3: Article[],
 *   weekStart: Date,
 *   weekEnd: Date,
 *   fetchedAt: string,
 *   stats: object
 * }}
 */
const FETCH_ALL_TIMEOUT_MS = 90_000; // hard ceiling on entire fetch operation

async function fetchAll() {
  const weekEnd = new Date();
  const weekStart = daysAgo(7);

  console.log(`[news-fetcher] Fetching articles from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`);

  // Run all three source types in parallel, with a global hard timeout.
  // Each sub-fetcher also has per-request timeouts; this is the safety net.
  const [newsApiArticles, googleNewsArticles, staticFeedArticles] = await withTimeout(
    Promise.all([
      fetchAllNewsApi(weekStart),
      fetchAllGoogleNews(weekStart),
      fetchAllStaticFeeds(weekStart),
    ]),
    FETCH_ALL_TIMEOUT_MS,
    'fetchAll'
  );

  const totalRaw = newsApiArticles.length + googleNewsArticles.length + staticFeedArticles.length;
  console.log(`[news-fetcher] Raw totals — NewsAPI: ${newsApiArticles.length}, Google News: ${googleNewsArticles.length}, Static RSS: ${staticFeedArticles.length}`);

  // Merge: NewsAPI first (highest editorial quality), then Google News, then static feeds.
  // This means earlier entries win deduplication, so premium sources are preferred.
  const allArticles = [
    ...newsApiArticles,
    ...googleNewsArticles,
    ...staticFeedArticles,
  ].filter(a => a.title && a.url && a.category);

  // Filter to date window (some feeds include older items)
  const inWindow = allArticles.filter(
    a => a.publishedAt && a.publishedAt >= weekStart && a.publishedAt <= weekEnd
  );

  // Drop articles whose title+snippet contain no AI vocabulary —
  // catches false positives from company-name queries (e.g. "cohere clay").
  const aiRelevant = inWindow.filter(hasAISignal);
  console.log(`[news-fetcher] After AI signal filter: ${aiRelevant.length} (dropped ${inWindow.length - aiRelevant.length} off-topic)`);

  const deduped = deduplicateArticles(aiRelevant);
  const grouped = groupByCategory(deduped);

  console.log(
    `[news-fetcher] After dedup: ${deduped.length} articles` +
    ` (cat1=${grouped.category1.length}, cat2=${grouped.category2.length}, cat3=${grouped.category3.length})`
  );

  return {
    ...grouped,
    weekStart,
    weekEnd,
    fetchedAt: new Date().toISOString(),
    stats: {
      totalRaw,
      afterDateFilter: inWindow.length,
      afterAIFilter: aiRelevant.length,
      afterDedup: deduped.length,
      byCategory: {
        category1: grouped.category1.length,
        category2: grouped.category2.length,
        category3: grouped.category3.length,
      },
      sources: {
        newsApi: newsApiArticles.length,
        googleNews: googleNewsArticles.length,
        staticFeeds: staticFeedArticles.length,
      },
    },
  };
}

// ─── TEST HELPER ─────────────────────────────────────────────────────────────

/**
 * Pretty-print a fetch result summary to stdout.
 * Called when running: node src/index.js --test-fetch
 */
function printSummary(result) {
  const catLabels = {
    category1: CATEGORY_DEFS.category1.label,
    category2: CATEGORY_DEFS.category2.label,
    category3: CATEGORY_DEFS.category3.label,
  };

  console.log('\n══════════════════════════════════════════════════════');
  console.log(' AI Agents Weekly — News Fetch Summary');
  console.log(`  Week: ${result.weekStart.toDateString()} → ${result.weekEnd.toDateString()}`);
  console.log(`  Fetched at: ${result.fetchedAt}`);
  console.log('──────────────────────────────────────────────────────');
  console.log(` Raw articles: ${result.stats.totalRaw}`);
  console.log(`   NewsAPI:     ${result.stats.sources.newsApi}`);
  console.log(`   Google News: ${result.stats.sources.googleNews}`);
  console.log(`   Static RSS:  ${result.stats.sources.staticFeeds}`);
  console.log(` After date filter: ${result.stats.afterDateFilter}`);
  console.log(` After AI filter:   ${result.stats.afterAIFilter}`);
  console.log(` After dedup:       ${result.stats.afterDedup}`);
  console.log('──────────────────────────────────────────────────────');

  for (const catId of ['category1', 'category2', 'category3']) {
    const articles = result[catId];
    console.log(`\n  ${catLabels[catId]} (${articles.length} articles)`);
    for (const a of articles.slice(0, 5)) {
      const date = a.publishedAt ? a.publishedAt.toISOString().split('T')[0] : 'unknown';
      console.log(`    [${date}] [${a.source}]`);
      console.log(`    ${a.title}`);
      console.log(`    ${a.url}`);
    }
    if (articles.length > 5) {
      console.log(`    ... and ${articles.length - 5} more`);
    }
  }
  console.log('\n══════════════════════════════════════════════════════\n');
}

module.exports = {
  fetchAll,
  printSummary,
  CATEGORY_DEFS,
  TRACKED_STARTUPS,
};
