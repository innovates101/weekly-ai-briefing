'use strict';
// _send.js — prepares Gmail MCP draft parameters, then signals Claude to send.
// SMTP is not used: it reliably times out in cloud/sandboxed environments.
require('dotenv').config();
const fs = require('fs');

const html    = fs.readFileSync('_email.html', 'utf8');
const subject = fs.readFileSync('_subject.txt', 'utf8').trim();

// NOTIFY_TO may be comma-separated; split into an array for Gmail MCP.
const to = (process.env.NOTIFY_TO || process.env.SMTP_USER || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!to.length) {
  console.error('GMAIL_FAIL:NOTIFY_TO is not set in .env');
  process.exit(1);
}

// Write draft parameters to a file so the calling process can read them
// without having to re-read the full HTML itself.
const params = { to, subject, htmlBody: html };
fs.writeFileSync('_draft-params.json', JSON.stringify(params, null, 2));

console.log(`GMAIL_MCP_READY:${to.join(',')}`);
process.exit(0);
