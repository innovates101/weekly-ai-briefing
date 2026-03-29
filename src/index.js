'use strict';
require('dotenv').config();

const args = process.argv.slice(2);

// ── --test-fetch: run only the news fetcher and print a summary ──────────────
if (args.includes('--test-fetch')) {
  const { fetchAll, printSummary } = require('./news-fetcher');
  fetchAll()
    .then(result => printSummary(result))
    .catch(err => { console.error('[test-fetch] Fatal error:', err); process.exit(1); });
  return;
}

// ── --test-generate: fetch + generate content, print raw JSON result ─────────
if (args.includes('--test-generate')) {
  const { fetchAll } = require('./news-fetcher');
  const { generateBriefing } = require('./content-generator');
  fetchAll()
    .then(fetchResult => generateBriefing(fetchResult))
    .then(briefing => {
      console.log('\n══════════════════════════════════════════════════════');
      console.log(' Deep Dive Title:', briefing.deepDive.title);
      console.log('──────────────────────────────────────────────────────');
      console.log(' Deep Dive HTML (first 500 chars):');
      console.log(briefing.deepDive.html.slice(0, 500));
      console.log('──────────────────────────────────────────────────────');
      console.log(' Startups:', briefing.startups.items.map(i => i.company).join(', '));
      console.log('──────────────────────────────────────────────────────');
      console.log(' Things to Know:', briefing.thingsToKnow.items.map(i => i.headline.slice(0, 60)).join('\n  '));
      console.log('══════════════════════════════════════════════════════\n');
      // Also write full JSON to a temp file for inspection
      const outFile = 'briefing-test-output.json';
      require('fs').writeFileSync(outFile, JSON.stringify(briefing, null, 2));
      console.log(`Full output written to ${outFile}`);
    })
    .catch(err => { console.error('[test-generate] Fatal error:', err); process.exit(1); });
  return;
}

// ── --test-email: full pipeline — fetch, generate, build, send ───────────────
if (args.includes('--test-email')) {
  const { fetchAll }         = require('./news-fetcher');
  const { generateBriefing } = require('./content-generator');
  const { buildEmail }       = require('./email-builder');
  const { sendEmail }        = require('./email-sender');

  fetchAll()
    .then(fetchResult =>
      generateBriefing(fetchResult).then(briefing => ({ briefing, fetchResult }))
    )
    .then(({ briefing, fetchResult }) => {
      const { html, subject, archivePath } = buildEmail(briefing, {
        weekStart: fetchResult.weekStart,
        weekEnd:   fetchResult.weekEnd,
      });
      console.log(`[index] Built email — subject: "${subject}"`);
      console.log(`[index] Archive: ${archivePath}`);
      return sendEmail(html, subject);
    })
    .then(() => console.log('[index] Done — email sent successfully.'))
    .catch(err => { console.error('[test-email] Fatal error:', err); process.exit(1); });
  return;
}

// ── All other modes go through the scheduler ─────────────────────────────────
const { start } = require('./scheduler');

if (args.includes('--run-now')) process.env.RUN_NOW = 'true';

start();
