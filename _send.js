'use strict';
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const html = fs.readFileSync('_email.html', 'utf8');
const subject = fs.readFileSync('_subject.txt', 'utf8').trim();
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});
transporter.sendMail({
  from: `"AI Agents Weekly" <${process.env.NOTIFY_FROM}>`,
  to: process.env.NOTIFY_TO,
  subject,
  html
})
  .then(info => { console.log('SMTP_OK:' + info.messageId); process.exit(0); })
  .catch(e => { console.error('SMTP_FAIL:' + e.message); process.exit(1); });
