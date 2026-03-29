'use strict';

// ─── PUBLICATION METADATA ────────────────────────────────────────────────────

const PUBLICATION = {
  name: 'AI Agents Weekly',
  tagline: 'AI developments impacting financial institutions',
  audience: 'Banking Strategy & Innovation Team',
  // Cron schedule: every Monday at 07:00 local time
  schedule: '0 7 * * 1',
};

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
// Each category becomes a section in the briefing.
// 'prompt' guides Claude's editorial framing for that section.

const CATEGORIES = [
  {
    id: 'agentic_startups',
    label: 'Agentic AI Startups',
    prompt: 'Focus on funding rounds, launches, and product announcements for AI agent startups. Emphasise relevance to financial institutions.',
  },
  {
    id: 'big_tech',
    label: 'Big Tech & Foundation Models',
    prompt: 'Cover model releases, capability jumps, and platform announcements from OpenAI, Anthropic, Google DeepMind, Meta, Mistral, and others. Focus on enterprise and agentic implications.',
  },
  {
    id: 'banks_fintechs',
    label: 'Banks & Fintechs Deploying AI',
    prompt: 'Cover how banks, asset managers, insurers, and fintechs are deploying AI in production. Focus on scale, use case, and lessons for peers.',
  },
  {
    id: 'regulation_risk',
    label: 'Regulation & Risk',
    prompt: 'Cover regulatory guidance, policy moves, risk frameworks, and compliance developments related to AI in financial services.',
  },
  {
    id: 'research',
    label: 'Research & Thinking Worth Reading',
    prompt: 'Highlight academic papers, long-form analysis, and practitioner reports that offer strategic insight for financial institutions adopting AI.',
  },
];

// ─── TRACKED COMPANIES ───────────────────────────────────────────────────────
// Articles mentioning these companies are prioritised.

const TRACKED_COMPANIES = [
  // Major banks
  'JPMorgan', 'Goldman Sachs', 'Morgan Stanley', 'Citigroup', 'Bank of America',
  'HSBC', 'Barclays', 'Deutsche Bank', 'BNP Paribas', 'Wells Fargo',
  // Asset managers
  'BlackRock', 'Vanguard', 'Fidelity', 'State Street',
  // Fintechs
  'Stripe', 'Plaid', 'Marqeta', 'Brex', 'Chime',
  // AI vendors relevant to finance
  'OpenAI', 'Anthropic', 'Google DeepMind', 'Microsoft', 'Palantir',
  'Salesforce', 'ServiceNow', 'Bloomberg', 'Refinitiv', 'FactSet',
  // Regulators
  'FCA', 'SEC', 'OCC', 'Federal Reserve', 'Basel', 'EBA', 'CFPB',
];

// ─── KEYWORDS ────────────────────────────────────────────────────────────────
// Used to score/filter articles for relevance.

const KEYWORDS = {
  // High-priority: strongly relevant
  primary: [
    'AI agent', 'agentic AI', 'LLM', 'large language model',
    'generative AI', 'GenAI', 'foundation model',
    'AI regulation', 'AI compliance', 'AI risk',
    'AI banking', 'AI finance', 'AI fintech',
    'autonomous agent', 'multi-agent',
  ],
  // Secondary: contextually relevant
  secondary: [
    'machine learning', 'automation', 'natural language processing',
    'digital transformation', 'RegTech', 'SupTech',
    'risk management', 'fraud detection', 'KYC', 'AML',
    'chatbot', 'copilot', 'workflow automation',
  ],
};

// ─── RSS SOURCES ─────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  // AI-focused
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', label: 'VentureBeat AI', category: 'big_tech' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', label: 'TechCrunch AI', category: 'agentic_startups' },
  { url: 'https://www.technologyreview.com/feed/', label: 'MIT Technology Review', category: 'research' },
  { url: 'https://huggingface.co/blog/feed.xml', label: 'Hugging Face Blog', category: 'big_tech' },

  // Finance & fintech
  { url: 'https://feeds.feedburner.com/efinancialcareersnews', label: 'eFinancialCareers', category: 'banks_fintechs' },
  { url: 'https://www.fintechfutures.com/feed/', label: 'Fintech Futures', category: 'banks_fintechs' },
  { url: 'https://bankingjournal.aba.com/feed/', label: 'ABA Banking Journal', category: 'banks_fintechs' },
  { url: 'https://www.risk.net/rss', label: 'Risk.net', category: 'regulation_risk' },

  // Regulation
  { url: 'https://www.fca.org.uk/news/rss.xml', label: 'FCA News', category: 'regulation_risk' },
  { url: 'https://www.bis.org/rss/index.xml', label: 'BIS', category: 'regulation_risk' },
];

// ─── NEWSAPI QUERIES ─────────────────────────────────────────────────────────
// Each entry becomes a separate NewsAPI request. Results are deduplicated.

const NEWSAPI_QUERIES = [
  { q: 'AI agents financial services', language: 'en', sortBy: 'relevancy' },
  { q: 'agentic AI banking', language: 'en', sortBy: 'relevancy' },
  { q: 'AI regulation banks', language: 'en', sortBy: 'relevancy' },
  { q: 'generative AI fintech', language: 'en', sortBy: 'relevancy' },
  { q: 'LLM enterprise finance', language: 'en', sortBy: 'relevancy' },
];

// ─── OUTPUT SETTINGS ─────────────────────────────────────────────────────────

const OUTPUT = {
  // Max articles to include per category in the final briefing
  maxArticlesPerCategory: 4,
  // Min relevance score (0–1) for an article to be included
  minRelevanceScore: 0.3,
  // Archive directory (relative to project root)
  archiveDir: './archive',
  // Template file
  emailTemplate: './templates/email-template.html',
};

// ─── CLAUDE CLI SETTINGS ─────────────────────────────────────────────────────

const CLAUDE = {
  // Full path to Claude CLI executable (Windows UWP install location)
  command: 'C:\\Users\\celes\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude\\claude-code\\2.1.78\\claude.exe',
  // Max tokens to allow in a single Claude call (approximate, for prompt budgeting)
  maxContextArticles: 20,
  // Timeout for a single Claude subprocess call (ms)
  timeoutMs: 120_000,
};

module.exports = {
  PUBLICATION,
  CATEGORIES,
  TRACKED_COMPANIES,
  KEYWORDS,
  RSS_FEEDS,
  NEWSAPI_QUERIES,
  OUTPUT,
  CLAUDE,
};
