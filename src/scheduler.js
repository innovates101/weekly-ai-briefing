'use strict';

const cron = require('node-cron');
const { PUBLICATION } = require('../config');
const { fetchAll }        = require('./news-fetcher');
const { generateBriefing } = require('./content-generator');
const { buildEmail }      = require('./email-builder');
const { sendEmail }       = require('./email-sender');

async function runPipeline() {
  console.log('[scheduler] Starting daily pipeline run...');
  try {
    const fetchResult = await fetchAll();
    const briefing    = await generateBriefing(fetchResult);
    const { html, subject } = buildEmail(briefing, {
      weekStart: fetchResult.weekStart,
      weekEnd:   fetchResult.weekEnd,
    });
    await sendEmail(html, subject);
    console.log('[scheduler] Pipeline complete — email sent.');
  } catch (err) {
    console.error('[scheduler] Pipeline error:', err.message);
  }
}

module.exports = {
  start() {
    if (process.env.RUN_NOW === 'true') {
      runPipeline();
      return;
    }
    console.log(`[scheduler] Daily schedule active: "${PUBLICATION.schedule}" (${PUBLICATION.name})`);
    cron.schedule(PUBLICATION.schedule, () => {
      console.log('[scheduler] Cron triggered — running pipeline');
      runPipeline();
    });
  },
};
