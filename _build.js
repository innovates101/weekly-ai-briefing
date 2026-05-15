'use strict';
require('dotenv').config();
const { buildEmail } = require('./src/email-builder');
const briefing = require('./_briefing.json');
const { html, subject } = buildEmail(briefing, {});
require('fs').writeFileSync('_email.html', html, 'utf8');
require('fs').writeFileSync('_subject.txt', subject, 'utf8');
console.log('Subject:', subject);
