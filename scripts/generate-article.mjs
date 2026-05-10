import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BLOG_DIR = path.join(ROOT, 'src/pages/blog');
const INDEX_FILE = path.join(ROOT, 'src/pages/blog/index.astro');
const SITEMAP_FILE = path.join(ROOT, 'src/pages/sitemap.xml.js');

const client = new Anthropic();

const topics = JSON.parse(fs.readFileSync(path.join(__dirname, 'topics.json'), 'utf-8'));

const existingSlugs = new Set(
  fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''))
);

const nextTopic = topics.find(t => !existingSlugs.has(t.slug));

if (!nextTopic) {
  console.log('All topics have been published.');
  process.exit(0);
}

console.log(`Generating: "${nextTopic.title}"`);

const dateStr = new Date().toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric'
});

const prompt = `You are writing a blog article for PestControl Cyprus (pestcontrolcyp.com), a professional pest control company serving homeowners and businesses across Cyprus.

Topic: "${nextTopic.title}"
Category: "${nextTopic.category}"
Date: "${dateStr}"

Write a 1500–2000 word article that is genuinely helpful to Cyprus homeowners. Ground every section in Cyprus-specific reality: the Mediterranean climate, older building stock in Nicosia/Larnaca/Limassol, shared apartment buildings, proximity to olive and citrus trees, and the island's specific pest species and seasonal patterns.

Tone: authoritative, direct, and human. Like the best advice from a professional who has seen everything. No filler, no generic statements that could apply anywhere in the world.

OUTPUT FORMAT — output ONLY the markdown file, starting immediately with the frontmatter. No preamble, no code fences:

---
layout: ../../layouts/BlogPost.astro
title: "${nextTopic.title}"
description: "[SEO meta description under 155 characters — specific and compelling, not generic]"
category: "${nextTopic.category}"
date: "${dateStr}"
readTime: [integer: total word count divided by 200, rounded to nearest whole number]
---

[Article body here]

FORMATTING RULES:
1. Use ## for main section headings (2–4 per article)
2. Use ### for sub-sections only when needed
3. For cost/risk callout boxes use exactly:
<div class="callout callout-warning">
  <div class="callout-icon">⚠</div>
  <div class="callout-body">
    <strong>Heading</strong>
    <p>Body text.</p>
  </div>
</div>

4. For tips/worth-knowing boxes use exactly:
<div class="callout callout-info">
  <div class="callout-icon">✓</div>
  <div class="callout-body">
    <strong>Heading</strong>
    <p>Body text.</p>
  </div>
</div>

5. Use > blockquotes for memorable one-liners or key professional insights
6. Use **bold** for important terms on first use
7. Link city names naturally where they appear in the text: [Nicosia](/pest-control-nicosia/), [Limassol](/pest-control-limassol/), [Larnaca](/pest-control-larnaca/), [Paphos](/pest-control-paphos/)

END the article with exactly this section:

---

## Book a Licensed Pest Control Inspection in Cyprus

We serve homeowners and businesses across the island. Find your nearest service area:

- [Pest Control Nicosia](/pest-control-nicosia/)
- [Pest Control Limassol](/pest-control-limassol/)
- [Pest Control Larnaca](/pest-control-larnaca/)
- [Pest Control Paphos](/pest-control-paphos/)
- [Pest Control Agia Napa](/pest-control-agia-napa/)
- [Pest Control Protaras](/pest-control-protaras/)`;

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  messages: [{ role: 'user', content: prompt }],
});

let articleContent = response.content[0].text.trim();

// Strip any accidental code fences
articleContent = articleContent.replace(/^```(?:markdown)?\n/, '').replace(/\n```$/, '');

// Extract fields from generated frontmatter
const descMatch = articleContent.match(/^description:\s*"(.+?)"\s*$/m);
const readTimeMatch = articleContent.match(/^readTime:\s*(\d+)\s*$/m);

const description = descMatch ? descMatch[1] : nextTopic.title;
const readTime = readTimeMatch ? parseInt(readTimeMatch[1]) : 8;

// Write article file
fs.writeFileSync(path.join(BLOG_DIR, `${nextTopic.slug}.md`), articleContent);
console.log(`Written: src/pages/blog/${nextTopic.slug}.md`);

// Update blog/index.astro — insert new article at front of array
const indexSrc = fs.readFileSync(INDEX_FILE, 'utf-8');
const escapedTitle = nextTopic.title.replace(/'/g, "\\'");
const escapedDesc = description.replace(/"/g, '\\"');
const newEntry = `  {
    slug: '${nextTopic.slug}',
    title: '${escapedTitle}',
    description: "${escapedDesc}",
    category: '${nextTopic.category}',
    date: '${dateStr}',
    readTime: ${readTime},
  },`;

fs.writeFileSync(INDEX_FILE, indexSrc.replace(
  'const articles = [',
  `const articles = [\n${newEntry}`
));
console.log('Updated: src/pages/blog/index.astro');

// Update sitemap.xml.js — insert new slug at front
const sitemapSrc = fs.readFileSync(SITEMAP_FILE, 'utf-8');
fs.writeFileSync(SITEMAP_FILE, sitemapSrc.replace(
  'const blogSlugs = [',
  `const blogSlugs = [\n  '${nextTopic.slug}',`
));
console.log('Updated: src/pages/sitemap.xml.js');

console.log(`\nDone — published at: /blog/${nextTopic.slug}/`);

// Submit sitemap to Google Search Console
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters'],
    });
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    await searchconsole.sitemaps.submit({
      siteUrl: 'https://pestcontrolcyp.com/',
      feedpath: 'https://pestcontrolcyp.com/sitemap.xml',
    });
    console.log('Sitemap submitted to Google Search Console.');
  } catch (err) {
    console.warn('Search Console submission failed:', err.message);
  }
} else {
  // Fallback: simple ping
  const sitemapUrl = encodeURIComponent('https://pestcontrolcyp.com/sitemap.xml');
  await fetch(`https://www.google.com/ping?sitemap=${sitemapUrl}`);
  console.log('Pinged Google sitemap endpoint.');
}

// Always ping Bing
await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent('https://pestcontrolcyp.com/sitemap.xml')}`);
console.log('Pinged Bing.');
