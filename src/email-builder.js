'use strict';

const fs = require('fs');
const path = require('path');
const { PUBLICATION, OUTPUT } = require('../config');

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'templates', 'email-template.html');
const ARCHIVE_DIR   = path.resolve(__dirname, '..', 'archive');

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Centralise colours so edits propagate to all rendered elements.

const T = {
  green:     '#009c6d',   // BNP Paribas Green — section headers, links, accents
  pink:      '#e91e63',   // blockquote left border
  text:      '#1a1a1a',   // primary text
  body:      '#333333',   // body paragraph text
  muted:     '#666666',   // secondary text
  faint:     '#999999',   // footer, meta
  rule:      '#e5e5e5',   // light horizontal rules
  bgLight:   '#f8f8f8',   // analysis bullet backgrounds
  serif:     "Georgia,'Times New Roman',serif",
  sans:      'Arial,Helvetica,sans-serif',
};

// ─── DATE FORMATTING ─────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(weekStart, weekEnd) {
  if (!weekStart || !weekEnd) {
    const n = new Date();
    return `${MONTHS[n.getMonth()]} ${n.getDate()}, ${n.getFullYear()}`;
  }
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  }
  return (
    `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ` +
    `${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
  );
}

function archiveFilename(weekEnd) {
  const d = weekEnd || new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `ai-agents-weekly-${yyyy}-${mm}-${dd}.html`;
}

// ─── HTML HELPERS ─────────────────────────────────────────────────────────────

/** Escape characters that are unsafe in HTML text nodes and attribute values. */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert **markdown bold** to <strong>. */
function mdBold(str) {
  return String(str || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// ─── DEEP DIVE SANITISATION + INLINE STYLING ────────────────────────────────
//
// Claude sometimes outputs stray tags like </table>, </tr>, </td>, <div> etc.
// that break the outer table structure — browsers "foster-parent" orphaned
// content to before the table, causing it to appear at the top of the page.
//
// Step 1 — sanitize: strip every tag NOT in the allowed set (keep its text).
// Step 2 — inline-style: replace bare opening tags with inline-styled versions
//          so Gmail (which strips <style> blocks) renders correctly.

const DEEP_DIVE_ALLOWED = new Set([
  'p','h2','h3','strong','em','b','i','a','ul','ol','li','br','blockquote','span',
]);

function sanitizeDeepDive(html) {
  if (!html) return '';
  // Match every HTML tag; keep it only if the tag name is in DEEP_DIVE_ALLOWED.
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tagName) => {
    return DEEP_DIVE_ALLOWED.has(tagName.toLowerCase()) ? match : '';
  });
}

function inlineStyleDeepDive(html) {
  if (!html) return '';

  // 1. Sanitize first — removes any structure-breaking tags
  const safe = sanitizeDeepDive(html);

  const pStyle  = `style="margin:0 0 16px 0;font-size:16px;color:${T.text};line-height:1.75;font-family:${T.serif};"`;
  const h3Style = `style="margin:24px 0 10px 0;font-size:12px;font-weight:bold;color:${T.green};font-family:${T.sans};text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid ${T.rule};padding-bottom:8px;"`;
  const h2Style = `style="margin:20px 0 10px 0;font-size:18px;font-weight:bold;color:${T.text};font-family:${T.serif};"`;
  const aStyle  = `style="color:${T.green};text-decoration:none;"`;
  const bqStyle = `style="margin:20px 0;padding:16px 20px;border-left:4px solid ${T.pink};background-color:${T.bgLight};font-style:italic;color:${T.body};font-family:${T.serif};font-size:16px;line-height:1.7;"`;
  const ulStyle = `style="margin:0 0 16px 0;padding:0 0 0 20px;font-size:16px;color:${T.text};line-height:1.75;font-family:${T.serif};"`;
  const liStyle = `style="margin-bottom:8px;"`;
  const emStyle = `style="color:${T.body};"`;

  // 2. Strip any existing style="" attributes to avoid duplication, then re-apply
  return safe
    .replace(/<(p|h2|h3|ul|li|ol|blockquote|em|span)\s+style="[^"]*">/g, '<$1>')
    .replace(/<p>/g,           `<p ${pStyle}>`)
    .replace(/<h3>/g,          `<h3 ${h3Style}>`)
    .replace(/<h2>/g,          `<h2 ${h2Style}>`)
    .replace(/<blockquote>/g,  `<blockquote ${bqStyle}>`)
    .replace(/<ul>/g,          `<ul ${ulStyle}>`)
    .replace(/<li>/g,          `<li ${liStyle}>`)
    .replace(/<em>/g,          `<em ${emStyle}>`)
    .replace(/<a\s+href="([^"]*)">/g, `<a href="$1" ${aStyle}>`);
}

// ─── STARTUP ENTRY RENDERER ──────────────────────────────────────────────────

function renderStartups(startups) {
  if (!startups?.items?.length) return '';

  const rows = startups.items.map((item, i) => {
    const isLast       = i === startups.items.length - 1;
    const num          = i + 1;
    const companyLink  = item.url
      ? `<a href="${esc(item.url)}" style="color:${T.green};text-decoration:none;">${esc(item.company)}</a>`
      : esc(item.company);
    const tagline      = item.tagline ? ` &mdash; <strong>${esc(item.tagline)}</strong>` : '';
    const analysis     = mdBold(esc(item.analysis));

    return `
      <!-- Startup entry ${num} -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0"
             style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">

        <!-- Company name + tagline -->
        <tr>
          <td style="padding:0 0 8px 0;font-size:16px;font-family:${T.sans};color:${T.text};line-height:1.4;">
            <strong>${num}. ${companyLink}</strong>${tagline}
          </td>
        </tr>

        <!-- Summary -->
        <tr>
          <td style="padding:0 0 10px 0;font-size:15px;font-family:${T.serif};
                     color:${T.body};line-height:1.7;">
            ${esc(item.summary)}
          </td>
        </tr>

        ${analysis ? `
        <!-- Analysis bullet -->
        <tr>
          <td style="padding:10px 14px;font-size:14px;font-family:${T.serif};
                     color:${T.body};line-height:1.6;background-color:${T.bgLight};
                     border-left:3px solid ${T.green};">
            🧠 ${analysis}
          </td>
        </tr>` : ''}

        ${!isLast ? `
        <!-- Spacer + rule between entries -->
        <tr>
          <td style="padding:20px 0 20px 0;">
            <div style="height:1px;background-color:${T.rule};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>` : `
        <!-- Spacer after last entry -->
        <tr><td style="padding-bottom:4px;font-size:0;line-height:0;">&nbsp;</td></tr>`}

      </table>`;
  });

  return rows.join('\n');
}

// ─── THINGS TO KNOW ENTRY RENDERER ───────────────────────────────────────────

function renderThingsToKnow(thingsToKnow) {
  if (!thingsToKnow?.items?.length) return '';

  const rows = thingsToKnow.items.map((item, i) => {
    const isLast   = i === thingsToKnow.items.length - 1;
    const num      = i + 1;

    // Headline: plain bold text (not linked)
    const headline = `<strong>${esc(item.headline)}</strong>`;

    // Source: linked and underlined so it's obvious it goes to the article
    const sourceEl = item.source
      ? (item.url
        ? `<a href="${esc(item.url)}" style="color:${T.green};text-decoration:underline;">${esc(item.source)}</a>`
        : esc(item.source))
      : '';

    return `
      <!-- TTK entry ${num} -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0"
             style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">

        <!-- Headline -->
        <tr>
          <td style="padding:0 0 4px 0;font-size:16px;font-family:${T.sans};
                     color:${T.text};line-height:1.4;">
            ${num}. ${headline}
          </td>
        </tr>

        <!-- Source (linked) -->
        ${sourceEl ? `
        <tr>
          <td style="padding:0 0 8px 0;font-size:12px;font-family:${T.sans};
                     color:${T.green};">
            ${sourceEl}
          </td>
        </tr>` : ''}

        <!-- Summary -->
        <tr>
          <td style="padding:0 0 10px 0;font-size:15px;font-family:${T.serif};
                     color:${T.body};line-height:1.7;">
            ${esc(item.summary)}
          </td>
        </tr>

        ${item.keyPoint ? `
        <!-- Key point callout -->
        <tr>
          <td style="padding:8px 14px;font-size:14px;font-family:${T.serif};
                     color:${T.body};line-height:1.6;background-color:${T.bgLight};
                     border-left:3px solid ${T.green};margin-bottom:6px;">
            🧠 ${mdBold(esc(item.keyPoint))}
          </td>
        </tr>
        <tr><td style="padding-bottom:6px;font-size:0;line-height:0;">&nbsp;</td></tr>` : ''}

        ${!isLast ? `
        <!-- Rule between entries -->
        <tr>
          <td style="padding:16px 0 20px 0;">
            <div style="height:1px;background-color:${T.rule};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>` : `
        <!-- Spacer after last entry -->
        <tr><td style="padding-bottom:4px;font-size:0;line-height:0;">&nbsp;</td></tr>`}

      </table>`;
  });

  return rows.join('\n');
}

// ─── TEMPLATE POPULATION ─────────────────────────────────────────────────────

function populateTemplate(template, vars) {
  return Object.entries(vars).reduce((html, [key, value]) => {
    // Use a replacement *function* (not a string) so that $ characters in
    // the value (e.g. "$57M", "$0.01") are never interpreted as regex
    // back-references by String.prototype.replace.
    return html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value);
  }, template);
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Build the final HTML email from briefing content and fetch metadata.
 * Saves the rendered HTML to /archive and returns it as a string.
 *
 * @param {object} briefing  - return value of content-generator.generateBriefing()
 * @param {object} fetchMeta - { weekStart: Date, weekEnd: Date }
 * @returns {{ html: string, subject: string, archivePath: string }}
 */
function buildEmail(briefing, fetchMeta = {}) {
  const { weekStart, weekEnd } = fetchMeta;
  const dateStr      = formatDate(weekStart, weekEnd);
  const deepDiveTitle = briefing.deepDive?.title || 'This Week in AI';
  const subject       = `🤖 ${PUBLICATION.name} — ${deepDiveTitle} | ${dateStr}`;

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const html = populateTemplate(template, {
    subject:              subject,
    date:                 dateStr,
    deepDiveTitle:        esc(briefing.deepDive?.title || 'This Week in AI'),
    deepDiveContent:      inlineStyleDeepDive(briefing.deepDive?.html || ''),
    startupEntries:       renderStartups(briefing.startups),
    thingsToKnowEntries:  renderThingsToKnow(briefing.thingsToKnow),
  });

  // Save to archive
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const filename    = archiveFilename(weekEnd);
  const archivePath = path.join(ARCHIVE_DIR, filename);
  fs.writeFileSync(archivePath, html, 'utf8');
  console.log(`[email-builder] Saved → ${archivePath}`);

  return { html, subject, archivePath };
}

module.exports = { buildEmail };
