const RSSParser = require('rss-parser');
const cheerio = require('cheerio');

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'Iroyinayo/1.0 (News Aggregator)' },
});

// --- Source definitions ---
// Each source has: name, category, type (rss|scrape), url, and a parser

const SOURCES = [
  // Scholarships
  {
    name: 'Opportunities For Africans',
    category: 'scholarships',
    type: 'rss',
    url: 'https://opportunitiesforafricans.com/feed/',
  },
  {
    name: 'Scholarship Region',
    category: 'scholarships',
    type: 'rss',
    url: 'https://scholarshipregion.com/feed/',
  },

  // Tech
  {
    name: 'TechCabal',
    category: 'tech',
    type: 'rss',
    url: 'https://techcabal.com/feed/',
  },
  {
    name: 'TechPoint Africa',
    category: 'tech',
    type: 'rss',
    url: 'https://techpoint.africa/feed/',
  },

  // Sports
  {
    name: 'BBC Sport Africa',
    category: 'sports',
    type: 'rss',
    url: 'https://feeds.bbci.co.uk/sport/africa/rss.xml',
  },

  // Campus News
  {
    name: 'Unilorin Bulletin',
    category: 'campus_news',
    type: 'scrape',
    url: 'https://www.unilorin.edu.ng/index.php/news',
    scraper: scrapeUnilorin,
  },

  // Career
  {
    name: 'Jobberman Blog',
    category: 'career',
    type: 'rss',
    url: 'https://www.jobberman.com/blog/feed/',
  },

  // Health
  {
    name: 'WHO Africa',
    category: 'health',
    type: 'rss',
    url: 'https://www.afro.who.int/rss.xml',
  },

  // Entertainment
  {
    name: 'BellaNaija',
    category: 'entertainment',
    type: 'rss',
    url: 'https://www.bellanaija.com/feed/',
  },

  // Academic
  {
    name: 'Punch Education',
    category: 'academic',
    type: 'rss',
    url: 'https://punchng.com/topics/education/feed/',
  },
];

// --- Fetchers ---

async function fetchRSS(source) {
  try {
    const feed = await parser.parseURL(source.url);
    return feed.items.slice(0, 5).map((item) => ({
      title: item.title || '',
      summary: stripHtml(item.contentSnippet || item.content || item.summary || ''),
      url: item.link || '',
      date: item.pubDate || item.isoDate || '',
      source: source.name,
      category: source.category,
    }));
  } catch (err) {
    console.error(`RSS fetch failed for ${source.name}: ${err.message}`);
    return [];
  }
}

async function fetchScrape(source) {
  try {
    return await source.scraper(source);
  } catch (err) {
    console.error(`Scrape failed for ${source.name}: ${err.message}`);
    return [];
  }
}

async function scrapeUnilorin(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Iroyinayo/1.0 (News Aggregator)' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const articles = [];

    // Unilorin news page typically lists articles with titles and snippets
    $('article, .news-item, .post, .item, h3 a, h2 a').each((i, el) => {
      if (articles.length >= 5) return false;
      const $el = $(el);
      const title = $el.find('h2, h3, .title').first().text().trim() || $el.text().trim();
      const summary = $el.find('p, .excerpt, .summary').first().text().trim();
      const url = $el.find('a').first().attr('href') || $el.attr('href') || '';

      if (title && title.length > 10) {
        articles.push({
          title,
          summary: summary.slice(0, 300),
          url: url.startsWith('http') ? url : `https://www.unilorin.edu.ng${url}`,
          date: new Date().toISOString(),
          source: source.name,
          category: source.category,
        });
      }
    });

    return articles;
  } catch (err) {
    console.error(`Unilorin scrape failed: ${err.message}`);
    return [];
  }
}

// --- Main fetch function ---

async function fetchNewsForCategory(category) {
  const sources = SOURCES.filter((s) => s.category === category);
  const results = [];

  for (const source of sources) {
    const articles = source.type === 'rss'
      ? await fetchRSS(source)
      : await fetchScrape(source);
    results.push(...articles);
  }

  return results;
}

async function fetchAllNews() {
  const categories = [...new Set(SOURCES.map((s) => s.category))];
  const allNews = {};

  await Promise.all(
    categories.map(async (category) => {
      allNews[category] = await fetchNewsForCategory(category);
    })
  );

  return allNews;
}

// --- Helpers ---

function stripHtml(html) {
  if (!html) return '';
  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, ' ').trim().slice(0, 500);
}

module.exports = { SOURCES, fetchNewsForCategory, fetchAllNews, fetchRSS, fetchScrape };
