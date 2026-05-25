'use strict';
require('dotenv').config();
const fs = require('fs');
const { generateBriefing } = require('./src/content-generator');

const raw = JSON.parse(fs.readFileSync('_articles.json', 'utf8'));

// Convert ISO date strings back to Date objects for the generator
const toDate = s => (s ? new Date(s) : null);
const hydrate = arr => arr.map(a => ({ ...a, publishedAt: toDate(a.publishedAt) }));

const fetchResult = {
  category1: hydrate(raw.category1),
  category2: hydrate(raw.category2),
  category3: hydrate(raw.category3),
  weekStart: new Date(raw.weekStart),
  weekEnd:   new Date(raw.weekEnd),
};

generateBriefing(fetchResult)
  .then(briefing => {
    fs.writeFileSync('_briefing.json', JSON.stringify(briefing, null, 2));
    console.log('Deep Dive:', briefing.deepDive.title);
    console.log(`Startups: ${briefing.startups.items.length} | Things to Know: ${briefing.thingsToKnow.items.length}`);
  })
  .catch(e => { console.error('Generate failed:', e.message); process.exit(1); });
