'use strict';
require('dotenv').config();
const fs = require('fs');
const { fetchAll } = require('./src/news-fetcher');

// ─── CROSS-RUN DEDUPLICATION ─────────────────────────────────────────────────
// _seen-urls.json tracks article URLs already used in previous daily editions
// so the same article never appears twice within the rolling window.

const SEEN_PATH = '_seen-urls.json';
const SEEN_WINDOW_DAYS = 7; // keep URL history for 7 days then expire

function loadSeen() {
  if (!fs.existsSync(SEEN_PATH)) return { seenUrls: new Set(), entries: [] };
  try {
    const { entries = [] } = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SEEN_WINDOW_DAYS);
    // Expire entries older than the rolling window
    const fresh = entries.filter(e => new Date(e.seenAt) >= cutoff);
    return { seenUrls: new Set(fresh.map(e => e.url)), entries: fresh };
  } catch {
    return { seenUrls: new Set(), entries: [] };
  }
}

function saveSeen(existingEntries, newUrls) {
  const today = new Date().toISOString().split('T')[0];
  const added = newUrls
    .filter(url => url)
    .map(url => ({ url, seenAt: today }));
  fs.writeFileSync(SEEN_PATH, JSON.stringify({ entries: [...existingEntries, ...added] }, null, 2));
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

fetchAll()
  .then(r => {
    const { seenUrls, entries: existingEntries } = loadSeen();

    const cap = arr => arr
      .filter(a => !seenUrls.has(a.url))           // exclude previously seen articles
      .slice(0, 10)
      .map(a => ({
        title: a.title,
        url: a.url,
        source: a.source,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString().split('T')[0] : null,
        snippet: (a.snippet || '').slice(0, 200),
      }));

    const out = {
      category1: cap(r.category1),
      category2: cap(r.category2),
      category3: cap(r.category3),
      weekStart: r.weekStart.toISOString().split('T')[0],
      weekEnd:   r.weekEnd.toISOString().split('T')[0],
    };

    fs.writeFileSync('_articles.json', JSON.stringify(out, null, 2));

    // Mark all fetched article URLs as seen so they won't repeat tomorrow
    const allFetched = [...r.category1, ...r.category2, ...r.category3]
      .map(a => a.url)
      .filter(url => url && !seenUrls.has(url));
    saveSeen(existingEntries, allFetched);

    const total = out.category1.length + out.category2.length + out.category3.length;
    const skipped = (r.category1.length + r.category2.length + r.category3.length) - total;
    console.log(`cat1=${out.category1.length} cat2=${out.category2.length} cat3=${out.category3.length} (${skipped} skipped — already seen)`);
    if (total === 0) {
      console.log('FALLBACK_NEEDED: all sources returned 0 articles — activate WebSearch fallback (see CLAUDE.md)');
    }
    // RSS/Google News requests raced against withTimeout() leave their underlying
    // sockets open when the timeout wins — those dangling sockets keep the event
    // loop alive indefinitely even though all work is done. Exit explicitly.
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
