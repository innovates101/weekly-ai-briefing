Newsletter format modeled after: https://www.fintechbrainfood.com/p/private-credit-is-cooked 

Required accounts in env.
A Gmail App Password (Google Account → Security → 2-Step Verification → App Passwords)
A NewsAPI.org key (free tier)


Weekly Newsletter 



**Part 1: Project Setup \& Architecture**

I want to build a weekly AI briefing email system. Here's the project overview:



PROJECT: "AI Agents Weekly" — A weekly email briefing on AI developments impacting financial institutions.



TECH STACK:

\- Node.js (or Python, your recommendation for reliability)

\- News aggregation via RSS feeds + web scraping + news APIs (e.g., NewsAPI, Google News RSS, Bing News Search API)

\- Claude CLI (`claude` command) for summarization, analysis, and editorial commentary — I have an active Claude subscription and the CLI installed. Do NOT use the Anthropic API. Instead, invoke Claude via the CLI using child\_process (e.g., `echo "prompt" | claude --print`). The `--print` flag makes it output the response directly to stdout without interactive mode.

\- Email delivery via Gmail SMTP (using Nodemailer with my connected Gmail account)

\- Scheduler via cron job (node-cron or system cron)

\- Store weekly editions in a local /archive folder as HTML files



STEP 1: Set up the project structure with:

\- /src directory with modules for: news-fetcher, content-generator, email-builder, email-sender, scheduler

\- /templates directory for the HTML email template

\- /archive directory for saved weekly editions

\- .env for configuration (NEWS\_API\_KEY, GMAIL\_ADDRESS, GMAIL\_APP\_PASSWORD)

&#x20; - GMAIL\_ADDRESS: my Gmail address (used as both sender AND recipient)

&#x20; - GMAIL\_APP\_PASSWORD: a Gmail App Password (not my regular password — I'll generate one from Google Account > Security > App Passwords)

&#x20; - No Anthropic API key needed — we use the Claude CLI via my subscription

\- package.json with all dependencies (include nodemailer, rss-parser, node-cron, dotenv, cheerio)

\- A config.js with the list of sources, tracked companies, and category definitions



Set this up now. Don't build the modules yet — just the scaffolding, config, and dependency installation.





**Part 2: News Source Configuration \& Fetcher**



Now build the news-fetcher module (src/news-fetcher.js).



It should aggregate news from the LAST 7 DAYS across three categories:



CATEGORY 1 — "Agentic AI Startups — Game-Changing Initiatives"

Track: product launches, funding rounds, partnerships, capability announcements.

Companies to monitor: MiroFish, OpenClaw, LangChain, CrewAI, Composio, Relay.app, Dust, AgentOps, E2B, Convergence AI, Letta, Cognition AI, Sierra, Cohere, Imbue, Factory AI, Magic.dev — plus any notable new entrants.

Search terms: "agentic AI startup", "AI agent funding", "AI agent launch", "autonomous AI startup", "\[company name] AI" for each tracked company.



CATEGORY 2 — "Agentic AI in Financial Institutions"

Track: Banks, insurers, asset managers, payments firms, regulators announcing or piloting agentic AI.

Search terms: "bank AI agent", "insurance AI automation", "asset management AI", "payments AI agent", "financial regulator AI", "agentic AI banking", "autonomous AI finance".



CATEGORY 3 — "New Model Developments"

Track: New releases or capability updates from OpenAI, Anthropic, Google DeepMind, Meta AI, Mistral, xAI, Cohere, and notable open-source model releases.

Search terms: "OpenAI release", "Anthropic Claude update", "Google DeepMind model", "Meta Llama", "Mistral AI", "xAI Grok", "open source LLM release", "foundation model benchmark".



NEWS SOURCES to query:

\- NewsAPI.org (use /everything endpoint with category-specific queries, dateFrom set to 7 days ago)

\- Google News RSS feeds (parse via rss-parser)

\- TechCrunch RSS, The Verge AI RSS, VentureBeat AI RSS

\- ArsTechnica AI RSS

\- Specific finance-tech sources: American Banker, Financial Times tech section RSS, Bloomberg technology RSS if available



For each article fetched, extract: title, source, URL, published date, snippet/description, and assign it to a category.



Deduplicate by URL and by title similarity (use simple string similarity > 0.8 threshold to catch near-duplicates).



Filter to last 7 days only.



Return a structured object: { category1: \[...articles], category2: \[...articles], category3: \[...articles], weekStart: date, weekEnd: date, fetchedAt: timestamp }



***Part 3: Content Generator (Claude CLI Integration)***

Now build the content-generator module (src/content-generator.js).



This module takes the structured news output from the fetcher and uses the Claude CLI to generate the briefing content.



IMPORTANT: Do NOT use the Anthropic API or any SDK. I have an active Claude subscription with the CLI installed. Invoke Claude like this:



const { execSync } = require('child\_process');



