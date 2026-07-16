'use strict';
// _mark-seen.js — records article URLs from _articles.json into _seen-urls.json.
// Run this after writing _articles.json (including via the WebSearch fallback) so
// cross-run deduplication works even when _fetch.js fetches 0 articles from the APIs.
const fs = require('fs');

const SEEN_PATH        = '_seen-urls.json';
const ARTICLES_PATH    = '_articles.json';
const SEEN_WINDOW_DAYS = 7;

function loadSeen() {
  if (!fs.existsSync(SEEN_PATH)) return { seenUrls: new Set(), entries: [] };
  try {
    const { entries = [] } = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SEEN_WINDOW_DAYS);
    const fresh = entries.filter(e => new Date(e.seenAt) >= cutoff);
    return { seenUrls: new Set(fresh.map(e => e.url)), entries: fresh };
  } catch {
    return { seenUrls: new Set(), entries: [] };
  }
}

const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
const allUrls = [
  ...(articles.category1 || []),
  ...(articles.category2 || []),
  ...(articles.category3 || []),
].map(a => a.url).filter(Boolean);

const { seenUrls, entries } = loadSeen();
const today   = new Date().toISOString().split('T')[0];
const newUrls = allUrls.filter(url => !seenUrls.has(url));
const added   = newUrls.map(url => ({ url, seenAt: today }));

fs.writeFileSync(SEEN_PATH, JSON.stringify({ entries: [...entries, ...added] }, null, 2));
console.log(`[mark-seen] Marked ${added.length} new URL(s) as seen (${allUrls.length - added.length} already tracked).`);
