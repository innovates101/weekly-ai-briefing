'use strict';
require('dotenv').config();
const { fetchAll } = require('./src/news-fetcher');
fetchAll()
  .then(r => {
    const cap = arr => arr.slice(0, 10).map(a => ({
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
      weekEnd: r.weekEnd.toISOString().split('T')[0],
    };
    require('fs').writeFileSync('_articles.json', JSON.stringify(out, null, 2));
    console.log(`cat1=${out.category1.length} cat2=${out.category2.length} cat3=${out.category3.length}`);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
