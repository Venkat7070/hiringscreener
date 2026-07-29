const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, 'knowledgebase');
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
  'and', 'or', 'in', 'on', 'for', 'with', 'my', 'your', 'i', 'you', 'it',
  'do', 'does', 'did', 'can', 'will', 'how', 'what', 'when', 'why', 'this',
  'that', 'have', 'has', 'had', 'not', 'me', 'about',
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (t) => t.length > 2 && !STOPWORDS.has(t)
  );
}

function loadArticles() {
  return fs
    .readdirSync(KB_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const content = fs.readFileSync(path.join(KB_DIR, file), 'utf8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const tokens = tokenize(content);
      const termCounts = new Map();
      for (const t of tokens) termCounts.set(t, (termCounts.get(t) || 0) + 1);
      return {
        file,
        title: titleMatch ? titleMatch[1] : file,
        content,
        termCounts,
      };
    });
}

const articles = loadArticles();

// Term frequency weighted by inverse document frequency, so common words
// shared across most articles (e.g. "policy", "device") don't drown out
// the words that actually distinguish one article from another. No
// embeddings needed for a corpus this small — swap for vector search if
// the knowledge base grows much larger.
const idf = new Map();
for (const article of articles) {
  for (const term of article.termCounts.keys()) {
    idf.set(term, (idf.get(term) || 0) + 1);
  }
}
for (const [term, docCount] of idf) {
  idf.set(term, Math.log((articles.length + 1) / docCount));
}

function retrieveRelevantArticles(query, topN = 3) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = articles
    .map((article) => {
      const score = queryTokens.reduce((sum, t) => {
        const tf = article.termCounts.get(t) || 0;
        if (tf === 0) return sum;
        return sum + tf * (idf.get(t) || 0);
      }, 0);
      return { article, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((s) => s.article);
}

module.exports = { retrieveRelevantArticles, articles };
