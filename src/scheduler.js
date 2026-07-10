'use strict';

const cron                  = require('node-cron');
const { PUBLICATION }       = require('../config');
const { fetchAll }          = require('./news-fetcher');
const { generateBriefing }  = require('./content-generator');
const { buildEmail }        = require('./email-builder');
const { sendEmail }         = require('./email-sender');

async function runPipeline() {
  console.log(`[scheduler] Pipeline started at ${new Date().toISOString()}`);
  try {
    const fetchResult       = await fetchAll();
    const briefing          = await generateBriefing(fetchResult);
    const { html, subject, archivePath } = buildEmail(briefing, {
      weekStart: fetchResult.weekStart,
      weekEnd:   fetchResult.weekEnd,
    });
    console.log(`[scheduler] Built email — subject: "${subject}"`);
    console.log(`[scheduler] Archive: ${archivePath}`);
    await sendEmail(html, subject);
    console.log(`[scheduler] Pipeline complete at ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[scheduler] Pipeline failed at ${new Date().toISOString()}:`, err);
  }
}

function start() {
  if (process.env.RUN_NOW === 'true') {
    console.log('[scheduler] --run-now flag detected — executing pipeline immediately');
    runPipeline();
    return;
  }

  const schedule = PUBLICATION.schedule;
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression in config.js: "${schedule}"`);
  }

  console.log(`[scheduler] Starting — cron schedule: "${schedule}"`);
  cron.schedule(schedule, () => {
    console.log(`[scheduler] Cron triggered at ${new Date().toISOString()}`);
    runPipeline();
  });
}

module.exports = { start };
