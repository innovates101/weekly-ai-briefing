# AI Agents Weekly

Automated weekly email newsletter delivering AI news curated for financial institutions. Inspired by Simon Taylor's *Fintech Brainfood* editorial style. The pipeline fetches articles from RSS feeds and NewsAPI, passes them through Claude for editorial analysis, renders an HTML email, and sends it via Gmail.

## Pipeline

```
index.js (CLI entry)
  → news-fetcher.js      — fetch, deduplicate, categorize articles
  → content-generator.js — call Claude CLI for editorial analysis
  → email-builder.js     — inject content into HTML template
  → email-sender.js      — send via Gmail SMTP (Nodemailer)
```

## Newsletter Sections

1. **Deep Dive** — one significant story, ~300 words. Covers: Overview, The Details (bullets), Why It Matters (bank implications).
2. **Things to Know** — 4–6 broader stories across all categories, capped at 80 words each.
3. **Agentic Startups to Watch** — 2–3 startup stories, 80 words each, focused on what the product does and why it matters to financial institutions.

## Setup

### Prerequisites

- Node.js >= 18
- [Claude Code CLI](https://claude.ai/code) installed (used for content generation)
- A [NewsAPI.org](https://newsapi.org) free-tier key
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) configured

### Install

```bash
npm install
```

### Configure environment

Copy the example below to a `.env` file in the project root:

```
NEWS_API_KEY=           # NewsAPI.org key
NOTIFY_FROM=            # Gmail sender address
NOTIFY_TO=              # Gmail recipient address
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=              # Gmail address
SMTP_PASSWORD=          # Gmail App Password
```

## Usage

```bash
node src/index.js --test-fetch      # Test news fetching only (no Claude, no email)
node src/index.js --test-generate   # Fetch + Claude generation → briefing-test-output.json
node src/index.js --test-email      # Full pipeline: fetch → generate → build → send
node src/index.js --run-now         # Trigger scheduler immediately (single full run)
npm start                           # Start weekly scheduler (Mondays 7 AM)
```

> **Note:** `src/scheduler.js` is a stub — `npm start` and `--run-now` are not yet functional.

## Configuration

All editorial config lives in [config.js](config.js):

| Key | Description |
|-----|-------------|
| `PUBLICATION` | Name, tagline, cron schedule |
| `CATEGORIES` | 3 article categories with Claude prompts per section |
| `TRACKED_COMPANIES` | 50+ banks, fintechs, AI vendors, regulators |
| `KEYWORDS` | Primary and secondary AI/finance signal terms |
| `RSS_FEEDS` | 12 static RSS sources |
| `NEWSAPI_QUERIES` | 5 pre-defined NewsAPI searches |
| `OUTPUT` | Max 4 articles/category, min relevance score 0.3 |
| `CLAUDE` | Claude CLI path, 20 max context articles, 120s timeout |

## Claude Integration

Content generation uses **Claude CLI via subprocess** (`spawnSync`), not the Anthropic SDK. Each of the three newsletter sections makes a separate Claude call with the prompt piped via stdin. Output is expected as JSON with regex fallback.

## Email Template

- File: [templates/email-template.html](templates/email-template.html)
- XHTML 1.0 Transitional (email client compatibility)
- Table-based layout, max-width 680px (Outlook compatible)
- All CSS inlined — `<style>` blocks are stripped by email clients
- Accent color: `#009c6d`
- Sent editions archived to `archive/{YYYY-MM-DD}.html`

## Dependencies

| Package | Purpose |
|---------|---------|
| `rss-parser` | RSS feed fetching |
| `cheerio` | HTML parsing |
| `nodemailer` | Gmail SMTP sending |
| `node-cron` | Weekly scheduler |
| `dotenv` | Environment variable loading |
