'use strict';
require('dotenv').config();

const fs = require('fs');
const { buildEmail } = require('./src/email-builder');

const briefingFile = 'briefing-test-output.json';
if (!fs.existsSync(briefingFile)) {
  console.error('briefing-test-output.json not found. Run --test-generate first.');
  process.exit(1);
}

const briefing = JSON.parse(fs.readFileSync(briefingFile, 'utf8'));

const weekEnd   = new Date();
const weekStart = new Date();
weekStart.setDate(weekStart.getDate() - 7);

const { html, subject, archivePath } = buildEmail(briefing, { weekStart, weekEnd });

console.log('Subject :', subject);
console.log('Archive :', archivePath);
console.log('Size    :', (html.length / 1024).toFixed(1), 'KB');
