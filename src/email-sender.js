'use strict';

const nodemailer = require('nodemailer');

// ─── TRANSPORTER ─────────────────────────────────────────────────────────────

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;

  if (!SMTP_USER || !SMTP_PASSWORD) {
    throw new Error(
      'Email credentials missing. Set SMTP_USER and SMTP_PASSWORD in .env\n' +
      '(SMTP_PASSWORD should be a Gmail App Password, not your regular password.)'
    );
  }

  return nodemailer.createTransport({
    host:   SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(SMTP_PORT || '587', 10),
    secure: false,   // STARTTLS on port 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

// ─── RETRY WITH EXPONENTIAL BACKOFF ──────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry(transporter, mailOptions, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[email-sender] Sent on attempt ${attempt} → Message ID: ${info.messageId}`);
      return info;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2 s, 4 s
        console.warn(
          `[email-sender] Attempt ${attempt}/${maxAttempts} failed: ${err.message}. ` +
          `Retrying in ${delayMs / 1000}s...`
        );
        await sleep(delayMs);
      }
    }
  }
  throw new Error(
    `[email-sender] All ${maxAttempts} send attempts failed. Last error: ${lastError.message}`
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Send the HTML briefing email via Gmail SMTP.
 * Sender  = NOTIFY_FROM (or SMTP_USER)
 * Recipient = NOTIFY_TO  (or same as sender)
 *
 * @param {string} html    - fully rendered HTML from email-builder
 * @param {string} subject - email subject line
 * @returns {Promise<object>} Nodemailer info object
 */
async function sendEmail(html, subject) {
  const from = process.env.NOTIFY_FROM || process.env.SMTP_USER;
  const to   = process.env.NOTIFY_TO   || from;

  if (!from) throw new Error('NOTIFY_FROM (or SMTP_USER) is not set in .env');

  const transporter = createTransporter();

  // Verify SMTP credentials before attempting to send
  try {
    await transporter.verify();
    console.log('[email-sender] SMTP connection verified');
  } catch (err) {
    throw new Error(
      `SMTP connection failed: ${err.message}\n` +
      'Check SMTP_USER, SMTP_PASSWORD (App Password), SMTP_HOST, SMTP_PORT in .env'
    );
  }

  const mailOptions = {
    from:    `"${process.env.PUBLICATION_NAME || 'AI Agents Weekly'}" <${from}>`,
    to,
    subject,
    html,
    // Plain-text fallback — strip HTML tags
    text: html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  };

  console.log(`[email-sender] Sending to ${to} — "${subject}"`);
  return sendWithRetry(transporter, mailOptions);
}

module.exports = { sendEmail };