function callClaude(prompt) {

&#x20; // Write prompt to a temp file to avoid shell escaping issues with long prompts

&#x20; const tmpFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);

&#x20; fs.writeFileSync(tmpFile, prompt);

&#x20; try {

&#x20;   const result = execSync(`cat "${tmpFile}" | claude --print`, {

&#x20;     encoding: 'utf-8',

&#x20;     timeout: 120000, // 2 minute timeout

&#x20;     maxBuffer: 1024 \* 1024 // 1MB buffer for long responses

&#x20;   });

&#x20;   return result.trim();

&#x20; } finally {

&#x20;   fs.unlinkSync(tmpFile); // clean up

&#x20; }

}



Use this pattern for all Claude calls below.



SECTION 1: "Deep Dive" (equivalent to Fintech Brainfood's "Weekly Rant")

\- From all fetched articles across the week, identify the SINGLE most significant story — the one with the biggest implications for financial institutions.

\- Send Claude a prompt asking it to write a 500-800 word deep-dive analysis in a conversational, opinionated voice. Since this is weekly, it can be more comprehensive than a daily take. It should:

&#x20; - Open with a punchy, attention-grabbing first line

&#x20; - Explain what happened and why it matters

&#x20; - Provide financial institution context: how does this affect banks, insurers, asset managers, payments companies?

&#x20; - Connect it to the broader week's developments if relevant

&#x20; - Include a "So What?" perspective — what should a CTO, Chief Innovation Officer, or Head of Strategy at a bank be thinking?

&#x20; - Use subheadings to break up the analysis

&#x20; - Tone: smart, direct, slightly informal, no corporate jargon. Think "senior analyst who also reads a lot of sci-fi."



SECTION 2: "Agentic AI Startups to Watch" (equivalent to "4 Fintech Companies")

\- Select the top 4-5 most noteworthy startup stories of the week from Category 1.

\- For each, Claude should generate:

&#x20; - A numbered entry with format: "1. \[Company Name] — \[One-line description of what they do]"

&#x20; - A 2-3 sentence factual summary of the news

&#x20; - A "🧠" analysis bullet: a brief opinionated take (1-3 sentences) on why this matters, what's different, or what to watch. Bold the lead-in phrase of the analysis.



SECTION 3: "Things to Know" (equivalent to "Things to Know")

\- Select the top 4-6 stories of the week from Category 2 (AI in financial institutions) and Category 3 (model developments) combined.

\- For each, Claude should generate:

&#x20; - A numbered entry with the headline as an italic hyperlink

&#x20; - A 2-4 sentence factual summary

&#x20; - 1-3 "🧠" analysis bullets, each with a bold lead-in sentence followed by the analysis. These should highlight implications for financial institutions.



Each section prompt should explicitly instruct Claude to write in the style of Fintech Brainfood: conversational, opinionated, emoji-accented section headers, bold key phrases, direct and punchy.



Make separate Claude CLI calls for each section to stay within context limits and keep responses focused.



Return the output as a structured object: { deepDive: { title, html }, startups: { items: \[...] }, thingsToKnow: { items: \[...] }, generatedAt: timestamp }



***Part 4: HTML Email Template***

Now build the email template (templates/email-template.html).

This should be a responsive HTML email template that closely mirrors the Fintech Brainfood newsletter aesthetic. Here are the EXACT design specifications:

OVERALL LAYOUT:
- Max-width: 680px, centered
- Background: white (#ffffff)
- Font: Georgia or serif fallback for body text, system sans-serif for headers
- Text color: #1a1a1a
- Line height: 1.7 for body text
- Generous padding: 20-30px on sides

HEADER:
- Small logo/icon area at top (use a 🤖 emoji as placeholder or a simple SVG brain icon)
- Title in large, bold serif: "AI Agents Weekly"
- Subtitle/tagline in smaller gray text: "AI developments that matter for financial institutions"
- Week range line below in small gray text (e.g., "Week of March 18 – March 25, 2026")

SECTION HEADERS:
- Color: #d63384 (pink, matching Fintech Brainfood's style)
- Font-size: 22px, bold
- Each followed by a relevant emoji:
  - Deep Dive section: "Deep Dive 🔍"
  - Startups section: "Agentic Startups to Watch 🚀"
  - Things to Know section: "Things to Know 👀"
- Margin-top: 40px before each section

SECTION DIVIDERS:
- A centered horizontal line between sections
- Color: #d63384 (pink)
- Width: 50% of container
- Height: 3px
- Margin: 30px auto

DEEP DIVE SECTION:
- Title of the deep dive article in bold, larger font
- Body text in regular serif
- Subheadings within the deep dive in bold sans-serif
- Key bold phrases inline
- Block quotes styled with left pink border, gray background (#f8f8f8), italic text

STARTUP ENTRIES:
- Numbered: "1.", "2.", etc.
- Company name as a hyperlink (color: #d63384)
- Dash then bold one-liner description
- Summary paragraph below
- Analysis bullets prefixed with 🧠 emoji, with bold lead-in phrase

THINGS TO KNOW ENTRIES:
- Numbered: "1.", "2.", etc.
- Headline as italic hyperlink
- Summary paragraph
- Multiple 🧠 analysis bullets, each with bold lead-in

FOOTER:
- Pink divider line
- Sign-off: "That's all for this week. 👋"
- Small gray disclaimer text: "This briefing is auto-generated using AI and may contain errors. Always verify before acting on any information."

The template should use Handlebars-style {{placeholders}} for dynamic content injection:
- {{weekRange}} (e.g., "March 18 – March 25, 2026")
- {{deepDiveTitle}}
- {{deepDiveContent}}
- {{startupEntries}} (loop)
- {{thingsToKnowEntries}} (loop)

Make sure all CSS is INLINED (email clients strip <style> tags). Use table-based layout for maximum email client compatibility.

Build this template now.

***Part 5: Email Builder & Sender***

Now build two modules:

1. src/email-builder.js
- Takes the structured content from content-generator and the HTML template
- Injects content into the template placeholders
- Formats the week range nicely (e.g., "March 18 – March 25, 2026")
- Converts the structured startup and thingsToKnow arrays into HTML list entries matching the template structure
- Saves a copy of the final HTML to /archive/YYYY-MM-DD.html
- Returns the final HTML string

2. src/email-sender.js
- Uses Nodemailer with Gmail SMTP to send the email TO MYSELF
- Configuration:
  - SMTP host: smtp.gmail.com
  - Port: 587
  - Secure: false (STARTTLS)
  - Auth: { user: process.env.GMAIL_ADDRESS, pass: process.env.GMAIL_APP_PASSWORD }
- From address: process.env.GMAIL_ADDRESS (sending from my own Gmail)
- To address: process.env.GMAIL_ADDRESS (sending TO my own Gmail — same address)
- Subject line format: "🤖 AI Agents Weekly — [Deep Dive Title] | Week of [Date Range]"
- Sends the HTML email
- Logs success/failure
- Includes retry logic: 3 attempts with exponential backoff

NOTE: I will generate a Gmail App Password (Google Account > Security > 2-Step Verification > App Passwords). This is NOT my regular Gmail password. The App Password goes in .env as GMAIL_APP_PASSWORD.



***Part 6: Scheduler & Main Orchestrator***

Now build the orchestrator and scheduler:

1. src/index.js (main orchestrator)
- Runs the full pipeline:
  a. Fetch news from the last 7 days (news-fetcher)
  b. Generate content via Claude CLI (content-generator)
  c. Build email HTML (email-builder)
  d. Send email to myself via Gmail (email-sender)
- Wrap everything in try/catch with clear error logging
- Log timing for each step
- Add a --test flag that runs the pipeline once immediately (for testing)
- Add a --dry-run flag that does everything except send the email (saves to /archive only)

2. src/scheduler.js
- Uses node-cron to schedule the pipeline to run ONCE PER WEEK
- Default schedule: Every Sunday at 8:00 AM ET (cron: '0 8 * * 0' in America/New_York timezone)
- Logs next scheduled run time on startup
- Handles graceful shutdown

3. Update package.json scripts:
- "start": runs the scheduler (production mode, weekly)
- "test-run": runs the pipeline once immediately
- "dry-run": runs pipeline without sending email

4. Create a README.md with:
- Project description
- Setup instructions:
  - How to generate a Gmail App Password (step by step)
  - How to get a NewsAPI key
  - How to ensure Claude CLI is installed and authenticated (`claude --version` to verify)
  - .env file setup
- How to do a test run
- How to deploy (suggest Railway, Render, or a simple VPS with PM2)
- Note: "This uses your Claude subscription via the CLI — no Anthropic API key needed"


***Part 7: Testing & Polish***
Now let's test and polish:

1. Run the pipeline with --dry-run flag. Check the output HTML in /archive.

2. Review the generated HTML email:
   - Does it render correctly?
   - Are the sections properly structured?
   - Do the pink dividers show?
   - Are emojis rendering?
   - Is the 🧠 analysis formatted correctly with bold lead-ins?

3. Fix any issues you find.

4. Add error handling for:
   - What if no news is found for a category? (Show "No major developments this week" placeholder)
   - What if the Claude CLI call fails or times out? (Retry 3x, then send a minimal "generation error" notification email to myself)
   - What if a news API returns errors? (Log and continue with other sources)
   - What if Gmail SMTP fails? (Retry with backoff, log the error, save the edition to /archive so it's not lost)

5. Add a simple rate-limit handler for news API calls.

6. Send a real test email to myself using --test flag. Confirm it arrives in my Gmail inbox and looks correct.

7. Verify the weekly cron schedule is correct (Sunday 8:00 AM ET).