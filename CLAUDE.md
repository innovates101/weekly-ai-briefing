# AI Agents Daily — Claude Code Guide

## What This Project Does

Automated daily email newsletter delivering AI news curated for financial institutions. The pipeline: fetch articles → Claude analyzes & editorializes → render HTML email → send via Gmail.

## Editorial Philosophy

The newsletter's purpose is to keep readers abreast of **all AI developments that could impact the financial sector** — not just news about tracked companies or predefined categories. Tracked companies and keywords are a *prioritisation signal*, not an exclusion filter. Claude should actively surface emerging developments, novel research, and under-the-radar signals even when they fall outside the configured scope, provided they carry plausible relevance to financial institutions.

## Architecture

```
index.js (CLI entry)
  → news-fetcher.js    — fetch, deduplicate, categorize articles
  → content-generator.js — call Claude CLI for editorial analysis
  → email-builder.js   — inject content into HTML template
  → email-sender.js    — send via Gmail SMTP (Nodemailer; local only)
```

**Automated cloud pipeline** (Claude Code scheduled run — no subprocess Claude CLI):
```
_fetch.js      → _articles.json   (fetch + cross-run dedup)
_mark-seen.js  → _seen-urls.json  (mark fetched URLs as seen)
[Claude generates _briefing.json directly — no subprocess]
_build.js      → _email.html, _subject.txt
_send.js       → _draft-params.json  (GMAIL_MCP_READY)
[Claude calls mcp__Gmail__create_draft with _draft-params.json contents]
```

**Three content sections (in order):**
1. **Deep Dive** — one significant story, under 300 words. Three sub-sections: Overview (punchy summary + source link), The Details (key facts as bullets), Why It Matters (implications for banks).
2. **Things to Know** — 4–6 broader stories across all categories. Each capped at 80 words. Headline is plain bold text; the source name is the clickable underlined link to the article.
3. **Agentic Startups to Watch** — 2–3 startup stories, capped at 80 words each. Focus on what the product actually does, what's novel, and why it matters to financial institutions.

**Four article categories:**
1. Agentic AI startups
2. AI deployments in financial institutions
3. New model/research developments
4. Emerging AI developments that financial institutions should know

## How to Run

```bash
node src/index.js --test-fetch      # Test news fetching only (no Claude, no email)
node src/index.js --test-generate   # Fetch + Claude generation → briefing-test-output.json
node src/index.js --test-email      # Full pipeline: fetch → generate → build → send
node src/index.js --run-now         # Trigger scheduler immediately (single full run)
npm start                           # Start daily scheduler (runs every day at 08:00)
```

## Configuration

All editorial config lives in `config.js`:
- `PUBLICATION` — name, tagline, cron schedule (daily at 08:00)
- `CATEGORIES` — 3 categories with Claude prompts per section
- `TRACKED_COMPANIES` — 50+ banks, fintechs, AI vendors, regulators
- `KEYWORDS` — primary and secondary AI/finance signal terms
- `RSS_FEEDS` — 12 static sources (VentureBeat, TechCrunch, fintech outlets, etc.)
- `SEARCH_QUERIES` — per-category search queries used by Tavily and the WebSearch fallback
- `OUTPUT` — max 10 articles/category, min relevance score 0.3
- `CLAUDE` — path to Claude CLI executable (Windows UWP), 20 max context articles, 120s timeout

## Environment Variables (`.env`)

```
TAVILY_API_KEY=         # Tavily AI search API key (https://tavily.com — free tier: 1k req/month)
NEWS_API_KEY=           # NewsAPI key (https://newsapi.org — free developer tier: 100 req/day)
NOTIFY_FROM=            # Gmail sender address
NOTIFY_TO=              # Gmail recipient address
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=              # Gmail address
SMTP_PASSWORD=          # Gmail App Password (not your login password)
```

### Notes on news source 403 errors in sandboxed environments

Direct outbound HTTP calls to `newsapi.org` and `api.tavily.com` return HTTP 403 "Host not in allowlist" in sandboxed Claude Code environments. This is the **sandbox firewall** intercepting the request — not the APIs themselves. Both keys are valid and will work normally on a local machine, VPS, or GitHub Actions runner. The WebSearch MCP fallback (see below) handles the sandboxed case.

## Claude Integration

Content generation uses **Claude CLI via subprocess** (`spawnSync`), not the API SDK. Each of the three sections makes a separate Claude call:
- Prompt piped via stdin with `--print` flag (non-interactive)
- Output expected as JSON; falls back to regex extraction if parsing fails
- Timeout: 2 minutes per call
- CLI path: hardcoded to Windows UWP install path in `config.js` (`CLAUDE.executablePath`)

**Do not switch to Anthropic SDK** — the existing subprocess approach works with the user's Claude subscription and is intentional.

## Email Template

- File: `templates/email-template.html`
- XHTML 1.0 Transitional for email client compatibility
- Max-width 680px, table-based layout (Outlook compatibility)
- Uses `{{placeholder}}` syntax for content injection
- All CSS must be inlined — email clients strip `<style>` blocks
- Accent color: green `#009c6d`; saved editions go to `archive/{YYYY-MM-DD}.html`

## WebSearch Fallback

When `node _fetch.js` prints `FALLBACK_NEEDED`, all news sources returned 0 articles (direct outbound HTTP is blocked in sandboxed environments). **Do not stop the pipeline.** Instead:

### Step 1 — Run these 6 WebSearch queries (2 per category)

**Category 1 — Agentic AI Startups:**
- `agentic AI startup funding launch <current month> <year>`
- `AI agent company product announcement enterprise <current month> <year>`

**Category 2 — AI in Financial Institutions:**
- `AI agents banking financial institutions <current month> <year>`
- `agentic AI fintech bank deployment announcement <current month> <year>`

**Category 3 — New Model/Research Developments:**
- `OpenAI Anthropic Claude model release <current month> <year>`
- `Google Gemini Meta Llama AI model update benchmark <current month> <year>`

### Step 2 — Rewrite `_articles.json` with real results

Map each search result to this shape and write the file:

```json
{
  "category1": [
    {
      "title": "Article headline",
      "url": "https://...",
      "source": "Publication name",
      "publishedAt": "YYYY-MM-DD",
      "snippet": "Up to 200 chars of description"
    }
  ],
  "category2": [ ... ],
  "category3": [ ... ],
  "weekStart": "YYYY-MM-DD",
  "weekEnd": "YYYY-MM-DD"
}
```

Rules:
- Only include articles published within the past 24 hours (`weekStart` to today)
- Keep up to 10 articles per category; aim for at least 3
- `source` = publication name (e.g. `"TechCrunch"`, `"Bloomberg"`)
- `snippet` = first 200 chars of the result description; empty string if none
- `weekStart` = yesterday's date; `weekEnd` = today's date

### Step 2b — Mark articles as seen (prevents repeats tomorrow)

After writing `_articles.json`, run:

```bash
node _mark-seen.js
```

This records all article URLs into `_seen-urls.json` so tomorrow's run won't repeat them. Without this step, WebSearch-fallback articles bypass cross-run deduplication.

### Step 3 — Continue the pipeline (content generation)

Generate `_briefing.json` directly as Claude (no subprocess needed in cloud runs). See editorial guidelines above for section structure.

### Step 4 — Build the email

```bash
node _build.js
```

Produces `_email.html` and `_subject.txt`.

### Step 5 — Prepare Gmail draft parameters

```bash
node _send.js
```

Writes `_draft-params.json` and prints `GMAIL_MCP_READY:{recipients}`. No network calls — exits immediately.

### Step 6 — Send via Gmail MCP

Read `_draft-params.json`, then call `mcp__Gmail__create_draft` with:
- `to` — array of recipient addresses from `_draft-params.json`
- `subject` — subject string from `_draft-params.json`
- `htmlBody` — full HTML from `_draft-params.json`

---

## Known Issues / Incomplete Features

- Claude CLI path is Windows-specific; not portable
- No fallback if Claude times out or returns malformed JSON — full pipeline fails
- `.env` should not be committed if the repo becomes public

## Key Implementation Notes

- **Within-run deduplication**: exact URL match first, then Jaccard title similarity (threshold 0.8)
- **Cross-run deduplication**: `_fetch.js` maintains `_seen-urls.json` — a rolling 7-day log of fetched article URLs. Articles that appeared in any previous daily edition are automatically excluded, so the same story never runs twice. Entries older than 7 days are expired automatically.
- **RSS timeouts**: uses `Promise.race()` to avoid Windows RSS parser hangs (15s per feed)
- **Google News**: batched 5 queries at a time, concurrency-limited to avoid rate limits
- **NewsAPI**: reuses `searchQueries` from `CATEGORY_DEFS`; 300ms delay between requests; runs in parallel with Tavily
- **HTML sanitization**: only safe tags allowed in deep-dive section before inline-styling
- **Email retry**: 3 attempts with exponential backoff (2s, 4s delays)
- **Scheduler**: `src/scheduler.js` uses `node-cron` with the schedule in `config.js` (`0 8 * * *`). `npm start` runs the scheduler; `--run-now` triggers one immediate run.
