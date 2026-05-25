'use strict';

const { spawn } = require('child_process');
const { CLAUDE } = require('../config');

// ─── CLAUDE CLI INVOCATION ────────────────────────────────────────────────────

async function callClaude(prompt) {
  // API mode: use Anthropic SDK when ANTHROPIC_API_KEY is present (e.g. GitHub Actions)
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-opus-4-7',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = message.content[0];
    if (block.type !== 'text') throw new Error('Unexpected non-text response from Anthropic API');
    return block.text;
  }

  // Local mode: use Claude CLI subprocess
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE.command, ['--print'], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude CLI timed out after ${CLAUDE.timeoutMs}ms`));
    }, CLAUDE.timeoutMs);

    child.on('error', err => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error('`claude` CLI not found. Set ANTHROPIC_API_KEY to use API mode instead.'));
      } else {
        reject(new Error(`Claude CLI spawn error: ${err.message}`));
      }
    });

    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr || '(no stderr)'}`));
      } else {
        resolve(stdout.trim());
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ─── ARTICLE FORMATTING ───────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return 'unknown date';
  return d.toISOString().split('T')[0];
}

function formatArticle(article, index) {
  return [
    `[${index}] ${article.title}`,
    `    Source: ${article.source} | Date: ${formatDate(article.publishedAt)}`,
    `    URL: ${article.url}`,
    article.snippet ? `    Summary: ${article.snippet.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n');
}

function formatArticleList(articles) {
  return articles.map((a, i) => formatArticle(a, i + 1)).join('\n\n');
}

// ─── JSON EXTRACTION ─────────────────────────────────────────────────────────

function parseJsonFromResponse(text) {
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();

  try { return JSON.parse(stripped); } catch { /* continue */ }

  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch { /* continue */ }
  }

  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj.items)) return obj.items;
      return obj;
    } catch { /* continue */ }
  }

  throw new Error(
    `Could not parse JSON from Claude response. First 300 chars:\n${text.slice(0, 300)}`
  );
}

// ─── ARTICLE SELECTION ───────────────────────────────────────────────────────
//
// Routing rules:
// - Deep Dive pool:  top 5 from each category (15 total)
// - Startups pool:   cat1 articles with direct (non-Google News) URLs preferred;
//                    academic/research articles excluded here, routed to TTK
// - TTK pool:        cat2 + cat3 + research articles from cat1

const GOOGLE_NEWS_PATTERN = /^https?:\/\/news\.google\.com\//;
const RESEARCH_PATTERN = /\b(research|paper|study|benchmark|academic|university|arxiv|IEEE|ACM|Nature|Science)\b/i;

function isDirectUrl(article) {
  return !GOOGLE_NEWS_PATTERN.test(article.url);
}

function isResearchArticle(article) {
  return RESEARCH_PATTERN.test(`${article.title} ${article.snippet}`);
}

function selectArticles(fetchResult) {
  const cat1 = fetchResult.category1 || [];
  const cat2 = fetchResult.category2 || [];
  const cat3 = fetchResult.category3 || [];

  // Deep Dive: broad pool across all categories so Claude picks the best story
  const deepDivePool = [
    ...cat1.slice(0, 5),
    ...cat2.slice(0, 5),
    ...cat3.slice(0, 5),
  ].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

  // Research articles from cat1 belong in TTK, not Startups
  const cat1Research  = cat1.filter(a => isResearchArticle(a)).slice(0, 4);
  const cat1Startups  = cat1.filter(a => !isResearchArticle(a));

  // Startups: prefer direct URLs; direct-URL articles bubble to the top
  const startupsPool = [
    ...cat1Startups.filter(isDirectUrl).slice(0, 12),
    ...cat1Startups.filter(a => !isDirectUrl(a)).slice(0, 8),
  ];

  // TTK: cat2 + cat3 + research articles from cat1
  const ttkPool = [
    ...cat2.slice(0, 10),
    ...cat3.slice(0, 10),
    ...cat1Research,
  ].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

  return { deepDivePool, startupsPool, ttkPool };
}

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

function buildDeepDivePrompt(articles) {
  return `\
You are writing the lead article for "AI Agents Weekly" — a weekly email briefing for banking \
and fintech professionals. Readers range from frontline staff to CTOs and Heads of Strategy.

Here are this week's top AI stories (${articles.length} articles):

${formatArticleList(articles)}

──────────────────────────────────────────────────────────────────
TASK
──────────────────────────────────────────────────────────────────
Identify the SINGLE most significant story with the biggest implications for financial institutions. \
Write a concise, punchy deep-dive. STRICT LIMIT: the entire BODY must be under 300 words.

STYLE: Conversational, opinionated. Bold key phrases. No corporate jargon. Take a clear stance.

FACT-CHECK: Only assert things you are confident are true based on the article summaries provided. \
Do not invent statistics, quotes, or details not present in the source material.

──────────────────────────────────────────────────────────────────
OUTPUT FORMAT — respond with EXACTLY this structure, nothing before "TITLE:":
──────────────────────────────────────────────────────────────────
TITLE: [Punchy opinionated headline — NOT the original article title. Max 10 words.]
SELECTED_INDEX: [the number in brackets of the article you chose, e.g. 3]
BODY:
[HTML using only: <p> <h3> <strong> <em> <ul> <li> <a href="...">]

The BODY must contain EXACTLY these three sections — no more, no fewer:

1. <h3>Overview</h3> — one punchy, opinionated paragraph (~40 words). Must NOT start with "This week". \
Include a link to the source article using <a href="URL">anchor text</a>.
2. <h3>The Details</h3> — key facts as <ul><li> bullet points. Cover: what changed, scale of impact, \
key partnerships, how it works, and any numbers worth noting. 4–6 bullets max.
3. <h3>Why It Matters</h3> — 2 short paragraphs (~50 words each). Specific implications for \
banks, insurers, asset managers, and payments firms. Be direct and opinionated.

STRICT LIMIT: entire BODY must be under 300 words.

Begin your response with "TITLE:" — no preamble.`;
}

function buildStartupsPrompt(articles, deepDiveTitle) {
  return `\
You are writing the "🚀 Agentic AI Startups to Watch" section for "AI Agents Weekly".

Here are this week's agentic AI startup stories (${articles.length} articles):

${formatArticleList(articles)}

──────────────────────────────────────────────────────────────────
TASK
──────────────────────────────────────────────────────────────────
Select 2–3 MOST NOTEWORTHY startup stories. Fewer is better — only include a story if it \
is genuinely interesting. If fewer than 2 are worth covering, return just 1.

SELECTION RULES:
- Prioritise: product launches with real enterprise use cases, funding from notable investors, \
  partnerships with financial institutions
- EXCLUDE: academic papers, benchmarks, and pure research stories (those belong in Things to Know)
- EXCLUDE any story about: "${deepDiveTitle}" (already covered in Deep Dive)
- Only select articles where you are confident the URL in the list is a real, working link

WRITING RULES:
- For each startup: explain specifically WHAT their product does (the actual technology/workflow), \
  WHAT makes it stand out (novel approach, key differentiator), and WHY it matters to financial \
  institutions. Not just that they raised money.
- Be concise and specific. Each entry must be 80 words or fewer in total (tagline + summary + analysis combined).
- FACT-CHECK: Only state facts present in the article summaries. Do not invent details.

──────────────────────────────────────────────────────────────────
OUTPUT: JSON array ONLY. No explanation, no markdown fences. Raw JSON starting with "[":
──────────────────────────────────────────────────────────────────
[
  {
    "articleIndex": 3,
    "company": "Company Name",
    "tagline": "One-line description of what their product does — the technology, not the news event",
    "summary": "1–2 sentences on this week's specific news (funding, launch, partnership).",
    "analysis": "**What makes it stand out:** 1 sentence on the novel approach or differentiator, and why it is relevant to banks or fintechs specifically."
  }
]`;
}

function buildThingsToKnowPrompt(articles, deepDiveTitle) {
  return `\
You are writing the "Things to Know" section for "AI Agents Weekly".

Here are this week's stories on AI in financial institutions and model developments \
(${articles.length} articles):

${formatArticleList(articles)}

──────────────────────────────────────────────────────────────────
TASK
──────────────────────────────────────────────────────────────────
Select 4–6 MOST NOTEWORTHY stories. Include a mix of:
- Banks, insurers, asset managers, fintechs deploying AI in production
- Major model releases or capability updates
- Regulatory or risk developments
- Research or benchmark findings relevant to enterprise AI

EXCLUSION RULES:
- EXCLUDE any story about: "${deepDiveTitle}" — already covered in the Deep Dive section
- Do not include two stories covering the same underlying event

WRITING RULES:
- Write concisely. Each entry must be 80 words or fewer in total.
- Cover the key fact, any notable scale/number, and the implication for financial institutions.
- FACT-CHECK: only assert things present in the article summaries. Do not invent statistics or quotes.

──────────────────────────────────────────────────────────────────
OUTPUT: JSON array ONLY. No explanation, no markdown fences. Raw JSON starting with "[":
──────────────────────────────────────────────────────────────────
[
  {
    "articleIndex": 2,
    "headline": "Original article headline exactly as written",
    "source": "Publication name",
    "summary": "Concise summary in 60 words or fewer. Cover the key development and any notable figures or scale.",
    "keyPoint": "**Bold lead-in.** One sentence on the single most noteworthy implication for banks, insurers, or fintechs."
  }
]`;
}

// ─── SECTION GENERATORS ──────────────────────────────────────────────────────

async function generateDeepDive(articles) {
  console.log(`[content-generator] Generating Deep Dive from ${articles.length} articles...`);
  const raw = await callClaude(buildDeepDivePrompt(articles));

  const titleMatch = raw.match(/TITLE:\s*(.+)/);
  const indexMatch = raw.match(/SELECTED_INDEX:\s*(\d+)/);
  const bodyMatch  = raw.match(/BODY:\s*([\s\S]+)/);

  if (!titleMatch || !bodyMatch) {
    console.warn('[content-generator] Deep Dive response did not match expected format — using raw output');
    return {
      title: "This Week's Big Story",
      html: `<p>${raw.replace(/\n/g, '</p><p>')}</p>`,
      selectedIndex: null,
    };
  }

  const title         = titleMatch[1].trim();
  const selectedIndex = indexMatch ? parseInt(indexMatch[1], 10) : null;
  let html            = bodyMatch[1].trim().replace(/^BODY:\s*/i, '');

  return { title, html, selectedIndex };
}

async function generateStartups(pool, deepDiveTitle) {
  console.log(`[content-generator] Generating Startups section from ${pool.length} articles...`);
  const raw   = await callClaude(buildStartupsPrompt(pool, deepDiveTitle));
  const items = parseJsonFromResponse(raw);

  return {
    items: items.map(item => {
      // Resolve URL from our pool using the article index Claude returned
      const idx     = typeof item.articleIndex === 'number' ? item.articleIndex - 1 : -1;
      const article = pool[idx];
      const url     = article?.url || '';

      return {
        company:  (item.company  || 'Unknown').trim(),
        tagline:  (item.tagline  || '').trim(),
        summary:  (item.summary  || '').trim(),
        analysis: (item.analysis || '').trim(),
        url,
      };
    }),
  };
}

async function generateThingsToKnow(pool, deepDiveTitle) {
  console.log(`[content-generator] Generating Things to Know from ${pool.length} articles...`);
  const raw   = await callClaude(buildThingsToKnowPrompt(pool, deepDiveTitle));
  const items = parseJsonFromResponse(raw);

  return {
    items: items.map(item => {
      const idx     = typeof item.articleIndex === 'number' ? item.articleIndex - 1 : -1;
      const article = pool[idx];
      const url     = article?.url || '';

      return {
        headline:  (item.headline  || '').trim(),
        source:    (item.source    || (article?.source) || '').trim(),
        url,
        summary:   (item.summary   || '').trim(),
        keyPoint:  (item.keyPoint  || '').trim(),
      };
    }),
  };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

async function generateBriefing(fetchResult) {
  const { deepDivePool, startupsPool, ttkPool } = selectArticles(fetchResult);

  console.log(
    `[content-generator] Pools — Deep Dive: ${deepDivePool.length}, ` +
    `Startups: ${startupsPool.length}, TTK: ${ttkPool.length}`
  );

  // 1. Deep Dive first — we need its title to exclude it from subsequent sections
  const deepDive = await generateDeepDive(deepDivePool);
  console.log(`[content-generator] Deep Dive selected: "${deepDive.title}"`);

  // 2. Startups — exclude deep dive article by title
  const startups = await generateStartups(startupsPool, deepDive.title);

  // 3. TTK — exclude deep dive article by title
  const thingsToKnow = await generateThingsToKnow(ttkPool, deepDive.title);

  return {
    deepDive,
    startups,
    thingsToKnow,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateBriefing };
