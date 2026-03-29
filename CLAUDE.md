# AI Agents Weekly — Claude Code Guide

## What This Project Does

Automated weekly email newsletter delivering AI news curated for financial institutions. Named after Simon Taylor's "Fintech Brainfood" style. The pipeline: fetch articles → Claude analyzes & editorializes → render HTML email → send via Gmail.

## Architecture

```
index.js (CLI entry)
  → news-fetcher.js    — fetch, deduplicate, categorize articles
  → content-generator.js — call Claude CLI for editorial analysis
  → email-builder.js   — inject content into HTML template
  → email-sender.js    — send via Gmail SMTP (Nodemailer)
```

**Three content sections (in order):**
1. **Deep Dive** — one significant story, under 300 words. Three sub-sections: Overview (punchy summary + source link), The Details (key facts as bullets), Why It Matters (implications for banks).
2. **Things to Know** — 4–6 broader stories across all categories. Each capped at 80 words. Headline is plain bold text; the source name is the clickable underlined link to the article.
3. **Agentic Startups to Watch** — 2–3 startup stories, capped at 80 words each. Focus on what the product actually does, what's novel, and why it matters to financial institutions.

**Three article categories:**
1. Agentic AI startups
2. AI deployments in financial institutions
3. New model/research developments

## How to Run

```bash
node src/index.js --test-fetch      # Test news fetching only (no Claude, no email)
node src/index.js --test-generate   # Fetch + Claude generation → briefing-test-output.json
node src/index.js --test-email      # Full pipeline: fetch → generate → build → send
node src/index.js --run-now         # Trigger scheduler immediately (single full run)
npm start                           # Start weekly scheduler (⚠ scheduler.js not yet implemented)
```

## Configuration

All editorial config lives in `config.js`:
- `PUBLICATION` — name, tagline, cron schedule (Mondays 7 AM)
- `CATEGORIES` — 3 categories with Claude prompts per section
- `TRACKED_COMPANIES` — 50+ banks, fintechs, AI vendors, regulators
- `KEYWORDS` — primary and secondary AI/finance signal terms
- `RSS_FEEDS` — 12 static sources (VentureBeat, TechCrunch, fintech outlets, etc.)
- `NEWSAPI_QUERIES` — 5 pre-defined NewsAPI searches
- `OUTPUT` — max 4 articles/category, min relevance score 0.3
- `CLAUDE` — path to Claude CLI executable (Windows UWP), 20 max context articles, 120s timeout

## Environment Variables (`.env`)

```
NEWS_API_KEY=           # NewsAPI.org free-tier key
NOTIFY_FROM=            # Gmail sender address
NOTIFY_TO=              # Gmail recipient address
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=              # Gmail address
SMTP_PASSWORD=          # Gmail App Password (not your login password)
```

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

## Known Issues / Incomplete Features

- **`src/scheduler.js` is a stub** — `npm start` and `--run-now` won't work until implemented with `node-cron`
- Claude CLI path is Windows-specific; not portable
- No fallback if Claude times out or returns malformed JSON — full pipeline fails
- `.env` should not be committed if the repo becomes public

## Key Implementation Notes

- **Deduplication**: exact URL match first, then Jaccard title similarity (threshold 0.8)
- **RSS timeouts**: uses `Promise.race()` to avoid Windows RSS parser hangs (15s per feed)
- **Google News**: batched 5 queries at a time, 300ms delay between NewsAPI calls
- **HTML sanitization**: only safe tags allowed in deep-dive section before inline-styling
- **Email retry**: 3 attempts with exponential backoff (2s, 4s delays)
